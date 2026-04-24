import { create } from 'zustand';
import * as XLSX from 'xlsx';
import { message } from 'antd';

export type FieldType = 'string' | 'number' | 'date';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'table' | 'mixed' | 'stacked' | 'heatmap';

export type AggregationType = 'sum' | 'avg' | 'count' | 'distinctCount' | 'max' | 'min';

export interface DropItem {
  field: string;
  label: string;
  aggregation?: AggregationType;
  chartType?: 'bar' | 'line';
}

export interface FilterCondition {
  field: string;
  label: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'in';
  value: any;
}

export interface DateFilter {
  field: string;
  label: string;
  start: string;
  end: string;
}

export interface ComputedField {
  name: string;
  label: string;
  formula: string;
  type: FieldType;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterCondition[];
  createdAt: string;
}

export interface AlertRule {
  id: string;
  field: string;
  label: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  color: string;
}

/** 企业微信机器人配置 */
export interface WeComBot {
  id: string;
  name: string;      // 群聊名称
  webhook: string;   // webhook 地址
  createdAt: string;
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  xAxis: DropItem | null;
  yAxis: DropItem[];
  rowDimensions: DropItem[];
  columnDimension: DropItem | null;
  filters: FilterCondition[];
  chartType: ChartType;
  action: string;
}

export interface Template {
  id: string;
  name: string;
  createdAt: string;
  xAxis: DropItem | null;
  yAxis: DropItem[];
  rowDimensions: DropItem[];
  columnDimension: DropItem | null;
  filters: FilterCondition[];
  chartType: ChartType;
  fields: Field[];
}

/** 透视表单元格数据 */
export interface PivotCell {
  rowKey: string;
  colKey: string;
  value: number;
  rawRows: Record<string, any>[];
}

/** 透视表结果 */
export interface PivotTableData {
  rowHeaders: string[];
  colHeaders: string[];
  rowDimensionLabels: string[];
  colDimensionLabel: string;
  valueLabels: string[];
  // data: rowKey -> colKey -> yField -> value
  data: Record<string, Record<string, Record<string, number>>>;
  totals: {
    rowTotals: Record<string, Record<string, number>>;
    colTotals: Record<string, Record<string, number>>;
    grandTotals: Record<string, number>;
  };
}

interface DataState {
  rawData: Record<string, any>[];
  fields: Field[];
  xAxis: DropItem | null;
  yAxis: DropItem[];
  rowDimensions: DropItem[];
  columnDimension: DropItem | null;
  dateFilter: DateFilter | null;
  filters: FilterCondition[];
  chartType: ChartType;
  templates: Template[];
  fileName: string | null;
  computedFields: ComputedField[];
  filterPresets: FilterPreset[];
  alertRules: AlertRule[];
  history: HistoryRecord[];
  tableConfig: {
    sortField: string | null;
    sortOrder: 'asc' | 'desc' | null;
    visibleColumns: string[];
    columnWidths: Record<string, number>;
  };
  drillPath: string[];
  weComBots: WeComBot[];

