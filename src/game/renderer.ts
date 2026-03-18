import type { GameState, TileType } from './types';

// Orthogonal constants
export const TILE_SIZE = 32;
const HALF_SIZE = TILE_SIZE / 2;

// Helper for deterministic randomness based on position
function pseudoRandom(x: number, y: number) {
  const n = x * 3711 + y * 7823;
  return Math.abs(Math.sin(n));
}

// Coordinate transformations (Orthogonal)
export function toScreen(gridX: number, gridY: number): { x: number, y: number } {
  return {
    x: gridX * TILE_SIZE,
    y: gridY * TILE_SIZE
  };
}

export function toGrid(screenX: number, screenY: number): { x: number, y: number } {
  return {
    x: Math.floor(screenX / TILE_SIZE),
    y: Math.floor(screenY / TILE_SIZE)
  };
}

export function renderGame(
  ctx: CanvasRenderingContext2D, 
  state: GameState, 
  camera: { x: number, y: number, zoom: number },
  hoverTile?: { x: number, y: number },
  showEnergyFlow: boolean = false
) {
  const { width, height } = ctx.canvas;

  ctx.save();
  
  // Center the map (or apply camera)
  const centerX = width / 2;
  const centerY = height / 2;
  
  ctx.translate(centerX, centerY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Render loop - Phase 1: Ground
  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const tile = state.grid[y][x];
      const pos = toScreen(x, y);
      
      // Optimization: Simple culling
      if (pos.x - camera.x < -width/camera.zoom/2 - TILE_SIZE || pos.x - camera.x > width/camera.zoom/2 + TILE_SIZE ||
          pos.y - camera.y < -height/camera.zoom/2 - TILE_SIZE || pos.y - camera.y > height/camera.zoom/2 + TILE_SIZE) {
        // continue; 
      }

      drawTileOrtho(ctx, tile.type, x, y, pos.x, pos.y, state.time, 'ground');
    }
  }

  // Phase 2: Energy Flow (Underground/Ground level)
  if (showEnergyFlow) {
    drawEnergyFlowOverlay(ctx, state);
  }

  // Phase 3: Objects
  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const tile = state.grid[y][x];
      const pos = toScreen(x, y);
      
      // Optimization: Simple culling
      if (pos.x - camera.x < -width/camera.zoom/2 - TILE_SIZE || pos.x - camera.x > width/camera.zoom/2 + TILE_SIZE ||
          pos.y - camera.y < -height/camera.zoom/2 - TILE_SIZE || pos.y - camera.y > height/camera.zoom/2 + TILE_SIZE) {
        // continue; 
      }

      drawTileOrtho(ctx, tile.type, x, y, pos.x, pos.y, state.time, 'object');
    }
  }

  // Draw hover cursor
  if (hoverTile && hoverTile.x >= 0 && hoverTile.x < state.gridWidth && hoverTile.y >= 0 && hoverTile.y < state.gridHeight) {
    const pos = toScreen(hoverTile.x, hoverTile.y);
    drawCursor(ctx, pos.x, pos.y);
  }

  ctx.restore();
}

