# Antigravity Kanban Game Developer Rules

## CI/CD and Deployment Verification Policy
*   **Verify Before Handover**: Before notifying the Product Owner that any feature, iteration, or bug fix is ready for testing:
    1.  Commit and push the changes to GitHub.
    2.  Query the GitHub Actions workflow runs (using `gh run list` and `gh run view`) to confirm that the build and deployment pipeline finishes with a status of `success`.
    3.  Confirm that the deployed application is returning the expected output (e.g. check compilation/access) before handoff.
    4.  Only notify the Product Owner for review after the live build is verified green.
