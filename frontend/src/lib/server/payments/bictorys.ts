/**
 * Bictorys provider — charges (Wave / Orange Money / Free Money), payouts,
 * and webhook signature verification.
 *
 * Two API keys, NEVER mixed:
 *   - BICTORYS_API_KEY      — public key for charges (customer payments)
 *   - BICTORYS_PRIVATE_KEY  — secret key for payouts (seller withdrawals)
 *
 * If `BICTORYS_PRIVATE_KEY` is missing, the provider still works for
 * charges — `payout()` throws explicitly. Calls to `refund()` throw
 * "Refund not supported" (the Bictorys public API does not expose a
 * documented refund endpoint at the time of writing — adapt here if
 * your contract includes one).
 *
 * WAF workaround: Bictorys sits behind AWS WAF Bot Control, which flags
 * Node's default `fetch` (undici) TLS fingerprint — every call gets a 403
 * Forbidden HTML page, indistinguishable from a real auth failure until you
 * inspect the body. Both `charge()` and `payout()` spawn `curl` instead
 * (see `curlFetch` below) — this matches the cagnottes.sn pattern that
 * works against Bictorys' front. `charge()` additionally retries up to 3
 * times with exponential backoff (2s, 4s, 8s) on a WAF 403, since even curl
 * gets flagged occasionally. Requires a `curl` binary on PATH — present on
 * Vercel's Node.js runtime and any standard Linux/macOS dev machine.
 *
 * Webhook signature: the webhook handler accepts EITHER:
 *   1. `x-secret-key` header equal to BICTORYS_WEBHOOK_SECRET (timing-safe), OR
 *   2. `x-webhook-signature` header = HMAC-SHA256(timestamp + "." + rawBody)
 *      with `x-webhook-timestamp` within a 60-second replay window
 *      (override via env BICTORYS_WEBHOOK_REPLAY_WINDOW_MS).
 *
 * Dev escape hatch: when `process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1'`,
 * `verifySignature` returns `{ valid: true }` regardless. **DEV ONLY** — a
 * loud warning is logged on every bypass.
 */
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../logger';
import type { WebhookProvider, ParsedIds } from '../webhook/handler';
import type {
  PaymentProvider,
  ChargeInput,
  ChargeResult,
  PayoutInput,
  PayoutResult,
  RefundInput,
  RefundResult,
} from './provider';

const logger = createLogger();
const execFileP = promisify(execFile);

// ───────────────────────────────────────────────────────────────────────
// Env shape
// ───────────────────────────────────────────────────────────────────────

export interface BictorysEnv {
  /** Public key for /pay/v1/charges. Required. */
  BICTORYS_API_KEY: string;
  /** Private key for /pay/v1/payouts. Required only for payouts. */
  BICTORYS_PRIVATE_KEY?: string;
  /** Base URL, e.g. "https://api.bictorys.com" or test sim. */
  BICTORYS_API_URL: string;
  /** Shared secret used for the simple `x-secret-key` webhook header. */
  BICTORYS_WEBHOOK_SECRET: string;
  /**
   * Merchant secret code. Bictorys requires this in the payout body
   * (`merchant.secretCode`). Required only for payouts.
   */
  BICTORYS_MERCHANT_SECRET_CODE?: string;
}

// ───────────────────────────────────────────────────────────────────────
// Webhook payload (loosely typed — Bictorys' shape varies slightly per event)
// ───────────────────────────────────────────────────────────────────────

export interface BictorysWebhookPayload {
  /** Charge id, sometimes called `chargeId` / `charge_id` / `id`. */
  id?: string;
  charge_id?: string;
  chargeId?: string;
  /** Bictorys lifecycle status — "succeeded" / "failed" / "pending" / etc. */
  status?: string;
  event_type?: string;
  /** Mobile money method — "wave_money" / "orange_money" / "free_money". */
  payment_method?: string;
  paymentMethod?: string;
  /** Free-form — Bictorys passes more fields we don't strictly need. */
  [key: string]: unknown;
}

// ───────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────

const DEFAULT_CHARGE_RETRY_DELAYS_MS = [2_000, 4_000, 8_000]; // 3 retries
/**
 * Test-only escape hatch — set to a comma-separated list of ms values
 * (e.g. "0,0,0") to skip the real backoff. Never set in production.
 */
function chargeRetryDelaysMs(): readonly number[] {
  const override = process.env.BICTORYS_RETRY_DELAYS_MS_OVERRIDE;
  if (!override) return DEFAULT_CHARGE_RETRY_DELAYS_MS;
  const parsed = override
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parsed.length > 0 ? parsed : DEFAULT_CHARGE_RETRY_DELAYS_MS;
}