  setRawData: (data: Record<string, any>[], fields: Field[], fileName: string) => void;
  clearData: () => void;
  setXAxis: (item: DropItem | null) => void;
  setYAxis: (items: DropItem[]) => void;
  addRowDimension: (item: DropItem) => void;
  removeRowDimension: (field: string) => void;
  setColumnDimension: (item: DropItem | null) => void;
  setDateFilter: (filter: DateFilter | null) => void;
  updateDateFilterRange: (start: string, end: string) => void;
  addYAxisItem: (item: DropItem) => void;
  removeYAxisItem: (field: string) => void;
  updateYAxisAggregation: (field: string, aggregation: AggregationType) => void;
  setFilters: (filters: FilterCondition[]) => void;
  addFilter: (filter: FilterCondition) => void;
  removeFilter: (field: string) => void;
  setChartType: (type: ChartType) => void;
  saveTemplate: (name: string) => Template;
  loadTemplate: (template: Template) => void;
  deleteTemplate: (id: string) => void;
  addComputedField: (field: ComputedField) => void;
  removeComputedField: (name: string) => void;
  getAllFields: () => Field[];
  joinData: (secondaryData: Record<string, any>[], secondaryFields: Field[], joinField: string, prefix: string) => void;
  saveFilterPreset: (name: string) => void;
  loadFilterPreset: (preset: FilterPreset) => void;
  deleteFilterPreset: (id: string) => void;
  addAlertRule: (rule: AlertRule) => void;
  removeAlertRule: (id: string) => void;
  checkAlerts: (data: Record<string, any>[]) => { row: Record<string, any>; rules: AlertRule[] }[];
  addHistory: (action: string) => void;
  clearHistory: () => void;
  setTableSort: (field: string | null, order: 'asc' | 'desc' | null) => void;
  setVisibleColumns: (columns: string[]) => void;
  setColumnWidth: (field: string, width: number) => void;
  getFilteredData: () => Record<string, any>[];
  getSortedData: () => Record<string, any>[];
  getAggregatedData: () => { x: string[], series: { name: string, data: number[], chartType?: string }[] };
  getPivotTableData: () => PivotTableData | null;
  exportToExcel: () => void;
  saveProject: () => string;
  loadProject: (json: string) => void;
  setDrillPath: (path: string[]) => void;
  drillDown: (xValue: string) => void;
  drillUp: () => void;
  addWeComBot: (bot: Omit<WeComBot, 'id' | 'createdAt'>) => void;
  removeWeComBot: (id: string) => void;
  updateWeComBot: (id: string, bot: Partial<WeComBot>) => void;
}

// 计算字段公式求值（支持聚合函数语法、逻辑运算、三元表达式）
function evaluateFormula(formula: string, row: Record<string, any>): any {
  try {
    let expr = formula;
    const allKeys = Object.keys(row);

    // 替换字段引用为实际值
    allKeys.forEach((key) => {
      const val = row[key];
      // 字符串值需要加引号并转义
      if (typeof val === 'string') {
        const safeStr = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), `'${safeStr}'`);
      } else if (typeof val === 'number') {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
      } else if (typeof val === 'boolean') {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
      } else {
        // null / undefined → 0
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), '0');
      }
    });

    // 处理聚合函数（行级计算场景下透传）
    // SUM(x) → x
    expr = expr.replace(/SUM\s*\(([^)]+)\)/gi, '($1)');
    // AVG(x) → x
    expr = expr.replace(/AVG\s*\(([^)]+)\)/gi, '($1)');
    // COUNT(x) → x 非空则为 1，否则 0
    expr = expr.replace(/COUNT\s*\(([^)]+)\)/gi, '(($1) !== undefined && ($1) !== null && ($1) !== "" ? 1 : 0)');
    // DISTINCTCOUNT(x) → 行级同 COUNT
    expr = expr.replace(/DISTINCTCOUNT\s*\(([^)]+)\)/gi, '(($1) !== undefined && ($1) !== null && ($1) !== "" ? 1 : 0)');

    // 安全检查：拒绝危险模式
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /new\s+Function/i,
      /document\./i,
      /window\./i,
      /globalThis/i,
      /process\./i,
      /require\s*\(/i,
      /import\s*\(/i,
      /fetch\s*\(/i,
      /XMLHttpRequest/i,
      /<script/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(expr)) {
        console.warn('[evaluateFormula] Dangerous pattern rejected:', formula);
        return 0;
      }
    }

    // 字符白名单检查（允许数字、运算符、括号、空格、点、字符串、三元、逻辑等）
    const allowedExpr = /^[0-9+\-*/().<>=!&|?:'"\s\w_,]+$/;
    if (!allowedExpr.test(expr)) {
      console.warn('[evaluateFormula] Invalid characters in expression:', expr);
      return 0;
    }

    const result = new Function(`return (${expr})`)();
    if (typeof result === 'number' && isNaN(result)) return 0;
    return result ?? 0;
  } catch (e) {
console.warn('[evaluateFormula] Evaluation error:', formula, e);
    return 0;
  }
}

