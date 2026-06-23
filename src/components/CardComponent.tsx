import React, { useState } from 'react';
import type { Card as CardType, Avatar, Column } from '../types';
import { AlertOctagon, UserPlus, ShieldAlert } from 'lucide-react';

interface CardComponentProps {
  card: CardType;
  avatars: Avatar[];
  columns: Column[];
  pairingAllowed: boolean;
  onAllocateCapacity: (avatarId: string, cardId: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string) => { success: boolean; errorMessage: string } | Promise<{ success: boolean; errorMessage: string }>;
  gamePhase: string;
  currentPlayerId?: string | null;
  isAdmin?: boolean;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  avatars,
  columns,
  pairingAllowed,
  onAllocateCapacity,
  onMoveCard,
  gamePhase,
  currentPlayerId = null,
  isAdmin = false
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const currentColumn = columns.find(col => col.id === card.columnId);
  const activeEffortTypes = currentColumn?.allowedEffortTypes || [];

  // Find which avatars are assigned to this card today
  const assignedAvatars = avatars.filter(a => card.assignedAvatars.includes(a.id));
  
  // Find devs who still have capacity to work
  const availableDevs = avatars.filter(a => {
    // If in multiplayer player mode, a student can only assign themselves!
    if (currentPlayerId && !isAdmin && a.id !== currentPlayerId) return false;

    // Check if they have capacity remaining today
    if (a.remainingCapacity <= 0) return false;

    // Check context switch cost
    const workedOnOthers = a.workedOnCardIdsToday.filter(id => id !== card.id);
    const isSwitch = workedOnOthers.length > 0 || (a.workedOnCardIdsToday.length === 0 && a.previousCardId !== null && a.previousCardId !== card.id);
    const penalty = isSwitch ? 1 : 0;

    const netCapacity = a.remainingCapacity - penalty;

    // If blocked, needs at least 2 capacity points. If not blocked, needs at least 1 (or 2 if helper)
    if (card.isBlocked) return netCapacity >= 2;
    
    const isHelper = card.assignedAvatars.length > 0 && !card.assignedAvatars.includes(a.id);
    if (isHelper) {
      // Helper needs at least 2 capacity points to generate 1 progress point
      return netCapacity >= 2 && pairingAllowed;
    }
    return netCapacity >= 1;
  });

  // Check if we have active effort on the card for the current column
  const activeEffortDetail = activeEffortTypes.map(type => {
    const total = card.effort[type] || 0;
    const remaining = card.remainingEffort[type] || 0;
    if (total === 0) return null;
    return { type, remaining, total, done: total - remaining };
  }).filter(Boolean)[0];

  const isEffortComplete = activeEffortDetail ? activeEffortDetail.remaining === 0 : true;

  // Find next column options
  const columnOrder = columns.map(c => c.id);
  const currentColumnIndex = columnOrder.indexOf(card.columnId);
  const nextColumnId = currentColumnIndex < columns.length - 1 ? columns[currentColumnIndex + 1].id : null;
  const prevColumnId = currentColumnIndex > 0 ? columns[currentColumnIndex - 1].id : null;

  const handleAllocate = (avatarId: string) => {
    onAllocateCapacity(avatarId, card.id);
    setShowAddMenu(false);
  };

  const handleMove = async (targetColumnId: string) => {
    const res = await onMoveCard(card.id, targetColumnId);
    if (!res.success) {
      alert(res.errorMessage);
    }
  };

