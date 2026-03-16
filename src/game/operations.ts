import { getHour } from './simulation';
import type {
  EnergyPolicy,
  ForecastPressurePoint,
  GameState,
  GenerationBreakdown,
  HorizonForecast,
  HorizonKey,
  InterventionPlan,
  OperationsControls,
  OperationsSnapshot,
  Severity,
  StressScenario,
} from './types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPressureWindow(horizon: HorizonKey, index: number) {
  if (horizon === 'day') return `${index}:00`;
  if (horizon === 'week') return `第 ${index + 1} 个半日`;
  if (horizon === 'month') return `第 ${index + 1} 周`;
  return `${index + 1} 月`;
}

function policyForPressure(pressure: number, renewableRatio: number): EnergyPolicy {
  if (pressure > 0.9) return 'resilience';
  if (renewableRatio < 0.4) return 'green';
  if (pressure < 0.45) return 'growth';
  return 'balanced';
}

function severityFromPressure(pressure: number): Severity {
  if (pressure > 0.92) return 'critical';
  if (pressure > 0.68) return 'warn';
  return 'info';
}

function pointCountForHorizon(horizon: HorizonKey) {
  switch (horizon) {
    case 'day':
      return 24;
    case 'week':
      return 14;
    case 'month':
      return 12;
    case 'year':
      return 12;
  }
}

function stepSizeForHorizon(horizon: HorizonKey) {
  switch (horizon) {
    case 'day':
      return 1;
    case 'week':
      return 12;
    case 'month':
      return 24 * 3;
    case 'year':
      return 24 * 30;
  }
}

function titleForHorizon(horizon: HorizonKey) {
  switch (horizon) {
    case 'day':
      return '未来 24 小时';
    case 'week':
      return '未来 7 天';
    case 'month':
      return '未来 30 天';
    case 'year':
      return '未来 12 个月';
  }
}

