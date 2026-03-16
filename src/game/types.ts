export type TileType =
  | 'grass'
  | 'water'
  | 'river'
  | 'lake'
  | 'seaside'
  | 'forest'
  | 'road'
  | 'bridge'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'power'
  | 'solar'
  | 'wind'
  | 'bio'
  | 'storage'
  | 'park'
  | 'stadium'
  | 'amusement_park'
  | 'seaside_park'
  | 'marina';

export type EnergyPolicy = 'balanced' | 'green' | 'resilience' | 'growth';
export type HorizonKey = 'day' | 'week' | 'month' | 'year';
export type AutomationMode = 'auto' | 'supervised';

export type Severity = 'info' | 'warn' | 'critical';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  level: number;
  population: number;
  isPowered: boolean;
  isWatered: boolean;
  district: string;
}

export interface DispatchPlan {
  fusion: number;
  solar: number;
  bio: number;
  storageDischarge: number;
  storageCharge: number;
  demandResponse: number;
}

export interface EnergyStats {
  demand: number;
  adjustedDemand: number;
  supply: number;
  renewableRatio: number;
  storageLevel: number;
  storageCapacity: number;
  carbonIntensity: number;
  reserveMargin: number;
  outageRisk: number;
  priceSignal: number;
  comfort: number;
  efficiency: number;
  dispatch: DispatchPlan;
}

export interface ConcernWeights {
  reliability: number;
  carbon: number;
  cost: number;
  comfort: number;
}

export interface MixPreference {
  solar: number;
  bio: number;
  storage: number;
  fusion: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  buildingTypes: TileType[];
  districtFocus: string;
  cohortSize: number;
  activityLevel: number;
  sentimentBias: number;
  influence: number;
  flexibility: number;
  concernWeights: ConcernWeights;
  preferredMix: MixPreference;
  memory: string[];
  latestFeedback: string;
  recommendation: string;
  satisfaction: number;
  stress: number;
  demandShift: number;
}

export interface FeedbackEntry {
  id: string;
  time: number;
  agentId: string;
  agentName: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
}

export interface AgentMapping {
  buildingLabel: string;
  agentName: string;
  role: string;
  cohortSize: number;
  demandFlex: string;
}

export interface Census {
  residents: number;
  shoppers: number;
  workers: number;
  leisureGuests: number;
  homes: number;
  businesses: number;
  factories: number;
  venues: number;
  solarSites: number;
  windSites: number;
  bioSites: number;
  storageSites: number;
  fusionSites: number;
}

export interface ForecastPoint {
  hourOffset: number;
  demand: number;
  supply: number;
  renewableRatio: number;
}

export interface OperationsControls {
  populationDrift: number;
  weatherVolatility: number;
  trafficLoad: number;
  industrialLoad: number;
  eventLoad: number;
  alertThreshold: number;
}

export interface EnergyFlowNode {
  id: string;
  label: string;
  group: 'source' | 'grid' | 'storage' | 'load' | 'recovery';
  value: number;
}

export interface EnergyFlowLink {
  source: string;
  target: string;
  value: number;
  channel: 'electric' | 'thermal' | 'recovery';
}

export interface DemandBreakdown {
  residential: number;
  commercial: number;
  industrial: number;
  mobility: number;
  civic: number;
}

export interface GenerationBreakdown {
  solar: number;
  fusion: number;
  bio: number;
  storageDischarge: number;
  recovery: number;
}

export interface StorageSnapshot {
  level: number;
  capacity: number;
  charge: number;
  discharge: number;
  recycle: number;
}

export interface ForecastPressurePoint {
  label: string;
  demand: number;
  supply: number;
  pressure: number;
  reserve: number;
  renewableRatio: number;
}

export interface HorizonForecast {
  horizon: HorizonKey;
  title: string;
  peakPressure: number;
  averagePressure: number;
  hoursAtRisk: number;
  worstWindow: string;
  confidence: number;
  recommendedPolicy: EnergyPolicy;
  points: ForecastPressurePoint[];
}

export interface StressScenario {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  pressure: number;
  aiAction: string;
  requiresHuman: boolean;
}

export interface InterventionPlan {
  id: string;
  title: string;
  reason: string;
  impact: string;
  autopilot: boolean;
  policy: EnergyPolicy;
}

export interface OperationsSnapshot {
  mode: AutomationMode;
  demand: DemandBreakdown;
  generation: GenerationBreakdown;
  storage: StorageSnapshot;
  nodes: EnergyFlowNode[];
  links: EnergyFlowLink[];
  horizons: HorizonForecast[];
  stressTests: StressScenario[];
  interventions: InterventionPlan[];
  resolvedAutomatically: InterventionPlan[];
  populationProjection: Record<HorizonKey, number>;
}

export interface GameState {
  grid: Tile[][];
  money: number;
  population: number;
  time: number;
  gridWidth: number;
  gridHeight: number;
  selectedTool: TileType | 'cursor' | 'bulldozer';
  weather: number;
  policy: EnergyPolicy;
  autoBalance: boolean;
  energy: EnergyStats;
  agents: AgentProfile[];
  feedback: FeedbackEntry[];
  mappings: AgentMapping[];
  census: Census;
  forecast: ForecastPoint[];
}

export const TILE_SIZE = 32;
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;
