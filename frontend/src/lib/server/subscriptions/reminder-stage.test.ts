import { describe, it, expect } from 'vitest';
import { nextReminderStage } from './reminder-stage';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-27T00:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe('nextReminderStage', () => {
  it('returns null when renewsAt is more than 3 days out', () => {
    const sub = { renewsAt: at(4 * DAY_MS), reminderStage: null, reminderStageRenewsAt: null };
    expect(nextReminderStage(sub, NOW)).toBeNull();
  });

  it('returns "3d" when within the 3-day window and nothing sent yet', () => {
    const sub = { renewsAt: at(3 * DAY_MS), reminderStage: null, reminderStageRenewsAt: null };
    expect(nextReminderStage(sub, NOW)).toBe('3d');
  });

  it('does not resend "3d" once already sent for this cycle', () => {
    const renewsAt = at(2 * DAY_MS);
    const sub = { renewsAt, reminderStage: '3d', reminderStageRenewsAt: renewsAt };
    expect(nextReminderStage(sub, NOW)).toBeNull();
  });

  it('upgrades from "3d" to "1d" once within the 1-day window', () => {
    const renewsAt = at(0.5 * DAY_MS);
    const sub = { renewsAt, reminderStage: '3d', reminderStageRenewsAt: renewsAt };
    expect(nextReminderStage(sub, NOW)).toBe('1d');
  });

  it('does not resend "1d" once already sent for this cycle', () => {
    const renewsAt = at(0.2 * DAY_MS);
    const sub = { renewsAt, reminderStage: '1d', reminderStageRenewsAt: renewsAt };
    expect(nextReminderStage(sub, NOW)).toBeNull();
  });

  it('returns "expired" once renewsAt has passed', () => {
    const renewsAt = at(-1);
    const sub = { renewsAt, reminderStage: '1d', reminderStageRenewsAt: renewsAt };
    expect(nextReminderStage(sub, NOW)).toBe('expired');
  });

  it('does not resend "expired" once already sent', () => {
    const renewsAt = at(-DAY_MS);
    const sub = { renewsAt, reminderStage: 'expired', reminderStageRenewsAt: renewsAt };
    expect(nextReminderStage(sub, NOW)).toBeNull();
  });

  it('resets the stage when renewsAt moves forward (a renewal happened)', () => {
    // reminderStageRenewsAt points at a stale, earlier renewsAt (pre-renewal) —
    // the new renewsAt is a fresh cycle even though `reminderStage: 'expired'`
    // was left over from the lapsed one.
    const staleRenewsAt = at(-DAY_MS);
    const newRenewsAt = at(3 * DAY_MS);
    const sub = {
      renewsAt: newRenewsAt,
      reminderStage: 'expired',
      reminderStageRenewsAt: staleRenewsAt,
    };
    expect(nextReminderStage(sub, NOW)).toBe('3d');
  });
});
