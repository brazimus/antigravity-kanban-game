import { useState, useCallback, useEffect } from 'react';
import type { GameState, Card, DailyLog, ScenarioDayEvent } from './types';
import { easyModeScenario, defaultColumns, defaultAvatars } from './scenarios';

const LOCAL_STORAGE_KEY = 'antigravity_kanban_game_state';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Basic validation to ensure it has day
        if (parsed && typeof parsed.day === 'number') {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }

    // Default initial state
    return {
      day: 1,
      maxDays: 10,
      cards: [],
      columns: defaultColumns,
      avatars: defaultAvatars,
      dailyLogs: [],
      activeScenarioId: 'easy_mode',
      pairingAllowed: false,
      gamePhase: 'intro',
      rolledToday: false,
      currentDayEvent: null,
      eventLogs: ['Game initialized. Click Start to begin your Kanban journey!'],
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Restart/Initialize Game
  const startGame = useCallback(() => {
    const scenario = easyModeScenario;
    const initialEvent = scenario.events[1];
    
    // Create initial cards from scenario
    const initialCards: Card[] = (initialEvent.newCards || []).map((c, index) => ({
      ...c,
      id: `card_${generateId()}_${index}`,
      remainingEffort: { ...c.effort },
      assignedAvatars: [],
      isBlocked: false,
      failedQACount: 0,
      createdAt: 1,
      completedAt: null,
      startedAt: c.columnId !== 'backlog' && c.columnId !== 'ready' ? 1 : null,
      history: [{ day: 1, columnId: c.columnId }],
    }));

    // Reset avatars
    const resetAvatars = defaultAvatars.map(a => ({
      ...a,
      currentRoll: null,
      assignedCardId: null,
      previousCardId: null,
      spentCapacity: 0,
    }));

    const welcomeLog = [
      `--- Day 1 Start ---`,
      `Event: ${initialEvent.title}`,
      initialEvent.description,
    ];

    setGameState({
      day: 1,
      maxDays: scenario.totalDays,
      cards: initialCards,
      columns: defaultColumns.map(col => {
        // Apply initial WIP limits from scenario if defined
        if (initialEvent.wipLimits && col.id in initialEvent.wipLimits) {
          return { ...col, wipLimit: initialEvent.wipLimits[col.id] };
        }
        return { ...col, wipLimit: null };
      }),
      avatars: resetAvatars,
      dailyLogs: [],
      activeScenarioId: 'easy_mode',
      pairingAllowed: initialEvent.pairingAllowed || false,
      gamePhase: 'day_start',
      rolledToday: false,
      currentDayEvent: initialEvent,
      eventLogs: welcomeLog,
    });
  }, []);

  // Roll Dice for Day
  const rollDice = useCallback(() => {
    if (gameState.rolledToday || gameState.gamePhase !== 'day_start') return;

    setGameState(prev => {
      const logs: string[] = [...prev.eventLogs, `--- Rolling capacity dice for Day ${prev.day} ---`];
      
      const updatedAvatars = prev.avatars.map(avatar => {
        // Roll standard d6
        const rawRoll = Math.floor(Math.random() * 6) + 1;
        let rollModifier = 0;
        let inactive = false;

        // Apply capacity changes from current scenario day event
        if (prev.currentDayEvent?.capacityChange) {
          const capChange = prev.currentDayEvent.capacityChange.find(c => c.avatarId === avatar.id);
          if (capChange) {
            if (capChange.inactive) {
              inactive = true;
            }
            if (capChange.rollModifier) {
              rollModifier = capChange.rollModifier;
            }
            logs.push(`Event effect on ${avatar.name}: ${capChange.description}`);
          }
        }

        if (inactive) {
          logs.push(`${avatar.name} is inactive today (Capacity: 0).`);
          return {
            ...avatar,
            currentRoll: 0,
            spentCapacity: 0,
            assignedCardId: null,
          };
        }

        const finalRoll = Math.max(1, rawRoll + rollModifier);
        logs.push(`${avatar.name} rolled a ${rawRoll}${rollModifier !== 0 ? ` (modifier: ${rollModifier > 0 ? '+' : ''}${rollModifier})` : ''} -> Capacity: ${finalRoll}`);
        
        return {
          ...avatar,
          currentRoll: finalRoll,
          spentCapacity: 0,
          assignedCardId: null, // Reset daily assignment to force new decisions
        };
      });

      // Clear card assignments
      const updatedCards = prev.cards.map(c => ({
        ...c,
        assignedAvatars: [],
      }));

      return {
        ...prev,
        avatars: updatedAvatars,
        cards: updatedCards,
        rolledToday: true,
        gamePhase: 'dice_rolled',
        eventLogs: logs,
      };
    });
  }, [gameState.rolledToday, gameState.gamePhase]);

  // Assign Avatar to Card
  const assignAvatar = useCallback((avatarId: string, cardId: string | null) => {
    setGameState(prev => {
      const logs = [...prev.eventLogs];
      const avatar = prev.avatars.find(a => a.id === avatarId);
      if (!avatar) return prev;

      const previousAssignment = avatar.assignedCardId;
      if (previousAssignment === cardId) return prev;

      // Handle unassignment
      let updatedCards = prev.cards.map(card => {
        // Remove from old card
        if (previousAssignment && card.id === previousAssignment) {
          return {
            ...card,
            assignedAvatars: card.assignedAvatars.filter(id => id !== avatarId),
          };
        }
        return card;
      });

      // Handle new assignment
      if (cardId) {
        const targetCard = updatedCards.find(c => c.id === cardId);
        if (!targetCard) return prev;

        // Check if pairing is allowed
        if (!prev.pairingAllowed && targetCard.assignedAvatars.length >= 1) {
          logs.push(`[Warning] Pairing is disabled in this stage. Cannot assign ${avatar.name} to "${targetCard.title}".`);
          return prev;
        }

        // Limit to max 2 avatars per card
        if (targetCard.assignedAvatars.length >= 2) {
          logs.push(`[Warning] Maximum 2 developers can work on "${targetCard.title}" simultaneously.`);
          return prev;
        }

        updatedCards = updatedCards.map(card => {
          if (card.id === cardId) {
            return {
              ...card,
              assignedAvatars: [...card.assignedAvatars, avatarId],
            };
          }
          return card;
        });

        // Context switching penalty log check
        if (avatar.previousCardId && avatar.previousCardId !== cardId) {
          logs.push(`${avatar.name} switched to "${targetCard.title}" (Context Switching Penalty: -1 capacity).`);
        } else {
          logs.push(`${avatar.name} assigned to "${targetCard.title}".`);
        }
      } else {
        logs.push(`${avatar.name} unassigned.`);
      }

      const updatedAvatars = prev.avatars.map(a => {
        if (a.id === avatarId) {
          return { ...a, assignedCardId: cardId };
        }
        return a;
      });

      return {
        ...prev,
        avatars: updatedAvatars,
        cards: updatedCards,
        eventLogs: logs,
      };
    });
  }, []);

  // Move Card
  const moveCard = useCallback((cardId: string, targetColumnId: string) => {
    let success = true;
    let errorMessage = '';

    setGameState(prev => {
      const logs = [...prev.eventLogs];
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const sourceColumn = card.columnId;
      if (sourceColumn === targetColumnId) return prev;

      // WIP Limit Enforcement (Week 2 onwards / Active limits)
      const targetColumn = prev.columns.find(col => col.id === targetColumnId);
      if (targetColumn && targetColumn.wipLimit !== null) {
        const currentWIP = prev.cards.filter(c => c.columnId === targetColumnId).length;
        // Expedited cards can bypass WIP limits
        if (currentWIP >= targetColumn.wipLimit && card.type !== 'expedite') {
          success = false;
          errorMessage = `WIP limit reached! Column "${targetColumn.name}" has a limit of ${targetColumn.wipLimit}.`;
          return prev;
        }
      }

      // Blocked card check (Cannot drag blocked cards forward)
      const columnOrder = prev.columns.map(c => c.id);
      const sourceIndex = columnOrder.indexOf(sourceColumn);
      const targetIndex = columnOrder.indexOf(targetColumnId);
      
      if (card.isBlocked && targetIndex > sourceIndex) {
        success = false;
        errorMessage = `Cannot move "${card.title}" forward while it is blocked. You must resolve the blocker first.`;
        return prev;
      }

      // Effort requirement check
      // Player cannot move card forward if effort remains in the source column's required stage
      const sourceColObj = prev.columns.find(col => col.id === sourceColumn);
      if (sourceColObj && targetIndex > sourceIndex) {
        const requiredEfforts = sourceColObj.allowedEffortTypes;
        const unfinishedEffort = requiredEfforts.some(effortType => card.remainingEffort[effortType] > 0);
        if (unfinishedEffort) {
          success = false;
          errorMessage = `Cannot move "${card.title}" forward. Effort is still required in the "${sourceColObj.name}" column.`;
          return prev;
        }
      }

      // Move is valid
      logs.push(`Moved "${card.title}" from ${sourceColumn.toUpperCase()} to ${targetColumnId.toUpperCase()}.`);

      const updatedCards = prev.cards.map(c => {
        if (c.id === cardId) {
          const startedAt = (c.startedAt === null && targetColumnId !== 'backlog' && targetColumnId !== 'ready' && targetColumnId !== 'done') 
            ? prev.day 
            : c.startedAt;
          
          const completedAt = (targetColumnId === 'done') ? prev.day : c.completedAt;

          return {
            ...c,
            columnId: targetColumnId,
            startedAt,
            completedAt,
            // Clear assignments when moved
            assignedAvatars: [],
            history: [...c.history, { day: prev.day, columnId: targetColumnId }],
          };
        }
        return c;
      });

      // Clear avatar assignments to this card
      const updatedAvatars = prev.avatars.map(a => {
        if (a.assignedCardId === cardId) {
          return { ...a, assignedCardId: null };
        }
        return a;
      });

      return {
        ...prev,
        cards: updatedCards,
        avatars: updatedAvatars,
        eventLogs: logs,
      };
    });

    return { success, errorMessage };
  }, []);

  // End Day & Process Work
  const endDay = useCallback(() => {
    setGameState(prev => {
      const logs = [...prev.eventLogs, `--- End of Day ${prev.day} processing ---`];
      
      // 1. Process effort allocation
      let updatedCards = [...prev.cards];
      const updatedAvatars = prev.avatars.map(avatar => {
        const assignedCardId = avatar.assignedCardId;
        if (!assignedCardId) return avatar;

        const cardIndex = updatedCards.findIndex(c => c.id === assignedCardId);
        if (cardIndex === -1) return avatar;

        const card = updatedCards[cardIndex];
        const rawRoll = avatar.currentRoll || 0;
        
        // Calculate penalty for context switching
        const hasSwitched = avatar.previousCardId !== null && avatar.previousCardId !== assignedCardId;
        const penalty = hasSwitched ? 1 : 0;
        const capacity = Math.max(1, rawRoll - penalty);

        // Figure out if avatar is primary or helper (pairing)
        const avatarAssignedOrder = card.assignedAvatars.indexOf(avatar.id);
        const isHelper = avatarAssignedOrder > 0; // index 0 is Lead, 1 is Helper

        const capacitySpent = isHelper ? Math.max(1, Math.floor(capacity / 2)) : capacity;
        
        // Apply progress
        if (card.isBlocked) {
          logs.push(`${avatar.name} dedicated capacity to unblocking "${card.title}".`);
        } else {
          // Normal progress
          const currentColumn = prev.columns.find(col => col.id === card.columnId);
          const allowedEfforts = currentColumn ? currentColumn.allowedEffortTypes : [];
          
          let pointsToApply = capacitySpent;
          const newRemainingEffort = { ...card.remainingEffort };

          for (const effortType of allowedEfforts) {
            const remaining = newRemainingEffort[effortType];
            if (remaining > 0) {
              const applied = Math.min(pointsToApply, remaining);
              newRemainingEffort[effortType] = remaining - applied;
              pointsToApply -= applied;
              logs.push(`${avatar.name} applied ${applied} points of ${effortType} effort to "${card.title}" (Remaining: ${newRemainingEffort[effortType]}).`);
              if (pointsToApply <= 0) break;
            }
          }

          updatedCards[cardIndex] = {
            ...card,
            remainingEffort: newRemainingEffort,
          };
        }

        return {
          ...avatar,
          spentCapacity: capacitySpent,
          previousCardId: assignedCardId, // Set for tomorrow's context check
        };
      });

      // 2. Roll blocker resolution / Blocker checks at Card level
      updatedCards = updatedCards.map(card => {
        if (card.assignedAvatars.length === 0) return card;

        const isPaired = card.assignedAvatars.length > 1;

        if (card.isBlocked) {
          // Roll for unblocking: 4+ on d6. If paired, roll with advantage (two dice, take highest)
          const roll1 = Math.floor(Math.random() * 6) + 1;
          const roll2 = isPaired ? Math.floor(Math.random() * 6) + 1 : 0;
          const maxRoll = Math.max(roll1, roll2);

          logs.push(`Unblocking roll for "${card.title}": ${roll1}${isPaired ? ` and helper rolled ${roll2}` : ''} (Highest: ${maxRoll})`);

          if (maxRoll >= 4) {
            logs.push(`[Success] "${card.title}" is now UNBLOCKED!`);
            return {
              ...card,
              isBlocked: false,
              blockerReason: undefined,
            };
          } else {
            logs.push(`[Failed] Blocker on "${card.title}" persists (rolled under 4).`);
            return card;
          }
        } else {
          // Blocker check on work applied
          const isWorking = card.columnId !== 'backlog' && card.columnId !== 'ready' && card.columnId !== 'done';
          if (isWorking) {
            const roll1 = Math.random();
            const roll2 = isPaired ? Math.random() : 1;
            
            const blockerThreshold = 0.15;
            const blocked1 = roll1 < blockerThreshold;
            const blocked2 = roll2 < blockerThreshold;

            if (blocked1 && blocked2) {
              logs.push(`[Blocker] Oh no! "${card.title}" got blocked! Reason: Quality defect found.`);
              return {
                ...card,
                isBlocked: true,
                blockerReason: 'Quality defect: Code refactor required.',
              };
            } else if (blocked1 && isPaired) {
              logs.push(`[Pairing Save] A potential blocker was avoided on "${card.title}" due to paired tasking quality checks!`);
            }
          }
        }
        return card;
      });

      // 3. Check for QA Rework logic
      updatedCards = updatedCards.map(card => {
        if (card.columnId === 'testing' && card.remainingEffort.testing === 0 && card.assignedAvatars.length > 0 && !card.isBlocked) {
          const isPaired = card.assignedAvatars.length > 1;
          const qaFailChance = isPaired ? 0.02 : 0.20;
          
          if (Math.random() < qaFailChance) {
            logs.push(`[QA Failure] "${card.title}" failed QA checks. Rework needed! Sent back to Development.`);
            return {
              ...card,
              columnId: 'development',
              remainingEffort: {
                ...card.remainingEffort,
                development: 2,
                testing: 1,
              },
              failedQACount: card.failedQACount + 1,
              history: [...card.history, { day: prev.day, columnId: 'development' }],
            };
          }
        }
        return card;
      });

      // 4. Log Daily Metrics for CFD & run charts
      const nextDay = prev.day + 1;
      const completedCardsToday = updatedCards.filter(c => c.columnId === 'done' && c.completedAt === prev.day);
      const completedCount = completedCardsToday.length;

      const columnWIP: { [columnId: string]: number } = {};
      prev.columns.forEach(col => {
        columnWIP[col.id] = updatedCards.filter(c => c.columnId === col.id).length;
      });

      const previousLogs = prev.dailyLogs;
      const prevCumulative = previousLogs.length > 0 ? previousLogs[previousLogs.length - 1].cumulativeThroughput : 0;
      const cumulativeThroughput = prevCumulative + completedCount;

      // Calculate Lead Time & Cycle Time averages
      const completedAll = updatedCards.filter(c => c.columnId === 'done' && c.completedAt !== null);
      let avgLead = null;
      let avgCycle = null;

      if (completedAll.length > 0) {
        const sumLead = completedAll.reduce((sum, c) => sum + ((c.completedAt || 0) - c.createdAt), 0);
        const sumCycle = completedAll.reduce((sum, c) => sum + ((c.completedAt || 0) - (c.startedAt || c.createdAt)), 0);
        avgLead = parseFloat((sumLead / completedAll.length).toFixed(1));
        avgCycle = parseFloat((sumCycle / completedAll.length).toFixed(1));
      }

      const dayLog: DailyLog = {
        day: prev.day,
        columnWIP,
        throughput: completedCount,
        cumulativeThroughput,
        averageLeadTime: avgLead,
        averageCycleTime: avgCycle,
      };

      const updatedLogs = [...prev.dailyLogs, dayLog];

      // 5. Check Game Over
      const isGameOver = nextDay > prev.maxDays;
      const gamePhase = isGameOver ? 'game_over' : 'day_summary';

      if (isGameOver) {
        logs.push(`--- Game Over! ---`);
        logs.push(`Completed ${cumulativeThroughput} items. Average Lead Time: ${avgLead || 0} days. Average Cycle Time: ${avgCycle || 0} days.`);
      } else {
        logs.push(`--- Day ${prev.day} Summary ---`);
        logs.push(`Throughput: ${completedCount} cards completed. Cumulative: ${cumulativeThroughput}.`);
        logs.push(`Click "Start Day ${nextDay}" to proceed.`);
      }

      return {
        ...prev,
        cards: updatedCards,
        avatars: updatedAvatars,
        dailyLogs: updatedLogs,
        gamePhase,
        eventLogs: logs,
      };
    });
  }, []);

  // Advance to next day after viewing summary
  const startNextDay = useCallback(() => {
    setGameState(prev => {
      const nextDay = prev.day + 1;
      const scenario = easyModeScenario;
      const dayEvent: ScenarioDayEvent | null = scenario.events[nextDay] || null;
      
      const logs = [...prev.eventLogs, `--- Start Day ${nextDay} ---`];

      // Apply day event if present
      let updatedCards = [...prev.cards];
      let updatedColumns = [...prev.columns];
      let pairingAllowed = prev.pairingAllowed;

      if (dayEvent) {
        logs.push(`Event: ${dayEvent.title}`);
        logs.push(dayEvent.description);

        if (dayEvent.pairingAllowed !== undefined) {
          pairingAllowed = dayEvent.pairingAllowed;
        }

        // Apply WIP limits
        if (dayEvent.wipLimits) {
          updatedColumns = prev.columns.map(col => {
            if (dayEvent.wipLimits && col.id in dayEvent.wipLimits) {
              return { ...col, wipLimit: dayEvent.wipLimits[col.id] };
            }
            return col;
          });
        }

        // Apply new cards
        if (dayEvent.newCards) {
          const newCardsList: Card[] = dayEvent.newCards.map((c, index) => ({
            ...c,
            id: `card_${generateId()}_${index}`,
            remainingEffort: { ...c.effort },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: c.columnId !== 'backlog' && c.columnId !== 'ready' ? nextDay : null,
            history: [{ day: nextDay, columnId: c.columnId }],
          }));
          updatedCards = [...updatedCards, ...newCardsList];
        }

        // Apply blocker event
        if (dayEvent.blockCardId) {
          if (dayEvent.blockCardId === 'random_dev_card') {
            const devCards = updatedCards.filter(c => c.columnId === 'development' && !c.isBlocked);
            if (devCards.length > 0) {
              const target = devCards[Math.floor(Math.random() * devCards.length)];
              updatedCards = updatedCards.map(c => {
                if (c.id === target.id) {
                  return {
                    ...c,
                    isBlocked: true,
                    blockerReason: dayEvent.blockedReason || 'Production blocker.',
                  };
                }
                return c;
              });
              logs.push(`[Blocker Event] "${target.title}" is now blocked: ${dayEvent.blockedReason}`);
            }
          }
        }
      }

      // Reset developer assignments for the new day
      const resetAvatars = prev.avatars.map(avatar => {
        return {
          ...avatar,
          currentRoll: null,
          assignedCardId: null,
          spentCapacity: 0,
        };
      });

      return {
        ...prev,
        day: nextDay,
        cards: updatedCards,
        columns: updatedColumns,
        avatars: resetAvatars,
        pairingAllowed,
        rolledToday: false,
        gamePhase: 'day_start',
        currentDayEvent: dayEvent,
        eventLogs: logs,
      };
    });
  }, []);

  // Sandbox Mode: Manual WIP limit configurations
  const setWipLimit = useCallback((columnId: string, limit: number | null) => {
    setGameState(prev => {
      const updatedColumns = prev.columns.map(col => {
        if (col.id === columnId) {
          return { ...col, wipLimit: limit };
        }
        return col;
      });
      return {
        ...prev,
        columns: updatedColumns,
        eventLogs: [...prev.eventLogs, `Set WIP limit on "${columnId}" to ${limit ?? 'unlimited'}`],
      };
    });
  }, []);

  // Sandbox Mode: Manual column renaming
  const renameColumn = useCallback((columnId: string, newName: string) => {
    setGameState(prev => {
      const updatedColumns = prev.columns.map(col => {
        if (col.id === columnId) {
          return { ...col, name: newName };
        }
        return col;
      });
      return {
        ...prev,
        columns: updatedColumns,
      };
    });
  }, []);

  return {
    gameState,
    startGame,
    rollDice,
    assignAvatar,
    moveCard,
    endDay,
    startNextDay,
    setWipLimit,
    renameColumn,
  };
};