function generatePressureSeries(
  state: GameState,
  controls: OperationsControls,
  horizon: HorizonKey,
): HorizonForecast {
  const count = pointCountForHorizon(horizon);
  const step = stepSizeForHorizon(horizon);
  const baseDemand = state.energy.adjustedDemand;
  const baseSupply = state.energy.supply;
  const baseRenewable = state.energy.renewableRatio;
  const points: ForecastPressurePoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const hourShift = index * step;
    const futureHour = (getHour(state.time) + hourShift) % 24;
    const dayCycle = Math.sin((futureHour / 24) * Math.PI * 2);
    const seasonalCycle = Math.sin(((index + 1) / count) * Math.PI * 2 + controls.weatherVolatility * 0.04);
    const populationFactor = 1 + controls.populationDrift / 100 * (horizon === 'day' ? 0.08 : horizon === 'week' ? 0.18 : horizon === 'month' ? 0.45 : 1);
    const trafficFactor = 1 + controls.trafficLoad / 100 * (0.12 + Math.max(dayCycle, 0) * 0.18);
    const industrialFactor = 1 + controls.industrialLoad / 100 * (horizon === 'year' ? 0.3 : 0.18);
    const eventFactor = 1 + controls.eventLoad / 100 * (0.1 + Math.max(seasonalCycle, 0) * 0.14);
    const demand =
      baseDemand *
      populationFactor *
      trafficFactor *
      industrialFactor *
      eventFactor *
      (1 + Math.max(dayCycle, -0.35) * 0.12);

    const weatherPenalty = controls.weatherVolatility / 100 * (0.08 + Math.max(seasonalCycle, 0) * 0.18);
    const recoveryBoost = 1 + controls.trafficLoad / 100 * 0.08 + controls.eventLoad / 100 * 0.05;
    const supply =
      baseSupply *
      (1 - weatherPenalty) *
      (1 + Math.max(baseRenewable - 0.35, 0) * 0.1) *
      recoveryBoost *
      (1 - Math.max(dayCycle, 0) * 0.04);

    const pressure = clamp((demand - supply) / Math.max(demand, 1) + 0.52, 0.06, 1.2);
    const reserve = clamp((supply - demand) / Math.max(demand, 1), -0.42, 0.28);
    const renewableRatio = clamp(
      baseRenewable +
        (horizon === 'day' ? 0.02 : horizon === 'week' ? 0.06 : horizon === 'month' ? 0.1 : 0.16) -
        weatherPenalty * 0.3,
      0.16,
      0.94,
    );

    points.push({
      label: horizon === 'day' ? `${futureHour}:00` : `${index + 1}`,
      demand: Math.round(demand),
      supply: Math.round(supply),
      pressure: Number(pressure.toFixed(2)),
      reserve: Number(reserve.toFixed(2)),
      renewableRatio: Number(renewableRatio.toFixed(2)),
    });
  }

  const peakPressure = Math.max(...points.map((point) => point.pressure));
  const averagePressure =
    points.reduce((sum, point) => sum + point.pressure, 0) / Math.max(points.length, 1);
  const peakIndex = points.findIndex((point) => point.pressure === peakPressure);
  const hoursAtRisk = points.filter((point) => point.pressure > 0.72).length * (horizon === 'day' ? 1 : step);
  const confidence = clamp(
    0.94 - (horizon === 'day' ? 0.04 : horizon === 'week' ? 0.08 : horizon === 'month' ? 0.16 : 0.24) -
      controls.weatherVolatility / 100 * 0.08,
    0.52,
    0.96,
  );
  const recommendedPolicy = policyForPressure(
    peakPressure,
    points.reduce((sum, point) => sum + point.renewableRatio, 0) / points.length,
  );

  return {
    horizon,
    title: titleForHorizon(horizon),
    peakPressure: Number(peakPressure.toFixed(2)),
    averagePressure: Number(averagePressure.toFixed(2)),
    hoursAtRisk,
    worstWindow: formatPressureWindow(horizon, Math.max(peakIndex, 0)),
    confidence: Number(confidence.toFixed(2)),
    recommendedPolicy,
    points,
  };
}

function deriveStressTests(controls: OperationsControls, horizons: HorizonForecast[]): StressScenario[] {
  const peakDay = horizons.find((item) => item.horizon === 'day')?.peakPressure ?? 0.5;
  const peakWeek = horizons.find((item) => item.horizon === 'week')?.peakPressure ?? 0.5;

  return [
    {
      id: 'heatwave',
      title: '高温热浪 + 空调负荷',
      description: '连续高温抬高住宅与商业冷负荷，测试晚高峰储能与需求响应。',
      pressure: Number(clamp(peakDay + controls.weatherVolatility / 100 * 0.22, 0.12, 1.15).toFixed(2)),
      severity: severityFromPressure(peakDay + controls.weatherVolatility / 100 * 0.22),
      aiAction: 'AI 提前 6 小时为储能充电，并将商业冷站预冷。',
      requiresHuman: peakDay + controls.weatherVolatility / 100 * 0.22 > controls.alertThreshold,
    },
    {
      id: 'commuter_spike',
      title: '通勤洪峰 + 轨道回充波动',
      description: '交通压力冲击移动负荷与回收能量效率，检验交通与配电联动。',
      pressure: Number(clamp(0.48 + controls.trafficLoad / 100 * 0.42, 0.12, 1.1).toFixed(2)),
      severity: severityFromPressure(0.48 + controls.trafficLoad / 100 * 0.42),
      aiAction: 'AI 优先切换轨交与充电桩到分时功率曲线，释放 8-12% 峰时容量。',
      requiresHuman: 0.48 + controls.trafficLoad / 100 * 0.42 > controls.alertThreshold,
    },
    {
      id: 'industrial_surge',
      title: '工业扩产 + 夜间补能',
      description: '制造园夜班和数据中心冷站同步抬升，考验聚变底座与生物质协同。',
      pressure: Number(clamp(peakWeek + controls.industrialLoad / 100 * 0.36, 0.14, 1.12).toFixed(2)),
      severity: severityFromPressure(peakWeek + controls.industrialLoad / 100 * 0.36),
      aiAction: 'AI 锁定工业可中断负荷合同，并预启生物质机组。',
      requiresHuman: peakWeek + controls.industrialLoad / 100 * 0.36 > controls.alertThreshold,
    },
    {
      id: 'festival',
      title: '节庆活动 + 文旅夜峰',
      description: '大型活动放大夜间照明、交通、娱乐负荷，同时提升人流不确定性。',
      pressure: Number(clamp(0.44 + controls.eventLoad / 100 * 0.46 + controls.trafficLoad / 100 * 0.12, 0.14, 1.16).toFixed(2)),
      severity: severityFromPressure(0.44 + controls.eventLoad / 100 * 0.46 + controls.trafficLoad / 100 * 0.12),
      aiAction: 'AI 自动切换文旅场馆到需求响应档位，并调用停车场储能逆变。',
      requiresHuman: 0.44 + controls.eventLoad / 100 * 0.46 + controls.trafficLoad / 100 * 0.12 > controls.alertThreshold,
    },
  ];
}

