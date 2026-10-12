/**
 * The dev panel toggle: backtick. On layouts where backtick is a dead key
 * (macOS Brazilian, US International) keydown reports `Dead`, so match the
 * physical key too — only when it is dead, so layouts that put a plain
 * character on that key (ABNT2 `'`) keep typing it.
 *
 * keydown cannot tell which dead key was pressed, so on layouts where that
 * key is another dead key (German `^`) it toggles the panel as well. That is
 * a known trade-off of a dev-only shortcut; it never fires while typing in a
 * text field, so the keystroke is never eaten there.
 */
export function isDevToggleKey(e: KeyboardEvent): boolean {
  if (isTextEntry(e.target)) return false;
  return e.key === '`' || (e.key === 'Dead' && e.code === 'Backquote');
}

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as { isContentEditable?: boolean; tagName?: string } | null;
  return (
    !!el &&
    (el.isContentEditable === true || TEXT_ENTRY_TAGS.has(el.tagName ?? ''))
  );
}
