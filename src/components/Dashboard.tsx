import React, { useState, useRef } from 'react';
import {
  Button, Modal, Input, message, Dropdown, Space, Drawer,
  Form, Select, Tag, List, Timeline, Tabs, DatePicker, InputNumber,
  Switch, Divider,
} from 'antd';

const { RangePicker } = DatePicker;
import {
  SaveOutlined, FolderOpenOutlined, DownloadOutlined, FileExcelOutlined,
  CalculatorOutlined, AlertOutlined, HistoryOutlined,
  UploadOutlined, FileTextOutlined, LinkOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useDataStore, DropItem, Field, ComputedField, AlertRule, DateFilter } from '../stores/useDataStore';
import { FileImport } from './FileImport';
import { FieldPanel } from './FieldPanel';
import { DropZone } from './DropZone';
import { FilterBar } from './FilterBar';
import { ChartView } from './ChartView';
import { DataTableView } from './DataTableView';
import { PivotTableView } from './PivotTableView';
import { RankingInsights } from './RankingInsights';
import { JoinDataDrawer } from './JoinDataDrawer';
import { WeComPushDrawer } from './WeComPushDrawer';
import './Dashboard.css';

// 计算字段可视化编辑器
interface ComputedFieldEditorProps {
  fields: Field[];
  onAdd: (values: { label: string; formula: string; type: string }) => void;
}