function deriveInterventions(
  state: GameState,
  controls: OperationsControls,
  horizons: HorizonForecast[],
  stressTests: StressScenario[],
): { interventions: InterventionPlan[]; resolvedAutomatically: InterventionPlan[] } {
  const peak = Math.max(...horizons.map((item) => item.peakPressure));
  const needsHuman = stressTests.some((scenario) => scenario.requiresHuman) || peak > controls.alertThreshold;
  const primaryPolicy = policyForPressure(peak, state.energy.renewableRatio);

  const commonPlans: InterventionPlan[] = [
    {
      id: 'dispatch-rephase',
      title: '动态重排储能充放电窗口',
      reason: '削峰填谷效率最高，优先级由 AI 自治执行。',
      impact: '预计降低 6-10% 峰压，提升 4% reserve margin。',
      autopilot: true,
      policy: primaryPolicy,
    },
    {
      id: 'mobility-recovery',
      title: '提高交通回收与 V2G 参与度',
      reason: '交通负荷上行时，回收通道是最快补偿手段。',
      impact: '预计回收 180-420 MWh 等效能量。',
      autopilot: !needsHuman,
      policy: primaryPolicy,
    },
  ];

  if (peak > controls.alertThreshold) {
    commonPlans.push(
      {
        id: 'human-capacity',
        title: '申请人工确认备用容量切换',
        reason: '压力已超过值班阈值，需要确认负荷切除优先级与电价策略。',
        impact: '可额外释放 8-14% 安全裕量。',
        autopilot: false,
        policy: 'resilience',
      },
      {
        id: 'green-curtailment',
        title: '人工批准工业柔性负荷合约',
        reason: '工业园波动已开始挤压住宅舒适度，需由管理人员确认补偿标准。',
        impact: '可在 2 小时内回收 10-12% 峰值负荷。',
        autopilot: false,
        policy: 'balanced',
      },
    );
  }

  return {
    interventions: commonPlans.filter((plan) => !plan.autopilot),
    resolvedAutomatically: commonPlans.filter((plan) => plan.autopilot),
  };
}

