import React, { useCallback, useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Badge } from '@client/src/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';

import { importApi } from '@client/src/api';
import type {
  CreateTeacherDto,
  Grade,
  ImportResult,
} from '@shared/api.interface';
import { GRADE_LABELS } from '@shared/api.interface';

import {
  csvRowsToObjects,
  downloadCsvTemplate,
  parseCsv,
  readFileAsText,
} from '@client/src/utils/csv';

const TEACHER_HEADERS: Record<string, string> = {
  name: '姓名',
  account: '账号',
  password: '密码',
  grade: '年级',
  className: '班级',
};

const GRADE_LABEL_TO_VALUE: Record<string, Grade> = {
  初一: 'grade_1',
  初二: 'grade_2',
  初三: 'grade_3',
  grade_1: 'grade_1',
  grade_2: 'grade_2',
  grade_3: 'grade_3',
};

function normalizeGrade(label: string): Grade | null {
  return GRADE_LABEL_TO_VALUE[label.trim()] ?? null;
}

interface TeacherRow extends CreateTeacherDto {
  rowError?: string;
}

const TeacherImportPanel: React.FC = () => {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = useCallback(() => {
    downloadCsvTemplate(
      Object.values(TEACHER_HEADERS),
      [
        ['张三', 'zhangsan', '123456', '初一', '1班'],
        ['李四', 'lisi', '123456', '初二', '3班'],
      ],
      '班主任名单模板.csv',
    );
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setResult(null);
      setFileName(file.name);
      const text = await readFileAsText(file);
      const csvRows = parseCsv(text);
      const objects = csvRowsToObjects(csvRows, TEACHER_HEADERS);

      const parsed: TeacherRow[] = objects.map((obj, idx) => {
        const errors: string[] = [];
        if (!obj.name) errors.push('姓名不能为空');
        if (!obj.account) errors.push('账号不能为空');
        if (!obj.password) errors.push('密码不能为空');

        const grade = normalizeGrade(obj.grade || '');
        if (!grade) errors.push('年级格式不正确（应为：初一/初二/初三）');

        if (!obj.className) errors.push('班级不能为空');

        return {
          name: obj.name || '',
          account: obj.account || '',
          password: obj.password || '',
          grade: grade || 'grade_1',
          className: obj.className || '',
          rowError:
            errors.length > 0
              ? `第${idx + 2}行：${errors.join('；')}`
              : undefined,
        };
      });

      setRows(parsed);
      if (parsed.length === 0) {
        toast.warning('未解析到有效数据，请检查文件格式');
      } else {
        toast.success(`成功解析 ${parsed.length} 条数据`);
      }
    } catch (error) {
      console.error('解析班主任CSV失败', error);
      toast.error('文件解析失败，请检查文件格式');
    }
  }, []);

  const handleImport = useCallback(async () => {
    const validRows = rows.filter((r) => !r.rowError);
    if (validRows.length === 0) {
      toast.error('没有可导入的有效数据');
      return;
    }

    setImporting(true);
    try {
      const res = await importApi.importTeachers(validRows);
      setResult(res);
      if (res.failed === 0) {
        toast.success(`成功导入 ${res.success} 名班主任`);
      } else {
        toast.warning(`导入完成：成功 ${res.success} 条，失败 ${res.failed} 条`);
      }
    } catch (error) {
      console.error('导入班主任失败', error);
      toast.error('导入失败，请稍后重试');
    } finally {
      setImporting(false);
    }
  }, [rows]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const errorCount = rows.filter((r) => r.rowError).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          模板字段：姓名、账号、密码、年级（初一/初二/初三）、班级
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" />
          下载模板
        </Button>
      </div>

      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">点击上传 CSV 文件</p>
        <p className="text-xs text-muted-foreground">
          支持 CSV 格式，文件大小不超过 10MB
        </p>
        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
            <FileSpreadsheet className="w-4 h-4" />
            {fileName}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              解析结果（共 {rows.length} 条）
              {errorCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {errorCount} 条异常
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                重新选择
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || errorCount === rows.length}
              >
                {importing ? '导入中...' : '确认导入'}
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-16">行号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>账号</TableHead>
                    <TableHead>年级</TableHead>
                    <TableHead>班级</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.account}</TableCell>
                      <TableCell>{GRADE_LABELS[row.grade] || row.grade}</TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell>
                        {row.rowError ? (
                          <XCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-success" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {errorCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>数据校验异常</AlertTitle>
              <AlertDescription>
                有 {errorCount} 条数据存在问题，将被跳过。请修正后重新上传。
                <div className="mt-2 space-y-1 text-xs">
                  {rows
                    .filter((r) => r.rowError)
                    .slice(0, 5)
                    .map((r, i) => (
                      <div key={i}>• {r.rowError}</div>
                    ))}
                  {errorCount > 5 && (
                    <div>• 还有 {errorCount - 5} 条错误未显示</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {result && (
        <Alert variant={result.failed === 0 ? 'success' : 'warning'}>
          {result.failed === 0 ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <AlertTitle>导入完成</AlertTitle>
          <AlertDescription>
            共 {result.total} 条，成功 {result.success} 条，失败 {result.failed} 条
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default TeacherImportPanel;
