import type { Census, EnergyStats, GameState, Tile, TileType } from './types';
import { MAP_HEIGHT, MAP_WIDTH } from './types';

const BASE_ENERGY: EnergyStats = {
  demand: 0,
  adjustedDemand: 0,
  supply: 0,
  renewableRatio: 0,
  storageLevel: 12800,
  storageCapacity: 4000,
  carbonIntensity: 0,
  reserveMargin: 0,
  outageRisk: 0,
  priceSignal: 0.3,
  comfort: 0.8,
  efficiency: 0.72,
  dispatch: {
    fusion: 0,
    solar: 0,
    bio: 0,
    storageDischarge: 0,
    storageCharge: 0,
    demandResponse: 0,
  },
};

const EMPTY_CENSUS: Census = {
  residents: 0,
  shoppers: 0,
  workers: 0,
  leisureGuests: 0,
  homes: 0,
  businesses: 0,
  factories: 0,
  venues: 0,
  solarSites: 0,
  bioSites: 0,
  storageSites: 0,
  fusionSites: 0,
  windSites: 0,
};

function getDistrictLabel(x: number, y: number): string {
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;

  if (x < 18 || y < 18) {
    return '滨水韧性区';
  }

  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) {
    return '中央混合核心';
  }

  if (dist < 22) {
    return '居住缓冲环';
  }

  if (x > MAP_WIDTH - 25 || y > MAP_HEIGHT - 25) {
    return '工业能源带';
  }

  return '生态外缘';
}

function createTile(x: number, y: number, type: TileType, population = 0): Tile {
  return {
    x,
    y,
    type,
    level: type === 'residential' ? 1 : 0,
    population,
    isPowered: true,
    isWatered: true,
    district: getDistrictLabel(x, y),
  };
}

export function generateRandomLayout(state: GameState): GameState {
  const grid: Tile[][] = [];
  let population = 0;

  // Randomize Map features configuration
  const SEASIDE_WIDTH = 8 + Math.floor(Math.random() * 8); // 8 to 15
  const LAKE_CENTER_X = MAP_WIDTH * (0.6 + Math.random() * 0.3); // 0.6 to 0.9
  const LAKE_CENTER_Y = MAP_HEIGHT * (0.15 + Math.random() * 0.25); // 0.15 to 0.4
  const LAKE_RADIUS = 6 + Math.floor(Math.random() * 8); // 6 to 13
  const RIVER_Y_START = MAP_HEIGHT * (0.4 + Math.random() * 0.4); // 0.4 to 0.8
  const RIVER_WAVE_SPEED_1 = 0.02 + Math.random() * 0.06;
  const RIVER_WAVE_SPEED_2 = 0.05 + Math.random() * 0.1;
  
  const CITY_CENTER_X = MAP_WIDTH / 2 + (Math.random() * 20 - 10);
  const CITY_CENTER_Y = MAP_HEIGHT / 2 + (Math.random() * 20 - 10);
  const CITY_RADIUS = 15 + Math.floor(Math.random() * 10);

  const coastNoiseSeed1 = Math.random();
  const coastNoiseSeed2 = Math.random();

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];

    for (let x = 0; x < MAP_WIDTH; x++) {
      let type: TileType = 'grass';
      let tilePopulation = 0;

      // 1. Natural Landscapes
      
      // Seaside (West/Left side)
      if (x < SEASIDE_WIDTH + 4) {
        // Irregular coastline
        const coastNoise = Math.sin(y * (0.1 + coastNoiseSeed1 * 0.2)) * 3 + Math.cos(y * (0.3 + coastNoiseSeed2 * 0.3)) * 2;
        if (x < SEASIDE_WIDTH - 4 + coastNoise) {
          type = 'seaside';
        } else if (x < SEASIDE_WIDTH - 1 + coastNoise) {
          type = 'seaside_park'; // Beach/Sand
        }
      }

      // Lake
      if (type === 'grass' || type === 'seaside_park') {
        const distToLake = Math.sqrt(Math.pow(x - LAKE_CENTER_X, 2) + Math.pow(y - LAKE_CENTER_Y, 2));
        if (distToLake < LAKE_RADIUS + Math.sin(Math.atan2(y - LAKE_CENTER_Y, x - LAKE_CENTER_X) * (3 + Math.floor(Math.random()*4))) * 3) {
          type = 'lake';
        }
      }

      // River
      if (type === 'grass' || type === 'seaside_park') {
        const riverPathY = RIVER_Y_START + Math.sin(x * RIVER_WAVE_SPEED_1) * 15 + Math.cos(x * RIVER_WAVE_SPEED_2) * 8;
        if (Math.abs(y - riverPathY) < 2.5 + Math.sin(x * 0.1) * 0.5) {
          type = 'river';
        }
      }

      // 2. City Generation
      if (type === 'grass' || type === 'seaside_park') {
        const distToCenter = Math.sqrt(Math.pow(x - CITY_CENTER_X, 2) + Math.pow(y - CITY_CENTER_Y, 2));
        
        if (distToCenter < CITY_RADIUS && x > SEASIDE_WIDTH - 2) {
           const roll = Math.random();
           
           // Main Roads
           if (x % 10 === 0 || y % 10 === 0) {
             type = 'road';
           } else if (distToCenter < CITY_RADIUS * 0.4) {
             // Core: Commercial & Parks
             if (roll > 0.8) type = 'commercial';
             else if (roll > 0.6) type = 'park';
             else if (roll > 0.4) type = 'residential';
           } else {
             // Outer: Residential & Low density
             if (roll > 0.9) type = 'residential';
             else if (roll > 0.8) type = 'park';
             else if (roll > 0.95) type = 'forest';
           }

           // Populations
           if (type === 'residential') tilePopulation = Math.floor(Math.random() * 1000 + 500);
           if (type === 'commercial') tilePopulation = Math.floor(Math.random() * 500 + 100);
        }

        // Special Facilities (Sparse placement)
        if (Math.random() < 0.005 && distToCenter > CITY_RADIUS * 0.5) {
            const facilities: TileType[] = ['wind', 'solar', 'bio', 'storage', 'stadium'];
            type = facilities[Math.floor(Math.random() * facilities.length)];
        }

        // Industrial far out
        if (x > MAP_WIDTH * 0.8 && y > MAP_HEIGHT * 0.8 && Math.random() > 0.85) {
          type = 'industrial';
        }
      }

      // Bridges over water for roads
      if (type === 'river' && (x % 10 === 0)) {
        type = 'bridge';
      }

      row.push(createTile(x, y, type, tilePopulation));
      population += tilePopulation;
    }

    grid.push(row);
  }

  return {
    ...state,
    grid,
    population,
  };
}

