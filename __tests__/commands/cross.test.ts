import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import * as exec from '@actions/exec';

import {
  Cargo,
  CargoInstallOptions,
  CargoOptions,
  Cross,
} from '../../src/core.js';

const SECONDS = 1000;

describe('Cross', () => {
  const primaryKey = process.env.CI ? undefined : 'no-cache';

  let tmpHomeDir: fs.DisposableTempDir | undefined;
  let tmpOptions: CargoInstallOptions | undefined;

  beforeEach(async () => {
    tmpHomeDir = await fs.mkdtempDisposable(
      path.join(os.tmpdir(), 'rs-actions-core-cross-tests-'),
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
      { version: '0.2.5' },
    ])('with options = %o', (options?: CargoInstallOptions) => {
      it(
        'installs cross',
        async () => {
          const actualOptions: CargoInstallOptions = {
            ...options,
            ...tmpOptions,
          };
          const cross = await Cross.install(actualOptions);
          const exitCode = await cross.call(['--version']);
          expect(exitCode).toBe(0);
        },
        360 * SECONDS,
      );
    });
  });

  describe('get', () => {
    describe('when cross is installed', () => {
      it(
        'fetches the installed cross',
        async () => {
          const options: CargoInstallOptions = { ...tmpOptions };
          await Cross.install(options);

          const cross = await Cross.get(options);
          const exitCode = await cross.call(['--version']);
          expect(exitCode).toBe(0);
        },
        360 * SECONDS,
      );
    });

    describe('when cross is not installed', () => {
      it('throws an exception', async () => {
        const options: CargoOptions = { ...tmpOptions };
        await expect(Cross.get(options)).rejects.toThrow();
      });
    });
  });

  describe('getOrInstall', () => {
    it(
      'installs cross if needed, otherwise reuses it',
      async () => {
        const options: CargoInstallOptions = {
          ...tmpOptions,
        };

        const cross = await Cross.getOrInstall(options);
        const exitCode = await cross.call(['--version']);
        expect(exitCode).toBe(0);

        const alsoCross = await Cross.getOrInstall(options);
        const alsoExitCode = await alsoCross.call(['--version']);
        expect(alsoExitCode).toBe(0);
      },
      360 * SECONDS,
    );

    describe('with toolchain', () => {
      it(
        'uses cross with the given toolchain',
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
            const cross = await Cross.getOrInstall(options);
            const exitCode = await cross.call(['--version']);
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
