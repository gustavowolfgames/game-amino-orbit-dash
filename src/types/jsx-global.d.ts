// Solid exports JSX as a module type, but some read-only src/core files use the
// global `JSX` namespace (e.g. src/core/systems/errors/boundary.tsx). This shim
// re-exposes Solid's JSX globally so they type-check without editing src/core.
import type { JSX as SolidJSX } from 'solid-js';

declare global {
  namespace JSX {
    type Element = SolidJSX.Element;
  }
}
