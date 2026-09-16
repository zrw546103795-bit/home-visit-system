import React, { useCallback, useEffect, useState } from 'react';
import {
  Table,
  type TableProps,
} from 'antd';
import { toast } from 'sonner';
import { Check, X, FileQuestion, UserCheck } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Badge } from '@client/src/components/ui/badge';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';

import {
  listRequests,
  reviewRequest,
} from '@client/src/api/access-request';
import {
  GRADE_LABELS,
  USER_ROLE_LABELS,
  type AccessRequest,
  type AccessRequestStatus,
  type PaginatedResponse,
} from '@shared/api.interface';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ value: AccessRequestStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已同意' },
  { value: 'rejected', label: '已拒绝' },
];

function getStatusBadgeVariant(
  status: AccessRequestStatus,
): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'pending':
      return 'secondary';
    default:
      return 'secondary';
  }
}

function getStatusLabel(status: AccessRequestStatus): string {
  switch (status) {
    case 'approved':
      return '已同意';
    case 'rejected':
      return '已拒绝';
    case 'pending':
      return '待审核';
    default:
      return status;
  }
}

function formatDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return isoStr;
  }
}

const AccessRequests: React.FC = () => {
  const [data, setData] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<AccessRequestStatus | 'all'>('all');

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        pageSize: number;
        status?: AccessRequestStatus;
      } = {
        page,
        pageSize: PAGE_SIZE,
      };
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const result: PaginatedResponse<AccessRequest> = await listRequests(params);
      setData(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('获取访问申请列表失败', error);
      toast.error('获取访问申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleStatusFilterChange = (value: string) => {
    setFilterStatus(value as AccessRequestStatus | 'all');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const openApproveDialog = (record: AccessRequest) => {
    setCurrentRequest(record);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (record: AccessRequest) => {
    setCurrentRequest(record);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!currentRequest) return;
    setSubmitting(true);
    try {
      await reviewRequest(currentRequest.id, { action: 'approve' });
      toast.success('已同意申请');
      setApproveDialogOpen(false);
      fetchList();
    } catch (error) {
      console.error('同意申请失败', error);
      toast.error('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!currentRequest) return;
    if (!rejectReason.trim()) {
      toast.error('请填写拒绝理由');
      return;
    }
    setSubmitting(true);
    try {
      await reviewRequest(currentRequest.id, {
        action: 'reject',
        rejectReason: rejectReason.trim(),
      });
      toast.success('已拒绝申请');
      setRejectDialogOpen(false);
      fetchList();
    } catch (error) {
      console.error('拒绝申请失败', error);
      toast.error('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableProps<AccessRequest>['columns'] = [
    {
      title: '申请人',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '豆包账号',
      dataIndex: 'platformUserName',
      width: 140,
      render: (value: string | undefined) => value || '-',
    },
    {
      title: '申请身份',
      dataIndex: 'role',
      width: 100,
      render: (role: AccessRequest['role']) => (
        <Badge variant="outline">{USER_ROLE_LABELS[role]}</Badge>
      ),
    },
    {
      title: '年级班级',
      key: 'gradeClass',
      width: 120,
      render: (_: unknown, record: AccessRequest) => {
        if (record.grade && record.className) {
          return `${GRADE_LABELS[record.grade]} ${record.className}`;
        }
        if (record.grade) {
          return GRADE_LABELS[record.grade];
        }
        return '-';
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: AccessRequestStatus) => (
        <Badge variant={getStatusBadgeVariant(status)}>
          {getStatusLabel(status)}
        </Badge>
      ),
    },
    {
      title: '申请理由',
      dataIndex: 'reason',
      width: 200,
      ellipsis: true,
      render: (value: string | undefined) => (
        <span title={value || ''} className="text-muted-foreground">
          {value || '-'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_: unknown, record: AccessRequest) => {
        if (record.status !== 'pending') {
          return <span className="text-muted-foreground text-sm">-</span>;
        }
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-green-600"
              onClick={() => openApproveDialog(record)}
            >
              <Check className="w-4 h-4 mr-1" />
              同意
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => openRejectDialog(record)}
            >
              <X className="w-4 h-4 mr-1" />
              拒绝
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">访问申请审批</h1>
        <p className="text-sm text-muted-foreground mt-1">
          审核用户的访问权限申请
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              申请列表
            </CardTitle>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                共 {total} 条申请
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                状态：
              </Label>
              <Select
                value={filterStatus}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="id"
            scroll={{ x: 1000, y: 500 }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              onChange: handlePageChange,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: loading ? '' : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <FileQuestion className="w-10 h-10 mb-2 opacity-50" />
                  <span>暂无申请数据</span>
                </div>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* 同意确认弹窗 */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认同意</AlertDialogTitle>
            <AlertDialogDescription>
              确定要同意「{currentRequest?.name}」的访问申请吗？
              同意后该用户将获得{currentRequest ? USER_ROLE_LABELS[currentRequest.role] : ''}权限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? '处理中...' : '确认同意'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 拒绝弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝申请</DialogTitle>
            <DialogDescription>
              请填写拒绝「{currentRequest?.name}」申请的理由
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">拒绝理由</Label>
              <Textarea
                id="reject-reason"
                placeholder="请输入拒绝理由..."
                value={rejectReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setRejectReason(e.target.value)
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting}
            >
              {submitting ? '提交中...' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessRequests;
