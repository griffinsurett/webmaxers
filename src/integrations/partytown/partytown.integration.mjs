// src/integrations/partytown/partytown.integration.mjs
/**
 * Conditional Partytown Integration
 *
 * Only copies partytown library files to the output directory.
 * Does NOT inject the bootstrap script into pages automatically.
 *
 * The bootstrap script is conditionally loaded by PartytownLoader.astro,
 * which only loads partytown if there are actual type="text/partytown" scripts.
 *
 * This prevents loading ~3KB of unused JS when partytown isn't needed.
 *
 * Usage in astro.config.mjs:
 *   import conditionalPartytown from './src/integrations/partytown/partytown.integration.mjs';
 *   integrations: [conditionalPartytown()]
 *
 * Usage in your layout:
 *   import PartytownLoader from '@/integrations/partytown/PartytownLoader.astro';
 *   <PartytownLoader forward={['dataLayer.push']} />
 */

// @qwik.dev/partytown is the maintained continuation of @builder.io/partytown
// (Builder handed the project to the Qwik team; the old scope is unmaintained).
// Same `copyLibFiles` API, so the integration below is unchanged.
import { copyLibFiles } from '@qwik.dev/partytown/utils';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function conditionalPartytownIntegration() {
  return {
    name: 'conditional-partytown',
    hooks: {
      async 'astro:build:done'({ dir }) {
        // Copy partytown library files to output directory
        const outDir = fileURLToPath(dir);
        const partytownDir = join(outDir, '~partytown');
        await copyLibFiles(partytownDir);
      },
    },
  };
}
