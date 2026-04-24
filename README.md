# 销售数据看板

可视化分析工具，支持 Excel/CSV 数据导入、多维度拖拽分析、图表可视化、企业微信推送。

## 功能特性

- 📊 多维度数据分析（拖拽字段）
- 📈 图表可视化（柱状、折线、饼图、散点图等）
- 🔍 多条件筛选
- 📤 企业微信推送
- 📥 Excel/CSV 导入导出

## 安装包下载

每次代码更新会自动构建安装包：

| 平台 | 下载方式 |
|------|---------|
| Windows | 点击本仓库的 **Actions** → 最新 Workflow → Windows artifact |
| macOS | 点击本仓库的 **Actions** → 最新 Workflow → macOS artifact |

> 💡 **Releases 页面**会随版本标签自动生成，下载更方便。

## 本地开发

```bash
npm install
npm run dev
```

## 打包构建

```bash
npm run electron:build:win   # Windows
npm run electron:build:mac    # macOS（需在 Mac 上运行）
```

## 技术栈

- React 19 + TypeScript
- Ant Design 6
- ECharts 6
- Zustand 5
- Electron（桌面打包）
