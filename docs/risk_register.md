# Risk Register — Antigravity Kanban Game

> **Last Updated**: 2026-06-23
> **Owner**: Product Owner (braz)

## Active Risks

### RISK-001: Multiplayer Engine (useMultiplayerState.ts) — Zero Test Coverage

| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | HIGH |
| **Likelihood** | MEDIUM |
| **Impact** | Multiplayer game logic (1,477 lines) duplicates all single-player state management using Firestore transactions. Any regression in this code would be undetectable until runtime. |
| **Mitigation** | Phase 4 of the BDD coverage audit proposes building Firestore mocking infrastructure to enable automated testing. |
| **Owner Decision** | Product Owner has acknowledged this risk and accepted deferral. Firebase mocking will be implemented in a future phase to avoid hitting Firebase Spark tier usage limits during development. |
| **Review Trigger** | Review when: (a) implementing Phase 4 of BDD audit, (b) any multiplayer bugs are reported, (c) Firestore security rules change, or (d) a new AI agent picks up this project. |
| **Date Accepted** | 2026-06-23 |

### RISK-002: Firebase Spark Tier Usage Limits During Testing

| Field | Value |
|-------|-------|
| **Status** | 🟡 MITIGATED |
| **Severity** | MEDIUM |
| **Likelihood** | LOW (with mocking) |
| **Impact** | Running automated tests that hit real Firestore could exhaust the Spark free tier (50K reads / 20K writes per day), blocking both development and production usage. |
| **Mitigation** | All BDD and unit tests use mocked state (React hooks with `renderHook`) — no real Firestore calls. Multiplayer tests (Phase 4) will use `@firebase/rules-unit-testing` emulator or mock adapters, NOT production Firestore. |
| **Owner Decision** | Product Owner directed proper mocking to minimize Firebase usage. If database connectivity problems arise, they will be addressed separately. |
| **Review Trigger** | Review when: (a) multiplayer tests are implemented, (b) Firebase billing alerts trigger, or (c) test suite begins making real network calls. |
| **Date Accepted** | 2026-06-23 |

---

## Resolved Risks

_(None yet)_

---

## Notes for AI Agents

If you are an AI agent resuming work on this project:

1. **Read `docs/bdd_coverage_audit.md`** for the full test gap analysis and phased implementation plan.
2. **RISK-001 is the highest priority risk** — the multiplayer engine has zero automated tests. Any changes to `src/useMultiplayerState.ts` should be made with extreme caution.
3. **All tests must use mocking** — do NOT make real Firestore calls in test suites. The Product Owner has explicitly directed this to conserve Firebase Spark tier quotas.
4. **Follow `.agents/AGENTS.md` rules** — BDD-first development, 95% coverage floor, zero-defect handovers, no manual verification in plans.
