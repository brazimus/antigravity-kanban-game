import React from 'react';
import type { Card as CardType, Column, Avatar } from '../types';
import { CardComponent } from './CardComponent';
import { ShieldAlert } from 'lucide-react';

interface BoardProps {
  columns: Column[];
  cards: CardType[];
  avatars: Avatar[];
  pairingAllowed: boolean;
  onAllocateCapacity: (avatarId: string, cardId: string, effortType?: 'analysis' | 'development' | 'testing') => void;
  onMoveCard: (cardId: string, targetColumnId: string) => { success: boolean; errorMessage: string } | Promise<{ success: boolean; errorMessage: string }>;
  gamePhase: string;
  onReplenishBacklog: () => void;
  currentPlayerId?: string | null;
  isAdmin?: boolean;
  onSplitEpic?: (epicId: string) => void;
  shiftLeftActive?: boolean;
  swarmingActive?: boolean;
}

export const Board: React.FC<BoardProps> = ({
  columns,
  cards,
  avatars,
  pairingAllowed,
  onAllocateCapacity,
  onMoveCard,
  gamePhase,
  onReplenishBacklog,
  currentPlayerId = null,
  isAdmin = false,
  onSplitEpic,
  shiftLeftActive = false,
  swarmingActive = false
}) => {
  const splitEpics = cards.filter(c => (c.isEpic || c.type === 'epic') && c.columnId === 'epic_pool');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {splitEpics.length > 0 && (
        <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-glass)' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>Active Epics & Story Splitting Progress</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            {splitEpics.map(epic => {
              const children = cards.filter(c => c.parentEpicId === epic.id);
              const completed = children.filter(c => c.columnId === 'done').length;
              const total = children.length;
              const progress = epic.epicProgress || 0;
              return (
                <div key={epic.id} style={{ minWidth: '240px', flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{epic.title}</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{completed}/{total} Stories Done ({progress}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="kanban-board-container" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(250px, 1fr))`,
        gap: '12px',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '5px 0',
        height: '100%',
        minHeight: 0,
        flex: 1
      }}>
        {columns.map(column => {
          const columnCards = cards.filter(c => c.columnId === column.id);
          const cardCount = columnCards.length;
          const isWipExceeded = column.wipLimit !== null && cardCount > column.wipLimit;

          return (
            <div 
              key={column.id} 
              className={`glass-panel column-panel ${isWipExceeded ? 'pulse-red' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                backgroundColor: isWipExceeded 
                  ? 'rgba(244, 63, 94, 0.03)' 
                  : 'var(--bg-glass-card)',
                border: isWipExceeded 
                  ? '1px solid rgba(244, 63, 94, 0.3)' 
                  : '1px solid var(--border-glass)',
                transition: 'all 0.3s ease',
                height: '100%',
                minHeight: 0
              }}
            >
              {/* Column Header */}
              <div style={{ 
                marginBottom: '12px', 
                borderBottom: '1px solid var(--border-glass)', 
                paddingBottom: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    color: isWipExceeded ? 'var(--accent-red)' : 'var(--text-primary)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase'
                  }}>
                    {column.name}
                  </h3>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    color: isWipExceeded ? 'var(--accent-red)' : 'var(--text-secondary)',
                    backgroundColor: isWipExceeded ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.05)',
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}>
                    {cardCount}{column.wipLimit !== null ? ` / ${column.wipLimit}` : ''}
                  </span>
                </div>
                
                {/* Manual Backlog Replenishment button */}
                {column.id === 'backlog' && gamePhase !== 'intro' && gamePhase !== 'game_over' && (!currentPlayerId || isAdmin) && (
                  <button
                    onClick={onReplenishBacklog}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      marginTop: '8px',
                      gap: '4px',
                      borderRadius: 'var(--radius-sm)',
                      justifyContent: 'center'
                    }}
                  >
                    + Replenish Backlog
                  </button>
                )}
                
                {/* WIP Limit Alert Banner */}
                {isWipExceeded && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    marginTop: '6px', 
                    color: 'var(--accent-red)' 
                  }}>
                    <ShieldAlert size={12} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>WIP LIMIT EXCEEDED!</span>
                  </div>
                )}
              </div>

              {/* Cards List */}
              <div 
                className="column-cards-container"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  gap: '2px',
                  paddingRight: '2px'
                }}
              >
                {columnCards.length === 0 ? (
                  <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    border: '2px dashed rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontStyle: 'italic',
                    minHeight: '80px',
                    textAlign: 'center',
                    padding: '10px'
                  }}>
                    Empty column. Pull cards here.
                  </div>
                ) : (
                  columnCards.map(card => (
                    <CardComponent 
                      key={card.id}
                      card={card}
                      avatars={avatars}
                      columns={columns}
                      pairingAllowed={pairingAllowed}
                      onAllocateCapacity={onAllocateCapacity}
                      onMoveCard={onMoveCard}
                      gamePhase={gamePhase}
                      currentPlayerId={currentPlayerId}
                      isAdmin={isAdmin}
                      onSplitEpic={onSplitEpic}
                      shiftLeftActive={shiftLeftActive}
                      swarmingActive={swarmingActive}
                    />
                  ))
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
