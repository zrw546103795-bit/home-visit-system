import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CalendarIcon,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import { Calendar } from '@client/src/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Progress } from '@client/src/components/ui/progress';
import { Badge } from '@client/src/components/ui/badge';

import {
  VISIT_FORM_LABELS,
  VISIT_CATEGORY_LABELS,
  GRADE_LABELS,
  type Grade,
  type VisitForm,
  type VisitCategory,
  type CreateRecordDto,
  type UpdateRecordDto,
  type HomeVisitRecord,
  type HomeVisitAttachment,
  type UserRole,
} from '@shared/api.interface';
import { homeVisit } from '@client/src/api';

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

interface HomeVisitRecordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: HomeVisitRecord | null;
  onSuccess: () => void;
  userRole: UserRole;
  defaultGrade?: string;
  defaultClassName?: string;
  defaultClassId?: string;
  canEditStudentName?: boolean;
}

const HomeVisitRecordForm: React.FC<HomeVisitRecordFormProps> = ({
  open,
  onOpenChange,
  record,
  onSuccess,
  userRole,
  defaultGrade,
  defaultClassName,
  canEditStudentName = true,
}) => {
  const isEdit = !!record;
  const gradeReadOnly =
    userRole === 'teacher' ||
    userRole === 'grade_head' ||
    userRole === 'grade_director';
  const classReadOnly = userRole === 'teacher';
  const canEditGradeClassInUpdate = userRole === 'admin' || userRole === 'school_leader';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState<Grade | ''>('');
  const [className, setClassName] = useState('');
  const [visitDate, setVisitDate] = useState<Date | null>(null);
  const [visitForm, setVisitForm] = useState<VisitForm | ''>('');
  const [category, setCategory] = useState<VisitCategory | ''>('');
  const [summary, setSummary] = useState('');
  const [remark, setRemark] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    HomeVisitAttachment[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setStudentName(record.studentName);
      setGrade(record.grade || '');
      setClassName(record.className || '');
      setVisitDate(record.visitDate ? new Date(record.visitDate) : null);
      setVisitForm(record.visitForm);
      setCategory(record.category);
      setSummary(record.summary || '');
      setRemark(record.remark || '');
      setExistingAttachments(record.attachments || []);
    } else {
      setStudentName('');
      if (gradeReadOnly && defaultGrade) {
        setGrade((defaultGrade as Grade) || '');
      } else {
        setGrade('');
      }
      if (classReadOnly && defaultClassName) {
        setClassName(defaultClassName || '');
      } else {
        setClassName('');
      }
      setVisitDate(null);
      setVisitForm('');
      setCategory('');
      setSummary('');
      setRemark('');
      setExistingAttachments([]);
    }
    setUploadingFiles([]);
  }, [open, record, userRole, defaultGrade, defaultClassName]);

  const validateForm = (): boolean => {
    if (!studentName.trim()) return toast.error('请输入学生姓名'), false;
    if (!grade) return toast.error('请选择年级'), false;
    if (!className.trim()) return toast.error('请输入班级'), false;
    if (!visitDate) return toast.error('请选择家访日期'), false;
    if (!visitForm) return toast.error('请选择家访形式'), false;
    if (!category) return toast.error('请选择家访类别'), false;
    return true;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newFiles: UploadingFile[] = fileList.map((f: File, i: number) => ({
      id: `up-${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploadingFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = newFiles[i].id;
      try {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 30 } : f)),
        );
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await axios.post('/api/home-visit/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const data = uploadRes.data;
        if (!data || !data.file_path) throw new Error('上传失败');
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, progress: 100, status: 'done' } : f,
          ),
        );
        if (isEdit && record) {
          await homeVisit.addAttachment(record.id, {
            fileName: file.name,
            fileSize: file.size,
            bucketId: data.bucket_id,
            filePath: data.file_path,
          });
        }
      } catch (err) {
        console.error(`文件上传失败 ${file.name}: ${String(err)}`);
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'error', errorMsg: err instanceof Error ? err.message : '上传失败' }
              : f,
          ),
        );
        toast.error(`${file.name} 上传失败`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeUploadingFile = (id: string) =>
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));

  const removeExistingAttachment = async (att: HomeVisitAttachment) => {
    if (!record) return;
    try {
      await homeVisit.deleteAttachment(att.id);
      setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast.success('附件已删除');
    } catch (err) {
      console.error(`删除附件失败: ${String(err)}`);
      toast.error('删除附件失败');
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (uploadingFiles.some((f) => f.status === 'uploading')) {
      toast.error('请等待文件上传完成');
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = visitDate
        ? format(visitDate, 'yyyy-MM-dd', { locale: zhCN })
        : '';
      if (isEdit && record) {
        const dto: UpdateRecordDto = {
          studentName: studentName.trim(),
          visitDate: dateStr,
          visitForm: visitForm as VisitForm,
          category: category as VisitCategory,
          summary: summary.trim() || undefined,
          remark: remark.trim() || undefined,
          ...(canEditGradeClassInUpdate
             ? { grade: grade as Grade, className: className.trim() }
             : {}),
        };
        await homeVisit.updateRecord(record.id, dto);
        toast.success('家访记录更新成功');
      } else {
        const dto: CreateRecordDto = {
          studentName: studentName.trim(),
          grade: grade as Grade,
          className: className.trim(),
          visitDate: dateStr,
          visitForm: visitForm as VisitForm,
          category: category as VisitCategory,
          summary: summary.trim() || undefined,
          remark: remark.trim() || undefined,
        };
        await homeVisit.createRecord(dto);
        toast.success('家访记录创建成功');
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(`保存家访记录失败: ${String(err)}`);
      toast.error('保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadingCount = uploadingFiles.filter(
    (f) => f.status === 'uploading',
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑家访记录' : '新增家访记录'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="学生姓名" required>
            <Input
              value={studentName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStudentName(e.target.value)
              }
              placeholder="请输入学生姓名"
              disabled={!canEditStudentName}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="年级" required>
              <Select
                value={grade}
                onValueChange={(v) => setGrade(v as Grade)}
                disabled={gradeReadOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择年级" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GRADE_LABELS) as Grade[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {GRADE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="班级" required>
              <Input
                value={className}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setClassName(e.target.value)
                }
                placeholder="请输入班级，如1班"
                disabled={classReadOnly}
              />
            </FormField>
          </div>

          <FormField label="家访日期" required>
            <DatePicker value={visitDate} onChange={setVisitDate} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="家访形式" required>
              <Select
                value={visitForm}
                onValueChange={(v) => setVisitForm(v as VisitForm)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VISIT_FORM_LABELS) as VisitForm[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {VISIT_FORM_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="家访类别" required>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as VisitCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VISIT_CATEGORY_LABELS) as VisitCategory[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {VISIT_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="家访内容摘要">
            <Textarea
              value={summary}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setSummary(e.target.value)
              }
              placeholder="请输入家访内容摘要"
              rows={3}
            />
          </FormField>

          <FormField label="备注">
            <Textarea
              value={remark}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRemark(e.target.value)
              }
              placeholder="请输入备注信息"
              rows={2}
            />
          </FormField>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>附件上传</Label>
              {uploadingCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {uploadingCount} 个文件上传中
                </Badge>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed"
            >
              <Upload className="mr-2 h-4 w-4" />
              选择文件上传
            </Button>

            {uploadingFiles.length > 0 && (
              <ul className="space-y-2">
                {uploadingFiles.map((f) => (
                  <FileItem
                    key={f.id}
                    name={f.name}
                    size={f.size}
                    onRemove={() => removeUploadingFile(f.id)}
                    progress={f.status === 'uploading' ? f.progress : null}
                    error={f.status === 'error' ? f.errorMsg : undefined}
                  />
                ))}
              </ul>
            )}

            {isEdit && existingAttachments.length > 0 && (
              <ul className="space-y-2">
                {existingAttachments.map((att) => (
                  <FileItem
                    key={att.id}
                    name={att.fileName}
                    size={att.fileSize}
                    onRemove={() => removeExistingAttachment(att)}
                    destructive
                  />
                ))}
              </ul>
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
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? '保存修改' : '创建记录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <div className="space-y-2">
    <Label>
      {label}
      {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
  </div>
);

const DatePicker: React.FC<{
  value: Date | null;
  onChange: (d: Date | null) => void;
}> = ({ value, onChange }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="w-full justify-start">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? (
          format(value, 'yyyy年MM月dd日', { locale: zhCN })
        ) : (
          <span className="text-muted-foreground">请选择日期</span>
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={value ?? undefined}
        onSelect={(d) => onChange(d ?? null)}
        initialFocus
      />
    </PopoverContent>
  </Popover>
);

const FileItem: React.FC<{
  name: string;
  size: number;
  onRemove: () => void;
  progress?: number | null;
  error?: string;
  destructive?: boolean;
}> = ({ name, size, onRemove, progress, error, destructive }) => (
  <li className="flex items-center gap-2 rounded-md border p-2">
    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm truncate">{name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {(size / 1024).toFixed(1)} KB
        </span>
      </div>
      {progress !== null && progress !== undefined && (
        <Progress value={progress} className="h-1 mt-1" />
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onRemove}
      className={`shrink-0 ${destructive ? 'text-destructive' : ''}`}
    >
      {destructive ? <Trash2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
    </Button>
  </li>
);

export default HomeVisitRecordForm;
