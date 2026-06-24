# User Story 4: Recovery via Backup Passphrase

As an Admin who lost their passkey, I want to log in using my recovery passphrase.

## Parent Feature
- Part of Feature: Passkey-Based Authentication

## Acceptance Criteria
1. The login screen offers a "Use Recovery Passphrase" fallback.
2. The user enters their email and their 4-word backup passphrase.
3. The system cryptographically hashes the input and matches it with the hash in Firestore.
4. If it matches, the user is logged in and prompted to register a new passkey immediately.

## Gherkin BDD Scenario
```gherkin
  Scenario: Recovery Login using Backup Passphrase
    Given an Admin "admin@example.com" has a backup passphrase hash
    When the Admin logs in with backup passphrase "correct-horse-battery-staple" for "admin@example.com"
    Then the login succeeds
    And the Admin is prompted to register a new passkey
```
