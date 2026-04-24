import * as XLSX from 'xlsx';
import { Field, FieldType } from '../stores/useDataStore';
import dayjs from 'dayjs';

// 金额字段关键词（字段名包含这些词时，视为金额字段）
const AMOUNT_KEYWORDS = ['GMV', '产出', '金额', '收入', '销售额', '利润', '成本', '费用', '价格', '单价', '总额', '合计'];

// 判断字段是否为金额字段
function isAmountField(fieldName: string): boolean {
  return AMOUNT_KEYWORDS.some((kw) => fieldName.toUpperCase().includes(kw.toUpperCase()));
}

// 将金额字段格式化为2位小数
function formatAmountFields(data: Record<string, any>[], fields: Field[]): Record<string, any>[] {
  const amountFieldNames = fields.filter((f) => isAmountField(f.name)).map((f) => f.name);
  if (amountFieldNames.length === 0) return data;

  return data.map((row) => {
    const newRow = { ...row };
    amountFieldNames.forEach((fieldName) => {
      const val = newRow[fieldName];
      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        if (!isNaN(num)) {
          newRow[fieldName] = Math.round(num * 100) / 100;
        }
      }
    });
    return newRow;
  });
}

// 检测字段类型
export function detectFieldType(values: any[]): FieldType {
  const sampleSize = Math.min(values.length, 100);
  let numberCount = 0;
  let dateCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const value = values[i];
    if (value === null || value === undefined || value === '') continue;

    if (isDateValue(value)) {
      dateCount++;
      continue;
    }

    if (!isNaN(Number(value)) && String(value).trim() !== '') {
      numberCount++;
    }
  }

  const total = sampleSize - values.slice(0, sampleSize).filter((v) => v === null || v === undefined || v === '').length;
  if (total === 0) return 'string';

  const numberRatio = numberCount / total;
  const dateRatio = dateCount / total;

  if (numberRatio > 0.8) return 'number';
  if (dateRatio > 0.8) return 'date';
  return 'string';
}

// 判断是否为日期值
function isDateValue(value: any): boolean {
  if (value instanceof Date) return true;
  if (typeof value === 'number' && value > 40000 && value < 60000) {
    return true;
  }
  const str = String(value).trim();
  const datePatterns = [
    /^\d{4}-\d{1,2}-\d{1,2}$/,
    /^\d{4}\/\d{1,2}\/\d{1,2}$/,
    /^\d{4}年\d{1,2}月\d{1,2}日$/,
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
  ];
  if (datePatterns.some((p) => p.test(str))) return true;

  const d = dayjs(str);
  return d.isValid() && d.year() > 1900 && d.year() < 2100;
}

// 尝试修复编码问题（CSV中文乱码）
function fixEncoding(buffer: ArrayBuffer): string {
  // 先尝试 UTF-8
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  // 如果包含大量乱码特征，尝试 GBK
  const hasGbkMojibake = /[ÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/.test(utf8);
  if (hasGbkMojibake) {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

// 解析 CSV 文件
export function parseCSV(file: File): Promise<{
  data: Record<string, any>[];
  fields: Field[];
  sheetName: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          reject(new Error('文件读取失败'));
          return;
        }
        const text = fixEncoding(buffer);

        // 使用 XLSX 解析 CSV
        const workbook = XLSX.read(text, { type: 'string', codepage: 65001 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          reject(new Error('CSV 文件为空'));
          return;
        }

        const headers = Object.keys(jsonData[0] as object);
        const fields: Field[] = headers.map((name) => {
          const values = jsonData.map((row: any) => row[name]);
          const type = detectFieldType(values);
          return { name, label: name, type };
        });

        // 金额字段自动格式化为2位小数
        const formattedData = formatAmountFields(jsonData as Record<string, any>[], fields);

        resolve({
          data: formattedData,
          fields,
          sheetName: file.name,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 获取 Excel 所有 Sheet 名称
export function getExcelSheets(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook.SheetNames);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 解析指定 Sheet
export function parseExcelSheet(file: File, sheetName?: string): Promise<{
  data: Record<string, any>[];
  fields: Field[];
  sheetName: string;
  preview: Record<string, any>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const targetSheet = sheetName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[targetSheet];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          reject(new Error('Excel 文件为空'));
          return;
        }

        const headers = Object.keys(jsonData[0] as object);
        const fields: Field[] = headers.map((name) => {
          const values = jsonData.map((row: any) => row[name]);
          const type = detectFieldType(values);
          return { name, label: name, type };
        });

        // 金额字段自动格式化为2位小数
        const formattedData = formatAmountFields(jsonData as Record<string, any>[], fields);
        const preview = formattedData.slice(0, 10);

        resolve({
          data: formattedData,
          fields,
          sheetName: targetSheet,
          preview,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 兼容旧接口：解析 Excel 文件（默认第一个 Sheet）
export function parseExcel(file: File): Promise<{
  data: Record<string, any>[];
  fields: Field[];
  sheetName: string;
}> {
  return parseExcelSheet(file).then((result) => ({
    data: result.data,
    fields: result.fields,
    sheetName: result.sheetName,
  }));
}

// 合并多个 Excel 文件的数据
export function mergeExcelData(
  dataList: { data: Record<string, any>[]; fields: Field[] }[]
): { data: Record<string, any>[]; fields: Field[] } {
  if (dataList.length === 0) return { data: [], fields: [] };
  if (dataList.length === 1) return dataList[0];

  const baseFields = dataList[0].fields;
  const mergedData: Record<string, any>[] = [];

  dataList.forEach(({ data }) => {
    data.forEach((row) => {
      const newRow: Record<string, any> = {};
      baseFields.forEach((f) => {
        newRow[f.name] = row[f.name] ?? '';
      });
      mergedData.push(newRow);
    });
  });

  return { data: mergedData, fields: baseFields };
}

// 统一解析入口：根据扩展名自动选择解析方式
export async function parseExcelFile(file: File): Promise<{
  data: Record<string, any>[];
  fields: Field[];
}> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.csv')) {
    const result = await parseCSV(file);
    return { data: result.data, fields: result.fields };
  } else {
    const result = await parseExcel(file);
    return { data: result.data, fields: result.fields };
  }
}

// 导出数据到 Excel
export function exportToExcel(data: Record<string, any>[], fileName?: string) {
  if (data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '数据');
  XLSX.writeFile(wb, fileName || `导出数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
