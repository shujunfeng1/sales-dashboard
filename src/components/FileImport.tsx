import { useCallback, useState } from 'react';
import { Upload, message, Modal, Select, Table } from 'antd';
import { InboxOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';
import { parseExcelSheet, parseCSV, getExcelSheets } from '../utils/excelParser';
import { useDataStore } from '../stores/useDataStore';
import type { UploadProps } from 'antd';

const { Dragger } = Upload;

export const FileImport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
  const [previewFields, setPreviewFields] = useState<{ name: string; type: string }[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'csv'>('excel');

  const { setRawData } = useDataStore();

  const handleImport = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    setPendingFile(file);
    setLoading(true);

    try {
      if (ext.endsWith('.csv')) {
        setFileType('csv');
        const result = await parseCSV(file);
        setPreviewData(result.data.slice(0, 10));
        setPreviewFields(result.fields.map((f) => ({ name: f.name, type: f.type })));
        setPreviewModalOpen(true);
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        setFileType('excel');
        const sheetList = await getExcelSheets(file);
        setSheets(sheetList);
        setSelectedSheet(sheetList[0]);

        // 默认预览第一个 Sheet
        const result = await parseExcelSheet(file, sheetList[0]);
        setPreviewData(result.preview);
        setPreviewFields(result.fields.map((f) => ({ name: f.name, type: f.type })));
        setPreviewModalOpen(true);
      } else {
        message.error('不支持的文件格式，请上传 .xlsx, .xls 或 .csv 文件');
      }
    } catch (err) {
      message.error('文件解析失败：' + (err as Error).message);
    } finally {
      setLoading(false);
    }
    return false;
  }, []);

  const handleSheetChange = async (sheetName: string) => {
    if (!pendingFile) return;
    setSelectedSheet(sheetName);
    setLoading(true);
    try {
      const result = await parseExcelSheet(pendingFile, sheetName);
      setPreviewData(result.preview);
      setPreviewFields(result.fields.map((f) => ({ name: f.name, type: f.type })));
    } catch (err) {
      message.error('Sheet 切换失败：' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    setLoading(true);
    try {
      let result;
      if (fileType === 'csv') {
        result = await parseCSV(pendingFile);
      } else {
        result = await parseExcelSheet(pendingFile, selectedSheet);
      }
      setRawData(result.data, result.fields, pendingFile.name);
      message.success(`成功导入 ${result.data.length} 条数据，共 ${result.fields.length} 个字段`);
      setPreviewModalOpen(false);
      setPendingFile(null);
      setPreviewData([]);
      setPreviewFields([]);
      setSheets([]);
    } catch (err) {
      message.error('导入失败：' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: handleImport,
    disabled: loading,
    multiple: false,
  };

  const previewColumns = previewFields.map((f) => ({
    title: (
      <span>
        {f.name}
        <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
          ({f.type === 'string' ? '文本' : f.type === 'number' ? '数值' : '日期'})
        </span>
      </span>
    ),
    dataIndex: f.name,
    key: f.name,
    width: 150,
    ellipsis: true,
  }));

  return (
    <>
      <div style={{ padding: '24px', maxWidth: 600, margin: '0 auto' }}>
        <Dragger {...uploadProps} style={{ padding: '40px 20px' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件导入</p>
          <p className="ant-upload-hint">
            支持 .xlsx、.xls 和 .csv 格式文件
          </p>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 24 }}>
            <span style={{ color: '#666', fontSize: 13 }}>
              <FileExcelOutlined style={{ marginRight: 4 }} /> Excel (.xlsx/.xls)
            </span>
            <span style={{ color: '#666', fontSize: 13 }}>
              <FileTextOutlined style={{ marginRight: 4 }} /> CSV (.csv)
            </span>
          </div>
        </Dragger>
      </div>

      {/* 数据预览弹窗 */}
      <Modal
        title="数据预览"
        open={previewModalOpen}
        onOk={handleConfirmImport}
        onCancel={() => {
          setPreviewModalOpen(false);
          setPendingFile(null);
        }}
        okText="确认导入"
        cancelText="取消"
        width={900}
        confirmLoading={loading}
      >
        <div style={{ marginBottom: 16 }}>
          {fileType === 'excel' && sheets.length > 1 && (
            <Select
              value={selectedSheet}
              onChange={handleSheetChange}
              style={{ width: 200, marginRight: 16 }}
              options={sheets.map((s) => ({ value: s, label: s }))}
            />
          )}
          <span style={{ color: '#666' }}>
            共 {previewFields.length} 个字段，预览前 10 行数据
          </span>
        </div>
        <Table
          dataSource={previewData.map((row, i) => ({ ...row, key: i }))}
          columns={previewColumns}
          pagination={false}
          size="small"
          scroll={{ x: previewFields.length * 150 }}
          bordered
        />
      </Modal>
    </>
  );
};
