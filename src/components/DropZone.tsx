import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Button, Select } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { DropItem, AggregationType } from '../stores/useDataStore';
import './DropZone.css';

const AGG_OPTIONS = [
  { value: 'sum', label: '求和' },
  { value: 'count', label: '计数' },
  { value: 'distinctCount', label: '去重计数' },
  { value: 'avg', label: '平均值' },
  { value: 'max', label: '最大值' },
  { value: 'min', label: '最小值' },
];

interface DropZoneProps {
  label: string;
  id: string;
  items: DropItem[];
  onRemove?: (field: string) => void;
  placeholder?: string;
  onUpdateAggregation?: (field: string, aggregation: AggregationType) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  label,
  id,
  items,
  onRemove,
  placeholder = '拖拽字段到这里',
  onUpdateAggregation,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const showAgg = id === 'y-axis' && !!onUpdateAggregation;

  return (
    <div
      ref={setNodeRef}
      className={`drop-zone ${isOver ? 'over' : ''} ${items.length > 0 ? 'has-items' : ''}`}
    >
      <div className="drop-zone-label">{label}</div>
      <div className="drop-zone-content">
        {items.length === 0 ? (
          <div className="drop-zone-placeholder">{placeholder}</div>
        ) : (
          <div className="drop-zone-items">
            {items.map((item) => (
              <div key={item.field} className={`drop-item ${showAgg ? 'with-agg' : ''}`}>
                <span className="drop-item-label">{item.label}</span>
                {showAgg && (
                  <Select
                    size="small"
                    bordered={false}
                    popupMatchSelectWidth={false}
                    className="drop-item-agg"
                    value={item.aggregation || 'sum'}
                    options={AGG_OPTIONS}
                    onChange={(value) => onUpdateAggregation!(item.field, value as AggregationType)}
                  />
                )}
                {onRemove && (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    className="drop-item-remove"
                    onClick={() => onRemove(item.field)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
