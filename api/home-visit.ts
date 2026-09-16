import axios from 'axios';
import type {
  CreateRecordDto,
  HomeVisitAttachment,
  HomeVisitRecord,
  PaginatedResponse,
  RecordListParams,
  UpdateRecordDto,
} from '@shared/api.interface';
import { apiRequest } from './index';

export async function exportRecords(
  params: Omit<RecordListParams, 'page' | 'pageSize'>,
): Promise<void> {
  try {
    const response = await axios({
      url: '/api/home-visit/records/export',
      method: 'GET',
      params: params as unknown as Record<string, unknown>,
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'];
    let fileName = '家访记录.csv';
    if (disposition) {
      const match = disposition.match(/filename\*?="?([^";]+)"?/i);
      if (match && match[1]) {
        try {
          fileName = decodeURIComponent(match[1]);
        } catch {
          fileName = match[1];
        }
      }
    }

    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    const err = error as { response?: { data?: Blob; status?: number } };
    if (err.response?.status === 400 && err.response.data instanceof Blob) {
      const text = await err.response.data.text();
      let message = '导出失败';
      try {
        const json = JSON.parse(text);
        message = json.message || message;
      } catch {
        message = text || message;
      }
      throw new Error(message);
    }
    console.error(
      '导出家访记录失败',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

export async function getRecordList(
  params: RecordListParams,
): Promise<PaginatedResponse<HomeVisitRecord>> {
  return apiRequest<PaginatedResponse<HomeVisitRecord>>({
    url: '/api/home-visit/records',
    method: 'GET',
    params: params as unknown as Record<string, unknown>,
  });
}

export async function getRecordById(id: string): Promise<HomeVisitRecord> {
  return apiRequest<HomeVisitRecord>({
    url: `/api/home-visit/records/${id}`,
    method: 'GET',
  });
}

export async function createRecord(
  data: CreateRecordDto,
): Promise<HomeVisitRecord> {
  return apiRequest<HomeVisitRecord>({
    url: '/api/home-visit/records',
    method: 'POST',
    data,
  });
}

export async function updateRecord(
  id: string,
  data: UpdateRecordDto,
): Promise<HomeVisitRecord> {
  return apiRequest<HomeVisitRecord>({
    url: `/api/home-visit/records/${id}`,
    method: 'PATCH',
    data,
  });
}

export async function deleteRecord(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>({
    url: `/api/home-visit/records/${id}`,
    method: 'DELETE',
  });
}

export async function addAttachment(
  recordId: string,
  data: {
    fileName: string;
    fileSize: number;
    bucketId: string;
    filePath: string;
  },
): Promise<HomeVisitAttachment> {
  return apiRequest<HomeVisitAttachment>({
    url: `/api/home-visit/records/${recordId}/attachments`,
    method: 'POST',
    data,
  });
}

export async function deleteAttachment(
  id: string,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>({
    url: `/api/home-visit/attachments/${id}`,
    method: 'DELETE',
  });
}

export async function getAttachmentDownloadUrl(
  id: string,
): Promise<{ downloadUrl: string }> {
  return apiRequest<{ downloadUrl: string }>({
    url: `/api/home-visit/attachments/${id}/download`,
    method: 'GET',
  });
}

export async function batchDownload(recordIds: string[]): Promise<void> {
  const response = await axios({
    url: '/api/home-visit/records/batch-download',
    method: 'POST',
    data: { recordIds },
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'];
  let fileName = '家访附件.zip';
  if (disposition) {
    const match = disposition.match(/filename\*?="?([^";]+)"?/i);
    if (match && match[1]) {
      try {
        fileName = decodeURIComponent(match[1]);
      } catch {
        fileName = match[1];
      }
    }
  }

  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
