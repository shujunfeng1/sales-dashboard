import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { useDataStore } from '../stores/useDataStore';
import { getDefaultChartOption, CHART_TYPES } from '../utils/chartConfig';
import { ChartType, AlertRule } from '../stores/useDataStore';
import { Breadcrumb, Button, Tag, message, Card, Statistic, Row, Col, Divider } from 'antd';
import {
  ArrowUpOutlined, CameraOutlined, AlertOutlined,
  BarChartOutlined,
  TrophyOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { formatWan } from '../utils/chartConfig';
import './ChartView.css';

interface ChartViewProps {
  title?: string;
  chartRefCallback?: (getDataURL: (opts?: echarts.EChartsOption) => string | undefined) => void;
}

export const ChartView: React.FC<ChartViewProps> = ({ title, chartRefCallback }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const {
    rawData,
    xAxis,
    yAxis,
    columnDimension,
    chartType,
    setChartType,
    getAggregatedData,
    drillPath,
    drillDown,
    drillUp,
    alertRules,
    getFilteredData,
    filters,
    dateFilter,
  } = useDataStore();

  const aggregated = useMemo(() => {
    if (!xAxis || yAxis.length === 0) return { x: [], series: [] };
    return getAggregatedData();
  }, [rawData, xAxis, yAxis, columnDimension, filters, dateFilter, getAggregatedData]);

  // 检查预警
  const alerts = useMemo(() => {
    if (alertRules.length === 0 || !xAxis) return [];
    const data = getFilteredData();
    const alertMap = new Map<string, AlertRule[]>();
    data.forEach((row) => {
      const xVal = String(row[xAxis!.field] ?? '未知');
      const matched = alertRules.filter((rule) => {
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
        const existing = alertMap.get(xVal) || [];
        alertMap.set(xVal, [...existing, ...matched]);
      }
    });
    return Array.from(alertMap.entries());
  }, [alertRules, rawData, xAxis, filters, dateFilter, getFilteredData]);

  // KPI 指标计算
  const kpiData = useMemo(() => {
    if (!aggregated || !aggregated.series.length || aggregated.x.length === 0) return null;

    const series = aggregated.series[0]; // 取第一个指标
    const values = series.data;
    const total = values.reduce((sum, v) => sum + (v || 0), 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const maxIdx = values.indexOf(max);
    const minIdx = values.indexOf(min);

    // 计算方差和标准差
    const variance = values.reduce((sum, v) => sum + Math.pow((v || 0) - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 头部集中度（Top3 占比）
    const sorted = [...values].sort((a, b) => b - a);
    const top3Sum = sorted.slice(0, 3).reduce((s, v) => s + v, 0);
    const concentration = total > 0 ? (top3Sum / total) * 100 : 0;

    return {
      total,
      avg,
      max,
      min,
      maxName: aggregated.x[maxIdx] || '',
      minName: aggregated.x[minIdx] || '',
      count: values.length,
      stdDev,
      concentration,
      seriesName: series.name,
    };
  }, [aggregated]);

  // 图表洞察
  const chartInsights = useMemo(() => {
    if (!kpiData) return [];
    const insights: string[] = [];

    insights.push(
      `总${kpiData.seriesName}为 ${formatWan(kpiData.total)}，共 ${kpiData.count} 个分组，平均每个分组 ${formatWan(kpiData.avg)}。`
    );

    insights.push(
      `「${kpiData.maxName}」表现最佳，达到 ${formatWan(kpiData.max)}，是平均值的 ${kpiData.avg > 0 ? (kpiData.max / kpiData.avg).toFixed(1) : 0} 倍。`
    );

    if (kpiData.concentration > 50) {
      insights.push(
        `头部 3 个分组贡献了 ${kpiData.concentration.toFixed(1)}% 的总量，集中度较高，建议关注长尾提升。`
      );
    } else {
      insights.push(
        `数据分布相对均匀，头部 3 个分组仅占 ${kpiData.concentration.toFixed(1)}%，各分组均有贡献。`
      );
    }

    if (kpiData.stdDev > kpiData.avg * 0.5) {
      insights.push('组间差异较大，建议深入分析高/低分组差异原因。');
    }

    return insights;
  }, [kpiData]);

  // 初始化和更新图表
  useEffect(() => {
    if (chartType === 'table' || !xAxis || yAxis.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    if (aggregated.x.length === 0 || aggregated.series.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.clear();
      }
      return;
    }

    if (!chartInstance.current && chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current);
      chartInstance.current.on('click', (params: any) => {
        if (params.componentType === 'series' && params.name) {
          drillDown(params.name);
        }
      });
      // 通知父组件图表已就绪，可用于导出
      if (chartRefCallback) {
        chartRefCallback(() => {
          if (!chartInstance.current) return undefined;
          return chartInstance.current.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#fff',
          });
        });
      }
    }

    if (chartInstance.current) {
      const option = getDefaultChartOption(
        chartType,
        title || xAxis.label,
        xAxis.label,
        aggregated.series.map((s) => s.name),
        aggregated.x,
        aggregated.series
      );

      if (option) {
        chartInstance.current.setOption(option, true);
      }
    }
  }, [aggregated, chartType, xAxis, yAxis, title, drillDown]);

  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  const handleExportImage = useCallback(() => {
    if (!chartInstance.current) return;
    const url = chartInstance.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
    const link = document.createElement('a');
    link.download = `图表_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = url;
    link.click();
    message.success('图表已导出');
  }, []);

  const handleDrillUp = useCallback(() => {
    drillUp();
  }, [drillUp]);

  if (rawData.length === 0) {
    return (
      <div className="chart-view empty">
        <p>暂无数据</p>
        <p className="hint">请先导入 Excel 文件并配置图表维度</p>
      </div>
    );
  }

  if (!xAxis || yAxis.length === 0) {
    return (
      <div className="chart-view empty">
        <p>请先拖拽字段到 X 轴和 Y 轴</p>
        <p className="hint">字段配置完成后将自动生成图表</p>
      </div>
    );
  }

  return (
    <div className="chart-view">
      {/* KPI 指标卡 */}
      {kpiData && (
        <div className="kpi-cards">
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" className="kpi-card kpi-primary">
                <Statistic
                  title="总计"
                  value={formatWan(kpiData.total)}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#4a7dff', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" className="kpi-card">
                <Statistic
                  title="平均值"
                  value={formatWan(kpiData.avg)}
                  prefix={<InfoCircleOutlined />}
                  valueStyle={{ color: '#666', fontSize: 18 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" className="kpi-card">
                <Statistic
                  title="最大值"
                  value={formatWan(kpiData.max)}
                  prefix={<TrophyOutlined style={{ color: '#f59e0b' }} />}
                  valueStyle={{ color: '#f59e0b', fontSize: 18 }}
                />
                <div className="kpi-sub">{kpiData.maxName}</div>
              </Card>
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" className="kpi-card">
                <Statistic
                  title="分组数"
                  value={kpiData.count}
                  suffix="个"
                  valueStyle={{ color: '#666', fontSize: 18 }}
                />
                <div className="kpi-sub">
                  头部集中度 {kpiData.concentration.toFixed(1)}%
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* 图表卡片 */}
      <div className="chart-card">
        {/* 卡片头部 */}
        <div className="chart-card-header">
          <div className="chart-card-title">
            <span className="chart-card-badge">图表分析</span>
            <span className="chart-card-name">{title || xAxis.label}</span>
          </div>
          <div className="chart-card-actions">
            {drillPath.length > 0 && (
              <Button size="small" icon={<ArrowUpOutlined />} onClick={handleDrillUp}>
                上钻
              </Button>
            )}
            <Button size="small" icon={<CameraOutlined />} onClick={handleExportImage}>
              导出图片
            </Button>
          </div>
        </div>

        {/* 下钻路径 */}
        {drillPath.length > 0 && (
          <div className="chart-breadcrumb">
            <Breadcrumb>
              <Breadcrumb.Item>全部</Breadcrumb.Item>
              {drillPath.map((path, idx) => (
                <Breadcrumb.Item key={idx}>{path}</Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </div>
        )}

        {/* 预警提示 */}
        {alerts.length > 0 && (
          <div className="chart-alert-bar">
            <AlertOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
            <span style={{ fontSize: 13, color: '#cf1322' }}>
              发现 {alerts.length} 个异常数据点
            </span>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {alerts.slice(0, 5).map(([xVal, rules], idx) => (
                <Tag key={idx} color="error" style={{ fontSize: 12 }}>
                  {xVal}: {rules.map((r) => `${r.label}${r.operator}${r.threshold}`).join(', ')}
                </Tag>
              ))}
              {alerts.length > 5 && (
                <Tag style={{ fontSize: 12 }}>+{alerts.length - 5} 更多</Tag>
              )}
            </div>
          </div>
        )}

        {/* 图表类型切换 */}
        <div className="chart-type-bar">
          <div className="chart-type-buttons">
            {CHART_TYPES.filter((ct) => ct.type !== 'table').map((ct) => (
              <button
                key={ct.type}
                className={`chart-type-btn ${chartType === ct.type ? 'active' : ''}`}
                onClick={() => setChartType(ct.type as ChartType)}
                title={ct.label}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={chartRef} className="chart-container" />

        {/* 图表洞察 */}
        {chartInsights.length > 0 && (
          <div className="chart-insights">
            <Divider style={{ margin: '12px 0' }} />
            <div className="insights-header">
              <InfoCircleOutlined style={{ color: '#4a7dff' }} />
              <span>数据洞察</span>
            </div>
            <div className="insights-body">
              {chartInsights.map((text, idx) => (
                <div key={idx} className="insight-item">
                  <span className="insight-num">{idx + 1}</span>
                  <span className="insight-text">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
