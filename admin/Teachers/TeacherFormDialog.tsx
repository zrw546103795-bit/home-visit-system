import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Label } from '@client/src/components/ui/label';

import { teachers } from '@client/src/api';
import {
  GRADE_LABELS,
  type Grade,
  type HeadTeacher,
} from '@shared/api.interface';

interface FormState {
  name: string;
  account: string;
  password: string;
  grade: Grade | '';
  className: string;
}

interface FormErrors {
  name?: string;
  account?: string;
  password?: string;
  grade?: string;
  className?: string;
}

const initialFormState: FormState = {
  name: '',
  account: '',
  password: '',
  grade: '',
  className: '',
};

interface TeacherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTeacher: HeadTeacher | null;
  onSuccess: () => void;
}

const TeacherFormDialog: React.FC<TeacherFormDialogProps> = ({
  open,
  onOpenChange,
  editingTeacher,
  onSuccess,
}) => {
  const isEditing = !!editingTeacher;
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingTeacher) {
        setFormData({
          name: editingTeacher.name,
          account: editingTeacher.account ?? '',
          password: '',
          grade: editingTeacher.grade,
          className: editingTeacher.className,
        });
      } else {
        setFormData(initialFormState);
      }
      setFormErrors({});
    }
  }, [open, editingTeacher]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = '请输入姓名';
    }
    if (!formData.account.trim()) {
      errors.account = '请输入账号';
    }
    if (!isEditing && !formData.password.trim()) {
      errors.password = '请输入密码';
    }
    if (!formData.grade) {
      errors.grade = '请选择年级';
    }
    if (!formData.className.trim()) {
      errors.className = '请输入班级';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (isEditing && editingTeacher) {
        const updatePayload: {
          name: string;
          grade: Grade;
          className: string;
          password?: string;
        } = {
          name: formData.name.trim(),
          grade: formData.grade as Grade,
          className: formData.className.trim(),
        };
        if (formData.password.trim()) {
          updatePayload.password = formData.password.trim();
        }
        await teachers.updateTeacher(editingTeacher.id, updatePayload);
        toast.success('编辑成功');
      } else {
        await teachers.createTeacher({
          name: formData.name.trim(),
          account: formData.account.trim(),
          password: formData.password.trim(),
          grade: formData.grade as Grade,
          className: formData.className.trim(),
        });
        toast.success('新增成功');
      }
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error(
        isEditing ? '编辑班主任失败' : '新增班主任失败',
        error,
      );
      toast.error(isEditing ? '编辑失败' : '新增失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑班主任' : '新增班主任'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? '修改班主任的基本信息，密码留空则不修改'
              : '填写班主任的基本信息以创建新账号'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="teacher-name">
              姓名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="teacher-name"
              placeholder="请输入姓名"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            {formErrors.name && (
              <p className="text-xs text-destructive">{formErrors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-account">
              账号 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="teacher-account"
              placeholder="请输入账号"
              value={formData.account}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, account: e.target.value })
              }
              disabled={isEditing}
            />
            {formErrors.account && (
              <p className="text-xs text-destructive">{formErrors.account}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-password">
              密码 {!isEditing && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="teacher-password"
              type="password"
              placeholder={isEditing ? '留空则不修改密码' : '请输入密码'}
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            {formErrors.password && (
              <p className="text-xs text-destructive">{formErrors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              年级 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.grade}
              onValueChange={(value: string) =>
                setFormData({ ...formData, grade: value as Grade | '' })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择年级" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GRADE_LABELS) as Grade[]).map((grade: Grade) => (
                  <SelectItem key={grade} value={grade}>
                    {GRADE_LABELS[grade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.grade && (
              <p className="text-xs text-destructive">{formErrors.grade}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-class">
              班级 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="teacher-class"
              placeholder="如：1班"
              value={formData.className}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, className: e.target.value })
              }
            />
            {formErrors.className && (
              <p className="text-xs text-destructive">
                {formErrors.className}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : isEditing ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherFormDialog;
