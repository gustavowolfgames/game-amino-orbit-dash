export type { VaultGameContext } from '@wolfgames/client';
// SDK content/lifecycle primitives a game-specific consumer needs, alongside
// the <VaultHostBridge> onContext prop.
export {
  inVault,
  reportContentCompleted,
  reportGameCompleted,
} from '@wolfgames/client';
export {
  awaitFirstVaultContext,
  firstVaultContext,
  watchFirstVaultContext,
} from './first-context';
export { VaultHostBridge, type VaultHostBridgeProps } from './host-bridge';
export {
  latestVaultContext,
  type VaultHostFields,
  vaultHostFields,
} from './host-context';
