import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCost, placeBuilding } from '../game/grid';
import { renderGame, toGrid } from '../game/renderer';
import type { GameState, Tile, TileType } from '../game/types';

interface GameCanvasProps {
  stateRef: React.MutableRefObject<GameState>;
  showEnergyFlow: boolean;
  selectedTool: TileType | 'cursor' | 'bulldozer';
  readOnly?: boolean;
  className?: string;
  onSelectTile?: (coords: { x: number; y: number }, tile: Tile | undefined) => void;
  onStateMutated?: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  stateRef,
  showEnergyFlow,
  selectedTool,
  readOnly = false,
  className,
  onSelectTile,
  onStateMutated,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number }>();
  const [camera, setCamera] = useState({ x: 1600, y: 1600, zoom: 0.6 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const currentTile = useMemo(() => {
    if (!hoverTile) {
      return undefined;
    }
    return stateRef.current.grid[hoverTile.y]?.[hoverTile.x];
  }, [hoverTile, stateRef]);

  const getMaxZoom = () => {
    const canvas = canvasRef.current;
    if (!canvas) return 4.8;
    const mapW = stateRef.current.gridWidth * 32;
    const mapH = stateRef.current.gridHeight * 32;
    return Math.min(canvas.width / mapW, canvas.height / mapH) * 0.99;
  };

  // Auto-zoom to fit map on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      // Calculate fit zoom
      const mapW = stateRef.current.gridWidth * 32;
      const mapH = stateRef.current.gridHeight * 32;
      const fitZoom = Math.min(rect.width / mapW, rect.height / mapH) * 0.99; // 99% fit
      
      // Update camera to center and fit
      setCamera({
        x: mapW / 2,
        y: mapH / 2,
        zoom: Math.max(0.1, fitZoom)
      });
    }
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) {
      return;
    }

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let frameId = 0;

    const draw = () => {
      ctx.fillStyle = '#07131b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      renderGame(ctx, stateRef.current, camera, hoverTile, showEnergyFlow);
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [camera, hoverTile, showEnergyFlow, stateRef]);

  const mutateTile = (coords: { x: number; y: number }) => {
    if (readOnly) {
      return;
    }

    const state = stateRef.current;
    if (selectedTool === 'cursor') {
      onSelectTile?.(coords, state.grid[coords.y]?.[coords.x]);
      return;
    }

    if (selectedTool === 'bulldozer') {
      const tile = state.grid[coords.y]?.[coords.x];
      if (tile && tile.type !== 'grass') {
        stateRef.current = placeBuilding(state, coords.x, coords.y, 'grass');
        onStateMutated?.();
      }
      return;
    }

    const tile = state.grid[coords.y]?.[coords.x];
    if (!tile || tile.type === selectedTool) {
      return;
    }

    if (state.money < getCost(selectedTool)) {
      return;
    }

    stateRef.current = placeBuilding(state, coords.x, coords.y, selectedTool);
    onStateMutated?.();
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button === 1 || event.button === 2) {
      setIsDragging(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
      return;
    }

    if (event.button === 0) {
      if (hoverTile) {
        mutateTile(hoverTile);
      }
      setIsPainting(!readOnly && selectedTool !== 'cursor');
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (isDragging) {
      const dx = (event.clientX - lastMousePos.x) / camera.zoom;
      const dy = (event.clientY - lastMousePos.y) / camera.zoom;
      setCamera((previous) => ({ ...previous, x: previous.x - dx, y: previous.y - dy }));
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }

    const rect = canvas.getBoundingClientRect();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (mouseX - centerX) / camera.zoom + camera.x;
    const worldY = (mouseY - centerY) / camera.zoom + camera.y;
    const coords = toGrid(worldX, worldY);

    setHoverTile(coords);
    if (isPainting) {
      mutateTile(coords);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPainting(false);
  };

  const handleWheel = (event: React.WheelEvent) => {
    const maxZoom = getMaxZoom();
    setCamera((previous) => ({
      ...previous,
      zoom: Math.max(0.1, Math.min(maxZoom, previous.zoom - event.deltaY * 0.001)),
    }));
  };

  const adjustZoom = (delta: number) => {
    const maxZoom = getMaxZoom();
    setCamera((previous) => ({
      ...previous,
      zoom: Math.max(0.1, Math.min(maxZoom, Number((previous.zoom + delta).toFixed(2)))),
    }));
  };

  const fitToScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const mapW = stateRef.current.gridWidth * 32;
    const mapH = stateRef.current.gridHeight * 32;
    const rect = canvas.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / mapW, rect.height / mapH) * 0.99;
    
    setCamera({
      x: mapW / 2,
      y: mapH / 2,
      zoom: fitZoom
    });
  };

  return (
    <div ref={wrapperRef} className={className ? `game-canvas-shell ${className}` : 'game-canvas-shell'}>
      <canvas
        ref={canvasRef}
        className="city-canvas"
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      {!readOnly && (
        <div className="canvas-zoom-controls">
          <button type="button" className="canvas-zoom-button" onClick={fitToScreen} title="Fit to Screen">
            Fit
          </button>
          <button type="button" className="canvas-zoom-button" onClick={() => adjustZoom(0.2)}>
            +
          </button>
          <span>{Math.round(camera.zoom * 100)}%</span>
          <button type="button" className="canvas-zoom-button" onClick={() => adjustZoom(-0.2)}>
            -
          </button>
        </div>
      )}
      {currentTile && (
        <div className="canvas-tooltip">
          <strong>{currentTile.type}</strong>
          <span>{currentTile.district}</span>
          <span>{currentTile.population > 0 ? `活跃人口 ${currentTile.population}` : '基础设施单元'}</span>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
