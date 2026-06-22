import React, { useState } from 'react';
import type { Card as CardType, Avatar, Column } from '../types';
import { AlertOctagon, UserPlus } from 'lucide-react';

interface CardComponentProps {
  card: CardType;
  avatars: Avatar[];
  columns: Column[];
  pairingAllowed: boolean;
  onAssignAvatar: (avatarId: string, cardId: string | null) => void;
  onMoveCard: (cardId: string, targetColumnId: string) => { success: boolean; errorMessage: string };
  gamePhase: string;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  avatars,
  columns,
  pairingAllowed,
  onAssignAvatar,
  onMoveCard,
  gamePhase
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const currentColumn = columns.find(col => col.id === card.columnId);
  const activeEffortTypes = currentColumn?.allowedEffortTypes || [];

  // Find which avatars are assigned to this card
  const assignedAvatars = avatars.filter(a => card.assignedAvatars.includes(a.id));
  const unassignedAvatars = avatars.filter(a => !card.assignedAvatars.includes(a.id) && a.currentRoll !== 0);

  // Check if we have active effort on the card for the current column
  const activeEffortDetail = activeEffortTypes.map(type => {
    const total = card.effort[type] || 0;
    const remaining = card.remainingEffort[type] || 0;
    if (total === 0) return null;
    return { type, remaining, total, done: total - remaining };
  }).filter(Boolean)[0]; // get the first active effort detail

  const isEffortComplete = activeEffortDetail ? activeEffortDetail.remaining === 0 : true;

  // Find next column options
  const columnOrder = columns.map(c => c.id);
  const currentColumnIndex = columnOrder.indexOf(card.columnId);
  const nextColumnId = currentColumnIndex < columns.length - 1 ? columns[currentColumnIndex + 1].id : null;
  const prevColumnId = currentColumnIndex > 0 ? columns[currentColumnIndex - 1].id : null;

  // Toggle avatar assignment
  const handleAvatarClick = (avatarId: string, isAssigned: boolean) => {
    if (gamePhase !== 'dice_rolled') return; // Can only assign when dice are rolled but work not processed
    if (isAssigned) {
      onAssignAvatar(avatarId, null);
    } else {
      onAssignAvatar(avatarId, card.id);
      setShowAddMenu(false);
    }
  };

  const handleMove = (targetColumnId: string) => {
    const res = onMoveCard(card.id, targetColumnId);
    if (!res.success) {
      alert(res.errorMessage);
    }
  };

  // Border glow based on card type and blocker status
  let cardClass = "glass-panel kanban-card";
  if (card.isBlocked) cardClass += " card-blocked pulse-red";
  else if (card.type === 'expedite') cardClass += " card-expedite pulse-primary";

