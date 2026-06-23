// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useGameState } from './useGameState';
import { describe, it, expect, beforeEach } from 'vitest';

describe('useGameState Hook', () => {
  beforeEach(() => {
    const store: { [key: string]: string } = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => {
        for (const key in store) {
          delete store[key];
        }
      },
      removeItem: (key: string) => { delete store[key]; }
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    localStorage.clear();
  });

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useGameState());

    expect(result.current.gameState.day).toBe(1);
    expect(result.current.gameState.gamePhase).toBe('intro');
    expect(result.current.gameState.rolledToday).toBe(false);
    expect(result.current.gameState.cards.length).toBe(0);
  });

  it('should load first scenario day on start game', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.startGame();
    });

    expect(result.current.gameState.gamePhase).toBe('day_start');
    expect(result.current.gameState.day).toBe(1);
    expect(result.current.gameState.cards.length).toBe(6);
    expect(result.current.gameState.rolledToday).toBe(false);
  });

  it('should roll capacity dice for developers', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.startGame();
    });

    act(() => {
      result.current.rollDice();
    });

    expect(result.current.gameState.rolledToday).toBe(true);
    expect(result.current.gameState.gamePhase).toBe('dice_rolled');
    
    // All active developers should have a rolled capacity (1 to 6)
    result.current.gameState.avatars.forEach(avatar => {
      expect(avatar.currentRoll).toBeGreaterThanOrEqual(1);
      expect(avatar.currentRoll).toBeLessThanOrEqual(6);
      expect(avatar.remainingCapacity).toBe(avatar.currentRoll);
    });
  });

  it('should allocate capacity and reduce remaining effort', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.startGame();
    });

    act(() => {
      result.current.rollDice();
    });

    const activeCard = result.current.gameState.cards.find(c => c.columnId === 'analysis');
    const avatar = result.current.gameState.avatars[0]; // Alice

    expect(activeCard).toBeDefined();
    expect(avatar).toBeDefined();

    const initialEffort = activeCard!.remainingEffort.analysis;
    const initialCapacity = avatar.remainingCapacity;

    act(() => {
      result.current.allocateCapacity(avatar.id, activeCard!.id);
    });

    // Verify card effort is reduced
    const updatedCard = result.current.gameState.cards.find(c => c.id === activeCard!.id);
    const updatedAvatar = result.current.gameState.avatars.find(a => a.id === avatar.id);

    expect(updatedCard).toBeDefined();
    expect(updatedAvatar).toBeDefined();

    const appliedProgress = Math.min(initialEffort, initialCapacity);
    expect(updatedCard!.remainingEffort.analysis).toBe(initialEffort - appliedProgress);
    expect(updatedAvatar!.remainingCapacity).toBe(initialCapacity - appliedProgress);
    expect(updatedAvatar!.workedOnCardIdsToday).toContain(activeCard!.id);
  });

  it('should apply context-switching penalty on task switch', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.startGame();
    });

    act(() => {
      result.current.rollDice();
    });

    // Make sure Alice has at least 5 capacity to switch between 2 tasks
    // If her roll is low, we override it in the test to ensure capacity is sufficient
    const avatar = result.current.gameState.avatars[0];
    act(() => {
      // Force capacity to 6 for testing
      avatar.remainingCapacity = 6;
      avatar.currentRoll = 6;
    });

    const analysisCards = result.current.gameState.cards.filter(c => c.columnId === 'analysis');
    expect(analysisCards.length).toBeGreaterThanOrEqual(2);

    const card1 = analysisCards[0];
    const card2 = analysisCards[1];

    // Work on Card 1 (consumes effort)
    act(() => {
      result.current.allocateCapacity(avatar.id, card1.id);
    });

    // Alice should have worked on card1
    let updatedAvatar = result.current.gameState.avatars.find(a => a.id === avatar.id);
    expect(updatedAvatar!.workedOnCardIdsToday).toContain(card1.id);
    const capacityAfterCard1 = updatedAvatar!.remainingCapacity;

    // Switch to Card 2 (triggering penalty)
    act(() => {
      result.current.allocateCapacity(avatar.id, card2.id);
    });

    updatedAvatar = result.current.gameState.avatars.find(a => a.id === avatar.id);
    
    // Alice's remaining capacity should be capacityAfterCard1 minus work done on card2 minus 1 (penalty)
    // If card1 was completed, and she worked on card2
    expect(updatedAvatar!.workedOnCardIdsToday).toContain(card2.id);
    
    // The cost should include: work done on card 1 + work done on card 2 + 1 penalty point
    const card2EffortLeft = card2.remainingEffort.analysis;
    const progressAppliedToCard2 = Math.min(card2EffortLeft, capacityAfterCard1 - 1);
    
    expect(updatedAvatar!.remainingCapacity).toBe(capacityAfterCard1 - progressAppliedToCard2 - 1);
  });

  it('should undo allocations when Reset Daily Work is called', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.startGame();
    });

    act(() => {
      result.current.rollDice();
    });

    const activeCard = result.current.gameState.cards.find(c => c.columnId === 'analysis');
    const avatar = result.current.gameState.avatars[0];

    act(() => {
      result.current.allocateCapacity(avatar.id, activeCard!.id);
    });

    // Verify work applied
    let cardBeforeReset = result.current.gameState.cards.find(c => c.id === activeCard!.id);
    expect(cardBeforeReset!.remainingEffort.analysis).toBeLessThan(activeCard!.remainingEffort.analysis);

    // Call Undo
    act(() => {
      result.current.resetDailyWork();
    });

    // Verify work is reset
    let cardAfterReset = result.current.gameState.cards.find(c => c.id === activeCard!.id);
    let avatarAfterReset = result.current.gameState.avatars.find(a => a.id === avatar.id);

    expect(cardAfterReset!.remainingEffort.analysis).toBe(activeCard!.remainingEffort.analysis);
    expect(avatarAfterReset!.remainingCapacity).toBe(avatar.currentRoll);
    expect(avatarAfterReset!.workedOnCardIdsToday.length).toBe(0);
  });

  it('should manually replenish the backlog with random card', () => {
    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.startGame();
    });

    const initialCardCount = result.current.gameState.cards.length;
    expect(initialCardCount).toBe(6);

    act(() => {
      result.current.replenishBacklog();
    });

    expect(result.current.gameState.cards.length).toBe(initialCardCount + 1);
    const newCard = result.current.gameState.cards[result.current.gameState.cards.length - 1];

    expect(newCard.columnId).toBe('backlog');
    expect(newCard.type).toBe('standard');
    expect(newCard.effort.analysis).toBeGreaterThanOrEqual(1);
    expect(newCard.effort.analysis).toBeLessThanOrEqual(3);
    expect(newCard.effort.development).toBeGreaterThanOrEqual(2);
    expect(newCard.effort.development).toBeLessThanOrEqual(6);
    expect(newCard.effort.testing).toBeGreaterThanOrEqual(1);
    expect(newCard.effort.testing).toBeLessThanOrEqual(3);

    // Verify event logs updated
    const logEntry = result.current.gameState.eventLogs[result.current.gameState.eventLogs.length - 1];
    expect(logEntry).toContain('[Backlog] Replenished backlog with:');
  });

  it('should transition to week_summary phase on Day 5', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.startGame();
    });

    for (let day = 1; day < 5; day++) {
      act(() => {
        result.current.rollDice();
      });
      act(() => {
        result.current.endDay();
      });
      act(() => {
        result.current.startNextDay();
      });
    }

    // Now on Day 5
    expect(result.current.gameState.day).toBe(5);
    expect(result.current.gameState.gamePhase).toBe('day_start');

    act(() => {
      result.current.rollDice();
    });
    act(() => {
      result.current.endDay();
    });

    // Should transition to week_summary at end of Day 5
    expect(result.current.gameState.gamePhase).toBe('week_summary');
  });

  it('should roll back testing cards to development when Shift-Left starts', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.startGame();
    });

    // Manually put a card in the testing column and set some progress
    act(() => {
      const card = result.current.gameState.cards[0];
      card.columnId = 'testing';
      card.effort.development = 6;
      card.remainingEffort.development = 0;
      card.effort.testing = 3;
      card.remainingEffort.testing = 2;
    });

    // Advance to day 5 and reach weekend summary
    for (let day = 1; day < 5; day++) {
      act(() => { result.current.rollDice(); });
      act(() => { result.current.endDay(); });
      act(() => { result.current.startNextDay(); });
    }
    // End Day 5 to reach week_summary
    act(() => { result.current.rollDice(); });
    act(() => { result.current.endDay(); });
    expect(result.current.gameState.gamePhase).toBe('week_summary');

    // Launch next week with Shift-Left active
    act(() => {
      result.current.startNextDay({ shiftLeftActive: true });
    });

    // The card should now be in development column
    const migratedCard = result.current.gameState.cards[0];
    expect(migratedCard.columnId).toBe('development');
    // Development effort should be reset to full (6)
    expect(migratedCard.remainingEffort.development).toBe(6);
    // Testing effort should be preserved (2)
    expect(migratedCard.remainingEffort.testing).toBe(2);
    expect(result.current.gameState.shiftLeftActive).toBe(true);
  });

  it('should block working on standard cards when an expedite card is active in the same column', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.startGame();
    });

    // Move a standard card to development
    let stdCardId = '';
    act(() => {
      const stdCard = result.current.gameState.cards.find(c => c.columnId === 'analysis')!;
      stdCard.columnId = 'development';
      stdCardId = stdCard.id;
    });

    // Inject an expedite card in development
    let expCardId = 'exp_01';
    act(() => {
      result.current.injectCustomExpediteCards('Security Breach', 1);
    });

    act(() => {
      // The injected card will start in 'ready'. Let's manually move it to 'development'
      const expCard = result.current.gameState.cards.find(c => c.type === 'expedite')!;
      expCard.id = expCardId;
      expCard.columnId = 'development';
      expCard.remainingEffort.development = 2;
    });

    act(() => {
      result.current.rollDice();
    });

    const dev = result.current.gameState.avatars[0];
    const initialCapacity = dev.remainingCapacity;

    // Attempt to allocate capacity to the standard card in development
    act(() => {
      result.current.allocateCapacity(dev.id, stdCardId);
    });

    // Allocation should be blocked: developer capacity is unchanged
    const updatedDev = result.current.gameState.avatars.find(a => a.id === dev.id)!;
    expect(updatedDev.remainingCapacity).toBe(initialCapacity);
    expect(result.current.gameState.eventLogs[result.current.gameState.eventLogs.length - 1]).toContain('Cannot work on standard card');

    // Attempt to allocate capacity to the expedite card in development
    act(() => {
      result.current.allocateCapacity(dev.id, expCardId);
    });

    // Allocation should succeed: developer capacity is reduced
    const devAfterExp = result.current.gameState.avatars.find(a => a.id === dev.id)!;
    expect(devAfterExp.remainingCapacity).toBeLessThan(initialCapacity);
  });

  it('should handle story splitting Epic into child cards and roll up progress', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.startGame();
    });

    // Setup an Epic card in Ready
    let epicId = '';
    act(() => {
      const epicCard = result.current.gameState.cards[0];
      epicCard.isEpic = true;
      epicCard.type = 'epic';
      epicCard.columnId = 'ready';
      epicId = epicCard.id;
    });

    // Split the Epic
    act(() => {
      result.current.splitEpic(epicId);
    });

    // Epic card should now be in 'epic_pool' and 3 child cards should be in 'ready'
    const updatedEpic = result.current.gameState.cards.find(c => c.id === epicId)!;
    expect(updatedEpic.columnId).toBe('epic_pool');
    expect(updatedEpic.epicProgress).toBe(0);
    expect(updatedEpic.childCardIds?.length).toBe(3);

    // Complete one child card (move to done)
    act(() => {
      const childCards = result.current.gameState.cards.filter(c => c.parentEpicId === epicId);
      childCards[0].columnId = 'done';
      childCards[0].completedAt = result.current.gameState.day;
    });

    // End day to trigger rollup progress
    act(() => {
      result.current.rollDice();
    });
    act(() => {
      result.current.endDay();
    });

    // Epic progress should be 33%
    const epicAfterDay1 = result.current.gameState.cards.find(c => c.id === epicId)!;
    expect(epicAfterDay1.epicProgress).toBe(33);
    expect(epicAfterDay1.columnId).toBe('epic_pool');

    // Complete the remaining child cards
    act(() => {
      const childCards = result.current.gameState.cards.filter(c => c.parentEpicId === epicId);
      childCards[1].columnId = 'done';
      childCards[1].completedAt = result.current.gameState.day;
      childCards[2].columnId = 'done';
      childCards[2].completedAt = result.current.gameState.day;
    });

    // End day to trigger rollup progress again
    act(() => {
      result.current.rollDice();
    });
    act(() => {
      result.current.endDay();
    });

    // Epic progress should be 100% and it should move to done column
    const epicAfterDay2 = result.current.gameState.cards.find(c => c.id === epicId)!;
    expect(epicAfterDay2.epicProgress).toBe(100);
    expect(epicAfterDay2.columnId).toBe('done');
  });
});

