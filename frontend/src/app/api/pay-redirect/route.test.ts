// Untested-route audit fix — GET /api/pay-redirect.
// Pure logic, no DB/auth/cookies — the allow-list + protocol checks are the
// entire attack surface (this is a same-origin redirector shielding payment
// links from in-app-browser URL scanners).
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

function makeReq(u?: string): NextRequest {
  const qs = u !== undefined ? `?u=${encodeURIComponent(u)}` : '';
  return new NextRequest(`http://localhost/api/pay-redirect${qs}`);
}

function b64(url: string): string {
  return Buffer.from(url, 'utf8').toString('base64');
}

describe('GET /api/pay-redirect', () => {
  it('returns 400 when the `u` parameter is missing', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-base64 `u` parameter', async () => {
    const res = await GET(makeReq('%%%not-base64%%%'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the decoded payload is not a valid URL', async () => {
    const res = await GET(makeReq(b64('not a url at all')));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-HTTPS URL', async () => {
    const res = await GET(makeReq(b64('http://pay.wave.com/checkout/abc')));
    expect(res.status).toBe(400);
  });

  it('returns 403 for an HTTPS URL whose host is not on the allow-list', async () => {
    const res = await GET(makeReq(b64('https://evil.example.com/checkout/abc')));
    expect(res.status).toBe(403);
  });

  it('returns 403 for a lookalike host that merely contains an allowed domain', async () => {
    // "pay.wave.com.evil.com" — hostname !== 'pay.wave.com' and does not
    // end with '.pay.wave.com', so the suffix check must reject it.
    const res = await GET(makeReq(b64('https://pay.wave.com.evil.com/checkout/abc')));
    expect(res.status).toBe(403);
  });

  it('302-redirects to an exact allow-listed host', async () => {
    const target = 'https://pay.wave.com/checkout/abc123';
    const res = await GET(makeReq(b64(target)));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(target);
  });

  it('302-redirects to a subdomain of an allow-listed suffix (bictorys.com)', async () => {
    const target = 'https://api.test.bictorys.com/pay/xyz';
    const res = await GET(makeReq(b64(target)));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(target);
  });

  it('sets defensive no-store/no-frame/no-referrer headers on a successful redirect', async () => {
    const res = await GET(makeReq(b64('https://pay.wave.com/checkout/abc')));
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it("exports runtime='nodejs' and dynamic='force-dynamic'", async () => {
    const mod = (await import('./route')) as { runtime?: string; dynamic?: string };
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
