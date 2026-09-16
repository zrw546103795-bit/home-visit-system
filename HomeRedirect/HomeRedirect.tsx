import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser, getDashboardPath } from '@client/src/hooks/useCurrentUser';

const HomeRedirect: React.FC = () => {
  const { user } = useCurrentUser();

  // 外层已有 ProtectedRoute，user 一定存在
  const targetPath = user ? getDashboardPath(user.role) : '/dashboard';
  return <Navigate to={targetPath} replace />;
};

export default HomeRedirect;
