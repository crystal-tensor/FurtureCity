Original prompt: 如果我希望把目录SimCity项目里面的人模拟成目录MirolFIsh项目里面的agent，当然不用把所有人都映射成agent，而是把不同建筑里面的人映射成agent，并根据agent的反馈来调整能源的供需平衡，请帮我实现这个新的项目，然后放到一个新的目录EnergyCIty。全场都交给你了，你开始吧

2026-03-12
- 以 SimCity 作为可运行壳，创建新的 EnergyCIty 项目目录。
- 已确认 MiroFish 的核心可复用思路是 AgentActivityConfig、agent 画像、反馈与调度，不需要把整套后端直接搬入。
- 计划实现一个前端本地仿真版本：建筑群体映射为 cohort agents，agents 持续反馈，再驱动能源供需自动平衡。

TODO
- 替换 SimCity 的基础类型、仿真逻辑和主界面。
- 增加 render_game_to_text 和 advanceTime，满足可测试性。
- 跑 build 与浏览器验证，最后再复制到 /Users/avalok/work/EnergyCIty。

2026-03-12
- 已通过 npm build。
- 已启动本地 dev server 并跑过 web_game_playwright_client 一轮。
- 进入浏览器级人工核对阶段，检查 HUD、agent 面板、forecast 与画布交互。

- 已完成浏览器级验证：首屏供需平衡、策略切换可用、工具栏可切换、地图可编辑。
- 已复制项目到 /Users/avalok/work/EnergyCIty。
- 仍可继续优化的点：工业 cohort 规模很大，如果后续要更真实，可再细分工业子类 agent。

2026-03-12
- 启动第二轮重构：新增默认控制中心页面，保留城市沙盘页面。
- 新增能源流向、长期预测、压力测试和 AI/人工协同队列。
- 已通过 npm build，开始浏览器验收。

- 已完成控制中心重构：默认页改为能源运营控制中心，保留城市沙盘页。
- 新增能量流向图、长期预测、压力测试、AI/人工协同队列、情境调参、数字孪生窗口。
- 浏览器级验证通过：默认页、人工批准、沙盘页切换、render_game_to_text 均正常。

2026-03-12
- 修复两个页面切换后的顶部可见性：切页会强制回到页面顶端，顶部栏改为稳定吸顶。
- 城市沙盘布局改为 3:1，主地图改成正方形大画布，并新增显式缩放按钮；控制中心中的 mini map 保持原尺寸和形态。
- 初始地图降低建筑密度，保留能源设施和地标，但整体更稀疏，人口基线下降到约 7.7k-8.2k 区间。
- 新增本地 Playwright 验收依赖并完成自动化/浏览器双重验证：`npm run build` 通过，城市页实测主图约 1123x1123，侧栏约 386px，顶部栏 `top=8` 且 `scrollY=0`。
