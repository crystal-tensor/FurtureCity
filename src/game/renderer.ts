import type { GameState, TileType } from './types';

// Isometric constants
export const ISO_WIDTH = 64;
export const ISO_HEIGHT = 32;
const HALF_W = ISO_WIDTH / 2;
const HALF_H = ISO_HEIGHT / 2;

// Helper for deterministic randomness based on position
function pseudoRandom(x: number, y: number) {
  const n = x * 3711 + y * 7823;
  return Math.abs(Math.sin(n));
}

// Color helper
function shade(color: string, percent: number): string {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = parseInt((R * (100 + percent) / 100).toString());
  G = parseInt((G * (100 + percent) / 100).toString());
  B = parseInt((B * (100 + percent) / 100).toString());

  R = (R < 255) ? R : 255;
  G = (G < 255) ? G : 255;
  B = (B < 255) ? B : 255;

  const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
  const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
  const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

  return "#" + RR + GG + BB;
}

// Coordinate transformations
export function toScreen(gridX: number, gridY: number): { x: number, y: number } {
  return {
    x: (gridX - gridY) * HALF_W,
    y: (gridX + gridY) * HALF_H
  };
}

export function toGrid(screenX: number, screenY: number): { x: number, y: number } {
  const normX = screenX / HALF_W;
  const normY = screenY / HALF_H;
  
  return {
    x: Math.floor((normY + normX) / 2),
    y: Math.floor((normY - normX) / 2)
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
  // ctx.clearRect(0, 0, width, height); // Handled by caller to preserve background

  ctx.save();
  
  // Center the map
  const centerX = width / 2;
  const centerY = height / 4;
  
  ctx.translate(centerX, centerY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Render loop - Phase 1: Ground
  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const tile = state.grid[y][x];
      const pos = toScreen(x, y);
      
      // Optimization: Simple culling
      if (pos.x + camera.x < -width/camera.zoom - 100 || pos.x + camera.x > width/camera.zoom + 100 ||
          pos.y + camera.y < -height/camera.zoom - 100 || pos.y + camera.y > height/camera.zoom + 100) {
        // continue; 
      }

      drawTileIso(ctx, tile.type, x, y, pos.x, pos.y, state.time, 'ground');
    }
  }

  // Phase 2: Energy Flow (Underground)
  if (showEnergyFlow) {
    drawEnergyFlowOverlay(ctx, state);
  }

  // Phase 3: Objects
  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const tile = state.grid[y][x];
      const pos = toScreen(x, y);
      
      // Optimization: Simple culling
      if (pos.x + camera.x < -width/camera.zoom - 100 || pos.x + camera.x > width/camera.zoom + 100 ||
          pos.y + camera.y < -height/camera.zoom - 100 || pos.y + camera.y > height/camera.zoom + 100) {
        // continue; 
      }

      drawTileIso(ctx, tile.type, x, y, pos.x, pos.y, state.time, 'object');
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

      // Draw Underground Flow (Ground Level z=0)
      ctx.beginPath();
      ctx.moveTo(start.x, start.y); // At ground level
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw Moving Particle
      // Simple particle at parameterized position
      const progress = (state.time % 60) / 60; // 0 to 1 loop
      const px = start.x + (end.x - start.x) * progress;
      const py = start.y + (end.y - start.y) * progress;

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
    
    ctx.strokeStyle = color; // Using solid color with opacity handled by globalAlpha if needed, or rgba string
    ctx.globalAlpha = 0.5 + Math.sin(state.time/10)*0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Aura at ground level
    ctx.ellipse(pos.x, pos.y, 20 + pulse, (20 + pulse) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  });
}

function drawSolarPlant(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Array of solar panels
  // Base
  drawBlock(ctx, x, y, z, '#dfe6e9', '#b2bec3', '#636e72', 2, 40);
  
  // Panels (slanted)
  // Simplified as blocks for now
  drawBlock(ctx, x - 10, y - 5, z + 5, '#0984e3', '#00cec9', '#74b9ff', 2, 12);
  drawBlock(ctx, x + 10, y + 5, z + 5, '#0984e3', '#00cec9', '#74b9ff', 2, 12);
  drawBlock(ctx, x - 10, y + 15, z + 5, '#0984e3', '#00cec9', '#74b9ff', 2, 12);
}

