# 🏙️ EnergyCity - 未来城市能源管理与多智能体推演系统

![React](https://img.shields.io/badge/React-18.x-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-4.x-purple?style=flat-square&logo=vite)

**EnergyCity** 是一款基于数字孪生与多智能体（Agent）技术的下一代城市能源调度与演练沙盘。本项目打通了“宏观城市规划—中观微电网调度—微观居民行为”的全链路，旨在为未来复杂的新型电力系统提供**“AI 自主优化 + 人机协同决策”**的压力测试与运营解决方案。

---

## ✨ 核心功能亮点

### 1. 🗺️ 城市沙盘与 AI 空间规划 (City Sandbox)
* **交互式数字孪生**：基于 HTML5 Canvas 构建的高性能 2.5D 城市沙盘，支持地形渲染、实时交互与地块编辑。
* **双重视角切换**：支持等距视角（Isometric）与俯视角（Top-Down）无缝切换，兼顾立体视觉与全局规划。
* **AI 智能布局**：内置生成式空间算法，一键生成河流、湖泊、海滨等自然风貌，并自动规划交替路网、住宅区、商业区、工业区与绿洲。
* **状态持久化**：支持将当前设计的城市地图保存至本地缓存，并可随时从历史记录中恢复。

### 2. ⚡ 能源运营控制中心 (Neural Grid Ops)
* **全景能流监控**：实时追踪火电、水电、核电、风电、光伏、生物质等多源发电状态，以及住宅、商业、工业等负荷消耗，构建微电网实时动态平衡模型。
* **人机协同调度**：
  * **AUTO 模式**：常规波动下，AI 自动重排储能（充/放电）与绿电消纳。
  * **SUPERVISED 模式**：预测压力越过预设阈值时，AI 提出干预预案（如需求响应、负荷削减），呼叫值班经理人工批准。

### 3. 🌪️ 极限压力测试实验室 (Stress Test Lab)
* **多维变量注入**：用户可自由调节“人口增长预期”、“天气波动”、“交通压力”、“工业扩张”等宏观参数，模拟未来不同时间维度（一天/一周/一月/一年）的供需极限场景。
* **智能预案与雷达**：针对测试中出现的电网崩溃风险，系统自动生成应对策略，并通过雷达图与折线图直观展示压力波峰。

### 4. 🤖 OASIS 多智能体社会演化 (Multi-Agent System)
* **微观行为涌现**：内置 20+ 类智能体（居民、工厂、医院等），模拟真实社会在面对停电风险、极端天气或电价波动时的复杂反应。
* **社会舆情采样**：实时生成智能体的“社交媒体动态（Social Feed）”，量化展示不同群体的“满意度”与“需求弹性”，将能源调度的影响从物理电网延伸至社会经济维度。

---

## 🛠️ 技术架构

* **前端框架**：[React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
* **构建工具**：[Vite](https://vitejs.dev/) (极速的冷启动与 HMR)
* **渲染引擎**：原生 HTML5 Canvas 2D API (自定义高性能渲染管线)
* **状态管理**：React Hooks (useState, useRef, useEffect) 结合不可变数据流设计
* **样式方案**：纯 CSS3 + CSS Variables 构建赛博朋克/极客风 UI (Glassmorphism, 霓虹发光效果)

---

## 📂 核心目录结构

```text
EnergyCity/
├── src/
│   ├── components/       # React UI 组件
│   │   ├── OperationsCenter.tsx  # 能源运营控制中心核心视图
│   │   ├── GameCanvas.tsx        # 城市沙盘 Canvas 渲染容器
│   │   └── ...
│   ├── game/             # 游戏与物理引擎逻辑
│   │   ├── grid.ts               # 地图生成、AI 布局、本地存储逻辑
│   │   ├── renderer.ts           # Canvas 绘制逻辑 (地块、道路、建筑等)
│   │   ├── operations.ts         # 能源调度与压力测试核心算法
│   │   └── types.ts              # TypeScript 类型定义 (TileType, Agent 等)
│   ├── App.tsx           # 应用根组件
│   └── App.css           # 全局样式与主题变量
├── public/               # 静态资源
└── package.json          # 项目依赖
```

---

## 🚀 快速开始

### 环境要求
* Node.js >= 16.x
* npm >= 7.x 或 yarn >= 1.22.x

### 安装与运行

1. **克隆项目 / 进入目录**
   ```bash
   cd EnergyCity
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或者 yarn install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   # 或者 yarn dev
   ```
   *启动后，浏览器访问 `http://localhost:5173` 即可体验。*

4. **生产环境构建**
   ```bash
   npm run build
   # 或者 yarn build
   ```

---

## 🔮 未来演进路线 (Roadmap)

本项目具备极强的可扩展性，未来计划探索将**量子计算与高级运筹算法**作为底层计算引擎的可行性：
* **QAOA (量子近似优化算法)**：探索解决海量分布式储能和机组启停的 MINLP 问题，实现毫秒级动态调度。
* **VQE (变分量子特征求解器)**：优化城市拓扑结构，寻找交通、环保、能耗三维平衡的绝对最优解。
* **QMARL (量子多智能体强化学习)**：加速 OASIS 系统中海量 Agent 的博弈过程，精准定位能源市场的纳什均衡点。

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 协议开源。
