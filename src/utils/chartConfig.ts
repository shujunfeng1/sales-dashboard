import { ChartType, FieldType } from '../stores/useDataStore';

// 金额格式化：>=1000 按万展示，<1000 保留原样
export function formatWan(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000) {
    const wan = value / 10000;
    // 保留2位小数，但如果末尾是0则去掉
    return wan.toFixed(2).replace(/\.?0+$/, '') + '万';
  }
  return String(value);
}

// 金额 tooltip 格式化
function formatWanTooltip(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000) {
    return (value / 10000).toFixed(2).replace(/\.?0+$/, '') + '万';
  }
  return String(value);
}

// 根据字段类型推荐图表类型
export function recommendChartType(
  xFieldType: FieldType,
  yFieldTypes: FieldType[]
): ChartType {
  const isAllNumber = yFieldTypes.every((t) => t === 'number');

  if (xFieldType === 'date' && isAllNumber) {
    return 'line';
  }

  if (xFieldType === 'string') {
    if (isAllNumber) {
      return 'bar';
    }
    return 'pie';
  }

  if (xFieldType === 'number' && yFieldTypes.length === 1) {
    return 'scatter';
  }

  return 'bar';
}

// 获取图表默认配置
export function getDefaultChartOption(
  chartType: ChartType,
  title: string,
  xAxisLabel: string,
  seriesNames: string[],
  xData: string[],
  seriesData: { name: string; data: number[]; chartType?: string }[]
) {
  const baseOption = {
    title: {
      show: false, // 卡片头部已显示标题
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: {
        type: 'shadow' as const,
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) {
          params = [params];
        }
        let html = `<div style="font-weight:600;margin-bottom:4px;">${params[0].axisValue}</div>`;
        params.forEach((p: any) => {
          const marker = p.marker || '';
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
            ${marker}<span>${p.seriesName}:</span>
            <span style="font-weight:600;">${formatWanTooltip(Number(p.value))}</span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      bottom: 10,
      data: seriesNames,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '8%',
      containLabel: true,
    },
    toolbox: {
      feature: {
        saveAsImage: {
          title: '保存图片',
          pixelRatio: 2,
        },
        dataView: {
          title: '数据视图',
          readOnly: true,
        },
        restore: {
          title: '还原',
        },
      },
      right: 20,
    },
  };

  // Y轴金额格式化配置
  const yAxisWanFormatter = {
    axisLabel: {
      formatter: (value: number) => formatWan(value),
    },
  };

  switch (chartType) {
    case 'bar':
      return {
        ...baseOption,
        xAxis: {
          type: 'category' as const,
          data: xData,
          name: xAxisLabel,
          nameLocation: 'end' as const,
          nameGap: 10,
          axisLabel: {
            rotate: xData.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: 'value' as const,
          name: '数值',
          ...yAxisWanFormatter,
        },
        series: seriesData.map((s) => ({
          name: s.name,
          type: 'bar' as const,
          data: s.data,
          itemStyle: {
            color: getSeriesColor(seriesData.indexOf(s)),
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 40,
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 11,
            color: '#666',
            formatter: (p: any) => formatWan(p.value),
          },
        })),
      };

    case 'line':
      return {
        ...baseOption,
        xAxis: {
          type: 'category' as const,
          data: xData,
          name: xAxisLabel,
          nameLocation: 'end' as const,
          nameGap: 10,
          axisLabel: {
            rotate: xData.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: 'value' as const,
          name: '数值',
          ...yAxisWanFormatter,
        },
        series: seriesData.map((s) => ({
          name: s.name,
          type: 'line' as const,
          data: s.data,
          smooth: true,
          itemStyle: {
            color: getSeriesColor(seriesData.indexOf(s)),
          },
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 11,
            formatter: (p: any) => formatWan(p.value),
          },
        })),
      };

    case 'pie':
      return {
        title: {
          show: false,
        },
        tooltip: {
          trigger: 'item' as const,
          formatter: (p: any) => {
            return `${p.name}: ${formatWanTooltip(p.value)} (${p.percent}%)`;
          },
        },
        legend: {
          bottom: 10,
        },
        toolbox: {
          feature: {
            saveAsImage: { title: '保存图片', pixelRatio: 2 },
          },
          right: 20,
        },
        series: [
          {
            name: seriesNames[0] || '数值',
            type: 'pie' as const,
            radius: ['40%', '70%'],
            data: xData.map((x, i) => ({
              name: x,
              value: seriesData[0]?.data[i] || 0,
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
            label: {
              show: true,
              formatter: (p: any) => `${p.name}: ${formatWan(p.value)}`,
            },
          },
        ],
      };

    case 'area':
      return {
        ...baseOption,
        xAxis: {
          type: 'category' as const,
          data: xData,
          name: xAxisLabel,
          nameLocation: 'end' as const,
          boundaryGap: false,
        },
        yAxis: {
          type: 'value' as const,
          ...yAxisWanFormatter,
        },
        series: seriesData.map((s) => ({
          name: s.name,
          type: 'line' as const,
          data: s.data,
          smooth: true,
          areaStyle: {
            opacity: 0.3,
          },
          itemStyle: {
            color: getSeriesColor(seriesData.indexOf(s)),
          },
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 11,
            formatter: (p: any) => formatWan(p.value),
          },
        })),
      };

    case 'scatter':
      return {
        ...baseOption,
        xAxis: {
          type: 'value' as const,
          name: xAxisLabel,
          nameLocation: 'end' as const,
        },
        yAxis: {
          type: 'value' as const,
          name: seriesNames[0] || 'Y',
          ...yAxisWanFormatter,
        },
        series: [
          {
            type: 'scatter' as const,
            data: xData.map((x, i) => [Number(x), seriesData[0]?.data[i] || 0]),
            symbolSize: 10,
            itemStyle: {
              color: getSeriesColor(0),
            },
          },
        ],
      };

    case 'mixed':
      return {
        ...baseOption,
        xAxis: {
          type: 'category' as const,
          data: xData,
          name: xAxisLabel,
          nameLocation: 'end' as const,
          axisLabel: {
            rotate: xData.length > 10 ? 30 : 0,
          },
        },
        yAxis: [
          {
            type: 'value' as const,
            name: '数值',
            position: 'left',
            ...yAxisWanFormatter,
          },
          {
            type: 'value' as const,
            name: '比率',
            position: 'right',
            axisLabel: {
              formatter: '{value}%',
            },
          },
        ],
        series: seriesData.map((s, idx) => ({
          name: s.name,
          type: (s.chartType || (idx === 0 ? 'bar' : 'line')) as 'bar' | 'line',
          data: s.data,
          yAxisIndex: s.chartType === 'line' ? 1 : 0,
          smooth: true,
          itemStyle: {
            color: getSeriesColor(idx),
          },
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 11,
            formatter: (p: any) => {
              // 如果是比率轴（line），显示百分比
              if (s.chartType === 'line') {
                return p.value + '%';
              }
              return formatWan(p.value);
            },
          },
        })),
      };

    case 'stacked':
      return {
        ...baseOption,
        xAxis: {
          type: 'category' as const,
          data: xData,
          name: xAxisLabel,
          nameLocation: 'end' as const,
          axisLabel: {
            rotate: xData.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: 'value' as const,
          name: '数值',
          ...yAxisWanFormatter,
        },
        series: seriesData.map((s, idx) => ({
          name: s.name,
          type: 'bar' as const,
          stack: 'total',
          data: s.data,
          itemStyle: {
            color: getSeriesColor(idx),
            borderRadius: idx === seriesData.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0],
          },
          label: {
            show: true,
            position: 'inside' as const,
            fontSize: 10,
            color: '#fff',
            formatter: (p: any) => formatWan(p.value),
          },
          emphasis: {
            focus: 'series' as const,
          },
        })),
      };

    case 'heatmap': {
      // 热力图：X 轴 × 系列名 的矩阵
      const heatmapData: [number, number, number][] = [];
      seriesData.forEach((s, yIdx) => {
        s.data.forEach((val, xIdx) => {
          heatmapData.push([xIdx, yIdx, val]);
        });
      });
      return {
        title: {
          show: false,
        },
        tooltip: {
          position: 'top' as const,
          formatter: (params: any) => {
            const x = xData[params.data[0]];
            const y = seriesNames[params.data[1]];
            return `${x}<br/>${y}: ${formatWanTooltip(params.data[2])}`;
          },
        },
        grid: {
          left: '15%',
          right: '10%',
          top: '15%',
          bottom: '15%',
        },
        xAxis: {
          type: 'category' as const,
          data: xData,
          splitArea: { show: true },
          axisLabel: {
            rotate: xData.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: 'category' as const,
          data: seriesNames,
          splitArea: { show: true },
        },
        visualMap: {
          min: Math.min(...heatmapData.map((d) => d[2])),
          max: Math.max(...heatmapData.map((d) => d[2])),
          calculable: true,
          orient: 'horizontal' as const,
          left: 'center',
          bottom: '0%',
          inRange: {
            color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'],
          },
        },
        series: [
          {
            type: 'heatmap' as const,
            data: heatmapData,
            label: {
              show: true,
              fontSize: 10,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      };
    }

    case 'table':
      return null;

    default:
      return getDefaultChartOption('bar', title, xAxisLabel, seriesNames, xData, seriesData);
  }
}

// 获取系列颜色 — 蓝紫青现代配色
function getSeriesColor(index: number): string {
  const colors = [
    '#4a7dff', // 主蓝
    '#8b5cf6', // 紫
    '#06b6d4', // 青
    '#f59e0b', // 琥珀（点缀）
    '#10b981', // 绿
    '#ec4899', // 粉
    '#6366f1', // 靛蓝
    '#14b8a6', //  teal
  ];
  return colors[index % colors.length];
}

// 可用的图表类型列表
export const CHART_TYPES: { type: ChartType; label: string; icon: string }[] = [
  { type: 'bar', label: '柱状图', icon: 'BarChartOutlined' },
  { type: 'line', label: '折线图', icon: 'LineChartOutlined' },
  { type: 'pie', label: '饼图', icon: 'PieChartOutlined' },
  { type: 'area', label: '面积图', icon: 'AreaChartOutlined' },
  { type: 'scatter', label: '散点图', icon: 'DotChartOutlined' },
  { type: 'mixed', label: '组合图', icon: 'MergeCellsOutlined' },
  { type: 'stacked', label: '堆叠图', icon: 'BarsOutlined' },
  { type: 'heatmap', label: '热力图', icon: 'FireOutlined' },
  { type: 'table', label: '数据表', icon: 'TableOutlined' },
];
