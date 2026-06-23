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
import type { GameState, Card, Avatar, DailyLog } from './types';
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

export const useMultiplayerState = (roomCode: string | null, currentPlayerId: string | null, isAdmin: boolean) => {
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
    eventLogs: []
  });

  const [loading, setLoading] = useState(true);

  // Helper to generate IDs
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Create a Brand New Game Session (Admin Only)
  const createRoom = useCallback(async (scenarioId: string) => {
    if (!roomCode) return;

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
      maxDays: 10,
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
      eventLogs: ['--- Project Started in Multiplayer Mode ---']
    });

    // Save Initial Cards
    initialCards.forEach(c => {
      const cardRef = doc(db, 'games', roomCode, 'cards', c.id);
      batch.set(cardRef, c);
    });

    await batch.commit();
  }, [roomCode]);

  // Initialize and Sync Room State from Firestore
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
        setGameState(prev => ({
          ...prev,
          day: data.day || 1,
          maxDays: data.maxDays || 10,
          gamePhase: data.gamePhase || 'day_start',
          activeScenarioId: data.activeScenarioId || 'easy_mode',
          pairingAllowed: data.pairingAllowed || false,
          dailyLogs: data.dailyLogs || [],
          currentDayEvent: data.currentDayEvent || null,
          eventLogs: data.eventLogs || []
        }));
      } else if (isAdmin) {
        // Document does not exist and current user is admin, initialize the room
        try {
          await createRoom('easy_mode');
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

  // Allocate Capacity (Player Only - Atomic Transaction)
  const allocateCapacity = useCallback(async (avatarId: string, cardId: string) => {
    if (!roomCode || !currentPlayerId) return;
    if (avatarId !== currentPlayerId) return; // Can only spend own capacity!

    const playerRef = doc(db, 'games', roomCode, 'players', currentPlayerId);
    const cardRef = doc(db, 'games', roomCode, 'cards', cardId);
    const gameRef = doc(db, 'games', roomCode);

    try {
      await runTransaction(db, async (transaction) => {
        const playerSnap = await transaction.get(playerRef);
        const cardSnap = await transaction.get(cardRef);
        const gameSnap = await transaction.get(gameRef);

        if (!playerSnap.exists() || !cardSnap.exists() || !gameSnap.exists()) return;

        const player = playerSnap.data();
        const card = cardSnap.data() as Card;
        const game = gameSnap.data();

        // 1. Identify active effort phase
        const activeColumn = defaultColumns.find(col => col.id === card.columnId);
        const activeEffortType = activeColumn?.allowedEffortTypes[0];
        if (!activeEffortType) return;

        const effortRemaining = card.remainingEffort[activeEffortType] || 0;
        if (effortRemaining <= 0) return; // already completed stage

        // 2. Context Switching Cost calculation
        const workedOnOthers = (player.workedOnCardIdsToday || []).filter((id: string) => id !== cardId);
        const isSwitch = workedOnOthers.length > 0 || (player.workedOnCardIdsToday.length === 0 && player.previousCardId !== null && player.previousCardId !== cardId);
        const penalty = isSwitch ? 1 : 0;

        const netCapacity = player.remainingCapacity - penalty;
        if (netCapacity <= 0) return; // No capacity left after penalty

        // 3. Pairing calculation
        const isHelper = card.assignedAvatars.length > 0 && !card.assignedAvatars.includes(avatarId);
        let progressPoints = 0;
        let capacitySpent = 0;

        if (card.isBlocked) {
          // If blocked, student spends 2 capacity to generate 1 point of progress (clears blocker)
          if (netCapacity >= 2) {
            progressPoints = 1;
            capacitySpent = 2 + penalty;
          }
        } else if (isHelper) {
          // Helper spends 2 capacity points to generate 1 progress point
          if (netCapacity >= 2 && game.pairingAllowed) {
            progressPoints = 1;
            capacitySpent = 2 + penalty;
          }
        } else {
          // Standard: 1 capacity spent = 1 effort point progressed
          progressPoints = Math.min(netCapacity, effortRemaining);
          capacitySpent = progressPoints + penalty;
        }

        if (capacitySpent === 0) return;

        // 4. Update data structures
        const updatedRemainingEffort = { ...card.remainingEffort };
        let wasUnblocked = false;

        if (card.isBlocked) {
          updatedRemainingEffort[activeEffortType] = Math.max(0, effortRemaining - progressPoints);
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

        // Check QA Failures if development completed
        let qaLogs = '';
        if (activeEffortType === 'development' && updatedRemainingEffort.development === 0) {
          // 20% QA failure check
          if (Math.random() < 0.20) {
            updatedRemainingEffort.development = card.effort.development; // Reset dev effort
            card.failedQACount += 1;
            qaLogs = ` [QA Failure] Card "${card.title}" failed QA tests and requires developer rework!`;
          }
        }

        // Apply writes to transaction
        transaction.update(playerRef, {
          remainingCapacity: newRemainingCapacity,
          workedOnCardIdsToday: newWorkedOnCardIds,
          assignedCardId: cardId,
          allocationsToday: allocations
        });

        transaction.update(cardRef, {
          remainingEffort: updatedRemainingEffort,
          assignedAvatars: newAssignedAvatars,
          isBlocked: card.isBlocked,
          failedQACount: card.failedQACount
        });

        // Add log entry
        let logMsg = `[Work] ${player.name} spent ${capacitySpent} capacity points on "${card.title}"`;
        if (isSwitch) logMsg += ` (-1 context penalty applied)`;
        if (wasUnblocked) logMsg += ` [Success] Unblocked card!`;
        if (qaLogs) logMsg += qaLogs;

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
        averageLeadTime
      };

      const gameSnap = await getDoc(gameDocRef);
      if (gameSnap.exists()) {
        const logs = [...(gameSnap.data().dailyLogs || []), newLog];
        await updateDoc(gameDocRef, {
          dailyLogs: logs,
          gamePhase: 'day_summary',
          eventLogs: [...gameSnap.data().eventLogs, `--- End of Day ${gameState.day} Summary: Completed ${todayThroughput} cards ---`]
        });
      }
    } catch (err) {
      console.error('End day failed:', err);
    }
  }, [roomCode, isAdmin, gameState.day]);

  // Start Next Day & Trigger Queued Scenarios (Admin Only)
  const startNextDay = useCallback(async () => {
    if (!roomCode || !isAdmin) return;

    const nextDay = gameState.day + 1;
    const gameDocRef = doc(db, 'games', roomCode);
    const playersColRef = collection(db, 'games', roomCode, 'players');
    const cardsColRef = collection(db, 'games', roomCode, 'cards');

    try {
      const gameSnap = await getDoc(gameDocRef);
      if (!gameSnap.exists()) return;

      const gameData = gameSnap.data();
      let pairingAllowed = gameData.pairingAllowed;
      let nextEvent = null;

      // Reset columns limits locally
      let columnsWipConfig = [...gameState.columns];
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

      // Handle custom triggered scenario events selected by admin
      if (gameData.nextEventId) {
        if (gameData.nextEventId === 'wip_limits') {
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
        } else if (gameData.nextEventId === 'outage') {
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
        } else if (gameData.nextEventId === 'tech_debt') {
          nextEvent = {
            title: 'Technical Debt Instability',
            description: 'System degradation has occurred. Developers are fighting server issues. Dice rolls for capacity are capped to a maximum of 4 today due to technical debt.'
          };
          logs.push(`[Alert] System degradation active: developer capacity rolls capped due to legacy debt.`);
        } else if (gameData.nextEventId === 'blocker') {
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
        }
      }

      // Commit player resets and card additions
      await batch.commit();

      // Update main game doc
      await updateDoc(gameDocRef, {
        day: nextDay,
        gamePhase: nextDay > 10 ? 'game_over' : 'day_start',
        pairingAllowed,
        currentDayEvent: nextEvent,
        nextEventId: null, // Reset event trigger queue
        eventLogs: logs
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
    queueEvent
  };
};