function drawBioPlant(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Biomass Silos
  // Base
  drawBlock(ctx, x, y, z, '#a8e6cf', '#55efc4', '#00b894', 2, 40);
  
  // Green Tank
  drawCylinder(ctx, x, y, z + 2, '#00b894', 12, 15);
  
  // Leaves/Sprout on top
  ctx.fillStyle = '#55efc4';
  ctx.beginPath();
  ctx.ellipse(x, y - z - 17, 8, 4, 0, 0, Math.PI*2);
  ctx.fill();
}

function drawBatteryStorage(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Tesla Megapack style blocks
  // Base
  drawBlock(ctx, x, y, z, '#dfe6e9', '#b2bec3', '#636e72', 2, 40);
  
  // Battery Units
  drawBlock(ctx, x - 8, y, z + 2, '#ffffff', '#dfe6e9', '#b2bec3', 10, 10);
  drawBlock(ctx, x + 8, y, z + 2, '#ffffff', '#dfe6e9', '#b2bec3', 10, 10);
  
  // Status Lights
  ctx.fillStyle = '#00b894';
  ctx.beginPath();
  ctx.arc(x - 8, y - z - 8, 2, 0, Math.PI*2);
  ctx.arc(x + 8, y - z - 8, 2, 0, Math.PI*2);
  ctx.fill();
}

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + HALF_W, y + HALF_H);
  ctx.lineTo(x, y + ISO_HEIGHT);
  ctx.lineTo(x - HALF_W, y + HALF_H);
  ctx.closePath();
  ctx.strokeStyle = '#00b894';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(0, 184, 148, 0.2)';
  ctx.fill();
}

// --- 3D Primitives ---

function drawBlock(
  ctx: CanvasRenderingContext2D, 
  x: number, y: number, z: number, 
  colorTop: string, colorLeft: string, colorRight: string,
  height: number = 20,
  size: number = ISO_WIDTH
) {
  const halfW = size / 2;
  const halfH = size / 4;
  const totalH = size / 2;

  // Top face
  ctx.fillStyle = colorTop;
  ctx.beginPath();
  ctx.moveTo(x, y - z);
  ctx.lineTo(x + halfW, y + halfH - z);
  ctx.lineTo(x, y + totalH - z);
  ctx.lineTo(x - halfW, y + halfH - z);
  ctx.closePath();
  ctx.fill();
  
  // Right face
  ctx.fillStyle = colorRight;
  ctx.beginPath();
  ctx.moveTo(x + halfW, y + halfH - z);
  ctx.lineTo(x + halfW, y + halfH - z + height);
  ctx.lineTo(x, y + totalH - z + height);
  ctx.lineTo(x, y + totalH - z);
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = colorLeft;
  ctx.beginPath();
  ctx.moveTo(x - halfW, y + halfH - z);
  ctx.lineTo(x - halfW, y + halfH - z + height);
  ctx.lineTo(x, y + totalH - z + height);
  ctx.lineTo(x, y + totalH - z);
  ctx.closePath();
  ctx.fill();
}

