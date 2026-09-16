import React from 'react';
import HomeVisitStats from '@client/src/components/HomeVisitStats';
import { useCurrentUser } from '@client/src/hooks/useCurrentUser';

const Stats: React.FC = () => {
  const { user } = useCurrentUser();

  if (!user) return null;
  return <HomeVisitStats role={user.role} />;
};

export default Stats;
