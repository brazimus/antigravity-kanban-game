import React, { useRef, useEffect, useState } from 'react';
import type { GameState } from '../types';
import { Dices, RotateCcw, ArrowRight, CheckSquare, BookOpen, RefreshCw, Shield, Zap, Users, Scissors, Calendar, AlertTriangle, Monitor, Sparkles } from 'lucide-react';

const RECOMMENDATION_MAP: { [key: string]: string } = {
  'tradeshow': 'smaller_batches',
  'security_breach': 'wip_limits',
  'os_upgrade': 'swarming',
  'wip_limits': 'security_breach',
  'shift_left': 'os_upgrade'
};

const cyoaScenarios = [
  {
    id: 'reset',
    name: 'Baseline Chaos',
    description: 'Remove all accelerators and events to see baseline flow.',
    category: 'System Baseline',
    color: '#6b7280',
  },
  {
    id: 'wip_limits',
    name: 'Visualize & Limit WIP',
    description: 'Enforce WIP limits: Analysis (2), Dev (2), Test (1). Enables developer pairing.',
    category: 'Flow Accelerator',
    color: '#8b5cf6',
  },
  {
    id: 'shift_left',
    name: 'Shift-Left Continuous Testing',
    description: 'Eliminates the testing column queue. Dev and test effort are worked concurrently.',
    category: 'Flow Accelerator',
    color: '#06b6d4',
  },
  {
    id: 'swarming',
    name: 'Cross-Functional Swarming',
    description: 'Reduces context-switching penalty to 0 when swarming to help teammates.',
    category: 'Flow Accelerator',
    color: '#f59e0b',
  },
  {
    id: 'smaller_batches',
    name: 'Story Splitting & Smaller Batches',
    description: 'Halves effort requirements on backlog cards. Splits Trade Show Epic into stories.',
    category: 'Flow Accelerator',
    color: '#10b981',
  },
  {
    id: 'tradeshow',
    name: 'Trade Show Deadline',
    description: 'Injects a monolithic Epic demo card (Dev: 12, Test: 6) with prep overhead.',
    category: 'Business Event',
    color: '#ec4899',
  },
  {
    id: 'security_breach',
    name: 'Security Breach Resolution',
    description: 'Blocks 50% of active Dev cards and injects urgent expedite cards that bypass WIP limits.',
    category: 'Business Event',
    color: '#ef4444',
  },
  {
    id: 'os_upgrade',
    name: 'Client OS Upgrade',
    description: 'Triggers workstation upgrades capacity overhead and increases blocker risk.',
    category: 'Business Event',
    color: '#3b82f6',
  }
];

interface ControlsProps {
  gameState: GameState;
  onRollDice: () => void;
  onEndDay: () => void;
  onStartNextDay: (scenarioIdOrAcc?: string | {
    wipLimitsActive?: boolean;
    shiftLeftActive?: boolean;
    swarmingActive?: boolean;
    smallerBatchesActive?: boolean;
  }) => void;
  onRestartGame: () => void;
  onResetDailyWork: () => void;
  isMultiplayer?: boolean;
  isAdmin?: boolean;
  onQueueEvent?: (eventId: string | null) => void;
  onFastForward?: () => void;
  onInjectCustomExpediteCards?: (titlePrefix: string, count: number) => void;
}