function drawCylinder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, z: number,
  color: string,
  radius: number,
  height: number
) {
  const r = radius;
  const h = height;
  
  // Approximate cylinder with multiple faces or just gradient rect + oval top
  // In ISO, a circle becomes an ellipse with ratio 2:1
  
  // Side (Gradient for roundness)
  const grad = ctx.createLinearGradient(x - r, y, x + r, y);
  grad.addColorStop(0, shade(color, -20));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shade(color, -40));
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r/2 - z); // Left edge top
  ctx.lineTo(x - r, y + r/2 - z + h); // Left edge bottom
  
  // Bottom curve
  ctx.ellipse(x, y + r/2 - z + h, r, r/2, 0, 0, Math.PI, false);
  
  ctx.lineTo(x + r, y + r/2 - z); // Right edge top
  
  // Top curve (back half) - actually we fill the whole side then draw top lid
  // But to be correct we should draw bottom ellipse then rect then top ellipse?
  // Let's simplify:
  
  // Draw body
  ctx.fillRect(x - r, y + r/2 - z, r * 2, h); 
  // Wait, fillRect is flat. We need the bottom curve.
  
  // Redo:
  ctx.beginPath();
  ctx.ellipse(x, y + r/2 - z + h, r, r/2, 0, 0, Math.PI, false); // Bottom curve
  ctx.lineTo(x + r, y + r/2 - z);
  ctx.ellipse(x, y + r/2 - z, r, r/2, 0, Math.PI, 0, true); // Top curve back half (invisible mostly)
  ctx.lineTo(x - r, y + r/2 - z + h);
  ctx.fill();

  // Top Face (Lid)
  ctx.fillStyle = shade(color, 20);
  ctx.beginPath();
  ctx.ellipse(x, y + r/2 - z, r, r/2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Border for definition
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- Main Tile Drawing ---

function drawTileIso(ctx: CanvasRenderingContext2D, type: TileType, gx: number, gy: number, x: number, y: number, time: number, phase: 'ground' | 'object' = 'object') {
  const rand = pseudoRandom(gx, gy);
  
  if (phase === 'ground') {
    // Base ground
    let groundColor = '#e0e0e0';
    switch(type) {
      case 'grass': groundColor = '#a8e6cf'; break; // Lighter green
      case 'water': groundColor = '#74b9ff'; break;
      case 'river': groundColor = '#74b9ff'; break;
      case 'lake': groundColor = '#0984e3'; break;
      case 'seaside': groundColor = '#00cec9'; break;
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
    
    const isWater = ['water', 'river', 'lake', 'seaside', 'marina'].includes(type);
    const groundZ = isWater ? -5 : 0;
    
    drawBlock(ctx, x, y, groundZ, groundColor, shade(groundColor, -10), shade(groundColor, -20), isWater ? 5 : 5);
    return;
  }

  // Objects (phase === 'object')
  if (type === 'forest') {
    drawBioTree(ctx, x, y, 0, rand);
    drawBioTree(ctx, x - 10, y + 5, 0, rand * 0.5);
  } else if (type === 'road') {
    // Energy Flow Lines
    const offset = (time * 0.5) % 20;
    ctx.strokeStyle = '#00b894';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 15]);
    ctx.lineDashOffset = -offset;
    
    ctx.beginPath();
    // Simple logic: connect center
    ctx.moveTo(x - 15, y + HALF_H);
    ctx.lineTo(x + 15, y + HALF_H);
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  } else if (type === 'bridge') {
    drawBridge(ctx, x, y, 0);
  } else if (type === 'residential') {
    drawBioResidential(ctx, x, y, 5, rand);
  } else if (type === 'commercial') {
    drawBioCommercial(ctx, x, y, 5, rand);
  } else if (type === 'industrial') {
    drawCleanIndustrial(ctx, x, y, 5);
  } else if (type === 'stadium') {
    drawEcoStadium(ctx, x, y, 5);
  } else if (type === 'amusement_park') {
    drawFuturePark(ctx, x, y, 5);
  } else if (type === 'power') {
    drawFusionPower(ctx, x, y, 5);
  } else if (type === 'solar') {
    drawSolarPlant(ctx, x, y, 5);
  } else if (type === 'wind') {
    drawWindTurbine(ctx, x, y, 5, time);
  } else if (type === 'bio') {
    drawBioPlant(ctx, x, y, 5);
  } else if (type === 'storage') {
    drawBatteryStorage(ctx, x, y, 5);
  } else if (type === 'park') {
    drawSpongePark(ctx, x, y, 5, rand);
  } else if (type === 'seaside_park') {
    drawSeasidePark(ctx, x, y, 5);
  } else if (type === 'marina') {
    drawMarina(ctx, x, y, 0); // On water level
  }
}

// --- Specific Building Drawers ---

function drawWindTurbine(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, time: number) {
  // Base
  drawBlock(ctx, x, y, z, '#dfe6e9', '#b2bec3', '#636e72', 2, 20);

  // Tower
  const towerHeight = 42;
  drawCylinder(ctx, x, y, z + 2, '#ecf0f1', 3, towerHeight);

  // Nacelle
  const hubZ = z + 2 + towerHeight;
  
  // Blades
  const angle = time * 0.15;
  const bladeLen = 28;

  ctx.save();
  ctx.translate(x, y - hubZ);
  
  // Draw blades as a simple 2D rotation facing camera
  for(let i = 0; i < 3; i++) {
    const theta = angle + i * (Math.PI * 2 / 3);
    const bx = Math.sin(theta) * bladeLen;
    const by = Math.cos(theta) * bladeLen;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bx, by);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#b2bec3';
    ctx.stroke();
  }
  
  // Hub cap
  ctx.fillStyle = '#b2bec3';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawBridge(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Suspension Bridge Style
  // Base Pylons
  drawBlock(ctx, x - 20, y, z - 5, '#b2bec3', '#636e72', '#2d3436', 15, 10);
  drawBlock(ctx, x + 20, y, z - 5, '#b2bec3', '#636e72', '#2d3436', 15, 10);
  
  // Deck
  // Just a road block raised
  drawBlock(ctx, x, y, z, '#dfe6e9', '#b2bec3', '#636e72', 5, 60);
}

