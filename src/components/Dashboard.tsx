import React, { useMemo, useState, useEffect } from 'react';
import type { Card, DailyLog } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, BarChart, Bar, Legend, ReferenceLine, Label
} from 'recharts';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardProps {
  logs: DailyLog[];
  completedCards: Card[];
  activeCards: Card[];
  currentDay: number;
  isMultiplayer?: boolean;
  isAdmin?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  logs, 
  completedCards, 
  activeCards, 
  currentDay,
  isMultiplayer = false
}) => {
  const [showAggregate, setShowAggregate] = useState(false);
  const [aggregateData, setAggregateData] = useState<{
    totalGames: number;
    avgCycleTimeWeek1: number;
    avgCycleTimeWeek2: number;
    totalCardsCompleted: number;
  } | null>(null);

  /**
   * DATABASE AGGREGATION & ANALYTICS FETCH (Equivalent to SQL GROUP BY / AVG queries)
   * 
   * Since Firestore is a document-oriented NoSQL database, we cannot perform native server-side 
   * complex group-by or average calculations (unlike MSSQL's: SELECT AVG(cycle_time) FROM games GROUP BY week).
   * 
   * Instead, we run a query to fetch all completed game documents and aggregate the numbers 
   * client-side using map-reduce operations. We partition daily log arrays into weeks and calculate 
   * arithmetic means ($avgW1, $avgW2) using array accumulation.
   */
  useEffect(() => {
    if (!isMultiplayer || !showAggregate) return;

    const fetchAggregateStats = async () => {
      try {
        // Query to find completed sessions: SELECT * FROM games WHERE status = 'completed'
        const q = query(collection(db, 'games'), where('status', '==', 'completed'));
        const querySnapshot = await getDocs(q);
        
        let gamesCount = 0;
        let totalCards = 0;
        let cycleTimesWeek1: number[] = [];
        let cycleTimesWeek2: number[] = [];

        querySnapshot.forEach(gameDoc => {
          gamesCount += 1;
          const game = gameDoc.data();
          const dailyLogs = game.dailyLogs || [];
          
          // Split log entries by week
          const week1Logs = dailyLogs.filter((l: any) => l.day <= 5);
          const week2Logs = dailyLogs.filter((l: any) => l.day >= 6);

          week1Logs.forEach((l: any) => {
            if (l.averageCycleTime) cycleTimesWeek1.push(l.averageCycleTime);
          });
          week2Logs.forEach((l: any) => {
            if (l.averageCycleTime) cycleTimesWeek2.push(l.averageCycleTime);
          });

          if (dailyLogs.length > 0) {
            const lastLog = dailyLogs[dailyLogs.length - 1];
            totalCards += lastLog.cumulativeThroughput || 0;
          }
        });

        const avgW1 = cycleTimesWeek1.length > 0 
          ? parseFloat((cycleTimesWeek1.reduce((a, b) => a + b, 0) / cycleTimesWeek1.length).toFixed(1)) 
          : 0;
        const avgW2 = cycleTimesWeek2.length > 0 
          ? parseFloat((cycleTimesWeek2.reduce((a, b) => a + b, 0) / cycleTimesWeek2.length).toFixed(1)) 
          : 0;

        setAggregateData({
          totalGames: gamesCount,
          avgCycleTimeWeek1: avgW1,
          avgCycleTimeWeek2: avgW2,
          totalCardsCompleted: totalCards
        });
      } catch (err) {
        console.error('Failed to fetch aggregate stats:', err);
      }
    };

    fetchAggregateStats();
  }, [isMultiplayer, showAggregate]);
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

  const weekData = useMemo(() => {
    const weeksCount = Math.max(1, Math.ceil(currentDay / 5));
    const result = [];
    
    for (let w = 1; w <= weeksCount; w++) {
      const startDay = (w - 1) * 5 + 1;
      const endDay = w * 5;
      const weekLogs = logs.filter(l => l.day >= startDay && l.day <= endDay);
      
      const weekCompletedCards = completedCards.filter(c => 
        c.completedAt !== null && c.completedAt >= startDay && c.completedAt <= endDay
      );
      
      const throughput = weekCompletedCards.length;
      
      let totalCycleTime = 0;
      let totalLeadTime = 0;
      weekCompletedCards.forEach(c => {
        const lead = c.completedAt !== null ? c.completedAt - c.createdAt : 0;
        const cycle = c.completedAt !== null && c.startedAt !== null ? c.completedAt - c.startedAt : lead;
        totalLeadTime += lead;
        totalCycleTime += cycle;
      });
      
      const avgCycle = throughput > 0 ? parseFloat((totalCycleTime / throughput).toFixed(1)) : 0;
      const avgLead = throughput > 0 ? parseFloat((totalLeadTime / throughput).toFixed(1)) : 0;
      
      // Determine active accelerators during this week
      const hasWip = weekLogs.some(l => l.wipLimitsActive);
      const hasShiftLeft = weekLogs.some(l => l.shiftLeftActive);
      const hasSwarming = weekLogs.some(l => l.swarmingActive);
      const hasSmallerBatches = weekLogs.some(l => l.smallerBatchesActive);
      
      const activeScenarios = [];
      if (hasWip) activeScenarios.push('WIP Limits');
      if (hasShiftLeft) activeScenarios.push('Shift-Left');
      if (hasSwarming) activeScenarios.push('Swarming');
      if (hasSmallerBatches) activeScenarios.push('Smaller Batches');
      
      result.push({
        weekNumber: w,
        weekName: `Week ${w}`,
        startDay,
        endDay,
        throughput,
        avgCycleTime: avgCycle,
        avgLeadTime: avgLead,
        activeScenarios: activeScenarios.length > 0 ? activeScenarios : ['Baseline Chaos'],
        completedCards: weekCompletedCards
      });
    }
    
    return result;
  }, [logs, completedCards, currentDay]);

  return (
    <div className="metrics-dashboard" style={{ display: 'grid', gap: '20px', padding: '10px' }}>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button
          onClick={() => setShowAggregate(false)}
          className="btn"
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            backgroundColor: !showAggregate ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: !showAggregate ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-glass)'
          }}
        >
          Current Session
        </button>
        <button
          onClick={() => setShowAggregate(true)}
          className="btn"
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            backgroundColor: showAggregate ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: showAggregate ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-glass)'
          }}
        >
          Process Comparison
        </button>
      </div>

      {showAggregate ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Side-by-side performance cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {weekData.map((week, idx) => {
              const gradients = [
                'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(245,158,11,0.04) 100%)', // Week 1 (Red/Orange)
                'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.04) 100%)', // Week 2 (Emerald/Teal)
                'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.04) 100%)', // Week 3 (Indigo/Purple)
                'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(244,63,94,0.04) 100%)'  // Week 4 (Pink/Rose)
              ];
              const borderColors = [
                '#f43f5e',
                '#10b981',
                '#6366f1',
                '#ec4899'
              ];
              
              const bgGradient = gradients[idx % gradients.length];
              const borderColor = borderColors[idx % borderColors.length];
              const isInProgress = currentDay >= week.startDay && currentDay <= week.endDay;
              
              return (
                <div 
                  key={week.weekNumber} 
                  className="glass-panel" 
                  style={{ 
                    padding: '20px', 
                    background: bgGradient, 
                    borderLeft: `4px solid ${borderColor}`,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {isInProgress && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '12px', 
                      right: '12px', 
                      backgroundColor: 'rgba(245,158,11,0.2)', 
                      color: 'var(--accent-amber)', 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.65rem', 
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      border: '1px solid rgba(245,158,11,0.3)'
                    }}>
                      In Progress
                    </span>
                  )}
                  
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{week.weekName}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Days {week.startDay} - {week.endDay}
                    </p>
                  </div>

                  {/* Active Scenarios Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {week.activeScenarios.map(sc => (
                      <span 
                        key={sc} 
                        style={{ 
                          fontSize: '0.65rem', 
                          backgroundColor: 'rgba(255,255,255,0.06)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '4px', 
                          padding: '2px 6px',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {sc}
                      </span>
                    ))}
                  </div>

                  {/* Key Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Throughput</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: borderColor }}>{week.throughput} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>cards</span></span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Avg Cycle Time</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{week.avgCycleTime} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>days</span></span>
                    </div>
                  </div>

                  {/* Completed Cards List */}
                  <div style={{ marginTop: '5px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                      Delivered Cards ({week.throughput})
                    </span>
                    {week.completedCards.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No cards completed this week.</span>
                    ) : (
                      <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '4px' }}>
                        {week.completedCards.map(c => {
                          const cycle = c.completedAt !== null && c.startedAt !== null ? c.completedAt - c.startedAt : 0;
                          return (
                            <div 
                              key={c.id} 
                              style={{ 
                                fontSize: '0.7rem', 
                                background: 'rgba(255,255,255,0.02)', 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid rgba(255,255,255,0.03)'
                              }}
                            >
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                {c.title}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{cycle}d cycle</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparative charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
            {/* Cycle Time Chart */}
            <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
              <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                Average Cycle Time Comparison
              </h3>
              <div style={{ width: '100%', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="weekName" stroke="var(--text-secondary)" fontSize={10} />
                    <YAxis stroke="var(--text-secondary)" fontSize={10} label={{ value: 'Avg Cycle Time (Days)', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="avgCycleTime" name="Average Cycle Time (Days)">
                      {weekData.map((_entry, index) => {
                        const colors = ['#f43f5e', '#10b981', '#6366f1', '#ec4899'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '15px', fontStyle: 'italic', textAlign: 'center' }}>
                Demonstrates the progression of team cycle times as new flow accelerators (WIP Limits, Shift-Left QA, etc.) are applied week-over-week.
              </p>
            </div>

            {/* Throughput Chart */}
            <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
              <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                Throughput Comparison (Completed Items)
              </h3>
              <div style={{ width: '100%', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="weekName" stroke="var(--text-secondary)" fontSize={10} />
                    <YAxis stroke="var(--text-secondary)" fontSize={10} label={{ value: 'Completed Cards', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="throughput" name="Cards Completed">
                      {weekData.map((_entry, index) => {
                        const colors = ['#f43f5e', '#10b981', '#6366f1', '#ec4899'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '15px', fontStyle: 'italic', textAlign: 'center' }}>
                Shows the total count of user stories fully delivered in each 5-day cycle.
              </p>
            </div>
          </div>

          {/* Historical class aggregate stats (Multiplayer Benchmarking) */}
          {isMultiplayer && aggregateData && aggregateData.totalGames > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px', borderTop: '1px solid var(--border-glass)', paddingTop: '25px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Classroom Benchmarks (Historical Runs)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Compare your session metrics with historical averages from other class cohorts.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Completed Sessions</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>{aggregateData.totalGames}</p>
                </div>
                <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Avg Week 1 Cycle Time</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-red)' }}>{aggregateData.avgCycleTimeWeek1} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>days</span></p>
                </div>
                <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Avg Week 2 Cycle Time</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-green)' }}>{aggregateData.avgCycleTimeWeek2} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>days</span></p>
                </div>
                <div className="glass-panel" style={{ padding: '15px', textAlign: 'center' }}>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Total Cards Delivered</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{aggregateData.totalCardsCompleted}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px', minHeight: '350px' }}>
                  <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                    WIP Limit Impact on Cycle Time (Historical Comparison)
                  </h3>
                  <div style={{ width: '100%', height: '260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Week 1 (Unconstrained WIP)', CycleTime: aggregateData.avgCycleTimeWeek1 },
                        { name: 'Week 2 (WIP Limits & Pairing)', CycleTime: aggregateData.avgCycleTimeWeek2 }
                      ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} label={{ value: 'Avg Cycle Time (Days)', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-secondary)', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="CycleTime" name="Average Cycle Time (Days)">
                          <Cell fill="var(--accent-red)" />
                          <Cell fill="var(--accent-green)" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '15px', fontStyle: 'italic', textAlign: 'center' }}>
                    This chart aggregates all historic finished game runs to demonstrate how restricting Work In Progress (WIP) and pairing developers impacts average cycle times.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <>
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

      </>
    )}
    </div>
  );
};
