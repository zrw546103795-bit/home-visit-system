import React from 'react';
import { FileText } from 'lucide-react';
import HomeVisitRecordList from '@client/src/components/HomeVisitRecordList';
import { useCurrentUser } from '@client/src/hooks/useCurrentUser';
import { USER_ROLE_LABELS } from '@shared/api.interface';

const Records: React.FC = () => {
  const { user } = useCurrentUser();
  const hasFullAccess = user?.role === 'admin' || user?.role === 'school_leader';

  const getSubtitle = (): string => {
    if (!user) return '';
    if (hasFullAccess) return '查看全校各班级家访记录与附件材料';
    if (user.role === 'grade_head' || user.role === 'grade_director')
      return '管理本年级各班家访记录与材料附件';
    return '管理本班学生的家访记录与材料附件';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          家访记录
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{getSubtitle()}</p>
        {user?.role === 'teacher' && user.grade && user.className && (
          <p className="text-xs text-muted-foreground mt-0.5">
            角色：{USER_ROLE_LABELS[user.role]}
          </p>
        )}
      </div>
      <HomeVisitRecordList role={user?.role} />
    </div>
  );
};

export default Records;