  // Render Option B Segmented Radial Dial
  const renderRadialDial = () => {
    if (!activeEffortDetail || card.columnId === 'done') return null;

    const { total, done } = activeEffortDetail;
    const radius = 18;
    const cx = 22;
    const cy = 22;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius;
    const segmentAngle = 360 / total;
    
    // Calculate size of arc segment (e.g. total length / segments - 1.5px gap spacing)
    const gapSpacing = 2; // pixels
    const dashArray = `${(circumference / total) - gapSpacing} 100`;

    const segments = [];
    for (let i = 0; i < total; i++) {
      const rotation = i * segmentAngle - 90; // Start segments at 12 o'clock
      const isCompleted = i < done;
      let strokeColor = 'rgba(255, 255, 255, 0.08)'; // Default empty

      if (isCompleted) {
        if (card.isBlocked) strokeColor = 'var(--text-muted)';
        else if (card.type === 'expedite') strokeColor = 'var(--primary)';
        else strokeColor = 'var(--accent-green)';
      }

      segments.push(
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{
            transition: 'stroke 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: isCompleted && !card.isBlocked 
              ? `drop-shadow(0 0 3px ${card.type === 'expedite' ? 'var(--primary-glow)' : 'var(--accent-green-glow)'})` 
              : 'none'
          }}
        />
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 12px 0' }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(0deg)' }}>
          {segments}
        </svg>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', color: '#fff' }}>
            {activeEffortDetail.type} Phase
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            Remaining Effort: <strong style={{ color: card.isBlocked ? 'var(--accent-red)' : 'var(--secondary)' }}>{activeEffortDetail.remaining}</strong> of {total} pts
          </div>
        </div>
      </div>
    );
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
            {card.blockerReason || 'Blocked! Spend 2 capacity to roll unblock.'}
          </span>
        </div>
      )}

      {/* Option B: Segmented Circular Radial Chart */}
      {renderRadialDial()}

      {/* Required summary for Ready column */}
      {card.columnId === 'ready' && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Effort needed: Analysis ({card.effort.analysis}), Dev ({card.effort.development}), Test ({card.effort.testing})
        </div>
      )}

      {/* Actions and Capacity Assignments */}
      {card.columnId !== 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Active Assigned Devs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Assigned:</span>
            
            {assignedAvatars.map(avatar => {
              // Find out if they switched tasks today
              const hasSwitch = avatar.workedOnCardIdsToday.includes(card.id) && avatar.workedOnCardIdsToday.filter(id => id !== card.id).length > 0;
              const hasSwitchFromYesterday = avatar.workedOnCardIdsToday.includes(card.id) && avatar.workedOnCardIdsToday.length === 1 && avatar.previousCardId !== null && avatar.previousCardId !== card.id;
              
              const titleText = `${avatar.name} worked here today.${hasSwitch || hasSwitchFromYesterday ? ' Sufferred context switch penalty (-1 pt).' : ''}`;
              
              return (
                <div 
                  key={avatar.id}
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
                    border: (hasSwitch || hasSwitchFromYesterday) ? '2px dashed var(--accent-amber)' : '2px solid transparent',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    position: 'relative'
                  }}
                >
                  {avatar.name[0]}
                  {(hasSwitch || hasSwitchFromYesterday) && (
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

            {/* Quick Allocate Capacity Button */}
            {gamePhase === 'dice_rolled' && (!isEffortComplete || card.isBlocked) && availableDevs.length > 0 && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button 
                  className="btn-add-avatar"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-glass-focused)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.65rem',
                    gap: '4px'
                  }}
                >
                  <UserPlus size={10} />
                  <span>Allocate</span>
                </button>
                
                {/* Popover overlay for allocating capacity */}
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
                    minWidth: '130px'
                  }}>
                    {availableDevs.map(avatar => {
                      const workedOnOthers = avatar.workedOnCardIdsToday.filter(id => id !== card.id);
                      const isSwitch = workedOnOthers.length > 0 || (avatar.workedOnCardIdsToday.length === 0 && avatar.previousCardId !== null && avatar.previousCardId !== card.id);
                      const isHelper = card.assignedAvatars.length > 0 && !card.assignedAvatars.includes(avatar.id);
                      const title = isHelper ? 'Helper (50% progress rate)' : 'Lead dev (100% rate)';

                      return (
                        <button
                          key={avatar.id}
                          onClick={() => handleAllocate(avatar.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            textAlign: 'left',
                            padding: '4px 8px',
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                            borderRadius: '3px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: avatar.color }} />
                            {avatar.name}
                          </div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', marginLeft: '14px' }}>
                            Avail: {avatar.remainingCapacity} pt{avatar.remainingCapacity !== 1 ? 's' : ''} {isSwitch ? '(-1 penalty)' : ''}
                          </div>
                          <div style={{ fontSize: '0.55rem', color: isHelper ? 'var(--secondary)' : 'var(--accent-green)', marginLeft: '14px', fontStyle: 'italic' }}>
                            {title}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* No available capacity warning */}
            {gamePhase === 'dice_rolled' && (!isEffortComplete || card.isBlocked) && availableDevs.length === 0 && card.assignedAvatars.length === 0 && (
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <ShieldAlert size={10} /> No capacity or switch limits reached
              </span>
            )}
          </div>

          {/* Movement Actions */}
          {(!currentPlayerId || isAdmin) && (
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
          )}

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
