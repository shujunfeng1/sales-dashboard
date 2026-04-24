import React, { useState } from 'react';
import {
  Drawer, Button, Input, Form, List, Tag, message,
  Checkbox, Space, Divider, Modal, Popconfirm, Tooltip
} from 'antd';
import {
  RobotOutlined, SendOutlined, DeleteOutlined, EditOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  PictureOutlined, FileExcelOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import CryptoJS from 'crypto-js';
import { useDataStore, WeComBot } from '../stores/useDataStore';
import './WeComPushDrawer.css';

interface WeComPushDrawerProps {
  open: boolean;
  onClose: () => void;
  chartExportFn?: () => string | undefined;
}

// ============================================================
// 辅助函数
// ============================================================

/** 计算 base64 字符串的 MD5（纯 JS 实现，无需 Rust） */
async function calcMd5(base64: string): Promise<string> {
  const wordArray = CryptoJS.enc.Base64.parse(base64);
  return CryptoJS.MD5(wordArray).toString();
}

/** 上传临时素材到企业微信，返回 media_id
 *  说明：文件消息需要调用企业微信上传临时素材接口（multipart/form-data）。
 *  由于需要修改 Rust 后端依赖（暂因网络问题搁置），文件推送功能标记为"开发中"。
 *  图表推送不受影响。
 */
async function uploadMaterial(
  _webhook: string,
  mediaType: 'image' | 'file',
  _filename: string,
  _mimeType: string,
  _content: Uint8Array
): Promise<string> {
  throw new Error(
    `文件上传功能（${mediaType}）正在开发中，暂时无法推送。` +
    `图表推送（图片）已可用，透视表/明细数据请使用「导出Excel」手动发送。`
  );
}

/**
 * 发送企微 JSON 消息
 * 优先走本地服务端 API（/api/wecom-push），绕过浏览器代理限制
 */
async function sendJsonMessage(webhook: string, payload: object): Promise<void> {
  // 走本地 Python 服务端转发，彻底绕过浏览器代理
  const resp = await fetch('/api/wecom-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook, message: payload }),
  });
  const result = await resp.json() as { ok: boolean; error?: string };
  if (!result.ok) {
    throw new Error(result.error || '发送失败');
  }
}

/** 生成 Excel 文件的 Uint8Array */
function generateExcel(
  rows: Record<string, any>[],
  sheetName: string
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

// ============================================================
// 推送内容生成
// ============================================================

/** 生成 Markdown 摘要文字（图表/透视表/明细的简要说明） */
function generatePushSummary(
  dataType: string,
  store: ReturnType<typeof useDataStore.getState>
): string {
  const { fileName, xAxis, yAxis } = store;
  const lines: string[] = [];
  lines.push(`📊 **${fileName || '数据报告'}**`);
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);

  if (dataType === 'chart') {
    lines.push('### 📈 图表已推送');
    lines.push(`**维度：** ${xAxis?.label || ''}`);
    lines.push(`**指标：** ${yAxis.map((y) => y.label).join('、')}`);
  } else if (dataType === 'pivot') {
    lines.push('### 🧮 透视表已推送');
  } else if (dataType === 'table') {
    lines.push('### 📋 明细数据已推送');
  } else if (dataType === 'insights') {
    lines.push('### 🏆 排名洞察已推送');
  }

  lines.push('---');
  lines.push('💡 数据来自「销售数据可视化」看板');
  return lines.join('\n');
}

// ============================================================
// 主组件
// ============================================================

