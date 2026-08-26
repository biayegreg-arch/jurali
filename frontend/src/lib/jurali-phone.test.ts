import { describe, expect, it } from 'vitest';
import { normalizePhoneInput } from './jurali-phone';

describe('normalizePhoneInput', () => {
  it('returns an empty string for empty input', () => {
    expect(normalizePhoneInput('')).toBe('');
    expect(normalizePhoneInput('   ')).toBe('');
  });

  it('prepends +221 to a bare local number', () => {
    expect(normalizePhoneInput('779206693')).toBe('+221779206693');
  });

  it('strips spaces from a bare local number before prepending +221', () => {
    expect(normalizePhoneInput('77 920 66 93')).toBe('+221779206693');
  });

  it('leaves an already-international number untouched, minus formatting', () => {
    expect(normalizePhoneInput('+221771234567')).toBe('+221771234567');
    expect(normalizePhoneInput('+33 6 12 34 56 78')).toBe('+33612345678');
  });
});
