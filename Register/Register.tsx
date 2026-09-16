import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { School, Lock, User, UserPlus, ChevronDown } from 'lucide-react';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import { useCurrentUser, getDashboardPath } from '@client/src/hooks/useCurrentUser';
import type { RegisterDto, UserRole, Grade } from '@shared/api.interface';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'teacher', label: '班主任' },
  { value: 'grade_head', label: '级长' },
  { value: 'grade_director', label: '年级主任' },
  { value: 'school_leader', label: '校级领导' },
];

const GRADE_OPTIONS: { value: Grade; label: string }[] = [
  { value: 'grade_1', label: '初一' },
  { value: 'grade_2', label: '初二' },
  { value: 'grade_3', label: '初三' },
];

const Register: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [grade, setGrade] = useState<Grade | ''>('');
  const [className, setClassName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { user, register: registerUser, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from || null;

  // 已登录用户访问注册页 → 跳 dashboard
  useEffect(() => {
    if (user) {
      const dashboardPath = getDashboardPath(user.role);
      navigate(dashboardPath, { replace: true });
    }
  }, [user, navigate]);

  const showGrade = role === 'teacher' || role === 'grade_head' || role === 'grade_director';
  const showClass = role === 'teacher';

  const validate = (): string => {
    if (!account.trim()) return '请输入账号';
    if (!password) return '请输入密码';
    if (password.length < 6) return '密码至少6位';
    if (!confirmPassword) return '请确认密码';
    if (password !== confirmPassword) return '两次输入的密码不一致';
    if (!name.trim()) return '请输入真实姓名';
    if (!role) return '请选择身份';
    if (showGrade && !grade) return '请选择年级';
    if (showClass && !className.trim()) return '请输入班级';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const dto: RegisterDto = {
        account: account.trim(),
        password,
        confirmPassword,
        name: name.trim(),
        role: role as UserRole,
      };
      if (showGrade && grade) dto.grade = grade;
      if (showClass && className.trim()) dto.className = className.trim();

      const user = await registerUser(dto);
      toast.success('注册成功，欢迎使用');
      const dashboardPath = getDashboardPath(user.role);
      const target = from && from !== '/register' ? from : dashboardPath;
      navigate(target, { replace: true });
    } catch (err) {
      console.error('注册失败', err);
      const message = err instanceof Error ? err.message : '注册失败，请重试';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8f0fe] to-[#f5f7fa] p-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-border">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <School className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">家访材料收集系统</h1>
            <p className="text-sm text-muted-foreground mt-1">创建新账号</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="请输入密码，至少6位"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="confirmPassword">
                确认密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                姓名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="请输入真实姓名"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                身份
              </label>
              <Select value={role} onValueChange={(v: string) => {
                setRole(v as UserRole);
                setGrade('');
                setClassName('');
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择身份" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showGrade && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  年级
                </label>
                <Select value={grade} onValueChange={(v: string) => setGrade(v as Grade)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择年级" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showClass && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="className">
                  班级
                </label>
                <Input
                  id="className"
                  type="text"
                  placeholder="请输入班级，如：1班"
                  value={className}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClassName(e.target.value)}
                />
              </div>
            )}

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
                  注册中...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  注册
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              已有账号？
              <Link to="/login" className="text-primary hover:underline ml-1">
                返回登录
              </Link>
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

export default Register;
