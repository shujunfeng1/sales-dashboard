import React, { useState, useCallback } from 'react';
import { Table, Pagination, Button, Checkbox, Dropdown, Space, message } from 'antd';
import { useDataStore } from '../stores/useDataStore';
import { exportToExcel } from '../utils/excelParser';
import {
  DownloadOutlined,
  SettingOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import './DataTableView.css';

const PAGE_SIZE = 20;

export const DataTableView: React.FC = () => {
  const [page, setPage] = useState(1);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const {
    rawData,
    fields,
    getSortedData,
    tableConfig,
    setTableSort,
    setVisibleColumns,
    setColumnWidth,
  } = useDataStore();

  const { sortField, sortOrder, visibleColumns, columnWidths } = tableConfig;

  const sortedData = getSortedData();
  const startIndex = (page - 1) * PAGE_SIZE;
  const pageData = sortedData.slice(startIndex, startIndex + PAGE_SIZE);

  const handleSort = useCallback(
    (fieldName: string) => {
      if (sortField === fieldName) {
        // 切换排序方向
        if (sortOrder === 'asc') {
          setTableSort(fieldName, 'desc');
        } else if (sortOrder === 'desc') {
          setTableSort(null, null);
        } else {
          setTableSort(fieldName, 'asc');
        }
      } else {
        setTableSort(fieldName, 'asc');
      }
      setPage(1);
    },
    [sortField, sortOrder, setTableSort]
  );

  const handleExport = useCallback(() => {
    if (sortedData.length === 0) {
      message.warning('没有数据可导出');
      return;
    }
    // 只导出可见列
    const visibleData = sortedData.map((row) => {
      const newRow: Record<string, any> = {};
      visibleColumns.forEach((col) => {
        newRow[col] = row[col];
      });
      return newRow;
    });
    exportToExcel(visibleData, `导出数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success(`已导出 ${visibleData.length} 条数据`);
  }, [sortedData, visibleColumns]);

  const handleColumnVisibilityChange = useCallback(
    (fieldName: string, checked: boolean) => {
      if (checked) {
        setVisibleColumns([...visibleColumns, fieldName]);
      } else {
        setVisibleColumns(visibleColumns.filter((c) => c !== fieldName));
      }
    },
    [visibleColumns, setVisibleColumns]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, fieldName: string) => {
      e.preventDefault();
      setResizingCol(fieldName);
      setStartX(e.clientX);
      setStartWidth(columnWidths[fieldName] || 150);
    },
    [columnWidths]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizingCol) return;
      const diff = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      setColumnWidth(resizingCol, newWidth);
    },
    [resizingCol, startX, startWidth, setColumnWidth]
  );

  const handleMouseUp = useCallback(() => {
    setResizingCol(null);
  }, []);

  if (rawData.length === 0) {
    return (
      <div className="data-table-view empty">
        <p>暂无数据</p>
        <p className="hint">请先导入 Excel 文件</p>
      </div>
    );
  }

  const visibleFields = fields.filter((f) => visibleColumns.includes(f.name));

  const columns = visibleFields.map((f) => {
    const isSorted = sortField === f.name;
    const width = columnWidths[f.name] || 150;

    return {
      title: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => handleSort(f.name)}
        >
          <span>{f.label}</span>
          <span style={{ marginLeft: 4 }}>
            {isSorted && sortOrder === 'asc' && (
              <SortAscendingOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            )}
            {isSorted && sortOrder === 'desc' && (
              <SortDescendingOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            )}
          </span>
        </div>
      ),
      dataIndex: f.name,
      key: f.name,
      width,
      ellipsis: true,
      onHeaderCell: () => ({
        style: { position: 'relative' as const },
      }),
    };
  });

  // 列设置菜单
  const columnSettingsMenu = (
    <div
      style={{
        padding: 12,
        background: '#fff',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        maxHeight: 400,
        overflow: 'auto',
        minWidth: 200,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>显示列</div>
      {fields.map((f) => (
        <div key={f.name} style={{ marginBottom: 4 }}>
          <Checkbox
            checked={visibleColumns.includes(f.name)}
            onChange={(e) => handleColumnVisibilityChange(f.name, e.target.checked)}
          >
            {f.label} ({f.type === 'string' ? '文本' : f.type === 'number' ? '数值' : '日期'})
          </Checkbox>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="data-table-view"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="table-toolbar">
        <span className="table-info">
          共 {sortedData.length} 条数据（原始 {rawData.length} 条）
          {sortField && (
            <span style={{ marginLeft: 8, color: '#1890ff' }}>
              已按 {fields.find((f) => f.name === sortField)?.label} {sortOrder === 'asc' ? '升序' : '降序'}排列
            </span>
          )}
        </span>
        <Space>
          <Dropdown
            menu={{ items: [] }}
            dropdownRender={() => columnSettingsMenu}
            trigger={['click']}
            open={columnSettingsOpen}
            onOpenChange={setColumnSettingsOpen}
          >
            <Button size="small" icon={<SettingOutlined />}>
              列设置
            </Button>
          </Dropdown>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            导出 Excel
          </Button>
        </Space>
      </div>

      <div className="table-wrapper">
        <Table
          dataSource={pageData.map((row, i) => ({ ...row, key: i }))}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ x: visibleFields.length * 150 }}
          bordered
        />
        {/* 列宽调整手柄 */}
        {visibleFields.map((f) => (
          <div
            key={`resize-${f.name}`}
            style={{
              position: 'absolute' as const,
              right: 0,
              top: 0,
              bottom: 0,
              width: 4,
              cursor: 'col-resize',
              zIndex: 10,
            }}
            onMouseDown={(e) => handleMouseDown(e, f.name)}
          />
        ))}
      </div>

      {sortedData.length > PAGE_SIZE && (
        <div className="pagination-wrapper">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={sortedData.length}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(total) => `共 ${total} 条`}
          />
        </div>
      )}
    </div>
  );
};
