import { describe, expect, it } from 'vitest';
import { COUNTRY_DIAL_CODES, findCountryByDialPrefix, flagEmoji } from './jurali-countries';

describe('COUNTRY_DIAL_CODES', () => {
  it('pins Sénégal first', () => {
    expect(COUNTRY_DIAL_CODES[0]).toMatchObject({ iso2: 'SN', dialCode: '221' });
  });

  it('has no duplicate ISO2 codes', () => {
    const seen = new Set(COUNTRY_DIAL_CODES.map((c) => c.iso2));
    expect(seen.size).toBe(COUNTRY_DIAL_CODES.length);
  });
});

describe('findCountryByDialPrefix', () => {
  it('defaults to Sénégal for an empty value', () => {
    expect(findCountryByDialPrefix('').iso2).toBe('SN');
  });

  it('defaults to Sénégal for a value with no leading +', () => {
    expect(findCountryByDialPrefix('779206693').iso2).toBe('SN');
  });

  it('matches Sénégal for a +221 number', () => {
    expect(findCountryByDialPrefix('+221771234567').iso2).toBe('SN');
  });

  it('matches a longer dial code over a shorter overlapping one', () => {
    // +33 (France) vs any 1-digit code — must not truncate to a wrong match.
    expect(findCountryByDialPrefix('+33612345678').iso2).toBe('FR');
    expect(findCountryByDialPrefix('+225070000000').iso2).toBe('CI');
  });

  it('falls back to Sénégal for an unrecognized country code', () => {
    expect(findCountryByDialPrefix('+999123456').iso2).toBe('SN');
  });
});

describe('flagEmoji', () => {
  it('builds the regional-indicator flag for a given ISO2', () => {
    expect(flagEmoji('SN')).toBe('🇸🇳');
    expect(flagEmoji('fr')).toBe('🇫🇷');
  });
});
