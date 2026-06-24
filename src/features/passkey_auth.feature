Feature: Passkey (WebAuthn) Authentication
  As a Classroom Admin
  I want to log in securely using passkeys
  So that I do not need passwords, while maintaining backup recovery options

  Scenario: Register a new Passkey and Backup Passphrase
    Given an Admin is authenticated via email link
    When the Admin registers a new passkey named "My Laptop"
    Then the system generates a 4-word backup passphrase
    And the passkey and hashed backup passphrase are saved to the profile

  Scenario: Successful Login with Passkey
    Given an Admin "admin@example.com" has a registered passkey
    When the Admin initiates passkey login for "admin@example.com"
    Then the browser prompts for biometric credentials
    And the Admin is successfully logged in and redirected to the lobby

  Scenario: Recovery Login using Backup Passphrase
    Given an Admin "admin@example.com" has a backup passphrase hash
    When the Admin logs in with backup passphrase "correct-horse-battery-staple" for "admin@example.com"
    Then the login succeeds
    And the Admin is prompted to register a new passkey

  Scenario: Super-Admin Revokes Admin Credentials
    Given a Super-Admin is authenticated
    And an Admin "assistant@example.com" has 2 active passkeys
    When the Super-Admin revokes all passkeys for "assistant@example.com"
    Then the passkeys are removed from "assistant@example.com"'s profile
    And "assistant@example.com" must authenticate via email link on next login
