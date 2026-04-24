import React, { useMemo, useState } from 'react';
import { Table, Select, Radio, Progress, Tag, Card, Space, Typography } from 'antd';
import { TrophyOutlined, FallOutlined, RiseOutlined, PieChartOutlined } from '@ant-design/icons';
import { useDataStore } from '../stores/useDataStore';
import { formatWan } from '../utils/chartConfig';

const { Text } = Typography;

type RankMode = 'top' | 'bottom';

interface RankItem {
  rank: number;
  name: string;
  value: number;
  percent: number;
  cumulativePercent: number;
}

export const RankingInsights: React.FC = () => {
  const { rowDimensions, yAxis, getFilteredData } = useDataStore();

  const [rankMode, setRankMode] = useState<RankMode>('top');
  const [limit, setLimit] = useState<number>(10);
  const [selectedMetricIdx, setSelectedMetricIdx] = useState<number>(0);

  // 按最后一级行维度（最细粒度）聚合数据
  const aggregated = useMemo(() => {
    if (rowDimensions.length === 0 || yAxis.length === 0) return null;

    const filteredData = getFilteredData();
    const lastDim = rowDimensions[rowDimensions.length - 1];
    const yItem = yAxis[selectedMetricIdx];
    if (!yItem) return null;

    const grouped: Record<string, { sum: number; count: number; max: number; min: number; distinctSet: Set<string> }> = {};

    filteredData.forEach((row) => {
      const dimValue = String(row[lastDim.field] ?? '未知');
      const rawValue = row[yItem.field];
      const value = rawValue === undefined || rawValue === null || rawValue === '' ? 0 : Number(rawValue);

      if (!(dimValue in grouped)) {
        grouped[dimValue] = { sum: 0, count: 0, max: value, min: value, distinctSet: new Set<string>() };
      }

      const agg = yItem.aggregation || 'sum';
      if (agg === 'sum' || agg === 'count') {
        grouped[dimValue].sum += value;
        grouped[dimValue].count += 1;
      } else if (agg === 'avg') {
        grouped[dimValue].sum += value;
        grouped[dimValue].count += 1;
      } else if (agg === 'max') {
        grouped[dimValue].max = Math.max(grouped[dimValue].max, value);
      } else if (agg === 'min') {
        grouped[dimValue].min = Math.min(grouped[dimValue].min, value);
      } else if (agg === 'distinctCount') {
        grouped[dimValue].distinctSet.add(String(rawValue ?? ''));
        grouped[dimValue].count += 1;
      }
    });

    // 计算最终值
    const entries = Object.entries(grouped).map(([name, agg]) => {
      const aggregation = yItem.aggregation || 'sum';
      let value = 0;
      if (aggregation === 'sum' || aggregation === 'count') {
        value = agg.sum;
      } else if (aggregation === 'avg') {
        value = agg.count > 0 ? agg.sum / agg.count : 0;
      } else if (aggregation === 'max') {
        value = agg.max;
      } else if (aggregation === 'min') {
        value = agg.min;
      } else if (aggregation === 'distinctCount') {
        value = agg.distinctSet.size;
      }
      return { name, value };
    });

    const total = entries.reduce((sum, e) => sum + e.value, 0);

    return {
      x: entries.map((e) => e.name),
      series: [{
        name: yItem.label,
        data: entries.map((e) => e.value),
      }],
      total,
      entries,
    };
  }, [rowDimensions, yAxis, selectedMetricIdx, getFilteredData]);

  const metricOptions = useMemo(() => {
    return yAxis.map((y, idx) => ({
      value: idx,
      label: `${y.label} (${y.aggregation === 'distinctCount' ? '去重计数' : y.aggregation === 'avg' ? '平均' : y.aggregation === 'count' ? '计数' : y.aggregation === 'max' ? '最大' : y.aggregation === 'min' ? '最小' : '求和'})`,
    }));
  }, [yAxis]);

  const rankData: RankItem[] = useMemo(() => {
    if (!aggregated || !aggregated.entries.length) return [];

    const total = aggregated.total;
    if (total === 0) return [];

    const items: RankItem[] = aggregated.entries.map((e) => ({
      rank: 0,
      name: e.name,
      value: e.value,
      percent: total > 0 ? (e.value / total) * 100 : 0,
      cumulativePercent: 0,
    }));

    // 排序
    items.sort((a, b) => b.value - a.value);

    // 计算累计占比
    let cum = 0;
    items.forEach((item, idx) => {
      item.rank = idx + 1;
      cum += item.percent;
      item.cumulativePercent = cum;
    });

    // TopN / BottomN
    if (rankMode === 'top') {
      return items.slice(0, limit);
    } else {
      return items.slice(-limit).reverse().map((item, idx) => ({
        ...item,
        rank: items.length - limit + idx + 1,
      }));
    }
  }, [aggregated, rankMode, limit]);

  // 智能结论
  const insights = useMemo(() => {
    if (!aggregated || !rankData.length) return [];

    const total = aggregated.total;
    const allValues = aggregated.entries.map((e) => e.value);
    const avg = total / allValues.length;
    const max = rankData[0];

    const conclusions: string[] = [];

    // 头部集中度
    const top5 = rankData.slice(0, Math.min(5, rankData.length));
    const top5Total = top5.reduce((s, i) => s + i.value, 0);
    const top5Percent = total > 0 ? (top5Total / total) * 100 : 0;

    if (rankMode === 'top') {
      conclusions.push(
        `头部 ${top5.length} 个${rowDimensions[rowDimensions.length - 1]?.label || '分组'}贡献了总${yAxis[selectedMetricIdx]?.label || '数值'}的 ${top5Percent.toFixed(1)}%，集中度${top5Percent > 50 ? '较高' : '适中'}。`
      );
      conclusions.push(
        `「${max.name}」以 ${formatWan(max.value)} 排名第一，超出平均值 ${avg > 0 ? ((max.value - avg) / avg * 100).toFixed(0) : 0}%。`
      );
      if (top5Percent > 70) {
        conclusions.push('头部效应明显，建议重点维护头部，同时关注尾部提升空间。');
      }
    } else {
      conclusions.push(
        `尾部 ${rankData.length} 个${rowDimensions[rowDimensions.length - 1]?.label || '分组'}合计仅占总${yAxis[selectedMetricIdx]?.label || '数值'}的 ${(rankData.reduce((s, i) => s + i.percent, 0)).toFixed(1)}%。`
      );
      conclusions.push(
        `「${rankData[0]?.name}」在尾部中排名最前，仍有 ${avg > 0 ? ((avg - (rankData[0]?.value || 0)) / avg * 100).toFixed(0) : 0}% 的提升空间。`
      );
    }

    return conclusions;
  }, [aggregated, rankData, rankMode, rowDimensions, yAxis, selectedMetricIdx]);

  if (rowDimensions.length === 0 || yAxis.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        <PieChartOutlined style={{ fontSize: 32, marginBottom: 12 }} />
        <p>请先配置行维度和数值指标</p>
        <p style={{ fontSize: 13 }}>拖拽字段到「行区域」和「数值区域」后，此处将显示排名与洞察</p>
      </div>
    );
  }

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      align: 'center' as const,
      render: (rank: number) => {
        if (rank <= 3 && rankMode === 'top') {
          const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
          return <Tag color={colors[rank - 1]} style={{ fontWeight: 'bold' }}>#{rank}</Tag>;
        }
        return <span style={{ color: '#888' }}>#{rank}</span>;
      },
    },
    {
      title: rowDimensions[rowDimensions.length - 1]?.label || '分组',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
      align: 'right' as const,
      width: 120,
      render: (val: number) => <strong>{formatWan(val)}</strong>,
    },
    {
      title: '占比',
      dataIndex: 'percent',
      key: 'percent',
      align: 'right' as const,
      width: 100,
      render: (val: number) => `${val.toFixed(1)}%`,
    },
    {
      title: '累计占比',
      dataIndex: 'cumulativePercent',
      key: 'cumulativePercent',
      width: 160,
      render: (val: number) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Text style={{ fontSize: 12 }}>{val.toFixed(1)}%</Text>
          <Progress percent={val} size="small" showInfo={false} strokeColor={val > 80 ? '#52c41a' : '#1890ff'} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* 控制栏 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          value={selectedMetricIdx}
          options={metricOptions}
          onChange={setSelectedMetricIdx}
          style={{ width: 200 }}
          size="small"
        />
        <Radio.Group
          value={rankMode}
          onChange={(e) => setRankMode(e.target.value)}
          size="small"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="top"><TrophyOutlined /> 头部</Radio.Button>
          <Radio.Button value="bottom"><FallOutlined /> 尾部</Radio.Button>
        </Radio.Group>
        <Select
          value={limit}
          options={[
            { value: 5, label: 'Top 5' },
            { value: 10, label: 'Top 10' },
            { value: 20, label: 'Top 20' },
          ]}
          onChange={setLimit}
          size="small"
          style={{ width: 100 }}
        />
      </Space>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 排名表格 */}
        <div style={{ flex: 1 }}>
          <Table
            columns={columns}
            dataSource={rankData}
            pagination={false}
            size="small"
            bordered
            rowKey="rank"
          />
        </div>

        {/* 智能结论 */}
        <Card
          title={<><RiseOutlined /> 智能洞察</>}
          size="small"
          style={{ width: 320, flexShrink: 0 }}
        >
          {insights.length === 0 ? (
            <Text type="secondary">暂无分析结论</Text>
          ) : (
            <Space direction="vertical" size={12}>
              {insights.map((text, idx) => (
                <div key={idx} style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <Text type="secondary" style={{ marginRight: 6 }}>{idx + 1}.</Text>
                  {text}
                </div>
              ))}
            </Space>
          )}
        </Card>
      </div>
    </div>
  );
};
