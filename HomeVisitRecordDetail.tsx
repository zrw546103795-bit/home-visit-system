import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Download } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';

import {
  VISIT_FORM_LABELS,
  VISIT_CATEGORY_LABELS,
  GRADE_LABELS,
  type Grade,
  type HomeVisitRecord,
  type HomeVisitAttachment,
} from '@shared/api.interface';
import { homeVisit } from '@client/src/api';

interface HomeVisitRecordDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: HomeVisitRecord | null;
  isAdmin?: boolean;
}

const HomeVisitRecordDetail: React.FC<HomeVisitRecordDetailProps> = ({
  open,
  onOpenChange,
  record,
  isAdmin = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [fullRecord, setFullRecord] = useState<HomeVisitRecord | null>(null);

  React.useEffect(() => {
    if (open && record) {
      setFullRecord(record);
      if (!record.attachments || record.attachments.length === 0) {
        fetchDetail(record.id);
      }
    }
  }, [open, record]);

  const fetchDetail = async (id: string) => {
    setLoading(true);
    try {
      const full: HomeVisitRecord = await homeVisit.getRecordById(id);
      setFullRecord(full);
    } catch (err) {
      console.error(`获取记录详情失败: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (att: HomeVisitAttachment) => {
    try {
      const res = await homeVisit.getAttachmentDownloadUrl(att.id);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error(`获取下载链接失败: ${String(err)}`);
      toast.error('获取下载链接失败');
    }
  };

  const r = fullRecord;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>家访记录详情</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : r ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="学生姓名" value={r.studentName} />
              <InfoItem label="家访日期" value={r.visitDate} />
              <InfoItem
                label="家访形式"
                value={VISIT_FORM_LABELS[r.visitForm]}
              />
              <InfoItem
                label="家访类别"
                value={VISIT_CATEGORY_LABELS[r.category]}
              />
              {isAdmin && (
                <>
                  <InfoItem
                    label="年级"
                    value={GRADE_LABELS[r.grade as Grade]}
                  />
                  <InfoItem label="班级" value={r.className || '—'} />
                </>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground">内容摘要</p>
              <p className="text-base mt-1 whitespace-pre-wrap">
                {r.summary || '—'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">备注</p>
              <p className="text-base mt-1 whitespace-pre-wrap">
                {r.remark || '—'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">附件列表</p>
              {r.attachments && r.attachments.length > 0 ? (
                <ul className="space-y-2">
                  {r.attachments.map((att: HomeVisitAttachment) => (
                    <li
                      key={att.id}
                      className="flex items-center gap-2 rounded-md border p-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">
                        {att.fileName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(att.fileSize / 1024).toFixed(1)} KB
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(att)}
                        className="shrink-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">暂无附件</p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const InfoItem: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-base font-medium mt-1">{value}</p>
  </div>
);

export default HomeVisitRecordDetail;