  return (
    <div className={cardClass} style={{
      padding: '12px',
      marginBottom: '10px',
      position: 'relative',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: card.isBlocked 
        ? 'rgba(244, 63, 94, 0.08)' 
        : card.type === 'expedite' 
          ? 'rgba(139, 92, 246, 0.08)' 
          : 'var(--bg-glass-card)',
      borderLeft: card.isBlocked 
        ? '4px solid var(--accent-red)' 
        : card.type === 'expedite' 
          ? '4px solid var(--primary)' 
          : '4px solid var(--secondary)',
    }}>
      
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <h4 style={{ 
          fontSize: '0.85rem', 
          fontWeight: 600, 
          color: card.isBlocked ? 'var(--accent-red)' : '#fff',
          textDecoration: card.columnId === 'done' ? 'line-through' : 'none',
          maxWidth: '80%',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {card.title}
        </h4>
        
        {/* Expedite Badge */}
        {card.type === 'expedite' && (
          <span style={{ 
            fontSize: '0.65rem', 
            backgroundColor: 'var(--primary)', 
            color: '#fff', 
            padding: '2px 4px', 
            borderRadius: '3px',
            fontWeight: 700
          }}>
            EXPEDITE
          </span>
        )}
      </div>

      {/* Description */}
      <p style={{ 
        fontSize: '0.75rem', 
        color: 'var(--text-secondary)', 
        marginBottom: '10px',
        lineHeight: 1.3
      }}>
        {card.description}
      </p>

      {/* Blocker Reason */}
      {card.isBlocked && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          backgroundColor: 'rgba(244, 63, 94, 0.15)', 
          padding: '6px', 
          borderRadius: '4px', 
          marginBottom: '10px',
          border: '1px solid rgba(244, 63, 94, 0.3)'
        }}>
          <AlertOctagon size={12} color="var(--accent-red)" />
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)', fontWeight: 500 }}>
            {card.blockerReason || 'Blocked! Need 4+ roll to resolve.'}
          </span>
        </div>
      )}

      {/* Effort Progress Bar */}
      {activeEffortDetail && card.columnId !== 'done' && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
            <span style={{ textTransform: 'capitalize' }}>{activeEffortDetail.type} Effort</span>
            <span>{activeEffortDetail.done} / {activeEffortDetail.total} pts</span>
          </div>
          <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${(activeEffortDetail.done / activeEffortDetail.total) * 100}%`,
              backgroundColor: card.isBlocked ? 'var(--text-muted)' : 'var(--secondary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Completed Stages Summary (If not in active column) */}
      {card.columnId === 'ready' && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Required: Analysis ({card.effort.analysis}), Dev ({card.effort.development}), Test ({card.effort.testing})
        </div>
      )}

      {/* Actions and Assignments */}
      {card.columnId !== 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Developer Slots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Assigned:</span>
            
            {/* Assigned Avatars */}
            {assignedAvatars.map(avatar => {
              // Check context penalty for visual tooltips
              const hasSwitch = avatar.previousCardId !== null && avatar.previousCardId !== card.id;
              const titleText = `${avatar.name} (Capacity: ${avatar.currentRoll || 0})${hasSwitch ? ' - Context Switch Penalty active!' : ''}`;
              
              return (
                <div 
                  key={avatar.id}
                  onClick={() => handleAvatarClick(avatar.id, true)}
                  className="tooltip"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: avatar.color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: gamePhase === 'dice_rolled' ? 'pointer' : 'default',
                    border: hasSwitch ? '2px dashed var(--accent-amber)' : '2px solid transparent',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    position: 'relative'
                  }}
                >
                  {avatar.name[0]}
                  {hasSwitch && (
                    <div style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-amber)'
                    }} />
                  )}
                  <span className="tooltiptext">{titleText}</span>
                </div>
              );
            })}

            {/* Unassigned Avatars Quick Add (Only shown when dice are rolled and slots available) */}
            {gamePhase === 'dice_rolled' && (card.assignedAvatars.length < (pairingAllowed ? 2 : 1)) && unassignedAvatars.length > 0 && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button 
                  className="btn-add-avatar"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '1px dashed var(--border-glass-focused)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  <UserPlus size={10} />
                </button>
                {/* Popover overlay for adding avatar */}
                {showAddMenu && (
                  <div className="avatar-dropdown" style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '0',
                    backgroundColor: 'hsl(223, 47%, 11%)',
                    border: '1px solid var(--border-glass-focused)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '5px',
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    minWidth: '100px'
                  }}>
                    {unassignedAvatars.map(avatar => {
                      const hasSwitch = avatar.previousCardId !== null && avatar.previousCardId !== card.id;
                      return (
                        <button
                          key={avatar.id}
                          onClick={() => handleAvatarClick(avatar.id, false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            textAlign: 'left',
                            padding: '4px 8px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: avatar.color }} />
                          {avatar.name} ({avatar.currentRoll || 0})
                          {hasSwitch && <span style={{ color: 'var(--accent-amber)', fontSize: '0.6rem' }}>*</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* No Capacity note */}
            {gamePhase === 'dice_rolled' && unassignedAvatars.length === 0 && card.assignedAvatars.length === 0 && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active developers available</span>
            )}
          </div>

          {/* Movement Buttons (Since drag-and-drop is cooler but buttons are 100% reliable) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', marginTop: '4px' }}>
            {prevColumnId && (
              <button 
                onClick={() => handleMove(prevColumnId)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '2px 4px', fontSize: '0.65rem', borderRadius: '3px' }}
              >
                ← Pull Back
              </button>
            )}
            
            {/* Pull Forward (Highlight if effort completed) */}
            {nextColumnId && (
              <button 
                onClick={() => handleMove(nextColumnId)}
                className="btn"
                style={{ 
                  flex: 2, 
                  padding: '2px 4px', 
                  fontSize: '0.65rem', 
                  borderRadius: '3px',
                  backgroundColor: isEffortComplete ? 'var(--accent-green)' : 'rgba(255,255,255,0.05)',
                  color: isEffortComplete ? '#fff' : 'var(--text-secondary)',
                  border: isEffortComplete ? 'none' : '1px solid var(--border-glass)',
                  fontWeight: isEffortComplete ? 700 : 500,
                  boxShadow: isEffortComplete ? '0 0 10px var(--accent-green-glow)' : 'none'
                }}
              >
                {isEffortComplete ? 'Ready to Pull →' : 'Progressing...'}
              </button>
            )}
          </div>

        </div>
      )}

      {/* Done State Details */}
      {card.columnId === 'done' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          <span>Lead Time: {(card.completedAt || 0) - card.createdAt} days</span>
          {card.startedAt && <span>Cycle: {(card.completedAt || 0) - card.startedAt} days</span>}
        </div>
      )}

    </div>
  );
};