const MATH_OPS = [
  { label: '+', value: ' + ' },
  { label: '-', value: ' - ' },
  { label: '×', value: ' * ' },
  { label: '÷', value: ' / ' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
];

const LOGIC_OPS = [
  { label: '>', value: ' > ' },
  { label: '<', value: ' < ' },
  { label: '≥', value: ' >= ' },
  { label: '≤', value: ' <= ' },
  { label: '=', value: ' == ' },
  { label: '≠', value: ' != ' },
  { label: '且', value: ' && ' },
  { label: '或', value: ' || ' },
  { label: '?:', value: ' ? ' },
  { label: ':', value: ' : ' },
];

const AGG_FUNCTIONS = [
  { label: 'SUM', value: 'SUM(', desc: '求和' },
  { label: 'AVG', value: 'AVG(', desc: '平均' },
  { label: 'COUNT', value: 'COUNT(', desc: '计数' },
  { label: 'DISTINCTCOUNT', value: 'DISTINCTCOUNT(', desc: '去重计数' },
];

const { TextArea } = Input;

const ComputedFieldEditor: React.FC<ComputedFieldEditorProps> = ({ fields, onAdd }) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('number');
  const [formula, setFormula] = useState('');
  const [visualMode, setVisualMode] = useState(true);
  const textareaRef = useRef<any>(null);

  const insertText = (text: string) => {
    const el = textareaRef.current?.resizableTextArea?.textArea || textareaRef.current;
    if (!el) {
      setFormula((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? formula.length;
    const end = el.selectionEnd ?? formula.length;
    const newFormula = formula.slice(0, start) + text + formula.slice(end);
    setFormula(newFormula);
    // 光标移到插入文本后
    setTimeout(() => {
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
      el.focus();
    }, 0);
  };

  const handleSubmit = () => {
    if (!label.trim()) {
      message.warning('请输入字段名称');
      return;
    }
    const trimmedFormula = formula.trim();
    if (!trimmedFormula) {
      message.warning('请输入计算公式');
      return;
    }
    onAdd({ label: label.trim(), formula: trimmedFormula, type });
    setLabel('');
    setFormula('');
  };

  // 按类型分组的所有字段
  const typeLabelMap: Record<string, string> = {
    number: '数值字段',
    string: '文本字段',
    date: '日期字段',
    boolean: '布尔字段',
  };

  const fieldOptions = React.useMemo(() => {
    const groups: Record<string, { value: string; label: string }[]> = {};
    fields.forEach((f) => {
      const groupName = typeLabelMap[f.type] || '其他字段';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push({ value: f.name, label: f.label });
    });
    return Object.entries(groups).map(([groupLabel, opts]) => ({
      label: groupLabel,
      options: opts,
    }));
  }, [fields]);

  // 公式中高亮字段名（简单预览）
  const formulaPreview = React.useMemo(() => {
    if (!formula) return null;
    const fieldMap = new Map(fields.map((f) => [f.name, f.label]));
    const parts = formula.split(/([a-zA-Z_][a-zA-Z0-9_]*|\d+\.?\d*|\S)/g).filter(Boolean);
    return parts.map((part, idx) => {
      if (fieldMap.has(part)) {
        return (
          <Tag key={idx} color="blue" style={{ margin: 0, fontSize: 13 }}>
            {fieldMap.get(part)}
          </Tag>
        );
      }
      if (/^\d+\.?\d*$/.test(part)) {
        return (
          <Tag key={idx} color="green" style={{ margin: 0, fontSize: 13 }}>
            {part}
          </Tag>
        );
      }
      if (/^(SUM|AVG|COUNT|DISTINCTCOUNT)\b$/.test(part)) {
        return (
          <Tag key={idx} color="purple" style={{ margin: 0, fontSize: 13 }}>
            {part}
          </Tag>
        );
      }
      return <span key={idx} style={{ fontSize: 13, padding: '0 2px' }}>{part}</span>;
    });
  }, [formula, fields]);

  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ marginBottom: 12 }}>添加计算字段</h4>

      {/* 字段名称 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>字段名称</label>
        <Input
          placeholder="例如：利润率、客户贡献度"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {/* 公式输入区 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontSize: 14 }}>计算公式</label>
          <Space size={4}>
            <span style={{ fontSize: 12, color: '#888' }}>可视化构建</span>
            <Switch size="small" checked={visualMode} onChange={setVisualMode} />
          </Space>
        </div>

        <TextArea
          ref={textareaRef}
          rows={3}
          placeholder="在此输入公式，如：SUM(gmv) / COUNT(order_id) 或 gmv > 10000 ? '大客户' : '普通客户'"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />

        {formulaPreview && (
          <div
            style={{
              marginTop: 8,
              minHeight: 32,
              padding: '6px 10px',
              background: '#f8f9fa',
              borderRadius: 6,
              border: '1px dashed #d9d9d9',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: '#888', marginRight: 4 }}>预览:</span>
            {formulaPreview}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button size="small" onClick={() => insertText(' ')}>空格</Button>
          <Button size="small" danger onClick={() => setFormula('')} disabled={!formula}>
            清空
          </Button>
        </div>
      </div>

      {visualMode && (
        <>
          {/* 字段选择 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>选择字段</label>
            <Select
              style={{ width: '100%' }}
              placeholder="选择数据字段（支持所有字段类型）"
              options={fieldOptions}
              onChange={(value) => insertText(value)}
            />
          </div>

          {/* 聚合函数 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>
              聚合函数 <span style={{ fontSize: 11, color: '#999' }}>(行级计算)</span>
            </label>
            <Space wrap>
              {AGG_FUNCTIONS.map((fn) => (
                <Button key={fn.value} size="small" onClick={() => insertText(fn.value)}>
                  {fn.label}
                </Button>
              ))}
              <Button size="small" onClick={() => insertText(')')}>)</Button>
            </Space>
          </div>

          {/* 数学运算符 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>数学运算符</label>
            <Space wrap>
              {MATH_OPS.map((op) => (
                <Button key={op.value} size="small" onClick={() => insertText(op.value)}>
                  {op.label}
                </Button>
              ))}
            </Space>
          </div>

          {/* 逻辑运算符 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>逻辑与条件</label>
            <Space wrap>
              {LOGIC_OPS.map((op) => (
                <Button key={op.value} size="small" onClick={() => insertText(op.value)}>
                  {op.label}
                </Button>
              ))}
            </Space>
          </div>

          {/* 数字输入 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>输入数值</label>
            <Space>
              <InputNumber
                size="small"
                placeholder="输入数字"
                style={{ width: 120 }}
                onPressEnter={(e: any) => {
                  const val = e.target.value;
                  if (val !== '' && val !== null) insertText(String(val));
                }}
              />
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  const input = document.querySelector('.ant-input-number-input') as HTMLInputElement;
                  if (input && input.value) {
                    insertText(input.value);
                    input.value = '';
                  }
                }}
              >
                添加数字
              </Button>
            </Space>
          </div>
        </>
      )}

      {/* 字段类型 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>字段类型</label>
        <Select
          style={{ width: '100%' }}
          value={type}
          onChange={(val) => setType(val)}
          options={[
            { value: 'number', label: '数值' },
            { value: 'string', label: '文本' },
            { value: 'boolean', label: '布尔' },
          ]}
        />
      </div>

      <Button type="primary" block onClick={handleSubmit}>
        添加计算字段
      </Button>

      <Divider style={{ margin: '16px 0' }} />
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
        <div style={{ marginBottom: 4 }}><strong>💡 公式示例：</strong></div>
        <div>利润率：<code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>profit / revenue * 100</code></div>
        <div>客户等级：<code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>gmv &gt; 50000 ? &quot;VIP&quot; : &quot;普通&quot;</code></div>
        <div>是否达标：<code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: 3 }}>gmv &gt;= target &amp;&amp; orders &gt; 10</code></div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [activeDragField, setActiveDragField] = useState<Field | null>(null);

  // 计算字段
  const [computedDrawerOpen, setComputedDrawerOpen] = useState(false);
  const [computedForm] = Form.useForm();

  // 数据预警
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [alertForm] = Form.useForm();

  // 数据关联
  const [joinDrawerOpen, setJoinDrawerOpen] = useState(false);

  // 企业微信推送
  const [weComDrawerOpen, setWeComDrawerOpen] = useState(false);
  // 图表导出函数（由 ChartView 通过回调注入）
  const chartExportFnRef = useRef<(() => string | undefined) | null>(null);

  // 历史记录
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // 项目文件
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectAction, setProjectAction] = useState<'save' | 'load'>('save');

  const {
    rawData,
    fields,
    xAxis,
    yAxis,
    rowDimensions,
    columnDimension,
    dateFilter,
    filters,
    templates,
    fileName,
    computedFields,
    alertRules,
    history,
    addYAxisItem,
    removeYAxisItem,
    updateYAxisAggregation,
    addRowDimension,
    removeRowDimension,
    setColumnDimension,
    setDateFilter,
    updateDateFilterRange,
    addFilter,
    removeFilter,
    saveTemplate,
    loadTemplate,
    clearData,
    addComputedField,
    removeComputedField,
    addAlertRule,
    removeAlertRule,
    joinData,
    saveProject,
    loadProject,
  } = useDataStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    if (active.data.current?.field) {
      setActiveDragField(active.data.current.field);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragField(null);
    if (!over) return;

    const field = active.data.current?.field as Field | undefined;
    if (!field) return;

    const dropId = over.id as string;
    const dropItem: DropItem = {
      field: field.name,
      label: field.label,
      aggregation: 'sum',
      chartType: 'bar',
    };

    if (dropId === 'x-axis') {
      addRowDimension(dropItem);
    } else if (dropId === 'y-axis') {
      addYAxisItem(dropItem);
    } else if (dropId === 'column-dimension') {
      setColumnDimension(dropItem);
    } else if (dropId === 'date-filter') {
      // 只有日期字段才能拖入日期筛选器
      if (field.type === 'date') {
        const df: DateFilter = {
          field: field.name,
          label: field.label,
          start: '',
          end: '',
        };
        setDateFilter(df);
      } else {
        message.warning('日期筛选器只接受日期类型字段');
      }
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      message.warning('请输入模板名称');
      return;
    }
    if (!xAxis || yAxis.length === 0) {
      message.warning('请先配置 X 轴和 Y 轴');
      return;
    }
    saveTemplate(templateName.trim());
    message.success('模板保存成功');
    setSaveModalOpen(false);
    setTemplateName('');
  };

  const handleLoadTemplate = (template: any) => {
    loadTemplate(template);
    message.success(`已加载模板：${template.name}`);
  };

  // 计算字段
  const handleAddComputedField = (values: any) => {
    const field: ComputedField = {
      name: `computed_${Date.now()}`,
      label: values.label,
      formula: values.formula,
      type: values.type || 'number',
    };
    addComputedField(field);
    message.success(`计算字段 "${values.label}" 已添加`);
    computedForm.resetFields();
    setComputedDrawerOpen(false);
  };

  // 数据预警
  const handleAddAlertRule = (values: any) => {
    const rule: AlertRule = {
      id: `alert_${Date.now()}`,
      field: values.field,
      label: fields.find((f) => f.name === values.field)?.label || values.field,
      operator: values.operator,
      threshold: Number(values.threshold),
      color: values.color || '#ff4d4f',
    };
    addAlertRule(rule);
    message.success('预警规则已添加');
    alertForm.resetFields();
  };

  // 项目文件
  const handleSaveProject = () => {
    const json = saveProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `项目配置_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    message.success('项目配置已导出');
    setProjectModalOpen(false);
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        loadProject(json);
        message.success('项目配置已加载');
        setProjectModalOpen(false);
      } catch {
        message.error('项目文件解析失败');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const hasData = rawData.length > 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="dashboard">
        {/* 顶部工具栏 */}
        <div className="toolbar">
          <div className="toolbar-left">
            <span className="toolbar-title">销售数据可视化</span>
            {fileName && (
              <span className="file-name">
                <FileExcelOutlined /> {fileName}
              </span>
            )}
            {computedFields.length > 0 && (
              <Tag color="purple" style={{ marginLeft: 8 }}>
                <CalculatorOutlined /> {computedFields.length} 个计算字段
              </Tag>
            )}
            {alertRules.length > 0 && (
              <Tag color="red" style={{ marginLeft: 8 }}>
                <AlertOutlined /> {alertRules.length} 个预警
              </Tag>
            )}
          </div>
          <div className="toolbar-right">
            {hasData && (
              <Space size={4} wrap>
                <Button
                  icon={<CalculatorOutlined />}
                  size="small"
                  onClick={() => setComputedDrawerOpen(true)}
                >
                  计算字段
                </Button>
                <Button
                  icon={<AlertOutlined />}
                  size="small"
                  onClick={() => setAlertDrawerOpen(true)}
                >
                  数据预警
                </Button>
                <Button
                  icon={<LinkOutlined />}
                  size="small"
                  onClick={() => setJoinDrawerOpen(true)}
                >
                  关联数据
                </Button>
                <Button
                  icon={<RobotOutlined />}
                  size="small"
                  onClick={() => setWeComDrawerOpen(true)}
                >
                  推送群聊
                </Button>
                <Button
                  icon={<HistoryOutlined />}
                  size="small"
                  onClick={() => setHistoryDrawerOpen(true)}
                >
                  历史记录
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  size="small"
                  onClick={() => setSaveModalOpen(true)}
                  disabled={!xAxis || yAxis.length === 0}
                >
                  保存模板
                </Button>
                <Dropdown
                  menu={{
                    items: templates.length === 0
                      ? [{ key: 'empty', label: '暂无模板', disabled: true }]
                      : templates.map((t) => ({
                          key: t.id,
                          label: t.name,
                          onClick: () => handleLoadTemplate(t),
                        })),
                  }}
                  trigger={['click']}
                >
                  <Button icon={<FolderOpenOutlined />} size="small">
                    加载模板
                  </Button>
                </Dropdown>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'save',
                        label: '保存项目',
                        icon: <DownloadOutlined />,
                        onClick: () => {
                          setProjectAction('save');
                          setProjectModalOpen(true);
                        },
                      },
                      {
                        key: 'load',
                        label: '加载项目',
                        icon: <UploadOutlined />,
                        onClick: () => {
                          setProjectAction('load');
                          setProjectModalOpen(true);
                        },
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button icon={<FileTextOutlined />} size="small">
                    项目文件
                  </Button>
                </Dropdown>
                <Button size="small" onClick={clearData}>
                  清空数据
                </Button>
              </Space>
            )}
          </div>
        </div>

        {/* 主内容区 */}
        {!hasData ? (
          <div className="import-area">
            <FileImport />
          </div>
        ) : (
          <div className="workspace">
            {/* 左侧字段面板 */}
            <div className="left-panel">
              <FieldPanel fields={fields} />
            </div>

            {/* 中间工作区 */}
            <div className="center-panel">
              {/* 维度配置 — 类似 Excel 透视表 */}
              <div className="axis-config">
                <DropZone
                  label="行区域（维度）"
                  id="x-axis"
                  items={rowDimensions}
                  onRemove={removeRowDimension}
                  placeholder="拖拽分类字段（支持多个，如：省区→业绩归属）"
                />
                <DropZone
                  label="列区域（可选）"
                  id="column-dimension"
                  items={columnDimension ? [columnDimension] : []}
                  onRemove={columnDimension ? () => setColumnDimension(null) : undefined}
                  placeholder="拖拽分类字段展开成列（如：月份）"
                />
                <DropZone
                  label="数值区域（指标）"
                  id="y-axis"
                  items={yAxis}
                  onRemove={removeYAxisItem}
                  onUpdateAggregation={updateYAxisAggregation}
                  placeholder="拖拽数值字段"
                />
              </div>

              {/* 日期筛选器 */}
              {dateFilter ? (
                <div className="date-filter-bar">
                  <div className="date-filter-label">
                    <span style={{ fontWeight: 600, marginRight: 8 }}>📅 日期筛选:</span>
                    <Tag color="blue">{dateFilter.label}</Tag>
                  </div>
                  <RangePicker
                    size="small"
                    style={{ width: 260 }}
                    placeholder={['开始日期', '结束日期']}
                    value={
                      dateFilter.start && dateFilter.end
                        ? [dayjs(dateFilter.start), dayjs(dateFilter.end)]
                        : null
                    }
                    onChange={(dates: any) => {
                      if (dates && dates.length === 2) {
                        updateDateFilterRange(
                          dates[0]?.format('YYYY-MM-DD') || '',
                          dates[1]?.format('YYYY-MM-DD') || ''
                        );
                      } else {
                        updateDateFilterRange('', '');
                      }
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    onClick={() => setDateFilter(null)}
                  >
                    移除
                  </Button>
                </div>
              ) : (
                <DropZone
                  label="日期筛选（可选）"
                  id="date-filter"
                  items={[]}
                  placeholder="拖拽日期字段筛选时间范围"
                />
              )}

              {/* 筛选栏 */}
              <FilterBar
                filters={filters}
                fields={fields}
                onAddFilter={addFilter}
                onRemoveFilter={removeFilter}
              />

              {/* 图表视图 */}
              <Tabs
                items={[
                  {
                    key: 'chart',
                    label: '📊 图表',
                    children: <ChartView
                      title={fileName || '数据图表'}
                      chartRefCallback={(fn) => { chartExportFnRef.current = fn; }}
                    />,
                  },
                  {
                    key: 'pivot',
                    label: '🧮 透视表',
                    children: <PivotTableView />,
                  },
                  {
                    key: 'table',
                    label: '📋 明细数据',
                    children: <DataTableView />,
                  },
                  {
                    key: 'insights',
                    label: '🏆 排名洞察',
                    children: <RankingInsights />,
                  },
                ]}
              />
            </div>
          </div>
        )}

        {/* 拖拽遮罩 */}
        <DragOverlay>
          {activeDragField && (
            <div className="drag-overlay-item">
              {activeDragField.label}
            </div>
          )}
        </DragOverlay>

        {/* 保存模板弹窗 */}
        <Modal
          title="保存模板"
          open={saveModalOpen}
          onOk={handleSaveTemplate}
          onCancel={() => setSaveModalOpen(false)}
          okText="保存"
          cancelText="取消"
        >
          <div style={{ padding: '20px 0' }}>
            <Input
              placeholder="输入模板名称"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onPressEnter={handleSaveTemplate}
            />
          </div>
        </Modal>

        {/* 项目文件弹窗 */}
        <Modal
          title={projectAction === 'save' ? '保存项目' : '加载项目'}
          open={projectModalOpen}
          onOk={() => {
            if (projectAction === 'save') {
              handleSaveProject();
            } else {
              fileInputRef.current?.click();
            }
          }}
          onCancel={() => setProjectModalOpen(false)}
          okText={projectAction === 'save' ? '下载' : '选择文件'}
          cancelText="取消"
        >
          <div style={{ padding: '20px 0' }}>
            {projectAction === 'save' ? (
              <p>将当前分析配置导出为 JSON 文件，包含字段配置、图表设置、筛选条件等。</p>
            ) : (
              <>
                <p>选择之前保存的项目配置文件（.json）</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLoadProject(file);
                  }}
                />
              </>
            )}
          </div>
        </Modal>

        {/* 计算字段抽屉 */}
        <Drawer
          title="计算字段"
          placement="right"
          width={420}
          open={computedDrawerOpen}
          onClose={() => setComputedDrawerOpen(false)}
        >
          <ComputedFieldEditor
            fields={fields}
            onAdd={(values) => {
              handleAddComputedField(values);
              computedForm.resetFields();
            }}
          />

          <div>
            <h4 style={{ marginBottom: 12 }}>已有计算字段</h4>
            {computedFields.length === 0 ? (
              <p style={{ color: '#999' }}>暂无计算字段</p>
            ) : (
              <List
                size="small"
                bordered
                dataSource={computedFields}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => removeComputedField(item.name)}
                      >
                        删除
                      </Button>,
                    ]}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{item.formula}</div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Drawer>

        {/* 数据预警抽屉 */}
        <Drawer
          title="数据预警"
          placement="right"
          width={400}
          open={alertDrawerOpen}
          onClose={() => setAlertDrawerOpen(false)}
        >
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>添加预警规则</h4>
            <Form form={alertForm} onFinish={handleAddAlertRule} layout="vertical">
              <Form.Item
                name="field"
                label="监控字段"
                rules={[{ required: true, message: '请选择字段' }]}
              >
                <Select
                  placeholder="选择要监控的字段"
                  options={fields
                    .filter((f) => f.type === 'number')
                    .map((f) => ({ value: f.name, label: f.label }))}
                />
              </Form.Item>
              <Form.Item
                name="operator"
                label="条件"
                rules={[{ required: true }]}
                initialValue="gt"
              >
                <Select
                  options={[
                    { value: 'gt', label: '大于' },
                    { value: 'lt', label: '小于' },
                    { value: 'gte', label: '大于等于' },
                    { value: 'lte', label: '小于等于' },
                    { value: 'eq', label: '等于' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="threshold"
                label="阈值"
                rules={[{ required: true, message: '请输入阈值' }]}
              >
                <Input type="number" placeholder="输入预警阈值" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  添加预警规则
                </Button>
              </Form.Item>
            </Form>
          </div>

          <div>
            <h4 style={{ marginBottom: 12 }}>已有预警规则</h4>
            {alertRules.length === 0 ? (
              <p style={{ color: '#999' }}>暂无预警规则</p>
            ) : (
              <List
                size="small"
                bordered
                dataSource={alertRules}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => removeAlertRule(item.id)}
                      >
                        删除
                      </Button>,
                    ]}
                  >
                    <Tag color={item.color}>{item.label}</Tag>
                    <span style={{ marginLeft: 8 }}>
                      {item.operator === 'gt' ? '>' : item.operator === 'lt' ? '<' : item.operator === 'gte' ? '>=' : item.operator === 'lte' ? '<=' : '='}
                      {' '}{item.threshold}
                    </span>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Drawer>

        {/* 数据关联抽屉 */}
        <JoinDataDrawer
          open={joinDrawerOpen}
          onClose={() => setJoinDrawerOpen(false)}
          mainFields={fields}
          onJoin={joinData}
        />

        {/* 企业微信推送抽屉 */}
        <WeComPushDrawer
          open={weComDrawerOpen}
          onClose={() => setWeComDrawerOpen(false)}
          chartExportFn={() => chartExportFnRef.current?.()}
        />

        {/* 历史记录抽屉 */}
        <Drawer
          title="操作历史"
          placement="right"
          width={380}
          open={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
        >
          {history.length === 0 ? (
            <p style={{ color: '#999' }}>暂无操作记录</p>
          ) : (
            <Timeline
              items={history.map((h) => ({
                children: (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{h.action}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {new Date(h.timestamp).toLocaleString()}
                    </div>
                    {h.xAxis && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        X轴: {h.xAxis.label}
                        {h.yAxis.length > 0 && ` | Y轴: ${h.yAxis.map((y) => y.label).join(', ')}`}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </Drawer>
      </div>
    </DndContext>
  );
};
