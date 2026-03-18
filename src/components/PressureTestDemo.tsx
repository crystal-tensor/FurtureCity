import React, { useState } from 'react';
import { simulateOasisPressureTest } from '../game/operations';
import type { OperationsControls, OasisSimulationResult, OasisAgent } from '../game/types';

const DEFAULT_CONTROLS: OperationsControls = {
  populationDrift: 10,
  weatherVolatility: 20,
  trafficLoad: 30,
  industrialLoad: 20,
  eventLoad: 10,
  alertThreshold: 0.8,
};

export default function PressureTestDemo() {
  const [controls, setControls] = useState<OperationsControls>(DEFAULT_CONTROLS);
  const [result, setResult] = useState<OasisSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await simulateOasisPressureTest(controls);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateControl = (key: keyof OperationsControls, value: number) => {
    setControls(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#eee', background: '#111', minHeight: '100vh' }}>
      <h1>OASIS Pressure Test Demo</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        {/* Controls Section */}
        <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
          <h2>Simulation Controls</h2>
          <ControlSlider 
            label="Population Drift" 
            value={controls.populationDrift} 
            onChange={v => updateControl('populationDrift', v)} 
          />
          <ControlSlider 
            label="Weather Volatility" 
            value={controls.weatherVolatility} 
            onChange={v => updateControl('weatherVolatility', v)} 
          />
          <ControlSlider 
            label="Traffic Load" 
            value={controls.trafficLoad} 
            onChange={v => updateControl('trafficLoad', v)} 
          />
          <ControlSlider 
            label="Industrial Load" 
            value={controls.industrialLoad} 
            onChange={v => updateControl('industrialLoad', v)} 
          />
          <ControlSlider 
            label="Event Load" 
            value={controls.eventLoad} 
            onChange={v => updateControl('eventLoad', v)} 
          />
          
          <button 
            onClick={handleSimulate} 
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '20px',
              background: loading ? '#555' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Simulating...' : 'Run OASIS Simulation'}
          </button>
          
          {error && <div style={{ color: 'red', marginTop: '10px' }}>Error: {error}</div>}
        </div>

        {/* Results Section */}
        <div style={{ background: '#222', padding: '20px', borderRadius: '8px' }}>
          <h2>Simulation Results</h2>
          {!result && <div style={{ color: '#888' }}>Run simulation to see results</div>}
          
          {result && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <StatCard label="Peak Demand" value={result.aggregatedStats.peakDemand.toFixed(0)} unit="kWh" />
                <StatCard label="Complaints" value={result.aggregatedStats.totalComplaintVolume} unit="" />
                <StatCard label="Carbon Impact" value={result.aggregatedStats.carbonImpact.toFixed(1)} unit="tons" />
                <StatCard label="Economic Loss" value={result.aggregatedStats.economicLoss.toFixed(0)} unit="$" />
              </div>

              <h3>Timeline (24h)</h3>
              <div style={{ height: '150px', display: 'flex', alignItems: 'flex-end', gap: '2px', marginBottom: '20px', background: '#333', padding: '10px' }}>
                {result.steps.map((step, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      flex: 1, 
                      height: `${(step.totalDemand / result.aggregatedStats.peakDemand) * 100}%`, 
                      background: step.gridStress > 50 ? '#ff4444' : '#44ff44',
                      position: 'relative',
                      minHeight: '4px'
                    }}
                    title={`Hour ${step.step}: Demand ${step.totalDemand.toFixed(0)}, Stress ${step.gridStress.toFixed(0)}%`}
                  />
                ))}
              </div>

              <h3>Social Feed</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#333', padding: '10px', borderRadius: '4px' }}>
                {result.steps.flatMap(s => s.socialFeed).map((post, i) => (
                  <div key={i} style={{ marginBottom: '10px', padding: '10px', background: '#444', borderRadius: '4px', borderLeft: `4px solid ${post.sentiment === 'negative' ? 'red' : post.sentiment === 'positive' ? 'green' : 'gray'}` }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{post.agentName} <span style={{ fontSize: '12px', color: '#aaa' }}>@{post.agentId}</span></div>
                    <div style={{ margin: '5px 0' }}>{post.content}</div>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>Likes: {post.likes}</div>
                  </div>
                ))}
              </div>

              <h3>Active Agents</h3>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginTop: '10px' }}>
                {result.agents.map(agent => (
                  <div key={agent.id} style={{ padding: '10px', background: '#444', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold' }}>{agent.name}</div>
                    <div style={{ fontSize: '12px' }}>Satisfaction: {agent.satisfaction.toFixed(0)}</div>
                    <div style={{ fontSize: '12px' }}>Stress: {agent.stress.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlSlider({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <label>{label}</label>
        <span>{value}</span>
      </div>
      <input 
        type="range" 
        min="0" 
        max="100" 
        value={value} 
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string, value: number | string, unit: string }) {
  return (
    <div style={{ background: '#444', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
      <div style={{ fontSize: '12px', color: '#aaa' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{value} <span style={{ fontSize: '12px' }}>{unit}</span></div>
    </div>
  );
}