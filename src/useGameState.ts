import { useState, useCallback, useEffect } from 'react';
import type { GameState, Card, DailyLog, ScenarioDayEvent, GameConfig } from './types';
import { easyModeScenario, defaultColumns, defaultAvatars } from './scenarios';

const LOCAL_STORAGE_KEY = 'antigravity_kanban_game_state';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

const BACKLOG_CARD_POOL = [
  { title: 'Optimize Database Indexing', description: 'Speed up user search queries by index profiling.' },
  { title: 'Implement OAuth (Google/GitHub)', description: 'Allow users to sign in using their social accounts.' },
  { title: 'Add PDF Invoicing Support', description: 'Enable billing modules to generate and email PDF receipts.' },
  { title: 'Refactor Payment Checkout API', description: 'Improve codebase readability and reliability for payments.' },
  { title: 'Design Admin User Management', description: 'Create dashboard view to search, block, and manage accounts.' },
  { title: 'Build Push Notification Service', description: 'Notify users in real-time about service status updates.' },
  { title: 'Integrate Live Chat Support Widget', description: 'Add Intercom widget for customer inquiries.' },
  { title: 'Configure CDN Asset Caching', description: 'Drastically improve LCP performance with edge caching.' },
  { title: 'Implement MFA login validation', description: 'Add TOTP multi-factor verification for security compliance.' },
  { title: 'Export Usage Reports as CSV', description: 'Allow enterprise customers to download audit data.' },
  { title: 'Optimize Image Upload Caching', description: 'Resize client-side image files before pushing to S3 storage.' },
  { title: 'Write OpenAPI Spec and Docs', description: 'Document all REST endpoints for external developer usage.' },
  { title: 'Set up E2E Playwright Tests', description: 'Add smoke testing on user login and checkout flows.' },
  { title: 'Localize Platform in Spanish', description: 'Translate UI copy and error strings for global outreach.' },
  { title: 'Fix CSS Grid Layout on Safari', description: 'Resolve flexbox wrap visual bugs on iOS devices.' }
];

