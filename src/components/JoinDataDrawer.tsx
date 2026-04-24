import React, { useState } from 'react';
import { Drawer, Button, Select, Input, Upload, Table, message, Tag, Space, Typography } from 'antd';
import { UploadOutlined, LinkOutlined } from '@ant-design/icons';
import { parseExcelFile, detectFieldType } from '../utils/excelParser';
import type { Field } from '../stores/useDataStore';

const { Text } = Typography;

interface JoinDataDrawerProps {
  open: boolean;
  onClose: () => void;
  mainFields: Field[];
  onJoin: (secondaryData: Record<string, any>[], secondaryFields: Field[], joinField: string, prefix: string) => void;
}

export const JoinDataDrawer: React.FC<JoinDataDrawerProps> = ({
  open,
  onClose,
  mainFields,
  onJoin,
}) => {
  const [secondaryData, setSecondaryData] = useState<Record<string, any>[]>([]);
  const [secondaryFields, setSecondaryFields] = useState<Field[]>([]);
  const [joinField, setJoinField] = useState<string>('');
  const [prefix, setPrefix] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  const commonFields = mainFields
    .map((f) => f.name)
    .filter((name) => secondaryFields.some((sf) => sf.name === name));

  const handleFileUpload = async (file: File) => {
    try {
      const result = await parseExcelFile(file);
      if (result.data.length === 0) {
        message.warning('文件为空');
        return false;
      }

      // 自动检测字段类型
      const firstRow = result.data[0];
      const fieldNames = Object.keys(firstRow);
      const fields: Field[] = fieldNames.map((name) => {
        const values = result.data.map((row) => row[name]);
        return {
          name,
          label: name,
          type: detectFieldType(values),
        };
      });

      setSecondaryData(result.data);
      setSecondaryFields(fields);
      setFileName(file.name);
      setJoinField('');
      message.success(`导入成功：${result.data.length} 行，${fields.length} 个字段`);
    } catch (err) {
      message.error('文件解析失败');
    }
    return false;
  };

  const handleJoin = () => {
    if (!joinField) {
      message.warning('请选择关联字段');
      return;
    }
    if (!secondaryData.length) {
      message.warning('请先导入从表数据');
      return;
    }
    onJoin(secondaryData, secondaryFields, joinField, prefix || '从表');
    // 重置
    setSecondaryData([]);
    setSecondaryFields([]);
    setJoinField('');
    setPrefix('');
    setFileName('');
    onClose();
  };

  const columns = secondaryFields.map((f) => ({
    title: f.label,
    dataIndex: f.name,
    key: f.name,
    width: 120,
  }));

  return (
    <Drawer
      title={<><LinkOutlined /> 关联数据表</>}
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
    >
      {/* 步骤 1：上传从表 */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 12 }}>1. 导入从表数据</h4>
        <Upload beforeUpload={handleFileUpload} accept=".xlsx,.xls,.csv" showUploadList={false}>
          <Button icon={<UploadOutlined />}>
            {fileName ? `已选择：${fileName}` : '选择 Excel 文件'}
          </Button>
        </Upload>
        {secondaryData.length > 0 && (
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {secondaryData.length} 行 × {secondaryFields.length} 列
          </Tag>
        )}
      </div>

      {/* 步骤 2：选择关联字段 */}
      {secondaryFields.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 12 }}>2. 配置关联</h4>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>关联字段（两张表共有的字段）</label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择关联字段"
                value={joinField || undefined}
                onChange={setJoinField}
                options={commonFields.map((name) => ({ value: name, label: name }))}
              />
              {commonFields.length === 0 && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  未检测到共同字段，请确保从表中有与主表相同的列名
                </Text>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>新字段前缀（避免重名）</label>
              <Input
                placeholder="例如：SKU、客户信息"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                maxLength={20}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                从表字段将以前缀命名，如「SKU_商品名称」
              </Text>
            </div>
          </Space>
        </div>
      )}

      {/* 步骤 3：预览 */}
      {secondaryFields.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 12 }}>3. 从表预览（前 5 行）</h4>
          <Table
            dataSource={secondaryData.slice(0, 5).map((row, idx) => ({ ...row, key: idx }))}
            columns={columns}
            size="small"
            pagination={false}
            bordered
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      {/* 执行 */}
      <Button
        type="primary"
        block
        onClick={handleJoin}
        disabled={!joinField || !secondaryData.length}
      >
        执行关联
      </Button>
    </Drawer>
  );
};
