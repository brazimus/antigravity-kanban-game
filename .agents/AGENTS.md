# Antigravity Kanban Game Developer Rules

## CI/CD and Deployment Verification Policy
*   **Verify Before Handover**: Before notifying the Product Owner that any feature, iteration, or bug fix is ready for testing:
    1.  Commit and push the changes to GitHub.
    2.  Query the GitHub Actions workflow runs (using `gh run list` and `gh run view`) to confirm that the build and deployment pipeline finishes with a status of `success`.
    3.  Confirm that the deployed application is returning the expected output (e.g. check compilation/access) before handoff.
    4.  Only notify the Product Owner for review after the live build is verified green.

## Agentic Test-Driven Development (TDD) Policy
*   **BDD-First & Test-First Implementation**: All development work must start with defining Gherkin scenarios in a `.feature` file and implementing step definition tests first before writing features or modifying core components.
*   **Business Stakeholder Translation**: Treat the Product Owner as a business stakeholder. Help translate conceptual goals into testable Given-When-Then Gherkin BDD scenarios.
*   **Verify Red Phase**: Run the tests to confirm they fail (red phase) before writing the code to make them pass (green phase).
*   **Zero Manual Verification in Plans**: Coding agents must always create BDD test scenarios for new features in implementation plans instead of suggesting manual verification, unless there is a critical, data-destructive reason that prevents automated testing.
*   **100% Core Coverage Target**: Maintain test coverage targeting 100% (with a hard floor of 95%) for all core state engines (`src/useGameState.ts`, `src/useMultiplayerState.ts`, helper methods).
*   **Zero-Defects & Warnings**: Handover is blocked if there are compile errors, TypeScript warnings, or failing tests.
*   **Human-in-the-Loop Intervention**: If an implementation requires falling below the 95% coverage threshold or leaving warnings/lint errors unresolved, the coding agent **must** pause and request explicit approval from the Product Owner.


## Free-Tier & Platform Design Constraints
*   **Spark Tier Conservation**: Keep database writes and reads to a minimum to fit within the Firebase Spark free tier (50,000 reads and 20,000 writes/day). Avoid polling; use real-time listeners (`onSnapshot`) and ensure they are cleaned up on component unmount.
*   **No background servers**: The application must run completely serverless (GitHub Pages frontend communicating with Firestore).
*   **Target Browsers & Devices**: Optimize layouts and rendering specifically for:
    *   **Chromium** (Ungoogled-Chromium) and **WebKit** (Mobile/Desktop Safari, Orion browser on macOS/iOS/iPadOS).
    *   Laptop viewports and recent iPads (specifically **iPad Pro 11** and **iPad Pro 13** in both portrait and landscape orientation). Avoid excessive over-engineering for generic viewports outside these targets.

## Security Testing Guardrails
*   **Locked Firestore Rules**: Never introduce new database collections without defining Firestore security rules that verify authentication and scope writes recursively based on user email or auth UID.
*   **Strict Client-Side Sanitization**: Validate all user-facing strings (names, emails, room codes) using strict regex checking before saving to Firestore.
*   **No Hardcoded Secrets**: Ensure no admin service account credentials or server-side keys are ever committed. Client-side Firebase configurations must be injected via Vite `import.meta.env` built in the CI/CD pipeline.

## Documentation & Commenting Policy
*   **Clear Analogies**: Document complex TypeScript or React reactive patterns by drawing clear analogies to Perl patterns (e.g. associative hashes, array mapping, regexes) and SQL/relational concepts (e.g. ACID transactions, continuous cursors, tables, indexing).
*   **Agent-Independent Walkthroughs**: Coding agents must persist clear markdown documentation of all changes (including test walkthroughs) so that the user and other coding agents can understand the architecture changes independently of the tool used.
*   **No Code Placeholders**: Never use temporary stubs or incomplete placeholders in code changes.

## Distributed Team Coordination & Issue-First Workflow Policy
*   **Issue-First Implementation**: No coding implementation work can begin before establishing clear Features and User Stories. Each User Story must be registered, approved, and contain explicit Acceptance Criteria (AC) and Given-When-Then BDD scenarios.
*   **Branch-to-Issue Traceability**: All feature branch names must follow the convention `issue-<ID>-<short-description>`.
*   **PR reviews and templates**: Pull Requests must include a standard description template outlining the linked issues, architectural/design changes, and verification summaries. Pull Requests must link to and close the child User Stories (e.g., 'Closes #storyId') rather than the parent Feature. The parent Feature is only closed once all of its child stories are closed.

## Story Sizing & Token Quota Management Policy
*   **Story Sizing Mandatory**: Every User Story must be estimated using one of the six T-Shirt sizes (XS, S, M, L, XL, XXL) before work begins. Features must not have an estimate directly, as their size is the sum of their child stories.
*   **GitHub Projects Visibility**: Sizing must be selected in the "Size" custom field in the GitHub Project and as a label on the GitHub issue (e.g., `size:M`).
*   **Size to Quota Mapping Table**:
    | Size | Color Badge | Color (HEX) | Turn Budget | Est. 4-Hour Quota | Est. Daily Quota | Action / Mitigation Policy |
    |---|---|---|---|---|---|---|
    | **XS** | ![#bfebd4](https://img.shields.io/badge/-%20-bfebd4?style=flat-square) | Soft Sage (`bfebd4`) | 1-2 | 2% - 5% | 1% - 2% | Fit in 1-2 turns. Normal execution. |
    | **S** | ![#93f0b8](https://img.shields.io/badge/-%20-93f0b8?style=flat-square) | Soft Green (`93f0b8`) | 2-3 | 5% - 10% | 2% - 5% | Minor refactoring/components. 1-2 commits. |
    | **M** | ![#ebd44f](https://img.shields.io/badge/-%20-ebd44f?style=flat-square) | Warm Yellow (`ebd44f`) | 4-5 | 15% - 25% | 5% - 10% | Average story size. Update `task.md` and commit when green. |
    | **L** | ![#ffae42](https://img.shields.io/badge/-%20-ffae42?style=flat-square) | Soft Orange (`ffae42`) | 6-8 | 30% - 50% | 15% - 25% | Large story. Frequent checkpoint commits. Red/Green phase separation. |
    | **XL** | ![#ff8b70](https://img.shields.io/badge/-%20-ff8b70?style=flat-square) | Coral Orange (`ff8b70`) | 8-12 | 60% - 100% | 30% - 50% | High limit risk. Consider splitting. Commit every green turn, push branch. |
    | **XXL** | ![#e03e3e](https://img.shields.io/badge/-%20-e03e3e?style=flat-square) | Blocker Red (`e03e3e`) | 12+ | >100% (Blocker) | 60% - 100% | **Refactoring/Decomposition required**. Must be split into smaller stories before starting. |
*   **Token Expiration Resiliency Rules**:
    1.  **Task checklist**: Keep `task.md` in the artifacts directory up to date at all times. Mark each sub-task as `[/]` (in progress) or `[x]` (completed) dynamically.
    2.  **Handoff summaries**: If quota usage is high or rate limits are approaching, the agent must write a handoff summary at the end of the turn, highlighting the exact current state, next file to edit, and target tests.
    3.  **Frequent commits**: Commit code incrementally on the issue branch. Do not wait for the entire feature to be complete before committing. Push changes to GitHub regularly so that work is never lost.


