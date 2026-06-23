import { expect } from 'vitest';
import { act } from '@testing-library/react';
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
};



