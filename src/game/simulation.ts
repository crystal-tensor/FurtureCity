import type {
  AgentMapping,
  AgentProfile,
  Census,
  ConcernWeights,
  EnergyPolicy,
  EnergyStats,
  FeedbackEntry,
  ForecastPoint,
  GameState,
  MixPreference,
  Severity,
  Tile,
  TileType,
} from './types';

const MINUTES_PER_DAY = 24 * 60;

const BUILDING_LABELS: Record<TileType, string> = {
  grass: '绿地',
  water: '水域',
  forest: '森林',
  road: '道路',
  bridge: '桥梁',
  residential: '住宅',
  commercial: '商业',
  industrial: '工业',
  power: '聚变电站',
  solar: '太阳能阵列',
  wind: '风力发电机',
  bio: '生物质站',
  storage: '储能枢纽',
  park: '公园',
  stadium: '体育馆',
  amusement_park: '未来乐园',
  river: '河流',
  lake: '湖泊',
  seaside: '海滨',
  seaside_park: '海滨公园',
  marina: '游艇码头',
};

const AGENT_DEFS = [
  {
    id: 'residential_union',
    name: '住户联席会',
    role: '居住 agent',
    buildingTypes: ['residential'] as TileType[],
    districtFocus: '居住缓冲环',
    activityLevel: 0.84,
    sentimentBias: 0.06,
    influence: 1.08,
    flexibility: 0.14,
    concernWeights: { reliability: 0.36, carbon: 0.16, cost: 0.18, comfort: 0.3 },
    preferredMix: { solar: 0.38, bio: 0.18, storage: 0.24, fusion: 0.2 },
  },
  {
    id: 'retail_circle',
    name: '商圈经营团',
    role: '商业 agent',
    buildingTypes: ['commercial'] as TileType[],
    districtFocus: '中央混合核心',
    activityLevel: 0.78,
    sentimentBias: 0.04,
    influence: 1.02,
    flexibility: 0.22,
    concernWeights: { reliability: 0.31, carbon: 0.19, cost: 0.28, comfort: 0.22 },
    preferredMix: { solar: 0.34, bio: 0.16, storage: 0.2, fusion: 0.3 },
  },
  {
    id: 'industrial_board',
    name: '工业园调度会',
    role: '工业 agent',
    buildingTypes: ['industrial'] as TileType[],
    districtFocus: '工业能源带',
    activityLevel: 0.73,
    sentimentBias: -0.02,
    influence: 1.14,
    flexibility: 0.27,
    concernWeights: { reliability: 0.45, carbon: 0.08, cost: 0.22, comfort: 0.25 },
    preferredMix: { solar: 0.18, bio: 0.18, storage: 0.22, fusion: 0.42 },
  },
  {
    id: 'leisure_alliance',
    name: '文旅场馆联盟',
    role: '文旅 agent',
    buildingTypes: ['stadium', 'amusement_park', 'seaside_park', 'marina', 'park'] as TileType[],
    districtFocus: '滨水韧性区',
    activityLevel: 0.69,
    sentimentBias: 0.08,
    influence: 0.95,
    flexibility: 0.18,
    concernWeights: { reliability: 0.24, carbon: 0.28, cost: 0.12, comfort: 0.36 },
    preferredMix: { solar: 0.42, bio: 0.16, storage: 0.22, fusion: 0.2 },
  },
  {
    id: 'renewable_coop',
    name: '绿电协同社',
    role: '能源生产 agent',
    buildingTypes: ['solar', 'bio', 'storage'] as TileType[],
    districtFocus: '能源绿带',
    activityLevel: 0.66,
    sentimentBias: 0.12,
    influence: 1.12,
    flexibility: 0.34,
    concernWeights: { reliability: 0.18, carbon: 0.42, cost: 0.12, comfort: 0.28 },
    preferredMix: { solar: 0.46, bio: 0.2, storage: 0.24, fusion: 0.1 },
  },
  {
    id: 'grid_orchestrator',
    name: '城市电网中枢',
    role: '调度 agent',
    buildingTypes: ['power', 'storage', 'road', 'bridge'] as TileType[],
    districtFocus: '全城',
    activityLevel: 0.92,
    sentimentBias: 0,
    influence: 1.28,
    flexibility: 0.4,
    concernWeights: { reliability: 0.48, carbon: 0.14, cost: 0.18, comfort: 0.2 },
    preferredMix: { solar: 0.24, bio: 0.18, storage: 0.24, fusion: 0.34 },
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sumConcernWeights(weights: ConcernWeights) {
  return weights.reliability + weights.carbon + weights.cost + weights.comfort;
}

function normalizedMixPreference(preferredMix: MixPreference) {
  const total = preferredMix.solar + preferredMix.bio + preferredMix.storage + preferredMix.fusion;
  return {
    solar: preferredMix.solar / total,
    bio: preferredMix.bio / total,
    storage: preferredMix.storage / total,
    fusion: preferredMix.fusion / total,
  };
}

function deterministicNoise(a: number, b: number, c: number) {
  return Math.abs(Math.sin(a * 12.9898 + b * 78.233 + c * 0.017)) % 1;
}

export function getHour(stateTime: number) {
  return Math.floor((stateTime % MINUTES_PER_DAY) / 60);
}

export function getDay(stateTime: number) {
  return Math.floor(stateTime / MINUTES_PER_DAY) + 1;
}

export function getTimeLabel(stateTime: number) {
  const hour = getHour(stateTime);
  const minutes = Math.floor(stateTime % 60);
  return `D${getDay(stateTime)} ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getDaylightFactor(hour: number) {
  if (hour < 6 || hour > 19) {
    return 0;
  }

  const angle = ((hour - 6) / 13) * Math.PI;
  return Math.sin(angle);
}

function getProfileMultiplier(hour: number, type: 'residential' | 'commercial' | 'industrial' | 'leisure') {
  if (type === 'residential') {
    if (hour < 6) return 1.22;
    if (hour < 9) return 1.06;
    if (hour < 18) return 0.82;
    if (hour < 23) return 1.3;
    return 1.1;
  }

  if (type === 'commercial') {
    if (hour < 8) return 0.2;
    if (hour < 11) return 0.92;
    if (hour < 18) return 1.22;
    if (hour < 21) return 0.78;
    return 0.24;
  }

  if (type === 'industrial') {
    if (hour < 6) return 0.78;
    if (hour < 18) return 1.24;
    if (hour < 22) return 1.05;
    return 0.86;
  }

  if (hour < 8) return 0.18;
  if (hour < 16) return 0.52;
  if (hour < 22) return 1.26;
  return 0.36;
}

function summarizeCensus(grid: Tile[][]): Census {
  const census: Census = {
    residents: 0,
    shoppers: 0,
    workers: 0,
    leisureGuests: 0,
    homes: 0,
    businesses: 0,
    factories: 0,
    venues: 0,
    solarSites: 0,
    windSites: 0,
    bioSites: 0,
    storageSites: 0,
    fusionSites: 0,
  };

  for (const row of grid) {
    for (const tile of row) {
      switch (tile.type) {
        case 'residential':
          census.homes += 1;
          census.residents += tile.population;
          break;
        case 'commercial':
          census.businesses += 1;
          census.shoppers += 45;
          break;
        case 'industrial':
          census.factories += 1;
          census.workers += 65;
          break;
        case 'stadium':
        case 'amusement_park':
        case 'seaside_park':
        case 'marina':
        case 'park':
          census.venues += 1;
          census.leisureGuests += tile.type === 'park' ? 18 : 60;
          break;
        case 'solar':
          census.solarSites += 1;
          break;
        case 'wind':
          census.windSites += 1;
          break;
        case 'bio':
          census.bioSites += 1;
          break;
        case 'storage':
          census.storageSites += 1;
          break;
        case 'power':
          census.fusionSites += 1;
          break;
        default:
          break;
      }
    }
  }

  return census;
}

function resolveCohortSize(agentId: string, census: Census) {
  switch (agentId) {
    case 'residential_union':
      return census.residents;
    case 'retail_circle':
      return census.shoppers + census.businesses * 12;
    case 'industrial_board':
      return census.workers + census.factories * 25;
    case 'leisure_alliance':
      return census.leisureGuests + census.venues * 20;
    case 'renewable_coop':
      return census.solarSites * 40 + census.windSites * 35 + census.bioSites * 55 + census.storageSites * 30;
    case 'grid_orchestrator':
      return census.fusionSites * 80 + census.storageSites * 40 + census.businesses + census.factories;
    default:
      return 0;
  }
}

function buildAgents(previousAgents: AgentProfile[], census: Census) {
  const previousById = new Map(previousAgents.map((agent) => [agent.id, agent]));

  return AGENT_DEFS.map((definition) => {
    const previous = previousById.get(definition.id);
    const cohortSize = resolveCohortSize(definition.id, census);

    return {
      ...definition,
      cohortSize,
      memory: previous?.memory ?? [`${definition.name} 已接入 EnergyCIty 调度链路。`],
      latestFeedback: previous?.latestFeedback ?? '等待新的能源态势。',
      recommendation: previous?.recommendation ?? '维持当前策略，继续监测。',
      satisfaction: previous?.satisfaction ?? 0.78,
      stress: previous?.stress ?? 0.22,
      demandShift: previous?.demandShift ?? 0,
    };
  });
}

function getPolicyBias(policy: EnergyPolicy) {
  switch (policy) {
    case 'green':
      return { fusionFloor: 0.18, reserveTarget: 0.08, greenPush: 0.18, priceRelief: -0.04 };
    case 'resilience':
      return { fusionFloor: 0.34, reserveTarget: 0.16, greenPush: 0.02, priceRelief: 0.08 };
    case 'growth':
      return { fusionFloor: 0.28, reserveTarget: 0.06, greenPush: -0.04, priceRelief: -0.08 };
    default:
      return { fusionFloor: 0.24, reserveTarget: 0.1, greenPush: 0, priceRelief: 0 };
  }
}

function estimateDemand(census: Census, hour: number, weather: number) {
  const residential = census.residents * 0.14 * getProfileMultiplier(hour, 'residential') * (1 + weather / 520);
  const commercial = census.shoppers * 0.085 * getProfileMultiplier(hour, 'commercial');
  const industrial = census.workers * 0.041 * getProfileMultiplier(hour, 'industrial') * (1 + weather / 650);
  const leisureWeatherFactor = 1 - weather / 180;
  const leisure =
    census.leisureGuests * 0.12 * getProfileMultiplier(hour, 'leisure') * clamp(leisureWeatherFactor, 0.45, 1.1);
  const civic = 180 + census.storageSites * 12 + census.fusionSites * 36;

  return residential + commercial + industrial + leisure + civic;
}

function computeEnergyPlan(state: GameState, census: Census, agents: AgentProfile[]): EnergyStats {
  const hour = getHour(state.time);
  const weather = state.weather;
  const daylight = getDaylightFactor(hour);
  const policyBias = getPolicyBias(state.policy);

  const reliabilityPressure = agents.reduce(
    (sum, agent) => sum + agent.concernWeights.reliability * agent.influence,
    0,
  );
  const carbonPressure = agents.reduce((sum, agent) => sum + agent.concernWeights.carbon * agent.influence, 0);
  const costPressure = agents.reduce((sum, agent) => sum + agent.concernWeights.cost * agent.influence, 0);
  const flexibilityPool = agents.reduce(
    (sum, agent) => sum + agent.flexibility * agent.activityLevel * Math.max(agent.cohortSize, 1),
    0,
  );

  const normalizedReliability = reliabilityPressure / agents.length;
  const normalizedCarbon = carbonPressure / agents.length;
  const normalizedCost = costPressure / agents.length;

  const rawDemand = estimateDemand(census, hour, weather);
  const weatherPenalty = 1 - weather / 120;
  const solarCapacity = census.solarSites * 128 * daylight * clamp(weatherPenalty, 0.18, 1);
  const windCapacity = census.windSites * 160 * clamp(0.6 + weather / 150, 0.2, 1.2);
  const bioCapacity = census.bioSites * 142 * clamp(0.88 + weather / 250, 0.9, 1.25);
  const fusionCapacity = census.fusionSites * 3400;
  const storageCapacity = Math.max(3200, census.storageSites * 1600);
  const storagePower = Math.max(320, census.storageSites * 260);
  const previousStorage = clamp(state.energy.storageLevel, 600, storageCapacity);

  const greenBias = clamp(normalizedCarbon + policyBias.greenPush, 0.08, 0.65);
  const solarDispatch = solarCapacity;
  const windDispatch = windCapacity;
  const bioDispatch = Math.min(bioCapacity, rawDemand * (0.24 + greenBias * 0.24));
  const minimumFusion = fusionCapacity * policyBias.fusionFloor;

  let fusionDispatch = clamp(rawDemand - solarDispatch - windDispatch - bioDispatch, minimumFusion, fusionCapacity);
  let storageDischarge = 0;
  let storageCharge = 0;
  let grossSupply = solarDispatch + windDispatch + bioDispatch + fusionDispatch;

  if (grossSupply < rawDemand) {
    const requestedDischarge =
      (rawDemand - grossSupply) * clamp(0.55 + normalizedReliability * 0.16, 0.45, 0.92);
    storageDischarge = Math.min(storagePower, previousStorage, requestedDischarge);
    grossSupply += storageDischarge;
  }

  const maxFlexRatio = clamp(flexibilityPool / 25000, 0.05, 0.26);
  let demandResponse = 0;

  if (grossSupply < rawDemand) {
    demandResponse = clamp((rawDemand - grossSupply) / rawDemand, 0, maxFlexRatio);
  } else if (state.policy === 'green' && daylight > 0.55 && previousStorage < storageCapacity * 0.8) {
    storageCharge = Math.min(storagePower * 0.65, storageCapacity - previousStorage, grossSupply - rawDemand);
  }

  const adjustedDemand = rawDemand * (1 - demandResponse);
  let netSupply = solarDispatch + bioDispatch + fusionDispatch + storageDischarge - storageCharge;

  if (netSupply < adjustedDemand && fusionDispatch < fusionCapacity) {
    const boost = Math.min(fusionCapacity - fusionDispatch, adjustedDemand - netSupply);
    fusionDispatch += boost;
    netSupply += boost;
  }

  if (netSupply > adjustedDemand && storageCharge === 0) {
    storageCharge = Math.min(storagePower * 0.5, storageCapacity - previousStorage, netSupply - adjustedDemand);
    netSupply -= storageCharge;
  }

  const storageLevel = clamp(previousStorage + storageCharge - storageDischarge, 0, storageCapacity);
  const reserveMargin = adjustedDemand > 0 ? (netSupply - adjustedDemand) / adjustedDemand : 0;
  const renewableGeneration = solarDispatch + windDispatch + bioDispatch;
  const grossGeneration = Math.max(renewableGeneration + fusionDispatch + storageDischarge, 1);
  const renewableRatio = renewableGeneration / grossGeneration;
  const fusionShare = fusionDispatch / grossGeneration;
  const priceSignal = clamp(
    0.26 + fusionShare * 0.36 + demandResponse * 0.5 + normalizedCost * 0.05 + policyBias.priceRelief,
    0.08,
    1,
  );
  const outageRisk = clamp(
    Math.max(0, adjustedDemand - netSupply) / Math.max(adjustedDemand, 1) +
      weather / 420 +
      Math.max(0, policyBias.reserveTarget - reserveMargin) * 0.9 -
      demandResponse * 0.16,
    0,
    1,
  );
  const carbonIntensity = clamp(fusionShare * 0.82 + (bioDispatch / grossGeneration) * 0.22, 0.08, 1);
  const comfort = clamp(0.92 - outageRisk * 0.78 - demandResponse * 0.22 + reserveMargin * 0.18, 0.08, 1);
  const efficiency = clamp(0.56 + renewableRatio * 0.18 + (1 - weather / 100) * 0.14 - demandResponse * 0.06, 0.32, 0.98);

  return {
    demand: Math.round(rawDemand),
    adjustedDemand: Math.round(adjustedDemand),
    supply: Math.round(netSupply),
    renewableRatio,
    storageLevel,
    storageCapacity,
    carbonIntensity,
    reserveMargin,
    outageRisk,
    priceSignal,
    comfort,
    efficiency,
    dispatch: {
      fusion: Math.round(fusionDispatch),
      solar: Math.round(solarDispatch),
      bio: Math.round(bioDispatch),
      storageDischarge: Math.round(storageDischarge),
      storageCharge: Math.round(storageCharge),
      demandResponse,
    },
  };
}

function describeEnergyGap(energy: EnergyStats) {
  if (energy.outageRisk > 0.26) {
    return '供电安全边际太薄';
  }
  if (energy.priceSignal > 0.68) {
    return '电价抬升正在压缩活动';
  }
  if (energy.renewableRatio < 0.38) {
    return '绿电占比偏低';
  }
  if (energy.reserveMargin > 0.16) {
    return '当前余量充足，可继续优化碳排';
  }
  return '供需基本贴合，但峰时波动仍需观察';
}

function buildRecommendation(agent: AgentProfile, energy: EnergyStats) {
  if (agent.id === 'grid_orchestrator') {
    if (energy.outageRisk > 0.22) {
      return '优先释放储能并保留 10% 旋转备用。';
    }
    if (energy.renewableRatio < 0.42) {
      return '减少聚变机组底座功率，给白天绿电更高优先级。';
    }
    return '保持自动平衡，继续跟踪下一时段需求斜率。';
  }

  if (energy.outageRisk > 0.24) {
    return '要求调度中心先保可靠性，再讨论成本优化。';
  }

  if (energy.priceSignal > 0.66 && agent.flexibility > 0.18) {
    return '愿意参与弹性负荷转移，但希望换取更低峰时电价。';
  }

  if (energy.renewableRatio < 0.4) {
    return '希望白天更多消纳光伏，夜间再用储能抹平峰值。';
  }

  return '当前策略可接受，建议仅微调储能充放电窗口。';
}

function severityFromSatisfaction(satisfaction: number, energy: EnergyStats): Severity {
  if (satisfaction < 0.45 || energy.outageRisk > 0.24) {
    return 'critical';
  }
  if (satisfaction < 0.68 || energy.priceSignal > 0.62) {
    return 'warn';
  }
  return 'info';
}

function updateAgentStates(previousAgents: AgentProfile[], energy: EnergyStats, state: GameState) {
  const gapDescription = describeEnergyGap(energy);

  return previousAgents.map((agent) => {
    const mixPreference = normalizedMixPreference(agent.preferredMix);
    const reliabilityScore = 1 - energy.outageRisk;
    const carbonScore = 1 - Math.abs(energy.renewableRatio - (mixPreference.solar + mixPreference.bio + mixPreference.storage));
    const costScore = 1 - energy.priceSignal;
    const comfortScore = energy.comfort - energy.dispatch.demandResponse * (1 - agent.flexibility) * 0.25;
    const totalWeight = sumConcernWeights(agent.concernWeights);

    const blended =
      (reliabilityScore * agent.concernWeights.reliability +
        carbonScore * agent.concernWeights.carbon +
        costScore * agent.concernWeights.cost +
        comfortScore * agent.concernWeights.comfort) /
      totalWeight;

    const satisfaction = clamp(blended + agent.sentimentBias * 0.18, 0, 1);
    const stress = clamp(1 - satisfaction, 0, 1);
    const demandShift = -energy.dispatch.demandResponse * agent.flexibility;
    const recommendation = buildRecommendation(agent, energy);
    const latestFeedback = `${gapDescription}，${agent.name}认为${recommendation}`;
    const memoryEntry = `${getTimeLabel(state.time)} ${latestFeedback}`;
    const previousMemory = agent.memory.slice(0, 3);

    return {
      ...agent,
      satisfaction,
      stress,
      demandShift,
      recommendation,
      latestFeedback,
      memory: [memoryEntry, ...previousMemory],
    };
  });
}

function buildFeedbackEntries(agents: AgentProfile[], energy: EnergyStats, time: number) {
  return [...agents]
    .sort((left, right) => right.stress * right.influence - left.stress * left.influence)
    .slice(0, 4)
    .map<FeedbackEntry>((agent, index) => ({
      id: `${agent.id}-${Math.floor(time)}-${index}`,
      time,
      agentId: agent.id,
      agentName: agent.name,
      severity: severityFromSatisfaction(agent.satisfaction, energy),
      title: `${agent.name}反馈`,
      detail: agent.latestFeedback,
      recommendation: agent.recommendation,
    }));
}

function buildMappings(agents: AgentProfile[]): AgentMapping[] {
  return agents.map((agent) => ({
    buildingLabel: agent.buildingTypes.map((type) => BUILDING_LABELS[type]).join(' / '),
    agentName: agent.name,
    role: agent.role,
    cohortSize: Math.round(agent.cohortSize),
    demandFlex: `${Math.round(agent.flexibility * 100)}%`,
  }));
}

function applyPowerStatus(state: GameState) {
  const powerScore = clamp(1 - state.energy.outageRisk - state.energy.dispatch.demandResponse * 0.5, 0.15, 1);

  for (const row of state.grid) {
    for (const tile of row) {
      if (tile.type === 'grass' || tile.type === 'forest' || tile.type === 'water') {
        continue;
      }

      const randomFactor = deterministicNoise(tile.x, tile.y, Math.floor(state.time / 15));
      tile.isPowered = randomFactor < powerScore + (tile.type === 'residential' ? 0.06 : 0);
    }
  }
}

function applyPopulationDynamics(state: GameState) {
  const hour = getHour(state.time);
  if (hour === 0) {
    return;
  }

  for (const row of state.grid) {
    for (const tile of row) {
      if (tile.type !== 'residential') {
        continue;
      }

      const jitter = deterministicNoise(tile.x, tile.y, state.time);
      if (state.energy.comfort > 0.78 && jitter > 0.86 && tile.population < 72) {
        tile.population += 1;
      }

      if (state.energy.outageRisk > 0.22 && jitter < 0.08 && tile.population > 8) {
        tile.population -= 1;
      }
    }
  }
}

function applyEconomicUpdate(state: GameState) {
  const averageSatisfaction =
    state.agents.reduce((sum, agent) => sum + agent.satisfaction, 0) / Math.max(state.agents.length, 1);
  const revenue =
    state.census.residents * 0.48 +
    state.census.businesses * 18 +
    state.census.factories * 26 +
    state.census.venues * 12;
  const cost =
    state.energy.dispatch.fusion * 0.11 +
    state.energy.dispatch.bio * 0.05 +
    (state.energy.dispatch.storageDischarge + state.energy.dispatch.storageCharge) * 0.03;
  const serviceBonus = averageSatisfaction * 1200 - state.energy.outageRisk * 1800;

  state.money = Math.max(0, Math.round(state.money + revenue - cost + serviceBonus));
}

function buildForecast(state: GameState): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const currentHour = getHour(state.time);

  for (let offset = 1; offset <= 6; offset += 1) {
    const futureHour = (currentHour + offset) % 24;
    const daylight = getDaylightFactor(futureHour);
    const futureDemand = estimateDemand(state.census, futureHour, state.weather);
    const futureSupply =
      state.census.solarSites * 128 * daylight * clamp(1 - state.weather / 120, 0.18, 1) +
      state.census.windSites * 160 * clamp(0.6 + state.weather / 150, 0.2, 1.2) +
      state.census.bioSites * 142 +
      state.census.fusionSites * 3400 * getPolicyBias(state.policy).fusionFloor +
      Math.min(state.energy.storageLevel / 3, state.census.storageSites * 220);

    points.push({
      hourOffset: offset,
      demand: Math.round(futureDemand),
      supply: Math.round(futureSupply),
      renewableRatio:
        futureSupply > 0
          ? clamp(
              (state.census.solarSites * 128 * daylight * clamp(1 - state.weather / 120, 0.18, 1) +
                state.census.windSites * 160 * clamp(0.6 + state.weather / 150, 0.2, 1.2) +
                state.census.bioSites * 142) /
                futureSupply,
              0,
              1,
            )
          : 0,
    });
  }

  return points;
}

export function tick(state: GameState, minutes = 8) {
  const previousHour = Math.floor(state.time / 60);

  state.time += minutes;
  state.census = summarizeCensus(state.grid);
  state.population = state.census.residents;

  const baseAgents = buildAgents(state.agents, state.census);
  state.energy = computeEnergyPlan(state, state.census, baseAgents);
  state.agents = updateAgentStates(baseAgents, state.energy, state);
  state.mappings = buildMappings(state.agents);
  state.forecast = buildForecast(state);

  applyPowerStatus(state);

  const nextHour = Math.floor(state.time / 60);
  if (nextHour !== previousHour) {
    applyPopulationDynamics(state);
    state.feedback = [...buildFeedbackEntries(state.agents, state.energy, state.time), ...state.feedback].slice(0, 18);
    applyEconomicUpdate(state);
  }
}

export function setPolicy(state: GameState, policy: EnergyPolicy) {
  state.policy = policy;
  const policyFeedback: FeedbackEntry = {
    id: `policy-${policy}-${Math.floor(state.time)}`,
    time: state.time,
    agentId: 'grid_orchestrator',
    agentName: '城市电网中枢',
    severity: 'info',
    title: `切换策略: ${policy}`,
    detail: `EnergyCIty 已切换到 ${policy} 模式，所有 agent 会按新的能量优先级重新评估。`,
    recommendation: '观察下一小时 reserve margin 与反馈热度是否改善。',
  };

  state.feedback = [
    policyFeedback,
    ...state.feedback,
  ].slice(0, 18);
}

export function updateWeather(state: GameState, weather: number) {
  state.weather = clamp(weather, 0, 100);
}

export function renderStateSummary(state: GameState) {
  const topAgents = [...state.agents]
    .sort((left, right) => right.stress - left.stress)
    .slice(0, 3)
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      satisfaction: Number(agent.satisfaction.toFixed(2)),
      stress: Number(agent.stress.toFixed(2)),
      recommendation: agent.recommendation,
    }));

  return JSON.stringify(
    {
      coordinateSystem: 'grid x right, y down; isometric canvas projection',
      time: getTimeLabel(state.time),
      weather: state.weather,
      policy: state.policy,
      population: state.population,
      money: state.money,
      energy: {
        demand: state.energy.demand,
        adjustedDemand: state.energy.adjustedDemand,
        supply: state.energy.supply,
        renewableRatio: Number(state.energy.renewableRatio.toFixed(2)),
        storageLevel: Math.round(state.energy.storageLevel),
        outageRisk: Number(state.energy.outageRisk.toFixed(2)),
        priceSignal: Number(state.energy.priceSignal.toFixed(2)),
      },
      census: state.census,
      topAgents,
      latestFeedback: state.feedback.slice(0, 2).map((entry) => ({
        agent: entry.agentName,
        severity: entry.severity,
        recommendation: entry.recommendation,
      })),
    },
    null,
    2,
  );
}
