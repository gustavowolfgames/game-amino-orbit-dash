/**
 * Start-screen skip precedence (src/game/screens/skipStartScreen.ts): the Vault always skips,
 * and the first source that holds is what `start_screen_skipped.skip_source` reports.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveSkipSource,
  type SkipSignals,
  type SkipSource,
} from '~/game/screens/skipStartScreen';

const none: SkipSignals = {
  inVault: false,
  configSkip: false,
  devModeSkip: false,
  search: '',
};

describe('resolveSkipSource', () => {
  const table: [string, Partial<SkipSignals>, SkipSource | null][] = [
    ['nothing set shows the start screen', {}, null],
    ['in the Vault', { inVault: true }, 'vault'],
    ['config', { configSkip: true }, 'config'],
    ['dev mode', { devModeSkip: true }, 'dev_mode'],
    ['?screen=game', { search: '?screen=game' }, 'url_param'],
    ['another ?screen= value does not skip', { search: '?screen=start' }, null],
    [
      'the Vault outranks every other source',
      {
        inVault: true,
        configSkip: true,
        devModeSkip: true,
        search: '?screen=game',
      },
      'vault',
    ],
    [
      'config outranks dev mode and the URL',
      { configSkip: true, devModeSkip: true, search: '?screen=game' },
      'config',
    ],
    [
      'dev mode outranks the URL',
      { devModeSkip: true, search: '?screen=game' },
      'dev_mode',
    ],
  ];

  it.each(table)('%s', (_name, signals, expected) => {
    expect(resolveSkipSource({ ...none, ...signals })).toBe(expected);
  });
});
