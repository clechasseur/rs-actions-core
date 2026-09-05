import * as io from '@actions/io';

import { Cargo } from '../../src/core.js';

const SECONDS = 1000;

describe('Cargo', () => {
  const primaryKey = process.env.CI ? undefined : 'no-cache';

  describe('install', () => {
    describe('with locked', () => {
      it(
        'installs cargo-audit using the version pins from its own Cargo.lock',
        async () => {
          if (await io.which('cargo-audit')) {
            console.log('cargo-audit already installed; skipping this test');
          } else {
            const cargo = await Cargo.get();
            await cargo.install(
              'cargo-audit',
              undefined,
              primaryKey,
              undefined,
              true,
            );

            const exitCode = await cargo.call(['audit', '--version']);
            expect(exitCode).toBe(0);
          }
        },
        300 * SECONDS,
      );
    });
  });
});