const HTTP_TIMEOUT_MS = 30_000;
/**
 * Replay window for HMAC-signed webhooks. Default 60s — tight enough that a
 * captured webhook is worthless within a couple of seconds in practice, loose
 * enough for normal clock skew between the provider and our hosts. Override
 * via `BICTORYS_WEBHOOK_REPLAY_WINDOW_MS` (e.g. for legitimate slow networks).
 */
function webhookReplayWindowMs(): number {
  const raw = process.env.BICTORYS_WEBHOOK_REPLAY_WINDOW_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 60_000;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function classifyStatus(raw: string | undefined): 'PENDING' | 'PAID' | 'FAILED' {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'succeeded' || s === 'paid' || s === 'success' || s === 'completed') return 'PAID';
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'rejected' || s === 'error')
    return 'FAILED';
  return 'PENDING';
}

function classifyPayoutStatus(
  raw: string | undefined,
): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'succeeded' || s === 'completed' || s === 'paid' || s === 'success') return 'COMPLETED';
  if (s === 'failed' || s === 'rejected' || s === 'error' || s === 'cancelled' || s === 'canceled')
    return 'FAILED';
  if (s === 'processing') return 'PROCESSING';
  return 'PENDING';
}

function parseRawHttpResponse(raw: string): { status: number; body: string } {
  // curl -i emits: STATUS LINE\r\nHEADERS\r\n\r\nBODY
  const sep = raw.indexOf('\r\n\r\n');
  const head = sep >= 0 ? raw.slice(0, sep) : raw;
  const body = sep >= 0 ? raw.slice(sep + 4) : '';
  const statusLine = head.split(/\r?\n/)[0] ?? '';
  const m = statusLine.match(/^HTTP\/[\d.]+\s+(\d+)/);
  return { status: m ? parseInt(m[1]!, 10) : 0, body };
}

interface CurlResponse {
  ok: boolean;
  status: number;
  text: string;
}

/**
 * Spawns `curl` for the actual HTTP call (see the WAF workaround note at
 * the top of this file). Minimal flags only — do NOT add `-s`, `-A`,
 * `--noproxy`, or extra headers like `Accept`/`User-Agent` beyond what the
 * caller passes; each one moves curl's request shape further from a plain
 * default request and risks tripping the WAF again.
 */
