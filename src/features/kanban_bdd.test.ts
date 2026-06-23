// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useGameState } from '../useGameState';
import { BddRunner } from './bdd_runner';
import { registerSteps } from './step_definitions/kanban_steps';
import { beforeEach } from 'vitest';

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

const runner = new BddRunner();
registerSteps(runner);

const featureContent = `Feature: Kanban Simulation Flow Accelerators and Scenarios

  Scenario: Visualize and Limit WIP Enforcements
    Given a new game is started
    And WIP Limits accelerator is active
    Then Analysis column WIP limit is 2
    And Development column WIP limit is 2
    And Testing column WIP limit is 1
    And developer pairing is allowed

  Scenario: Shift-Left Continuous Testing Migration
    Given a new game is started
    And a card is in the Testing column with 6 Development effort and 3 Testing effort
    And the card has 0 Development effort and 2 Testing effort remaining
    When Week 2 starts with Shift-Left active
    Then the card is migrated back to the Development column
    And its Development effort is reset to full
    And its Testing effort is preserved at 2

  Scenario: Expedite Class of Service Urgency
    Given a new game is started
    And a standard card is in the Development column
    And an expedite card is in the Development column
    When Alice attempts to allocate capacity to the standard card
    Then the allocation is blocked with an expedite warning
    And Alice's remaining capacity is unchanged
    When Alice attempts to allocate capacity to the expedite card
    Then the allocation is successful and Alice's capacity is reduced

  Scenario: Monolithic Trade Show Epic vs Story Splitting
    Given a new game is started
    And Story Splitting is active
    When the Trade Show event is triggered on Day 3
    Then 3 child cards are created in the Ready column
    And they are part of the Trade Show Epic
    When one child card is completed and the day ends
    Then the parent Epic progress is updated to 33 percent
    When the other 2 child cards are completed and the day ends
    Then the parent Epic progress is updated to 100 percent
    And the parent Epic is moved to the Done column

  Scenario: Urgent Work Custom Injector
    Given a new game is started
    When the admin injects 2 custom expedite cards with prefix "Database Outage"
    Then 2 expedite cards are created in the Ready column
    And their titles start with "Database Outage"

  Scenario: Custom Simulation Configuration Settings
    Given a new game is started with custom unblock cost of 3 and blocker chance of 25 percent
    Then the game configuration reflects the custom unblock cost of 3
    And the game configuration reflects the blocker chance of 25 percent

  Scenario: Choose Your Own Adventure Weekend Selector Constraints
    Given a new game is started
    When Week 1 completes and reaches weekend summary
    Then exactly one scenario option is allowed to be selected
    And selecting a scenario clears other active accelerators

  Scenario: Related Scenario Recommendations
    Given a new game is started
    And the last week's selected scenario was "tradeshow"
    When the weekend summary is viewed
    Then the "smaller_batches" option is highlighted as a recommended flow fix

  Scenario: End-to-End Choose Your Own Adventure Pathway
    Given a new game is started with max days of 15
    When Week 1 completes and reaches weekend summary

    And the user selects the "tradeshow" scenario
    And Week 2 is launched
    Then a monolithic Epic is created in the Ready column
    When Week 2 completes and reaches weekend summary
    Then the "smaller_batches" option is highlighted as a recommended flow fix
`;


runner.runFeature(featureContent, () => {
  const { result } = renderHook(() => useGameState());
  return { result };
});