export function deriveOperationsSnapshot(
  state: GameState,
  controls: OperationsControls,
): OperationsSnapshot {
  const recovery = Math.round(
    state.energy.dispatch.demandResponse * 1800 +
      controls.trafficLoad * 5 +
      controls.eventLoad * 3 +
      state.census.storageSites * 18,
  );
  const mobilityDemand = Math.round(620 + controls.trafficLoad * 18 + state.census.venues * 3);
  const civicDemand = Math.round(480 + controls.eventLoad * 14 + state.census.storageSites * 12);

  const demand = {
    residential: Math.round(state.census.residents * 0.16),
    commercial: Math.round(state.census.businesses * 22 + state.census.shoppers * 0.11),
    industrial: Math.round(state.census.factories * 4.2 + state.census.workers * 0.05),
    mobility: mobilityDemand,
    civic: civicDemand,
  };

  const generation: GenerationBreakdown = {
    solar: state.energy.dispatch.solar,
    fusion: state.energy.dispatch.fusion,
    bio: state.energy.dispatch.bio,
    storageDischarge: state.energy.dispatch.storageDischarge,
    recovery,
  };

  const horizons: HorizonForecast[] = [
    generatePressureSeries(state, controls, 'day'),
    generatePressureSeries(state, controls, 'week'),
    generatePressureSeries(state, controls, 'month'),
    generatePressureSeries(state, controls, 'year'),
  ];

  const stressTests = deriveStressTests(controls, horizons);
  const plans = deriveInterventions(state, controls, horizons, stressTests);

  return {
    mode: plans.interventions.length > 0 ? 'supervised' : 'auto',
    demand,
    generation,
    storage: {
      level: Math.round(state.energy.storageLevel),
      capacity: state.energy.storageCapacity,
      charge: state.energy.dispatch.storageCharge,
      discharge: state.energy.dispatch.storageDischarge,
      recycle: recovery,
    },
    nodes: [
      { id: 'solar', label: '光伏阵列', group: 'source', value: generation.solar },
      { id: 'fusion', label: '聚变基座', group: 'source', value: generation.fusion },
      { id: 'bio', label: '生物质站', group: 'source', value: generation.bio },
      { id: 'recovery', label: '回收能量', group: 'recovery', value: recovery },
      { id: 'grid', label: '城市主母线', group: 'grid', value: state.energy.supply },
      { id: 'storage', label: '储能云仓', group: 'storage', value: Math.round(state.energy.storageLevel) },
      { id: 'housing', label: '住宅负荷', group: 'load', value: demand.residential },
      { id: 'commerce', label: '商业负荷', group: 'load', value: demand.commercial },
      { id: 'industry', label: '工业负荷', group: 'load', value: demand.industrial },
      { id: 'mobility', label: '交通与公共服务', group: 'load', value: demand.mobility + demand.civic },
    ],
    links: [
      { source: 'solar', target: 'grid', value: generation.solar, channel: 'electric' },
      { source: 'fusion', target: 'grid', value: generation.fusion, channel: 'electric' },
      { source: 'bio', target: 'grid', value: generation.bio, channel: 'thermal' },
      { source: 'recovery', target: 'storage', value: recovery, channel: 'recovery' },
      { source: 'grid', target: 'storage', value: state.energy.dispatch.storageCharge, channel: 'electric' },
      { source: 'storage', target: 'grid', value: state.energy.dispatch.storageDischarge, channel: 'electric' },
      { source: 'grid', target: 'housing', value: demand.residential, channel: 'electric' },
      { source: 'grid', target: 'commerce', value: demand.commercial, channel: 'electric' },
      { source: 'grid', target: 'industry', value: demand.industrial, channel: 'electric' },
      { source: 'grid', target: 'mobility', value: demand.mobility + demand.civic, channel: 'electric' },
    ],
    horizons,
    stressTests,
    interventions: plans.interventions,
    resolvedAutomatically: plans.resolvedAutomatically,
    populationProjection: {
      day: Math.round(state.population * (1 + controls.populationDrift / 100 * 0.02)),
      week: Math.round(state.population * (1 + controls.populationDrift / 100 * 0.08)),
      month: Math.round(state.population * (1 + controls.populationDrift / 100 * 0.2)),
      year: Math.round(state.population * (1 + controls.populationDrift / 100 * 0.48)),
    },
  };
}