const rollupEpicProgress = (cards: Card[], day: number): Card[] => {
  let updatedCards = [...cards];
  const epics = updatedCards.filter(c => c.isEpic || c.type === 'epic');
  epics.forEach(epic => {
    const children = updatedCards.filter(c => c.parentEpicId === epic.id);
    if (children.length > 0) {
      const completed = children.filter(c => c.columnId === 'done').length;
      const progress = Math.round((completed / children.length) * 100);
      
      if (progress !== (epic.epicProgress || 0)) {
        updatedCards = updatedCards.map(c => {
          if (c.id === epic.id) {
            const updates: Partial<Card> = { epicProgress: progress };
            if (progress === 100 && c.columnId !== 'done') {
              updates.columnId = 'done';
              updates.completedAt = day;
              updates.history = [...(c.history || []), { day, columnId: 'done' }];
            }
            return { ...c, ...updates };
          }
          return c;
        });
      }
    }
  });
  return updatedCards;
};

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
      wipLimitsActive: false,
      shiftLeftActive: false,
      swarmingActive: false,
      smallerBatchesActive: false,
      config: {
        maxDays: 10,
        blockerChance: 0.15,
        qaFailChanceUnpaired: 0.20,
        qaFailChancePaired: 0.02,
        unblockCost: 2,
        pairingHelpCost: 2,
        selfTestingMultiplier: 2.0
      }
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Start/Restart Game
  const startGame = useCallback((customConfig?: Partial<GameConfig>) => {
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
      maxDays: customConfig?.maxDays ?? scenario.totalDays,
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
      wipLimitsActive: false,
      shiftLeftActive: false,
      swarmingActive: false,
      smallerBatchesActive: false,
      showStartOfDayModal: true,
      config: {
        maxDays: 10,
        blockerChance: 0.15,
        qaFailChanceUnpaired: 0.20,
        qaFailChancePaired: 0.02,
        unblockCost: 2,
        pairingHelpCost: 2,
        selfTestingMultiplier: 2.0,
        ...customConfig
      }
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
  const allocateCapacity = useCallback((avatarId: string, cardId: string, effortType?: 'analysis' | 'development' | 'testing') => {
    setGameState(prev => {
      const logs = [...prev.eventLogs];
      const avatar = prev.avatars.find(a => a.id === avatarId);
      const card = prev.cards.find(c => c.id === cardId);

      if (!avatar || !card) return prev;
      if (avatar.remainingCapacity <= 0) {
        logs.push(`[Warning] ${avatar.name} has no capacity remaining.`);
        return prev;
      }

      // 1. Expedite Urgency Constraint
      if (card.type !== 'epic' && card.type !== 'expedite') {
        const hasExpediteInColumn = prev.cards.some(
          c => c.columnId === card.columnId && 
               c.type === 'expedite' && 
               ((c.remainingEffort.analysis || 0) > 0 || (c.remainingEffort.development || 0) > 0 || (c.remainingEffort.testing || 0) > 0)
        );
        if (hasExpediteInColumn) {
          logs.push(`[Blocked] Cannot work on standard card "${card.title}" while an EXPEDITE card is active in the ${card.columnId.toUpperCase()} column.`);
          return { ...prev, eventLogs: logs };
        }
      }

      // Check context switching penalty
      // Penalty triggers if they worked on a DIFFERENT card today
      const workedOnOthers = avatar.workedOnCardIdsToday.filter(id => id !== cardId);
      const hasSwitchToday = workedOnOthers.length > 0;
      // Also triggers if they switch from yesterday's last card
      const hasSwitchFromYesterday = avatar.workedOnCardIdsToday.length === 0 && avatar.previousCardId !== null && avatar.previousCardId !== cardId;
      const isSwitch = hasSwitchToday || hasSwitchFromYesterday;
      let penalty = isSwitch ? 1 : 0;
      if (prev.swarmingActive) {
        penalty = 0;
      }

      const availableCapacity = avatar.remainingCapacity - penalty;
      if (availableCapacity <= 0) {
        logs.push(`[Warning] ${avatar.name} has ${avatar.remainingCapacity} pt(s) left, but context-switching costs 1 pt. Cannot allocate.`);
        return prev;
      }

      const configUnblockCost = prev.config?.unblockCost ?? 2;
      const configPairingCost = prev.config?.pairingHelpCost ?? 2;

      // Handle Blocker check
      if (card.isBlocked) {
        if (availableCapacity < configUnblockCost) {
          logs.push(`[Warning] Unblocking "${card.title}" requires ${configUnblockCost} capacity points. ${avatar.name} has only ${availableCapacity} available.`);
          return prev;
        }

        const capacityToSpend = configUnblockCost;
        const totalCost = capacityToSpend + penalty;

        // Perform unblock roll (4+ on d6). If paired, roll with advantage.
        // Check if another dev is already assigned to this blocked card
        const isPairedUnblock = card.assignedAvatars.length > 0;
        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = isPairedUnblock ? Math.floor(Math.random() * 6) + 1 : 0;
        const maxRoll = Math.max(roll1, roll2);

        logs.push(`${avatar.name} spent ${configUnblockCost} capacity trying to unblock "${card.title}"${isSwitch && penalty > 0 ? ' (including -1 task switch penalty)' : ''}.`);
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
      if (!currentColumn) return prev;

      const allowedEfforts = prev.shiftLeftActive && card.columnId === 'development'
        ? ['development', 'testing']
        : currentColumn.allowedEffortTypes;
      
      // Find what effort type and points are needed
      let activeEffortType = effortType;
      if (!activeEffortType) {
        activeEffortType = allowedEfforts.find(
          type => (card.remainingEffort[type] || 0) > 0
        ) as 'analysis' | 'development' | 'testing';
      }

      if (!activeEffortType || !allowedEfforts.includes(activeEffortType)) {
        logs.push(`[Warning] No active effort required for "${card.title}" in this stage.`);
        return prev;
      }

      const neededProgress = card.remainingEffort[activeEffortType] || 0;
      if (neededProgress === 0) {
        logs.push(`[Warning] No remaining ${activeEffortType} effort for "${card.title}".`);
        return prev;
      }

      // Check if paired (is helper)
      // If someone else already assigned, this developer is the helper
      const isHelper = card.assignedAvatars.length > 0 && !card.assignedAvatars.includes(avatarId);
      if (isHelper && !(prev.pairingAllowed || prev.wipLimitsActive)) {
        logs.push(`[Warning] Pairing is disabled. Cannot assign ${avatar.name} as a helper.`);
        return prev;
      }

      let capacityToSpend = 0;
      let progressToApply = 0;

      if (isHelper) {
        // Helper gets 50% progress.
        // To get P progress points, they must spend P * configPairingCost capacity.
        const maxProgressPossible = Math.floor(availableCapacity / configPairingCost);
        progressToApply = Math.min(neededProgress, maxProgressPossible);
        capacityToSpend = progressToApply * configPairingCost;

        if (capacityToSpend === 0 && availableCapacity > 0) {
          logs.push(`[Warning] Helper requires at least ${configPairingCost} capacity points to make 1 progress point. ${avatar.name} has only ${availableCapacity} available.`);
          return prev;
        }
      } else {
        // Lead dev gets 100% progress
        progressToApply = Math.min(neededProgress, availableCapacity);
        capacityToSpend = progressToApply;
      }

      const totalCost = capacityToSpend + penalty;
      logs.push(`${avatar.name} applied ${capacityToSpend} capacity points -> generated ${progressToApply} progress of type ${activeEffortType} on "${card.title}"${isSwitch && penalty > 0 ? ' (including -1 task switch penalty)' : ''}${isHelper ? ` [Pair Helper at ${configPairingCost}:1 rate]` : ' [Lead Dev]'}.`);

      const updatedCards = prev.cards.map(c => {
        if (c.id === cardId) {
          const newRemaining = { ...c.remainingEffort };
          if (activeEffortType) {
            newRemaining[activeEffortType] = Math.max(0, newRemaining[activeEffortType] - progressToApply);
          }
          const developedBy = Array.from(new Set([...(c.developedBy || []), ...(activeEffortType === 'development' ? [avatarId] : [])]));
          const testedBy = Array.from(new Set([...(c.testedBy || []), ...(activeEffortType === 'testing' ? [avatarId] : [])]));
          return {
            ...c,
            remainingEffort: newRemaining,
            assignedAvatars: c.assignedAvatars.includes(avatarId) ? c.assignedAvatars : [...c.assignedAvatars, avatarId],
            developedBy,
            testedBy
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

      const blockerChance = prev.config?.blockerChance ?? 0.15;
      const isOSUpgradeActive = prev.currentDayEvent?.title.includes('OS Upgrade');
      // If OS upgrade is active and it's within the first 3 days of the week, blocker risk increases to 30%
      const currentDayInWeek = (prev.day % 5) === 0 ? 5 : (prev.day % 5);
      const finalBlockerChance = (isOSUpgradeActive && currentDayInWeek <= 3) ? 0.30 : blockerChance;

      // 1. Blocker checks for active cards that had work applied today
      updatedCards = updatedCards.map(card => {
        const workedOnToday = card.assignedAvatars.length > 0;
        const isWorking = card.columnId !== 'backlog' && card.columnId !== 'ready' && card.columnId !== 'done' && card.columnId !== 'epic_pool';
        
        if (workedOnToday && isWorking && !card.isBlocked) {
          const isPaired = card.assignedAvatars.length > 1;
          const roll1 = Math.random();
          const roll2 = isPaired ? Math.random() : 1; // 1 means safe
          
          const blocked1 = roll1 < finalBlockerChance;
          const blocked2 = roll2 < finalBlockerChance;

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

      // 2. QA Rework checks for Testing cards that finished testing today (Bypassed if Shift-Left is active)
      if (!prev.shiftLeftActive) {
        updatedCards = updatedCards.map(card => {
          // Rework triggers if the testing effort is complete, it had work applied today, and isn't blocked
          const workedOnToday = card.assignedAvatars.length > 0;
          const isTestingDone = card.columnId === 'testing' && card.remainingEffort.testing === 0;

          if (isTestingDone && workedOnToday && !card.isBlocked) {
            const isPaired = card.assignedAvatars.length > 1;
            const qaFailChanceUnpaired = prev.config?.qaFailChanceUnpaired ?? 0.20;
            const qaFailChancePaired = prev.config?.qaFailChancePaired ?? 0.02;
            const baseQaChance = isPaired ? qaFailChancePaired : qaFailChanceUnpaired;

            const overlap = (card.developedBy || []).filter(devId => (card.testedBy || []).includes(devId));
            const isSelfTesting = overlap.length > 0;
            const selfTestingMultiplier = prev.config?.selfTestingMultiplier ?? 2.0;
            const qaFailChance = isSelfTesting ? Math.min(1.0, baseQaChance * selfTestingMultiplier) : baseQaChance;

            if (isSelfTesting) {
              logs.push(`[Self-Testing Penalty] "${card.title}" is being tested by developer(s) who also developed it (${overlap.join(', ')}). QA failure rate increased from ${(baseQaChance * 100).toFixed(0)}% to ${(qaFailChance * 100).toFixed(0)}%.`);
            }
            
            if (Math.random() < qaFailChance) {
              logs.push(`[QA Failure] "${card.title}" failed QA validation. Sent back to Development for rework.`);
              return {
                ...card,
                columnId: 'development',
                remainingEffort: {
                  ...card.remainingEffort,
                  development: card.effort.development || 2, // rework effort
                  testing: card.effort.testing || 1,     // retest effort
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
      }

      // Roll up parent epic progress if any child cards are done
      updatedCards = rollupEpicProgress(updatedCards, prev.day);

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
        wipLimitsActive: prev.wipLimitsActive,
        shiftLeftActive: prev.shiftLeftActive,
        swarmingActive: prev.swarmingActive,
        smallerBatchesActive: prev.smallerBatchesActive,
      };

      const updatedLogs = [...prev.dailyLogs, dayLog];

      // 5. Check Game Over or Weekend Summary
      const isGameOver = nextDay > prev.maxDays;
      const isWeekend = prev.day % 5 === 0;
      const gamePhase = isGameOver ? 'game_over' : (isWeekend ? 'week_summary' : 'day_summary');

      if (isGameOver) {
        logs.push(`--- Game Over! ---`);
        logs.push(`Completed ${cumulativeThroughput} items. Average Lead Time: ${avgLead || 0} days. Average Cycle Time: ${avgCycle || 0} days.`);
      } else if (isWeekend) {
        logs.push(`--- Week End Reached (Day ${prev.day}) ---`);
        logs.push(`Week performance: ${completedCount} cards completed. Cumulative: ${cumulativeThroughput}.`);
        logs.push(`Waiting for instructor to configure next week's parameters.`);
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
  const startNextDay = useCallback((scenarioIdOrAcc?: string | {
    wipLimitsActive?: boolean;
    shiftLeftActive?: boolean;
    swarmingActive?: boolean;
    smallerBatchesActive?: boolean;
  }) => {
    setGameState(prev => {
      const nextDay = prev.day + 1;
      const scenario = easyModeScenario;
      let dayEvent: ScenarioDayEvent | null = scenario.events[nextDay] || null;
      
      const logs = [...prev.eventLogs, `--- Start Day ${nextDay} ---`];

      let lastSelectedScenarioId = prev.lastSelectedScenarioId;
      let nextEventId = prev.nextEventId;

      let wipLimitsActive = false;
      let shiftLeftActive = false;
      let swarmingActive = false;
      let smallerBatchesActive = false;

      if (typeof scenarioIdOrAcc === 'string') {
        lastSelectedScenarioId = scenarioIdOrAcc;
        if (scenarioIdOrAcc === 'wip_limits') {
          wipLimitsActive = true;
        } else if (scenarioIdOrAcc === 'shift_left') {
          shiftLeftActive = true;
        } else if (scenarioIdOrAcc === 'swarming') {
          swarmingActive = true;
        } else if (scenarioIdOrAcc === 'smaller_batches') {
          smallerBatchesActive = true;
        } else if (scenarioIdOrAcc === 'tradeshow') {
          nextEventId = 'tradeshow';
        } else if (scenarioIdOrAcc === 'security_breach') {
          nextEventId = 'outage';
        } else if (scenarioIdOrAcc === 'os_upgrade') {
          nextEventId = 'os_upgrade';
        } else if (scenarioIdOrAcc === 'reset') {
          nextEventId = null;
        }
      } else if (scenarioIdOrAcc && typeof scenarioIdOrAcc === 'object') {
        wipLimitsActive = !!scenarioIdOrAcc.wipLimitsActive;
        shiftLeftActive = !!scenarioIdOrAcc.shiftLeftActive;
        swarmingActive = !!scenarioIdOrAcc.swarmingActive;
        smallerBatchesActive = !!scenarioIdOrAcc.smallerBatchesActive;
      } else {
        wipLimitsActive = prev.wipLimitsActive || false;
        shiftLeftActive = prev.shiftLeftActive || false;
        swarmingActive = prev.swarmingActive || false;
        smallerBatchesActive = prev.smallerBatchesActive || false;
      }

      let updatedCards = [...prev.cards];
      let updatedColumns = [...prev.columns];
      let pairingAllowed = prev.pairingAllowed || false;

      // Shift-Left column migration check
      if (shiftLeftActive && !prev.shiftLeftActive) {
        updatedCards = updatedCards.map(c => {
          if (c.columnId === 'testing') {
            const updatedRemainingEffort = { ...c.remainingEffort };
            updatedRemainingEffort.development = c.effort.development; // Reset dev effort to full
            logs.push(`[Shift-Left Migration] Card "${c.title}" moved back from Testing to Development with full Development effort, keeping Testing progress.`);
            return {
              ...c,
              columnId: 'development',
              remainingEffort: updatedRemainingEffort,
              history: [...(c.history || []), { day: prev.day, columnId: 'development' }]
            };
          }
          return c;
        });
      }

      // Enforce WIP limits accelerator
      if (wipLimitsActive) {
        pairingAllowed = true;
        updatedColumns = updatedColumns.map(col => {
          if (col.id === 'analysis') return { ...col, wipLimit: 2 };
          if (col.id === 'development') return { ...col, wipLimit: 2 };
          if (col.id === 'testing') return { ...col, wipLimit: 1 };
          return col;
        });
      } else {
        // Reset WIP limits if accelerator is turned off
        updatedColumns = updatedColumns.map(col => ({ ...col, wipLimit: null }));
      }

      // Process dayEvent WIP limits and pairing constraints if present (e.g. Day 6 calendar event)
      if (dayEvent) {
        if (dayEvent.wipLimits) {
          updatedColumns = updatedColumns.map(col => {
            if (dayEvent.wipLimits && col.id in dayEvent.wipLimits) {
              return { ...col, wipLimit: dayEvent.wipLimits[col.id] };
            }
            return col;
          });
          const hasLimits = Object.values(dayEvent.wipLimits).some(val => val !== null);
          if (hasLimits) {
            wipLimitsActive = true;
          }
        }
        if (dayEvent.pairingAllowed !== undefined) {
          pairingAllowed = dayEvent.pairingAllowed;
        }
      }

      // Handle OS upgrade/Tradeshow events and carry-overs
      let nextEvent = dayEvent;

      // Handle card injection and blockers from dayEvent (e.g. Day 5 and Day 8 calendar events)
      if (dayEvent) {
        if (dayEvent.newCards) {
          const addedCards: Card[] = dayEvent.newCards.map((c, index) => ({
            ...c,
            id: `card_${generateId()}_d${nextDay}_${index}`,
            remainingEffort: { ...c.effort },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: c.columnId !== 'backlog' && c.columnId !== 'ready' ? nextDay : null,
            history: [{ day: nextDay, columnId: c.columnId }],
          }));
          updatedCards = [...updatedCards, ...addedCards];
          addedCards.forEach(c => {
            logs.push(`[System] New card added: "${c.title}" in column ${c.columnId.toUpperCase()}.`);
          });
        }

        if (dayEvent.blockCardId) {
          if (dayEvent.blockCardId === 'random_dev_card') {
            const devCards = updatedCards.filter(c => c.columnId === 'development' && !c.isBlocked);
            if (devCards.length > 0) {
              const randCard = devCards[Math.floor(Math.random() * devCards.length)];
              updatedCards = updatedCards.map(c => {
                if (c.id === randCard.id) {
                  return { ...c, isBlocked: true, blockerReason: dayEvent.blockedReason || 'Blocked.' };
                }
                return c;
              });
              logs.push(`[Alert] Blocker applied to "${randCard.title}": ${dayEvent.blockedReason}`);
            } else {
              const inProgressCards = updatedCards.filter(c => (c.columnId === 'analysis' || c.columnId === 'development' || c.columnId === 'testing') && !c.isBlocked);
              if (inProgressCards.length > 0) {
                const randCard = inProgressCards[Math.floor(Math.random() * inProgressCards.length)];
                updatedCards = updatedCards.map(c => {
                  if (c.id === randCard.id) {
                    return { ...c, isBlocked: true, blockerReason: dayEvent.blockedReason || 'Blocked.' };
                  }
                  return c;
                });
                logs.push(`[Alert] Blocker applied to "${randCard.title}": ${dayEvent.blockedReason}`);
              } else {
                logs.push(`[System] Blocker event active, but no active cards available to block.`);
              }
            }
          } else {
            updatedCards = updatedCards.map(c => {
              if (c.id === dayEvent.blockCardId) {
                return { ...c, isBlocked: true, blockerReason: dayEvent.blockedReason || 'Blocked.' };
              }
              return c;
            });
            logs.push(`[Alert] Card "${dayEvent.blockCardId}" has been blocked.`);
          }
        }
      }
      if (nextEvent) {
        if (nextEvent.title.includes('OS Upgrade')) {
          // Keep OS Upgrade as is
        }
      }

      // Inject Tradeshow epic or split child stories based on smallerBatchesActive 
      // Wait, in multiplayer it triggers when nextEventId === 'tradeshow'. In single player we can check if dayEvent exists and is tradeshow, or if day is 6 and tradeshow is selected.
      // Wait! Let's check when tradeshow event is queued in multiplayer.
      // In useMultiplayerState, it's queued by nextEventId === 'tradeshow'.
      // If we want to simulate the Tradeshow Deadline business scenario, we will implement custom injector functions or trigger it at weekend.
      // Let's check how scenarios are selected and run. We can trigger business scenarios in startNextDay using nextEventId as well!
      // Let's add nextEventId to types.ts and to useGameState.ts state!
      
      if (nextEventId === 'wip_limits') {
        wipLimitsActive = true;
        pairingAllowed = true;
        updatedColumns = updatedColumns.map(col => {
          if (col.id === 'analysis') return { ...col, wipLimit: 2 };
          if (col.id === 'development') return { ...col, wipLimit: 2 };
          if (col.id === 'testing') return { ...col, wipLimit: 1 };
          return col;
        });
        nextEvent = {
          title: 'WIP Limits & Pairing Enabled!',
          description: 'The team adopts Kanban WIP limits: Analysis (2), Development (2), Testing (1). Pairing is now enabled! Collaborating developers roll with advantage to ignore blocker checks.'
        };
        logs.push(`[System] Instructor enforced Kanban WIP limits & enabled Developer Pairing.`);
      } else if (nextEventId === 'outage') {
        const hotfixId = `card_hotfix_${Math.random().toString(36).substring(2, 9)}`;
        const hotfix: Card = {
          id: hotfixId,
          title: 'Production Outage: Payment Gateway',
          description: 'Major API failure preventing user checkouts. FIX IMMEDIATELY.',
          type: 'expedite',
          columnId: 'ready',
          effort: { analysis: 0, development: 2, testing: 1 },
          remainingEffort: { analysis: 0, development: 2, testing: 1 },
          assignedAvatars: [],
          isBlocked: false,
          failedQACount: 0,
          createdAt: nextDay,
          completedAt: null,
          startedAt: null,
          history: [{ day: nextDay, columnId: 'ready' }]
        };
        updatedCards = [...updatedCards, hotfix];
        nextEvent = {
          title: 'Critical Outage: Payment Failure',
          description: 'An urgent Production Hotfix card has arrived in the Ready column. It is marked EXPEDITE and is allowed to bypass WIP limits. Get all hands on deck!'
        };
        logs.push(`[Alert] PRODUCTION OUTAGE! Expedite hotfix card added to the Ready column.`);
      } else if (nextEventId === 'tech_debt') {
        nextEvent = {
          title: 'Technical Debt Instability',
          description: 'System degradation has occurred. Developers must deal with legacy issues. Capacity rolls are capped at 4 today.'
        };
        logs.push(`[Alert] Technical debt penalty active today.`);
      } else if (nextEventId === 'blocker') {
        const devCards = updatedCards.filter(c => c.columnId === 'development' && !c.isBlocked);
        if (devCards.length > 0) {
          const randCard = devCards[Math.floor(Math.random() * devCards.length)];
          updatedCards = updatedCards.map(c => {
            if (c.id === randCard.id) {
              return { ...c, isBlocked: true, blockerReason: 'External dependency offline.' };
            }
            return c;
          });
          nextEvent = {
            title: 'Infrastructure Blocker',
            description: `Card "${randCard.title}" has been blocked due to server crash. Developers must spend 2 points of capacity to unblock it.`
          };
          logs.push(`[System] Card "${randCard.title}" has been BLOCKED.`);
        } else {
          nextEvent = {
            title: 'Infrastructure Maintenance',
            description: 'Routine maintenance window complete. No card was blocked as development queue was empty.'
          };
        }
      } else if (nextEventId === 'tradeshow') {
        const epicId = `epic_tradeshow_${Math.random().toString(36).substring(2, 9)}`;
        if (smallerBatchesActive) {
          const epic: Card = {
            id: epicId,
            title: 'Trade Show Demo Epic',
            description: 'Deliver the product demo for the annual industry trade show.',
            type: 'epic',
            columnId: 'epic_pool',
            effort: { analysis: 0, development: 12, testing: 6 },
            remainingEffort: { analysis: 0, development: 12, testing: 6 },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: null,
            history: [{ day: nextDay, columnId: 'epic_pool' }],
            isEpic: true,
            epicProgress: 0,
            childCardIds: [`${epicId}_c1`, `${epicId}_c2`, `${epicId}_c3`]
          };
          const child1: Card = {
            id: `${epicId}_c1`,
            title: 'Trade Show Demo - Core Engine',
            description: 'Foundational backend API for trade show demo.',
            type: 'standard',
            columnId: 'ready',
            effort: { analysis: 1, development: 4, testing: 2 },
            remainingEffort: { analysis: 1, development: 4, testing: 2 },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: null,
            history: [{ day: nextDay, columnId: 'ready' }],
            parentEpicId: epicId
          };
          const child2: Card = {
            id: `${epicId}_c2`,
            title: 'Trade Show Demo - UI Layout',
            description: 'Frontend visual components for trade show demo.',
            type: 'standard',
            columnId: 'ready',
            effort: { analysis: 1, development: 4, testing: 2 },
            remainingEffort: { analysis: 1, development: 4, testing: 2 },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: null,
            history: [{ day: nextDay, columnId: 'ready' }],
            parentEpicId: epicId
          };
          const child3: Card = {
            id: `${epicId}_c3`,
            title: 'Trade Show Demo - Mock Payment',
            description: 'Stripe simulated module for trade show checkout.',
            type: 'standard',
            columnId: 'ready',
            effort: { analysis: 2, development: 4, testing: 2 },
            remainingEffort: { analysis: 2, development: 4, testing: 2 },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: null,
            history: [{ day: nextDay, columnId: 'ready' }],
            parentEpicId: epicId
          };
          updatedCards = [...updatedCards, epic, child1, child2, child3];
          nextEvent = {
            title: 'Trade Show Demo (Split Into Stories)',
            description: 'The Trade Show Demo Epic has been split into 3 independent stories in the Ready column because Story Splitting / Smaller Batches is active. Complete them to progress the Epic!',
            capacityChange: [
              { avatarId: 'alice', description: 'Trade show prep', rollModifier: -1 },
              { avatarId: 'bob', description: 'Trade show prep', rollModifier: -1 },
              { avatarId: 'charlie', description: 'Trade show prep', rollModifier: -1 }
            ]
          };
          logs.push(`[Event] Trade Show Demo epic split into 3 stories: Core Engine, UI Layout, Mock Payment.`);
        } else {
          const epic: Card = {
            id: epicId,
            title: 'Trade Show Demo Epic',
            description: 'Deliver the product demo for the annual industry trade show. (Large monolithic scope)',
            type: 'epic',
            columnId: 'ready',
            effort: { analysis: 2, development: 12, testing: 6 },
            remainingEffort: { analysis: 2, development: 12, testing: 6 },
            assignedAvatars: [],
            isBlocked: false,
            failedQACount: 0,
            createdAt: nextDay,
            completedAt: null,
            startedAt: null,
            history: [{ day: nextDay, columnId: 'ready' }],
            isEpic: true,
            epicProgress: 0,
            childCardIds: []
          };
          updatedCards = [...updatedCards, epic];
          nextEvent = {
            title: 'Trade Show Demo (Monolithic Epic)',
            description: 'A single, large Trade Show Demo Epic card has arrived in the Ready column. It is massive (Dev: 12, Test: 6). Try to coordinate the team to finish it by week\'s end!',
            capacityChange: [
              { avatarId: 'alice', description: 'Trade show prep', rollModifier: -1 },
              { avatarId: 'bob', description: 'Trade show prep', rollModifier: -1 },
              { avatarId: 'charlie', description: 'Trade show prep', rollModifier: -1 }
            ]
          };
          logs.push(`[Event] Injected monolithic Trade Show Demo Epic card into the Ready column.`);
        }
      } else if (nextEventId === 'os_upgrade') {
        nextEvent = {
          title: 'Client OS Upgrade - Day 1',
          description: 'Workstation upgrades active today. All developers suffer a -2 capacity modifier. Environment drift increases blocker risk to 30% for the next 3 days.',
          capacityChange: [
            { avatarId: 'alice', description: 'OS Upgrade', rollModifier: -2 },
            { avatarId: 'bob', description: 'OS Upgrade', rollModifier: -2 },
            { avatarId: 'charlie', description: 'OS Upgrade', rollModifier: -2 }
          ]
        };
        logs.push(`[Event] Ingested mandatory Client OS Upgrade: developers have capacity capped and blocker risk increased.`);
      }

      // Day 2 trade show capacity modifier carry-over check
      if (!nextEvent && (nextDay % 5 === 2) && prev.currentDayEvent?.title.includes('Trade Show')) {
        nextEvent = {
          title: 'Trade Show Prep - Day 2',
          description: 'Developers are finishing trade show prep. All capacity rolls still suffer a -1 modifier today.',
          capacityChange: [
            { avatarId: 'alice', description: 'Trade show prep', rollModifier: -1 },
            { avatarId: 'bob', description: 'Trade show prep', rollModifier: -1 },
            { avatarId: 'charlie', description: 'Trade show prep', rollModifier: -1 }
          ]
        };
      }

      // OS Upgrade Day 2/3 blocker risk warning
      if (!nextEvent && ((nextDay % 5 === 2) || (nextDay % 5 === 3)) && prev.currentDayEvent?.title.includes('Client OS Upgrade')) {
        nextEvent = {
          title: 'Client OS Upgrade - Environment Drift',
          description: 'Laptops updated, but environments are unstable. Blocker risk remains at 30% today.'
        };
      }

      if (nextEvent) {
        logs.push(`Event: ${nextEvent.title}`);
        logs.push(nextEvent.description);
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

      const isGameOver = nextDay > (prev.config?.maxDays ?? 10);

      return {
        ...prev,
        day: nextDay,
        cards: updatedCards,
        columns: updatedColumns,
        avatars: resetAvatars,
        pairingAllowed,
        rolledToday: false,
        gamePhase: isGameOver ? 'game_over' : 'day_start',
        currentDayEvent: nextEvent,
        nextEventId: null, // Reset event queue
        eventLogs: logs,
        wipLimitsActive,
        shiftLeftActive,
        swarmingActive,
        smallerBatchesActive,
        lastSelectedScenarioId,
        showStartOfDayModal: !isGameOver,
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

  // Manual Backlog Replenishment
  const replenishBacklog = useCallback(() => {
    setGameState(prev => {
      if (prev.gamePhase === 'intro' || prev.gamePhase === 'game_over') {
        return prev;
      }

      const poolIndex = Math.floor(Math.random() * BACKLOG_CARD_POOL.length);
      const template = BACKLOG_CARD_POOL[poolIndex];

      let analysis = Math.floor(Math.random() * 3) + 1;
      let development = Math.floor(Math.random() * 5) + 2;
      let testing = Math.floor(Math.random() * 3) + 1;

      if (prev.smallerBatchesActive) {
        analysis = Math.max(1, Math.round(analysis / 2));
        development = Math.max(1, Math.round(development / 2));
        testing = Math.max(1, Math.round(testing / 2));
      }

      const effort = {
        analysis,
        development,
        testing
      };

      const newCardId = `card_replenished_${generateId()}`;
      const newCard: Card = {
        id: newCardId,
        title: template.title,
        description: template.description,
        type: 'standard',
        columnId: 'backlog',
        effort,
        remainingEffort: { ...effort },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: prev.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: prev.day, columnId: 'backlog' }]
      };

      return {
        ...prev,
        cards: [...prev.cards, newCard],
        eventLogs: [...prev.eventLogs, `[Backlog] Replenished backlog with: "${newCard.title}" (Effort: A${effort.analysis}, D${effort.development}, T${effort.testing})`]
      };
    });
  }, []);

  // Fast Forward to Week's End
  const fastForwardToWeekEnd = useCallback(() => {
    setGameState(prev => {
      const currentDay = prev.day;
      const currentDayInWeek = currentDay % 5 === 0 ? 5 : currentDay % 5;
      const daysToAdvance = 5 - currentDayInWeek;
      if (daysToAdvance <= 0) return prev; // Already at week end

      const targetDay = currentDay + daysToAdvance;
      const completedCards = prev.cards.filter(c => c.columnId === 'done');
      const columnWIP: { [key: string]: number } = {};
      prev.columns.forEach(col => {
        columnWIP[col.id] = prev.cards.filter(c => c.columnId === col.id).length;
      });

      let totalCycleTime = 0;
      let totalLeadTime = 0;
      completedCards.forEach(c => {
        const lead = c.completedAt !== null ? c.completedAt - c.createdAt : 0;
        const cycle = c.completedAt !== null && c.startedAt !== null ? c.completedAt - c.startedAt : lead;
        totalLeadTime += lead;
        totalCycleTime += cycle;
      });

      const averageCycleTime = completedCards.length > 0 ? parseFloat((totalCycleTime / completedCards.length).toFixed(1)) : null;
      const averageLeadTime = completedCards.length > 0 ? parseFloat((totalLeadTime / completedCards.length).toFixed(1)) : null;

      const mockLogs: DailyLog[] = [];
      let lastCumulative = prev.dailyLogs.length > 0 ? prev.dailyLogs[prev.dailyLogs.length - 1].cumulativeThroughput : 0;

      for (let d = currentDay; d <= targetDay; d++) {
        mockLogs.push({
          day: d,
          columnWIP,
          throughput: 0,
          cumulativeThroughput: lastCumulative,
          averageCycleTime,
          averageLeadTime,
          wipLimitsActive: prev.wipLimitsActive,
          shiftLeftActive: prev.shiftLeftActive,
          swarmingActive: prev.swarmingActive,
          smallerBatchesActive: prev.smallerBatchesActive,
        });
      }

      const logs = [...prev.eventLogs, `--- Fast Forwarded from Day ${currentDay} to Day ${targetDay} (Week's End) ---`];

      return {
        ...prev,
        day: targetDay,
        dailyLogs: [...prev.dailyLogs, ...mockLogs],
        gamePhase: 'week_summary',
        eventLogs: logs
      };
    });
  }, []);

  // Inject custom urgent work (Expedite cards)
  const injectCustomExpediteCards = useCallback((titlePrefix: string, count: number) => {
    setGameState(prev => {
      const logs = [...prev.eventLogs, `[Alert] Injecting ${count} EXPEDITE cards: "${titlePrefix}" - Emergency work added by instructor.`];
      const newCardsList: Card[] = [];
      
      for (let i = 0; i < count; i++) {
        const id = `card_custom_expedite_${generateId()}_${i}`;
        const newCard: Card = {
          id,
          title: count > 1 ? `${titlePrefix} (Part ${i + 1}/${count})` : titlePrefix,
          description: `Emergency work injected by instructor. Critical response required immediately.`,
          type: 'expedite',
          columnId: 'ready',
          effort: { analysis: 0, development: 2, testing: 1 },
          remainingEffort: { analysis: 0, development: 2, testing: 1 },
          assignedAvatars: [],
          isBlocked: false,
          failedQACount: 0,
          createdAt: prev.day,
          completedAt: null,
          startedAt: null,
          history: [{ day: prev.day, columnId: 'ready' }]
        };
        newCardsList.push(newCard);
      }

      let updatedCards = [...prev.cards, ...newCardsList];

      // Auto block 50% of active development cards
      const devCards = updatedCards.filter(c => c.columnId === 'development' && !c.isBlocked);
      if (devCards.length > 0) {
        const countToBlock = Math.ceil(devCards.length / 2);
        let blockedCount = 0;
        updatedCards = updatedCards.map(card => {
          if (card.columnId === 'development' && !card.isBlocked && blockedCount < countToBlock) {
            blockedCount++;
            logs.push(`[Blocker] Card "${card.title}" has been BLOCKED to free up capacity for emergency response.`);
            return {
              ...card,
              isBlocked: true,
              blockerReason: 'Blocked due to system emergency response.'
            };
          }
          return card;
        });
      }

      return {
        ...prev,
        cards: updatedCards,
        eventLogs: logs
      };
    });
  }, []);

  // Split Epic Card
  const splitEpic = useCallback((epicId: string) => {
    setGameState(prev => {
      const epic = prev.cards.find(c => c.id === epicId);
      if (!epic) return prev;

      const child1Id = `card_${generateId()}_c1`;
      const child1: Card = {
        id: child1Id,
        title: `${epic.title} - Core Engine`,
        description: `Implement foundational backend core for: ${epic.title}`,
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 1, development: 4, testing: 2 },
        remainingEffort: { analysis: 1, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: prev.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: prev.day, columnId: 'ready' }],
        parentEpicId: epic.id
      };

      const child2Id = `card_${generateId()}_c2`;
      const child2: Card = {
        id: child2Id,
        title: `${epic.title} - UI Layout`,
        description: `Design and code user screens and layouts for: ${epic.title}`,
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 1, development: 4, testing: 2 },
        remainingEffort: { analysis: 1, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: prev.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: prev.day, columnId: 'ready' }],
        parentEpicId: epic.id
      };

      const child3Id = `card_${generateId()}_c3`;
      const child3: Card = {
        id: child3Id,
        title: `${epic.title} - Mock Payment`,
        description: `Add payment processing integration for: ${epic.title}`,
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 2, development: 4, testing: 2 },
        remainingEffort: { analysis: 2, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: prev.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: prev.day, columnId: 'ready' }],
        parentEpicId: epic.id
      };

      const logs = [...prev.eventLogs, `[Split] Epic "${epic.title}" split into 3 independent child stories.`];

      const updatedCards = prev.cards.map(c => {
        if (c.id === epicId) {
          return {
            ...c,
            columnId: 'epic_pool',
            isEpic: true,
            type: 'epic' as const,
            epicProgress: 0,
            childCardIds: [child1Id, child2Id, child3Id]
          };
        }
        return c;
      });

      return {
        ...prev,
        cards: [...updatedCards, child1, child2, child3],
        eventLogs: logs
      };
    });
  }, []);

  // Queue next event
  const queueEvent = useCallback((eventId: string | null) => {
    setGameState(prev => ({
      ...prev,
      nextEventId: eventId
    }));
  }, []);

  const dismissStartOfDayModal = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      showStartOfDayModal: false
    }));
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
    replenishBacklog,
    fastForwardToWeekEnd,
    injectCustomExpediteCards,
    splitEpic,
    queueEvent,
    dismissStartOfDayModal
  };
};
