import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  BarChart3,
  Upload,
  LogOut,
  School,
} from 'lucide-react';
import { useCurrentUser, getDashboardPath } from '@client/src/hooks/useCurrentUser';
import { USER_ROLE_LABELS, GRADE_LABELS } from '@shared/api.interface';
import type { UserRole } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@client/src/components/ui/avatar';
import { Badge } from '@client/src/components/ui/badge';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function getMenusByRole(role: UserRole): MenuItem[] {
  const base: MenuItem[] = [
    { path: '/dashboard', label: '首页概览', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/records', label: '家访记录', icon: <FileText className="w-5 h-5" /> },
    { path: '/stats', label: '数据统计', icon: <BarChart3 className="w-5 h-5" /> },
  ];
  if (role === 'admin') {
    return [
      base[0],
      { path: '/teachers', label: '班主任管理', icon: <Users className="w-5 h-5" /> },
      { path: '/students', label: '学生管理', icon: <UserPlus className="w-5 h-5" /> },
      base[1],
      base[2],
      { path: '/import', label: '名单导入', icon: <Upload className="w-5 h-5" /> },
    ];
  }
  return base;
}

const Layout: React.FC = () => {
  const { user, logout } = useCurrentUser();
  const navigate = useNavigate();

  const menus = user ? getMenusByRole(user.role) : [];

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name: string): string => {
    return name.slice(-2);
  };

  const getRoleLabel = (): string => {
    return user ? USER_ROLE_LABELS[user.role] : '';
  };

  return (
    <div className="flex h-screen w-screen bg-muted/30 overflow-hidden">
      {/* 左侧导航栏 */}
      <aside
        className="flex flex-col bg-sidebar border-r border-sidebar-border"
        style={{ width: 240 }}
      >
        {/* Logo 区域 */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center">
              <School className="w-5 h-5 text-sidebar-primary" />
            </div>
            <span className="font-semibold text-sidebar-foreground text-base">
              家访材料系统
            </span>
          </div>
        </div>

        {/* 角色标签 */}
        {user && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <Badge variant="outline" className="w-full justify-center bg-sidebar-accent/50">
              {getRoleLabel()}
            </Badge>
          </div>
        )}

        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {menus.map((item: MenuItem) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }): string =>
                [
                  'flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <Badge
                  variant="destructive"
                  className="min-w-[20px] h-5 px-1 justify-center text-[10px] rounded-full"
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="h-14 bg-background border-b border-border flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">
            {user?.role === 'teacher' && user.grade && user.className && (
              <span>{GRADE_LABELS[user.grade]} {user.className}</span>
            )}
            {(user?.role === 'grade_head' || user?.role === 'grade_director') && user.grade && (
              <span>{GRADE_LABELS[user.grade]}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 hover:bg-muted">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {user ? getInitials(user.name) : '...'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {user?.name || '加载中...'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <ErrorBoundary
              fallbackRender={({ error, resetErrorBoundary }) => {
                const err = error as Error;
                return (
                <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <h2 className="text-lg font-semibold text-destructive mb-2">页面渲染错误</h2>
                  <p className="text-sm text-destructive/90 mb-2">{err?.message || '未知错误'}</p>
                  <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-64 text-muted-foreground">
                    {err?.stack || '无堆栈信息'}
                  </pre>
                  <button
                    onClick={resetErrorBoundary}
                    className="mt-3 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded"
                  >
                    重试
                  </button>
                </div>
              );}}
            >
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
