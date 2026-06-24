// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMultiplayerState } from './useMultiplayerState';
import { store, resetMockFirestore, setDoc, doc, updateDoc } from './__mocks__/firestore';
import { db } from './__mocks__/firebase';


// Mock Firebase & Firestore imports
vi.mock('firebase/firestore', () => import('./__mocks__/firestore'));
vi.mock('./firebase', () => import('./__mocks__/firebase'));

describe('useMultiplayerState Hook (Multiplayer Engine BDD)', () => {
  beforeEach(() => {
    resetMockFirestore();
    vi.restoreAllMocks();
  });

  const setupRoom = async (roomCode: string, playerId: string, isAdmin: boolean) => {
    // Always seed the game document and initial cards in the store first
    const gameRef = doc(db, 'games', roomCode);
    await setDoc(gameRef, {
      day: 1,
      maxDays: 10,
      gamePhase: 'day_start',
      status: 'active',
      activeScenarioId: 'easy_mode',
      pairingAllowed: false,
      dailyLogs: [],
      currentDayEvent: { title: 'Day 1 Event', description: 'Kickoff!' },
      eventLogs: ['--- Game Started ---'],
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
    });

    // Seed 4 initial cards
    const initialCards = [
      {
        id: 'card_login',
        title: 'User Login & Auth',
        columnId: 'analysis',
        effort: { analysis: 2, development: 4, testing: 2 },
        remainingEffort: { analysis: 2, development: 4, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        type: 'standard',
        history: []
      },
      {
        id: 'card_db',
        title: 'Database Schema Setup',
        columnId: 'analysis',
        effort: { analysis: 1, development: 3, testing: 1 },
        remainingEffort: { analysis: 1, development: 3, testing: 1 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        type: 'standard',
        history: []
      },
      {
        id: 'card_landing',
        title: 'Landing Page Layout',
        columnId: 'ready',
        effort: { analysis: 2, development: 2, testing: 1 },
        remainingEffort: { analysis: 2, development: 2, testing: 1 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        type: 'standard',
        history: []
      },
      {
        id: 'card_checkout',
        title: 'Checkout Flow Integration',
        columnId: 'ready',
        effort: { analysis: 3, development: 5, testing: 2 },
        remainingEffort: { analysis: 3, development: 5, testing: 2 },
        assignedAvatars: [],
        isBlocked: false,
        failedQACount: 0,
        type: 'standard',
        history: []
      }
    ];

    for (const card of initialCards) {
      await setDoc(doc(db, 'games', roomCode, 'cards', card.id), card);
    }

    // Seed the player document
    const playerRef = doc(db, 'games', roomCode, 'players', playerId);
    await setDoc(playerRef, {
      id: playerId,
      name: 'Test Player',
      color: '#ff0000',
      currentRoll: null,
      remainingCapacity: 0,
      workedOnCardIdsToday: [],
      assignedCardId: null,
      previousCardId: null,
      spentCapacity: 0,
      allocationsToday: {}
    });

    // Render the hook
    const { result } = renderHook(() => useMultiplayerState(roomCode, playerId, isAdmin));

    // Let state listeners fire and update hook
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    return result;
  };

  // --- Scenario Group 1: Room Lifecycle & Initialization ---

  it('M1: createRoom initializes Firestore game document with correct defaults', async () => {
    const { result } = renderHook(() => useMultiplayerState('room1', 'player1', true));
    
    await act(async () => {
      await result.current.createRoom('easy_mode');
    });

    const gameData = store.get('games/room1');
    expect(gameData).toBeDefined();
    expect(gameData.day).toBe(1);
    expect(gameData.gamePhase).toBe('day_start');
    expect(gameData.status).toBe('active');
    expect(gameData.eventLogs[0]).toContain('Project Started');
  });

  it('M2: createRoom seeds 4 initial cards into the cards subcollection', async () => {
    renderHook(() => useMultiplayerState('room1', 'player1', true));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });



    const cards: any[] = [];
    store.forEach((value, key) => {
      if (key.startsWith('games/room1/cards/')) {
        cards.push(value);
      }
    });

    expect(cards.length).toBe(4);
    expect(cards.some(c => c.title === 'User Login & Auth')).toBe(true);
  });

  it('M3: Real-time listeners sync game state from Firestore snapshots', async () => {
    const result = await setupRoom('room1', 'player1', false);
    
    expect(result.current.loading).toBe(false);
    expect(result.current.gameState.day).toBe(1);

    // Simulate database update from other player/admin
    await act(async () => {
      const gameRef = doc(db, 'games', 'room1');
      await updateDoc(gameRef, {
        day: 2,
        gamePhase: 'dice_rolled'
      });
    });

    expect(result.current.gameState.day).toBe(2);
    expect(result.current.gameState.gamePhase).toBe('dice_rolled');
  });

  // --- Scenario Group 2: Player Dice Rolling ---

  it('M4: Player rolls dice and capacity is recorded in Firestore', async () => {
    const result = await setupRoom('room1', 'player1', false);
    
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // roll of 5

    await act(async () => {
      await result.current.rollDice();
    });

    const playerData = store.get('games/room1/players/player1');
    expect(playerData.currentRoll).toBe(5);
    expect(playerData.remainingCapacity).toBe(5);
    expect(result.current.gameState.rolledToday).toBe(true);
  });

  it('M5: Game phase transitions to dice_rolled when all players roll', async () => {
    const result = await setupRoom('room1', 'player1', false);
    
    // Seed another player who has already rolled
    await setDoc(doc(db, 'games', 'room1', 'players', 'player2'), {
      id: 'player2',
      name: 'Player 2',
      color: '#00ff00',
      currentRoll: 4,
      remainingCapacity: 4
    });

    // Player 1 rolls
    await act(async () => {
      await result.current.rollDice();
    });

    const gameData = store.get('games/room1');
    expect(gameData.gamePhase).toBe('dice_rolled');
  });

  // --- Scenario Group 3: Capacity Allocation (Transactional) ---

  it('M6: Standard capacity allocation deducts effort and updates Firestore', async () => {
    const result = await setupRoom('room1', 'player1', false);



    // Get the first card seeded (in analysis column)
    const card = result.current.gameState.cards.find(c => c.columnId === 'analysis');
    expect(card).toBeDefined();
    const cardId = card!.id;

    // Roll player to 4 capacity
    vi.spyOn(Math, 'random').mockReturnValue(0.6); // roll of 4
    await act(async () => {
      await result.current.rollDice();
    });

    const initialEffort = card!.remainingEffort.analysis || 0;

    await act(async () => {
      await result.current.allocateCapacity('player1', cardId, 'analysis');
    });

    const cardAfter = store.get(`games/room1/cards/${cardId}`);
    const playerAfter = store.get('games/room1/players/player1');

    const expectedRemaining = Math.max(0, initialEffort - 4);
    expect(cardAfter.remainingEffort.analysis).toBe(expectedRemaining);
    expect(playerAfter.remainingCapacity).toBe(Math.max(0, 4 - initialEffort));
  });

  it('M7: Expedite urgency blocks work on standard cards', async () => {
    const result = await setupRoom('room1', 'player1', true);

    // Inject expedite card (puts it in ready)
    await act(async () => {
      await result.current.injectCustomExpediteCards('Urgent Payment', 1);
    });

    const expediteCard = result.current.gameState.cards.find(c => c.type === 'expedite');
    const standardCard = result.current.gameState.cards.find(c => c.type === 'standard');
    expect(expediteCard).toBeDefined();
    expect(standardCard).toBeDefined();

    // Move standard card and expedite card to development
    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1', 'cards', standardCard!.id), { columnId: 'development' });
      await updateDoc(doc(db, 'games', 'room1', 'cards', expediteCard!.id), { columnId: 'development' });
    });

    // Roll player
    await act(async () => {
      await result.current.rollDice();
    });

    // Try allocating to standard card
    await act(async () => {
      await result.current.allocateCapacity('player1', standardCard!.id, 'development');
    });

    const standardCardAfter = store.get(`games/room1/cards/${standardCard!.id}`);
    expect(standardCardAfter.remainingEffort.development).toBe(standardCard!.remainingEffort.development);

    const game = store.get('games/room1');
    expect(game.eventLogs[game.eventLogs.length - 1]).toContain('[Blocked]');
  });

  it('M8: Context-switch penalty applies when switching cards', async () => {
    const result = await setupRoom('room1', 'player1', false);

    // Get two cards
    const analysisCards = result.current.gameState.cards.filter(c => c.columnId === 'analysis');
    expect(analysisCards.length).toBeGreaterThanOrEqual(2);
    const cardId1 = analysisCards[0].id;
    const cardId2 = analysisCards[1].id;

    // Set player capacity=3, already worked on cardId1 today
    await updateDoc(doc(db, 'games', 'room1', 'players', 'player1'), {
      currentRoll: 3,
      remainingCapacity: 3,
      workedOnCardIdsToday: [cardId1]
    });

    // Make sure cardId2 has enough effort to consume remaining capacity
    await updateDoc(doc(db, 'games', 'room1', 'cards', cardId2), {
      effort: { analysis: 3, development: 0, testing: 0 },
      remainingEffort: { analysis: 3, development: 0, testing: 0 }
    });

    // Allocate to cardId2 (switch)
    await act(async () => {
      await result.current.allocateCapacity('player1', cardId2, 'analysis');
    });

    const player = store.get('games/room1/players/player1');
    const card2 = store.get(`games/room1/cards/${cardId2}`);

    // Remaining effort should be reduced by 2 (capacity = 3 - 1 context penalty = 2 net capacity)
    expect(card2.remainingEffort.analysis).toBe(1);
    expect(player.remainingCapacity).toBe(0);
  });

  it('M9: Pairing helper spends at 2:1 rate in multiplayer', async () => {
    const result = await setupRoom('room1', 'player1', true);

    // Turn on WIP limits (so pairing is allowed)
    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1'), {
        wipLimitsActive: true,
        pairingAllowed: true,
        config: { pairingHelpCost: 2, unblockCost: 2 }
      });
    });

    const analysisCard = result.current.gameState.cards.find(c => c.columnId === 'analysis');
    expect(analysisCard).toBeDefined();

    // Assign card to player2 (another developer)
    await updateDoc(doc(db, 'games', 'room1', 'cards', analysisCard!.id), {
      assignedAvatars: ['player2']
    });

    // Player 1 capacity = 3
    await updateDoc(doc(db, 'games', 'room1', 'players', 'player1'), {
      currentRoll: 3,
      remainingCapacity: 3
    });

    // Player 1 works on it as helper
    await act(async () => {
      await result.current.allocateCapacity('player1', analysisCard!.id, 'analysis');
    });

    const card = store.get(`games/room1/cards/${analysisCard!.id}`);
    const player = store.get('games/room1/players/player1');

    // remainingEffort should decrease by 1 effort point (pairing cost is 2, player has 3 capacity, so spends 2 capacity for 1 effort point)
    expect(card.remainingEffort.analysis).toBe(analysisCard!.remainingEffort.analysis - 1);
    expect(player.remainingCapacity).toBe(1);
  });

  it('M10: Self-testing penalty increases QA failure rate in multiplayer', async () => {
    const result = await setupRoom('room1', 'player1', false);

    // Mock Math.random to return 0.35 (QA failure range when self-testing is 0.40)
    vi.spyOn(Math, 'random').mockReturnValue(0.35);

    const testCard = result.current.gameState.cards.find(c => c.columnId === 'analysis'); // Let's use any card, move it to testing
    expect(testCard).toBeDefined();
    const cardId = testCard!.id;

    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1', 'cards', cardId), {
        columnId: 'testing',
        effort: { development: 2, testing: 1, analysis: 0 },
        remainingEffort: { testing: 1, development: 0, analysis: 0 },
        developedBy: ['player1'], // Self-developed
        testedBy: [],
        failedQACount: 0
      });
    });

    // Give player capacity
    await updateDoc(doc(db, 'games', 'room1', 'players', 'player1'), {
      currentRoll: 3,
      remainingCapacity: 3
    });

    // Spend capacity to test it
    await act(async () => {
      await result.current.allocateCapacity('player1', cardId, 'testing');
    });

    const card = store.get(`games/room1/cards/${cardId}`);
    expect(card.columnId).toBe('development'); // QA failed, reverted to development
    expect(card.remainingEffort.development).toBe(2);
    expect(card.failedQACount).toBe(1);
  });

  // --- Scenario Group 4: Card Movement & Reset ---

  it('M11: moveCard enforces WIP limits in multiplayer', async () => {
    const result = await setupRoom('room1', 'player1', true);

    // Enable WIP limits, set limit for development to 2
    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1'), {
        wipLimitsActive: true
      });
    });

    const cards = result.current.gameState.cards;
    const readyCard = cards.find(c => c.columnId === 'ready');
    const devCards = cards.filter(c => c.columnId === 'development' || c.columnId === 'analysis'); // move analysis to dev to fill it up
    
    // Fill up development with 2 cards
    await act(async () => {
      for (let i = 0; i < Math.min(2, devCards.length); i++) {
        await updateDoc(doc(db, 'games', 'room1', 'cards', devCards[i].id), { columnId: 'development' });
      }
    });

    expect(readyCard).toBeDefined();

    // Try to move readyCard to development (should fail because WIP Limit for Development is 2)
    let movedResult: any;
    await act(async () => {
      movedResult = await result.current.moveCard(readyCard!.id, 'development');
    });

    expect(movedResult.success).toBe(false);
    expect(store.get(`games/room1/cards/${readyCard!.id}`).columnId).toBe('ready');
  });

  it('M12: moveCard sets completedAt when moved to Done', async () => {
    const result = await setupRoom('room1', 'player1', false);

    const card = result.current.gameState.cards[0];
    await act(async () => {
      await result.current.moveCard(card.id, 'done');
    });

    const cardAfter = store.get(`games/room1/cards/${card.id}`);
    expect(cardAfter.columnId).toBe('done');
    expect(cardAfter.completedAt).toBe(1);
  });

  it('M13: resetDailyWork reverts capacity and card effort within transaction', async () => {
    const result = await setupRoom('room1', 'player1', false);

    const card = result.current.gameState.cards.find(c => c.columnId === 'analysis');
    expect(card).toBeDefined();

    // Allocate some work
    await updateDoc(doc(db, 'games', 'room1', 'cards', card!.id), {
      remainingEffort: { analysis: 1, development: 0, testing: 0 },
      assignedAvatars: ['player1']
    });

    await updateDoc(doc(db, 'games', 'room1', 'players', 'player1'), {
      currentRoll: 5,
      remainingCapacity: 3,
      workedOnCardIdsToday: [card!.id],
      allocationsToday: { [card!.id]: 2 }
    });

    await act(async () => {
      await result.current.resetDailyWork();
    });

    const player = store.get('games/room1/players/player1');
    const cardAfter = store.get(`games/room1/cards/${card!.id}`);

    expect(player.remainingCapacity).toBe(5);
    expect(player.allocationsToday).toEqual({});
    expect(cardAfter.remainingEffort.analysis).toBe(card!.effort.analysis);
  });

  // --- Scenario Group 5: End-of-Day & Day Transitions ---

  it('M14: endDay computes daily metrics and logs them to Firestore', async () => {
    const result = await setupRoom('room1', 'player1', true);

    // Create a completed card
    const card = result.current.gameState.cards[0];
    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1', 'cards', card.id), {
        columnId: 'done',
        completedAt: 1,
        createdAt: 1,
        startedAt: 1,
        assignedAvatars: []
      });
    });

    // Make sure other cards don't cause length errors
    const otherCards = result.current.gameState.cards.slice(1);
    for (const c of otherCards) {
      await updateDoc(doc(db, 'games', 'room1', 'cards', c.id), {
        assignedAvatars: []
      });
    }

    await act(async () => {
      await result.current.endDay();
    });

    const game = store.get('games/room1');
    expect(game.gamePhase).toBe('day_summary');
    expect(game.dailyLogs.length).toBe(1);
    expect(game.dailyLogs[0].throughput).toBe(1);
  });

  it('M15: endDay applies blocker checks with pairing save logic', async () => {
    const result = await setupRoom('room1', 'player1', true);

    const card = result.current.gameState.cards[0];
    // Put card in development, assigned to player1, not blocked
    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1', 'cards', card.id), {
        columnId: 'development',
        isBlocked: false,
        assignedAvatars: ['player1']
      });
    });

    // Make sure other cards don't have assigned avatars
    const otherCards = result.current.gameState.cards.slice(1);
    for (const c of otherCards) {
      await updateDoc(doc(db, 'games', 'room1', 'cards', c.id), {
        assignedAvatars: []
      });
    }

    // Force blocker check to fail (low random roll)
    vi.spyOn(Math, 'random').mockReturnValue(0.05);

    await act(async () => {
      await result.current.endDay();
    });

    const cardAfter = store.get(`games/room1/cards/${card.id}`);
    expect(cardAfter.isBlocked).toBe(true);
  });

  it('M16: endDay transitions to week_summary on Day 5', async () => {
    const result = await setupRoom('room1', 'player1', true);

    // Make sure no cards throw errors
    for (const c of result.current.gameState.cards) {
      await updateDoc(doc(db, 'games', 'room1', 'cards', c.id), {
        assignedAvatars: []
      });
    }

    // Set day to 5
    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1'), {
        day: 5
      });
    });

    await act(async () => {
      await result.current.endDay();
    });

    const gameData = store.get('games/room1');
    expect(gameData.gamePhase).toBe('week_summary');
  });

  it('M17: startNextDay resets all player rolls and advances day', async () => {
    const result = await setupRoom('room1', 'player1', true);

    // Setup player roll and summary phase
    await updateDoc(doc(db, 'games', 'room1', 'players', 'player1'), {
      currentRoll: 4,
      remainingCapacity: 2
    });

    await updateDoc(doc(db, 'games', 'room1'), {
      gamePhase: 'day_summary',
      day: 1
    });

    await act(async () => {
      await result.current.startNextDay();
    });

    const gameData = store.get('games/room1');
    const playerData = store.get('games/room1/players/player1');

    expect(gameData.day).toBe(2);
    expect(gameData.gamePhase).toBe('day_start');
    expect(playerData.currentRoll).toBeNull();
    expect(playerData.remainingCapacity).toBe(0);
  });

  it('M18: startNextDay activates WIP limits when accelerator selected', async () => {
    const result = await setupRoom('room1', 'player1', true);

    await act(async () => {
      await updateDoc(doc(db, 'games', 'room1'), {
        gamePhase: 'week_summary',
        day: 5
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.startNextDay('wip_limits');
    });

    const gameData = store.get('games/room1');
    expect(gameData.wipLimitsActive).toBe(true);
    expect(gameData.day).toBe(6);
  });

  // --- Scenario Group 6: Special Events & Epic Splitting ---

  it('M19: injectCustomExpediteCards creates expedite cards in Firestore', async () => {
    const result = await setupRoom('room1', 'player1', true);

    await act(async () => {
      await result.current.injectCustomExpediteCards('Emergency Hotfix', 1);
    });

    let hasExpedite = false;
    store.forEach((value, key) => {
      if (key.startsWith('games/room1/cards/') && value.type === 'expedite') {
        hasExpedite = true;
      }
    });

    expect(hasExpedite).toBe(true);
  });

  it('M20: splitEpic creates child story cards linked to parent', async () => {
    const result = await setupRoom('room1', 'player1', true);

    const epicId = 'epic_parent';
    await setDoc(doc(db, 'games', 'room1', 'cards', epicId), {
      id: epicId,
      title: 'Huge Feature Epic',
      columnId: 'ready',
      isEpic: true,
      type: 'epic',
      epicProgress: 0,
      childCardIds: []
    });

    await act(async () => {
      await result.current.splitEpic(epicId);
    });

    const childCards: any[] = [];
    store.forEach((value, key) => {
      if (key.startsWith('games/room1/cards/') && value.parentEpicId === epicId) {
        childCards.push(value);
      }
    });

    expect(childCards.length).toBe(3);
    expect(childCards[0].columnId).toBe('ready');
  });

  it('M21: replenishBacklog adds a new card from the pool', async () => {
    const result = await setupRoom('room1', 'player1', true);

    const initialCount = result.current.gameState.cards.length;

    await act(async () => {
      await result.current.replenishBacklog();
    });

    let cardsCount = 0;
    store.forEach((_value, key) => {
      if (key.startsWith('games/room1/cards/')) {
        cardsCount++;
      }
    });

    expect(cardsCount).toBe(initialCount + 1);
  });
});
