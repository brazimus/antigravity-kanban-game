# Feature: Passkey-Based Authentication

Implement WebAuthn/Passkey authentication for Classroom Admins using Firebase Cloud Functions, isolated using the Adapter Pattern, to replace the existing email/password auth.

## User Stories
- [ ] #2
- [ ] #3
- [ ] #4
- [ ] #5
- [ ] #6

## Architectural Decisions
- **Firebase Cloud Functions**: Serverless backend using standard WebAuthn verification logic (`@simplewebauthn/server`).
- **Adapter Pattern**: Decouple database (Firestore) and session-signing (Firebase Auth) layers for portability.
- **Backup Passphrase**: 4-word xkcd-style recovery phrase hashed with PBKDF2/SHA-256 in Firestore.
- **Dismissible Migration Banner**: Prompts existing email/password Admins to upgrade.
