
/**
 * 简单 CSV 解析器
 * 支持：按行分割、按逗号分割、双引号包裹字段、字段内换行、引号转义
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  // 去除 BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // 检查是否是转义的双引号
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (char === '\r') {
      // 跳过 \r，\n 会在下一次处理
      i++;
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // 处理最后一个字段（文件末尾没有换行）
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // 过滤完全为空的行
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

/**
 * 将 CSV 行数据转换为对象数组
 * @param rows parseCsv 返回的二维数组
 * @param headers 表头字段映射 { key: label }
 */
export function csvRowsToObjects(
  rows: string[][],
  headers: Record<string, string>,
): Record<string, string>[] {
  if (rows.length === 0) return [];

  const headerRow = rows[0].map((h) => h.trim());
  const labelToKey = Object.fromEntries(
    Object.entries(headers).map(([key, label]) => [label, key]),
  );

  const keyIndices: Record<string, number> = {};
  headerRow.forEach((label, index) => {
    const key = labelToKey[label];
    if (key) {
      keyIndices[key] = index;
    }
  });

  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    Object.entries(keyIndices).forEach(([key, index]) => {
      obj[key] = (row[index] ?? '').trim();
    });
    return obj;
  });
}

/**
 * 生成 CSV 模板文件并触发下载
 */
export function downloadCsvTemplate(
  headers: string[],
  sampleData: string[][],
  filename: string,
): void {
  const escapeCsvField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = sampleData.map((row) =>
    row.map(escapeCsvField).join(','),
  );
  const csvContent = [headerLine, ...dataLines].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 读取文件为文本
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => {
      console.error('文件读取失败');
      reject(new Error('文件读取失败'));
    };
    reader.readAsText(file, 'utf-8');
  });
}
