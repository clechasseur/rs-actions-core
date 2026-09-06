import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { Cargo, CargoInstallOptions } from '../../src/core.js';

const SECONDS = 1000;

describe('Cargo', () => {
  const primaryKey = process.env.CI ? undefined : 'no-cache';

  let tmpHomeDir: fs.DisposableTempDir | undefined;
  let tmpOptions: CargoInstallOptions | undefined;

  beforeEach(async () => {
    tmpHomeDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'rs-actions-core-cargo-tests-'));
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
      { version: '0.22.2' },
    ])('with options = %o', (options?: CargoInstallOptions) => {
      it(
        'installs cargo-audit',
        async () => {
          const actualOptions: CargoInstallOptions = {
            ...options,
            ...tmpOptions,
          };
          const cargo = await Cargo.get(actualOptions);
          await cargo.install('cargo-audit', actualOptions);

          const exitCode = await cargo.call(['audit', '--version']);
          expect(exitCode).toBe(0);
        },
        360 * SECONDS,
      );
    });
  });
});
