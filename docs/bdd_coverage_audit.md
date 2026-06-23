# BDD Test Coverage Audit & Recommended Scenarios

> **Audit Date**: 2026-06-23
> **Status**: Phase 1 in progress. Phases 2-4 pending.

## Current State

### Existing BDD Scenarios (9 total in `src/features/kanban_simulation.feature`)

| # | Scenario | Coverage Target |
|---|----------|----------------|
| 1 | Visualize and Limit WIP Enforcements | WIP limits, pairing flag |
| 2 | Shift-Left Continuous Testing Migration | Card migration, effort reset |
| 3 | Expedite Class of Service Urgency | Blocking standard work, expedite priority |
| 4 | Monolithic Trade Show Epic vs Story Splitting | Auto-split, epic rollup, epic completion |
| 5 | Urgent Work Custom Injector | Custom expedite injection |
| 6 | Custom Simulation Configuration Settings | Config overrides |
| 7 | CYOA Weekend Selector Constraints | Single selection, accelerator clearing |
| 8 | Related Scenario Recommendations | RECOMMENDATION_MAP lookups |
| 9 | E2E CYOA Pathway | Multi-week lifecycle |

### Existing Unit Tests (12 total in `src/useGameState.test.ts`)

Covers: init state, scenario load, dice roll, capacity allocation, context-switch penalty, reset daily work, backlog replenish, week summary transition, shift-left rollback, expedite blocking, story splitting, CYOA selection.

---

## Coverage Gap Analysis

### Core Engine Coverage (`src/useGameState.ts` — 1,386 lines)

| Function | BDD? | Unit? | Risk |
|----------|------|-------|------|
| `startGame()` | ✅ | ✅ | Low |
| `rollDice()` | ✅ | ✅ | Low |
| `allocateCapacity()` | ✅ Partial | ✅ | 🟡 Medium — helper pairing, unblock roll, swarming bypass untested |
| `resetDailyWork()` | ❌ | ✅ | 🟡 Medium |
| `moveCard()` | ❌ | ❌ | 🔴 **HIGH — zero coverage anywhere** |
| `endDay()` | ✅ Partial | ✅ | 🟡 Medium — blocker gen, QA rework, metrics untested |
| `startNextDay()` | ✅ | ✅ | 🟡 Medium — OS Upgrade, Security Breach events untested |
| `setWipLimit()` | ❌ | ❌ | 🟡 Medium |
| `renameColumn()` | ❌ | ❌ | 🟢 Low (sandbox only) |
| `replenishBacklog()` | ❌ | ✅ | 🟡 Medium — smaller batches halving untested |
| `fastForwardToWeekEnd()` | ✅ Indirect | ✅ Indirect | 🟢 Low |
| `injectCustomExpediteCards()` | ✅ | ✅ Indirect | 🟢 Low |
| `splitEpic()` | ❌ Manual trigger | ✅ | 🟡 Medium |
| `queueEvent()` | ✅ Indirect | ❌ | 🟢 Low |

### Multiplayer Engine (`src/useMultiplayerState.ts` — 1,477 lines)

> **CRITICAL**: 0% test coverage. Every function in this file is completely untested.

### Component Files (0% coverage)

| Component | Lines | Testable Logic |
|-----------|-------|---------------|
| `Board.tsx` | 221 | WIP exceeded indicators, column layout |
| `Controls.tsx` | 741 | Phase-conditional rendering, CYOA selector |
| `CardComponent.tsx` | 564 | Effort bars, context-switch display |
| `Dashboard.tsx` | 740 | CFD data, cycle/lead time KPIs |

---

## Recommended Scenarios by Phase

### Phase 1: Critical Gaps (Scenarios 10-14) — `moveCard()` coverage
- Scenario 10: Card Movement with Effort Completion
- Scenario 11: WIP Limit Blocks Standard Card Movement
- Scenario 12: Expedite Card Bypasses WIP Limits
- Scenario 13: Blocked Card Cannot Move Forward
- Scenario 14: Incomplete Effort Prevents Forward Movement

### Phase 2: Important Mechanics (Scenarios 15-20)
- Scenario 15: Context Switch Penalty on Card Change
- Scenario 16: Swarming Eliminates Context Switch Penalty
- Scenario 17: Pairing Helper Mechanics at 2:1 Cost
- Scenario 18: Reset Daily Work Reverts All Allocations
- Scenario 19: Manual Epic Splitting by Player
- Scenario 20: Smaller Batches Halves Backlog Effort

### Phase 3: End-of-Day + Events + Metrics (Scenarios 21-29)
- Scenario 21: QA Rework Sends Card Back to Development
- Scenario 22: Shift-Left Bypasses QA Rework
- Scenario 23: Pairing Reduces Blocker Probability
- Scenario 24: Game Over Transition at Max Days
- Scenario 25: Weekend Summary Transition Every 5 Days
- Scenario 26: Cross-Day Context Switch From Yesterday
- Scenario 27: Shift-Left Enables Concurrent Dev and Test Effort
- Scenario 28: Daily Metrics Logging Accuracy
- Scenario 29: Lead Time and Cycle Time Calculations

### Phase 4: Multiplayer Engine Testing Infrastructure
- Requires Firestore mocking strategy (see risk register)

## Coverage Impact Summary

| Phase | Scenarios | Est. Coverage Lift |
|-------|-----------|-------------------|
| Phase 1 | 5 new | ~55-60% → ~65% |
| Phase 2 | 6 new | → ~80% |
| Phase 3 | 9 new | → ~93% |
| Phase 4 | TBD | Multiplayer from 0% |