export const Controls: React.FC<ControlsProps> = ({
  gameState,
  onRollDice,
  onEndDay,
  onStartNextDay,
  onRestartGame,
  onResetDailyWork,
  isMultiplayer = false,
  isAdmin = false,
  onQueueEvent,
  onFastForward,
  onInjectCustomExpediteCards
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Local states for weekend accelerator selectors
  const [wipLimitsActive, setWipLimitsActive] = useState(gameState.wipLimitsActive || false);
  const [shiftLeftActive, setShiftLeftActive] = useState(gameState.shiftLeftActive || false);
  const [swarmingActive, setSwarmingActive] = useState(gameState.swarmingActive || false);
  const [smallerBatchesActive, setSmallerBatchesActive] = useState(gameState.smallerBatchesActive || false);

  const getInitialScenarioId = () => {
    if (gameState.wipLimitsActive) return 'wip_limits';
    if (gameState.shiftLeftActive) return 'shift_left';
    if (gameState.swarmingActive) return 'swarming';
    if (gameState.smallerBatchesActive) return 'smaller_batches';
    return 'reset';
  };

  const [selectedCYOAScenario, setSelectedCYOAScenario] = useState(getInitialScenarioId());

  // Local states for custom urgent work injector
  const [urgentTitle, setUrgentTitle] = useState('Security Breach Resolution');
  const [urgentCount, setUrgentCount] = useState(2);

  // Synchronize local states with gameState reactively
  useEffect(() => {
    setWipLimitsActive(gameState.wipLimitsActive || false);
    setShiftLeftActive(gameState.shiftLeftActive || false);
    setSwarmingActive(gameState.swarmingActive || false);
    setSmallerBatchesActive(gameState.smallerBatchesActive || false);
    setSelectedCYOAScenario(getInitialScenarioId());
  }, [gameState.wipLimitsActive, gameState.shiftLeftActive, gameState.swarmingActive, gameState.smallerBatchesActive, gameState.gamePhase]);


  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.eventLogs]);

  // Calculate total remaining team capacity
  const totalRemainingCapacity = gameState.avatars.reduce((sum, a) => sum + a.remainingCapacity, 0);

  return (
    <div className="controls-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      minHeight: '100%',
    }}>
      
      {/* Simulation Status Card */}
      <div className="glass-panel" style={{ padding: '15px', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
            Day {gameState.day} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/ {gameState.maxDays}</span>
          </h2>
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: 700, 
            padding: '3px 8px', 
            borderRadius: '10px',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: 'var(--primary)',
            textTransform: 'uppercase'
          }}>
            {gameState.gamePhase.replace('_', ' ')}
          </span>
        </div>

        {/* Phase-specific actions */}
        <div style={{ marginTop: '15px' }}>
          {gameState.gamePhase === 'day_start' && (
            isMultiplayer && isAdmin ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Waiting for players to roll capacity dice...
              </p>
            ) : isMultiplayer && gameState.rolledToday ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Dice rolled! Waiting for other players to finish rolling...
              </p>
            ) : (
              <button 
                onClick={onRollDice} 
                className="btn btn-primary pulse-primary" 
                style={{ width: '100%', padding: '12px' }}
              >
                <Dices size={16} /> Roll Capacity Dice
              </button>
            )
          )}

          {gameState.gamePhase === 'dice_rolled' && (
            <div>
              {isMultiplayer && !isAdmin ? (
                <div>
                  <button 
                    onClick={onResetDailyWork} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', padding: '10px', fontSize: '0.8rem', gap: '4px', marginBottom: '10px', justifyContent: 'center' }}
                  >
                    <RotateCcw size={12} /> Revert My Allocations
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', textAlign: 'center', fontWeight: 600 }}>
                    Waiting for instructor to run the day...
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button 
                      onClick={onResetDailyWork} 
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '10px', fontSize: '0.8rem', gap: '4px' }}
                    >
                      <RotateCcw size={12} /> Undo Today
                    </button>
                    <button 
                      onClick={onEndDay} 
                      className="btn btn-primary" 
                      style={{ 
                        flex: 2, 
                        padding: '10px', 
                        fontSize: '0.8rem',
                        backgroundColor: totalRemainingCapacity === 0 ? 'var(--accent-green)' : 'var(--primary)',
                        boxShadow: totalRemainingCapacity === 0 ? 'var(--shadow-neon-success)' : 'var(--shadow-neon-primary)',
                        gap: '4px'
                      }}
                    >
                      <CheckSquare size={12} /> Run Day {gameState.day} →
                    </button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {totalRemainingCapacity > 0 
                      ? `Remaining team capacity: ${totalRemainingCapacity} pts left.` 
                      : 'All capacity allocated! Click Run Day to progress.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {gameState.gamePhase === 'day_summary' && (
            isMultiplayer && !isAdmin ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Day summary complete. Waiting for instructor to start Day {gameState.day + 1}...
              </p>
            ) : (
              <button 
                onClick={() => onStartNextDay()} 
                className="btn btn-primary pulse-primary" 
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--secondary)', boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
              >
                <ArrowRight size={16} /> Start Day {gameState.day + 1}
              </button>
            )
          )}

          {gameState.gamePhase === 'week_summary' && (
            isMultiplayer && !isAdmin ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Weekend: Reviewing week performance. Waiting for instructor to select next week parameters...
              </p>
            ) : !isMultiplayer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Choose Your Next Adventure
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0 0 5px 0', lineHeight: 1.3 }}>
                  Select exactly one accelerator or business event. We limit variables so that impacts are clear.
                </p>

                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  maxHeight: '340px', 
                  overflowY: 'auto', 
                  paddingRight: '5px',
                  marginBottom: '5px'
                }}>
                  {cyoaScenarios.map((scenario) => {
                    const isSelected = selectedCYOAScenario === scenario.id;
                    const isRecommended = RECOMMENDATION_MAP[gameState.lastSelectedScenarioId || ''] === scenario.id;
                    
                    return (
                      <div
                        key={scenario.id}
                        onClick={() => setSelectedCYOAScenario(scenario.id)}
                        className={`cyoa-card ${isSelected ? 'active' : ''}`}
                        style={{
                          cursor: 'pointer',
                          padding: '10px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? `2px solid ${scenario.color}` : '1px solid var(--border-glass)',
                          backgroundColor: isSelected ? `${scenario.color}0a` : 'rgba(255,255,255,0.01)',
                          boxShadow: isSelected ? `0 0 10px ${scenario.color}22` : 'none',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        {isRecommended && (
                          <span 
                            className="recommend-badge"
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '8px',
                              backgroundColor: 'var(--accent-green)',
                              color: '#111827',
                              fontSize: '0.55rem',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              zIndex: 1
                            }}
                          >
                            <Sparkles size={8} /> 💡 Recommended Flow Fix
                          </span>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            backgroundColor: `${scenario.color}15`, 
                            color: scenario.color 
                          }}>
                            {scenario.id === 'reset' && <RefreshCw size={12} />}
                            {scenario.id === 'wip_limits' && <Shield size={12} />}
                            {scenario.id === 'shift_left' && <Zap size={12} />}
                            {scenario.id === 'swarming' && <Users size={12} />}
                            {scenario.id === 'smaller_batches' && <Scissors size={12} />}
                            {scenario.id === 'tradeshow' && <Calendar size={12} />}
                            {scenario.id === 'security_breach' && <AlertTriangle size={12} />}
                            {scenario.id === 'os_upgrade' && <Monitor size={12} />}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2px', lineHeight: 1 }}>
                              {scenario.category}
                            </span>
                            <h4 style={{ fontSize: '0.7rem', fontWeight: 700, margin: 0, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {scenario.name}
                            </h4>
                          </div>
                        </div>
                        
                        <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.25 }}>
                          {scenario.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => onStartNextDay(selectedCYOAScenario)} 
                  className="btn btn-primary pulse-primary" 
                  style={{ width: '100%', padding: '12px', backgroundColor: 'var(--accent-green)', boxShadow: 'var(--shadow-neon-success)' }}
                >
                  🚀 Launch Next Week (Days {gameState.day + 1}-{gameState.day + 5})
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Weekend Settings: Select Flow Accelerators
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={wipLimitsActive} 
                      onChange={(e) => setWipLimitsActive(e.target.checked)} 
                    />
                    <div>
                      <strong>WIP Limits & Pairing</strong>
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0 }}>Analysis(2), Dev(2), Test(1). Enables dev pairing.</p>
                    </div>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={shiftLeftActive} 
                      onChange={(e) => setShiftLeftActive(e.target.checked)} 
                    />
                    <div>
                      <strong>Shift-Left Option B</strong>
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0 }}>Eliminates Testing column. Dev/Test dials concurrent in Dev.</p>
                    </div>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={swarmingActive} 
                      onChange={(e) => setSwarmingActive(e.target.checked)} 
                    />
                    <div>
                      <strong>Cross-Functional Swarming</strong>
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0 }}>Bypasses context switch penalty for dev following card.</p>
                    </div>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={smallerBatchesActive} 
                      onChange={(e) => setSmallerBatchesActive(e.target.checked)} 
                    />
                    <div>
                      <strong>Story Splitting & Smaller Batches</strong>
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0 }}>Halves backlog card effort. Splits Trade Show Epic.</p>
                    </div>
                  </label>
                </div>
                
                <button 
                  onClick={() => onStartNextDay({ wipLimitsActive, shiftLeftActive, swarmingActive, smallerBatchesActive })} 
                  className="btn btn-primary pulse-primary" 
                  style={{ width: '100%', padding: '12px', backgroundColor: 'var(--accent-green)', boxShadow: 'var(--shadow-neon-success)' }}
                >
                  🚀 Launch Next Week (Days {gameState.day + 1}-{gameState.day + 5})
                </button>
              </div>
            )
          )}


          {gameState.gamePhase === 'game_over' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600, marginBottom: '10px' }}>
                Simulation completed successfully!
              </p>
              {(!isMultiplayer || isAdmin) && (
                <button 
                  onClick={onRestartGame} 
                  className="btn btn-danger" 
                  style={{ width: '100%', padding: '12px' }}
                >
                  <RotateCcw size={16} /> Restart Simulation
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fast Forward Option (Admins / Local players during active weekdays) */}
      {onFastForward && gameState.day % 5 !== 0 && gameState.gamePhase !== 'week_summary' && gameState.gamePhase !== 'game_over' && (!isMultiplayer || isAdmin) && (
        <div className="glass-panel" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.02)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Class understands flow early?</span>
          <button
            onClick={onFastForward}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            Fast Forward ⏭️
          </button>
        </div>
      )}

      {/* Admin Custom Urgent Work Injector Form */}
      {onInjectCustomExpediteCards && (!isMultiplayer || isAdmin) && gameState.gamePhase !== 'intro' && gameState.gamePhase !== 'game_over' && (
        <div className="glass-panel" style={{ padding: '12px', borderLeft: '4px solid var(--accent-red)', borderRadius: 'var(--radius-sm)' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-red)', textTransform: 'uppercase', marginBottom: '6px' }}>
            🚨 Urgent Work Injector
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Card Title / Prefix</label>
              <input
                type="text"
                value={urgentTitle}
                onChange={(e) => setUrgentTitle(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={urgentCount}
                  onChange={(e) => setUrgentCount(parseInt(e.target.value) || 1)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '4px',
                    color: '#fff',
                    width: '100%'
                  }}
                />
              </div>
              <button
                onClick={() => onInjectCustomExpediteCards(urgentTitle, urgentCount)}
                className="btn btn-primary"
                style={{
                  fontSize: '0.7rem',
                  padding: '6px 10px',
                  backgroundColor: 'var(--accent-red)',
                  boxShadow: '0 0 10px rgba(244, 63, 94, 0.2)',
                  borderColor: 'rgba(244, 63, 94, 0.3)',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                Inject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructor Scenario Controller (Multiplayer & Admin Only) */}
      {isMultiplayer && isAdmin && onQueueEvent && (
        <div className="glass-panel" style={{ padding: '15px', borderLeft: '4px solid var(--secondary)' }}>
          <h3 style={{ fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 700 }}>
            Instructor Event Controller
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Queue an event to trigger tomorrow:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: null, label: 'None (Standard Day)' },
              { id: 'wip_limits', label: 'Adopt WIP Limits & Pairing' },
              { id: 'outage', label: 'Production Outage (Expedite)' },
              { id: 'tech_debt', label: 'Technical Debt Degradation' },
              { id: 'blocker', label: 'Block Random Development Card' }
            ].map(evt => {
              const isSelected = gameState.nextEventId === evt.id;
              return (
                <button
                  key={evt.id ?? 'none'}
                  onClick={() => onQueueEvent(evt.id)}
                  className="btn"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '0.7rem',
                    backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? 'var(--secondary)' : '#fff',
                    border: isSelected ? '1px solid var(--secondary)' : '1px solid var(--border-glass)',
                    borderRadius: '4px',
                    justifyContent: 'flex-start'
                  }}
                >
                  {isSelected ? '✓ ' : ''}{evt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Developer Capacity Status */}
      <div className="glass-panel" style={{ padding: '15px' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Developer Status
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gameState.avatars.map(avatar => {
            const isWorkedToday = avatar.workedOnCardIdsToday.length > 0;
            const hasSwitchPenalty = avatar.workedOnCardIdsToday.length > 0 && avatar.workedOnCardIdsToday.filter(id => id !== avatar.assignedCardId).length > 0;
            const isSick = avatar.currentRoll === 0;

            return (
              <div 
                key={avatar.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: isWorkedToday ? `1px dashed ${avatar.color}` : '1px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: avatar.color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {avatar.name[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>{avatar.name}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {isSick 
                        ? 'Absent today' 
                        : avatar.remainingCapacity > 0
                          ? `${avatar.remainingCapacity} pt${avatar.remainingCapacity !== 1 ? 's' : ''} available` 
                          : 'All capacity spent'
                      }
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hasSwitchPenalty && (
                    <span 
                      className="tooltip" 
                      style={{ 
                        color: 'var(--accent-amber)', 
                        fontSize: '0.65rem', 
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}
                    >
                      Penalty
                      <span className="tooltiptext">Context Switch Penalty applied today (-1 capacity)</span>
                    </span>
                  )}
                  
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: 700, 
                    color: isSick ? 'var(--accent-red)' : '#fff' 
                  }}>
                    {avatar.currentRoll === null ? '?' : `${avatar.remainingCapacity} / ${avatar.currentRoll} pts`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scenario / Daily Event Info */}
      {gameState.currentDayEvent && (
        <div className="glass-panel" style={{ padding: '15px', backgroundColor: 'rgba(6, 182, 212, 0.02)', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--secondary)' }}>
            <BookOpen size={14} />
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>
              Daily Bulletin
            </h3>
          </div>
          <h4 style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '4px' }}>
            {gameState.currentDayEvent.title}
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {gameState.currentDayEvent.description}
          </p>
        </div>
      )}

      {/* Event Logs Feed */}
      <div className="glass-panel" style={{ 
        flex: 1, 
        padding: '15px', 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '180px',
        maxHeight: '350px'
      }}>
        <h3 style={{ fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
          Simulation Logs
        </h3>
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          fontSize: '0.7rem', 
          fontFamily: 'monospace', 
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingRight: '5px'
        }}>
          {gameState.eventLogs.map((log, index) => {
            let color = 'var(--text-secondary)';
            if (log.startsWith('---')) color = 'var(--primary)';
            else if (log.includes('[Blocker]') || log.includes('[QA Failure]')) color = 'var(--accent-red)';
            else if (log.includes('[Success]') || log.includes('[Pairing Save]')) color = 'var(--accent-green)';
            else if (log.includes('spent') || log.includes('applied') || log.includes('switching')) color = 'var(--accent-amber)';

            return (
              <div key={index} style={{ color, paddingBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                {log}
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Utility Panel */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={onRestartGame} 
          className="btn btn-secondary" 
          style={{ padding: '4px 8px', fontSize: '0.7rem', opacity: 0.6 }}
        >
          <RotateCcw size={10} /> Reset Game
        </button>
      </div>

    </div>
  );
};
