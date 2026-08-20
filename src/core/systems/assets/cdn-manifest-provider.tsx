import { GetAssetClientCommand, type AssetClient } from '@wolfgames/client';
import type { Manifest } from '@wolfgames/components/core';
import {
  ManifestProvider,
  useConfigState,
  useGameConfig,
  useSignal,
} from '@wolfgames/components/solid';
import { createResource, Show, type ParentComponent } from 'solid-js';
import { assetSeed } from '../../../../assets/registry';
import { resolveManifestWithClient } from './cdn-manifest';

export interface CdnManifestProviderProps {
  manifest: Manifest;
  defaultGameData: unknown;
  /** CDN data path appended to the config storage URL (default: "chapters/default.json") */
  cdnPath?: string;
}

const DEFAULT_CDN_PATH = 'chapters/default.json';

/**
 * Boot bridge for CDN-first assets: obtains the initialized AssetClient,
 * resolves the manifest srcs against the lockfile, and only then mounts
 * ManifestProvider — nothing downstream resolves an asset URL before the
 * client has decided which manifest (baked seed or pinned release) is live.
 * Replaces GameManifestProvider, whose storage-config cdnBase disagrees with
 * the AssetClient's base outside deployed builds.
 */
export const CdnManifestProvider: ParentComponent<CdnManifestProviderProps> = (props) => {
  const configState = useConfigState();
  const config = useGameConfig();
  const gameKit = useSignal(configState.gameKit);

  const [client] = createResource(gameKit, async (kit) => {
    try {
      const { promise } = kit.execute(new GetAssetClientCommand(assetSeed));
      // The manifest treats names dynamically, so widen the seed-derived key union.
      return (await promise) as AssetClient<string>;
    } catch (error) {
      // Same fail-open posture as AssetClient.init(): a resolver problem must
      // not brick boot — render from the untouched local manifest instead.
      console.warn('[CdnManifestProvider] AssetClient unavailable — using local manifest.', error);
      return null;
    }
  });

  const isFrozen = import.meta.env.VITE_IS_FROZEN === 'true';
  const resolved = (): Manifest => {
    const assetClient = client();
    return assetClient ? resolveManifestWithClient(props.manifest, assetClient) : props.manifest;
  };

  return (
    <Show when={client.state === 'ready'}>
      <ManifestProvider
        manifest={resolved()}
        defaultGameData={props.defaultGameData}
        fetchUrl={isFrozen ? null : config.buildDataUrl(props.cdnPath ?? DEFAULT_CDN_PATH)}
      >
        {props.children}
      </ManifestProvider>
    </Show>
  );
};