async function curlFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<CurlResponse> {
  const args: string[] = ['-i', '-X', init.method];
  for (const [k, v] of Object.entries(init.headers)) args.push('-H', `${k}: ${v}`);
  if (init.body) args.push('-d', init.body);
  args.push(url);

  const { stdout } = await execFileP('curl', args, {
    timeout: HTTP_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  const { status, body } = parseRawHttpResponse(stdout);
  return { ok: status >= 200 && status < 300, status, text: body };
}

/**
 * Map our generic destination.method (WAVE / ORANGE_MONEY / FREE_MONEY)
 * to Bictorys' payment_type query parameter.
 */
function mapMethodToBictorysType(method: string): string {
  const m = method.toUpperCase();
  if (m === 'WAVE' || m === 'WAVE_MONEY') return 'wave_money';
  if (m === 'ORANGE_MONEY' || m === 'ORANGE') return 'orange_money';
  if (m === 'FREE_MONEY' || m === 'FREE') return 'free_money';
  // Pass-through for already-correct strings ("wave_money" etc.).
  return method.toLowerCase();
}

/**
 * Appends `payment_category` to Bictorys' hosted checkout URL so the
 * buyer lands on the right tab (Mobile Money vs Card) instead of the
 * default picker. `category` is always one of our own two literals
 * ('card' | 'mobile_money'), never raw user input — safe to append
 * unvalidated.
 */
function appendPaymentCategory(rawUrl: string, category: 'card' | 'mobile_money'): string {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.has('payment_category')) {
      u.searchParams.set('payment_category', category);
    }
    return u.toString();
  } catch {
    // Malformed URL from the provider — return as-is rather than throw;
    // the caller already has a valid charge, just without a pre-picked tab.
    return rawUrl;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Factory
// ───────────────────────────────────────────────────────────────────────

export interface BictorysProviderHandle extends PaymentProvider {
  /** Webhook provider for `createWebhookHandler`. */
  webhookProvider: WebhookProvider<BictorysWebhookPayload>;
}

export function createBictorysProvider(env: BictorysEnv): BictorysProviderHandle {
  if (!env.BICTORYS_API_URL)
    throw new Error('createBictorysProvider: BICTORYS_API_URL is required');
  if (!env.BICTORYS_API_KEY)
    throw new Error('createBictorysProvider: BICTORYS_API_KEY is required');
  if (!env.BICTORYS_WEBHOOK_SECRET)
    throw new Error('createBictorysProvider: BICTORYS_WEBHOOK_SECRET is required');

  const baseUrl = env.BICTORYS_API_URL.replace(/\/+$/, '');

  // ── charge ─────────────────────────────────────────────────────────
  async function charge(input: ChargeInput): Promise<ChargeResult> {
    // 'card' — no phone-based operator, buyer pays by bank card on the
    // hosted page. Anything else defaults to mobile money.
    const paymentCategory = input.metadata?.paymentCategory === 'card' ? 'card' : 'mobile_money';

    // A specific Senegal operator (Wave/Orange Money/Free Money) is the
    // only case pre-selected via `payment_type` — tested and working.
    // Other countries' operators aren't reliably nameable from our side
    // (Bictorys' hosted page auto-detects the country from the phone
    // number and lists the right local operators itself), so we only
    // force `payment_type` when a caller explicitly passes one.
    const paymentTypeRaw =
      paymentCategory === 'card'
        ? null
        : typeof input.metadata?.paymentType === 'string'
          ? (input.metadata.paymentType as string)
          : null;

    const url = paymentTypeRaw
      ? `${baseUrl}/pay/v1/charges?payment_type=${encodeURIComponent(mapMethodToBictorysType(paymentTypeRaw))}`
      : `${baseUrl}/pay/v1/charges?payment_category=${encodeURIComponent(paymentCategory)}`;

    const customerObject: Record<string, unknown> = {
      name: input.customer.name ?? 'Customer',
      country: 'SN',
      locale: 'fr-FR',
    };
    if (input.customer.email) customerObject.email = input.customer.email;
    if (input.customer.phone) customerObject.phone = input.customer.phone;

    const body: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency,
      country: 'SN',
      paymentReference: input.externalRef,
      successRedirectUrl: input.successUrl,
      ErrorRedirectUrl: input.failureUrl, // E majuscule — convention Bictorys
      customerObject,
    };

    const retryDelays = chargeRetryDelaysMs();
    let lastErr = '';
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = retryDelays[attempt - 1] ?? 8_000;
        logger.warn(`[bictorys] WAF 403 — retry ${attempt}/${retryDelays.length} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }

      let res: CurlResponse;
      try {
        res = await curlFetch(url, {
          method: 'POST',
          headers: {
            'X-Api-Key': env.BICTORYS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Network / timeout — surface immediately (caller's circuit breaker
        // counts the failure).
        throw new Error(`Bictorys network error: ${msg}`);
      }

      if (res.ok) {
        const data = JSON.parse(res.text) as {
          transactionId?: string;
          chargeId?: string;
          id?: string;
          redirectUrl?: string;
          link?: string;
          status?: string;
          message?: string;
        };
        const providerChargeId = data.transactionId ?? data.chargeId ?? data.id ?? '';
        if (!providerChargeId) {
          throw new Error('Bictorys returned no charge id');
        }
        const rawPaymentUrl = data.redirectUrl ?? data.link ?? '';
        const paymentUrl = appendPaymentCategory(rawPaymentUrl, paymentCategory);
        return {
          providerChargeId,
          paymentUrl,
          status: classifyStatus(data.status),
        };
      }

      lastErr = res.text;

      // Only the WAF 403 HTML response is retried — Bictorys returns the
      // same 403 for legitimate auth errors, so we additionally require
      // the body to contain "Forbidden" (the WAF page signature).
      if (res.status === 403 && res.text.includes('Forbidden') && attempt < retryDelays.length) {
        continue;
      }

      throw new Error(`Bictorys charge failed: HTTP ${res.status} — ${res.text.slice(0, 200)}`);
    }

    throw new Error(`Bictorys charge failed after retries: ${lastErr.slice(0, 200)}`);
  }

  // ── payout ─────────────────────────────────────────────────────────
  async function payout(input: PayoutInput): Promise<PayoutResult> {
    if (!env.BICTORYS_PRIVATE_KEY) {
      throw new Error(
        'Bictorys payout disabled — BICTORYS_PRIVATE_KEY is not configured. Set it to enable withdrawals.',
      );
    }
    if (!env.BICTORYS_MERCHANT_SECRET_CODE) {
      throw new Error(
        'Bictorys payout disabled — BICTORYS_MERCHANT_SECRET_CODE is not configured.',
      );
    }

    const paymentType = mapMethodToBictorysType(input.destination.method);
    const url = `${baseUrl}/pay/v1/payouts?payment_type=${encodeURIComponent(paymentType)}`;

    const phone = input.destination.phone.startsWith('+')
      ? input.destination.phone
      : `+${input.destination.phone}`;

    const body: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency,
      country: 'SN',
      customerObject: {
        name: input.destination.accountName ?? 'Recipient',
        phone,
        country: 'SN',
        locale: 'fr-FR',
      },
      transactionType: 'payment',
      paymentReason: 'Payout',
      merchantReference: input.externalRef,
      merchant: { secretCode: env.BICTORYS_MERCHANT_SECRET_CODE },
    };

    let res: CurlResponse;
    try {
      res = await curlFetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': env.BICTORYS_PRIVATE_KEY,
          'Content-Type': 'application/json',
          accept: 'application/json',
          'idempotency-key': input.externalRef,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Bictorys payout network error: ${msg}`);
    }

    const raw = res.text;
    let data: Record<string, unknown> | undefined;
    try {
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined;
    } catch {
      throw new Error(
        `Bictorys payout returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}`,
      );
    }

    if (res.status === 200 || res.status === 201) {
      const providerPayoutId = String((data?.id as string | undefined) ?? '');
      if (!providerPayoutId) throw new Error('Bictorys payout returned no id');
      const result: PayoutResult = {
        providerPayoutId,
        status: classifyPayoutStatus(data?.status as string | undefined),
      };
      const failureReason =
        (data?.message as string | undefined) ?? (data?.error as string | undefined);
      if (failureReason) result.failureReason = failureReason;
      return result;
    }

    const message =
      (data?.message as string | undefined) ??
      (data?.error as string | undefined) ??
      `HTTP ${res.status}`;
    throw new Error(`Bictorys payout failed: ${message}`);
  }

  // ── refund (not supported by Bictorys API at time of writing) ─────
  async function refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error('Refund not supported by Bictorys provider');
  }

  // ── webhook provider ──────────────────────────────────────────────
  const webhookProvider: WebhookProvider<BictorysWebhookPayload> = {
    name: 'bictorys',

    verifySignature(rawBody, headers) {
      // DEV ONLY escape hatch.
      if (process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1') {
        logger.warn(
          '[bictorys] !! SMOKE_BYPASS_WEBHOOK_VERIFY=1 — webhook signature ACCEPTED unconditionally. NEVER set this in production.',
        );
        return { valid: true };
      }

      // Path 1 — simple `x-secret-key` header.
      const secretHeader = headers['x-secret-key'];
      if (secretHeader) {
        if (timingSafeStringEqual(secretHeader, env.BICTORYS_WEBHOOK_SECRET)) {
          return { valid: true };
        }
        return { valid: false, reason: 'x-secret-key mismatch' };
      }

      // Path 2 — HMAC-SHA256 signature with replay window.
      const sig = headers['x-webhook-signature'];
      const ts = headers['x-webhook-timestamp'];
      if (sig && ts) {
        const tsNum = Number(ts);
        if (!Number.isFinite(tsNum)) {
          return { valid: false, reason: 'x-webhook-timestamp not numeric' };
        }
        const drift = Math.abs(Date.now() - tsNum);
        const window = webhookReplayWindowMs();
        if (drift > window) {
          return { valid: false, reason: `replay window exceeded (${drift}ms > ${window}ms)` };
        }
        const expected = crypto
          .createHmac('sha256', env.BICTORYS_WEBHOOK_SECRET)
          .update(`${ts}.`)
          .update(rawBody)
          .digest('hex');
        if (timingSafeStringEqual(sig, expected)) {
          return { valid: true };
        }
        return { valid: false, reason: 'HMAC mismatch' };
      }

      return { valid: false, reason: 'no signature header' };
    },

    parsePayload(rawBody) {
      const text = rawBody.toString('utf8');
      return JSON.parse(text) as BictorysWebhookPayload;
    },

    extractIds(payload): ParsedIds {
      const externalId = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
      const eventType = String(payload.event_type ?? payload.status ?? 'unknown');
      const klass = classifyStatus(payload.status);
      const kind: ParsedIds['kind'] =
        klass === 'PAID' ? 'paid' : klass === 'FAILED' ? 'failed' : 'other';
      return { externalId, eventType, kind };
    },
  };

  return {
    name: 'bictorys',
    charge,
    payout,
    refund,
    webhookProvider,
  };
}
