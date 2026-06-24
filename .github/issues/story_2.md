# User Story 2: Passkey Authentication (Admin Login)

As a registered Classroom Admin, I want to authenticate using my registered passkey.

## Parent Feature
- Part of Feature: Passkey-Based Authentication

## Acceptance Criteria
1. The login screen offers a "Log in with Passkey" button.
2. The user inputs their email and clicks "Log in with Passkey".
3. The backend generates a WebAuthn assertion challenge.
4. The frontend client invokes `navigator.credentials.get()`.
5. The backend validates the signature using the saved public key and returns a custom Firebase Auth token on success.
6. The user is logged in and redirected to the lobby/dashboard.

## Gherkin BDD Scenario
```gherkin
  Scenario: Successful Login with Passkey
    Given an Admin "admin@example.com" has a registered passkey
    When the Admin initiates passkey login for "admin@example.com"
    Then the browser prompts for biometric credentials
    And the Admin is successfully logged in and redirected to the lobby
```
