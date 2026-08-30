import { describe, expect, it } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { applyCouponDiscount, isSubscriptionActive, validateCoupon } from './guards';

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

describe('applyCouponDiscount', () => {
  it('applies a percentage discount, rounded to the nearest integer FCFA', () => {
    expect(applyCouponDiscount(2500, 20)).toBe(2000);
    expect(applyCouponDiscount(1000, 33)).toBe(670); // 670.0 exactly, no rounding edge
    expect(applyCouponDiscount(999, 10)).toBe(899); // 899.1 -> rounds down
  });

  it('a 100% coupon zeroes the amount', () => {
    expect(applyCouponDiscount(2500, 100)).toBe(0);
  });

  it('a 0-effective (1%) coupon barely discounts', () => {
    expect(applyCouponDiscount(2500, 1)).toBe(2475);
  });
});

describe('validateCoupon', () => {
  it('is invalid when the code does not match any coupon', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce(null);
    const result = await validateCoupon(prismaMock, 'NOPE');
    expect(result).toEqual({ ok: false, errorCode: 'COUPON_NOT_FOUND' });
  });

  it('is invalid for a blank code without ever hitting the DB', async () => {
    const result = await validateCoupon(prismaMock, '   ');
    expect(result).toEqual({ ok: false, errorCode: 'COUPON_NOT_FOUND' });
    expect(prismaMock.coupon.findUnique).not.toHaveBeenCalled();
  });

  it('matches case-insensitively by uppercasing before lookup', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      percentOff: 20,
      active: true,
      expiresAt: null,
    } as never);
    await validateCoupon(prismaMock, 'summer20');
    expect(prismaMock.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'SUMMER20' } });
  });

  it('is invalid when the coupon is deactivated', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'OLD',
      percentOff: 20,
      active: false,
      expiresAt: null,
    } as never);
    const result = await validateCoupon(prismaMock, 'OLD');
    expect(result).toEqual({ ok: false, errorCode: 'COUPON_INACTIVE' });
  });

  it('is invalid once past its expiresAt', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'EXPIRED',
      percentOff: 20,
      active: true,
      expiresAt: new Date('2026-01-01T00:00:00Z'),
    } as never);
    const result = await validateCoupon(prismaMock, 'EXPIRED', new Date('2026-06-01T00:00:00Z'));
    expect(result).toEqual({ ok: false, errorCode: 'COUPON_EXPIRED' });
  });

  it('is valid for an active, unexpired coupon', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      percentOff: 20,
      active: true,
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    } as never);
    const result = await validateCoupon(prismaMock, 'SUMMER20', new Date('2026-06-01T00:00:00Z'));
    expect(result).toEqual({
      ok: true,
      errorCode: null,
      coupon: { id: 'c1', code: 'SUMMER20', percentOff: 20 },
    });
  });

  it('is valid with no expiresAt at all', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'FOREVER',
      percentOff: 10,
      active: true,
      expiresAt: null,
    } as never);
    const result = await validateCoupon(prismaMock, 'FOREVER');
    expect(result.ok).toBe(true);
  });
});
