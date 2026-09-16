import React, { useCallback, useEffect, useState } from 'react';
import { Table, type TableProps } from 'antd';
import { toast } from 'sonner';
import { Search, UserPlus, Edit2, Trash2, RotateCcw } from 'lucide-react';
import type {
  CreateStudentDto,
  Grade,
  Student,
  StudentListParams,
} from '@shared/api.interface';
import { GRADE_LABELS } from '@shared/api.interface';
import { students, classes } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
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
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from '@client/src/components/ui/empty';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';

interface FormState {
  name: string;
  grade: Grade | '';
  className: string;
}

interface FormErrors {
  name?: string;
  grade?: string;
  className?: string;
}

interface ClassGroup {
  grade: Grade;
  gradeLabel: string;
  classes: { id: string; className: string }[];
}

const GRADE_OPTIONS: Grade[] = ['grade_1', 'grade_2', 'grade_3'];
const PAGE_SIZE = 10;

const Students: React.FC = () => {
  // 列表数据
  const [list, setList] = useState<Student[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // 筛选条件
  const [searchName, setSearchName] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<Grade | ''>('');
  const [filterClassName, setFilterClassName] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // 班级列表
  const [classList, setClassList] = useState<ClassGroup[]>([]);
  const [classListLoading, setClassListLoading] = useState<boolean>(false);

  // 新增/编辑弹窗
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ name: '', grade: '', className: '' });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 删除确认弹窗
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // 根据年级获取班级名称列表
  const getClassNames = (grade: Grade | ''): string[] => {
    if (!grade) return [];
    const group = classList.find((g) => g.grade === grade);
    return group ? group.classes.map((c) => c.className) : [];
  };

  // 加载班级列表
  useEffect(() => {
    let cancelled = false;
    const loadClasses = async (): Promise<void> => {
      setClassListLoading(true);
      try {
        const data = await classes.getClassList();
        if (!cancelled) setClassList(data);
      } catch (error) {
        console.error('加载班级列表失败', error);
      } finally {
        if (!cancelled) setClassListLoading(false);
      }
    };
    void loadClasses();
    return () => { cancelled = true; };
  }, []);

  // 加载学生列表
  const fetchList = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const params: StudentListParams = { page, pageSize: PAGE_SIZE };
      if (searchName.trim()) params.name = searchName.trim();
      if (filterGrade) params.grade = filterGrade;
      if (filterClassName.trim()) params.className = filterClassName.trim();
      const data = await students.getStudentList(params);
      setList(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('加载学生列表失败', error);
      toast.error('加载学生列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, searchName, filterGrade, filterClassName]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  // 筛选操作
  const handleSearch = (): void => { setPage(1); void fetchList(); };
  const handleReset = (): void => {
    setSearchName('');
    setFilterGrade('');
    setFilterClassName('');
    setPage(1);
  };

  // 新增
  const handleAdd = (): void => {
    setEditingId(null);
    setFormState({ name: '', grade: '', className: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  // 编辑
  const handleEdit = (record: Student): void => {
    setEditingId(record.id);
    setFormState({ name: record.name, grade: record.grade, className: record.className });
    setFormErrors({});
    setDialogOpen(true);
  };

  // 表单校验
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formState.name.trim()) errors.name = '请输入学生姓名';
    if (!formState.grade) errors.grade = '请选择年级';
    if (!formState.className.trim()) errors.className = '请选择或输入班级';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交新增/编辑
  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const dto: CreateStudentDto = {
        name: formState.name.trim(),
        grade: formState.grade as Grade,
        className: formState.className.trim(),
      };
      if (editingId) {
        await students.updateStudent(editingId, dto);
        toast.success('学生信息已更新');
      } else {
        await students.createStudent(dto);
        toast.success('学生已添加');
      }
      setDialogOpen(false);
      void fetchList();
    } catch (error) {
      console.error('保存学生信息失败', error);
      toast.error(editingId ? '更新失败' : '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除
  const handleDeleteClick = (record: Student): void => {
    setDeletingId(record.id);
    setDeletingName(record.name);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deletingId) return;
    setDeleteLoading(true);
    try {
      await students.deleteStudent(deletingId);
      toast.success('学生已删除');
      setDeleteOpen(false);
      if (list.length === 1 && page > 1) setPage(page - 1);
      else void fetchList();
    } catch (error) {
      console.error('删除学生失败', error);
      toast.error('删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 表格列定义
  const columns: TableProps<Student>['columns'] = [
    { title: '姓名', dataIndex: 'name', fixed: 'left', width: 160, ellipsis: true },
    { title: '年级', dataIndex: 'grade', width: 120, render: (g: Grade) => GRADE_LABELS[g] ?? g },
    { title: '班级', dataIndex: 'className', width: 120 },
    {
      title: '操作', key: 'action', fixed: 'right', width: 160,
      render: (_: unknown, record: Student) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
            <Edit2 className="size-3.5" />编辑
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            onClick={() => handleDeleteClick(record)}>
            <Trash2 className="size-3.5" />删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">学生管理</h1>
          <p className="text-sm text-muted-foreground mt-1">查看和管理全校学生信息</p>
        </div>
        <Button onClick={handleAdd}><UserPlus className="size-4" />新增学生</Button>
      </div>

      {/* 筛选栏 */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search-name">姓名</Label>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="search-name" placeholder="搜索学生姓名" className="pl-8"
                  value={searchName} onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>年级</Label>
              <Select value={filterGrade} onValueChange={(val) => {
                setFilterGrade(val as Grade | '');
                setFilterClassName('');
              }}>
                <SelectTrigger className="w-32"><SelectValue placeholder="全部年级" /></SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g}>{GRADE_LABELS[g]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>班级</Label>
              <Select value={filterClassName} onValueChange={setFilterClassName}
                disabled={!filterGrade || classListLoading}>
                <SelectTrigger className="w-32"><SelectValue placeholder="全部班级" /></SelectTrigger>
                <SelectContent>
                  {getClassNames(filterGrade).map((cn) => (
                    <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleSearch}>
                <Search className="size-4" />查询
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="size-4" />重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 表格 */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            学生列表
            <span className="ml-2 text-sm font-normal text-muted-foreground">共 {total} 名学生</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && list.length === 0 ? (
            <Empty className="border-none py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Search className="size-5" /></EmptyMedia>
                <EmptyTitle>暂无学生数据</EmptyTitle>
                <EmptyDescription>暂无符合条件的学生，点击"新增学生"添加第一个学生</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={handleAdd}><UserPlus className="size-4" />新增学生</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table<Student>
              columns={columns} dataSource={list} rowKey="id" loading={loading}
              scroll={{ x: 600, y: 480 }}
              pagination={{
                current: page, pageSize: PAGE_SIZE, total,
                onChange: (p: number) => setPage(p), showSizeChanger: false,
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑学生' : '新增学生'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="student-name">姓名 <span className="text-destructive">*</span></Label>
              <Input id="student-name" placeholder="请输入学生姓名" value={formState.name}
                onChange={(e) => {
                  setFormState({ ...formState, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }} />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>年级 <span className="text-destructive">*</span></Label>
              <Select value={formState.grade} onValueChange={(val) => {
                setFormState({ ...formState, grade: val as Grade | '', className: '' });
                if (formErrors.grade) setFormErrors({ ...formErrors, grade: undefined });
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="请选择年级" /></SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g}>{GRADE_LABELS[g]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.grade && <p className="text-xs text-destructive">{formErrors.grade}</p>}
            </div>
            <div className="space-y-2">
              <Label>班级 <span className="text-destructive">*</span></Label>
              <Select value={formState.className} onValueChange={(val) => {
                setFormState({ ...formState, className: val });
                if (formErrors.className) setFormErrors({ ...formErrors, className: undefined });
              }} disabled={!formState.grade || classListLoading}>
                <SelectTrigger className="w-full"><SelectValue placeholder="请选择班级" /></SelectTrigger>
                <SelectContent>
                  {getClassNames(formState.grade).map((cn) => (
                    <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.className && <p className="text-xs text-destructive">{formErrors.className}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除学生「{deletingName}」吗？删除后不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Students;