export function autoLayoutCity(state: GameState): GameState {
  const grid: Tile[][] = [];
  let population = 0;

  const isNatural = (t: TileType) => ['water', 'river', 'lake', 'seaside', 'seaside_park', 'marina', 'forest'].includes(t);

  // Constants for block generation
  const BLOCK_SIZE = 7;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const originalTile = state.grid[y] && state.grid[y][x];
      let type: TileType = originalTile && isNatural(originalTile.type) ? originalTile.type : 'grass';
      let tilePopulation = 0;

      // Plan alternating roads
      const isRoadX = x % BLOCK_SIZE === 0;
      const isRoadY = y % BLOCK_SIZE === 0;
      
      if (isRoadX || isRoadY) {
        if (type === 'grass') {
          type = 'road';
        } else if (['water', 'river', 'lake'].includes(type)) {
          type = 'bridge';
        }
      } else if (type === 'grass') {
        // Determine block type based on block coordinates
        const blockX = Math.floor(x / BLOCK_SIZE);
        const blockY = Math.floor(y / BLOCK_SIZE);
        
        // Pseudo-random but deterministic based on block coordinates
        const noise = (Math.sin(blockX * 12.9898 + blockY * 78.233) * 43758.5453) % 1;
        const absNoise = Math.abs(noise);

        // Distance from center for zoning
        const distToCenter = Math.sqrt(Math.pow(x - MAP_WIDTH / 2, 2) + Math.pow(y - MAP_HEIGHT / 2, 2));
        
        if (absNoise < 0.15) {
          // Oasis (绿洲)
          type = Math.random() > 0.5 ? 'park' : 'forest';
        } else if (distToCenter < MAP_WIDTH * 0.25) {
          // Commercial / Leisure Center
          if (absNoise < 0.25) {
            type = 'amusement_park';
          } else if (absNoise < 0.35) {
            type = 'stadium';
          } else {
            type = 'commercial';
            tilePopulation = Math.floor(Math.random() * 500 + 100);
          }
        } else if (distToCenter > MAP_WIDTH * 0.35 && (blockX + blockY) % 5 === 0) {
          // Industrial & Power outer ring
          if (absNoise < 0.4) type = 'power';
          else if (absNoise < 0.5) type = 'solar';
          else if (absNoise < 0.6) type = 'wind';
          else type = 'industrial';
        } else {
          // Residential
          if (absNoise < 0.85) {
            type = 'residential';
            tilePopulation = Math.floor(Math.random() * 1000 + 500);
          } else {
            type = 'park'; // small community parks
          }
        }
      }

      row.push(createTile(x, y, type, tilePopulation));
      population += tilePopulation;
    }
    grid.push(row);
  }

  return {
    ...state,
    grid,
    population,
  };
}

