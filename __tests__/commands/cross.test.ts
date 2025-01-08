import * as io from '@actions/io';

import { Cargo, Cross, CrossOptions } from '../../src/core';

const SECONDS = 1000;

describe('Cross', () => {
  const primaryKey = process.env.CI ? undefined : 'no-cache';
  const options: CrossOptions = {
    primaryKey,
  };

  describe('install', () => {
    it(
      'installs cross',
      async () => {
        try {
          await io.which('cross', true);
          console.log('cross already installed; skipping this test');
        } catch {
          // cross is not installed; install it
          const cross = await Cross.install(options);
          const exitCode = await cross.call(['--version']);
          expect(exitCode).toBe(0);
        }
      },
      90 * SECONDS,
    );
  });

  describe('get', () => {
    it(
      'fetches the installed cross',
      async () => {
        try {
          await io.which('cross', true);

          // cross is installed, we can test it
          const cross = await Cross.get();
          const exitCode = await cross.call(['--version']);
          expect(exitCode).toBe(0);
        } catch {
          console.log('cross not installed; skipping this test');
        }
      },
      90 * SECONDS,
    );
  });

  describe('getOrInstall', () => {
    it(
      'installs cross if needed, otherwise reuses it',
      async () => {
        const cross = await Cross.getOrInstall(options);
        const exitCode = await cross.call(['--version']);
        expect(exitCode).toBe(0);
      },
      90 * SECONDS,
    );

    describe('with toolchain', () => {
      it(
        'uses cross with the given toolchain',
        async () => {
          // This test assumes that nightly Rust is installed.
          const cargo = await Cargo.get('nightly');
          if ((await cargo.call(['--version'])) === 0) {
            const optionsWithToolchain: CrossOptions = {
              ...options,
              toolchain: 'nightly',
            };
            const cross = await Cross.getOrInstall(optionsWithToolchain);
            const exitCode = await cross.call(['--version']);
            expect(exitCode).toBe(0);
          } else {
            console.log('Nightly Rust not installed; skipping this test');
          }
        },
        90 * SECONDS,
      );
    });
  });
});
