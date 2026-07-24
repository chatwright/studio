import { QUOTA_UNLIMITED, QuotaMetadata } from './recordings.types';

/**
 * Renders the quiet sell-at-the-limit counter every quota-gated response
 * carries (chatwright/cloud README.md, "Wire contract") — e.g. "Saved 2 of
 * 10 free recordings". `limit === QUOTA_UNLIMITED` (Enterprise) omits the
 * "of N" clause, per that same doc's instruction to clients. `null`/
 * `undefined` (the "quota" block is best-effort — see handlers.go) renders
 * nothing.
 */
export function formatQuotaCounter(quota: QuotaMetadata | null | undefined): string | null {
  if (!quota) {
    return null;
  }
  if (quota.limit === QUOTA_UNLIMITED) {
    return `Saved ${quota.used} recording${quota.used === 1 ? '' : 's'} — unlimited on your plan.`;
  }
  return `Saved ${quota.used} of ${quota.limit} ${quota.plan} recording${quota.limit === 1 ? '' : 's'}.`;
}

/** `1536` → `"1.5 KB"`. Binary (1024-based) units, matching Firestore's own byte accounting the backend documents (`recordings.MaxStoredBundleBytes`). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

/** An ISO timestamp (`RecordingSummary.createdAt`) → a short, locale-formatted date/time; the raw string back if it does not parse. */
export function formatRecordingDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
