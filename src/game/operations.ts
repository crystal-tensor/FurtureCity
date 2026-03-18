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
  OasisAgent,
  OasisSimulationResult,
  OasisSimulationStep,
  AgentAction,
  AgentActionType,
  AgentDomain,
} from './types';

// --- OASIS Agent Simulation Implementation ---

const AGENT_TEMPLATES: Omit<OasisAgent, 'recentActions' | 'lastThought'>[] = [
  // 1. Residential & Community
  {
    id: 'res-low-income',
    name: '低收入家庭',
    domain: 'Residential',
    description: '对电价极度敏感，宁愿忍受高温也会关闭空调。',
    count: 150000,
    satisfaction: 70,
    stress: 40,
    energyConsumption: 0.4,
    priceSensitivity: 0.95,
    comfortPriority: 0.3,
    flexibility: 0.8,
    socialInfluence: 0.2,
  },
  {
    id: 'res-middle-class',
    name: '中产通勤族',
    domain: 'Residential',
    description: '关注舒适度，拥有电动汽车，晚高峰集中用电。',
    count: 300000,
    satisfaction: 80,
    stress: 30,
    energyConsumption: 1.2,
    priceSensitivity: 0.6,
    comfortPriority: 0.8,
    flexibility: 0.4,
    socialInfluence: 0.6,
  },
  {
    id: 'res-high-net',
    name: '高净值别墅',
    domain: 'Residential',
    description: '电价不敏感，全天候中央空调，可能有光伏储能。',
    count: 50000,
    satisfaction: 90,
    stress: 10,
    energyConsumption: 3.5,
    priceSensitivity: 0.1,
    comfortPriority: 1.0,
    flexibility: 0.2,
    socialInfluence: 0.8,
  },
  {
    id: 'res-remote-worker',
    name: '居家办公者',
    domain: 'Residential',
    description: '全天平稳负荷，对断电零容忍。',
    count: 100000,
    satisfaction: 75,
    stress: 50,
    energyConsumption: 1.0,
    priceSensitivity: 0.5,
    comfortPriority: 0.9,
    flexibility: 0.3,
    socialInfluence: 0.5,
  },
  {
    id: 'res-old-community',
    name: '老旧小区物业',
    domain: 'Residential',
    description: '线路老化，易跳闸，对改造政策敏感。',
    count: 200,
    satisfaction: 60,
    stress: 70,
    energyConsumption: 5.0,
    priceSensitivity: 0.7,
    comfortPriority: 0.4,
    flexibility: 0.1,
    socialInfluence: 0.4,
  },

  // 2. Industrial & Manufacturing
  {
    id: 'ind-heavy',
    name: '重工业 (钢铁/化工)',
    domain: 'Industrial',
    description: '高耗能，停工成本大，可能违规用电。',
    count: 50,
    satisfaction: 65,
    stress: 60,
    energyConsumption: 100.0,
    priceSensitivity: 0.4,
    comfortPriority: 0.1,
    flexibility: 0.1,
    socialInfluence: 0.7,
  },
  {
    id: 'ind-precision',
    name: '精密制造 (半导体)',
    domain: 'Industrial',
    description: '电能质量要求极高，愿付高价保供。',
    count: 30,
    satisfaction: 85,
    stress: 20,
    energyConsumption: 80.0,
    priceSensitivity: 0.2,
    comfortPriority: 0.0,
    flexibility: 0.0,
    socialInfluence: 0.6,
  },
  {
    id: 'ind-flexible',
    name: '柔性代工厂',
    domain: 'Industrial',
    description: '生产有弹性，愿为电费折扣调整班次。',
    count: 200,
    satisfaction: 70,
    stress: 50,
    energyConsumption: 40.0,
    priceSensitivity: 0.9,
    comfortPriority: 0.0,
    flexibility: 0.9,
    socialInfluence: 0.3,
  },
  {
    id: 'ind-datacenter',
    name: '数据中心',
    domain: 'Industrial',
    description: '耗电大户，负载平稳，可调用 UPS 调节。',
    count: 15,
    satisfaction: 80,
    stress: 30,
    energyConsumption: 150.0,
    priceSensitivity: 0.3,
    comfortPriority: 0.0,
    flexibility: 0.2,
    socialInfluence: 0.5,
  },

  // 3. Commercial & Services
  {
    id: 'com-mall',
    name: '超级商业综合体',
    domain: 'Commercial',
    description: '照明空调负荷大，客流决定耗电。',
    count: 40,
    satisfaction: 75,
    stress: 40,
    energyConsumption: 60.0,
    priceSensitivity: 0.5,
    comfortPriority: 0.9,
    flexibility: 0.3,
    socialInfluence: 0.8,
  },
  {
    id: 'com-retail',
    name: '街边小微商户',
    domain: 'Commercial',
    description: '利润薄，电价上涨时可能缩短营业。',
    count: 5000,
    satisfaction: 60,
    stress: 80,
    energyConsumption: 2.0,
    priceSensitivity: 0.9,
    comfortPriority: 0.6,
    flexibility: 0.7,
    socialInfluence: 0.4,
  },
  {
    id: 'com-hotel',
    name: '星级酒店',
    domain: 'Commercial',
    description: '必须维持高体验，难削减负荷。',
    count: 80,
    satisfaction: 85,
    stress: 25,
    energyConsumption: 30.0,
    priceSensitivity: 0.2,
    comfortPriority: 1.0,
    flexibility: 0.1,
    socialInfluence: 0.6,
  },
  {
    id: 'com-office',
    name: '写字楼运营方',
    domain: 'Commercial',
    description: '可控温控光，响应节能倡议求 ESG 评分。',
    count: 300,
    satisfaction: 70,
    stress: 45,
    energyConsumption: 50.0,
    priceSensitivity: 0.4,
    comfortPriority: 0.7,
    flexibility: 0.6,
    socialInfluence: 0.5,
  },

  // 4. Mobility & Infrastructure
  {
    id: 'mob-metro',
    name: '城市地铁调度',
    domain: 'Mobility',
    description: '早晚高峰负荷高，可调发车频次。',
    count: 10,
    satisfaction: 80,
    stress: 60,
    energyConsumption: 200.0,
    priceSensitivity: 0.1,
    comfortPriority: 0.5,
    flexibility: 0.3,
    socialInfluence: 0.9,
  },
  {
    id: 'mob-bus',
    name: '电动公交车队',
    domain: 'Mobility',
    description: '夜间充电，拥堵时需日间补电。',
    count: 20,
    satisfaction: 75,
    stress: 50,
    energyConsumption: 80.0,
    priceSensitivity: 0.4,
    comfortPriority: 0.6,
    flexibility: 0.5,
    socialInfluence: 0.7,
  },
  {
    id: 'mob-streetlamp',
    name: '市政路灯管理',
    domain: 'Mobility',
    description: '负荷固定，可隔盏亮灯削峰。',
    count: 5,
    satisfaction: 90,
    stress: 10,
    energyConsumption: 20.0,
    priceSensitivity: 0.0,
    comfortPriority: 0.2,
    flexibility: 0.8,
    socialInfluence: 0.3,
  },
  {
    id: 'mob-ev-station',
    name: '充电站运营商',
    domain: 'Mobility',
    description: '根据电价动态调整服务费。',
    count: 100,
    satisfaction: 70,
    stress: 40,
    energyConsumption: 40.0,
    priceSensitivity: 0.8,
    comfortPriority: 0.0,
    flexibility: 0.9,
    socialInfluence: 0.5,
  },
  {
    id: 'mob-water',
    name: '水务处理厂',
    domain: 'Mobility',
    description: '高能耗，可将任务移至夜间。',
    count: 8,
    satisfaction: 85,
    stress: 20,
    energyConsumption: 120.0,
    priceSensitivity: 0.6,
    comfortPriority: 0.0,
    flexibility: 0.7,
    socialInfluence: 0.2,
  },

  // 5. Civic & Events
  {
    id: 'civ-stadium',
    name: '大型体育馆',
    domain: 'Civic',
    description: '活动时脉冲式高负荷。',
    count: 5,
    satisfaction: 80,
    stress: 30,
    energyConsumption: 100.0,
    priceSensitivity: 0.3,
    comfortPriority: 0.8,
    flexibility: 0.2,
    socialInfluence: 0.9,
  },
  {
    id: 'civ-tourism',
    name: '旅游景点运营',
    domain: 'Civic',
    description: '受天气影响大，恶劣天气能耗低。',
    count: 30,
    satisfaction: 75,
    stress: 40,
    energyConsumption: 25.0,
    priceSensitivity: 0.5,
    comfortPriority: 0.7,
    flexibility: 0.4,
    socialInfluence: 0.6,
  },
  {
    id: 'civ-hospital',
    name: '三甲医院',
    domain: 'Civic',
    description: '生命线单位，不可断电，最高优先级。',
    count: 12,
    satisfaction: 95,
    stress: 90,
    energyConsumption: 60.0,
    priceSensitivity: 0.0,
    comfortPriority: 1.0,
    flexibility: 0.0,
    socialInfluence: 1.0,
  },
  {
    id: 'civ-vpp',
    name: '分布式储能云商',
    domain: 'Civic',
    description: '低买高卖套利，削峰填谷。',
    count: 50,
    satisfaction: 70,
    stress: 30,
    energyConsumption: -10.0, // Negative implies supply capability
    priceSensitivity: 1.0,
    comfortPriority: 0.0,
    flexibility: 1.0,
    socialInfluence: 0.4,
  },
];

