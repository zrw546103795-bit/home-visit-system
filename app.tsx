import React, { useEffect } from 'react';
import { Route, Routes, Outlet, useNavigate } from 'react-router-dom';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './pages/NotFound/NotFound';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import HomeRedirect from './pages/HomeRedirect/HomeRedirect';

import Dashboard from './pages/dashboard/Dashboard';
import Records from './pages/records/Records';
import Stats from './pages/stats/Stats';

import AdminTeachers from './pages/admin/Teachers/Teachers';
import AdminStudents from './pages/admin/Students/Students';
import AdminImport from './pages/admin/Import/Import';
import AdminAccessRequests from './pages/admin/AccessRequests/AccessRequests';

const RoutesComponent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = (e: Event): void => {
      const customEvent = e as CustomEvent<{ from?: string }>;
      const from = customEvent.detail?.from || '/login';
      if (!window.location.pathname.includes('/login')) {
        navigate('/login', { state: { from }, replace: true });
      }
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  return (
    <Routes>
      {/* 登录页 / 注册页 - 不需要 Layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 首页 - 根据角色跳转 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeRedirect />
          </ProtectedRoute>
        }
      />

      {/* 统一 Layout 路由 - 所有登录角色都可访问 */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin', 'school_leader', 'grade_head', 'grade_director', 'teacher']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/stats" element={<Stats />} />

        {/* 管理员专属路由 */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="/teachers" element={<AdminTeachers />} />
          <Route path="/students" element={<AdminStudents />} />
          <Route path="/access-requests" element={<AdminAccessRequests />} />
          <Route path="/import" element={<AdminImport />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
