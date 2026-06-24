# User Story 5: Super-Admin User Management Dashboard

As a Super-Admin, I want to view all admins and manage their credentials.

## Parent Feature
- Part of Feature: Passkey-Based Authentication

## Acceptance Criteria
1. The dashboard has a governance tab visible only to users with `superAdmin: true`.
2. Lists all registered Admins, their emails, their active passkey count, and roles.
3. Super-Admin can revoke another admin's passkeys, which clears their credentials and forces them to re-verify/setup a passkey on next sign-in via email link.
4. Super-Admin can promote or demote other users to/from the `superAdmin` role.

## Gherkin BDD Scenario
```gherkin
  Scenario: Super-Admin Revokes Admin Credentials
    Given a Super-Admin is authenticated
    And an Admin "assistant@example.com" has 2 active passkeys
    When the Super-Admin revokes all passkeys for "assistant@example.com"
    Then the passkeys are removed from "assistant@example.com"'s profile
    And "assistant@example.com" must authenticate via email link on next login
```
