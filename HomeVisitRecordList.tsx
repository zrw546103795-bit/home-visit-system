import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, type TableProps } from 'antd';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  CalendarIcon,
  Eye,
  Pencil,
  Trash2,
  FileText,
  Filter,
  Download,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Badge } from '@client/src/components/ui/badge';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Calendar } from '@client/src/components/ui/calendar';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@client/src/components/ui/empty';
import HomeVisitRecordForm from './HomeVisitRecordForm';
import HomeVisitRecordDetail from './HomeVisitRecordDetail';

import {
  type Grade,
  type VisitForm,
  type VisitCategory,
  type HomeVisitRecord,
  type RecordListParams,
  type PaginatedResponse,
  type UserRole,
} from '@shared/api.interface';
import { useCurrentUser } from '@client/src/hooks/useCurrentUser';
import { homeVisit } from '@client/src/api';

interface HomeVisitRecordListProps {
  role?: UserRole;
}

const PAGE_SIZE = 10;

const GRADE_OPTIONS = [
  { value: 'grade_1', label: '初一' },
  { value: 'grade_2', label: '初二' },
  { value: 'grade_3', label: '初三' },
];

const VISIT_FORM_OPTIONS = [
  { value: 'on_site', label: '实地家访' },
  { value: 'school', label: '到校家访' },
  { value: 'phone', label: '电话家访' },
  { value: 'wechat', label: '微信家访' },
];

const CATEGORY_OPTIONS = [
  { value: 'regular', label: '常规家访' },
  { value: 'key_care', label: '重点关爱学生家访' },
  { value: 'other', label: '其他家访' },
];

const CLASS_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: `${i + 1}班`,
  label: `${i + 1}班`,
}));

const CATEGORY_LABEL_MAP: Record<string, string> = CATEGORY_OPTIONS.reduce(
  (acc, opt) => { acc[opt.value] = opt.label; return acc; },
  {} as Record<string, string>,
);

const FORM_LABEL_MAP: Record<string, string> = VISIT_FORM_OPTIONS.reduce(
  (acc, opt) => { acc[opt.value] = opt.label; return acc; },
  {} as Record<string, string>,
);

