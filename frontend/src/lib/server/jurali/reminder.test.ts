import { describe, expect, it } from 'vitest';
import { buildReminderMessage, buildWhatsAppReminderUrl } from './reminder';

describe('buildReminderMessage', () => {
  it('includes the client first name, FCFA amount, and shop name', () => {
    const msg = buildReminderMessage({
      firstName: 'Awa',
      balanceFcfa: 12_500,
      shopName: 'Boutique Awa',
    });
    expect(msg).toContain('Awa');
    expect(msg).toContain('12 500');
    expect(msg).toContain('Boutique Awa');
  });

  it('falls back to a generic shop reference when shopName is null', () => {
    const msg = buildReminderMessage({ firstName: 'Awa', balanceFcfa: 5_000, shopName: null });
    expect(msg).toContain('la boutique');
  });

  it('falls back to a generic shop reference when shopName is blank', () => {
    const msg = buildReminderMessage({ firstName: 'Awa', balanceFcfa: 5_000, shopName: '   ' });
    expect(msg).toContain('la boutique');
  });

  it('formats large amounts with a thousands separator', () => {
    const msg = buildReminderMessage({
      firstName: 'Awa',
      balanceFcfa: 1_234_567,
      shopName: 'Boutique Awa',
    });
    expect(msg).toContain('1 234 567');
  });
});

describe('buildWhatsAppReminderUrl', () => {
  it('builds a wa.me link with digits-only phone (strips the leading +)', () => {
    const url = buildWhatsAppReminderUrl('+221771234567', 'Bonjour Awa');
    expect(url).toBe('https://wa.me/221771234567?text=Bonjour%20Awa');
  });

  it('strips spaces and non-digit characters from the phone', () => {
    const url = buildWhatsAppReminderUrl('+221 77 123 45 67', 'test');
    expect(url).toContain('https://wa.me/221771234567?text=');
  });

  it('URL-encodes special characters in the message', () => {
    const url = buildWhatsAppReminderUrl('+221771234567', 'Solde: 12 500 FCFA & merci !');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&merci');
    const decoded = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(decoded).toBe('Solde: 12 500 FCFA & merci !');
  });
});
