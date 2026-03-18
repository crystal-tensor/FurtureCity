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

// --- OASIS Agent Simulation Types ---

export type AgentDomain =
  | 'Residential'
  | 'Industrial'
  | 'Commercial'
  | 'Mobility'
  | 'Civic';

export type AgentActionType =
  | 'ADJUST_CONSUMPTION' // Rate change (-1.0 to 1.0)
  | 'SHIFT_LOAD' // Move load to off-peak
  | 'START_BACKUP' // Use diesel generator
  | 'BUY_POWER' // Accept high spot price
  | 'SELL_STORED' // VPP selling
  | 'POST_COMPLAINT' // Social media complaint
  | 'ENDORSE_POLICY' // Support energy policy
  | 'DO_NOTHING';

export interface AgentAction {
  type: AgentActionType;
  args?: Record<string, any>;
  timestamp: number;
}

export interface OasisAgent {
  id: string;
  name: string;
  domain: AgentDomain;
  description: string;
  count: number; // Number of represented real-world agents
  
  // State
  satisfaction: number; // 0-100
  stress: number; // 0-100
  energyConsumption: number; // Current normalized consumption
  
  // Personality / Profile
  priceSensitivity: number; // 0-1
  comfortPriority: number; // 0-1
  flexibility: number; // 0-1 (Ability to shift load)
  socialInfluence: number; // 0-1
  
  // History
  recentActions: AgentAction[];
  lastThought: string; // LLM inner monologue
}

export interface OasisSimulationStep {
  step: number; // Hour 0-23
  timestamp: number;
  
  // Aggregated Metrics
  totalDemand: number;
  gridStress: number;
  averageSatisfaction: number;
  socialSentiment: number; // -100 to 100
  
  // Agent Updates
  activeAgents: OasisAgent[]; // Agents who took significant actions this step
  socialFeed: {
    agentId: string;
    agentName: string;
    content: string;
    likes: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }[];
}

export interface OasisSimulationResult {
  steps: OasisSimulationStep[];
  agents: OasisAgent[]; // Added for backend compatibility
  aggregatedStats: {
    peakDemand: number;
    totalComplaintVolume: number;
    carbonImpact: number;
    economicLoss: number;
  };
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
  nuclear: number;
  thermal: number;
  hydro: number;
  wind: number;
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
