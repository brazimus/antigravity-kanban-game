import React from 'react';
import type { Card as CardType, Column, Avatar } from '../types';
import { CardComponent } from './CardComponent';
import { ShieldAlert } from 'lucide-react';

interface BoardProps {
  columns: Column[];
  cards: CardType[];
  avatars: Avatar[];
  pairingAllowed: boolean;
  onAllocateCapacity: (avatarId: string, cardId: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string) => { success: boolean; errorMessage: string };
  gamePhase: string;
  onReplenishBacklog: () => void;
}

export const Board: React.FC<BoardProps> = ({
  columns,
  cards,
  avatars,
  pairingAllowed,
  onAllocateCapacity,
  onMoveCard,
  gamePhase,
  onReplenishBacklog
}) => {
  return (
    <div className="kanban-board-container" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns.length}, minmax(250px, 1fr))`,
      gap: '12px',
      overflowX: 'auto',
      overflowY: 'hidden',
      padding: '5px 0',
      height: '100%',
      minHeight: 0
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
              {column.id === 'backlog' && gamePhase !== 'intro' && gamePhase !== 'game_over' && (
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
                  />
                ))
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};
