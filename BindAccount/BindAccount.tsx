import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { School, Lock, User, Link2, UserPlus } from 'lucide-react';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import * as authApi from '@client/src/api/auth';
import { useCurrentUser, getDashboardPath } from '@client/src/hooks/useCurrentUser';
import AccessRequestForm from './AccessRequestForm';
import type { BindAccountDto } from '@shared/api.interface';

const BindAccount: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useCurrentUser();

  const from = (location.state as { from?: string } | null)?.from || null;

  const [account, setAccount] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [bindError, setBindError] = useState<string>('');
  const [bindLoading, setBindLoading] = useState<boolean>(false);

  const handleBindSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setBindError('');

    if (!account.trim() || !password.trim()) {
      setBindError('请输入账号和密码');
      return;
    }

    setBindLoading(true);
    try {
      const dto: BindAccountDto = { account: account.trim(), password };
      const response = await authApi.bindAccount(dto);
      console.info(`账号绑定成功: ${response.user.name}`);
      const dashboardPath = getDashboardPath(response.user.role);
      const target = from && from !== '/bind' ? from : dashboardPath;
      await refreshUser();
      navigate(target, { replace: true });
    } catch (err: unknown) {
      console.error('账号绑定失败', err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '账号或密码错误，请重试';
      setBindError(msg);
    } finally {
      setBindLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8f0fe] to-[#f5f7fa] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-border">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <School className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">家访材料收集系统</h1>
            <p className="text-sm text-muted-foreground mt-1">账号绑定与访问申请</p>
          </div>

          <Tabs defaultValue="bind" className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="bind" className="flex-1">
                <Link2 className="w-4 h-4 mr-1.5" />
                绑定已有账号
              </TabsTrigger>
              <TabsTrigger value="request" className="flex-1">
                <UserPlus className="w-4 h-4 mr-1.5" />
                提交访问申请
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bind">
              <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  您已通过豆包账号登录，请输入系统分配的账号密码完成绑定。
                  绑定后，下次登录可直接进入系统。
                </p>
              </div>

              <form onSubmit={handleBindSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="account">
                    账号
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="account"
                      type="text"
                      placeholder="请输入账号"
                      value={account}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccount(e.target.value)}
                      className="pl-10"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="password">
                    密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {bindError && (
                  <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {bindError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={bindLoading}
                >
                  {bindLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      绑定中...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      绑定账号
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="request">
              <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  如果您还没有系统账号，请填写以下信息提交访问申请。
                  管理员审核通过后即可使用系统。
                </p>
              </div>

              <AccessRequestForm />
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              如有疑问，请联系系统管理员
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 家访材料收集系统
        </p>
      </div>
    </div>
  );
};

export default BindAccount;
