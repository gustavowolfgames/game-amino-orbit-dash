export type {
  ScheduledContentMetadata,
  VaultGameContext,
} from '@wolfgames/client';
// SDK content/lifecycle primitives a game-specific consumer needs, alongside
// the <VaultHostBridge> onContext / catalog props.
export {
  inVault,
  reportContentCompleted,
  reportGameCompleted,
} from '@wolfgames/client';
export { VaultHostBridge, type VaultHostBridgeProps } from './host-bridge';
export {
  latestVaultContext,
  type VaultHostFields,
  vaultHostFields,
} from './host-context';
