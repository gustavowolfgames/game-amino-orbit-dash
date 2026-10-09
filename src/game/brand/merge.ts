/**
 * Validating a published sheet and layering it over the build's.
 *
 * Pure: no SDK, no DOM. The validator is the trust boundary — everything after it may assume a
 * well-formed sheet (hex colours, https links and font URLs).
 */

import { type } from 'arktype';
import { BrandDef, type BrandOverride } from '../../../schemas/brand/schema';

/** Parse one payload. Null for anything that should not reach the theme. */
export function validateOverride(raw: unknown): BrandOverride | null {
  const out = BrandDef(raw);
  if (out instanceof type.errors) return null;
  return out as BrandOverride;
}

/**
 * Lay `override` over `base`. Absent keys change nothing; `null` un-sets the key so it resolves
 * to the build default (a partner sheet's `extraColors: null` drops the build's orb palette for
 * its own accents); `roles` replaces the base's whole, so a partner never inherits the build's
 * pins; `scale` merges entry by entry. `fonts` is not merged — the loader resolves it to the
 * families actually registered.
 */
export function mergeOverride(base: BrandOverride, override: BrandOverride): BrandOverride {
  const { fonts: _fonts, scale, roles, ...rest } = override;
  const out: Record<string, unknown> = { ...base };
  delete out.fonts;
  for (const [k, v] of Object.entries(rest)) {
    if (v === null) delete out[k];
    else if (v !== undefined) out[k] = v;
  }
  if (base.scale || scale) out.scale = { ...base.scale, ...scale };
  if (roles) out.roles = roles;
  return out as BrandOverride;
}