export const WeComPushDrawer: React.FC<WeComPushDrawerProps> = ({
  open,
  onClose,
  chartExportFn,
}) => {
  const { weComBots, addWeComBot, removeWeComBot, updateWeComBot, fileName,
          xAxis, yAxis, rowDimensions, valueFields,
          getAggregatedData, getPivotTableData, getFilteredData } = useDataStore();
  const [editingBot, setEditingBot] = useState<WeComBot | null>(null);
  const [form] = Form.useForm();
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [selectedData, setSelectedData] = useState<string[]>(['chart']);
  const [pushing, setPushing] = useState(false);

  // 推送类型说明（图标化展示）
  const dataOptions = [
    { label: '图表数据', value: 'chart', icon: <PictureOutlined />, desc: '✅ 图片格式', color: '#4a7dff' },
    { label: '透视表', value: 'pivot', icon: <FileExcelOutlined />, desc: '🔧 开发中', color: '#52c41a' },
    { label: '明细数据', value: 'table', icon: <FileExcelOutlined />, desc: '🔧 开发中', color: '#fa8c16' },
    { label: '排名洞察', value: 'insights', icon: <TrophyOutlined />, desc: '文字摘要', color: '#722ed1' },
  ];

  // ============================================================
  // 机器人管理
  // ============================================================
  const handleSaveBot = (values: { name: string; webhook: string }) => {
    if (editingBot) {
      updateWeComBot(editingBot.id, values);
      message.success('机器人已更新');
    } else {
      addWeComBot(values);
      message.success('机器人已添加');
    }
    setEditingBot(null);
    form.resetFields();
  };

  const handleEditBot = (bot: WeComBot) => {
    setEditingBot(bot);
    form.setFieldsValue({ name: bot.name, webhook: bot.webhook });
  };

  const handleCancelEdit = () => {
    setEditingBot(null);
    form.resetFields();
  };

  // ============================================================
  // 推送核心逻辑
  // ============================================================
  const handlePush = async () => {
    if (selectedBots.length === 0) {
      message.warning('请至少选择一个群聊');
      return;
    }
    if (selectedData.length === 0) {
      message.warning('请至少选择一种数据');
      return;
    }

    setPushing(true);
    const store = useDataStore.getState();
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const botId of selectedBots) {
      const bot = weComBots.find((b) => b.id === botId);
      if (!bot) continue;

      try {
        for (const dataType of selectedData) {
          await pushDataByType(bot.webhook, dataType, store);
        }
        results.push({ name: bot.name, success: true });
      } catch (err: any) {
        results.push({ name: bot.name, success: false, error: err.message || '未知错误' });
      }
    }

    setPushing(false);
    setPushModalOpen(false);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (failCount === 0) {
      message.success(`✅ 成功推送到 ${successCount} 个群聊！`);
    } else if (successCount === 0) {
      message.error('❌ 推送失败：' + results.map((r) => `${r.name}: ${r.error}`).join('; '));
    } else {
      message.warning(`⚠️ 成功 ${successCount} 个，失败 ${failCount} 个`);
    }
  };

  /** 按数据类型推送 */
  const pushDataByType = async (
    webhook: string,
    dataType: string,
    store: ReturnType<typeof useDataStore.getState>
  ) => {
    if (dataType === 'chart') {
      await pushChart(webhook, store);
    } else if (dataType === 'pivot') {
      await pushPivot(webhook, store);
    } else if (dataType === 'table') {
      await pushTable(webhook, store);
    } else if (dataType === 'insights') {
      await pushInsights(webhook, store);
    }
  };

  /** 推送图表（图片） */
  const pushChart = async (webhook: string, store: ReturnType<typeof useDataStore.getState>) => {
    const dataURL = chartExportFn ? chartExportFn() : undefined;
    if (!dataURL) {
      // 没有图表时发摘要文字
      await sendJsonMessage(webhook, {
        msgtype: 'markdown',
        markdown: { content: generatePushSummary('chart', store) },
      });
      return;
    }

    // 去掉 data:image/png;base64, 前缀
    const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
    const md5 = await calcMd5(base64);

    // 先发图片
    await sendJsonMessage(webhook, {
      msgtype: 'image',
      image: { base64, md5 },
    });

    // 再发摘要
    await sendJsonMessage(webhook, {
      msgtype: 'markdown',
      markdown: { content: generatePushSummary('chart', store) },
    });
  };

  /** 推送透视表（Excel 文件） */
  const pushPivot = async (webhook: string, store: ReturnType<typeof useDataStore.getState>) => {
    const pivot = store.getPivotTableData();
    if (!pivot || pivot.rowHeaders.length === 0) {
      message.warning('透视表暂无数据，跳过推送');
      return;
    }

    try {
      // 构建 Excel 行（合并行表头）
      const excelRows: Record<string, any>[] = pivot.rowHeaders.map((rowKey, idx) => {
        const row: Record<string, any> = {};
        pivot.rowDimensionLabels.forEach((label, cIdx) => {
          row[label] = rowKey[cIdx] ?? '';
        });
        pivot.valueLabels.forEach((valLabel, cIdx) => {
          const val = pivot.data?.[idx]?.[cIdx];
          row[valLabel] = typeof val === 'number' ? val : (val ?? '');
        });
        return row;
      });

      const filename = `透视表_${store.fileName || new Date().toISOString().slice(0, 10)}.xlsx`;
      const excelBytes = generateExcel(excelRows, '透视表');
      const mediaId = await uploadMaterial(
        webhook, 'file', filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', excelBytes
      );

      await sendJsonMessage(webhook, {
        msgtype: 'file',
        file: { media_id: mediaId },
      });
      await sendJsonMessage(webhook, {
        msgtype: 'markdown',
        markdown: { content: generatePushSummary('pivot', store) },
      });
    } catch (err: any) {
      if (err.message?.includes('正在开发中')) {
        message.warning('透视表文件推送功能开发中，请使用「导出Excel」手动发送');
      } else {
        throw err;
      }
    }
  };

  /** 推送明细数据（Excel 文件） */
  const pushTable = async (webhook: string, store: ReturnType<typeof useDataStore.getState>) => {
    const data = store.getFilteredData();
    if (!data || data.length === 0) {
      message.warning('明细数据暂无数据，跳过推送');
      return;
    }

    try {
      const MAX_ROWS = 10000;
      const rows = data.slice(0, MAX_ROWS);

      const filename = `明细数据_${store.fileName || new Date().toISOString().slice(0, 10)}.xlsx`;
      const excelBytes = generateExcel(rows, '明细数据');
      const mediaId = await uploadMaterial(
        webhook, 'file', filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', excelBytes
      );

      await sendJsonMessage(webhook, {
        msgtype: 'file',
        file: { media_id: mediaId },
      });
      await sendJsonMessage(webhook, {
        msgtype: 'markdown',
        markdown: { content: generatePushSummary('table', store) + `\n> 共 ${data.length.toLocaleString()} 条记录（Excel 文件内）` },
      });
    } catch (err: any) {
      if (err.message?.includes('正在开发中')) {
        message.warning('明细数据文件推送功能开发中，请使用「导出Excel」手动发送');
      } else {
        throw err;
      }
    }
  };

  /** 推送排名洞察（文字摘要） */
  const pushInsights = async (webhook: string, store: ReturnType<typeof useDataStore.getState>) => {
    await sendJsonMessage(webhook, {
      msgtype: 'markdown',
      markdown: { content: generatePushSummary('insights', store) + '\n> 详见看板「排名洞察」页签' },
    });
  };

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <>
      <Drawer
        title={
          <span>
            <RobotOutlined style={{ marginRight: 8 }} />
            企业微信推送
          </span>
        }
        placement="right"
        width={520}
        open={open}
        onClose={onClose}
      >
        {/* 机器人配置 */}
        <div className="wec-section">
          <h4 className="wec-section-title">
            <RobotOutlined /> 机器人配置
          </h4>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveBot}
            className="wec-form"
          >
            <Form.Item
              name="name"
              label="群聊名称"
              rules={[{ required: true, message: '请输入群聊名称' }]}
            >
              <Input placeholder="例如：销售日报群" />
            </Form.Item>
            <Form.Item
              name="webhook"
              label="Webhook 地址"
              rules={[
                { required: true, message: '请输入 Webhook 地址' },
                { pattern: /^https:\/\/qyapi\.weixin\.qq\.com/, message: '请输入正确的企业微信 webhook 地址' },
              ]}
            >
              <Input.TextArea
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                rows={2}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>
                  {editingBot ? '保存修改' : '添加机器人'}
                </Button>
                {editingBot && (
                  <Button onClick={handleCancelEdit}>取消</Button>
                )}
              </Space>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '12px 0' }} />

          {/* 机器人列表 */}
          <List
            size="small"
            dataSource={weComBots}
            locale={{ emptyText: '暂无机器人，请先添加' }}
            renderItem={(bot) => (
              <List.Item
                className="wec-bot-item"
                actions={[
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEditBot(bot)}
                  />,
                  <Popconfirm
                    title="确认删除？"
                    onConfirm={() => {
                      removeWeComBot(bot.id);
                      message.success('已删除');
                    }}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <div className="wec-bot-info">
                  <Tag color="blue">{bot.name}</Tag>
                  <Tooltip title={bot.webhook}>
                    <span className="wec-bot-webhook">{bot.webhook.slice(0, 40)}...</span>
                  </Tooltip>
                </div>
              </List.Item>
            )}
          />
        </div>

        <Divider />

        {/* 推送操作 */}
        <div className="wec-section">
          <h4 className="wec-section-title">
            <SendOutlined /> 推送操作
          </h4>

          {weComBots.length === 0 ? (
            <p className="wec-hint">请先添加至少一个机器人</p>
          ) : (
            <>
              <div className="wec-push-buttons">
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  block
                  onClick={() => {
                    setSelectedBots(weComBots.map((b) => b.id));
                    setPushModalOpen(true);
                  }}
                >
                  推送到全部群聊 ({weComBots.length}个)
                </Button>
                <Button
                  icon={<SendOutlined />}
                  block
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setSelectedBots([]);
                    setPushModalOpen(true);
                  }}
                >
                  选择群聊推送
                </Button>
              </div>
            </>
          )}
        </div>
      </Drawer>

      {/* 推送确认弹窗 */}
      <Modal
        title="选择推送内容"
        open={pushModalOpen}
        onOk={handlePush}
        onCancel={() => setPushModalOpen(false)}
        okText="确认推送"
        cancelText="取消"
        confirmLoading={pushing}
        width={480}
      >
        <div className="wec-push-modal">
          {/* 选择群聊 */}
          <div className="wec-push-group">
            <div className="wec-push-label">选择群聊</div>
            <Checkbox.Group
              value={selectedBots}
              onChange={(vals) => setSelectedBots(vals as string[])}
            >
              <Space direction="vertical">
                {weComBots.map((bot) => (
                  <Checkbox key={bot.id} value={bot.id}>
                    <Tag color="blue">{bot.name}</Tag>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* 选择数据 */}
          <div className="wec-push-group">
            <div className="wec-push-label">选择推送数据</div>
            <Checkbox.Group
              value={selectedData}
              onChange={(vals) => setSelectedData(vals as string[])}
            >
              <Space direction="vertical">
                {dataOptions.map((opt) => (
                  <Checkbox key={opt.value} value={opt.value}>
                    <Space>
                      {opt.icon}
                      <span>{opt.label}</span>
                      <Tag color="default" style={{ fontSize: 11 }}>{opt.desc}</Tag>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </div>

          <div className="wec-push-hint">
            💡 图表推送<span style={{ color: '#4a7dff' }}>图片</span>✅，
            透视表/明细推送<span style={{ color: '#52c41a' }}>Excel文件</span>🔧，
            排名洞察推送<span style={{ color: '#722ed1' }}>文字摘要</span>
          </div>
        </div>
      </Modal>
    </>
  );
};
