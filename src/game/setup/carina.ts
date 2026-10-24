/**
 * carina — the on/off switch for the Carina juice kit, for a side-by-side demo.
 *
 * `?carina=0` (or `off`, `false`) plays the same build with no juice; `?carina=1` forces it on.
 * Without the param, tuning decides (`juice.carina` in src/game/tuning/types.ts, default on).
 * The URL is read here, in a DOM shell folder, so the controller never touches `window`.
 */

/** The `?carina=` override in `search`, or null when absent or unreadable. */
export function carinaFromSearch(search: string): boolean | null {
  const raw = new URLSearchParams(search).get('carina');
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (['0', 'off', 'false', 'no'].includes(v)) return false;
  if (['', '1', 'on', 'true', 'yes'].includes(v)) return true;
  return null;
}

/** Whether to play the juice: the URL override wins, else the tuning value. */
export function carinaJuiceOn(tuningOn: boolean): boolean {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return carinaFromSearch(search) ?? tuningOn;
}
