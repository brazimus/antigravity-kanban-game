import { useState, useCallback, useEffect } from 'react';
import type { GameState, Card, DailyLog, ScenarioDayEvent, CardStageEffort } from './types';
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

  // Start/Restart Game
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
      remainingCapacity: 0,
      workedOnCardIdsToday: [],
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
      
      const rolledAvatars = prev.avatars.map(avatar => {
        const rawRoll = Math.floor(Math.random() * 6) + 1;
        let rollModifier = 0;
        let inactive = false;

        // Apply capacity changes from current scenario day event
        if (prev.currentDayEvent?.capacityChange) {
          const capChange = prev.currentDayEvent.capacityChange.find(c => c.avatarId === avatar.id);
          if (capChange) {
            if (capChange.inactive) inactive = true;
            if (capChange.rollModifier) rollModifier = capChange.rollModifier;
            logs.push(`Event effect on ${avatar.name}: ${capChange.description}`);
          }
        }

        if (inactive) {
          logs.push(`${avatar.name} is inactive today (Capacity: 0).`);
          return {
            ...avatar,
            currentRoll: 0,
            spentCapacity: 0,
            remainingCapacity: 0,
            assignedCardId: null,
            workedOnCardIdsToday: [],
          };
        }

        const finalRoll = Math.max(1, rawRoll + rollModifier);
        logs.push(`${avatar.name} rolled a ${rawRoll}${rollModifier !== 0 ? ` (modifier: ${rollModifier > 0 ? '+' : ''}${rollModifier})` : ''} -> Capacity: ${finalRoll}`);
        
        return {
          ...avatar,
          currentRoll: finalRoll,
          spentCapacity: 0,
          remainingCapacity: finalRoll,
          assignedCardId: null,
          workedOnCardIdsToday: [],
        };
      });

      // Clear card assignments for the start of day
      const updatedCards = prev.cards.map(c => ({
        ...c,
        assignedAvatars: [],
      }));

      // Take snapshot of day start so user can undo/reset work
      const snapshotAtDayStart = {
        cards: JSON.parse(JSON.stringify(updatedCards)),
        avatars: JSON.parse(JSON.stringify(rolledAvatars)),
      };

      return {
        ...prev,
        avatars: rolledAvatars,
        cards: updatedCards,
        rolledToday: true,
        gamePhase: 'dice_rolled',
        eventLogs: logs,
        snapshotAtDayStart,
      };
    });
  }, [gameState.rolledToday, gameState.gamePhase]);

  // Reset Today's Allocations (Undo)
  const resetDailyWork = useCallback(() => {
    if (!gameState.snapshotAtDayStart || gameState.gamePhase !== 'dice_rolled') return;

    setGameState(prev => {
      if (!prev.snapshotAtDayStart) return prev;
      
      const logs = [...prev.eventLogs, `[Reset] Reset all capacity allocations for Day ${prev.day}.`];
      
      return {
        ...prev,
        cards: JSON.parse(JSON.stringify(prev.snapshotAtDayStart.cards)),
        avatars: JSON.parse(JSON.stringify(prev.snapshotAtDayStart.avatars)),
        eventLogs: logs,
      };
    });
  }, [gameState.snapshotAtDayStart, gameState.gamePhase]);

  // Allocate capacity to card (Real-Time Model 1)
  const allocateCapacity = useCallback((avatarId: string, cardId: string) => {
    setGameState(prev => {
      const logs = [...prev.eventLogs];
      const avatar = prev.avatars.find(a => a.id === avatarId);
      const card = prev.cards.find(c => c.id === cardId);

      if (!avatar || !card) return prev;
      if (avatar.remainingCapacity <= 0) {
        logs.push(`[Warning] ${avatar.name} has no capacity remaining.`);
        return prev;
      }

      // Check context switching penalty
      // Penalty triggers if they worked on a DIFFERENT card today
      const workedOnOthers = avatar.workedOnCardIdsToday.filter(id => id !== cardId);
      const hasSwitchToday = workedOnOthers.length > 0;
      // Also triggers if they switch from yesterday's last card
      const hasSwitchFromYesterday = avatar.workedOnCardIdsToday.length === 0 && avatar.previousCardId !== null && avatar.previousCardId !== cardId;
      const isSwitch = hasSwitchToday || hasSwitchFromYesterday;
      const penalty = isSwitch ? 1 : 0;

      const availableCapacity = avatar.remainingCapacity - penalty;
      if (availableCapacity <= 0) {
        logs.push(`[Warning] ${avatar.name} has ${avatar.remainingCapacity} pt(s) left, but context-switching costs 1 pt. Cannot allocate.`);
        return prev;
      }

      // Handle Blocker check
      if (card.isBlocked) {
        // Unblocking takes 2 capacity points
        if (availableCapacity < 2) {
          logs.push(`[Warning] Unblocking "${card.title}" requires 2 capacity points. ${avatar.name} has only ${availableCapacity} available.`);
          return prev;
        }

        const capacityToSpend = 2;
        const totalCost = capacityToSpend + penalty;

        // Perform unblock roll (4+ on d6). If paired, roll with advantage.
        // Check if another dev is already assigned to this blocked card
        const isPairedUnblock = card.assignedAvatars.length > 0;
        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = isPairedUnblock ? Math.floor(Math.random() * 6) + 1 : 0;
        const maxRoll = Math.max(roll1, roll2);

        logs.push(`${avatar.name} spent 2 capacity trying to unblock "${card.title}"${isSwitch ? ' (including -1 task switch penalty)' : ''}.`);
        logs.push(`Unblock roll: ${roll1}${isPairedUnblock ? ` (with helper roll: ${roll2})` : ''} -> Result: ${maxRoll}`);

        let isBlocked: boolean = card.isBlocked;
        let blockerReason = card.blockerReason;

        if (maxRoll >= 4) {
          logs.push(`[Success] "${card.title}" is now UNBLOCKED!`);
          isBlocked = false;
          blockerReason = undefined;
        } else {
          logs.push(`[Failed] Blocker on "${card.title}" persists.`);
        }

        const updatedCards = prev.cards.map(c => {
          if (c.id === cardId) {
            return {
              ...c,
              isBlocked,
              blockerReason,
              assignedAvatars: c.assignedAvatars.includes(avatarId) ? c.assignedAvatars : [...c.assignedAvatars, avatarId],
            };
          }
          return c;
        });

        const updatedAvatars = prev.avatars.map(a => {
          if (a.id === avatarId) {
            return {
              ...a,
              remainingCapacity: a.remainingCapacity - totalCost,
              spentCapacity: a.spentCapacity + totalCost,
              workedOnCardIdsToday: a.workedOnCardIdsToday.includes(cardId) ? a.workedOnCardIdsToday : [...a.workedOnCardIdsToday, cardId],
              assignedCardId: cardId,
            };
          }
          return a;
        });

        return {
          ...prev,
          cards: updatedCards,
          avatars: updatedAvatars,
          eventLogs: logs,
        };
      }

      // Normal Effort progress
      const currentColumn = prev.columns.find(col => col.id === card.columnId);
      const allowedEfforts = currentColumn ? currentColumn.allowedEffortTypes : [];
      
      // Find what effort type and points are needed
      let activeEffortType: keyof CardStageEffort | null = null;
      let neededProgress = 0;

      for (const type of allowedEfforts) {
        if (card.remainingEffort[type] > 0) {
          activeEffortType = type;
          neededProgress = card.remainingEffort[type];
          break;
        }
      }

      if (!activeEffortType || neededProgress === 0) {
        logs.push(`[Warning] No active effort required for "${card.title}" in this stage.`);
        return prev;
      }

      // Check if paired (is helper)
      // If someone else already assigned, this developer is the helper
      const isHelper = card.assignedAvatars.length > 0 && !card.assignedAvatars.includes(avatarId);
      if (isHelper && !prev.pairingAllowed) {
        logs.push(`[Warning] Pairing is disabled. Cannot assign ${avatar.name} as a helper.`);
        return prev;
      }

      let capacityToSpend = 0;
      let progressToApply = 0;

      if (isHelper) {
        // Helper gets 50% progress.
        // To get P progress points, they must spend P * 2 capacity.
        const maxProgressPossible = Math.floor(availableCapacity / 2);
        progressToApply = Math.min(neededProgress, maxProgressPossible);
        capacityToSpend = progressToApply * 2;

        if (capacityToSpend === 0 && availableCapacity > 0) {
          logs.push(`[Warning] Helper requires at least 2 capacity points to make 1 progress point. ${avatar.name} has only ${availableCapacity} available.`);
          return prev;
        }
      } else {
        // Lead dev gets 100% progress
        progressToApply = Math.min(neededProgress, availableCapacity);
        capacityToSpend = progressToApply;
      }

      const totalCost = capacityToSpend + penalty;
      logs.push(`${avatar.name} applied ${capacityToSpend} capacity points -> generated ${progressToApply} progress on "${card.title}"${isSwitch ? ' (including -1 task switch penalty)' : ''}${isHelper ? ' [Pair Helper 50% rate]' : ' [Lead Dev]'}.`);

      const updatedCards = prev.cards.map(c => {
        if (c.id === cardId) {
          const newRemaining = { ...c.remainingEffort };
          if (activeEffortType) {
            newRemaining[activeEffortType] = Math.max(0, newRemaining[activeEffortType] - progressToApply);
          }
          return {
            ...c,
            remainingEffort: newRemaining,
            assignedAvatars: c.assignedAvatars.includes(avatarId) ? c.assignedAvatars : [...c.assignedAvatars, avatarId],
          };
        }
        return c;
      });

      const updatedAvatars = prev.avatars.map(a => {
        if (a.id === avatarId) {
          return {
            ...a,
            remainingCapacity: a.remainingCapacity - totalCost,
            spentCapacity: a.spentCapacity + totalCost,
            workedOnCardIdsToday: a.workedOnCardIdsToday.includes(cardId) ? a.workedOnCardIdsToday : [...a.workedOnCardIdsToday, cardId],
            assignedCardId: cardId, // set active card
          };
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

      // WIP Limit Enforcement
      const targetColumn = prev.columns.find(col => col.id === targetColumnId);
      if (targetColumn && targetColumn.wipLimit !== null) {
        const currentWIP = prev.cards.filter(c => c.columnId === targetColumnId).length;
        if (currentWIP >= targetColumn.wipLimit && card.type !== 'expedite') {
          success = false;
          errorMessage = `WIP limit reached! Column "${targetColumn.name}" has a limit of ${targetColumn.wipLimit}.`;
          return prev;
        }
      }

      // Blocked card check
      const columnOrder = prev.columns.map(c => c.id);
      const sourceIndex = columnOrder.indexOf(sourceColumn);
      const targetIndex = columnOrder.indexOf(targetColumnId);
      
      if (card.isBlocked && targetIndex > sourceIndex) {
        success = false;
        errorMessage = `Cannot move "${card.title}" forward while it is blocked.`;
        return prev;
      }

      // Effort check
      const sourceColObj = prev.columns.find(col => col.id === sourceColumn);
      if (sourceColObj && targetIndex > sourceIndex) {
        const requiredEfforts = sourceColObj.allowedEffortTypes;
        const unfinishedEffort = requiredEfforts.some(effortType => card.remainingEffort[effortType] > 0);
        if (unfinishedEffort) {
          success = false;
          errorMessage = `Cannot move "${card.title}" forward. Effort is still required in "${sourceColObj.name}".`;
          return prev;
        }
      }

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
            history: [...c.history, { day: prev.day, columnId: targetColumnId }],
          };
        }
        return c;
      });

      return {
        ...prev,
        cards: updatedCards,
        eventLogs: logs,
      };
    });

    return { success, errorMessage };
  }, []);

  // End Day & Finalize Metrics (Blockers & QA check)
  const endDay = useCallback(() => {
    setGameState(prev => {
      const logs = [...prev.eventLogs, `--- End of Day ${prev.day} processing ---`];
      
      let updatedCards = [...prev.cards];

      // 1. Blocker checks for active cards that had work applied today
      updatedCards = updatedCards.map(card => {
        const workedOnToday = card.assignedAvatars.length > 0;
        const isWorking = card.columnId !== 'backlog' && card.columnId !== 'ready' && card.columnId !== 'done';
        
        if (workedOnToday && isWorking && !card.isBlocked) {
          const isPaired = card.assignedAvatars.length > 1;
          const roll1 = Math.random();
          const roll2 = isPaired ? Math.random() : 1; // 1 means safe
          
          const blockerThreshold = 0.15;
          const blocked1 = roll1 < blockerThreshold;
          const blocked2 = roll2 < blockerThreshold;

          if (blocked1 && blocked2) {
            logs.push(`[Blocker] Oh no! "${card.title}" got blocked by a quality bug.`);
            return {
              ...card,
              isBlocked: true,
              blockerReason: 'Quality defect: Code refactor required.',
            };
          } else if (blocked1 && isPaired) {
            logs.push(`[Pairing Save] A blocker check on "${card.title}" failed, but was avoided due to paired quality validation!`);
          }
        }
        return card;
      });

      // 2. QA Rework checks for Testing cards that finished testing today
      updatedCards = updatedCards.map(card => {
        // Rework triggers if the testing effort is complete, it had work applied today, and isn't blocked
        const workedOnToday = card.assignedAvatars.length > 0;
        const isTestingDone = card.columnId === 'testing' && card.remainingEffort.testing === 0;

        if (isTestingDone && workedOnToday && !card.isBlocked) {
          const isPaired = card.assignedAvatars.length > 1;
          const qaFailChance = isPaired ? 0.02 : 0.20;
          
          if (Math.random() < qaFailChance) {
            logs.push(`[QA Failure] "${card.title}" failed QA validation. Sent back to Development for rework.`);
            return {
              ...card,
              columnId: 'development',
              remainingEffort: {
                ...card.remainingEffort,
                development: 2, // rework effort
                testing: 1,     // retest effort
              },
              failedQACount: card.failedQACount + 1,
              // Reset assignments so they don't carry over
              assignedAvatars: [],
              history: [...card.history, { day: prev.day, columnId: 'development' }],
            };
          }
        }
        return card;
      });

      // 3. Clear avatar daily assignments for next day, set previousCardId
      const updatedAvatars = prev.avatars.map(avatar => {
        // If they worked on multiple cards, set the last one as previousCardId
        const lastCardWorked = avatar.workedOnCardIdsToday.slice(-1)[0] || avatar.previousCardId;
        return {
          ...avatar,
          previousCardId: lastCardWorked,
          assignedCardId: null,
          spentCapacity: 0,
          remainingCapacity: 0,
          workedOnCardIdsToday: [],
        };
      });

      // 4. Log Daily Metrics for CFD & reports
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
          remainingCapacity: 0,
          workedOnCardIdsToday: [],
        };
      });

      // Clear card assignments (so we start fresh today)
      updatedCards = updatedCards.map(c => ({
        ...c,
        assignedAvatars: [],
      }));

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
    allocateCapacity,
    resetDailyWork,
    moveCard,
    endDay,
    startNextDay,
    setWipLimit,
    renameColumn,
  };
};
