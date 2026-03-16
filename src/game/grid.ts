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

export function createInitialState(): GameState {
  const grid: Tile[][] = [];
  let population = 0;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];

    for (let x = 0; x < MAP_WIDTH; x++) {
      let type: TileType = 'grass';
      let tilePopulation = 0;

      const isCentral = x > 5 && x < MAP_WIDTH - 5 && y > 5 && y < MAP_HEIGHT - 5;
      const noise = Math.sin(x * 0.11) + Math.cos(y * 0.08);

      if (!isCentral) {
        if (noise > 1.15) {
          type = 'water';
        } else if (noise < -0.9) {
          type = 'forest';
        }
      }

      if (isCentral && type === 'grass') {
        const isMainRoad = x % 14 === 0 || y % 14 === 0;
        const isSecondaryRoad = (x % 9 === 0 || y % 9 === 0) && Math.abs(x - y) % 3 === 0;
        const centerDistance = Math.hypot(x - MAP_WIDTH / 2, y - MAP_HEIGHT / 2);
        const roll = Math.random();

        if (isMainRoad || isSecondaryRoad) {
          type = 'road';
        } else if (centerDistance < 7) {
          if (roll > 0.74) {
            type = 'commercial';
          } else if (roll > 0.4) {
            type = 'park';
          } else {
            type = 'grass';
          }
        } else if (centerDistance < 17) {
          if (roll > 0.72) {
            type = 'residential';
            tilePopulation = Math.floor(Math.random() * 24 + 12);
          } else if (roll > 0.52) {
            type = 'park';
          } else {
            type = 'grass';
          }
        } else if (centerDistance < 28) {
          if (roll > 0.8) {
            type = 'commercial';
          } else if (roll > 0.58) {
            type = 'residential';
            tilePopulation = Math.floor(Math.random() * 18 + 8);
          } else if (roll > 0.42) {
            type = 'park';
          } else {
            type = 'grass';
          }
        } else {
          if (roll > 0.84) {
            type = 'industrial';
          } else if (roll > 0.48) {
            type = 'forest';
          } else {
            type = 'grass';
          }
        }

        if (x >= 10 && x <= 14 && y >= 12 && y <= 16) {
          type = 'solar';
          tilePopulation = 0;
        }

        if (x >= 82 && x <= 86 && y >= 80 && y <= 84) {
          type = 'bio';
          tilePopulation = 0;
        }

        if (x >= 88 && x <= 91 && y >= 18 && y <= 21) {
          type = 'storage';
          tilePopulation = 0;
        }

        if ((x === 8 && y === 8) || (x === MAP_WIDTH - 9 && y === MAP_HEIGHT - 9)) {
          type = 'power';
          tilePopulation = 0;
        }

        if (x >= 38 && x <= 42 && y >= 12 && y <= 15) {
          type = 'stadium';
          tilePopulation = 0;
        }

        if (x >= 12 && x <= 16 && y >= 62 && y <= 66) {
          type = 'amusement_park';
          tilePopulation = 0;
        }

        if (x >= 6 && x <= 13 && y >= 44 && y <= 49) {
          type = 'seaside_park';
          tilePopulation = 0;
        }

        if (x >= 5 && x <= 9 && y >= 52 && y <= 57) {
          type = 'marina';
          tilePopulation = 0;
        }
      }

      row.push(createTile(x, y, type, tilePopulation));
      population += tilePopulation;
    }

    grid.push(row);
  }

  return {
    grid,
    money: 2750000,
    population,
    time: 7 * 60,
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    selectedTool: 'cursor',
    weather: 42,
    policy: 'balanced',
    autoBalance: true,
    energy: BASE_ENERGY,
    agents: [],
    feedback: [],
    mappings: [],
    census: EMPTY_CENSUS,
    forecast: [],
  };
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

export function autoLayoutRoads(state: GameState): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;

  for (let y = 0; y < next.gridHeight; y += 1) {
    for (let x = 0; x < next.gridWidth; x += 1) {
      const tile = next.grid[y][x];
      if (tile.type === 'road') {
        tile.type = 'grass';
      }
      if (tile.type === 'bridge') {
        tile.type = 'water';
      }
    }
  }

  const safeToRoute = (type: TileType) =>
    type === 'grass' || type === 'forest' || type === 'water' || type === 'road' || type === 'bridge';

  const placeRoute = (x: number, y: number) => {
    const tile = next.grid[y]?.[x];
    if (!tile || !safeToRoute(tile.type)) {
      return;
    }
    tile.type = tile.type === 'water' ? 'bridge' : 'road';
  };

  for (let y = 8; y < next.gridHeight - 8; y += 8) {
    for (let x = 6; x < next.gridWidth - 6; x += 1) {
      placeRoute(x, y);
    }
  }

  for (let x = 8; x < next.gridWidth - 8; x += 8) {
    for (let y = 6; y < next.gridHeight - 6; y += 1) {
      placeRoute(x, y);
    }
  }

  return next;
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
