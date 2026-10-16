// Re-export manifest types from game-components (single source of truth)
export type {
  AssetDefinition,
  AssetType,
  Bundle as ManifestBundle,
  BundleKind,
  BundleProgress,
  LoadBundleOptions,
  LoaderAdapter,
  LoaderType,
  LoadingState,
  Manifest,
  OnProgress as ProgressCallback,
} from '@wolfgames/components/core';
