import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import * as exec from '@actions/exec';

import {
  Cargo,
  CargoInstallOptions,
  CargoLike,
  CargoOptions,
} from '../../src/core.js';

const SECONDS = 1000;

describe('CargoLike', () => {
  const primaryKey = process.env.CI ? undefined : 'no-cache';

  let tmpHomeDir: fs.DisposableTempDir | undefined;
  let tmpOptions: CargoInstallOptions | undefined;

  beforeEach(async () => {
    tmpHomeDir = await fs.mkdtempDisposable(
      path.join(os.tmpdir(), 'rs-actions-core-cargo-like-tests-'),
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
      ['cargo-hack', undefined],
      ['cargo-hack', { locked: undefined }],
      ['cargo-hack', { locked: false }],
      ['cargo-hack', { locked: true }],
      ['cargo-hack', { version: '0.6.45' }],
      ['cross', undefined],
      ['cross', { locked: undefined }],
      ['cross', { locked: false }],
      ['cross', { locked: true }],
      ['cross', { version: '0.2.5' }],
    ])(
      '%s with options = %o',
      (name: string, options?: CargoInstallOptions) => {
        it(
          `installs ${name}`,
          async () => {
            const actualOptions: CargoInstallOptions = {
              ...options,
              ...tmpOptions,
            };
            const tool = await CargoLike.install(name, actualOptions);
            const exitCode = await tool.call(['--version']);
            expect(exitCode).toBe(0);
          },
          360 * SECONDS,
        );
      },
    );
  });

  describe('get', () => {
    describe.each(['cargo-hack', 'cross'])('%s', (name: string) => {
      describe(`when ${name} is installed`, () => {
        it(
          `fetches the installed ${name}`,
          async () => {
            const options: CargoInstallOptions = { ...tmpOptions };
            await CargoLike.install(name, options);

            const tool = await CargoLike.get(name, options);
            const exitCode = await tool.call(['--version']);
            expect(exitCode).toBe(0);
          },
          360 * SECONDS,
        );
      });

      describe(`when ${name} is not installed`, () => {
        it('throws an exception', async () => {
          const options: CargoOptions = { ...tmpOptions };
          await expect(CargoLike.get(name, options)).rejects.toThrow();
        });
      });
    });
  });

  describe('getOrInstall', () => {
    describe.each(['cargo-hack', 'cross'])('%s', (name: string) => {
      it(
        `installs ${name} if needed, otherwise reuses it`,
        async () => {
          const options: CargoInstallOptions = {
            ...tmpOptions,
          };

          const tool = await CargoLike.getOrInstall(name, options);
          const exitCode = await tool.call(['--version']);
          expect(exitCode).toBe(0);

          const alsoTool = await CargoLike.getOrInstall(name, options);
          const alsoExitCode = await alsoTool.call(['--version']);
          expect(alsoExitCode).toBe(0);
        },
        360 * SECONDS,
      );

      describe('with toolchain', () => {
        it(
          `uses ${name} with the given toolchain`,
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
              const tool = await CargoLike.getOrInstall(name, options);
              const exitCode = await tool.call(['--version']);
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
});