const COMPLAINT_TEMPLATES = [
  "电价太贵了，根本用不起！",
  "这么热的天还要限电，怎么活？",
  "工厂又要停工了，订单怎么办？",
  "地铁空调都不开了，热死人。",
  "为了环保支持涨价，但希望能透明点。",
  "家里停电了，冰箱东西全坏了！",
  "充电费涨了三倍，开电车还不如油车。",
  "由于电压波动，精密仪器报错了。",
  "商场空调太足了，浪费资源。",
  "还好装了光伏，这波涨价没受影响。",
];

export async function simulateOasisPressureTest(
  controls: OperationsControls
): Promise<OasisSimulationResult> {
  try {
    const response = await fetch('http://localhost:8000/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(controls),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    
    // Calculate aggregated stats on frontend
    const steps = data.steps;
    const peakDemand = Math.max(...steps.map((s: any) => s.totalDemand));
    const totalComplaintVolume = steps.reduce((sum: number, s: any) => sum + s.socialFeed.length, 0);

    return {
      steps: data.steps,
      agents: data.agents,
      aggregatedStats: {
        peakDemand,
        totalComplaintVolume,
        carbonImpact: peakDemand * 0.0005, // Mock calc
        economicLoss: totalComplaintVolume * 1000, // Mock calc
      }
    };
  } catch (error) {
    console.error('OASIS Simulation failed, falling back to mock:', error);
    // Simulate network latency for mock
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return generateMockOasisResult(controls);
  }
}

function generateMockOasisResult(controls: OperationsControls): OasisSimulationResult {
  const agents: OasisAgent[] = AGENT_TEMPLATES.map(t => ({
    ...t,
    recentActions: [],
    lastThought: '',
  }));

  const steps: OasisSimulationStep[] = [];

  // Context factors from controls
  const weatherStress = controls.weatherVolatility / 100; // 0-1
  const trafficStress = controls.trafficLoad / 100;
  const popGrowth = controls.populationDrift / 100;
  const indGrowth = controls.industrialLoad / 100;
  const eventStress = controls.eventLoad / 100;

  // Simulate 24 hours
  for (let hour = 0; hour < 24; hour++) {
    const isDay = hour >= 6 && hour <= 18;
    const isPeak = (hour >= 8 && hour <= 11) || (hour >= 18 && hour <= 22);
    
    let stepDemand = 0;
    let stepSatisfaction = 0;
    const stepFeed: OasisSimulationStep['socialFeed'] = [];
    const activeAgents: OasisAgent[] = [];

    // Environmental Price Signal (Simulated grid logic)
    // High demand + stress = high price
    let currentPrice = 1.0;
    if (isPeak) currentPrice *= 1.5;
    if (weatherStress > 0.7) currentPrice *= 1.3; // Heatwave pricing
    if (indGrowth > 0.5) currentPrice *= 1.2;

    agents.forEach(agent => {
      // 1. Determine base load for this hour
      let loadFactor = 1.0;
      if (agent.domain === 'Residential') {
        loadFactor = isPeak ? 1.5 : 0.6;
        if (weatherStress > 0.5) loadFactor += weatherStress * 0.8; // AC load
      } else if (agent.domain === 'Industrial') {
        loadFactor = isDay ? 1.2 : 0.8;
        loadFactor *= (1 + indGrowth);
      } else if (agent.domain === 'Commercial') {
        loadFactor = isDay ? 1.4 : 0.3;
        if (weatherStress > 0.6) loadFactor += 0.3; // Mall AC
      } else if (agent.domain === 'Mobility') {
        if (agent.id === 'mob-metro' || agent.id === 'mob-bus') {
           loadFactor = (hour === 8 || hour === 18) ? 1.8 : 1.0;
           if (trafficStress > 0.5) loadFactor += trafficStress * 0.5;
        }
      } else if (agent.domain === 'Civic') {
         if (agent.id === 'civ-stadium' && eventStress > 0.5 && hour === 20) {
             loadFactor = 3.0; // Event spike
         }
      }

      // 2. Agent Decision (OASIS Logic Mock)
      // Check if price is too high for this agent
      const pricePain = Math.max(0, currentPrice - 1.0) * agent.priceSensitivity;
      const comfortPain = weatherStress * agent.comfortPriority;
      
      let action: AgentActionType = 'DO_NOTHING';
      let consumptionModifier = 1.0;
      let sentimentDelta = 0;
      let thought = '';

      // Logic: If pain is high, try to reduce consumption or complain
      if (pricePain > 0.4 && agent.flexibility > 0.3) {
        action = 'SHIFT_LOAD';
        consumptionModifier = 0.6; // Shifted away
        thought = `电价太高 (${currentPrice.toFixed(1)}x)，我决定推迟用电。`;
      } else if (pricePain > 0.6 && agent.flexibility <= 0.3) {
        action = 'POST_COMPLAINT';
        sentimentDelta = -10;
        thought = `电价太贵了又没法停工，太难了！`;
      } else if (comfortPain > 0.7 && agent.comfortPriority > 0.6) {
        action = 'ADJUST_CONSUMPTION';
        consumptionModifier = 1.2; // Crank up AC despite price
        thought = `太热了，不管电费了，空调开最大！`;
      } else if (agent.id === 'civ-vpp' && currentPrice > 1.4) {
        action = 'SELL_STORED';
        thought = `现在电价高，正是卖电获利的好时机。`;
      }

      // 3. Update Agent State
      agent.energyConsumption = agent.energyConsumption * loadFactor * consumptionModifier;
      agent.satisfaction = clamp(agent.satisfaction - pricePain * 20 + (comfortPain > 0.5 && consumptionModifier > 1 ? 5 : -comfortPain * 10), 0, 100);
      agent.lastThought = thought;

      if (action !== 'DO_NOTHING') {
        agent.recentActions.push({ type: action, timestamp: Date.now() });
        activeAgents.push({ ...agent }); // Snapshot for UI
      }

      // 4. Generate Social Feed
      if (action === 'POST_COMPLAINT' || (Math.random() < 0.05 && agent.satisfaction < 50)) {
        const template = COMPLAINT_TEMPLATES[Math.floor(Math.random() * COMPLAINT_TEMPLATES.length)];
        stepFeed.push({
          agentId: agent.id,
          agentName: agent.name,
          content: template,
          likes: Math.floor(Math.random() * 50 + agent.socialInfluence * 100),
          sentiment: 'negative',
        });
      }

      stepDemand += agent.energyConsumption * agent.count;
      stepSatisfaction += agent.satisfaction;
    });

    steps.push({
      step: hour,
      timestamp: Date.now() + hour * 3600000,
      totalDemand: stepDemand,
      gridStress: clamp(stepDemand / 5000000, 0, 1), // Normalized stress
      averageSatisfaction: stepSatisfaction / agents.length,
      socialSentiment: stepFeed.filter(f => f.sentiment === 'negative').length * -5 + 50,
      activeAgents: activeAgents.slice(0, 5), // Top 5 active
      socialFeed: stepFeed.slice(0, 3), // Top 3 posts
    });
  }

  // Calculate aggregates
  const peakDemand = Math.max(...steps.map(s => s.totalDemand));
  const totalComplaintVolume = steps.reduce((sum, s) => sum + s.socialFeed.length, 0);

  return {
    steps,
    agents,
    aggregatedStats: {
      peakDemand,
      totalComplaintVolume,
      carbonImpact: peakDemand * 0.0005 * (1 + indGrowth), // Mock calc
      economicLoss: totalComplaintVolume * 1000 + (weatherStress * 50000), // Mock calc
    },
  };
}

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
    // Calibrated to ~7,400 MWh/1M people/year -> ~0.84 MWh/person/hour average peak equivalent
    // Residential: ~30% of total load
    residential: Math.round(state.census.residents * 0.28),
    // Commercial: ~25% of total load (businesses + shoppers)
    commercial: Math.round(state.census.businesses * 45 + state.census.shoppers * 0.18),
    // Industrial: ~35% of total load
    industrial: Math.round(state.census.factories * 12.5 + state.census.workers * 0.15),
    // Mobility & Civic: ~10% of total load
    mobility: mobilityDemand,
    civic: civicDemand,
  };

  // Calculate total generation based on demand and 2025 mix targets
  // Target: ~97,159 Total (100%)
  // Fossil/Thermal (Fusion in game): ~64.8%
  // Hydro (mapped to Fusion/Grid): ~13.5%
  // Wind: ~10.8%
  // Solar: ~5.9%
  // Nuclear (Fusion): ~5.0%
  // Bio: ~1.9%
  // Other: ~1.2%
  
  // Game Mapping:
  // Fusion = Thermal + Hydro + Nuclear + Wind (Base load & large scale) = 64.8 + 13.5 + 5.0 + 10.8 = 94.1%
  // Solar = Solar = 5.9%
  // Bio = Bio = 1.9% (scaled up slightly for visibility if needed)
  
  // To make the game playable, we'll adjust the generation sources to reflect this mix
  // relative to the current demand to ensure supply meets demand initially.
  
  const totalDemand = demand.residential + demand.commercial + demand.industrial + demand.mobility + demand.civic;
  // Add some buffer for storage charging
  const targetSupply = totalDemand * 1.1; 

  const generation: GenerationBreakdown = {
    // Thermal (Coal/Gas): ~64.8%
    thermal: Math.round(targetSupply * 0.648),
    // Hydro: ~13.5%
    hydro: Math.round(targetSupply * 0.135),
    // Nuclear: ~5.0%
    nuclear: Math.round(targetSupply * 0.050),
    // Wind: ~10.8%
    wind: Math.round(targetSupply * 0.108),
    // Solar: ~5.9%
    solar: Math.round(targetSupply * 0.059),
    // Bio: ~1.9%
    bio: Math.round(targetSupply * 0.019),
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
      { id: 'thermal', label: '火电基座', group: 'source', value: generation.thermal },
      { id: 'hydro', label: '水电站', group: 'source', value: generation.hydro },
      { id: 'nuclear', label: '核电站', group: 'source', value: generation.nuclear },
      { id: 'wind', label: '风力场', group: 'source', value: generation.wind },
      { id: 'solar', label: '光伏阵列', group: 'source', value: generation.solar },
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
      { source: 'thermal', target: 'grid', value: generation.thermal, channel: 'electric' },
      { source: 'hydro', target: 'grid', value: generation.hydro, channel: 'electric' },
      { source: 'nuclear', target: 'grid', value: generation.nuclear, channel: 'electric' },
      { source: 'wind', target: 'grid', value: generation.wind, channel: 'electric' },
      { source: 'solar', target: 'grid', value: generation.solar, channel: 'electric' },
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
