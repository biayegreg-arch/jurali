'use client';

// Multipart file upload — POST /api/upload needs a `multipart/form-data`
// body, but the shared `api()` wrapper (lib/api.ts) always JSON-encodes its
// body and is a protected/off-limits file (auto-refresh + CSRF +
// retry-only-GET invariants), so this is a small separate fetch instead of
// an extension to it. CSRF token read mirrors api.ts's own getCsrfToken()
// (localStorage first, cookie fallback) rather than importing it, since
// that helper isn't exported.
import { ApiError } from './api';
import { COOKIE_PREFIX } from './constants';

const CSRF_COOKIE_NAME = `${COOKIE_PREFIX}-csrf`;
const CSRF_STORAGE_KEY = `${COOKIE_PREFIX}-csrf`;

function getCsrfToken(): string | null {
  const fromStorage = localStorage.getItem(CSRF_STORAGE_KEY);
  if (fromStorage) return fromStorage;
  const escaped = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export interface UploadedFile {
  url: string;
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);

  const csrfToken = getCsrfToken();
  const res = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof body.message === 'string' ? body.message : 'Upload failed';
    throw new ApiError(res.status, message, body);
  }
  return { url: body.url as string };
}
