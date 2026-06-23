# User Personas & BDD Scenarios Map

This document maps the user personas of the **Antigravity Kanban Game** to the Gherkin BDD scenarios that define their expectations, and outlines the technical testing strategies used to verify them.

---

## 👥 Persona 1: Individual Player (Single-Player Explorer)

### Profile
An individual developer, scrum master, or agile enthusiast exploring the simulation in single-player mode. They want to learn Kanban mechanics, experiment with WIP limits, try different flow accelerators, and understand the impact of blockers and batch sizes.

### Key Use Cases & BDD Scenario Mapping
The single-player explorer's journey is mapped to Gherkin scenarios in [kanban_simulation.feature](file:///Users/braz/Projects/Antigravity%20Kanban%20Game/src/features/kanban_simulation.feature):

| Scenario Title | Persona Expectation | Verification / Test Implementation |
|---|---|---|
| **Visualize and Limit WIP Enforcements** | When the player enters Week 2, columns show active WIP limits and developer pairing is unlocked. | Asserts that `columns` objects in `gameState` have correct `wipLimit` bounds and `pairingAllowed` is true. |
| **Shift-Left Continuous Testing Migration** | Activating Shift-Left migrates cards in Testing back to Development so developers can collaborate concurrently. | Triggers day progression with `shiftLeftActive: true`. Asserts card moves back to `development` column and effort reset. |
| **Monolithic Trade Show Epic vs Story Splitting** | Activating Story Splitting partitions large Epics into smaller batch cards to accelerate lead time. | Simulates day progression under Day 3 Trade Show event. Verifies parent epic split into 3 child cards and progress rolls up. |
| **Choose Your Own Adventure Weekend Selector Constraints** | During weekend summary, the player can choose exactly one scenario parameter to isolate variables. | Fast-forwards to day 5. Asserts that updating scenario selection resets other active accelerators. |
| **Related Scenario Recommendations** | The simulation recommends related accelerators to guide the player's learning path based on previous decisions. | Verifies that when previous selection was `tradeshow`, the recommendation badge points to `smaller_batches`. |
| **End-to-End Choose Your Own Adventure Pathway** | Visualizes player's choices across a multi-week timeline. | Simulates the transition from Week 1 to Week 2 with scenario selection. |
| **Card Movement with Effort Completion** | Completed cards can be pulled forward, setting `startedAt` and appending column transitions to card history. | Triggers `moveCard()` on a card with 0 remaining effort. Asserts successful move and history tracking. |
| **Incomplete Effort Prevents Forward Movement** | Standard cards cannot be pulled forward if they have remaining effort in the current stage. | Attempts to run `moveCard()` on an active card. Asserts the move fails and original column is preserved. |
| **Start of Day Modal display** | The player gets a clear modal explaining daily bulletin events and start-of-day warnings. | Asserts `showStartOfDayModal` is initialized to `true` and turns `false` on calling `dismissStartOfDayModal()`. |
| **Card Dropdown Position avoids clipping** | Popover dropdown menus position dynamically to stay within the scroll viewport. | Mounts component with `isFirst` prop. Verifies CSS style offsets (downward top-positioning vs upward bottom-positioning). |

---

## 👥 Persona 2: Team Player (Multiplayer Client)

### Profile
A team member participating in an instructor-led group session. They join a room code, coordinate with other players in real-time, roll capacity dice, and allocate their individual points to cards on a shared board.

### Key Use Cases & BDD Scenario Mapping
Multiplayer client behaviors are managed by the real-time Firestore database listener:

| Use Case | Persona Expectation | Testing & Mocking Strategy |
|---|---|---|
| **Join Lobby with Code** | Input room code and name, joining the multiplayer session. | Mocked by providing a local `currentPlayerId` and verifying that client hooks state resolves room data. |
| **Roll Capacity Dice** | Roll their developer's capacity independently of other players. | Simulates state change where player's avatar receives capacity roll, updating the database. |
| **Capacity Allocation** | Drag their avatar to a card to apply their remaining points in real-time. | Triggers `allocateCapacity()` hook state action. Asserts card effort decreases and avatar capacity updates. |
| **Real-time Synchronization** | See other players' allocations and rolls immediately. | Simulated by mocking Firestore `onSnapshot` triggers to push database changes down into local React state. |

---

## 👥 Persona 3: Admin / Instructor (Multiplayer Host)

### Profile
An instructor, coach, or session coordinator hosting a team training session. They configure room parameters, monitor player connection statuses, run day progressions, and inject custom events (like outages or blocker injections) to test the team's response.

### Key Use Cases & BDD Scenario Mapping
Admin activities control the central simulation loop:

| Use Case | Persona Expectation | Testing & Mocking Strategy |
|---|---|---|
| **Lobby Setup & Launch** | Create rooms, set max days, configure base blocker/QA failure chances. | Triggers `startGame()` with config overrides. Asserts config state registers custom parameters. |
| **Custom Expedite Injection** | Inject emergency hotfix cards (e.g. database outage) directly into the columns. | Calls `injectCustomExpediteCards()`. Verifies custom title-prefixed cards are added with `type: 'expedite'`. |
| **Run Day Execution** | Advance the day once players have allocated capacity, running metric calculations. | Calls `endDay()`. Asserts state transitions to `day_summary`, computes average lead/cycle times, and records metrics. |
| **Scroll Jump Preservation** | Progression clicks should not cause page viewport jumps. | Spies on `Element.prototype.scrollIntoView`. Verifies that day progress updates don't trigger viewport movements. |

---

## 🛠️ Testing Framework Architecture

The BDD framework is built completely serverless and runs within a JSDOM environment in Vitest:

### 1. The Gherkin Parser (`bdd_runner.ts`)
*   **Perl-style Parsing**: The Gherkin runner works like a Perl script processing text line-by-line. It strips structural keywords (`Given `, `When `, `Then `, `And `) and matches expressions against registered regular expression patterns using string matching.
*   **Parameters Capture**: Captured match groups are passed as parameters to step handler functions.

### 2. React Hook Test Bridge (`kanban_bdd.test.ts`)
*   **State Simulation**: We test the core game logic by invoking `renderHook(() => useGameState())`.
*   **Act Batching**: Since React 18 batches state updates inside testing hooks, step assertions check the updated `result.current.gameState` values instead of relying on immediate return values from state actions.

### 3. DOM Component Verification
*   **Container Scoping**: Step definitions verify complex UI behaviors (like popover positions) by calling `@testing-library/react`'s `render`.
*   **Isolation**: Element lookups are strictly scoped using `within(container).getByText(...)` to prevent global document leaks and collision errors.
