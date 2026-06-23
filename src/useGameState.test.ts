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
});

