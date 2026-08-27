import { describe, it, expect } from 'vitest';
import { subscriptionExpiringEmail, subscriptionExpiredEmail } from './email-templates';

const manageUrl = 'https://jurali.example.com/premium';

describe('subscriptionExpiringEmail', () => {
  it('mentions "demain" and the amount for the 1-day stage', () => {
    const tpl = subscriptionExpiringEmail({ daysLeft: 1, planAmountFcfa: 2500, manageUrl });
    expect(tpl.subject).toContain('demain');
    expect(tpl.html).toContain('demain');
    expect(tpl.html).toContain('2 500 FCFA');
    expect(tpl.html).toContain(manageUrl);
    expect(tpl.text).toContain('demain');
  });

  it('mentions the day count for the 3-day stage', () => {
    const tpl = subscriptionExpiringEmail({ daysLeft: 3, planAmountFcfa: 2500, manageUrl });
    expect(tpl.subject).toContain('3 jours');
    expect(tpl.html).toContain('dans 3 jours');
  });

  it('escapes HTML-sensitive characters in the manage URL', () => {
    const tpl = subscriptionExpiringEmail({
      daysLeft: 3,
      planAmountFcfa: 2500,
      manageUrl: 'https://example.com/?a=1&b=2',
    });
    expect(tpl.html).toContain('&amp;');
    expect(tpl.html).not.toContain('?a=1&b=2"');
  });
});

describe('subscriptionExpiredEmail', () => {
  it('mentions the free-tier downgrade and the renewal price', () => {
    const tpl = subscriptionExpiredEmail({ planAmountFcfa: 2500, manageUrl });
    expect(tpl.subject).toContain('expiré');
    expect(tpl.html).toContain('Gratuite');
    expect(tpl.html).toContain('2 500 FCFA');
    expect(tpl.html).toContain(manageUrl);
    expect(tpl.text).toContain('Gratuite');
  });
});
