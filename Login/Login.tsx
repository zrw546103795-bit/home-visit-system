import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { School, Lock, User, LogIn } from 'lucide-react';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { useCurrentUser, getDashboardPath } from '@client/src/hooks/useCurrentUser';
import type { LoginDto } from '@shared/api.interface';

const Login: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { user, login, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  // 从 state 或 query 中获取跳转来源
  const stateFrom = (location.state as { from?: string } | null)?.from || null;
  const queryFrom = new URLSearchParams(location.search).get('from') || null;
  const from = stateFrom || queryFrom;

  // 已登录用户访问登录页 → 跳 dashboard
  useEffect(() => {
    if (user) {
      const dashboardPath = getDashboardPath(user.role);
      navigate(dashboardPath, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (!account.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }

    try {
      const dto: LoginDto = { account: account.trim(), password };
      const user = await login(dto);
      const dashboardPath = getDashboardPath(user.role);
      const target = from && from !== '/login' ? from : dashboardPath;
      navigate(target, { replace: true });
    } catch (err) {
      console.error('登录失败', err);
      setError('账号或密码错误，请重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8f0fe] to-[#f5f7fa] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-border">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <School className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">家访材料收集系统</h1>
            <p className="text-sm text-muted-foreground mt-1">请登录以继续</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  登录
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              还没有账号？
              <Link to="/register" className="text-primary hover:underline ml-1">
                立即注册
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              如有登录问题，请联系系统管理员
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

export default Login;
