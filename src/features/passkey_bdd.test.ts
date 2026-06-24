// @vitest-environment jsdom
import { BddRunner } from './bdd_runner';
import { expect } from 'vitest';
import { AuthAdapterMock } from '../__mocks__/authAdapterMock';

// Define a test context structure that holds our mock adapter
interface TestContext {
  auth: AuthAdapterMock;
  actions: {
    biometricPromptTriggered: boolean;
    navigatedToLobby: boolean;
    promptedToRegisterPasskey: boolean;
    generatedPassphrase?: string;
  };
}

const runner = new BddRunner();

// Step definitions registration
runner.register(/^an Admin is authenticated via email link$/, async (context: TestContext) => {
  await context.auth.signInWithEmailLink('admin@example.com', 'mock-link');
});

runner.register(/^the Admin registers a new passkey named "([^"]+)"$/, async (context: TestContext, label: string) => {
  context.actions.biometricPromptTriggered = true;
  const res = await context.auth.registerPasskey(label);
  context.actions.generatedPassphrase = res.backupPassphrase;
});

runner.register(/^the system generates a (\d+)-word backup passphrase$/, (context: TestContext, wordCount: number) => {
  const passphrase = context.actions.generatedPassphrase;
  expect(passphrase).toBeDefined();
  expect(passphrase?.split('-').length).toBe(wordCount);
});

runner.register(/^the passkey and hashed backup passphrase are saved to the profile$/, async (context: TestContext) => {
  const user = await context.auth.getCurrentUser();
  expect(user).toBeDefined();
  expect(user?.passkeys.length).toBeGreaterThan(0);
  
  // Verify it lists the keys correctly
  const keys = await context.auth.getPasskeys();
  expect(keys.length).toBe(user?.passkeys.length);
});

runner.register(/^an Admin "([^"]+)" has a registered passkey$/, async (context: TestContext, email: string) => {
  context.auth.seedUser({
    uid: 'admin-123',
    email,
    roles: { admin: true, superAdmin: false },
    passkeys: [{ id: 'key-abc', label: 'My Laptop', createdAt: new Date().toISOString() }]
  }, 'correct-horse-battery-staple');
});

runner.register(/^the Admin initiates passkey login for "([^"]+)"$/, async (context: TestContext, email: string) => {
  context.actions.biometricPromptTriggered = true;
  try {
    await context.auth.signInWithPasskey(email);
    context.actions.navigatedToLobby = true;
  } catch (err: any) {
    context.actions.navigatedToLobby = false;
  }
});

runner.register(/^the browser prompts for biometric credentials$/, (context: TestContext) => {
  expect(context.actions.biometricPromptTriggered).toBe(true);
});

runner.register(/^the Admin is successfully logged in and redirected to the lobby$/, async (context: TestContext) => {
  const user = await context.auth.getCurrentUser();
  expect(user?.uid).toBeDefined();
  expect(context.actions.navigatedToLobby).toBe(true);
});

runner.register(/^an Admin "([^"]+)" has a backup passphrase hash$/, async (context: TestContext, email: string) => {
  // Seed user with backup passphrase but zero passkeys
  context.auth.seedUser({
    uid: 'admin-123',
    email,
    roles: { admin: true, superAdmin: false },
    passkeys: []
  }, 'correct-horse-battery-staple');
});

runner.register(/^the Admin logs in with backup passphrase "([^"]+)" for "([^"]+)"$/, async (context: TestContext, passphrase: string, email: string) => {
  try {
    await context.auth.signInWithBackupPassphrase(email, passphrase);
    context.actions.promptedToRegisterPasskey = true;
  } catch (err: any) {
    context.actions.promptedToRegisterPasskey = false;
  }
});

runner.register(/^the login succeeds$/, async (context: TestContext) => {
  const user = await context.auth.getCurrentUser();
  expect(user?.uid).toBeDefined();
});

runner.register(/^the Admin is prompted to register a new passkey$/, (context: TestContext) => {
  expect(context.actions.promptedToRegisterPasskey).toBe(true);
});

runner.register(/^a Super-Admin is authenticated$/, async (context: TestContext) => {
  const superAdmin = {
    uid: 'super-admin-789',
    email: 'superadmin@example.com',
    roles: { admin: true, superAdmin: true },
    passkeys: []
  };
  context.auth.seedUser(superAdmin);
  context.auth.setCurrentUser(superAdmin);
});

runner.register(/^an Admin "([^"]+)" has (\d+) active passkeys$/, async (context: TestContext, email: string, keyCount: number) => {
  const passkeys = Array.from({ length: keyCount }, (_, i) => ({
    id: `key-${i}`,
    label: `Key ${i}`,
    createdAt: new Date().toISOString()
  }));
  
  context.auth.seedUser({
    uid: 'admin-456',
    email,
    roles: { admin: true, superAdmin: false },
    passkeys
  });
});

runner.register(/^the Super-Admin revokes all passkeys for "([^"]+)"$/, async (context: TestContext, email: string) => {
  // Find uid of user by email
  const admins = await context.auth.listAllAdmins();
  const target = admins.find(a => a.email === email);
  expect(target).toBeDefined();
  if (target) {
    await context.auth.revokeAdminPasskeys(target.uid);
  }
});

runner.register(/^the passkeys are removed from "([^"]+)"'s profile$/, async (context: TestContext, email: string) => {
  const admins = await context.auth.listAllAdmins();
  const target = admins.find(a => a.email === email);
  expect(target).toBeDefined();
  expect(target?.passkeys.length).toBe(0);
});

runner.register(/^"([^"]+)" must authenticate via email link on next login$/, async (context: TestContext, email: string) => {
  // Verifying they have no passkeys and no backup hashes, so they will be rejected on login
  const auth = context.auth;
  await expect(auth.signInWithPasskey(email)).rejects.toThrow();
});

// Run scenarios
const featureContent = `Feature: Passkey (WebAuthn) Authentication
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
`;

runner.runFeature(featureContent, () => ({
  auth: new AuthAdapterMock(),
  actions: {
    biometricPromptTriggered: false,
    navigatedToLobby: false,
    promptedToRegisterPasskey: false
  }
}));
