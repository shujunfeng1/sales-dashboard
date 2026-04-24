import React, { useMemo } from 'react';
import { Table, Tag, Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useAntdColumnResize } from 'react-antd-column-resize';
import * as XLSX from 'xlsx';
import { useDataStore, PivotTableData } from '../stores/useDataStore';
import './PivotTableView.css';

// 透视表展示格式化（按万/亿）
const formatDisplay = (val: number): string => {
  if (val === 0) return '0';
  if (Math.abs(val) >= 100000000) {
    return (val / 100000000).toFixed(2).replace(/\.?0+$/, '') + '亿';
  }
  if (Math.abs(val) >= 10000) {
    return (val / 10000).toFixed(2).replace(/\.?0+$/, '') + '万';
  }
  return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
};

// 导出用格式化（保留2位小数，纯数字）
const formatExport = (val: number): number => {
  return Math.round(val * 100) / 100;
};

// 生成单元格 dataIndex：colKey + yField
const cellKey = (colKey: string, yField: string) => `${colKey}###${yField}`;

export const PivotTableView: React.FC = () => {
  const { rowDimensions, yAxis, getPivotTableData, fileName } = useDataStore();

  const pivotData = getPivotTableData();

  if (rowDimensions.length === 0 || yAxis.length === 0) {
    return (
      <div className="pivot-table-view empty">
        <p>请先配置行维度和数值指标</p>
        <p className="hint">将字段拖拽到「行区域」和「数值区域」后，此处将显示透视汇总表</p>
      </div>
    );
  }

  if (!pivotData) {
    return (
      <div className="pivot-table-view empty">
        <p>暂无透视数据</p>
      </div>
    );
  }

  const handleExport = () => {
    if (!pivotData) return;
    exportPivotToExcel(pivotData, fileName || '透视表');
  };

  return (
    <div className="pivot-table-view">
      <PivotTable pivotData={pivotData} onExport={handleExport} />
    </div>
  );
};

const PivotTable: React.FC<{ pivotData: PivotTableData; onExport?: () => void }> = ({ pivotData, onExport }) => {
  const { rowHeaders, colHeaders, rowDimensionLabels, colDimensionLabel, valueLabels, data, totals } = pivotData;
  const hasColumn = colHeaders.length > 0 && colHeaders[0] !== '__TOTAL__';
  const yAxisFields = pivotData.valueLabels;

  const isTotalRow = (record: any) => record.key === 'total';

  const cellRender = (val: number, record: any) => {
    const display = formatDisplay(val);
    return isTotalRow(record)
      ? <strong className={val < 0 ? 'negative-value' : ''}>{display}</strong>
      : <span className={val < 0 ? 'negative-value' : ''}>{display}</span>;
  };

  // 构建 Ant Design Table 的 columns（带初始宽度，用于拖拽）
  const baseColumns = useMemo(() => {
    const cols: any[] = [];

    // 行维度列（支持多级）
    if (rowDimensionLabels.length === 1) {
      cols.push({
        title: rowDimensionLabels[0],
        dataIndex: '__rowKey__',
        key: '__rowKey__',
        fixed: 'left',
        width: 120,
        sorter: (a: any, b: any) => String(a.__rowKey__).localeCompare(String(b.__rowKey__)),
        render: (val: any, record: any) => (
          isTotalRow(record) ? <strong>{val}</strong> : val
        ),
      });
    } else {
      rowDimensionLabels.forEach((label, idx) => {
        cols.push({
          title: label,
          dataIndex: `__dim_${idx}__`,
          key: `__dim_${idx}__`,
          fixed: idx === 0 ? 'left' : undefined,
          width: 110,
          render: (val: any, record: any) => (
            isTotalRow(record) ? <strong>{val}</strong> : val
          ),
        });
      });
    }

    // 数据列
    if (hasColumn) {
      colHeaders.forEach((ck) => {
        const children = yAxisFields.map((yLabel) => {
          const dk = cellKey(ck, yLabel);
          return {
            title: yLabel,
            dataIndex: dk,
            key: dk,
            align: 'right' as const,
            width: 110,
            sorter: (a: any, b: any) => (a[dk] || 0) - (b[dk] || 0),
            render: cellRender,
          };
        });
        cols.push({
          title: ck,
          align: 'center' as const,
          children,
        });
      });

      const totalChildren = yAxisFields.map((yLabel) => {
        const dk = `__total__###${yLabel}`;
        return {
          title: yLabel,
          dataIndex: dk,
          key: dk,
          align: 'right' as const,
          width: 110,
          sorter: (a: any, b: any) => (a[dk] || 0) - (b[dk] || 0),
          render: cellRender,
        };
      });
      cols.push({
        title: '合计',
        fixed: 'right',
        align: 'center' as const,
        children: totalChildren,
      });
    } else {
      yAxisFields.forEach((yLabel) => {
        const dk = cellKey('__TOTAL__', yLabel);
        cols.push({
          title: yLabel,
          dataIndex: dk,
          key: dk,
          align: 'right' as const,
          width: 120,
          sorter: (a: any, b: any) => (a[dk] || 0) - (b[dk] || 0),
          render: cellRender,
        });
      });
    }

    return cols;
  }, [rowDimensionLabels, colHeaders, yAxisFields, hasColumn]);

  // 列宽拖拽 Hook
  const { resizableColumns, components, tableWidth, resetColumns } = useAntdColumnResize(() => {
    return { columns: baseColumns, minWidth: 80 };
  }, [baseColumns]);

  // 构建数据源
  const tableData = rowHeaders.map((rk, idx) => {
    const row: any = {
      key: idx,
      __rowKey__: rk,
    };

    if (rowDimensionLabels.length > 1) {
      const parts = rk.split(' | ');
      rowDimensionLabels.forEach((_, dimIdx) => {
        row[`__dim_${dimIdx}__`] = parts[dimIdx] || '';
      });
    }

    colHeaders.forEach((ck) => {
      yAxisFields.forEach((yLabel) => {
        row[cellKey(ck, yLabel)] = data[rk]?.[ck]?.[yLabel] || 0;
      });
    });

    if (hasColumn) {
      yAxisFields.forEach((yLabel) => {
        row[`__total__###${yLabel}`] = totals.rowTotals[rk]?.[yLabel] || 0;
      });
    }

    return row;
  });

  const totalRow: any = {
    key: 'total',
    __rowKey__: '总计',
  };
  if (rowDimensionLabels.length > 1) {
    rowDimensionLabels.forEach((_, dimIdx) => {
      totalRow[`__dim_${dimIdx}__`] = '总计';
    });
  }

  colHeaders.forEach((ck) => {
    yAxisFields.forEach((yLabel) => {
      totalRow[cellKey(ck, yLabel)] = totals.colTotals[ck]?.[yLabel] || 0;
    });
  });

  if (hasColumn) {
    yAxisFields.forEach((yLabel) => {
      totalRow[`__total__###${yLabel}`] = totals.grandTotals[yLabel] || 0;
    });
  }

  return (
    <div className="pivot-table-card">
      <div className="pivot-table-toolbar">
        <div className="pivot-table-dimensions">
          <span className="dim-label">维度</span>
          <Tag color="blue" style={{ fontSize: 12 }}>{rowDimensionLabels.join(' → ')}</Tag>
          {hasColumn && (
            <>
              <span className="dim-sep">×</span>
              <Tag color="green" style={{ fontSize: 12 }}>{colDimensionLabel}</Tag>
            </>
          )}
          <span className="dim-sep">=</span>
          <Tag color="orange" style={{ fontSize: 12 }}>{valueLabels.join(', ')}</Tag>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="small" onClick={resetColumns}>
            重置列宽
          </Button>
          {onExport && (
            <Button size="small" icon={<DownloadOutlined />} onClick={onExport} className="export-btn">
              导出Excel
            </Button>
          )}
        </div>
      </div>
      <div className="pivot-table-body">
        <Table
          columns={resizableColumns}
          components={components}
          dataSource={[...tableData, totalRow]}
          pagination={false}
          size="small"
          scroll={{ x: tableWidth, y: 'calc(100vh - 340px)' }}
          rowClassName={(record) => (record.key === 'total' ? 'total-row' : '')}
        />
      </div>
    </div>
  );
};

