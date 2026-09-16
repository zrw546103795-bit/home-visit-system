import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Send } from 'lucide-react';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { submitRequest } from '@client/src/api/access-request';
import {
  USER_ROLE_LABELS,
  GRADE_LABELS,
} from '@shared/api.interface';
import type {
  CreateAccessRequestDto,
  UserRole,
  Grade,
} from '@shared/api.interface';

const REQUEST_ROLES: UserRole[] = ['teacher', 'grade_head', 'grade_director', 'school_leader'];
const GRADE_REQUIRED_ROLES: UserRole[] = ['teacher', 'grade_head', 'grade_director'];
const CLASS_REQUIRED_ROLES: UserRole[] = ['teacher'];
const GRADE_OPTIONS: Grade[] = ['grade_1', 'grade_2', 'grade_3'];

const AccessRequestForm: React.FC = () => {
  const navigate = useNavigate();

  const [reqName, setReqName] = useState<string>('');
  const [reqRole, setReqRole] = useState<UserRole | ''>('');
  const [reqGrade, setReqGrade] = useState<Grade | ''>('');
  const [reqClassName, setReqClassName] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [reqError, setReqError] = useState<string>('');
  const [reqLoading, setReqLoading] = useState<boolean>(false);

  const handleRequestSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setReqError('');

    if (!reqName.trim()) {
      setReqError('请输入姓名');
      return;
    }
    if (!reqRole) {
      setReqError('请选择身份');
      return;
    }
    if (GRADE_REQUIRED_ROLES.includes(reqRole) && !reqGrade) {
      setReqError('请选择年级');
      return;
    }
    if (CLASS_REQUIRED_ROLES.includes(reqRole) && !reqClassName.trim()) {
      setReqError('请输入班级');
      return;
    }

    const dto: CreateAccessRequestDto = {
      name: reqName.trim(),
      role: reqRole,
    };
    if (reqGrade) dto.grade = reqGrade;
    if (reqClassName.trim()) dto.className = reqClassName.trim();
    if (reqReason.trim()) dto.reason = reqReason.trim();

    setReqLoading(true);
    try {
      await submitRequest(dto);
      console.info('访问申请提交成功');
      navigate('/request-status', { replace: true });
    } catch (err: unknown) {
      console.error('访问申请提交失败', err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '提交失败，请稍后重试';
      setReqError(msg);
    } finally {
      setReqLoading(false);
    }
  };

  const showGrade = reqRole && GRADE_REQUIRED_ROLES.includes(reqRole);
  const showClass = reqRole && CLASS_REQUIRED_ROLES.includes(reqRole);

  return (
    <form onSubmit={handleRequestSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="req-name">
          姓名 <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="req-name"
            type="text"
            placeholder="请输入姓名"
            value={reqName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReqName(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          身份 <span className="text-destructive">*</span>
        </label>
        <Select
          value={reqRole}
          onValueChange={(val: string) => setReqRole(val as UserRole)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="请选择身份" />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_ROLES.map((role: UserRole) => (
              <SelectItem key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showGrade && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            年级 <span className="text-destructive">*</span>
          </label>
          <Select
            value={reqGrade}
            onValueChange={(val: string) => setReqGrade(val as Grade)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择年级" />
            </SelectTrigger>
            <SelectContent>
              {GRADE_OPTIONS.map((grade: Grade) => (
                <SelectItem key={grade} value={grade}>
                  {GRADE_LABELS[grade]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showClass && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="req-class">
            班级 <span className="text-destructive">*</span>
          </label>
          <Input
            id="req-class"
            type="text"
            placeholder="如：1班、2班"
            value={reqClassName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReqClassName(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="req-reason">
          申请理由（选填）
        </label>
        <Textarea
          id="req-reason"
          placeholder="请简要说明申请理由"
          value={reqReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReqReason(e.target.value)}
          rows={3}
        />
      </div>

      {reqError && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {reqError}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={reqLoading}
      >
        {reqLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            提交中...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            提交申请
          </>
        )}
      </Button>
    </form>
  );
};

export default AccessRequestForm;
