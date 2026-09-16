import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Clock, CheckCircle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { getMyRequest } from '@client/src/api/access-request';
import { getDashboardPath } from '@client/src/hooks/useCurrentUser';
import { USER_ROLE_LABELS, GRADE_LABELS } from '@shared/api.interface';
import type { AccessRequest, AccessRequestStatus } from '@shared/api.interface';

const statusConfig: Record<
  AccessRequestStatus,
  { title: string; desc: string; icon: React.ReactNode; color: string; bg: string }
> = {
  pending: {
    title: '申请正在审核中',
    desc: '您的访问申请已提交，请耐心等待管理员审核。',
    icon: <Clock className="w-12 h-12 text-amber-500" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  approved: {
    title: '申请已通过',
    desc: '您的访问申请已通过审核，请刷新页面或重新登录以进入系统。',
    icon: <CheckCircle className="w-12 h-12 text-green-500" />,
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
  },
  rejected: {
    title: '申请已被拒绝',
    desc: '很抱歉，您的访问申请未通过审核。',
    icon: <XCircle className="w-12 h-12 text-red-500" />,
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
};

const RequestStatus: React.FC = () => {
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadRequest = async (): Promise<void> => {
      try {
        const res = await getMyRequest();
        setRequest(res.request);
      } catch (err: unknown) {
        console.error('获取申请状态失败', err);
        setError('获取申请状态失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };
    void loadRequest();
  }, []);

  const handleRelogin = async (): Promise<void> => {
    try {
      const authApi = await import('@client/src/api/auth');
      const current = await authApi.getCurrentUser();
      navigate(getDashboardPath(current.role), { replace: true });
      return;
    } catch (err: unknown) {
      console.warn('重新登录失败，尝试刷新页面', err);
    }
    window.location.reload();
  };

  const handleReapply = (): void => {
    navigate('/bind', { replace: true });
  };

  const handleBack = (): void => {
    navigate('/bind', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8f0fe] to-[#f5f7fa]">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8f0fe] to-[#f5f7fa] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 border border-border text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">暂无申请记录</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {error || '您还没有提交过访问申请'}
            </p>
            <Button onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const config = statusConfig[request.status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8f0fe] to-[#f5f7fa] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-border">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <School className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">家访材料收集系统</h1>
            <p className="text-sm text-muted-foreground mt-1">访问申请状态</p>
          </div>

          <div className={`p-5 rounded-lg border ${config.bg} mb-6 text-center`}>
            <div className="flex justify-center mb-3">{config.icon}</div>
            <h2 className={`text-lg font-semibold ${config.color} mb-2`}>{config.title}</h2>
            <p className={`text-sm ${config.color} opacity-80`}>{config.desc}</p>
          </div>

          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">姓名</span>
              <span className="font-medium">{request.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">身份</span>
              <span className="font-medium">{USER_ROLE_LABELS[request.role]}</span>
            </div>
            {request.grade && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">年级</span>
                <span className="font-medium">{GRADE_LABELS[request.grade]}</span>
              </div>
            )}
            {request.className && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">班级</span>
                <span className="font-medium">{request.className}</span>
              </div>
            )}
            {request.reason && (
              <div>
                <span className="text-muted-foreground block mb-1">申请理由</span>
                <p className="text-foreground bg-muted/30 p-3 rounded-md">{request.reason}</p>
              </div>
            )}
            {request.status === 'rejected' && request.rejectReason && (
              <div>
                <span className="text-red-600 block mb-1 text-xs font-medium">拒绝理由</span>
                <p className="text-red-700 bg-red-50 p-3 rounded-md border border-red-100">
                  {request.rejectReason}
                </p>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">申请时间</span>
              <span className="font-medium">
                {new Date(request.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {request.status === 'approved' && (
              <Button className="w-full" onClick={handleRelogin}>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新登录
              </Button>
            )}
            {request.status === 'rejected' && (
              <Button className="w-full" onClick={handleReapply}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                重新申请
              </Button>
            )}
            {request.status === 'pending' && (
              <Button variant="outline" className="w-full" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 家访材料收集系统
        </p>
      </div>
    </div>
  );
};

export default RequestStatus;