// 导出透视表到 Excel
function exportPivotToExcel(pivotData: PivotTableData, fileNamePrefix: string) {
  const { rowHeaders, colHeaders, rowDimensionLabels, valueLabels, data, totals } = pivotData;
  const hasColumn = colHeaders.length > 0 && colHeaders[0] !== '__TOTAL__';

  const headerRow: string[] = [...rowDimensionLabels];

  if (hasColumn) {
    colHeaders.forEach((ck) => {
      valueLabels.forEach((yLabel) => {
        headerRow.push(`${ck} · ${yLabel}`);
      });
    });
    valueLabels.forEach((yLabel) => headerRow.push(`合计 · ${yLabel}`));
  } else {
    valueLabels.forEach((yLabel) => headerRow.push(yLabel));
  }

  const rows: any[][] = [];

  rowHeaders.forEach((rk) => {
    const row: any[] = [];
    if (rowDimensionLabels.length === 1) {
      row.push(rk);
    } else {
      const parts = rk.split(' | ');
      rowDimensionLabels.forEach((_, idx) => {
        row.push(parts[idx] || '');
      });
    }
    if (hasColumn) {
      colHeaders.forEach((ck) => {
        valueLabels.forEach((yLabel) => {
          row.push(formatExport(data[rk]?.[ck]?.[yLabel] || 0));
        });
      });
      valueLabels.forEach((yLabel) => {
        row.push(formatExport(totals.rowTotals[rk]?.[yLabel] || 0));
      });
    } else {
      valueLabels.forEach((yLabel) => {
        row.push(formatExport(data[rk]?.['__TOTAL__']?.[yLabel] || 0));
      });
    }
    rows.push(row);
  });

  const totalRow: any[] = [];
  if (rowDimensionLabels.length === 1) {
    totalRow.push('总计');
  } else {
    rowDimensionLabels.forEach(() => totalRow.push('总计'));
  }
  if (hasColumn) {
    colHeaders.forEach((ck) => {
      valueLabels.forEach((yLabel) => {
        totalRow.push(formatExport(totals.colTotals[ck]?.[yLabel] || 0));
      });
    });
    valueLabels.forEach((yLabel) => {
      totalRow.push(formatExport(totals.grandTotals[yLabel] || 0));
    });
  } else {
    valueLabels.forEach((yLabel) => {
      totalRow.push(formatExport(totals.grandTotals[yLabel] || 0));
    });
  }
  rows.push(totalRow);

  const wsData = [headerRow, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '透视表');
  XLSX.writeFile(wb, `${fileNamePrefix}_透视表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  message.success('透视表已导出');
}
