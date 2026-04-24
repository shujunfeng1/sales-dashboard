import React, { useState, useMemo } from 'react';
import { Select, Input, Button, Space, DatePicker, Tag, Modal, message } from 'antd';
import { FilterCondition, Field, FilterPreset } from '../stores/useDataStore';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useDataStore } from '../stores/useDataStore';
import './FilterBar.css';

const { RangePicker } = DatePicker;

interface FilterBarProps {
  filters: FilterCondition[];
  fields: Field[];
  onAddFilter: (filter: FilterCondition) => void;
  onRemoveFilter: (field: string) => void;
}

// 操作符定义
const STRING_OPS = [
  { value: 'in', label: '包含以下任意' },
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'contains', label: '包含文本' },
];

const NUMBER_OPS = [
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'between', label: '范围' },
];

const DATE_OPS = [
  { value: 'between', label: '日期范围' },
  { value: 'eq', label: '等于某天' },
  { value: 'gt', label: '晚于' },
  { value: 'lt', label: '早于' },
  { value: 'gte', label: '晚于等于' },
  { value: 'lte', label: '早于等于' },
];

// 获取字段的唯一值列表
function useFieldUniqueValues(fieldName: string) {
  const rawData = useDataStore((s) => s.rawData);
  return useMemo(() => {
    if (!fieldName || !rawData.length) return [];
    const values = [...new Set(rawData.map((row) => row[fieldName]))]
      .filter((v) => v !== null && v !== undefined && v !== '')
      .sort((a, b) => String(a).localeCompare(String(b)));
    return values;
  }, [fieldName, rawData]);
}

