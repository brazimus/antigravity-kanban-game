import React, { useRef, useEffect } from 'react';
import type { GameState } from '../types';
import { Dices, RotateCcw, ArrowRight, CheckSquare, BookOpen } from 'lucide-react';

interface ControlsProps {
  gameState: GameState;
  onRollDice: () => void;
  onEndDay: () => void;
  onStartNextDay: () => void;
  onRestartGame: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  gameState,
  onRollDice,
  onEndDay,
  onStartNextDay,
  onRestartGame,
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.eventLogs]);

  // Check how many devs are assigned
  const assignedDevs = gameState.avatars.filter(a => a.assignedCardId !== null && a.currentRoll !== 0);
  const totalActiveDevs = gameState.avatars.filter(a => a.currentRoll !== 0); // Not sick/inactive
  const allAssigned = assignedDevs.length === totalActiveDevs.length;

  return (
    <div className="controls-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      height: '100%',
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
            <button 
              onClick={onRollDice} 
              className="btn btn-primary pulse-primary" 
              style={{ width: '100%', padding: '12px' }}
            >
              <Dices size={16} /> Roll Capacity Dice
            </button>
          )}

          {gameState.gamePhase === 'dice_rolled' && (
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                {!allAssigned 
                  ? `Assign developers on the board. (${assignedDevs.length}/${totalActiveDevs.length} assigned)` 
                  : 'All developers assigned! Ready to run the day.'
                }
              </p>
              <button 
                onClick={onEndDay} 
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  padding: '12px',
                  backgroundColor: allAssigned ? 'var(--accent-green)' : 'var(--primary)',
                  boxShadow: allAssigned ? 'var(--shadow-neon-success)' : 'var(--shadow-neon-primary)'
                }}
              >
                <CheckSquare size={16} /> Run Day {gameState.day} Work &rarr;
              </button>
            </div>
          )}

          {gameState.gamePhase === 'day_summary' && (
            <button 
              onClick={onStartNextDay} 
              className="btn btn-primary pulse-primary" 
              style={{ width: '100%', padding: '12px', backgroundColor: 'var(--secondary)', boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
            >
              <ArrowRight size={16} /> Start Day {gameState.day + 1}
            </button>
          )}

          {gameState.gamePhase === 'game_over' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600, marginBottom: '10px' }}>
                Simulation completed successfully!
              </p>
              <button 
                onClick={onRestartGame} 
                className="btn btn-danger" 
                style={{ width: '100%', padding: '12px' }}
              >
                <RotateCcw size={16} /> Restart Simulation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Developer Capacity Status */}
      <div className="glass-panel" style={{ padding: '15px' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Developer Status
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gameState.avatars.map(avatar => {
            const isAssigned = avatar.assignedCardId !== null;
            const hasSwitchPenalty = avatar.previousCardId !== null && avatar.assignedCardId !== null && avatar.previousCardId !== avatar.assignedCardId;
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
                  border: isAssigned ? `1px dashed ${avatar.color}` : '1px solid transparent'
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
                        : isAssigned 
                          ? 'Assigned to task' 
                          : 'Idle (Unassigned)'
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
                      <span className="tooltiptext">Context Switch Penalty: -1 capacity today</span>
                    </span>
                  )}
                  
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: 700, 
                    color: isSick ? 'var(--accent-red)' : '#fff' 
                  }}>
                    {avatar.currentRoll === null ? '?' : `${avatar.currentRoll} pts`}
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
            else if (log.includes('switched to') || log.includes('Penalty')) color = 'var(--accent-amber)';

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
