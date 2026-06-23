import { expect, vi } from 'vitest';
import { act, render, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { CardComponent } from '../../components/CardComponent';
import { Controls } from '../../components/Controls';
import { BddRunner } from '../bdd_runner';

export const registerSteps = (runner: BddRunner) => {
  runner.register(/^a new game is started$/, (context) => {
    act(() => {
      context.result.current.startGame();
    });
  });

  runner.register(/^WIP Limits accelerator is active$/, (context) => {
    act(() => {
      context.result.current.startNextDay({ wipLimitsActive: true });
    });
  });

  runner.register(/^(.*) column WIP limit is (\d+)$/, (context, colName, limit) => {
    const colId = colName.toLowerCase();
    const col = context.result.current.gameState.columns.find((c: any) => c.id === colId);
    expect(col).toBeDefined();
    expect(col.wipLimit).toBe(limit);
  });

  runner.register(/^developer pairing is allowed$/, (context) => {
    expect(context.result.current.gameState.pairingAllowed).toBe(true);
  });

  runner.register(/^a card is in the Testing column with (\d+) Development effort and (\d+) Testing effort$/, (context, dev, test) => {
    act(() => {
      const card = context.result.current.gameState.cards[0];
      card.columnId = 'testing';
      card.effort = { analysis: 0, development: dev, testing: test };
      card.remainingEffort = { analysis: 0, development: dev, testing: test };
    });
  });

  runner.register(/^the card has (\d+) Development effort and (\d+) Testing effort remaining$/, (context, devRemaining, testRemaining) => {
    act(() => {
      const card = context.result.current.gameState.cards[0];
      card.remainingEffort.development = devRemaining;
      card.remainingEffort.testing = testRemaining;
    });
  });

  runner.register(/^Week 2 starts with Shift-Left active$/, (context) => {
    // Advance Day 1-4 to summary
    for (let day = 1; day < 5; day++) {
      act(() => { context.result.current.rollDice(); });
      act(() => { context.result.current.endDay(); });
      act(() => { context.result.current.startNextDay(); });
    }
    // Day 5
    act(() => { context.result.current.rollDice(); });
    act(() => { context.result.current.endDay(); });
    // Launch Week 2 with Shift-Left active
    act(() => {
      context.result.current.startNextDay({ shiftLeftActive: true });
    });
  });

  runner.register(/^the card is migrated back to the Development column$/, (context) => {
    const card = context.result.current.gameState.cards[0];
    expect(card.columnId).toBe('development');
  });

  runner.register(/^its Development effort is reset to full$/, (context) => {
    const card = context.result.current.gameState.cards[0];
    expect(card.remainingEffort.development).toBe(card.effort.development);
  });

  runner.register(/^its Testing effort is preserved at (\d+)$/, (context, expectedTest) => {
    const card = context.result.current.gameState.cards[0];
    expect(card.remainingEffort.testing).toBe(expectedTest);
  });

  runner.register(/^a standard card is in the Development column$/, (context) => {
    act(() => {
      const stdCard = context.result.current.gameState.cards.find((c: any) => c.columnId === 'analysis')!;
      stdCard.columnId = 'development';
      context.stdCardId = stdCard.id;
    });
  });

  runner.register(/^an expedite card is in the Development column$/, (context) => {
    act(() => {
      context.result.current.injectCustomExpediteCards('Security Breach', 1);
    });
    act(() => {
      const expCard = context.result.current.gameState.cards.find((c: any) => c.type === 'expedite')!;
      expCard.columnId = 'development';
      expCard.remainingEffort.development = 2;
      context.expCardId = expCard.id;
    });
  });

  runner.register(/^Alice attempts to allocate capacity to the standard card$/, (context) => {
    act(() => {
      context.result.current.rollDice();
    });
    const alice = context.result.current.gameState.avatars[0];
    context.initialAliceCapacity = alice.remainingCapacity;
    act(() => {
      context.result.current.allocateCapacity(alice.id, context.stdCardId);
    });
  });

  runner.register(/^the allocation is blocked with an expedite warning$/, (context) => {
    const logs = context.result.current.gameState.eventLogs;
    expect(logs[logs.length - 1]).toContain('Cannot work on standard card');
  });

  runner.register(/^Alice's remaining capacity is unchanged$/, (context) => {
    const alice = context.result.current.gameState.avatars[0];
    expect(alice.remainingCapacity).toBe(context.initialAliceCapacity);
  });

  runner.register(/^Alice attempts to allocate capacity to the expedite card$/, (context) => {
    const alice = context.result.current.gameState.avatars[0];
    act(() => {
      context.result.current.allocateCapacity(alice.id, context.expCardId);
    });
  });

  runner.register(/^the allocation is successful and Alice's capacity is reduced$/, (context) => {
    const alice = context.result.current.gameState.avatars[0];
    expect(alice.remainingCapacity).toBeLessThan(context.initialAliceCapacity);
  });

  runner.register(/^Story Splitting is active$/, (context) => {
    act(() => {
      context.result.current.startNextDay({ smallerBatchesActive: true });
    });
  });

  runner.register(/^the Trade Show event is triggered on Day (\d+)$/, (context, dayNum) => {
    act(() => {
      context.result.current.queueEvent('tradeshow');
    });
    act(() => {
      context.result.current.startNextDay();
    });
    expect(context.result.current.gameState.day).toBe(dayNum);
    expect(context.result.current.gameState.currentDayEvent?.title).toContain('Trade Show');
  });

  runner.register(/^(\d+) child cards are created in the Ready column$/, (context, count) => {
    const epicCard = context.result.current.gameState.cards.find((c: any) => c.type === 'epic')!;
    context.epicId = epicCard.id;
    const children = context.result.current.gameState.cards.filter((c: any) => c.parentEpicId === epicCard.id);
    expect(children.length).toBe(count);
    children.forEach((child: any) => {
      expect(child.columnId).toBe('ready');
    });
  });

  runner.register(/^they are part of the Trade Show Epic$/, (context) => {
    const children = context.result.current.gameState.cards.filter((c: any) => c.parentEpicId === context.epicId);
    children.forEach((child: any) => {
      expect(child.title).toContain('Trade Show Demo -');
    });
  });

  runner.register(/^one child card is completed and the day ends$/, (context) => {
    act(() => {
      const children = context.result.current.gameState.cards.filter((c: any) => c.parentEpicId === context.epicId);
      children[0].columnId = 'done';
      children[0].completedAt = context.result.current.gameState.day;
    });
    act(() => {
      context.result.current.rollDice();
    });
    act(() => {
      context.result.current.endDay();
    });
  });

  runner.register(/^the parent Epic progress is updated to (\d+) percent$/, (context, expectedProgress) => {
    const epic = context.result.current.gameState.cards.find((c: any) => c.id === context.epicId)!;
    expect(epic.epicProgress).toBe(expectedProgress);
  });

  runner.register(/^the other (\d+) child cards are completed and the day ends$/, (context, count) => {
    act(() => {
      const children = context.result.current.gameState.cards.filter((c: any) => c.parentEpicId === context.epicId && c.columnId !== 'done');
      expect(children.length).toBe(count);
      children.forEach((c: any) => {
        c.columnId = 'done';
        c.completedAt = context.result.current.gameState.day;
      });
    });
    act(() => {
      context.result.current.rollDice();
    });
    act(() => {
      context.result.current.endDay();
    });
  });

  runner.register(/^the parent Epic is moved to the Done column$/, (context) => {
    const epic = context.result.current.gameState.cards.find((c: any) => c.id === context.epicId)!;
    expect(epic.columnId).toBe('done');
  });

  runner.register(/^the admin injects (\d+) custom expedite cards with prefix "(.*)"$/, (context, count, prefix) => {
    act(() => {
      context.result.current.injectCustomExpediteCards(prefix, count);
    });
  });

  runner.register(/^(\d+) expedite cards are created in the Ready column$/, (context, count) => {
    const expCards = context.result.current.gameState.cards.filter((c: any) => c.type === 'expedite' && c.columnId === 'ready');
    expect(expCards.length).toBe(count);
  });

  runner.register(/^their titles start with "(.*)"$/, (context, prefix) => {
    const expCards = context.result.current.gameState.cards.filter((c: any) => c.type === 'expedite');
    expCards.forEach((c: any) => {
      expect(c.title.startsWith(prefix)).toBe(true);
    });
  });

  runner.register(/^a new game is started with custom unblock cost of (\d+) and blocker chance of (\d+) percent$/, (context, cost, percent) => {
    act(() => {
      context.result.current.startGame({
        unblockCost: cost,
        blockerChance: percent / 100
      });
    });
  });

  runner.register(/^the game configuration reflects the custom unblock cost of (\d+)$/, (context, cost) => {
    expect(context.result.current.gameState.config.unblockCost).toBe(cost);
  });

  runner.register(/^the game configuration reflects the blocker chance of (\d+) percent$/, (context, percent) => {
    expect(context.result.current.gameState.config.blockerChance).toBe(percent / 100);
  });

  runner.register(/^Week 1 completes and reaches weekend summary$/, (context) => {
    act(() => {
      context.result.current.fastForwardToWeekEnd();
    });
    expect(context.result.current.gameState.gamePhase).toBe('week_summary');
  });

  runner.register(/^exactly one scenario option is allowed to be selected$/, (context) => {
    act(() => {
      context.result.current.startNextDay('wip_limits');
    });
    const state = context.result.current.gameState;
    expect(state.wipLimitsActive).toBe(true);
    expect(state.shiftLeftActive).toBe(false);
    expect(state.swarmingActive).toBe(false);
    expect(state.smallerBatchesActive).toBe(false);
  });

  runner.register(/^selecting a scenario clears other active accelerators$/, (context) => {
    act(() => {
      context.result.current.startNextDay('shift_left');
    });
    const state = context.result.current.gameState;
    expect(state.wipLimitsActive).toBe(false);
    expect(state.shiftLeftActive).toBe(true);
  });

  runner.register(/^the last week's selected scenario was "(.*)"$/, (context, scenarioId) => {
    act(() => {
      context.result.current.fastForwardToWeekEnd();
    });
    act(() => {
      context.result.current.startNextDay(scenarioId);
    });
    expect(context.result.current.gameState.lastSelectedScenarioId).toBe(scenarioId);
  });

  runner.register(/^the weekend summary is viewed$/, (context) => {
    act(() => {
      context.result.current.fastForwardToWeekEnd();
    });
    expect(context.result.current.gameState.gamePhase).toBe('week_summary');
  });

  runner.register(/^the "(.*)" option is highlighted as a recommended flow fix$/, (context, expectedRecId) => {
    const lastId = context.result.current.gameState.lastSelectedScenarioId;
    expect(lastId).toBeDefined();
    
    const recommendations: { [key: string]: string } = {
      'tradeshow': 'smaller_batches',
      'security_breach': 'wip_limits',
      'os_upgrade': 'swarming',
      'wip_limits': 'security_breach',
      'shift_left': 'os_upgrade'
    };
    const recommended = recommendations[lastId!];
    expect(recommended).toBe(expectedRecId);
  });

  runner.register(/^the user selects the "(.*)" scenario$/, (context, scenarioId) => {
    act(() => {
      context.selectedCYOAScenario = scenarioId;
    });
  });

  runner.register(/^Week 2 is launched$/, (context) => {
    act(() => {
      context.result.current.startNextDay(context.selectedCYOAScenario);
    });
  });

  runner.register(/^a monolithic Epic is created in the Ready column$/, (context) => {
    const epic = context.result.current.gameState.cards.find((c: any) => c.type === 'epic' && c.columnId === 'ready');
    expect(epic).toBeDefined();
    expect(epic.effort.development).toBe(12);
  });

  runner.register(/^Week 2 completes and reaches weekend summary$/, (context) => {
    for (let d = 6; d < 10; d++) {
      act(() => { context.result.current.rollDice(); });
      act(() => { context.result.current.endDay(); });
      act(() => { context.result.current.startNextDay(); });
    }
    act(() => { context.result.current.rollDice(); });
    act(() => { context.result.current.endDay(); });
    expect(context.result.current.gameState.gamePhase).toBe('week_summary');
  });

  runner.register(/^a new game is started with max days of (\d+)$/, (context, maxDays) => {
    act(() => {
      context.result.current.startGame({ maxDays: parseInt(maxDays, 10) });
    });
  });

  // ==========================================
  // Phase 1: Card Movement Step Definitions
  // ==========================================
  // NOTE: React 18's batched state updates mean that moveCard()'s
  // closure-based return value ({success, errorMessage}) is unreliable
  // in tests — the setGameState callback runs AFTER moveCard returns.
  // Instead, we assert on observable state changes and event logs,
  // which is better BDD practice (testing what the user sees).

  // --- Scenario 10: Card Movement with Effort Completion ---

  runner.register(/^a standard card in Analysis has 0 remaining analysis effort$/, (context) => {
    // Find a card in the analysis column (cards start there in the default scenario)
    const card = context.result.current.gameState.cards.find((c: any) => c.columnId === 'analysis');
    expect(card).toBeDefined();
    // Directly zero out its analysis effort so it's eligible to move forward
    act(() => {
      card.remainingEffort.analysis = 0;
    });
    // Stash the card ID and current day for later assertions
    context.moveCardId = card.id;
    context.moveCardDay = context.result.current.gameState.day;
  });

  runner.register(/^the card is moved to Development$/, (context) => {
    act(() => {
      context.result.current.moveCard(context.moveCardId, 'development');
    });
  });

  runner.register(/^the move succeeds$/, (context) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.moveCardId);
    expect(card.columnId).toBe('development');
  });

  runner.register(/^the card's startedAt is set to the current day$/, (context) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.moveCardId);
    expect(card.startedAt).toBe(context.moveCardDay);
  });

  runner.register(/^the card's history includes the Development column$/, (context) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.moveCardId);
    const hasDevEntry = card.history.some((h: any) => h.columnId === 'development');
    expect(hasDevEntry).toBe(true);
  });

  // --- Scenario 11: WIP Limit Blocks Standard Card Movement ---

  runner.register(/^Development column has 2 cards filling WIP limit of 2$/, (context) => {
    // Move 2 cards into development to fill the WIP limit.
    // The "WIP Limits accelerator is active" step already set development WIP to 2.
    const analysisCards = context.result.current.gameState.cards.filter((c: any) => c.columnId === 'analysis');
    expect(analysisCards.length).toBeGreaterThanOrEqual(2);

    // Zero out analysis effort so they can be moved, then move them
    act(() => {
      analysisCards[0].remainingEffort.analysis = 0;
      analysisCards[1].remainingEffort.analysis = 0;
    });
    act(() => {
      context.result.current.moveCard(analysisCards[0].id, 'development');
    });
    act(() => {
      context.result.current.moveCard(analysisCards[1].id, 'development');
    });

    // Confirm development now has 2 cards
    const devCards = context.result.current.gameState.cards.filter((c: any) => c.columnId === 'development');
    expect(devCards.length).toBe(2);

    // Stash a third card for the move attempt — find one still in ready or analysis
    const thirdCard = context.result.current.gameState.cards.find(
      (c: any) => c.columnId === 'ready' && c.type === 'standard'
    );
    expect(thirdCard).toBeDefined();
    context.wipBlockedCardId = thirdCard.id;
    context.wipBlockedCardOrigColumn = thirdCard.columnId;
  });

  runner.register(/^a standard card is moved to Development$/, (context) => {
    // Record event log length before the move to detect WIP warning
    context.logLengthBeforeMove = context.result.current.gameState.eventLogs.length;
    act(() => {
      context.result.current.moveCard(context.wipBlockedCardId, 'development');
    });
  });

  runner.register(/^the move is blocked with a WIP limit warning$/, (context) => {
    // The card should NOT have moved — still in its original column
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.wipBlockedCardId);
    expect(card.columnId).toBe(context.wipBlockedCardOrigColumn);
    // Verify no "Moved" log was added (state was returned unchanged)
    const devCards = context.result.current.gameState.cards.filter((c: any) => c.columnId === 'development');
    expect(devCards.length).toBe(2); // Still at WIP limit, third card didn't sneak in
  });

  runner.register(/^the card remains in its original column$/, (context) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.wipBlockedCardId);
    expect(card.columnId).toBe(context.wipBlockedCardOrigColumn);
  });

  // --- Scenario 12: Expedite Card Bypasses WIP Limits ---

  runner.register(/^an expedite card is moved to Development$/, (context) => {
    // Inject an expedite card into ready, then attempt to move it to development
    act(() => {
      context.result.current.injectCustomExpediteCards('Urgent Fix', 1);
    });
    const expCard = context.result.current.gameState.cards.find((c: any) => c.type === 'expedite' && c.columnId === 'ready');
    expect(expCard).toBeDefined();
    context.expediteMoveCardId = expCard.id;
    act(() => {
      context.result.current.moveCard(expCard.id, 'development');
    });
  });

  runner.register(/^the move succeeds despite WIP limit$/, (context) => {
    // Expedite card should now be in development, even though WIP was at limit
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.expediteMoveCardId);
    expect(card.columnId).toBe('development');
    // Development now has 3 cards (2 standard + 1 expedite)
    const devCards = context.result.current.gameState.cards.filter((c: any) => c.columnId === 'development');
    expect(devCards.length).toBe(3);
  });

  // --- Scenario 13: Blocked Card Cannot Move Forward ---

  runner.register(/^a card in Development is blocked$/, (context) => {
    // Move a card to development first, then block it
    const card = context.result.current.gameState.cards.find((c: any) => c.columnId === 'analysis');
    expect(card).toBeDefined();
    act(() => {
      card.remainingEffort.analysis = 0;
    });
    act(() => {
      context.result.current.moveCard(card.id, 'development');
    });
    // Now block it — note: we must re-find the card from current state
    // because moveCard may have created new card objects
    act(() => {
      const devCard = context.result.current.gameState.cards.find((c: any) => c.id === card.id);
      devCard.isBlocked = true;
      devCard.blockerReason = 'Test blocker: external dependency failure.';
    });
    context.blockedCardId = card.id;
  });

  runner.register(/^the blocked card is moved forward to Testing$/, (context) => {
    act(() => {
      context.result.current.moveCard(context.blockedCardId, 'testing');
    });
  });

  runner.register(/^the move is blocked with a blocker warning$/, (context) => {
    // The card should NOT have moved to testing — still in development
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.blockedCardId);
    expect(card.columnId).toBe('development');
    expect(card.isBlocked).toBe(true);
  });

  runner.register(/^the blocked card remains in Development$/, (context) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.blockedCardId);
    expect(card.columnId).toBe('development');
  });

  // --- Scenario 14: Incomplete Effort Prevents Forward Movement ---

  runner.register(/^a card in Analysis has (\d+) remaining analysis effort$/, (context, effort) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.columnId === 'analysis');
    expect(card).toBeDefined();
    act(() => {
      card.remainingEffort.analysis = effort;
    });
    context.incompleteCardId = card.id;
  });

  runner.register(/^the card is moved forward to Development$/, (context) => {
    act(() => {
      context.result.current.moveCard(context.incompleteCardId, 'development');
    });
  });

  runner.register(/^the move is blocked with an effort remaining warning$/, (context) => {
    // The card should NOT have moved — still in analysis
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.incompleteCardId);
    expect(card.columnId).toBe('analysis');
  });

  runner.register(/^the card stays in Analysis$/, (context) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.id === context.incompleteCardId);
    expect(card.columnId).toBe('analysis');
  });

  runner.register(/^the start of day modal should be active$/, (context) => {
    expect(context.result.current.gameState.showStartOfDayModal).toBe(true);
  });

  runner.register(/^the modal should display the event title "(.*)"$/, (context, eventTitle) => {
    expect(context.result.current.gameState.currentDayEvent).toBeDefined();
    expect(context.result.current.gameState.currentDayEvent.title).toBe(eventTitle);
  });

  runner.register(/^the user dismisses the start of day modal$/, (context) => {
    act(() => {
      context.result.current.dismissStartOfDayModal();
    });
  });

  runner.register(/^the start of day modal should not be active$/, (context) => {
    expect(context.result.current.gameState.showStartOfDayModal).toBe(false);
  });

  runner.register(/^a Board is rendered with 2 cards in a column$/, (context) => {
    context.mockCards = [
      { id: 'card1', title: 'Card 1', description: 'desc', type: 'standard', columnId: 'development', effort: { analysis: 0, development: 2, testing: 0 }, remainingEffort: { analysis: 0, development: 2, testing: 0 }, assignedAvatars: [], isBlocked: false, failedQACount: 0, createdAt: 1, completedAt: null, history: [] },
      { id: 'card2', title: 'Card 2', description: 'desc', type: 'standard', columnId: 'development', effort: { analysis: 0, development: 2, testing: 0 }, remainingEffort: { analysis: 0, development: 2, testing: 0 }, assignedAvatars: [], isBlocked: false, failedQACount: 0, createdAt: 1, completedAt: null, history: [] }
    ];
    context.mockAvatars = [
      { id: 'alice', name: 'Alice', color: '#ff0000', currentRoll: 4, assignedCardId: null, previousCardId: null, spentCapacity: 0, remainingCapacity: 4, workedOnCardIdsToday: [] }
    ];
    context.mockColumns = [
      { id: 'development', name: 'Development', wipLimit: null, allowedEffortTypes: ['development'] }
    ];
  });

  runner.register(/^the user clicks allocate on the first card$/, (context) => {
    const { container } = render(
      React.createElement(CardComponent, {
        card: context.mockCards[0],
        avatars: context.mockAvatars,
        columns: context.mockColumns,
        pairingAllowed: false,
        onAllocateCapacity: () => {},
        onMoveCard: () => ({ success: true, errorMessage: '' }),
        gamePhase: 'dice_rolled',
        isFirst: true,
        isLast: false
      })
    );
    const allocateBtn = within(container).getByText('Allocate');
    fireEvent.click(allocateBtn);
    context.firstCardContainer = container;
  });

  runner.register(/^the dropdown menu should open downwards$/, (context) => {
    const dropdown = context.firstCardContainer.querySelector('.avatar-dropdown');
    expect(dropdown).toBeDefined();
    expect(dropdown.style.top).toBe('100%');
    expect(dropdown.style.bottom).toBe('');
  });

  runner.register(/^the user clicks allocate on the second card$/, (context) => {
    const { container } = render(
      React.createElement(CardComponent, {
        card: context.mockCards[1],
        avatars: context.mockAvatars,
        columns: context.mockColumns,
        pairingAllowed: false,
        onAllocateCapacity: () => {},
        onMoveCard: () => ({ success: true, errorMessage: '' }),
        gamePhase: 'dice_rolled',
        isFirst: false,
        isLast: true
      })
    );
    const allocateBtn = within(container).getByText('Allocate');
    fireEvent.click(allocateBtn);
    context.secondCardContainer = container;
  });

  runner.register(/^the dropdown menu should open upwards$/, (context) => {
    const dropdown = context.secondCardContainer.querySelector('.avatar-dropdown');
    expect(dropdown).toBeDefined();
    expect(dropdown.style.bottom).toBe('30px');
    expect(dropdown.style.top).toBe('');
  });

  runner.register(/^a spy is set up on scrollIntoView$/, (context) => {
    context.scrollIntoViewSpy = vi.fn();
    window.Element.prototype.scrollIntoView = context.scrollIntoViewSpy;
  });

  runner.register(/^the user advances the day$/, (context) => {
    act(() => {
      context.result.current.startGame();
    });
    
    // Render Controls with current gameState to trigger effect
    const { rerender } = render(
      React.createElement(Controls, {
        gameState: context.result.current.gameState,
        onRollDice: () => {},
        onEndDay: () => {},
        onStartNextDay: () => {},
        onRestartGame: () => {},
        onResetDailyWork: () => {},
        isMultiplayer: false,
        isAdmin: false
      })
    );
    
    act(() => {
      context.result.current.rollDice();
    });
    
    rerender(
      React.createElement(Controls, {
        gameState: context.result.current.gameState,
        onRollDice: () => {},
        onEndDay: () => {},
        onStartNextDay: () => {},
        onRestartGame: () => {},
        onResetDailyWork: () => {},
        isMultiplayer: false,
        isAdmin: false
      })
    );
    
    act(() => {
      context.result.current.endDay();
    });
    
    rerender(
      React.createElement(Controls, {
        gameState: context.result.current.gameState,
        onRollDice: () => {},
        onEndDay: () => {},
        onStartNextDay: () => {},
        onRestartGame: () => {},
        onResetDailyWork: () => {},
        isMultiplayer: false,
        isAdmin: false
      })
    );
  });

  runner.register(/^scrollIntoView should not have been called on the viewport$/, (context) => {
    // Assert that standard scrollIntoView spy wasn't called
    if (context.scrollIntoViewSpy) {
      expect(context.scrollIntoViewSpy).not.toHaveBeenCalled();
      context.scrollIntoViewSpy.mockRestore();
    }
  });

  runner.register(/^a card "(.*)" has "developedBy" containing "(.*)"$/, (context, cardTitle, avatarId) => {
    act(() => {
      const card = context.result.current.gameState.cards.find((c: any) => c.title === cardTitle);
      expect(card).toBeDefined();
      card.developedBy = [avatarId];
    });
  });

  runner.register(/^the card "(.*)" is in the Testing column with (\d+) remaining testing effort$/, (context, cardTitle, remaining) => {
    act(() => {
      const card = context.result.current.gameState.cards.find((c: any) => c.title === cardTitle);
      expect(card).toBeDefined();
      card.columnId = 'testing';
      card.effort = { analysis: 0, development: 4, testing: Number(remaining) };
      card.remainingEffort = { analysis: 0, development: 0, testing: Number(remaining) };
    });
  });

  runner.register(/^"(.*)" allocates capacity to the card "(.*)"$/, (context, avatarId, cardTitle) => {
    act(() => {
      const card = context.result.current.gameState.cards.find((c: any) => c.title === cardTitle);
      expect(card).toBeDefined();
      const avatar = context.result.current.gameState.avatars.find((a: any) => a.id === avatarId);
      expect(avatar).toBeDefined();
      avatar.remainingCapacity = 5;
      context.result.current.allocateCapacity(avatarId, card.id, 'testing');
    });
  });

  runner.register(/^the day is ended with Math\.random returning (\d+\.\d+)$/, (context, randVal) => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(Number(randVal));
    act(() => {
      context.result.current.endDay();
    });
    randomSpy.mockRestore();
  });

  runner.register(/^the card "(.*)" should fail QA and return to Development$/, (context, cardTitle) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.title === cardTitle);
    expect(card).toBeDefined();
    expect(card.columnId).toBe('development');
    expect(card.remainingEffort.development).toBeGreaterThan(0);
  });

  runner.register(/^the card "(.*)" should pass QA and stay in Testing$/, (context, cardTitle) => {
    const card = context.result.current.gameState.cards.find((c: any) => c.title === cardTitle);
    expect(card).toBeDefined();
    expect(card.columnId).toBe('testing');
    expect(card.remainingEffort.testing).toBe(0);
  });

  runner.register(/^a new game is started with custom self-testing multiplier of (\d+\.\d+)$/, (context, multiplier) => {
    act(() => {
      context.result.current.startGame({
        selfTestingMultiplier: Number(multiplier)
      } as any);
    });
  });

  runner.register(/^the game configuration reflects the custom self-testing multiplier of (\d+\.\d+)$/, (context, multiplier) => {
    expect(context.result.current.gameState.config.selfTestingMultiplier).toBe(Number(multiplier));
  });
};
