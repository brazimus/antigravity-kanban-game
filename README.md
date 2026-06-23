# Antigravity Kanban Game

An interactive, premium educational web application built to simulate and teach core Agile and Kanban flow mechanics. Players manage a software squad through a 10-day release script, testing two different operating models in isolation: **Week 1 (Unconstrained WIP)** which illustrates the bottlenecks of multitasking, and **Week 2 (Kanban WIP Limits)** which demonstrates how focus, pairing, and WIP limits accelerate throughput and reduce cycle times.

---

## 🏛️ Code Architecture & Paradigm Analogies

To help new contributors understand the codebase quickly, here is a mapping of the primary reactive paradigms in the React + TypeScript frontend to classic Perl and SQL/relational concepts:

### 1. The Core State Engine (`src/useGameState.ts`)
*   **SQL Relational Concept (ACID-like Transactions)**: Treat the `gameState` object as a central relational database schema. Tables include `cards`, `columns`, and `avatars`. State updates (e.g., allocating capacity or moving cards) are handled like ACID transactions that assert consistency check constraints (like verifying column WIP limits before allowing a card write/pull, and rolling back allocations if they violate expedite card exclusivity).
*   **Perl Concept (Associative Hashes & Array Mappings)**: Card progress calculations and capacity allocations rely heavily on patterns equivalent to Perl associative hashes (e.g., mapping developer IDs to their capacities: `$avatar_cap{$id} = $cap`) and list utilities (mapping and filtering card arrays like `map` and `grep` blocks in Perl to process developer allocations).

### 2. Multiplayer State Synchronizer (`src/useMultiplayerState.ts`)
*   **SQL Relational Concept (Continuous Replication Cursors)**: Works like a real-time database replication cursor. It establishes continuous event listener streams (`onSnapshot` cursors) on Firestore database collections (tables) and replicates state mutations down to all client nodes, executing atomic transactions locally to keep client boards in perfect sync.

### 3. Lightweight Gherkin BDD Parser (`src/features/bdd_runner.ts`)
*   **Perl Concept (Regex Line-by-Line Parsing)**: The custom Gherkin step matching engine reads feature text lines, strips structural keywords (`Given `, `When `, `Then `) using regex pattern substitutions, and matches steps against registered handler regexes (similar to Perl `m/pattern/` evaluations) to capture matched groups and execute tests.

---

## 📂 Codebase "What's What" Directory Map

Here is the structural map of the repository's files and folders:

```text
├── .agents/                    # Workspace configuration & developer guidelines
│   └── AGENTS.md               # Continuous integration, testing rules, and TDD policies
│
├── docs/                       # Project documentation, risk registers, and audits
│   ├── bdd_scenarios_map.md    # Detailed persona mapping & test implementation strategies
│   ├── bdd_coverage_audit.md   # Phased gap analysis of core engine test coverage
│   └── risk_register.md        # Registry of project risks (e.g., multiplayer 0% test coverage)
│
├── src/                        # Main React application source code
│   ├── components/             # React visual UI components
│   │   ├── Board.tsx           # Kanban board columns and layout container
│   │   ├── CardComponent.tsx   # Kanban card layout, radial dials, and avatar assignments
│   │   ├── Controls.tsx        # Side control panel: dice rolling, progression buttons, logs
│   │   ├── Dashboard.tsx       # Flow metrics tab: CFD, Control Chart, WIP aging graphs
│   │   └── MultiplayerLobby.tsx# Connection lobby screen for multiplayer rooms
│   │
│   ├── features/               # BDD Feature files and test bridge code
│   │   ├── step_definitions/   # Vitest step handlers matching Gherkin text definitions
│   │   │   └── kanban_steps.ts # Step definitions verifying useGameState actions & layouts
│   │   ├── bdd_runner.ts       # Custom Gherkin scenario parser and runner
│   │   ├── kanban_bdd.test.ts  # Test bridge executing scenarios in Vitest JSDOM
│   │   └── kanban_simulation.feature # Gherkin feature file detailing game scenarios
│   │
│   ├── firebase.ts             # Client-side configuration mapping to Google Firebase SDK
│   ├── useGameState.ts         # Central single-player logic hook and action dispatchers
│   ├── useMultiplayerState.ts  # Central multiplayer synchronization hook and Firestore actions
│   ├── scenarios.ts            # Configuration files defining events and startup cards
│   ├── types.ts                # TypeScript types & interfaces defining domain models
│   ├── index.css               # Core styling stylesheet (Glassmorphic cards, layout grids)
│   ├── App.tsx                 # Root layout container, routing, tabs, and modals
│   └── main.tsx                # Application bootstrap entrypoint
│
├── README.md                   # Repository landing page
├── tsconfig.json               # TypeScript configuration settings
└── vite.config.ts              # Vite bundling, environment variables injection, and dev server config
```

---

## 👥 User Personas & BDD Scenario Map

We support three key user personas. For detailed use cases and testing walkthroughs, read the full [User Personas & BDD Scenarios Map](file:///Users/braz/Projects/Antigravity%20Kanban%20Game/docs/bdd_scenarios_map.md):

1.  **Individual Player (Single-Player Explorer)**: An agile learner running the scripted simulation to test flow accelerators (WIP limits, story splitting, swarming) and analyze metrics.
    *   *BDD Scenarios*: Scenarios 1-4, 7-10, 14-15.
2.  **Team Player (Multiplayer Client)**: A participant in a training session joining a shared room code to coordinate allocations and roll capacity dice in real-time.
    *   *Firestore sync integration*: real-time listeners and transactional allocations.
3.  **Admin / Instructor (Multiplayer Host)**: A coach hosting a room, controlling day progression, adjusting WIP limits, and injecting custom outage events.
    *   *BDD Scenarios*: Scenarios 5-6, 11-13, 16-17.

---

## 🛠️ Quick Start & Development Guide

### Prerequisites
*   Node.js (v20+ recommended)
*   npm

### Installation
Staging dependencies:
```bash
npm install
```

### Run Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in WebKit (Safari/Orion) or Chromium.

### Running Automated Tests
We run BDD Gherkin specs and unit tests locally using Vitest:
```bash
# Run all tests (BDD + Unit)
npx vitest run

# Watch mode for active development
npx vitest
```

### Static Type Checks
Validate TypeScript code compilation rules:
```bash
npx tsc -b
```

---

## 🚀 CI/CD & Deployment Policy

*   **Serverless Deployment**: The app runs serverless, hosted on GitHub Pages communicating directly with Firestore.
*   **Verification Policy**: Before notifying the Product Owner that changes are ready:
    1.  All code changes must compile cleanly (`npx tsc -b`) with zero errors.
    2.  All tests must pass (`npx vitest run`) with zero defects.
    3.  Push changes to trigger the GitHub Actions workflow, verifying the deployment run completes with a `success` status (`gh run list`).
    4.  Verify that the live site is accessible.
