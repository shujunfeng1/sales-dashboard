import React from 'react';
import { Tag, Tooltip } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { Field, FieldType } from '../stores/useDataStore';
import './FieldPanel.css';

interface FieldItemProps {
  field: Field;
}

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  string: 'blue',
  number: 'green',
  date: 'orange',
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: '文本',
  number: '数值',
  date: '日期',
};

const FieldItem: React.FC<FieldItemProps> = ({ field }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.name,
    data: { field },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: 0.8,
      }
    : undefined;

  return (
    <Tooltip title={`拖拽到维度或指标区域`}>
      <div
        ref={setNodeRef}
        className={`field-item ${isDragging ? 'dragging' : ''}`}
        style={style}
        {...listeners}
        {...attributes}
      >
        <span className="field-name">{field.label}</span>
        <Tag color={FIELD_TYPE_COLORS[field.type]} className="field-type-tag">
          {FIELD_TYPE_LABELS[field.type]}
        </Tag>
      </div>
    </Tooltip>
  );
};

interface FieldPanelProps {
  fields: Field[];
}

export const FieldPanel: React.FC<FieldPanelProps> = ({ fields }) => {
  if (fields.length === 0) {
    return (
      <div className="field-panel empty">
        <p>暂无字段数据</p>
        <p className="hint">请先导入 Excel 文件</p>
      </div>
    );
  }

  // 按类型分组
  const byType = {
    string: fields.filter((f) => f.type === 'string'),
    number: fields.filter((f) => f.type === 'number'),
    date: fields.filter((f) => f.type === 'date'),
  };

  return (
    <div className="field-panel">
      <h3 className="panel-title">字段列表</h3>
      <p className="hint">拖拽字段到下方区域</p>

      {byType.date.length > 0 && (
        <div className="field-group">
          <div className="group-label">
            <Tag color="orange">日期</Tag>
          </div>
          {byType.date.map((f) => (
            <FieldItem key={f.name} field={f} />
          ))}
        </div>
      )}

      {byType.string.length > 0 && (
        <div className="field-group">
          <div className="group-label">
            <Tag color="blue">文本</Tag>
          </div>
          {byType.string.map((f) => (
            <FieldItem key={f.name} field={f} />
          ))}
        </div>
      )}

      {byType.number.length > 0 && (
        <div className="field-group">
          <div className="group-label">
            <Tag color="green">数值</Tag>
          </div>
          {byType.number.map((f) => (
            <FieldItem key={f.name} field={f} />
          ))}
        </div>
      )}
    </div>
  );
};
