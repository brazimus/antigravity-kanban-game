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
