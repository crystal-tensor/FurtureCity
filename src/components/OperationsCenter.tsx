import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import { autoLayoutRoads, createInitialState } from '../game/grid';
import { deriveOperationsSnapshot } from '../game/operations';
import { getTimeLabel, renderStateSummary, setPolicy, tick, updateWeather } from '../game/simulation';
import type {
  FeedbackEntry,
  ForecastPressurePoint,
  GameState,
  HorizonKey,
  InterventionPlan,
  OperationsControls,
  Tile,
  TileType,
} from '../game/types';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const CONTROL_DEFAULTS: OperationsControls = {
  populationDrift: 14,
  weatherVolatility: 38,
  trafficLoad: 42,
  industrialLoad: 28,
  eventLoad: 16,
  alertThreshold: 0.78,
};

const CITY_TOOLS: Array<{ type: TileType | 'cursor' | 'bulldozer'; label: string }> = [
  { type: 'cursor', label: '查看' },
  { type: 'road', label: '道路' },
  { type: 'residential', label: '住宅' },
  { type: 'commercial', label: '商业' },
  { type: 'industrial', label: '工业' },
  { type: 'power', label: '聚变' },
  { type: 'solar', label: '光伏' },
  { type: 'wind', label: '风电' },
  { type: 'bio', label: '生物质' },
  { type: 'storage', label: '储能' },
  { type: 'park', label: '公园' },
  { type: 'stadium', label: '场馆' },
  { type: 'amusement_park', label: '乐园' },
  { type: 'river', label: '河流' },
  { type: 'lake', label: '湖泊' },
  { type: 'seaside', label: '海滨' },
  { type: 'bulldozer', label: '拆除' },
];

