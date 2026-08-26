// Free-tier client cap (PRD §4/§6) — shared between the enforcement in
// POST /api/clients and the sidebar's "Passer à Premium" nudge (Phase 9) so
// the two can never drift on what the limit actually is. Not `server-only`
// on purpose: the sidebar is a client component and needs the same number
// to compute a real (non-fabricated) progress bar.
export const CLIENT_FREE_TIER_LIMIT = 10;
