function hasPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === code
  );
}

// Shared P2034 check — Serializable isolation aborted due to a concurrent
// update. Used by every route that pairs `lockUserTx` with a Serializable
// transaction (see withdrawals/route.ts, the original source of this check).
export function isTransientConflict(err: unknown): boolean {
  return hasPrismaCode(err, 'P2034');
}

// P2002 — unique constraint violation. A check-then-write race (e.g. two
// concurrent requests both pass a "phone not taken" pre-check before either
// write commits) surfaces here instead of at the pre-check.
export function isUniqueConstraintViolation(err: unknown): boolean {
  return hasPrismaCode(err, 'P2002');
}