const GRADE_LABEL_MAP: Record<string, string> = GRADE_OPTIONS.reduce(
  (acc, opt) => { acc[opt.value] = opt.label; return acc; },
  {} as Record<string, string>,
);

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${yyyy}-${mm}`;
    options.push({ value, label: `${yyyy}年${mm}月` });
  }
  return options;
}

const HomeVisitRecordList: React.FC<HomeVisitRecordListProps> = ({
  role = 'teacher',
}) => {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HomeVisitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);

  // Filters
  const [studentName, setStudentName] = useState('');
  const [month, setMonth] = useState('');
  const [grade, setGrade] = useState<Grade | ''>('');
  const [className, setClassName] = useState('');
  const [visitForm, setVisitForm] = useState<VisitForm | ''>('');
  const [category, setCategory] = useState<VisitCategory | ''>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const isHeadTeacher = user?.role === 'teacher';
  const isGradeLevel = user?.role === 'grade_head' || user?.role === 'grade_director';
  const hasFullAccess = user?.role === 'admin' || user?.role === 'school_leader';
  const effectiveGrade =
    isHeadTeacher || isGradeLevel ? (user.grade || '') : grade;
  const effectiveClassName = isHeadTeacher ? (user.className || '') : className;

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HomeVisitRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<HomeVisitRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<HomeVisitRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: RecordListParams = {
        page,
        pageSize: PAGE_SIZE,
        studentName: studentName.trim() || undefined,
        month: month || undefined,
        visitForm: visitForm || undefined,
        category: category || undefined,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd', { locale: zhCN }) : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd', { locale: zhCN }) : undefined,
      };
      if (hasFullAccess) {
        params.grade = grade || undefined;
        params.className = className.trim() || undefined;
      } else if (isGradeLevel) {
        params.grade = user?.grade || undefined;
        params.className = className.trim() || undefined;
      }
      const res: PaginatedResponse<HomeVisitRecord> = await homeVisit.getRecordList(params);
      setData(res.items);
      setTotal(res.total);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(`获取家访记录列表失败: ${String(err)}`);
      toast.error('获取列表失败，请稍后重试');
      setData([]);
      setTotal(0);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [page, studentName, month, grade, className, visitForm, category, startDate, endDate, hasFullAccess, isGradeLevel, user?.grade]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => { setPage(1); setSelectedIds(new Set()); };

  const handleReset = () => {
    setStudentName(''); setMonth(''); setGrade(''); setClassName('');
    setVisitForm(''); setCategory('');
    setStartDate(null); setEndDate(null);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const filters: Omit<RecordListParams, 'page' | 'pageSize'> = {
        studentName: studentName.trim() || undefined,
        month: month || undefined,
        visitForm: visitForm || undefined,
        category: category || undefined,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd', { locale: zhCN }) : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd', { locale: zhCN }) : undefined,
      };
      if (hasFullAccess) {
        filters.grade = grade || undefined;
        filters.className = className.trim() || undefined;
      } else if (isGradeLevel) {
        filters.grade = user?.grade || undefined;
        filters.className = className.trim() || undefined;
      }
      await homeVisit.exportRecords(filters);
      toast.success('导出成功');
    } catch (err) {
      console.error(`导出家访记录失败: ${String(err)}`);
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const handleAdd = () => { setEditingRecord(null); setFormOpen(true); };

  const allPageIds = data.map((r: HomeVisitRecord) => r.id);
  const allChecked = data.length > 0 && allPageIds.every((id: string) => selectedIds.has(id));
  const indeterminate = data.length > 0 && !allChecked && allPageIds.some((id: string) => selectedIds.has(id));

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(allPageIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    const hasAttachments = data.some((r: HomeVisitRecord) =>
      r.attachments && r.attachments.length > 0 && selectedIds.has(r.id),
    );
    if (!hasAttachments) {
      toast.info('选中的记录没有附件可供下载');
      return;
    }
    setBatchDownloading(true);
    try {
      await homeVisit.batchDownload(Array.from(selectedIds));
      toast.success('下载已开始');
    } catch (err) {
      console.error(`批量下载失败: ${String(err)}`);
      toast.error('下载失败，请稍后重试');
    } finally {
      setBatchDownloading(false);
    }
  };
  const handleEdit = (record: HomeVisitRecord) => { setEditingRecord(record); setFormOpen(true); };
  const handleViewDetail = (record: HomeVisitRecord) => { setDetailRecord(record); setDetailOpen(true); };
  const handleDelete = (record: HomeVisitRecord) => { setDeletingRecord(record); setDeleteOpen(true); };

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    setDeleting(true);
    try {
      await homeVisit.deleteRecord(deletingRecord.id);
      toast.success('删除成功');
      setDeleteOpen(false);
      fetchData();
    } catch (err) {
      console.error(`删除家访记录失败: ${String(err)}`);
      toast.error('删除失败，请稍后重试');
    } finally { setDeleting(false); }
  };

  const columns: TableProps<HomeVisitRecord>['columns'] = [
    {
      title: (
        <div className="flex justify-center">
          <Checkbox
            checked={indeterminate ? 'indeterminate' : allChecked}
            onCheckedChange={(c: boolean | 'indeterminate') => handleToggleAll(Boolean(c))}
            aria-label="全选"
          />
        </div>
      ),
      width: 50,
      fixed: 'left',
      align: 'center',
      render: (_: unknown, record: HomeVisitRecord) => (
        <div className="flex justify-center">
          <Checkbox
            checked={selectedIds.has(record.id)}
            onCheckedChange={(c: boolean | 'indeterminate') => handleToggleOne(record.id, Boolean(c))}
            aria-label={`选择 ${record.studentName}`}
          />
        </div>
      ),
    },
    { title: '年级', dataIndex: 'grade', width: 80,
      render: (v: Grade) => GRADE_LABEL_MAP[v] || v },
    { title: '班级', dataIndex: 'className', width: 80 },
    { title: '学生姓名', dataIndex: 'studentName', width: 120 },
    { title: '月份', dataIndex: 'visitDate', width: 100, align: 'center',
      render: (v: string) => (v ? v.slice(0, 7) : '—') },
    { title: '家访日期', dataIndex: 'visitDate', width: 120 },
    { title: '家访形式', dataIndex: 'visitForm', width: 110,
      render: (v: VisitForm) => FORM_LABEL_MAP[v] || v },
    { title: '家访类别', dataIndex: 'category', width: 160,
      render: (v: VisitCategory) => <Badge variant="secondary">{CATEGORY_LABEL_MAP[v] || v}</Badge> },
    { title: '内容摘要', dataIndex: 'summary', ellipsis: true,
      render: (v: string | undefined) => v || '—' },
    { title: '操作', key: 'action', fixed: 'right', width: 200,
      render: (_: unknown, record: HomeVisitRecord) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(record)}>
            <Eye className="h-4 w-4" /> 查看
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
            <Pencil className="h-4 w-4" /> 编辑
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(record)}>
            <Trash2 className="h-4 w-4" /> 删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-base font-medium">
            <Filter className="h-4 w-4" /> 筛选条件
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <FilterField label="月份">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full"><SelectValue placeholder="全部月份" /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="年级">
              <Select
                value={effectiveGrade}
                 onValueChange={(v) => setGrade(v as Grade)}
                 disabled={isHeadTeacher || isGradeLevel}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="全部年级" /></SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="班级">
              <Select
                value={effectiveClassName}
                onValueChange={setClassName}
                 disabled={isHeadTeacher || !effectiveGrade}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={!effectiveGrade ? '请先选择年级' : '全部班级'} />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="家访形式">
              <Select value={visitForm} onValueChange={(v) => setVisitForm(v as VisitForm)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="全部形式" /></SelectTrigger>
                <SelectContent>
                  {VISIT_FORM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="家访类别">
              <Select value={category} onValueChange={(v) => setCategory(v as VisitCategory)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="全部类别" /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="学生姓名">
              <Input value={studentName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentName(e.target.value)}
                placeholder="搜索学生姓名"
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); }} />
            </FilterField>

            <FilterField label="开始日期">
              <DatePicker value={startDate} onChange={setStartDate} />
            </FilterField>
            <FilterField label="结束日期">
              <DatePicker value={endDate} onChange={setEndDate} />
            </FilterField>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                {exporting ? '导出中...' : '导出表格'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>重置</Button>
              <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" />查询</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="text-base font-medium">
            家访记录列表
            {total > 0 && <span className="text-sm text-muted-foreground ml-2">共 {total} 条</span>}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                onClick={handleBatchDownload}
                disabled={batchDownloading}
              >
                {batchDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                批量下载 ({selectedIds.size})
              </Button>
            )}
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />新增记录</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && data.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText className="size-6" /></EmptyMedia>
                <EmptyTitle>暂无家访记录</EmptyTitle>
                <EmptyDescription>点击右上角"新增记录"按钮创建第一条家访记录</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table<HomeVisitRecord>
              columns={columns} dataSource={data} loading={loading} rowKey="id"
              scroll={{ x: 1250, y: 500 }}
              pagination={{
                current: page, pageSize: PAGE_SIZE, total,
                onChange: (p: number) => setPage(p), showSizeChanger: false,
              }}
            />
          )}
        </CardContent>
      </Card>

      <HomeVisitRecordForm open={formOpen} onOpenChange={setFormOpen}
        record={editingRecord} onSuccess={fetchData}
        userRole={role}
        defaultGrade={user?.grade}
        defaultClassName={user?.className}
        defaultClassId={user?.classId}
        canEditStudentName={hasFullAccess} />
      <HomeVisitRecordDetail open={detailOpen} onOpenChange={setDetailOpen}
        record={detailRecord} isAdmin={hasFullAccess} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除学生"{deletingRecord?.studentName}"的家访记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete} disabled={deleting}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-sm text-muted-foreground">{label}</label>
    {children}
  </div>
);

const DatePicker: React.FC<{ value: Date | null; onChange: (d: Date | null) => void }> = ({ value, onChange }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="w-full justify-start">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, 'yyyy-MM-dd', { locale: zhCN }) : <span className="text-muted-foreground">选择日期</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value ?? undefined}
        onSelect={(d) => onChange(d ?? null)} initialFocus />
    </PopoverContent>
  </Popover>
);

export default HomeVisitRecordList;
