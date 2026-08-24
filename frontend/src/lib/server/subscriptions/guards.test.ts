import { describe, expect, it } from 'vitest';
import { isSubscriptionActive } from './guards';

const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);

describe('isSubscriptionActive', () => {
  it('is false when there is no subscription row', () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });

  it('is false for PENDING even with a future renewsAt', () => {
    expect(isSubscriptionActive({ status: 'PENDING', renewsAt: day(30) })).toBe(false);
  });

  it('is false for ACTIVE with no renewsAt set', () => {
    expect(isSubscriptionActive({ status: 'ACTIVE', renewsAt: null })).toBe(false);
  });

  it('is false for ACTIVE whose renewsAt has already passed', () => {
    expect(isSubscriptionActive({ status: 'ACTIVE', renewsAt: day(-1) }, day(0))).toBe(false);
  });

  it('is true for ACTIVE with a future renewsAt', () => {
    expect(isSubscriptionActive({ status: 'ACTIVE', renewsAt: day(30) }, day(0))).toBe(true);
  });

  it('is false for CANCELED even with a future renewsAt (immediate cutoff)', () => {
    expect(isSubscriptionActive({ status: 'CANCELED', renewsAt: day(30) })).toBe(false);
  });

  it('is false for EXPIRED', () => {
    expect(isSubscriptionActive({ status: 'EXPIRED', renewsAt: day(-5) })).toBe(false);
  });

  it('is false for FAILED', () => {
    expect(isSubscriptionActive({ status: 'FAILED', renewsAt: null })).toBe(false);
  });
});
