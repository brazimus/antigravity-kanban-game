import React, { useMemo } from 'react';
import type { Card, DailyLog } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, BarChart, Bar, Legend, ReferenceLine, Label
} from 'recharts';

interface DashboardProps {
  logs: DailyLog[];
  completedCards: Card[];
  activeCards: Card[];
  currentDay: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ logs, completedCards, activeCards, currentDay }) => {
  // 1. CFD Data Prep
  const cfdData = useMemo(() => {
    return logs.map(log => ({
      day: `Day ${log.day}`,
      Done: log.columnWIP.done || 0,
      Testing: log.columnWIP.testing || 0,
      Development: log.columnWIP.development || 0,
      Analysis: log.columnWIP.analysis || 0,
      Ready: log.columnWIP.ready || 0,
      Backlog: log.columnWIP.backlog || 0,
    }));
  }, [logs]);

  // 2. Scatter Plot Data (Cycle Time Control Chart)
  const scatterData = useMemo(() => {
    return completedCards.map(c => {
      const cycleTime = c.completedAt !== null && c.startedAt !== null 
        ? c.completedAt - c.startedAt 
        : (c.completedAt || 0) - c.createdAt; // fallback to lead time
      
      return {
        id: c.id,
        title: c.title,
        completionDay: c.completedAt,
        cycleTime: cycleTime,
        type: c.type,
      };
    }).sort((a, b) => (a.completionDay || 0) - (b.completionDay || 0));
  }, [completedCards]);

  const avgCycleTime = useMemo(() => {
    if (scatterData.length === 0) return 0;
    const sum = scatterData.reduce((acc, curr) => acc + curr.cycleTime, 0);
    return parseFloat((sum / scatterData.length).toFixed(1));
  }, [scatterData]);

  // 3. Lead & Cycle Time Distribution Data (Histogram)
  const distributionData = useMemo(() => {
    const distMap: { [days: number]: { days: number; LeadTime: number; CycleTime: number } } = {};
    
    completedCards.forEach(c => {
      const leadTime = c.completedAt !== null ? c.completedAt - c.createdAt : 0;
      const cycleTime = c.completedAt !== null && c.startedAt !== null ? c.completedAt - c.startedAt : leadTime;

      // Group by day count
      if (!distMap[leadTime]) distMap[leadTime] = { days: leadTime, LeadTime: 0, CycleTime: 0 };
      distMap[leadTime].LeadTime += 1;

      if (!distMap[cycleTime]) distMap[cycleTime] = { days: cycleTime, LeadTime: 0, CycleTime: 0 };
      distMap[cycleTime].CycleTime += 1;
    });

    return Object.values(distMap).sort((a, b) => a.days - b.days);
  }, [completedCards]);

  // 4. Aging WIP (Active Cards)
  const agingData = useMemo(() => {
    return activeCards
      .filter(c => c.columnId !== 'backlog' && c.columnId !== 'done')
      .map(c => {
        const age = currentDay - c.createdAt;
        let stageAge = 0;
        // Calculate age in current column from history
        const lastMove = c.history.filter(h => h.columnId === c.columnId).slice(-1)[0];
        if (lastMove) {
          stageAge = currentDay - lastMove.day;
        }

        return {
          id: c.id,
          title: c.title,
          column: c.columnId.toUpperCase(),
          totalAge: age,
          stageAge: stageAge,
          isBlocked: c.isBlocked,
        };
      })
      .sort((a, b) => b.totalAge - a.totalAge);
  }, [activeCards, currentDay]);

  // 5. Takt Time / Throughput calculations
  // Throughput = cards completed per day. Takt time = days per card.
  const metricsSummary = useMemo(() => {
    const totalDaysPlayed = logs.length;
    const completedCount = completedCards.length;
    const throughputRate = totalDaysPlayed > 0 ? (completedCount / totalDaysPlayed).toFixed(2) : '0';
    const taktTime = completedCount > 0 ? (totalDaysPlayed / completedCount).toFixed(1) : '0';
    
    return {
      throughputRate,
      taktTime,
      completedCount,
    };
  }, [logs, completedCards]);

  return (
    <div className="metrics-dashboard" style={{ display: 'grid', gap: '20px', padding: '10px' }}>
      
      {/* Top Level Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Throughput</h4>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>{metricsSummary.throughputRate} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>cards/day</span></p>
        </div>
        <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Takt Time (Avg Delivery Pace)</h4>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--secondary)' }}>{metricsSummary.taktTime} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>days/card</span></p>
        </div>
        <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Avg Cycle Time</h4>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-green)' }}>{avgCycleTime} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>days</span></p>
        </div>
        <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Completed Cards</h4>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{metricsSummary.completedCount}</p>
        </div>
      </div>

      {/* Main Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        
        {/* Cumulative Flow Diagram */}
        <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
            Cumulative Flow Diagram (CFD)
          </h3>
          {cfdData.length === 0 ? (
            <div style={{ display: 'flex', height: '260px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No days completed yet. CFD will draw as you complete days.
            </div>
          ) : (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cfdData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={10} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: '#fff' }}
                  />
                  {/* CFD stack order: Backlog -> Ready -> Analysis -> Dev -> Test -> Done */}
                  <Area type="monotone" dataKey="Backlog" stackId="1" stroke="hsl(215, 15%, 45%)" fill="hsl(215, 15%, 35%)" opacity={0.6} />
                  <Area type="monotone" dataKey="Ready" stackId="1" stroke="hsl(199, 89%, 48%)" fill="hsla(199, 89%, 48%, 0.4)" opacity={0.6} />
                  <Area type="monotone" dataKey="Analysis" stackId="1" stroke="hsl(263, 85%, 65%)" fill="hsla(263, 85%, 65%, 0.4)" opacity={0.6} />
                  <Area type="monotone" dataKey="Development" stackId="1" stroke="hsl(38, 92%, 50%)" fill="hsla(38, 92%, 50%, 0.4)" opacity={0.6} />
                  <Area type="monotone" dataKey="Testing" stackId="1" stroke="hsl(346, 84%, 50%)" fill="hsla(346, 84%, 50%, 0.4)" opacity={0.6} />
                  <Area type="monotone" dataKey="Done" stackId="1" stroke="hsl(142, 72%, 45%)" fill="hsla(142, 72%, 45%, 0.3)" />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Control Chart (Cycle Time Scatter Plot) */}
        <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
            Cycle Time Control Chart
          </h3>
          {scatterData.length === 0 ? (
            <div style={{ display: 'flex', height: '260px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No completed cards. Complete tasks to see cycle times.
            </div>
          ) : (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    type="number" 
                    dataKey="completionDay" 
                    name="Day Completed" 
                    stroke="var(--text-secondary)" 
                    fontSize={10}
                    domain={[1, 'dataMax + 1']}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="cycleTime" 
                    name="Cycle Time (Days)" 
                    stroke="var(--text-secondary)" 
                    fontSize={10} 
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: '#fff' }}
                    formatter={(value, name) => {
                      if (name === "Cycle Time (Days)") return [`${value} days`, name];
                      if (name === "Day Completed") return [`Day ${value}`, name];
                      return [value, name];
                    }}
                  />
                  <Scatter name="Tasks" data={scatterData} fill="var(--primary)">
                    {scatterData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.type === 'expedite' ? 'var(--accent-red)' : 'var(--primary)'} 
                      />
                    ))}
                  </Scatter>
                  <ReferenceLine y={avgCycleTime} stroke="var(--accent-green)" strokeDasharray="4 4">
                    <Label value={`Avg: ${avgCycleTime} days`} position="top" fill="var(--accent-green)" fontSize={10} />
                  </ReferenceLine>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Lead vs. Cycle Time Distribution (Histogram) */}
        <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
            Lead & Cycle Time Distribution
          </h3>
          {completedCards.length === 0 ? (
            <div style={{ display: 'flex', height: '260px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No completed cards to show distribution.
            </div>
          ) : (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="days" stroke="var(--text-secondary)" fontSize={10} label={{ value: 'Days', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} label={{ value: 'Frequency', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="LeadTime" name="Lead Time" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="CycleTime" name="Cycle Time" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Work Item Aging (Aging WIP) */}
        <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
            Active Work Item Aging
          </h3>
          {agingData.length === 0 ? (
            <div style={{ display: 'flex', height: '260px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No active WIP in columns (Analysis, Dev, Test).
            </div>
          ) : (
            <div style={{ maxHeight: '260px', overflowY: 'auto', paddingRight: '5px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 0' }}>Card Title</th>
                    <th>Column</th>
                    <th>Total Age</th>
                    <th>Stage Age</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agingData.map(item => {
                    // Determine age indicator color
                    const isOld = item.totalAge > avgCycleTime * 1.5 && avgCycleTime > 0;
                    const isStale = item.stageAge > 3;
                    let ageColor = 'var(--text-primary)';
                    if (item.isBlocked) ageColor = 'var(--accent-red)';
                    else if (isOld) ageColor = 'var(--accent-amber)';
                    else if (isStale) ageColor = 'var(--secondary)';

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px dotted rgba(255,255,255,0.05)', color: ageColor }}>
                        <td style={{ padding: '10px 0', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </td>
                        <td>{item.column}</td>
                        <td>{item.totalAge} {item.totalAge === 1 ? 'day' : 'days'}</td>
                        <td>{item.stageAge} {item.stageAge === 1 ? 'day' : 'days'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {item.isBlocked ? (
                            <span style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: 'var(--accent-red)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              BLOCKED
                            </span>
                          ) : isOld ? (
                            <span style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              AGING
                            </span>
                          ) : (
                            <span style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              HEALTHY
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