// 初始化：从 localStorage 加载（放在前面避免引用错误）
const loadFromStorage = (key: string) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const useDataStore = create<DataState>((set, get) => ({
  rawData: [],
  fields: [],
  xAxis: null,
  yAxis: [],
  rowDimensions: [],
  columnDimension: null,
  dateFilter: null,
  filters: [],
  chartType: 'bar',
  templates: [],
  fileName: null,
  computedFields: [],
  filterPresets: [],
  alertRules: [],
  history: [],
  tableConfig: {
    sortField: null,
    sortOrder: null,
    visibleColumns: [],
    columnWidths: {},
  },
  drillPath: [],
  weComBots: loadFromStorage('dashboard_wecom_bots'),

  setRawData: (data, fields, fileName) => {
    const state = get();
    // 应用计算字段到数据中
    let processedData = data;
    if (state.computedFields.length > 0) {
      processedData = data.map((row) => {
        const newRow = { ...row };
        state.computedFields.forEach((cf) => {
          newRow[cf.name] = evaluateFormula(cf.formula, row);
        });
        return newRow;
      });
    }
    // 将计算字段加入 fields
    const allFields = [...fields, ...state.computedFields.map((cf) => ({
      name: cf.name,
      label: cf.label,
      type: cf.type as FieldType,
    }))];
    set({
      rawData: processedData,
      fields: allFields,
      fileName,
      tableConfig: {
        sortField: null,
        sortOrder: null,
        visibleColumns: allFields.map((f) => f.name),
        columnWidths: {},
      },
    });
    get().addHistory('导入数据');
  },

  clearData: () => set({
    rawData: [],
    fields: [],
    xAxis: null,
    yAxis: [],
    rowDimensions: [],
    columnDimension: null,
    dateFilter: null,
    filters: [],
    chartType: 'bar',
    fileName: null,
    computedFields: [],
    tableConfig: {
      sortField: null,
      sortOrder: null,
      visibleColumns: [],
      columnWidths: {},
    },
    drillPath: [],
  }),

  setXAxis: (item) => {
    set({ xAxis: item });
    get().addHistory('设置X轴: ' + (item?.label || ''));
  },

  setYAxis: (items) => {
    set({ yAxis: items });
    get().addHistory('设置Y轴');
  },

  addRowDimension: (item) => set((state) => {
    // 如果已经存在，先移除再添加到末尾（调整顺序）
    const filtered = state.rowDimensions.filter((r) => r.field !== item.field);
    // 同时同步更新 xAxis 为第一个行维度
    const newRowDims = [...filtered, item];
    return {
      rowDimensions: newRowDims,
      xAxis: newRowDims[0] || null,
    };
  }),

  removeRowDimension: (field) => set((state) => {
    const newRowDims = state.rowDimensions.filter((r) => r.field !== field);
    return {
      rowDimensions: newRowDims,
      xAxis: newRowDims[0] || null,
    };
  }),

  setColumnDimension: (item) => {
    set({ columnDimension: item });
    get().addHistory('设置列维度: ' + (item?.label || ''));
  },

  setDateFilter: (filter) => {
    set({ dateFilter: filter });
    get().addHistory('设置日期筛选: ' + (filter?.label || ''));
  },

  updateDateFilterRange: (start, end) => {
    set((state) => ({
      dateFilter: state.dateFilter
        ? { ...state.dateFilter, start, end }
        : null,
    }));
  },

  addYAxisItem: (item) => set((state) => ({
    yAxis: [...state.yAxis.filter((y) => y.field !== item.field), item],
  })),

  removeYAxisItem: (field) => set((state) => ({
    yAxis: state.yAxis.filter((y) => y.field !== field),
  })),

  updateYAxisAggregation: (field, aggregation) => set((state) => ({
    yAxis: state.yAxis.map((y) =>
      y.field === field ? { ...y, aggregation } : y
    ),
  })),

  setFilters: (filters) => set({ filters }),

  addFilter: (filter) => set((state) => ({
    filters: [...state.filters.filter((f) => f.field !== filter.field), filter],
  })),

  removeFilter: (field) => set((state) => ({
    filters: state.filters.filter((f) => f.field !== field),
  })),

  setChartType: (type) => {
    set({ chartType: type });
    get().addHistory('切换图表: ' + type);
  },

  saveTemplate: (name) => {
    const state = get();
    const template: Template = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      rowDimensions: state.rowDimensions,
      columnDimension: state.columnDimension,
      filters: state.filters,
      chartType: state.chartType,
      fields: state.fields,
    };
    set((s) => ({ templates: [...s.templates, template] }));
    const allTemplates = [...state.templates, template];
    localStorage.setItem('dashboard_templates', JSON.stringify(allTemplates));
    get().addHistory('保存模板: ' + name);
    return template;
  },

  loadTemplate: (template) => {
    set({
      xAxis: template.xAxis,
      yAxis: template.yAxis,
      rowDimensions: template.rowDimensions || [],
      columnDimension: template.columnDimension || null,
      filters: template.filters,
      chartType: template.chartType,
    });
    get().addHistory('加载模板: ' + template.name);
  },

  deleteTemplate: (id) => {
    const state = get();
    const newTemplates = state.templates.filter((t) => t.id !== id);
    set({ templates: newTemplates });
    localStorage.setItem('dashboard_templates', JSON.stringify(newTemplates));
  },

  addComputedField: (field) => {
    set((state) => {
      const exists = state.computedFields.find((f) => f.name === field.name);
      if (exists) {
        return { computedFields: state.computedFields.map((f) => (f.name === field.name ? field : f)) };
      }
      return { computedFields: [...state.computedFields, field] };
    });
    // 重新计算数据
    const state = get();
    if (state.rawData.length > 0) {
      const processedData = state.rawData.map((row) => {
        const newRow = { ...row };
        state.computedFields.forEach((cf) => {
          newRow[cf.name] = evaluateFormula(cf.formula, row);
        });
        return newRow;
      });
      const allFields = [...state.fields.filter((f) => !state.computedFields.some((cf) => cf.name === f.name)),
        ...state.computedFields.map((cf) => ({ name: cf.name, label: cf.label, type: cf.type as FieldType })),
      ];
      set({ rawData: processedData, fields: allFields });
    }
    get().addHistory('添加计算字段: ' + field.label);
  },

  removeComputedField: (name) => {
    set((state) => ({
      computedFields: state.computedFields.filter((f) => f.name !== name),
      fields: state.fields.filter((f) => f.name !== name),
    }));
    get().addHistory('删除计算字段: ' + name);
  },

  joinData: (secondaryData, secondaryFields, joinField, prefix) => {
    const state = get();
    if (state.rawData.length === 0) return;

    // 为从表字段加前缀，避免冲突
    const prefixedFields = secondaryFields.map((f) => ({
      ...f,
      name: prefix ? `${prefix}_${f.name}` : f.name,
      label: prefix ? `${prefix}_${f.label}` : f.label,
    }));

    // 构建从表索引：joinField -> 行数组（支持一对多）
    const secondaryIndex: Record<string, Record<string, any>[]> = {};
    secondaryData.forEach((row) => {
      const key = String(row[joinField] ?? '');
      if (!secondaryIndex[key]) secondaryIndex[key] = [];
      secondaryIndex[key].push(row);
    });

    // 执行左连接：主表每行匹配从表第一行
    const joinedData = state.rawData.map((mainRow) => {
      const key = String(mainRow[joinField] ?? '');
      const matches = secondaryIndex[key];
      const matchedRow = matches && matches.length > 0 ? matches[0] : {};

      const newRow = { ...mainRow };
      prefixedFields.forEach((f) => {
        const originalName = f.name.replace(new RegExp(`^${prefix}_`), '');
        newRow[f.name] = matchedRow[originalName] ?? null;
      });
      return newRow;
    });

    // 合并字段列表（去重）
    const existingNames = new Set(state.fields.map((f) => f.name));
    const newFields = [...state.fields];
    prefixedFields.forEach((f) => {
      if (!existingNames.has(f.name)) {
        newFields.push(f);
        existingNames.add(f.name);
      }
    });

    set({
      rawData: joinedData,
      fields: newFields,
    });

    message.success(`数据关联完成：共关联 ${secondaryData.length} 条记录，新增 ${prefixedFields.length} 个字段`);
    get().addHistory(`关联数据: 按 ${joinField} 关联，新增 ${prefixedFields.length} 个字段`);
  },

  getAllFields: () => {
    const state = get();
    return state.fields;
  },

  saveFilterPreset: (name) => {
    const state = get();
    const preset: FilterPreset = {
      id: Date.now().toString(),
      name,
      filters: state.filters,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ filterPresets: [...s.filterPresets, preset] }));
    const allPresets = [...state.filterPresets, preset];
    localStorage.setItem('dashboard_filter_presets', JSON.stringify(allPresets));
    get().addHistory('保存筛选: ' + name);
  },

  loadFilterPreset: (preset) => {
    set({ filters: preset.filters });
    get().addHistory('加载筛选: ' + preset.name);
  },

  deleteFilterPreset: (id) => {
    const state = get();
    const newPresets = state.filterPresets.filter((p) => p.id !== id);
    set({ filterPresets: newPresets });
    localStorage.setItem('dashboard_filter_presets', JSON.stringify(newPresets));
  },

  addAlertRule: (rule) => {
    set((state) => {
      const exists = state.alertRules.find((r) => r.id === rule.id);
      if (exists) {
        return { alertRules: state.alertRules.map((r) => (r.id === rule.id ? rule : r)) };
      }
      return { alertRules: [...state.alertRules, rule] };
    });
    get().addHistory('添加预警: ' + rule.label);
  },

  removeAlertRule: (id) => {
    set((state) => ({ alertRules: state.alertRules.filter((r) => r.id !== id) }));
  },

  checkAlerts: (data) => {
    const state = get();
    const alerts: { row: Record<string, any>; rules: AlertRule[] }[] = [];
    data.forEach((row) => {
      const matched = state.alertRules.filter((rule) => {
        const value = Number(row[rule.field]) || 0;
        switch (rule.operator) {
          case 'gt': return value > rule.threshold;
          case 'lt': return value < rule.threshold;
          case 'gte': return value >= rule.threshold;
          case 'lte': return value <= rule.threshold;
          case 'eq': return value === rule.threshold;
          default: return false;
        }
      });
      if (matched.length > 0) {
        alerts.push({ row, rules: matched });
      }
    });
    return alerts;
  },

  addHistory: (action) => {
    const state = get();
    const record: HistoryRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      rowDimensions: state.rowDimensions,
      columnDimension: state.columnDimension,
      filters: state.filters,
      chartType: state.chartType,
      action,
    };
    set((s) => ({ history: [record, ...s.history].slice(0, 50) }));
  },

  clearHistory: () => set({ history: [] }),

  setTableSort: (field, order) => {
    set((state) => ({
      tableConfig: { ...state.tableConfig, sortField: field, sortOrder: order },
    }));
  },

  setVisibleColumns: (columns) => {
    set((state) => ({
      tableConfig: { ...state.tableConfig, visibleColumns: columns },
    }));
  },

  setColumnWidth: (field, width) => {
    set((state) => ({
      tableConfig: { ...state.tableConfig, columnWidths: { ...state.tableConfig.columnWidths, [field]: width } },
    }));
  },

  getFilteredData: () => {
    const { rawData, filters, dateFilter } = get();

    let result = rawData;

    // 日期筛选器
    if (dateFilter && dateFilter.start && dateFilter.end) {
      result = result.filter((row) => {
        const val = row[dateFilter.field];
        if (!val) return false;
        const dateStr = String(val).slice(0, 10); // 取前10字符 YYYY-MM-DD
        return dateStr >= dateFilter.start && dateStr <= dateFilter.end;
      });
    }

    // 普通筛选条件
    if (filters.length === 0) return result;

    return result.filter((row) => {
      return filters.every((filter) => {
        const value = row[filter.field];
        switch (filter.operator) {
          case 'eq': return value === filter.value;
          case 'neq': return value !== filter.value;
          case 'contains': return String(value).includes(String(filter.value));
          case 'gt': return Number(value) > Number(filter.value);
          case 'lt': return Number(value) < Number(filter.value);
          case 'gte': return Number(value) >= Number(filter.value);
          case 'lte': return Number(value) <= Number(filter.value);
          case 'between': {
            const [min, max] = filter.value;
            return Number(value) >= Number(min) && Number(value) <= Number(max);
          }
          case 'in': return (filter.value as any[]).includes(value);
          default: return true;
        }
      });
    });
  },

  getSortedData: () => {
    const state = get();
    const filtered = state.getFilteredData();
    const { sortField, sortOrder } = state.tableConfig;
    if (!sortField || !sortOrder) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  },

  getAggregatedData: () => {
    const { xAxis, yAxis, columnDimension } = get();
    const filteredData = get().getFilteredData();

    if (!xAxis || yAxis.length === 0) {
      return { x: [], series: [] };
    }

    const drillData = filteredData;

    // 如果没有列维度，使用单维度聚合逻辑
    if (!columnDimension) {
      const grouped: Record<string, Record<string, { sum: number; count: number; max: number; min: number; distinctSet: Set<string> }>> = {};
      drillData.forEach((row) => {
        const xValue = String(row[xAxis.field] ?? '未知');
        if (!grouped[xValue]) grouped[xValue] = {};

        yAxis.forEach((yItem) => {
          const rawValue = row[yItem.field];
          const value = rawValue === undefined || rawValue === null || rawValue === '' ? 0 : Number(rawValue);
          const yField = yItem.field;
          if (!(yField in grouped[xValue])) {
            grouped[xValue][yField] = { sum: 0, count: 0, max: value, min: value, distinctSet: new Set<string>() };
          }

          const agg = yItem.aggregation || 'sum';
          if (agg === 'sum' || agg === 'count') {
            grouped[xValue][yField].sum += value;
            grouped[xValue][yField].count += 1;
          } else if (agg === 'avg') {
            grouped[xValue][yField].sum += value;
            grouped[xValue][yField].count += 1;
          } else if (agg === 'max') {
            grouped[xValue][yField].max = Math.max(grouped[xValue][yField].max, value);
          } else if (agg === 'min') {
            grouped[xValue][yField].min = Math.min(grouped[xValue][yField].min, value);
          } else if (agg === 'distinctCount') {
            grouped[xValue][yField].distinctSet.add(String(rawValue ?? ''));
            grouped[xValue][yField].count += 1;
          }
        });
      });

      const xLabels = Object.keys(grouped).sort();
      const series = yAxis.map((yItem) => {
        const agg = yItem.aggregation || 'sum';
        let data: number[];
        if (agg === 'avg') {
          data = xLabels.map((x) => {
            const g = grouped[x][yItem.field];
            return g && g.count > 0 ? g.sum / g.count : 0;
          });
        } else if (agg === 'max') {
          data = xLabels.map((x) => grouped[x][yItem.field]?.max || 0);
        } else if (agg === 'min') {
          data = xLabels.map((x) => grouped[x][yItem.field]?.min || 0);
        } else if (agg === 'distinctCount') {
          data = xLabels.map((x) => grouped[x][yItem.field]?.distinctSet.size || 0);
        } else {
          data = xLabels.map((x) => grouped[x][yItem.field]?.sum || 0);
        }
        return {
          name: yItem.label,
          data,
          chartType: yItem.chartType,
        };
      });

      return { x: xLabels, series };
    }

    // 有列维度：按 X轴 + 列维度 交叉分组
    const grouped: Record<string, Record<string, Record<string, { sum: number; count: number; max: number; min: number; distinctSet: Set<string> }>>> = {};
    const allColValues = new Set<string>();

    drillData.forEach((row) => {
      const xValue = String(row[xAxis.field] ?? '未知');
      const colValue = String(row[columnDimension.field] ?? '未知');
      allColValues.add(colValue);

      if (!grouped[xValue]) grouped[xValue] = {};
      if (!grouped[xValue][colValue]) grouped[xValue][colValue] = {};

      yAxis.forEach((yItem) => {
        const rawValue = row[yItem.field];
        const value = rawValue === undefined || rawValue === null || rawValue === '' ? 0 : Number(rawValue);
        const yField = yItem.field;
        if (!(yField in grouped[xValue][colValue])) {
          grouped[xValue][colValue][yField] = { sum: 0, count: 0, max: value, min: value, distinctSet: new Set<string>() };
        }

        const agg = yItem.aggregation || 'sum';
        if (agg === 'sum' || agg === 'count') {
          grouped[xValue][colValue][yField].sum += value;
          grouped[xValue][colValue][yField].count += 1;
        } else if (agg === 'avg') {
          grouped[xValue][colValue][yField].sum += value;
          grouped[xValue][colValue][yField].count += 1;
        } else if (agg === 'max') {
          grouped[xValue][colValue][yField].max = Math.max(grouped[xValue][colValue][yField].max, value);
        } else if (agg === 'min') {
          grouped[xValue][colValue][yField].min = Math.min(grouped[xValue][colValue][yField].min, value);
        } else if (agg === 'distinctCount') {
          grouped[xValue][colValue][yField].distinctSet.add(String(rawValue ?? ''));
          grouped[xValue][colValue][yField].count += 1;
        }
      });
    });

    const xLabels = Object.keys(grouped).sort();
    const colValues = Array.from(allColValues).sort();

    const series: { name: string; data: number[]; chartType?: string }[] = [];

    colValues.forEach((cv) => {
      yAxis.forEach((yItem) => {
        const agg = yItem.aggregation || 'sum';
        let data: number[];
        if (agg === 'avg') {
          data = xLabels.map((x) => {
            const g = grouped[x]?.[cv]?.[yItem.field];
            return g && g.count > 0 ? g.sum / g.count : 0;
          });
        } else if (agg === 'max') {
          data = xLabels.map((x) => grouped[x]?.[cv]?.[yItem.field]?.max || 0);
        } else if (agg === 'min') {
          data = xLabels.map((x) => grouped[x]?.[cv]?.[yItem.field]?.min || 0);
        } else if (agg === 'distinctCount') {
          data = xLabels.map((x) => grouped[x]?.[cv]?.[yItem.field]?.distinctSet.size || 0);
        } else {
          data = xLabels.map((x) => grouped[x]?.[cv]?.[yItem.field]?.sum || 0);
        }

        const name = yAxis.length === 1 ? cv : `${cv} · ${yItem.label}`;
        series.push({
          name,
          data,
          chartType: yItem.chartType,
        });
      });
    });

    return { x: xLabels, series };
  },

  getPivotTableData: () => {
    const { rowDimensions, columnDimension, yAxis } = get();
    const filteredData = get().getFilteredData();

    if (rowDimensions.length === 0 || yAxis.length === 0) {
      return null;
    }

    // 构建行键（多维度组合）
    const getRowKey = (row: Record<string, any>) => {
      return rowDimensions.map((dim) => String(row[dim.field] ?? '未知')).join(' | ');
    };

    // 构建列键
    const getColKey = (row: Record<string, any>) => {
      if (!columnDimension) return '__TOTAL__';
      return String(row[columnDimension.field] ?? '未知');
    };

    // 分组聚合：rowKey -> colKey -> yField -> { sum, count, distinctSet }
    const grouped: Record<string, Record<string, Record<string, { sum: number; count: number; distinctSet: Set<string> }>>> = {};
    const allRowKeys = new Set<string>();
    const allColKeys = new Set<string>();

    filteredData.forEach((row) => {
      const rowKey = getRowKey(row);
      const colKey = getColKey(row);
      allRowKeys.add(rowKey);
      allColKeys.add(colKey);

      if (!grouped[rowKey]) grouped[rowKey] = {};
      if (!grouped[rowKey][colKey]) grouped[rowKey][colKey] = {};

      yAxis.forEach((yItem) => {
        const yField = yItem.field;
        if (!grouped[rowKey][colKey][yField]) {
          grouped[rowKey][colKey][yField] = { sum: 0, count: 0, distinctSet: new Set<string>() };
        }

        const rawValue = row[yItem.field];
        const value = rawValue === undefined || rawValue === null || rawValue === '' ? 0 : Number(rawValue);
        const agg = yItem.aggregation || 'sum';

        if (agg === 'avg') {
          grouped[rowKey][colKey][yField].sum += value;
          grouped[rowKey][colKey][yField].count += 1;
        } else if (agg === 'distinctCount') {
          grouped[rowKey][colKey][yField].distinctSet.add(String(rawValue ?? ''));
          grouped[rowKey][colKey][yField].count += 1;
        } else {
          grouped[rowKey][colKey][yField].sum += value;
          grouped[rowKey][colKey][yField].count += 1;
        }
      });
    });

    const rowHeaders = Array.from(allRowKeys).sort();
    const colHeaders = Array.from(allColKeys).sort();

    // 构建数据矩阵：rowKey -> colKey -> yField -> value
    const data: Record<string, Record<string, Record<string, number>>> = {};
    const rowTotals: Record<string, Record<string, number>> = {};
    const colTotals: Record<string, Record<string, number>> = {};
    const grandTotals: Record<string, number> = {};

    // 初始化 grandTotals（用 label 作为 key，与 valueLabels 保持一致）
    yAxis.forEach((yItem) => { grandTotals[yItem.label] = 0; });

    rowHeaders.forEach((rk) => {
      data[rk] = {};
      rowTotals[rk] = {};
      yAxis.forEach((yItem) => { rowTotals[rk][yItem.label] = 0; });

      colHeaders.forEach((ck) => {
        data[rk][ck] = {};
        if (!colTotals[ck]) colTotals[ck] = {};

        yAxis.forEach((yItem) => {
          const yField = yItem.field;       // grouped 内部用 field
          const yLabel = yItem.label;       // data 输出用 label
          if (!(yLabel in colTotals[ck])) colTotals[ck][yLabel] = 0;

          const g = grouped[rk]?.[ck]?.[yField];
          const agg = yItem.aggregation || 'sum';
          let val = 0;
          if (g) {
            if (agg === 'avg' && g.count > 0) {
              val = g.sum / g.count;
            } else if (agg === 'distinctCount') {
              val = g.distinctSet.size;
            } else {
              val = g.sum;
            }
          }
          data[rk][ck][yLabel] = val;
          rowTotals[rk][yLabel] += val;
          colTotals[ck][yLabel] += val;
          grandTotals[yLabel] += val;
        });
      });
    });

    return {
      rowHeaders,
      colHeaders,
      rowDimensionLabels: rowDimensions.map((d) => d.label),
      colDimensionLabel: columnDimension?.label || '合计',
      valueLabels: yAxis.map((y) => y.label),
      data,
      totals: { rowTotals, colTotals, grandTotals },
    };
  },

  exportToExcel: () => {
    const state = get();
    const data = state.getSortedData();
    if (data.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '数据');
    XLSX.writeFile(wb, `导出数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  saveProject: () => {
    const state = get();
    const project = {
      fields: state.fields,
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      rowDimensions: state.rowDimensions,
      columnDimension: state.columnDimension,
      filters: state.filters,
      chartType: state.chartType,
      computedFields: state.computedFields,
      alertRules: state.alertRules,
      tableConfig: state.tableConfig,
      version: '2.0',
    };
    return JSON.stringify(project, null, 2);
  },

  loadProject: (json) => {
    try {
      const project = JSON.parse(json);
      set({
        xAxis: project.xAxis || null,
        yAxis: project.yAxis || [],
        rowDimensions: project.rowDimensions || [],
        columnDimension: project.columnDimension || null,
        filters: project.filters || [],
        chartType: project.chartType || 'bar',
        computedFields: project.computedFields || [],
        alertRules: project.alertRules || [],
        tableConfig: project.tableConfig || { sortField: null, sortOrder: null, visibleColumns: [], columnWidths: {} },
      });
      get().addHistory('加载项目');
    } catch {
      console.error('项目文件解析失败');
    }
  },

  setDrillPath: (path) => set({ drillPath: path }),

  drillDown: (xValue) => {
    set((state) => ({ drillPath: [...state.drillPath, xValue] }));
    get().addHistory('下钻: ' + xValue);
  },

  drillUp: () => {
    set((state) => ({ drillPath: state.drillPath.slice(0, -1) }));
    get().addHistory('上钻');
  },

  addWeComBot: (bot) => {
    const newBot: WeComBot = {
      ...bot,
      id: `bot_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const bots = [...state.weComBots, newBot];
      localStorage.setItem('dashboard_wecom_bots', JSON.stringify(bots));
      return { weComBots: bots };
    });
  },

  removeWeComBot: (id) => {
    set((state) => {
      const bots = state.weComBots.filter((b) => b.id !== id);
      localStorage.setItem('dashboard_wecom_bots', JSON.stringify(bots));
      return { weComBots: bots };
    });
  },

  updateWeComBot: (id, bot) => {
    set((state) => {
      const bots = state.weComBots.map((b) =>
        b.id === id ? { ...b, ...bot } : b
      );
      localStorage.setItem('dashboard_wecom_bots', JSON.stringify(bots));
      return { weComBots: bots };
    });
  },
}));

export const initStorage = () => {
  useDataStore.setState({
    templates: loadFromStorage('dashboard_templates'),
    filterPresets: loadFromStorage('dashboard_filter_presets'),
    weComBots: loadFromStorage('dashboard_wecom_bots'),
  });
};

// 调试用：将状态暴露到 window
(window as any).__zStore = useDataStore;
