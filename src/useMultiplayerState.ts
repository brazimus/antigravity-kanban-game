import { useState, useEffect, useCallback } from 'react';
import { 
  doc, 
  getDoc,
  onSnapshot, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { GameState, Card, Avatar, DailyLog, GameConfig } from './types';
import { defaultColumns } from './scenarios';

// Random card templates for manual backlog replenishment or dynamic events
const MULTIPLAYER_CARD_POOL = [
  { title: 'Optimize Database Indexing', description: 'Speed up user search queries by index profiling.' },
  { title: 'Implement OAuth (Google/GitHub)', description: 'Allow users to sign in using their social accounts.' },
  { title: 'Add PDF Invoicing Support', description: 'Enable billing modules to generate and email PDF receipts.' },
  { title: 'Refactor Payment Checkout API', description: 'Improve codebase readability and reliability for payments.' },
  { title: 'Design Admin User Management', description: 'Create dashboard view to search, block, and manage accounts.' },
  { title: 'Build Push Notification Service', description: 'Notify users in real-time about service status updates.' },
  { title: 'Configure CDN Asset Caching', description: 'Drastically improve LCP performance with edge caching.' },
  { title: 'Implement MFA login validation', description: 'Add TOTP multi-factor verification for security compliance.' },
  { title: 'Export Usage Reports as CSV', description: 'Allow enterprise customers to download audit data.' },
  { title: 'Optimize Image Upload Caching', description: 'Resize client-side image files before S3 upload.' },
  { title: 'Write OpenAPI Spec and Docs', description: 'Document all REST endpoints for external developer usage.' },
  { title: 'Set up E2E Playwright Tests', description: 'Add smoke testing on user login and checkout flows.' },
  { title: 'Localize Platform in Spanish', description: 'Translate UI copy and error strings for global outreach.' },
  { title: 'Fix CSS Grid Layout on Safari', description: 'Resolve flexbox wrap visual bugs on iOS devices.' }
];

export const useMultiplayerState = (roomCode: string | null, currentPlayerId: string | null, isAdmin: boolean, initialConfig?: GameConfig) => {
  const [gameState, setGameState] = useState<GameState>({
    day: 1,
    maxDays: 10,
    cards: [],
    columns: defaultColumns,
    avatars: [],
    dailyLogs: [],
    activeScenarioId: 'easy_mode',
    pairingAllowed: false,
    gamePhase: 'intro',
    rolledToday: false,
    currentDayEvent: null,
    eventLogs: [],
    wipLimitsActive: false,
    shiftLeftActive: false,
    swarmingActive: false,
    smallerBatchesActive: false
  });

  const [loading, setLoading] = useState(true);

  // Helper to generate IDs
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Create a Brand New Game Session (Admin Only)
  const createRoom = useCallback(async (scenarioId: string, customConfig?: GameConfig) => {
    if (!roomCode) return;

    const finalConfig: GameConfig = customConfig || initialConfig || {
      maxDays: 10,
      blockerChance: 0.15,
      qaFailChanceUnpaired: 0.20,
      qaFailChancePaired: 0.02,
      unblockCost: 2,
      pairingHelpCost: 2,
      selfTestingMultiplier: 2.0
    };

    const gameDocRef = doc(db, 'games', roomCode);
    const initialCards: Card[] = [
      {
        id: `card_${generateId()}_1`,
        title: 'User Login & Auth',
        description: 'Implement secure JWT login for users.',
        type: 'standard',
        columnId: 'analysis',
        effort: { analysis: 2, development: 4, testing: 2 },
        remainingEffort: { analysis: 2, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: 1,
        completedAt: null,
        startedAt: 1,
        history: [{ day: 1, columnId: 'analysis' }]
      },
      {
        id: `card_${generateId()}_2`,
        title: 'Database Schema Setup',
        description: 'Create postgres tables for users and items.',
        type: 'standard',
        columnId: 'analysis',
        effort: { analysis: 1, development: 3, testing: 1 },
        remainingEffort: { analysis: 1, development: 3, testing: 1 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: 1,
        completedAt: null,
        startedAt: 1,
        history: [{ day: 1, columnId: 'analysis' }]
      },
      {
        id: `card_${generateId()}_3`,
        title: 'Landing Page Layout',
        description: 'Design and code the hero section and styling.',
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 2, development: 2, testing: 1 },
        remainingEffort: { analysis: 2, development: 2, testing: 1 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: 1,
        completedAt: null,
        startedAt: null,
        history: [{ day: 1, columnId: 'ready' }]
      },
      {
        id: `card_${generateId()}_4`,
        title: 'API Gateway Proxy',
        description: 'Configure routing for backend services.',
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 3, development: 5, testing: 2 },
        remainingEffort: { analysis: 3, development: 5, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: 1,
        completedAt: null,
        startedAt: null,
        history: [{ day: 1, columnId: 'ready' }]
      }
    ];

    const batch = writeBatch(db);

    // Save Game Doc
    batch.set(gameDocRef, {
      adminId: auth.currentUser?.uid,
      day: 1,
      maxDays: finalConfig.maxDays,
      gamePhase: 'day_start',
      status: 'active',
      activeScenarioId: scenarioId,
      pairingAllowed: false,
      dailyLogs: [],
      currentDayEvent: {
        title: 'Project Kickoff (Day 1)',
        description: 'Welcome to the team! Instructor coordinates the days. There are no WIP limits yet. Try to get as many cards as possible into Development to start working!'
      },
      nextEventId: null,
      eventLogs: ['--- Project Started in Multiplayer Mode ---'],
      config: finalConfig,
      createdAt: Date.now(),
      wipLimitsActive: false,
      shiftLeftActive: false,
      swarmingActive: false,
      smallerBatchesActive: false
    });

    // Save Initial Cards
    initialCards.forEach(c => {
      const cardRef = doc(db, 'games', roomCode, 'cards', c.id);
      batch.set(cardRef, c);
    });

    await batch.commit();
  }, [roomCode, initialConfig]);

  /**
   * REAL-TIME SYNCHRONIZATION EVENT LOOPS (Analogous to continuous database cursors)
   * 
   * This hook sets up real-time event listener handles (onSnapshot) connecting to the Firebase
   * reactive document store. Think of this as opening three active continuous database cursors 
   * that automatically stream changes into the client-side state hash ($gameState in React) 
   * whenever a transaction commits on the remote server.
   * 
   * To prevent socket leaks and resource exhaustion (vital to stay in the free Spark Tier),
   * this hook returns a cleanup callback that closes all listener handles when this component
   * is unmounted (equivalent to closing open file descriptors or cursor handles).
   */
  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const gameDocRef = doc(db, 'games', roomCode);
    const playersColRef = collection(db, 'games', roomCode, 'players');
    const cardsColRef = collection(db, 'games', roomCode, 'cards');

    // Subscribe to Main Game Document
    const unsubGame = onSnapshot(gameDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const wipActive = data.wipLimitsActive || false;
        setGameState(prev => {
          const updatedColumns = prev.columns.map(col => {
            if (wipActive) {
              if (col.id === 'analysis') return { ...col, wipLimit: 2 };
              if (col.id === 'development') return { ...col, wipLimit: 2 };
              if (col.id === 'testing') return { ...col, wipLimit: 1 };
            }
            return { ...col, wipLimit: null };
          });
          return {
            ...prev,
            day: data.day || 1,
            maxDays: data.maxDays || 10,
            gamePhase: data.gamePhase || 'day_start',
            activeScenarioId: data.activeScenarioId || 'easy_mode',
            pairingAllowed: data.pairingAllowed || false,
            dailyLogs: data.dailyLogs || [],
            currentDayEvent: data.currentDayEvent || null,
            eventLogs: data.eventLogs || [],
            wipLimitsActive: wipActive,
            shiftLeftActive: data.shiftLeftActive || false,
            swarmingActive: data.swarmingActive || false,
            smallerBatchesActive: data.smallerBatchesActive || false,
            config: data.config || undefined,
            columns: updatedColumns
          };
        });
      } else if (isAdmin) {
        // Document does not exist and current user is admin, initialize the room
        try {
          await createRoom('easy_mode', initialConfig);
        } catch (err) {
          console.error("Auto room creation failed:", err);
        }
      }
    });

    // Subscribe to Players subcollection
    const unsubPlayers = onSnapshot(playersColRef, (snap) => {
      const playersList: Avatar[] = [];
      snap.forEach(docSnap => {
        const p = docSnap.data();
        playersList.push({
          id: p.id,
          name: p.name,
          color: p.color,
          currentRoll: p.currentRoll || null,
          remainingCapacity: p.remainingCapacity ?? 0,
          workedOnCardIdsToday: p.workedOnCardIdsToday || [],
          assignedCardId: p.assignedCardId || null,
          previousCardId: p.previousCardId || null,
          spentCapacity: p.spentCapacity || 0
        });
      });

      setGameState(prev => {
        // Determine if current player has rolled today
        const me = playersList.find(p => p.id === currentPlayerId);
        const rolledToday = me ? me.currentRoll !== null : false;
        return {
          ...prev,
          avatars: playersList,
          rolledToday
        };
      });
      setLoading(false);
    });

    // Subscribe to Cards subcollection
    const unsubCards = onSnapshot(cardsColRef, (snap) => {
      const cardsList: Card[] = [];
      snap.forEach(docSnap => {
        const c = docSnap.data() as Card;
        cardsList.push(c);
      });

      // Reactively rollup Epic progress (Admin Only)
      if (isAdmin && roomCode) {
        (async () => {
          const epics = cardsList.filter(c => c.isEpic || c.type === 'epic');
          for (const epic of epics) {
            const children = cardsList.filter(c => c.parentEpicId === epic.id);
            if (children.length > 0) {
              const completed = children.filter(c => c.columnId === 'done').length;
              const progress = Math.round((completed / children.length) * 100);
              
              if (progress !== (epic.epicProgress || 0)) {
                const epicRef = doc(db, 'games', roomCode, 'cards', epic.id);
                const updates: any = { epicProgress: progress };
                
                if (progress === 100 && epic.columnId !== 'done') {
                  updates.columnId = 'done';
                  updates.completedAt = gameState.day;
                  updates.history = [...(epic.history || []), { day: gameState.day, columnId: 'done' }];
                }
                
                try {
                  await updateDoc(epicRef, updates);
                } catch (e) {
                  console.error("Failed to update parent epic progress:", e);
                }
              }
            }
          }
        })();
      }

      setGameState(prev => ({ ...prev, cards: cardsList }));
    });

    return () => {
      unsubGame();
      unsubPlayers();
      unsubCards();
    };
  }, [roomCode, currentPlayerId, isAdmin, createRoom]);

  // Roll Capacity Dice (Player Only)
  const rollDice = useCallback(async () => {
    if (!roomCode || !currentPlayerId) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const playerRef = doc(db, 'games', roomCode, 'players', currentPlayerId);
    
    await updateDoc(playerRef, {
      currentRoll: roll,
      remainingCapacity: roll,
      allocationsToday: {} // Clear past allocations tracking
    });

    // Check if all players have rolled to progress phase (optional state update)
    const playersColRef = collection(db, 'games', roomCode, 'players');
    const playersSnap = await getDocs(playersColRef);
    let allRolled = true;
    playersSnap.forEach(pSnap => {
      const p = pSnap.data();
      if (p.id !== currentPlayerId && !p.currentRoll) {
        allRolled = false;
      }
    });

    if (allRolled) {
      await updateDoc(doc(db, 'games', roomCode), {
        gamePhase: 'dice_rolled'
      });
    }
  }, [roomCode, currentPlayerId]);

  /**
   * ATOMIC TRANSACTION BLOCK: Allocate Capacity (ACID Serializable transaction isolation)
   * 
   * Analogous to:
   *   BEGIN TRANSACTION
   *     SELECT remainingCapacity FROM players WHERE id = ... HOLDLOCK;
   *     SELECT remainingEffort FROM cards WHERE id = ... HOLDLOCK;
   *     -- Perform calculations in memory
   *     UPDATE players SET ...
   *     UPDATE cards SET ...
   *   COMMIT
   * 
   * Why a transaction? In a multi-user environment, two students might try to allocate capacity to the
   * same card simultaneously. If we used standard asynchronous updates, we could get race conditions.
   * Firestore transactions enforce optimistic concurrency controls (OCC): it reads both documents, 
   * calculates the delta, and commits writes ONLY if the documents were not modified in the meantime.
   * If a concurrent modification occurs, the transaction automatically rolls back and retries.
   */
  const allocateCapacity = useCallback(async (avatarId: string, cardId: string, effortType?: 'analysis' | 'development' | 'testing') => {
    if (!roomCode || !currentPlayerId) return;
    if (avatarId !== currentPlayerId) return; // Can only spend own capacity!

    const playerRef = doc(db, 'games', roomCode, 'players', currentPlayerId);
    const cardRef = doc(db, 'games', roomCode, 'cards', cardId);
    const gameRef = doc(db, 'games', roomCode);

    try {
      // Fetch all card docs to enforce the Expedite Urgency Constraint
      const cardsColRef = collection(db, 'games', roomCode, 'cards');
      const cardsSnap = await getDocs(cardsColRef);
      const cardsList: Card[] = [];
      cardsSnap.forEach(snap => cardsList.push(snap.data() as Card));

      await runTransaction(db, async (transaction) => {
        const playerSnap = await transaction.get(playerRef);
        const cardSnap = await transaction.get(cardRef);
        const gameSnap = await transaction.get(gameRef);

        if (!playerSnap.exists() || !cardSnap.exists() || !gameSnap.exists()) return;

        const player = playerSnap.data();
        const card = cardSnap.data() as Card;
        const game = gameSnap.data();

        // 1. Expedite Urgency Constraint
        if (card.type !== 'epic' && card.type !== 'expedite') {
          const hasExpediteInColumn = cardsList.some(
            c => c.columnId === card.columnId && 
                 c.type === 'expedite' && 
                 ((c.remainingEffort.analysis || 0) > 0 || (c.remainingEffort.development || 0) > 0 || (c.remainingEffort.testing || 0) > 0)
          );
          if (hasExpediteInColumn) {
            // Block allocation
            const gameLogs = [...game.eventLogs, `[Blocked] Cannot work on standard card "${card.title}" while an EXPEDITE card is active in the ${card.columnId.toUpperCase()} column.`];
            transaction.update(gameRef, { eventLogs: gameLogs });
            return;
          }
        }

        // 2. Identify active effort phase
        const activeColumn = defaultColumns.find(col => col.id === card.columnId);
        if (!activeColumn) return;

        // Determine allowed effort types based on Shift-Left
        const allowedEfforts = game.shiftLeftActive && card.columnId === 'development'
          ? ['development', 'testing']
          : activeColumn.allowedEffortTypes;

        let activeEffortType = effortType;
        if (!activeEffortType) {
          activeEffortType = allowedEfforts.find(
            type => (card.remainingEffort[type] || 0) > 0
          ) as 'analysis' | 'development' | 'testing';
        }

        if (!activeEffortType || !allowedEfforts.includes(activeEffortType)) return;

        const effortRemaining = card.remainingEffort[activeEffortType] || 0;
        if (effortRemaining <= 0) return; // already completed stage

        // 3. Context Switching Cost calculation
        const workedOnOthers = (player.workedOnCardIdsToday || []).filter((id: string) => id !== cardId);
        const isSwitch = workedOnOthers.length > 0 || (player.workedOnCardIdsToday.length === 0 && player.previousCardId !== null && player.previousCardId !== cardId);
        let penalty = isSwitch ? 1 : 0;
        
        // Swarming Accelerator: context switch penalty is 0
        if (game.swarmingActive) {
          penalty = 0;
        }

        const netCapacity = player.remainingCapacity - penalty;
        if (netCapacity <= 0) return; // No capacity left after penalty

        // 4. Pairing calculation
        const isHelper = card.assignedAvatars.length > 0 && !card.assignedAvatars.includes(avatarId);
        let progressPoints = 0;
        let capacitySpent = 0;

        const configUnblockCost = game.config?.unblockCost ?? 2;
        const configPairingCost = game.config?.pairingHelpCost ?? 2;

        if (card.isBlocked) {
          // If blocked, student spends unblockCost to generate 1 point of progress (clears blocker)
          if (netCapacity >= configUnblockCost) {
            progressPoints = 1;
            capacitySpent = configUnblockCost + penalty;
          }
        } else if (isHelper) {
          // Helper spends pairingHelpCost points to generate 1 progress point
          if (netCapacity >= configPairingCost && (game.pairingAllowed || game.wipLimitsActive)) {
            progressPoints = 1;
            capacitySpent = configPairingCost + penalty;
          }
        } else {
          // Standard: 1 capacity spent = 1 effort point progressed
          progressPoints = Math.min(netCapacity, effortRemaining);
          capacitySpent = progressPoints + penalty;
        }

        if (capacitySpent === 0) return;

        // 5. Update data structures
        const updatedRemainingEffort = { ...card.remainingEffort };
        let wasUnblocked = false;

        if (card.isBlocked) {
          card.isBlocked = false;
          wasUnblocked = true;
        } else {
          updatedRemainingEffort[activeEffortType] = Math.max(0, effortRemaining - progressPoints);
        }

        const newRemainingCapacity = player.remainingCapacity - capacitySpent;
        const newWorkedOnCardIds = Array.from(new Set([...(player.workedOnCardIdsToday || []), cardId]));
        const allocations = player.allocationsToday || {};
        allocations[cardId] = (allocations[cardId] || 0) + progressPoints;

        // Verify if card is now assigned to this avatar
        const newAssignedAvatars = Array.from(new Set([...card.assignedAvatars, currentPlayerId]));

        const developedBy = Array.from(new Set([...(card.developedBy || []), ...(activeEffortType === 'development' ? [currentPlayerId] : [])]));
        const testedBy = Array.from(new Set([...(card.testedBy || []), ...(activeEffortType === 'testing' ? [currentPlayerId] : [])]));

        // Check QA Failures if testing completed (bypassed if Shift-Left is active)
        let qaLogs = '';
        let targetColumnId = card.columnId;
        let targetHistory = card.history || [];
        let finalAssignedAvatars = newAssignedAvatars;

        if (activeEffortType === 'testing' && updatedRemainingEffort.testing === 0) {
          if (game.shiftLeftActive) {
            // Built-in quality: QA rework completely bypassed
          } else {
            const qaFailChanceUnpaired = game.config?.qaFailChanceUnpaired ?? 0.20;
            const qaFailChancePaired = game.config?.qaFailChancePaired ?? 0.02;
            const isPaired = newAssignedAvatars.length > 1;
            const baseChance = isPaired ? qaFailChancePaired : qaFailChanceUnpaired;

            const overlap = developedBy.filter(devId => testedBy.includes(devId));
            const isSelfTesting = overlap.length > 0;
            const selfTestingMultiplier = game.config?.selfTestingMultiplier ?? 2.0;
            const qaChance = isSelfTesting ? Math.min(1.0, baseChance * selfTestingMultiplier) : baseChance;

            if (Math.random() < qaChance) {
              updatedRemainingEffort.development = card.effort.development || 2; // Reset dev effort
              updatedRemainingEffort.testing = card.effort.testing || 1; // Reset test effort
              card.failedQACount += 1;
              targetColumnId = 'development';
              targetHistory = [...(card.history || []), { day: game.day, columnId: 'development' }];
              finalAssignedAvatars = []; // Reset assignments so they don't carry over
              qaLogs = ` [QA Failure] Card "${card.title}" failed QA tests and requires developer rework!`;
              if (isSelfTesting) {
                qaLogs += ` (Self-tested penalty applied: failure rate was ${(qaChance * 100).toFixed(0)}%)`;
              }
            }
          }
        }

        // If child card is completed, check if parent Epic progress needs rollup
        let epicLogs = '';
        if (card.parentEpicId && Object.values(updatedRemainingEffort).reduce((a, b) => a + b, 0) === 0) {
          // Child card completed! We will calculate parent epic completion in onSnapshot subscriber reactively,
          // but we can log it here.
          epicLogs = ` [Epic Progress] Child story "${card.title}" completed.`;
        }

        // Apply writes to transaction
        transaction.update(playerRef, {
          remainingCapacity: newRemainingCapacity,
          workedOnCardIdsToday: newWorkedOnCardIds,
          assignedCardId: cardId,
          allocationsToday: allocations
        });

        transaction.update(cardRef, {
          columnId: targetColumnId,
          history: targetHistory,
          remainingEffort: updatedRemainingEffort,
          assignedAvatars: finalAssignedAvatars,
          isBlocked: card.isBlocked,
          failedQACount: card.failedQACount,
          developedBy,
          testedBy
        });

        // Add log entry
        let logMsg = `[Work] ${player.name} spent ${capacitySpent} capacity points on "${card.title}" (${activeEffortType.toUpperCase()})`;
        if (isSwitch && !game.swarmingActive) logMsg += ` (-1 context penalty applied)`;
        if (game.swarmingActive && isSwitch) logMsg += ` (swarmed - context penalty bypassed)`;
        if (wasUnblocked) logMsg += ` [Success] Unblocked card!`;
        if (qaLogs) logMsg += qaLogs;
        if (epicLogs) logMsg += epicLogs;

        transaction.update(gameRef, {
          eventLogs: [...game.eventLogs, logMsg]
        });
      });
    } catch (err) {
      console.error('Capacity allocation transaction failed:', err);
    }
  }, [roomCode, currentPlayerId]);

  // Undo player allocations today (Player Only - Reverts own work without resetting others)
  const resetDailyWork = useCallback(async () => {
    if (!roomCode || !currentPlayerId) return;

    const playerRef = doc(db, 'games', roomCode, 'players', currentPlayerId);
    const gameRef = doc(db, 'games', roomCode);

    try {
      await runTransaction(db, async (transaction) => {
        const playerSnap = await transaction.get(playerRef);
        if (!playerSnap.exists()) return;

        const player = playerSnap.data();
        const allocations = player.allocationsToday || {};
        
        // Revert card effort points contributed by this player
        for (const cardId of Object.keys(allocations)) {
          const cardRef = doc(db, 'games', roomCode, 'cards', cardId);
          const cardSnap = await transaction.get(cardRef);
          
          if (cardSnap.exists()) {
            const card = cardSnap.data() as Card;
            const activeColumn = defaultColumns.find(col => col.id === card.columnId);
            const activeEffortType = activeColumn?.allowedEffortTypes[0];

            if (activeEffortType) {
              const updatedRemainingEffort = { ...card.remainingEffort };
              // Restore the effort allocated by this player
              updatedRemainingEffort[activeEffortType] = Math.min(
                card.effort[activeEffortType], 
                (card.remainingEffort[activeEffortType] || 0) + allocations[cardId]
              );
              
              // Remove player from assigned avatars list if they are done reverting
              const newAssignedAvatars = card.assignedAvatars.filter(id => id !== currentPlayerId);

              transaction.update(cardRef, {
                remainingEffort: updatedRemainingEffort,
                assignedAvatars: newAssignedAvatars
              });
            }
          }
        }

        // Reset player document capacities
        transaction.update(playerRef, {
          remainingCapacity: player.currentRoll || 0,
          workedOnCardIdsToday: [],
          assignedCardId: null,
          allocationsToday: {}
        });

        // Add log
        const gameSnap = await transaction.get(gameRef);
        if (gameSnap.exists()) {
          transaction.update(gameRef, {
            eventLogs: [...gameSnap.data().eventLogs, `[Undo] ${player.name} reverted their capacity allocations today.`]
          });
        }
      });
    } catch (err) {
      console.error('Reset daily work transaction failed:', err);
    }
  }, [roomCode, currentPlayerId]);

  // Move Card between Columns (Any Role can move, but Admin usually coordinates)
  const moveCard = useCallback(async (cardId: string, targetColumnId: string) => {
    if (!roomCode) return { success: false, errorMessage: 'No active room.' };

    const cardRef = doc(db, 'games', roomCode, 'cards', cardId);
    const gameRef = doc(db, 'games', roomCode);

    try {
      const cardSnap = await getDocs(collection(db, 'games', roomCode, 'cards'));
      const activeCards: Card[] = [];
      cardSnap.forEach(snap => activeCards.push(snap.data() as Card));

      const card = activeCards.find(c => c.id === cardId);
      if (!card) return { success: false, errorMessage: 'Card not found.' };

      // WIP Limit checks for the target column
      const targetColumn = defaultColumns.find(col => col.id === targetColumnId);
      const targetWipLimit = gameState.columns.find(col => col.id === targetColumnId)?.wipLimit || null;

      if (targetWipLimit !== null) {
        const count = activeCards.filter(c => c.columnId === targetColumnId).length;
        // Check if expedite card (exempt from WIP limit)
        if (card.type !== 'expedite' && count >= targetWipLimit) {
          return { 
            success: false, 
            errorMessage: `Cannot move card. WIP Limit for "${targetColumn?.name}" is ${targetWipLimit} and is already reached.` 
          };
        }
      }

      const updatedHistory = [...card.history, { day: gameState.day, columnId: targetColumnId }];
      const startedAt = card.startedAt === null && targetColumnId !== 'backlog' && targetColumnId !== 'ready'
        ? gameState.day
        : card.startedAt;
      const completedAt = targetColumnId === 'done' ? gameState.day : card.completedAt;

      // Update Card Doc
      await updateDoc(cardRef, {
        columnId: targetColumnId,
        history: updatedHistory,
        startedAt,
        completedAt,
        assignedAvatars: [] // Clear developers on transition
      });

      // Update log
      const gameSnap = await getDoc(gameRef);
      if (gameSnap.exists()) {
        const sourceColName = defaultColumns.find(c => c.id === card.columnId)?.name || card.columnId;
        const targetColName = targetColumn?.name || targetColumnId;
        await updateDoc(gameRef, {
          eventLogs: [
            ...gameSnap.data().eventLogs, 
            `[Move] Card "${card.title}" moved from ${sourceColName} to ${targetColName}.`
          ]
        });
      }

      return { success: true, errorMessage: '' };
    } catch (err: any) {
      console.error(err);
      return { success: false, errorMessage: err.message || 'Failed to move card.' };
    }
  }, [roomCode, gameState.day, gameState.columns]);

  // Replenish Backlog (Admin Only)
  const replenishBacklog = useCallback(async () => {
    if (!roomCode || !isAdmin) return;

    const gameRef = doc(db, 'games', roomCode);

    try {
      const poolIndex = Math.floor(Math.random() * MULTIPLAYER_CARD_POOL.length);
      const template = MULTIPLAYER_CARD_POOL[poolIndex];

      const effort = {
        analysis: Math.floor(Math.random() * 3) + 1,
        development: Math.floor(Math.random() * 5) + 2,
        testing: Math.floor(Math.random() * 3) + 1
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
        createdAt: gameState.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: gameState.day, columnId: 'backlog' }]
      };

      // Save to Cards Subcollection
      await setDoc(doc(db, 'games', roomCode, 'cards', newCardId), newCard);

      // Log in main doc
      const gameSnap = await getDoc(gameRef);
      if (gameSnap.exists()) {
        await updateDoc(gameRef, {
          eventLogs: [
            ...gameSnap.data().eventLogs, 
            `[Backlog] Replenished backlog with: "${newCard.title}" (Effort: A${effort.analysis}, D${effort.development}, T${effort.testing})`
          ]
        });
      }
    } catch (err) {
      console.error('Replenish backlog failed:', err);
    }
  }, [roomCode, isAdmin, gameState.day]);

  // Progress to Day Summary Phase (Admin Only)
  const endDay = useCallback(async () => {
    if (!roomCode || !isAdmin) return;

    const gameDocRef = doc(db, 'games', roomCode);
    const cardsColRef = collection(db, 'games', roomCode, 'cards');

    try {
      // 1. Gather all active cards to compute log metrics
      const cardsSnap = await getDocs(cardsColRef);
      const activeCards: Card[] = [];
      cardsSnap.forEach(snap => activeCards.push(snap.data() as Card));

      const completedCards = activeCards.filter(c => c.columnId === 'done');
      
      // Calculate column distributions
      const columnWIP: { [key: string]: number } = {};
      defaultColumns.forEach(col => {
        columnWIP[col.id] = activeCards.filter(c => c.columnId === col.id).length;
      });

      // Throughput count today
      const todayThroughput = completedCards.filter(c => c.completedAt === gameState.day).length;
      const cumulativeThroughput = completedCards.length;

      // Cycle times
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

      const newLog: DailyLog = {
        day: gameState.day,
        columnWIP,
        throughput: todayThroughput,
        cumulativeThroughput,
        averageCycleTime,
        averageLeadTime,
        wipLimitsActive: gameState.wipLimitsActive,
        shiftLeftActive: gameState.shiftLeftActive,
        swarmingActive: gameState.swarmingActive,
        smallerBatchesActive: gameState.smallerBatchesActive,
      };

      const gameSnap = await getDoc(gameDocRef);
      if (gameSnap.exists()) {
        const gameData = gameSnap.data();
        const batch = writeBatch(db);

        // Blocker checks for active cards that had work applied today
        const blockerChance = gameData.config?.blockerChance ?? 0.15;
        const isOSUpgradeActive = gameData.currentDayEvent?.title.includes('OS Upgrade');
        // If OS upgrade is active and it's within the first 3 days of the week, blocker risk increases to 30%
        const currentDayInWeek = (gameState.day % 5) === 0 ? 5 : (gameState.day % 5);
        const finalBlockerChance = (isOSUpgradeActive && currentDayInWeek <= 3) ? 0.30 : blockerChance;

        let blockerLogs: string[] = [];
        activeCards.forEach(card => {
          const workedOnToday = card.assignedAvatars.length > 0;
          const isWorking = card.columnId !== 'backlog' && card.columnId !== 'ready' && card.columnId !== 'done' && card.columnId !== 'epic_pool';
          
          if (workedOnToday && isWorking && !card.isBlocked) {
            const isPaired = card.assignedAvatars.length > 1;
            const roll1 = Math.random();
            const roll2 = isPaired ? Math.random() : 0.0;

            if (roll1 < finalBlockerChance && roll2 < finalBlockerChance) {
              blockerLogs.push(`[Blocker] Oh no! "${card.title}" got blocked by a quality bug.`);
              const cardRef = doc(db, 'games', roomCode, 'cards', card.id);
              batch.update(cardRef, {
                isBlocked: true,
                blockerReason: 'Quality defect: Code refactor required.'
              });
            } else if (roll1 < finalBlockerChance && isPaired) {
              blockerLogs.push(`[Pairing Save] A blocker check on "${card.title}" failed, but was avoided due to paired quality validation!`);
            }
          }
        });

        // Determine if next day would start weekend summary
        const isWeekend = gameState.day % 5 === 0;
        const targetPhase = isWeekend ? 'week_summary' : 'day_summary';

        const logs = [
          ...(gameData.dailyLogs || []),
          newLog
        ];
        
        batch.update(gameDocRef, {
          dailyLogs: logs,
          gamePhase: targetPhase,
          eventLogs: [
            ...gameData.eventLogs,
            ...blockerLogs,
            `--- End of Day ${gameState.day} Summary: Completed ${todayThroughput} cards ---`
          ]
        });

        await batch.commit();
      }
    } catch (err) {
      console.error('End day failed:', err);
    }
  }, [roomCode, isAdmin, gameState.day]);

  // Start Next Day & Trigger Queued Scenarios (Admin Only)
  const startNextDay = useCallback(async (scenarioIdOrAcc?: string | {
    wipLimitsActive?: boolean;
    shiftLeftActive?: boolean;
    swarmingActive?: boolean;
    smallerBatchesActive?: boolean;
  }) => {
    if (!roomCode || !isAdmin) return;

    const nextDay = gameState.day + 1;
    const gameDocRef = doc(db, 'games', roomCode);
    const playersColRef = collection(db, 'games', roomCode, 'players');
    const cardsColRef = collection(db, 'games', roomCode, 'cards');

    try {
      const gameSnap = await getDoc(gameDocRef);
      if (!gameSnap.exists()) return;

      const gameData = gameSnap.data();
      let pairingAllowed = gameData.pairingAllowed || false;
      let nextEvent = null;

      // Extract new or current accelerator toggles
      let lastSelectedScenarioId = gameData.lastSelectedScenarioId || null;
      let nextEventId = gameData.nextEventId || null;

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
        pairingAllowed = wipLimitsActive;
      } else if (scenarioIdOrAcc && typeof scenarioIdOrAcc === 'object') {
        wipLimitsActive = !!scenarioIdOrAcc.wipLimitsActive;
        shiftLeftActive = !!scenarioIdOrAcc.shiftLeftActive;
        swarmingActive = !!scenarioIdOrAcc.swarmingActive;
        smallerBatchesActive = !!scenarioIdOrAcc.smallerBatchesActive;
        pairingAllowed = wipLimitsActive;
      } else {
        wipLimitsActive = gameData.wipLimitsActive || false;
        shiftLeftActive = gameData.shiftLeftActive || false;
        swarmingActive = gameData.swarmingActive || false;
        smallerBatchesActive = gameData.smallerBatchesActive || false;
      }


      // Reset columns limits locally
      let columnsWipConfig = [...gameState.columns];
      if (wipLimitsActive) {
        columnsWipConfig = columnsWipConfig.map(col => {
          if (col.id === 'analysis') return { ...col, wipLimit: 2 };
          if (col.id === 'development') return { ...col, wipLimit: 2 };
          if (col.id === 'testing') return { ...col, wipLimit: 1 };
          return col;
        });
      } else {
        columnsWipConfig = columnsWipConfig.map(col => ({ ...col, wipLimit: null }));
      }

      let logs = [...gameData.eventLogs, `--- Starting Day ${nextDay} ---`];

      // Reset players capacities in Firestore
      const playersSnap = await getDocs(playersColRef);
      const batch = writeBatch(db);

      playersSnap.forEach(pDoc => {
        batch.update(pDoc.ref, {
          currentRoll: null,
          remainingCapacity: 0,
          workedOnCardIdsToday: [],
          assignedCardId: null,
          allocationsToday: {}
        });
      });

      // Shift-Left column migration check
      if (shiftLeftActive && !gameData.shiftLeftActive) {
        const cardsSnap = await getDocs(cardsColRef);
        cardsSnap.forEach(cardDoc => {
          const c = cardDoc.data() as Card;
          if (c.columnId === 'testing') {
            const updatedRemainingEffort = { ...c.remainingEffort };
            updatedRemainingEffort.development = c.effort.development; // Reset dev effort to full
            
            batch.update(cardDoc.ref, {
              columnId: 'development',
              remainingEffort: updatedRemainingEffort,
              history: [...(c.history || []), { day: gameState.day, columnId: 'development' }]
            });
            logs.push(`[Shift-Left Migration] Card "${c.title}" moved back from Testing to Development with full Development effort, keeping Testing progress.`);
          }
        });
      }

      // Handle custom triggered scenario events selected by admin
      if (nextEventId) {
        if (nextEventId === 'wip_limits') {
          wipLimitsActive = true;
          pairingAllowed = true;
          columnsWipConfig = columnsWipConfig.map(col => {
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
          // Add urgent expedite card
          const hotfixId = `card_hotfix_${generateId()}`;
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
          batch.set(doc(db, 'games', roomCode, 'cards', hotfixId), hotfix);

          nextEvent = {
            title: 'Critical Outage: Payment Failure',
            description: 'An urgent Production Hotfix card has arrived in the Ready column. It is marked EXPEDITE and is allowed to bypass WIP limits. Get all hands on deck!'
          };
          logs.push(`[Alert] PRODUCTION OUTAGE! Expedite hotfix card added to the Ready column.`);
        } else if (nextEventId === 'tech_debt') {
          nextEvent = {
            title: 'Technical Debt Instability',
            description: 'System degradation has occurred. Developers are fighting server issues. Dice rolls for capacity are capped to a maximum of 4 today due to technical debt.'
          };
          logs.push(`[Alert] System degradation active: developer capacity rolls capped due to legacy debt.`);
        } else if (nextEventId === 'blocker') {
          // Block a random dev card
          const cardsSnap = await getDocs(cardsColRef);
          const devCards: Card[] = [];
          cardsSnap.forEach(snap => {
            const c = snap.data() as Card;
            if (c.columnId === 'development' && !c.isBlocked) {
              devCards.push(c);
            }
          });

          if (devCards.length > 0) {
            const randCard = devCards[Math.floor(Math.random() * devCards.length)];
            batch.update(doc(db, 'games', roomCode, 'cards', randCard.id), {
              isBlocked: true,
              blockerReason: 'External dependency offline.'
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
          if (smallerBatchesActive) {
            // Spawn 3 child cards
            const epicId = `epic_tradeshow_${generateId()}`;
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
              childCardIds: []
            };

            const child1Id = `${epicId}_c1`;
            const child1: Card = {
              id: child1Id,
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

            const child2Id = `${epicId}_c2`;
            const child2: Card = {
              id: child2Id,
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

            const child3Id = `${epicId}_c3`;
            const child3: Card = {
              id: child3Id,
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

            epic.childCardIds = [child1Id, child2Id, child3Id];

            batch.set(doc(db, 'games', roomCode, 'cards', epicId), epic);
            batch.set(doc(db, 'games', roomCode, 'cards', child1Id), child1);
            batch.set(doc(db, 'games', roomCode, 'cards', child2Id), child2);
            batch.set(doc(db, 'games', roomCode, 'cards', child3Id), child3);

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
            const epicId = `epic_tradeshow_${generateId()}`;
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

            batch.set(doc(db, 'games', roomCode, 'cards', epicId), epic);

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
          logs.push(`[Event] Ingested mandatory Client OS Upgrade: developers have capacity capped and increased blocker risk.`);
        }
      }

      // Day 2 trade show capacity modifier carry-over check
      if (!nextEvent && (nextDay % 5 === 2) && gameData.currentDayEvent?.title.includes('Trade Show')) {
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
      if (!nextEvent && ((nextDay % 5 === 2) || (nextDay % 5 === 3)) && gameData.currentDayEvent?.title.includes('Client OS Upgrade')) {
        nextEvent = {
          title: 'Client OS Upgrade - Environment Drift',
          description: 'Laptops updated, but environments are unstable. Blocker risk remains at 30% today.'
        };
      }

      // Clear card assignments (so we start fresh today)
      const cardsSnap = await getDocs(cardsColRef);
      cardsSnap.forEach(cardDoc => {
        batch.update(cardDoc.ref, {
          assignedAvatars: []
        });
      });

      // Commit player resets and card updates
      await batch.commit();

      // Update main game doc
      await updateDoc(gameDocRef, {
        day: nextDay,
        gamePhase: nextDay > (gameData.config?.maxDays ?? 10) ? 'game_over' : 'day_start',
        pairingAllowed,
        currentDayEvent: nextEvent,
        nextEventId: null, // Reset event trigger queue
        eventLogs: logs,
        wipLimitsActive,
        shiftLeftActive,
        swarmingActive,
        smallerBatchesActive,
        lastSelectedScenarioId
      });

    } catch (err) {
      console.error('Start next day failed:', err);
    }
  }, [roomCode, isAdmin, gameState.day, gameState.columns]);

  // Trigger an event for the next day transition (Admin Only)
  const queueEvent = useCallback(async (eventId: string | null) => {
    if (!roomCode || !isAdmin) return;

    await updateDoc(doc(db, 'games', roomCode), {
      nextEventId: eventId
    });
  }, [roomCode, isAdmin]);

  // Fast Forward to Week's End (Admin Only)
  const fastForwardToWeekEnd = useCallback(async () => {
    if (!roomCode || !isAdmin) return;

    const gameDocRef = doc(db, 'games', roomCode);
    const cardsColRef = collection(db, 'games', roomCode, 'cards');

    try {
      const gameSnap = await getDoc(gameDocRef);
      if (!gameSnap.exists()) return;

      const gameData = gameSnap.data();
      const currentDay = gameData.day;
      
      const currentDayInWeek = currentDay % 5 === 0 ? 5 : currentDay % 5;
      const daysToAdvance = 5 - currentDayInWeek;
      if (daysToAdvance <= 0) return; // Already at week end

      const targetDay = currentDay + daysToAdvance;
      const cardsSnap = await getDocs(cardsColRef);
      const activeCards: Card[] = [];
      cardsSnap.forEach(snap => activeCards.push(snap.data() as Card));

      const completedCards = activeCards.filter(c => c.columnId === 'done');
      const columnWIP: { [key: string]: number } = {};
      defaultColumns.forEach(col => {
        columnWIP[col.id] = activeCards.filter(c => c.columnId === col.id).length;
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
      let lastCumulative = gameData.dailyLogs.length > 0 ? gameData.dailyLogs[gameData.dailyLogs.length - 1].cumulativeThroughput : 0;

      for (let d = currentDay; d <= targetDay; d++) {
        mockLogs.push({
          day: d,
          columnWIP,
          throughput: 0,
          cumulativeThroughput: lastCumulative,
          averageCycleTime,
          averageLeadTime,
          wipLimitsActive: gameData.wipLimitsActive,
          shiftLeftActive: gameData.shiftLeftActive,
          swarmingActive: gameData.swarmingActive,
          smallerBatchesActive: gameData.smallerBatchesActive,
        });
      }

      const logs = [...gameData.eventLogs, `--- Fast Forwarded from Day ${currentDay} to Day ${targetDay} (Week's End) ---`];
      
      await updateDoc(gameDocRef, {
        day: targetDay,
        dailyLogs: [...(gameData.dailyLogs || []), ...mockLogs],
        gamePhase: 'week_summary',
        eventLogs: logs
      });
    } catch (err) {
      console.error("Fast forward failed:", err);
    }
  }, [roomCode, isAdmin]);

  // Inject custom expedite cards (Admin Only)
  const injectCustomExpediteCards = useCallback(async (titlePrefix: string, count: number) => {
    if (!roomCode || !isAdmin) return;

    const gameDocRef = doc(db, 'games', roomCode);
    const batch = writeBatch(db);

    try {
      const gameSnap = await getDoc(gameDocRef);
      if (!gameSnap.exists()) return;
      const gameData = gameSnap.data();

      const logs = [...gameData.eventLogs, `[Alert] Injecting ${count} EXPEDITE cards: "${titlePrefix}"` + ` - Emergency work added by instructor.`];
      
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
          createdAt: gameData.day,
          completedAt: null,
          startedAt: null,
          history: [{ day: gameData.day, columnId: 'ready' }]
        };
        batch.set(doc(db, 'games', roomCode, 'cards', id), newCard);
      }

      // Automatically block 50% of active Development cards
      const cardsColRef = collection(db, 'games', roomCode, 'cards');
      const cardsSnap = await getDocs(cardsColRef);
      const devCards: Card[] = [];
      cardsSnap.forEach(snap => {
        const c = snap.data() as Card;
        if (c.columnId === 'development' && !c.isBlocked) {
          devCards.push(c);
        }
      });

      if (devCards.length > 0) {
        const countToBlock = Math.ceil(devCards.length / 2);
        for (let i = 0; i < countToBlock; i++) {
          const card = devCards[i];
          batch.update(doc(db, 'games', roomCode, 'cards', card.id), {
            isBlocked: true,
            blockerReason: 'Blocked due to system emergency response.'
          });
          logs.push(`[Blocker] Card "${card.title}" has been BLOCKED to free up capacity for emergency response.`);
        }
      }

      batch.update(gameDocRef, { eventLogs: logs });
      await batch.commit();
    } catch (err) {
      console.error("Failed to inject custom expedite cards:", err);
    }
  }, [roomCode, isAdmin]);

  // Split Epic Card (Any User or Admin)
  const splitEpic = useCallback(async (epicId: string) => {
    if (!roomCode) return;
    
    const epicRef = doc(db, 'games', roomCode, 'cards', epicId);
    const gameRef = doc(db, 'games', roomCode);

    try {
      const epicSnap = await getDoc(epicRef);
      if (!epicSnap.exists()) return;
      const epic = epicSnap.data() as Card;

      const child1: Card = {
        id: `card_${generateId()}_c1`,
        title: `${epic.title} - Core Engine`,
        description: `Implement foundational backend core for: ${epic.title}`,
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 1, development: 4, testing: 2 },
        remainingEffort: { analysis: 1, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: gameState.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: gameState.day, columnId: 'ready' }],
        parentEpicId: epic.id
      };

      const child2: Card = {
        id: `card_${generateId()}_c2`,
        title: `${epic.title} - UI Layout`,
        description: `Design and code user screens and layouts for: ${epic.title}`,
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 1, development: 4, testing: 2 },
        remainingEffort: { analysis: 1, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: gameState.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: gameState.day, columnId: 'ready' }],
        parentEpicId: epic.id
      };

      const child3: Card = {
        id: `card_${generateId()}_c3`,
        title: `${epic.title} - Mock Payment`,
        description: `Add payment processing integration for: ${epic.title}`,
        type: 'standard',
        columnId: 'ready',
        effort: { analysis: 2, development: 4, testing: 2 },
        remainingEffort: { analysis: 2, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        createdAt: gameState.day,
        completedAt: null,
        startedAt: null,
        history: [{ day: gameState.day, columnId: 'ready' }],
        parentEpicId: epic.id
      };

      const batch = writeBatch(db);

      batch.update(epicRef, {
        columnId: 'epic_pool',
        isEpic: true,
        type: 'epic',
        epicProgress: 0,
        childCardIds: [child1.id, child2.id, child3.id]
      });

      batch.set(doc(db, 'games', roomCode, 'cards', child1.id), child1);
      batch.set(doc(db, 'games', roomCode, 'cards', child2.id), child2);
      batch.set(doc(db, 'games', roomCode, 'cards', child3.id), child3);

      const gameSnap = await getDoc(gameRef);
      if (gameSnap.exists()) {
        const logs = [...gameSnap.data().eventLogs, `[Split] Epic "${epic.title}" split into 3 independent child stories.`];
        batch.update(gameRef, { eventLogs: logs });
      }

      await batch.commit();
    } catch (err) {
      console.error("Failed to split epic:", err);
    }
  }, [roomCode, gameState.day]);

  return {
    gameState,
    loading,
    createRoom,
    rollDice,
    allocateCapacity,
    resetDailyWork,
    moveCard,
    replenishBacklog,
    endDay,
    startNextDay,
    queueEvent,
    fastForwardToWeekEnd,
    injectCustomExpediteCards,
    splitEpic
  };
};