function drawBioResidential(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, rand: number) {
  // Modular Eco-Housing
  // Stacked blocks with green terraces
  
  const height = 30 + rand * 20;
  
  // Main Tower
  drawBlock(ctx, x, y, z, '#dfe6e9', '#b2bec3', '#636e72', height, 24);
  
  // Terrace
  drawBlock(ctx, x + 4, y + 4, z + 15, '#a8e6cf', '#55efc4', '#00b894', 5, 28);
}

function drawBioCommercial(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, rand: number) {
  // Glass and Wood Structure
  
  // Base
  drawBlock(ctx, x, y, z, '#a8e6cf', '#55efc4', '#00b894', 10, 32);
  
  // Glass Tower
  drawBlock(ctx, x, y, z + 10, '#74b9ff', '#0984e3', '#00cec9', 40 + rand * 10, 20);
}

function drawCleanIndustrial(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Modern Factory
  
  // Large flat building
  drawBlock(ctx, x, y, z, '#b2bec3', '#636e72', '#2d3436', 15, 48);
  
  // Vents
  drawCylinder(ctx, x - 10, y - 10, z + 15, '#dfe6e9', 4, 10);
  drawCylinder(ctx, x + 5, y + 5, z + 15, '#dfe6e9', 4, 15);
}

function drawEcoStadium(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Elliptical Stadium
  // Using cylinder for now
  drawCylinder(ctx, x, y, z, '#dfe6e9', 28, 15);
  
  // Green Roof Ring?
  ctx.fillStyle = '#a8e6cf';
  ctx.beginPath();
  ctx.ellipse(x, y - z - 15, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Hole in middle (Pitch)
  ctx.fillStyle = '#55efc4';
  ctx.beginPath();
  ctx.ellipse(x, y - z - 15, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFuturePark(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Ferris Wheel or similar
  
  // Base
  drawBlock(ctx, x, y, z, '#e17055', '#d63031', '#ff7675', 5, 30);
  
  // Wheel (simplified as a ring or cylinder)
  ctx.strokeStyle = '#ffeaa7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y - z - 25, 20, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSeasidePark(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Beach umbrellas
  drawCylinder(ctx, x - 10, y, z, '#ffeaa7', 2, 10);
  ctx.fillStyle = '#ff7675';
  ctx.beginPath();
  ctx.arc(x - 10, y - z - 10, 8, 0, Math.PI * 2);
  ctx.fill();
  
  drawCylinder(ctx, x + 10, y + 5, z, '#ffeaa7', 2, 8);
  ctx.fillStyle = '#74b9ff';
  ctx.beginPath();
  ctx.arc(x + 10, y - z - 8, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarina(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Docks
  drawBlock(ctx, x, y, z, '#b2bec3', '#636e72', '#2d3436', 2, 40);
  
  // Boats (triangles)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x - 10, y - z);
  ctx.lineTo(x - 5, y - z - 10);
  ctx.lineTo(x, y - z);
  ctx.fill();
}

function drawFusionPower(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
  // Tokamak Reactor
  // Dome
  drawCylinder(ctx, x, y, z, '#6c5ce7', 20, 20);
  
  // Glow
  ctx.fillStyle = 'rgba(162, 155, 254, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y - z - 10, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBioTree(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, rand: number) {
  // Trunk
  drawCylinder(ctx, x, y, z, '#8d6e63', 2, 8 + rand * 5);
  
  // Leaves (Sphere-ish)
  const treeH = 8 + rand * 5;
  ctx.fillStyle = '#00b894';
  ctx.beginPath();
  ctx.arc(x, y - z - treeH, 6 + rand * 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpongePark(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, rand: number) {
  // Water retention pond
  ctx.fillStyle = '#74b9ff';
  ctx.beginPath();
  ctx.ellipse(x, y - z, 15, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Reeds
  ctx.strokeStyle = '#55efc4';
  ctx.lineWidth = 1;
  for(let i=0; i<5; i++) {
    const rx = x - 10 + i * 5;
    const ry = y + (i % 2) * 3;
    ctx.beginPath();
    ctx.moveTo(rx, ry - z);
    ctx.lineTo(rx, ry - z - 10);
    ctx.stroke();
  }
}