function bootstrapState() {
  const state = createInitialState();
  tick(state, 60);
  return state;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCompactNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

function scrollViewportToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function getTileDetails(tile: Tile | undefined) {
  if (!tile) return null;

  return {
    label: tile.type,
    district: tile.district,
    population: tile.population,
    powered: tile.isPowered ? '稳定供电' : '局部降载',
  };
}

function PressureChart({ points, color }: { points: ForecastPressurePoint[]; color: string }) {
  const width = 760;
  const height = 220;
  const padding = 22;
  const maxY = Math.max(...points.map((point) => Math.max(point.demand, point.supply)), 1);

  const demandPath = points
    .map((point, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (point.demand / maxY) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const supplyPath = points
    .map((point, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (point.supply / maxY) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pressure-chart" role="img" aria-label="forecast chart">
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return <line key={ratio} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />;
      })}
      <path d={supplyPath} className="chart-line supply-line" />
      <path d={demandPath} className="chart-line demand-line" />
      {points.map((point, index) => {
        const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
        const pressureY = height - padding - point.pressure / 1.2 * (height - padding * 2);
        return (
          <g key={point.label}>
            <circle cx={x} cy={pressureY} r={point.pressure > 0.78 ? 4 : 2.6} fill={color} />
            {index < 8 && (
              <text x={x} y={height - 6} className="chart-label" textAnchor="middle">
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FlowMatrix({
  generation,
  demand,
  storageLevel,
}: {
  generation: {
    solar: number;
    fusion: number;
    bio: number;
    storageDischarge: number;
    recovery: number;
  };
  demand: {
    residential: number;
    commercial: number;
    industrial: number;
    mobility: number;
    civic: number;
  };
  storageLevel: number;
}) {
  const nodes = {
    solar: { x: 100, y: 82, label: '光伏阵列', value: generation.solar, tone: 'solar' },
    fusion: { x: 100, y: 172, label: '聚变基座', value: generation.fusion, tone: 'fusion' },
    bio: { x: 100, y: 262, label: '生物质站', value: generation.bio, tone: 'bio' },
    recovery: { x: 100, y: 352, label: '回收回路', value: generation.recovery, tone: 'recovery' },
    grid: { x: 360, y: 210, label: '主母线', value: generation.solar + generation.fusion + generation.bio, tone: 'grid' },
    storage: { x: 360, y: 352, label: '储能云仓', value: storageLevel, tone: 'storage' },
    housing: { x: 640, y: 96, label: '住宅', value: demand.residential, tone: 'load' },
    commerce: { x: 640, y: 186, label: '商业', value: demand.commercial, tone: 'load' },
    industry: { x: 640, y: 276, label: '工业', value: demand.industrial, tone: 'load' },
    mobility: { x: 640, y: 366, label: '交通/公共', value: demand.mobility + demand.civic, tone: 'load' },
  } as const;

  const links = [
    ['solar', 'grid', generation.solar],
    ['fusion', 'grid', generation.fusion],
    ['bio', 'grid', generation.bio],
    ['recovery', 'storage', generation.recovery],
    ['storage', 'grid', generation.storageDischarge],
    ['grid', 'housing', demand.residential],
    ['grid', 'commerce', demand.commercial],
    ['grid', 'industry', demand.industrial],
    ['grid', 'mobility', demand.mobility + demand.civic],
  ] as const;

  return (
    <svg viewBox="0 0 760 440" className="flow-matrix" role="img" aria-label="energy flow diagram">
      <defs>
        <linearGradient id="flowA" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#5de2ff" />
          <stop offset="100%" stopColor="#8d63ff" />
        </linearGradient>
        <linearGradient id="flowB" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#72f6b7" />
          <stop offset="100%" stopColor="#4dd1bc" />
        </linearGradient>
      </defs>
      {links.map(([sourceKey, targetKey, value], index) => {
        const source = nodes[sourceKey];
        const target = nodes[targetKey];
        const curveX = (source.x + target.x) / 2;
        const width = Math.max(2, value / 800);
        return (
          <path
            key={`${sourceKey}-${targetKey}`}
            d={`M ${source.x + 56} ${source.y} C ${curveX} ${source.y}, ${curveX} ${target.y}, ${target.x - 56} ${target.y}`}
            fill="none"
            stroke={index % 2 === 0 ? 'url(#flowA)' : 'url(#flowB)'}
            strokeWidth={width}
            strokeLinecap="round"
            opacity={0.75}
          />
        );
      })}
      {Object.entries(nodes).map(([key, node]) => (
        <g key={key} transform={`translate(${node.x}, ${node.y})`}>
          <circle r={46} className={`flow-node ${node.tone}`} />
          <circle r={34} className="flow-node-core" />
          <text y="-4" className="flow-node-label" textAnchor="middle">
            {node.label}
          </text>
          <text y="18" className="flow-node-value" textAnchor="middle">
            {formatCompactNumber(node.value)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MiniBar({
  title,
  value,
  total,
  tone,
}: {
  title: string;
  value: number;
  total: number;
  tone: string;
}) {
  return (
    <div className="mini-bar">
      <div className="mini-bar-head">
        <span>{title}</span>
        <strong>{formatCompactNumber(value)}</strong>
      </div>
      <div className="mini-bar-track">
        <div className={`mini-bar-fill ${tone}`} style={{ width: `${(value / Math.max(total, 1)) * 100}%` }} />
      </div>
    </div>
  );
}

const OperationsCenter: React.FC = () => {
  const gameStateRef = useRef<GameState>(bootstrapState());
  const [snapshot, setSnapshot] = useState<GameState>(() => gameStateRef.current);
  const [controls, setControls] = useState<OperationsControls>(CONTROL_DEFAULTS);
  const [page, setPage] = useState<'ops' | 'city'>('ops');
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonKey>('day');
  const [showEnergyFlow, setShowEnergyFlow] = useState(true);
  const [selectedTool, setSelectedTool] = useState<TileType | 'cursor' | 'bulldozer'>('cursor');
  const [selectedTile, setSelectedTile] = useState<{ coords: { x: number; y: number }; tile?: Tile } | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('grid_orchestrator');
  const [approvedPlans, setApprovedPlans] = useState<string[]>([]);
  const [decisionLog, setDecisionLog] = useState<string[]>([
    'AI 已接管常规优化，管理人员只在超过阈值时参与。',
  ]);

  const syncUi = () => {
    startTransition(() => {
      setSnapshot({ ...gameStateRef.current });
    });
  };

  useEffect(() => {
    const loop = () => {
      tick(gameStateRef.current, 6);
      syncUi();
      timer = window.setTimeout(loop, 220);
    };

    let timer = window.setTimeout(loop, 220);
    return () => window.clearTimeout(timer);
  }, []);

  const operations = useMemo(() => deriveOperationsSnapshot(snapshot, controls), [snapshot, controls]);
  const selectedForecast =
    operations.horizons.find((horizon) => horizon.horizon === selectedHorizon) ?? operations.horizons[0];
  const selectedAgent =
    snapshot.agents.find((agent) => agent.id === selectedAgentId) ?? snapshot.agents[0] ?? null;
  const selectedTileInfo = getTileDetails(selectedTile?.tile);
  const humanQueue = operations.interventions.filter((plan) => !approvedPlans.includes(plan.id));

  useEffect(() => {
    window.render_game_to_text = () => {
      const base = JSON.parse(renderStateSummary(gameStateRef.current));
      return JSON.stringify(
        {
          ...base,
          controlCenter: {
            mode: operations.mode,
            selectedHorizon,
            peakPressure: selectedForecast.peakPressure,
            interventionQueue: humanQueue.map((plan) => plan.title),
          },
        },
        null,
        2,
      );
    };

    window.advanceTime = (ms: number) => {
      const minutes = Math.max(1, Math.round(ms / 100));
      tick(gameStateRef.current, minutes);
      syncUi();
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [operations.mode, selectedForecast.peakPressure, selectedHorizon, humanQueue]);

  useEffect(() => {
    document.title = 'EnergyCIty Control Center';
  }, []);

  useEffect(() => {
    scrollViewportToTop();
    const frame = window.requestAnimationFrame(scrollViewportToTop);
    const timer = window.setTimeout(scrollViewportToTop, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [page]);

  const switchPage = (nextPage: 'ops' | 'city') => {
    setPage(nextPage);
    scrollViewportToTop();
  };

  const approvePlan = (plan: InterventionPlan) => {
    setPolicy(gameStateRef.current, plan.policy);
    setApprovedPlans((current) => [...current, plan.id]);
    setDecisionLog((current) => [
      `${getTimeLabel(gameStateRef.current.time)} 人工批准: ${plan.title}`,
      ...current,
    ].slice(0, 8));
    syncUi();
  };

  const triggerAutoOptimize = () => {
    setPolicy(gameStateRef.current, selectedForecast.recommendedPolicy);
    setDecisionLog((current) => [
      `${getTimeLabel(gameStateRef.current.time)} AI 自动切换策略到 ${selectedForecast.recommendedPolicy}`,
      ...current,
    ].slice(0, 8));
    syncUi();
  };

  const applyWeather = (value: number) => {
    updateWeather(gameStateRef.current, value);
    syncUi();
  };

  const handleSelectTile = (coords: { x: number; y: number }, tile: Tile | undefined) => {
    setSelectedTile({ coords, tile });
    if (tile) {
      const match = snapshot.agents.find((agent) => agent.buildingTypes.includes(tile.type));
      if (match) {
        setSelectedAgentId(match.id);
      }
    }
  };

  const totalGeneration =
    operations.generation.solar +
    operations.generation.fusion +
    operations.generation.bio +
    operations.generation.storageDischarge +
    operations.generation.recovery;
  const totalDemand =
    operations.demand.residential +
    operations.demand.commercial +
    operations.demand.industrial +
    operations.demand.mobility +
    operations.demand.civic;

  return (
    <div className="ops-shell">
      <div className="ops-background-grid" />

      <header className="ops-topbar">
        <div>
          <span className="app-badge">EnergyCIty // Neural Grid Ops</span>
          <h1>能源运营控制中心</h1>
          <p>AI 持续优化常规调度，只有当预测压力超过预置阈值时，才呼叫管理人员进行协同决策。</p>
        </div>
        <div className="topbar-actions">
          <div className="page-switch">
            <button
              type="button"
              className={page === 'ops' ? 'nav-chip active' : 'nav-chip'}
              onClick={() => switchPage('ops')}
            >
              控制中心
            </button>
            <button
              type="button"
              className={page === 'city' ? 'nav-chip active' : 'nav-chip'}
              onClick={() => switchPage('city')}
            >
              城市沙盘
            </button>
          </div>
          <div className={operations.mode === 'auto' ? 'mode-pill auto' : 'mode-pill supervised'}>
            {operations.mode === 'auto' ? 'AI 自动优化中' : '等待人工确认'}
          </div>
        </div>
      </header>

      {page === 'ops' ? (
        <main className="ops-layout">
          <section className="ops-main-column">
            <div className="hero-grid">
              <div className="glass-card hero-card">
                <div className="hero-metrics">
                  <div className="hero-metric">
                    <span>当前时钟</span>
                    <strong>{getTimeLabel(snapshot.time)}</strong>
                  </div>
                  <div className="hero-metric">
                    <span>人口总量</span>
                    <strong>{snapshot.population.toLocaleString()}</strong>
                  </div>
                  <div className="hero-metric">
                    <span>运行模式</span>
                    <strong>{snapshot.policy}</strong>
                  </div>
                  <div className="hero-metric">
                    <span>告警阈值</span>
                    <strong>{Math.round(controls.alertThreshold * 100)}%</strong>
                  </div>
                </div>
                <div className="hero-strip">
                  <div>
                    <span>舒适度</span>
                    <strong>{formatPercent(snapshot.energy.comfort)}</strong>
                  </div>
                  <div>
                    <span>峰压指数</span>
                    <strong>{selectedForecast.peakPressure.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>碳强度</span>
                    <strong>{formatPercent(snapshot.energy.carbonIntensity)}</strong>
                  </div>
                  <div>
                    <span>储能电量</span>
                    <strong>
                      {snapshot.energy.storageLevel.toFixed(0)} / {snapshot.energy.storageCapacity}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="glass-card command-card">
                <div className="section-title-row">
                  <h2>AI 指挥摘要</h2>
                  <button type="button" className="accent-button" onClick={triggerAutoOptimize}>
                    立即执行 AI 最优解
                  </button>
                </div>
                <p className="command-copy">
                  {operations.mode === 'auto'
                    ? '当前处于 AI 自主优化区间，系统已自动重排储能、绿电消纳和需求响应。'
                    : '预测压力已越过阈值，AI 已生成候选处置方案，等待值班经理批准。'}
                </p>
                <div className="decision-log">
                  {decisionLog.map((entry) => (
                    <div key={entry} className="decision-item">
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>未来一天 / 一周 / 一月 / 一年的供需压力预测</h2>
                <div className="horizon-tabs">
                  {operations.horizons.map((horizon) => (
                    <button
                      key={horizon.horizon}
                      type="button"
                      className={selectedHorizon === horizon.horizon ? 'nav-chip active' : 'nav-chip'}
                      onClick={() => setSelectedHorizon(horizon.horizon)}
                    >
                      {horizon.horizon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="forecast-summary-grid">
                {operations.horizons.map((horizon) => (
                  <button
                    key={horizon.horizon}
                    type="button"
                    className={selectedHorizon === horizon.horizon ? 'forecast-card active' : 'forecast-card'}
                    onClick={() => setSelectedHorizon(horizon.horizon)}
                  >
                    <span>{horizon.title}</span>
                    <strong>{horizon.peakPressure.toFixed(2)}</strong>
                    <small>风险时长 {horizon.hoursAtRisk}h</small>
                    <small>建议策略 {horizon.recommendedPolicy}</small>
                  </button>
                ))}
              </div>
              <PressureChart points={selectedForecast.points} color={selectedForecast.peakPressure > controls.alertThreshold ? '#ff7a9d' : '#60f3cb'} />
              <div className="forecast-footer">
                <div>
                  <span>最差窗口</span>
                  <strong>{selectedForecast.worstWindow}</strong>
                </div>
                <div>
                  <span>平均压力</span>
                  <strong>{selectedForecast.averagePressure.toFixed(2)}</strong>
                </div>
                <div>
                  <span>模型置信度</span>
                  <strong>{formatPercent(selectedForecast.confidence)}</strong>
                </div>
                <div>
                  <span>人口预测</span>
                  <strong>{operations.populationProjection[selectedHorizon].toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>产生 / 流动 / 储存 / 回收</h2>
                <span className="tiny-meta">实时能量总线监控</span>
              </div>
              <FlowMatrix
                generation={operations.generation}
                demand={operations.demand}
                storageLevel={operations.storage.level}
              />
            </div>

            <div className="dual-grid">
              <div className="glass-card">
                <div className="section-title-row">
                  <h2>发电与负荷结构</h2>
                  <span className="tiny-meta">单位: 等效 MWh</span>
                </div>
                <div className="mini-bars">
                  <MiniBar title="光伏" value={operations.generation.solar} total={totalGeneration} tone="tone-solar" />
                  <MiniBar title="聚变" value={operations.generation.fusion} total={totalGeneration} tone="tone-fusion" />
                  <MiniBar title="生物质" value={operations.generation.bio} total={totalGeneration} tone="tone-bio" />
                  <MiniBar
                    title="储能放电"
                    value={operations.generation.storageDischarge}
                    total={totalGeneration}
                    tone="tone-storage"
                  />
                  <MiniBar title="回收能量" value={operations.generation.recovery} total={totalGeneration} tone="tone-recovery" />
                  <div className="stack-divider" />
                  <MiniBar title="住宅负荷" value={operations.demand.residential} total={totalDemand} tone="tone-demand" />
                  <MiniBar title="商业负荷" value={operations.demand.commercial} total={totalDemand} tone="tone-demand" />
                  <MiniBar title="工业负荷" value={operations.demand.industrial} total={totalDemand} tone="tone-demand" />
                  <MiniBar
                    title="交通/公共"
                    value={operations.demand.mobility + operations.demand.civic}
                    total={totalDemand}
                    tone="tone-demand"
                  />
                </div>
              </div>

              <div className="glass-card">
                <div className="section-title-row">
                  <h2>储能与回收</h2>
                  <span className="tiny-meta">AI 自动处理常规波动</span>
                </div>
                <div className="storage-grid">
                  <div className="storage-ring" style={{ ['--level' as string]: `${(operations.storage.level / operations.storage.capacity) * 100}%` }} />
                  <div className="storage-copy">
                    <strong>{formatPercent(operations.storage.level / operations.storage.capacity)}</strong>
                    <span>当前库存</span>
                    <p>
                      充电 {formatCompactNumber(operations.storage.charge)} / 放电 {formatCompactNumber(operations.storage.discharge)}
                      / 回收 {formatCompactNumber(operations.storage.recycle)}
                    </p>
                  </div>
                </div>
                <div className="storage-stats">
                  <div>
                    <span>Reserve Margin</span>
                    <strong>{formatPercent(snapshot.energy.reserveMargin)}</strong>
                  </div>
                  <div>
                    <span>Price Signal</span>
                    <strong>{formatPercent(snapshot.energy.priceSignal)}</strong>
                  </div>
                  <div>
                    <span>Outage Risk</span>
                    <strong>{formatPercent(snapshot.energy.outageRisk)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>压力测试实验室</h2>
                <span className="tiny-meta">超过阈值时立即进入人机协同</span>
              </div>
              <div className="stress-grid">
                {operations.stressTests.map((scenario) => (
                  <div key={scenario.id} className={`stress-card ${scenario.severity}`}>
                    <div className="stress-head">
                      <strong>{scenario.title}</strong>
                      <span>{scenario.pressure.toFixed(2)}</span>
                    </div>
                    <p>{scenario.description}</p>
                    <small>{scenario.aiAction}</small>
                    <div className="stress-foot">
                      <span>{scenario.requiresHuman ? '需要人工' : 'AI 自处置'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="ops-side-column">
            <div className="glass-card control-card">
              <div className="section-title-row">
                <h2>情境调参</h2>
                <span className="tiny-meta">人口 / 天气 / 交通 / 活动</span>
              </div>
              <div className="slider-stack">
                {[
                  ['人口增长预期', 'populationDrift', controls.populationDrift, '%'],
                  ['天气波动', 'weatherVolatility', controls.weatherVolatility, '%'],
                  ['交通压力', 'trafficLoad', controls.trafficLoad, '%'],
                  ['工业扩张', 'industrialLoad', controls.industrialLoad, '%'],
                  ['活动负荷', 'eventLoad', controls.eventLoad, '%'],
                ].map(([label, key, value, suffix]) => (
                  <label key={key} className="slider-row">
                    <div className="slider-head">
                      <span>{label}</span>
                      <strong>
                        {value}
                        {suffix}
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Number(value)}
                      onChange={(event) =>
                        setControls((current) => ({
                          ...current,
                          [key]: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="slider-row">
                  <div className="slider-head">
                    <span>AI 呼叫人工阈值</span>
                    <strong>{Math.round(controls.alertThreshold * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={55}
                    max={95}
                    value={Math.round(controls.alertThreshold * 100)}
                    onChange={(event) =>
                      setControls((current) => ({
                        ...current,
                        alertThreshold: Number(event.target.value) / 100,
                      }))
                    }
                  />
                </label>
                <label className="slider-row">
                  <div className="slider-head">
                    <span>实时天气输入</span>
                    <strong>{snapshot.weather}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={snapshot.weather}
                    onChange={(event) => applyWeather(Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>AI 与人工协同</h2>
                <span className={operations.mode === 'auto' ? 'mode-inline auto' : 'mode-inline supervised'}>
                  {operations.mode === 'auto' ? 'AUTO' : 'SUPERVISED'}
                </span>
              </div>
              <div className="ai-list">
                {operations.resolvedAutomatically.map((plan) => (
                  <div key={plan.id} className="ai-item resolved">
                    <strong>{plan.title}</strong>
                    <p>{plan.reason}</p>
                    <small>{plan.impact}</small>
                  </div>
                ))}
                {humanQueue.length === 0 ? (
                  <div className="ai-item quiet">
                    <strong>当前无需人工介入</strong>
                    <p>AI 已在阈值内自动完成优化，值班经理维持观察即可。</p>
                  </div>
                ) : (
                  humanQueue.map((plan) => (
                    <div key={plan.id} className="ai-item human">
                      <strong>{plan.title}</strong>
                      <p>{plan.reason}</p>
                      <small>{plan.impact}</small>
                      <button type="button" className="accent-button" onClick={() => approvePlan(plan)}>
                        人工批准并执行
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card mini-city-card">
              <div className="section-title-row">
                <h2>实时数字孪生</h2>
                <label className="switch-line">
                  <input
                    type="checkbox"
                    checked={showEnergyFlow}
                    onChange={(event) => setShowEnergyFlow(event.target.checked)}
                  />
                  <span>能流叠加</span>
                </label>
              </div>
              <GameCanvas
                stateRef={gameStateRef}
                showEnergyFlow={showEnergyFlow}
                selectedTool="cursor"
                readOnly
                className="mini-canvas"
                onSelectTile={handleSelectTile}
              />
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>Agent 反馈雷达</h2>
                <span className="tiny-meta">超阈值时会进入人工队列</span>
              </div>
              <div className="agent-list">
                {snapshot.agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={selectedAgentId === agent.id ? 'agent-item active' : 'agent-item'}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.role}</span>
                    </div>
                    <div className="agent-item-meta">
                      <small>满意度 {Math.round(agent.satisfaction * 100)}%</small>
                      <small>弹性 {Math.round(agent.flexibility * 100)}%</small>
                    </div>
                  </button>
                ))}
              </div>
              {selectedAgent && (
                <div className="agent-focus">
                  <strong>{selectedAgent.name}</strong>
                  <p>{selectedAgent.latestFeedback}</p>
                  <div className="memory-stack">
                    {selectedAgent.memory.slice(0, 4).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </main>
      ) : (
        <main className="city-layout">
          <section className="glass-card city-main-card">
            <div className="section-title-row">
              <h2>城市沙盘</h2>
              <div className="page-switch">
                <button type="button" className="nav-chip" onClick={() => setShowEnergyFlow((current) => !current)}>
                  {showEnergyFlow ? '隐藏能流' : '显示能流'}
                </button>
                <button
                  type="button"
                  className="nav-chip"
                  onClick={() => {
                    gameStateRef.current = autoLayoutRoads(gameStateRef.current);
                    syncUi();
                  }}
                >
                  AI 重新布路
                </button>
              </div>
            </div>
            <GameCanvas
              stateRef={gameStateRef}
              showEnergyFlow={showEnergyFlow}
              selectedTool={selectedTool}
              onSelectTile={handleSelectTile}
              onStateMutated={syncUi}
              className="city-main-canvas"
            />
          </section>

          <aside className="city-side-column">
            <div className="glass-card">
              <div className="section-title-row">
                <h2>地块工具</h2>
                <span className="tiny-meta">人工只做结构性调整</span>
              </div>
              <div className="tool-grid">
                {CITY_TOOLS.map((tool) => (
                  <button
                    key={tool.type}
                    type="button"
                    className={selectedTool === tool.type ? 'tool-chip active' : 'tool-chip'}
                    onClick={() => setSelectedTool(tool.type)}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>沙盘状态</h2>
                <span className="tiny-meta">{getTimeLabel(snapshot.time)}</span>
              </div>
              <div className="city-summary-grid">
                <div>
                  <span>人口</span>
                  <strong>{snapshot.population.toLocaleString()}</strong>
                </div>
                <div>
                  <span>预算</span>
                  <strong>{snapshot.money.toLocaleString()}</strong>
                </div>
                <div>
                  <span>供给</span>
                  <strong>{snapshot.energy.supply}</strong>
                </div>
                <div>
                  <span>需求</span>
                  <strong>{snapshot.energy.adjustedDemand}</strong>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>选中地块</h2>
                <span className="tiny-meta">
                  {selectedTile ? `${selectedTile.coords.x}, ${selectedTile.coords.y}` : '未选择'}
                </span>
              </div>
              {selectedTileInfo ? (
                <div className="tile-info-card">
                  <div>
                    <span>类型</span>
                    <strong>{selectedTileInfo.label}</strong>
                  </div>
                  <div>
                    <span>区位</span>
                    <strong>{selectedTileInfo.district}</strong>
                  </div>
                  <div>
                    <span>活跃人口</span>
                    <strong>{selectedTileInfo.population}</strong>
                  </div>
                  <div>
                    <span>供电状态</span>
                    <strong>{selectedTileInfo.powered}</strong>
                  </div>
                </div>
              ) : (
                <p className="empty-note">用“查看”点击城市地块，就能看到它所属的群体及状态。</p>
              )}
            </div>

            <div className="glass-card">
              <div className="section-title-row">
                <h2>最新反馈</h2>
                <span className="tiny-meta">{snapshot.feedback.length} 条</span>
              </div>
              <div className="feedback-stack">
                {snapshot.feedback.slice(0, 5).map((entry: FeedbackEntry) => (
                  <div key={entry.id} className={`feedback-entry ${entry.severity}`}>
                    <strong>{entry.agentName}</strong>
                    <p>{entry.detail}</p>
                    <small>{entry.recommendation}</small>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
};

export default OperationsCenter;
