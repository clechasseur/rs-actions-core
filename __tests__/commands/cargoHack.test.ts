import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import * as exec from '@actions/exec';

import {
  Cargo,
  CargoHack,
  CargoInstallOptions,
  CargoOptions,
} from '../../src/core.js';

const SECONDS = 1000;

describe('CargoHack', () => {
  const primaryKey = process.env.CI ? undefined : 'no-cache';

  let tmpHomeDir: fs.DisposableTempDir | undefined;
  let tmpOptions: CargoInstallOptions | undefined;

  beforeEach(async () => {
    tmpHomeDir = await fs.mkdtempDisposable(
      path.join(os.tmpdir(), 'rs-actions-core-cargo-hack-tests-'),
    );
    tmpOptions = {
      home: tmpHomeDir.path,
      primaryKey,
    };
  });

  afterEach(async () => {
    tmpOptions = undefined;
    await tmpHomeDir?.remove();
    tmpHomeDir = undefined;
  });

  describe('install', () => {
    describe.each([
      undefined,
      { locked: undefined },
      { locked: false },
      { locked: true },
      { version: '0.6.45' },
    ])('with options = %o', (options?: CargoInstallOptions) => {
      it(
        'installs cargo-hack',
        async () => {
          const actualOptions: CargoInstallOptions = {
            ...options,
            ...tmpOptions,
          };
          const cargoHack = await CargoHack.install(actualOptions);
          const exitCode = await cargoHack.call(['--version']);
          expect(exitCode).toBe(0);
        },
        360 * SECONDS,
      );
    });
  });

  describe('get', () => {
    describe('when cargo-hack is installed', () => {
      it(
        'fetches the installed cargo-hack',
        async () => {
          const options: CargoInstallOptions = { ...tmpOptions };
          await CargoHack.install(options);

          const cargoHack = await CargoHack.get(options);
          const exitCode = await cargoHack.call(['--version']);
          expect(exitCode).toBe(0);
        },
        360 * SECONDS,
      );
    });

    describe('when cargo-hack is not installed', () => {
      it('throws an exception', async () => {
        const options: CargoOptions = { ...tmpOptions };
        await expect(CargoHack.get(options)).rejects.toThrow();
      });
    });
  });

  describe('getOrInstall', () => {
    it(
      'installs cargo-hack if needed, otherwise reuses it',
      async () => {
        const options: CargoInstallOptions = {
          ...tmpOptions,
        };

        const cargoHack = await CargoHack.getOrInstall(options);
        const exitCode = await cargoHack.call(['--version']);
        expect(exitCode).toBe(0);

        const alsoCargoHack = await CargoHack.getOrInstall(options);
        const alsoExitCode = await alsoCargoHack.call(['--version']);
        expect(alsoExitCode).toBe(0);
      },
      360 * SECONDS,
    );

    describe('with toolchain', () => {
      it(
        'uses cargo-hack with the given toolchain',
        async () => {
          // This test assumes that nightly Rust is installed.
          const options: CargoInstallOptions = {
            ...tmpOptions,
            toolchain: 'nightly',
          };
          const cargo = await Cargo.get(options);

          const execOptions: exec.ExecOptions = {
            ignoreReturnCode: true,
            failOnStdErr: false,
          };
          if ((await cargo.call(['--version'], execOptions)) === 0) {
            const cargoHack = await CargoHack.getOrInstall(options);
            const exitCode = await cargoHack.call(['--version']);
            expect(exitCode).toBe(0);
          } else {
            console.log('Nightly Rust not installed; skipping this test');
          }
        },
        360 * SECONDS,
      );
    });
  });
});
