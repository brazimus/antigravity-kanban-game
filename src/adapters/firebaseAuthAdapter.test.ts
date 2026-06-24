import { describe, test, expect, vi } from 'vitest';
import { handleCallableError } from './firebaseAuthAdapter';
import { FirebaseError } from 'firebase/app';

describe('handleCallableError Utility', () => {
  test('should format standard JavaScript Error correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalError = new Error('Database connection timeout');
    
    const result = handleCallableError(originalError, 'performing database query');
    
    expect(result.message).toBe('[unknown] Failed during performing database query: Database connection timeout');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should format unknown object values correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const result = handleCallableError('string error', 'some action');
    
    expect(result.message).toBe('Failed during some action: string error');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should parse standard FirebaseError without details', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fbError = new FirebaseError('functions/internal', 'An internal error occurred');
    
    const result = handleCallableError(fbError, 'registering passkey');
    
    expect(result.message).toBe('[functions/internal] Failed during registering passkey: An internal error occurred');
    expect((result as any).code).toBe('functions/internal');
    expect((result as any).details).toBeUndefined();
    expect((result as any).originalError).toBe(fbError);
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should parse Firebase Functions error with string details', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Simulate functions error with code, message, and string details
    const callableError = {
      code: 'functions/invalid-argument',
      message: 'Missing email',
      details: 'Email parameter is required for lookup'
    };
    
    const result = handleCallableError(callableError, 'fetching options');
    
    expect(result.message).toBe('[functions/invalid-argument] Failed during fetching options: Missing email (Details: Email parameter is required for lookup)');
    expect((result as any).code).toBe('functions/invalid-argument');
    expect((result as any).details).toBe('Email parameter is required for lookup');
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should parse Firebase Functions error with object details', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Simulate functions error with structured object details
    const callableError = {
      code: 'functions/internal',
      message: 'generateRegistrationOptions failed',
      details: {
        originalError: 'User not found in whitelist database',
        nestedCode: 'WHITELIST_MISSING'
      }
    };
    
    const result = handleCallableError(callableError, 'options retrieval');
    
    expect(result.message).toContain('[functions/internal] Failed during options retrieval: generateRegistrationOptions failed');
    expect(result.message).toContain('User not found in whitelist database');
    expect(result.message).toContain('WHITELIST_MISSING');
    
    expect((result as any).code).toBe('functions/internal');
    expect((result as any).details).toEqual({
      originalError: 'User not found in whitelist database',
      nestedCode: 'WHITELIST_MISSING'
    });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