export function createInitialState(): GameState {
  const emptyState: GameState = {
    grid: [],
    money: 2750000,
    population: 0,
    time: 7 * 60,
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    selectedTool: 'cursor',
    weather: 42,
    policy: 'balanced',
    autoBalance: true,
    energy: BASE_ENERGY,
    agents: [],
    mappings: [],
    census: EMPTY_CENSUS,
    forecast: [],
    feedback: [],
  };

  return generateRandomLayout(emptyState);
}

export function placeBuilding(state: GameState, x: number, y: number, type: TileType): GameState {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
    return state;
  }

  const target = state.grid[y][x];
  let actualType = type;

  const isWater = (t: TileType) => ['water', 'river', 'lake', 'seaside'].includes(t);

  if (type === 'road' && isWater(target.type)) {
    actualType = 'bridge';
  }

  if (
    isWater(target.type) &&
    !['grass', 'bridge', 'marina', 'seaside_park', 'water', 'river', 'lake', 'seaside'].includes(actualType)
  ) {
    return state;
  }

  if (actualType === 'marina' && !isWater(target.type)) {
    return state;
  }

  const cost = getCost(actualType);
  if (state.money < cost) {
    return state;
  }

  const grid = state.grid.map((row) => row.map((tile) => ({ ...tile })));
  const tile = grid[y][x];

  if (tile.type !== actualType) {
    tile.population = actualType === 'residential' ? Math.floor(Math.random() * 20 + 10) : 0;
    tile.level = actualType === 'residential' ? 1 : 0;
  }

  tile.type = actualType;
  tile.district = getDistrictLabel(x, y);
  tile.isPowered = true;

  return {
    ...state,
    grid,
    money: state.money - cost,
  };
}



export function getCost(type: TileType): number {
  switch (type) {
    case 'road':
      return 15;
    case 'bridge':
      return 80;
    case 'residential':
      return 160;
    case 'commercial':
      return 260;
    case 'industrial':
      return 360;
    case 'power':
      return 850;
    case 'solar':
      return 420;
    case 'wind':
      return 480;
    case 'bio':
      return 540;
    case 'storage':
      return 460;
    case 'park':
      return 120;
    case 'stadium':
      return 1500;
    case 'amusement_park':
      return 1100;
    case 'seaside_park':
      return 950;
    case 'marina':
      return 1200;
    case 'water':
      return 400;
    case 'river':
      return 400;
    case 'lake':
      return 400;
    case 'seaside':
      return 500;
    case 'forest':
      return 80;
    default:
      return 0;
  }
}

export function saveMapToStorage(state: GameState, name: string): void {
  try {
    const historyJson = localStorage.getItem('simcity_map_history');
    const history = historyJson ? JSON.parse(historyJson) : [];
    
    // Create a lean version of state to save storage space
    const savedMap = {
      name: name || `Map ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      state: {
        grid: state.grid,
        money: state.money,
        population: state.population,
        gridWidth: state.gridWidth,
        gridHeight: state.gridHeight,
      }
    };
    
    history.push(savedMap);
    
    // Keep only last 10 maps to avoid quota issues
    if (history.length > 10) {
      history.shift();
    }
    
    localStorage.setItem('simcity_map_history', JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save map", e);
  }
}

export function getMapHistory(): Array<{name: string, timestamp: number, state: Partial<GameState>}> {
  try {
    const historyJson = localStorage.getItem('simcity_map_history');
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (e) {
    console.error("Failed to load map history", e);
    return [];
  }
}

export function restoreMapFromHistory(currentState: GameState, savedState: Partial<GameState>): GameState {
  return {
    ...currentState,
    grid: savedState.grid || currentState.grid,
    money: savedState.money || currentState.money,
    population: savedState.population || currentState.population,
    gridWidth: savedState.gridWidth || currentState.gridWidth,
    gridHeight: savedState.gridHeight || currentState.gridHeight,
  };
}