// 单个筛选条件组件
const FilterItem: React.FC<{
  filter: FilterCondition;
  fields: Field[];
  onUpdate: (filter: FilterCondition) => void;
  onRemove: () => void;
}> = ({ filter, fields, onUpdate, onRemove }) => {
  const field = fields.find((f) => f.name === filter.field);
  const fieldType = field?.type || 'string';
  const uniqueValues = useFieldUniqueValues(filter.field);

  const handleOperatorChange = (operator: string) => {
    onUpdate({ ...filter, operator: operator as any, value: operator === 'in' ? [] : '' });
  };

  const handleValueChange = (value: any) => {
    onUpdate({ ...filter, value });
  };

  // 文本类型筛选输入
  const renderStringInput = () => {
    if (filter.operator === 'in') {
      return (
        <Select
          mode="multiple"
          placeholder={`搜索选择...（共${uniqueValues.length}个选项）`}
          style={{ width: 280 }}
          size="small"
          value={Array.isArray(filter.value) ? filter.value : []}
          onChange={handleValueChange}
          options={uniqueValues.map((v) => ({ value: v, label: String(v) }))}
          maxTagCount={2}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label || '').toLowerCase().includes(input.toLowerCase())
          }
        />
      );
    }
    // eq / neq / contains：支持下拉单选（也可以搜索）
    if (filter.operator === 'eq' || filter.operator === 'neq') {
      return (
        <Select
          placeholder="选择或搜索..."
          style={{ width: 200 }}
          size="small"
          value={filter.value || undefined}
          onChange={handleValueChange}
          options={uniqueValues.map((v) => ({ value: v, label: String(v) }))}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label || '').toLowerCase().includes(input.toLowerCase())
          }
        />
      );
    }
    return (
      <Input
        placeholder="输入文本"
        style={{ width: 180 }}
        size="small"
        value={filter.value}
        onChange={(e) => handleValueChange(e.target.value)}
      />
    );
  };

  // 数值类型筛选输入
  const renderNumberInput = () => {
    if (filter.operator === 'between') {
      return (
        <Space size={4}>
          <Input
            type="number"
            placeholder="最小值"
            style={{ width: 100 }}
            size="small"
            value={Array.isArray(filter.value) ? filter.value[0] : ''}
            onChange={(e) =>
              handleValueChange([e.target.value, Array.isArray(filter.value) ? filter.value[1] : ''])
            }
          />
          <span style={{ color: '#999' }}>~</span>
          <Input
            type="number"
            placeholder="最大值"
            style={{ width: 100 }}
            size="small"
            value={Array.isArray(filter.value) ? filter.value[1] : ''}
            onChange={(e) =>
              handleValueChange([Array.isArray(filter.value) ? filter.value[0] : '', e.target.value])
            }
          />
        </Space>
      );
    }
    return (
      <Input
        type="number"
        placeholder="输入数值"
        style={{ width: 140 }}
        size="small"
        value={filter.value}
        onChange={(e) => handleValueChange(e.target.value)}
      />
    );
  };

  // 日期类型筛选输入
  const renderDateInput = () => {
    if (filter.operator === 'between') {
      return (
        <RangePicker
          size="small"
          style={{ width: 240 }}
          value={
            Array.isArray(filter.value) && filter.value.length === 2
              ? [filter.value[0] || null, filter.value[1] || null]
              : null
          }
          onChange={(dates: any) => {
            if (dates && dates.length === 2) {
              handleValueChange([
                dates[0]?.format('YYYY-MM-DD') || '',
                dates[1]?.format('YYYY-MM-DD') || '',
              ]);
            } else {
              handleValueChange(['', '']);
            }
          }}
        />
      );
    }
    return (
      <Input
        placeholder="YYYY-MM-DD"
        style={{ width: 140 }}
        size="small"
        value={filter.value}
        onChange={(e) => handleValueChange(e.target.value)}
      />
    );
  };

  const getOps = () => {
    if (fieldType === 'number') return NUMBER_OPS;
    if (fieldType === 'date') return DATE_OPS;
    return STRING_OPS;
  };

  return (
    <div className="filter-item">
      <span className="filter-field">{filter.label}</span>
      <Select
        value={filter.operator}
        options={getOps()}
        style={{ width: 120 }}
        size="small"
        onChange={handleOperatorChange}
      />
      {fieldType === 'string' && renderStringInput()}
      {fieldType === 'number' && renderNumberInput()}
      {fieldType === 'date' && renderDateInput()}
      <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={onRemove} />
    </div>
  );
};

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  fields,
  onAddFilter,
  onRemoveFilter,
}) => {
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const {
    filterPresets,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    setFilters,
  } = useDataStore();

  const availableFields = fields.filter(
    (f) => !filters.some((fi) => fi.field === f.name)
  );

  const handleAdd = () => {
    if (!selectedField) return;
    const field = fields.find((f) => f.name === selectedField);
    if (!field) return;

    // 根据字段类型智能选择默认操作符和初始值
    let operator: FilterCondition['operator'] = 'eq';
    let value: any = '';

    if (field.type === 'string') {
      operator = 'in';
      value = [];
    } else if (field.type === 'number') {
      operator = 'gt';
      value = '';
    } else if (field.type === 'date') {
      operator = 'between';
      value = ['', ''];
    }

    onAddFilter({
      field: field.name,
      label: field.label,
      operator,
      value,
    });
    setSelectedField(null);
  };

  const handleUpdateFilter = (updated: FilterCondition) => {
    const newFilters = filters.map((f) =>
      f.field === updated.field ? updated : f
    );
    setFilters(newFilters);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.warning('请输入筛选名称');
      return;
    }
    if (filters.length === 0) {
      message.warning('当前没有筛选条件');
      return;
    }
    saveFilterPreset(presetName.trim());
    message.success('筛选条件已保存');
    setSaveModalOpen(false);
    setPresetName('');
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    loadFilterPreset(preset);
    message.success(`已加载筛选：${preset.name}`);
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar-header">
        <span className="filter-bar-title">
          筛选条件
          {filters.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {filters.length} 个
            </Tag>
          )}
        </span>
        <Space>
          <Select
            placeholder="选择字段"
            value={selectedField}
            onChange={setSelectedField}
            options={availableFields.map((f) => ({
              value: f.name,
              label: `${f.label} (${f.type === 'string' ? '文本' : f.type === 'number' ? '数值' : '日期'})`,
            }))}
            style={{ width: 200 }}
            size="small"
            allowClear
            showSearch
            filterOption={(input, option) =>
              String(option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Button size="small" onClick={handleAdd} disabled={!selectedField}>
            添加
          </Button>
          {filters.length > 0 && (
            <Button size="small" icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>
              保存筛选
            </Button>
          )}
        </Space>
      </div>

      {/* 已保存的筛选快捷方式 */}
      {filterPresets.length > 0 && (
        <div style={{ padding: '4px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 12, color: '#999', marginRight: 8 }}>快捷筛选:</span>
          {filterPresets.map((preset) => (
            <Tag
              key={preset.id}
              color="cyan"
              style={{ cursor: 'pointer', fontSize: 12 }}
              onClick={() => handleLoadPreset(preset)}
              closable
              onClose={(e) => {
                e.preventDefault();
                deleteFilterPreset(preset.id);
              }}
            >
              {preset.name}
            </Tag>
          ))}
        </div>
      )}

      {filters.length > 0 && (
        <div className="filter-list">
          {filters.map((f) => (
            <FilterItem
              key={f.field}
              filter={f}
              fields={fields}
              onUpdate={handleUpdateFilter}
              onRemove={() => onRemoveFilter(f.field)}
            />
          ))}
        </div>
      )}

      {/* 保存筛选弹窗 */}
      <Modal
        title="保存筛选条件"
        open={saveModalOpen}
        onOk={handleSavePreset}
        onCancel={() => {
          setSaveModalOpen(false);
          setPresetName('');
        }}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <Input
            placeholder="输入筛选名称"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onPressEnter={handleSavePreset}
          />
          <div style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
            当前筛选条件：
            {filters.map((f) => `${f.label}${f.operator}${Array.isArray(f.value) ? f.value.join(',') : f.value}`).join('，')}
          </div>
        </div>
      </Modal>
    </div>
  );
};
