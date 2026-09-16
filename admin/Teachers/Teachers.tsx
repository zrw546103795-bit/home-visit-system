import React, { useCallback, useEffect, useState } from 'react';
import {
  Table,
  type TableProps,
} from 'antd';
import { toast } from 'sonner';
import { Search, Pencil, Trash2, UserPlus } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
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
import { Badge } from '@client/src/components/ui/badge';
import { Label } from '@client/src/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';

import { teachers } from '@client/src/api';
import {
  GRADE_LABELS,
  type Grade,
  type HeadTeacher,
  type PaginatedResponse,
} from '@shared/api.interface';

import TeacherFormDialog from './TeacherFormDialog';

const PAGE_SIZE = 10;

const Teachers: React.FC = () => {
  const [data, setData] = useState<HeadTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchName, setSearchName] = useState('');
  const [filterGrade, setFilterGrade] = useState<Grade | ''>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<HeadTeacher | null>(
    null,
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        pageSize: number;
        name?: string;
        grade?: Grade;
      } = {
        page,
        pageSize: PAGE_SIZE,
      };
      if (searchName.trim()) params.name = searchName.trim();
      if (filterGrade) params.grade = filterGrade;

      const result: PaginatedResponse<HeadTeacher> =
        await teachers.getTeacherList(params);
      setData(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('获取班主任列表失败', error);
      toast.error('获取班主任列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, searchName, filterGrade]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleGradeFilterChange = (value: string) => {
    setFilterGrade(value as Grade | '');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const openAddDialog = () => {
    setEditingTeacher(null);
    setDialogOpen(true);
  };

  const openEditDialog = (record: HeadTeacher) => {
    setEditingTeacher(record);
    setDialogOpen(true);
  };

  const openDeleteDialog = (record: HeadTeacher) => {
    setDeletingId(record.id);
    setDeletingName(record.name);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setDeleting(true);
    try {
      await teachers.deleteTeacher(deletingId);
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      // 如果当前页只剩一条且非第一页，删除后回到上一页
      if (data.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchTeachers();
      }
    } catch (error) {
      console.error('删除班主任失败', error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableProps<HeadTeacher>['columns'] = [
    {
      title: '姓名',
      dataIndex: 'name',
      fixed: 'left',
      width: 120,
    },
    {
      title: '账号',
      dataIndex: 'account',
      width: 180,
      render: (value: string | undefined) => value || '-',
    },
    {
      title: '年级',
      dataIndex: 'grade',
      width: 100,
      render: (grade: Grade) => (
        <Badge variant="secondary">{GRADE_LABELS[grade]}</Badge>
      ),
    },
    {
      title: '班级',
      dataIndex: 'className',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 160,
      render: (_: unknown, record: HeadTeacher) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditDialog(record)}
          >
            <Pencil className="w-4 h-4 mr-1" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => openDeleteDialog(record)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">班主任管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理班主任账号、班级分配与权限配置
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              班主任列表
            </CardTitle>
            <Button onClick={openAddDialog}>
              <UserPlus className="w-4 h-4 mr-1" />
              新增班主任
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                姓名：
              </Label>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索姓名"
                  value={searchName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchName(e.target.value)
                  }
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                年级：
              </Label>
              <Select
                value={filterGrade}
                onValueChange={handleGradeFilterChange}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部年级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部年级</SelectItem>
                  {(Object.keys(GRADE_LABELS) as Grade[]).map(
                    (grade: Grade) => (
                      <SelectItem key={grade} value={grade}>
                        {GRADE_LABELS[grade]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleSearch}>
              搜索
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="id"
            scroll={{ x: 700, y: 500 }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              onChange: handlePageChange,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: loading ? '' : '暂无班主任数据',
            }}
          />
        </CardContent>
      </Card>

      <TeacherFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTeacher={editingTeacher}
        onSuccess={fetchTeachers}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除班主任「{deletingName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Teachers;