export function drawEnergyFlowOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState
) {
  // 1. Identify Producers and Consumers
  interface Point { x: number; y: number; type?: string; }
  const producers: Point[] = [];
  const consumers: Point[] = [];

  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const tile = state.grid[y][x];
      if (['power', 'solar', 'bio', 'storage'].includes(tile.type)) {
        producers.push({x, y, type: tile.type});
      } else if (['residential', 'commercial', 'industrial', 'stadium', 'amusement_park', 'seaside_park'].includes(tile.type)) {
        consumers.push({x, y});
      }
    }
  }

  // 2. Draw Connections (Flow)
  ctx.lineWidth = 2;
  
  // Animation offset
  const dashOffset = -state.time * 2; 

  consumers.forEach((consumer: Point) => {
    // Separate producers
    const greenProducers = producers.filter(p => ['solar', 'bio', 'storage'].includes(p.type || ''));
    const powerProducers = producers.filter(p => p.type === 'power');
    
    let targetProducer: Point | null = null;
    
    // Hash based preference (70% Green, 30% Power)
    // Use coordinates for stable randomness so connections don't flicker
    const hash = Math.abs((consumer.x * 73856093) ^ (consumer.y * 19349663));
    const prefersGreen = (hash % 100) < 70; // 70% probability
    
    // Helper to find nearest in a list
    const findNearest = (list: Point[]) => {
      let nearest: Point | null = null;
      let minDist = Infinity;
      list.forEach(p => {
        const dist = Math.abs(p.x - consumer.x) + Math.abs(p.y - consumer.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      });
      return nearest;
    };
    
    // Logic: Try to satisfy preference first, then fallback
    if (prefersGreen && greenProducers.length > 0) {
      targetProducer = findNearest(greenProducers);
    } else if (!prefersGreen && powerProducers.length > 0) {
      targetProducer = findNearest(powerProducers);
    }
    
    // Fallback if preferred type not available
    if (!targetProducer) {
      if (greenProducers.length > 0) targetProducer = findNearest(greenProducers);
      else if (powerProducers.length > 0) targetProducer = findNearest(powerProducers);
    }

    if (targetProducer) {
      // Create a local variable to satisfy TS null check
      const p = targetProducer as Point;
      const start = toScreen(p.x, p.y);
      const end = toScreen(consumer.x, consumer.y);
      
      // Center of tile
      const startX = start.x + HALF_SIZE;
      const startY = start.y + HALF_SIZE;
      const endX = end.x + HALF_SIZE;
      const endY = end.y + HALF_SIZE;

      // Determine color based on source type
      let color = '#00b894';
      switch(p.type) {
          case 'solar': color = '#fdcb6e'; break; // Sun
          case 'bio': color = '#00b894'; break; // Bio
          case 'storage': color = '#0984e3'; break; // Battery
          case 'power': color = '#6c5ce7'; break; // Fusion/Power Plant
          default: color = '#636e72';
      }

      ctx.strokeStyle = color;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = dashOffset;

      // Draw Flow
      ctx.beginPath();
      ctx.moveTo(startX, startY); 
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw Moving Particle
      // Simple particle at parameterized position
      const progress = (state.time % 60) / 60; // 0 to 1 loop
      const px = startX + (endX - startX) * progress;
      const py = startY + (endY - startY) * progress;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset dash
      ctx.setLineDash([]);
    }
  });

  // 3. Draw "Energy Aura" around producers
  producers.forEach(p => {
    const pos = toScreen(p.x, p.y);
    const pulse = Math.sin(state.time / 10) * 5;
    
    let color = '#00b894';
    switch(p.type) {
        case 'solar': color = '#fdcb6e'; break;
        case 'bio': color = '#00b894'; break;
        case 'storage': color = '#0984e3'; break;
        case 'power': color = '#6c5ce7'; break;
    }
    
    ctx.strokeStyle = color; 
    ctx.globalAlpha = 0.5 + Math.sin(state.time/10)*0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Aura
    const cx = pos.x + HALF_SIZE;
    const cy = pos.y + HALF_SIZE;
    ctx.arc(cx, cy, 15 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  });
}

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#00b894';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = 'rgba(0, 184, 148, 0.2)';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}

// --- Main Tile Drawing (Orthogonal) ---

function drawTileOrtho(ctx: CanvasRenderingContext2D, type: TileType, gx: number, gy: number, x: number, y: number, time: number, phase: 'ground' | 'object' = 'object') {
  const rand = pseudoRandom(gx, gy);
  
  if (phase === 'ground') {
    // Base ground
    let groundColor = '#e0e0e0';
    switch(type) {
      case 'grass': groundColor = '#a8e6cf'; break; // Lighter green
      case 'water': groundColor = '#74b9ff'; break;
      case 'river': groundColor = '#74b9ff'; break;
      case 'lake': groundColor = '#0984e3'; break;
      case 'seaside': groundColor = '#0984e3'; break;
      case 'road': groundColor = '#dfe6e9'; break; // Light grey road
      case 'forest': groundColor = '#55efc4'; break;
      case 'residential': groundColor = '#dfe6e9'; break; // Changed from green to grey
      case 'commercial': groundColor = '#a8e6cf'; break;
      case 'industrial': groundColor = '#b2bec3'; break;
      case 'seaside_park': groundColor = '#ffeaa7'; break; // Sandy
      case 'marina': groundColor = '#74b9ff'; break; // Water
      case 'wind': groundColor = '#a8e6cf'; break; // Grass base
      default: groundColor = '#dfe6e9';
    }
    
    // Draw Square
    ctx.fillStyle = groundColor;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    
    // Add grid border
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    
    return;
  }

  // Objects (phase === 'object')
  const cx = x + HALF_SIZE;
  const cy = y + HALF_SIZE;

  if (type === 'forest') {
    drawCircle(ctx, cx, cy, 10 + rand * 4, '#00b894');
    drawCircle(ctx, cx - 6, cy + 6, 8 + rand * 3, '#00b894');
  } else if (type === 'road') {
    // Road markings
    ctx.strokeStyle = '#b2bec3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + HALF_SIZE, y);
    ctx.lineTo(x + HALF_SIZE, y + TILE_SIZE);
    ctx.moveTo(x, y + HALF_SIZE);
    ctx.lineTo(x + TILE_SIZE, y + HALF_SIZE);
    ctx.stroke();
  } else if (type === 'bridge') {
    ctx.fillStyle = '#636e72';
    ctx.fillRect(x, y + 8, TILE_SIZE, 16);
  } else if (type === 'residential') {
    drawRect(ctx, cx - 10, cy - 10, 20, 20, '#b2bec3');
    drawRect(ctx, cx - 6, cy - 6, 12, 12, '#dfe6e9');
  } else if (type === 'commercial') {
    drawRect(ctx, cx - 12, cy - 12, 24, 24, '#74b9ff');
    drawRect(ctx, cx - 8, cy - 8, 16, 16, '#0984e3');
  } else if (type === 'industrial') {
    drawRect(ctx, cx - 14, cy - 10, 28, 20, '#636e72');
    drawCircle(ctx, cx - 8, cy - 4, 4, '#dfe6e9');
  } else if (type === 'stadium') {
    drawCircle(ctx, cx, cy, 14, '#dfe6e9');
    drawCircle(ctx, cx, cy, 10, '#55efc4');
  } else if (type === 'amusement_park') {
    drawCircle(ctx, cx, cy, 14, '#e17055');
    ctx.strokeStyle = '#ffeaa7';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'power') {
    drawCircle(ctx, cx, cy, 14, '#6c5ce7');
    drawCircle(ctx, cx, cy, 8, 'rgba(162, 155, 254, 0.8)');
  } else if (type === 'solar') {
    drawRect(ctx, cx - 12, cy - 12, 10, 24, '#0984e3');
    drawRect(ctx, cx + 2, cy - 12, 10, 24, '#0984e3');
  } else if (type === 'wind') {
    drawCircle(ctx, cx, cy, 3, '#dfe6e9');
    // Spinning blades
    const angle = time * 0.2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, -2, 24, 4);
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-12, -2, 24, 4);
    ctx.restore();
  } else if (type === 'bio') {
    drawRect(ctx, cx - 10, cy - 10, 20, 20, '#55efc4');
    drawCircle(ctx, cx, cy, 6, '#00b894');
  } else if (type === 'storage') {
    drawRect(ctx, cx - 12, cy - 8, 8, 16, '#ffffff');
    drawRect(ctx, cx + 4, cy - 8, 8, 16, '#ffffff');
  } else if (type === 'park') {
    drawCircle(ctx, cx, cy, 10, '#55efc4');
    drawCircle(ctx, cx - 5, cy + 5, 5, '#00b894');
  } else if (type === 'seaside_park') {
    drawCircle(ctx, cx - 6, cy - 6, 6, '#ff7675');
    drawCircle(ctx, cx + 6, cy + 6, 6, '#74b9ff');
  } else if (type === 'marina') {
    // Boats
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx + 5, cy - 4);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.fill();
  }
}

// Simple helpers
function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}
