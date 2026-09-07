import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as http from '@actions/http-client';
import * as io from '@actions/io';

/**
 * Possible arguments to {@link Cargo.get}.
 */
export interface CargoOptions {
  /**
   * Optional toolchain to use when executing `cargo` commands.
   */
  toolchain?: string;

  /**
   * Cargo home directory. If set, will be set via the `CARGO_HOME` environment
   * variable when calling `cargo`.
   */
  home?: string;
}

/**
 * Possible arguments to {@link Cargo.install}. Extends {@link CargoOptions}.
 */
export interface CargoInstallOptions extends CargoOptions {
  /**
   * Version of the program to install.
   *
   * If `undefined` or set to `'latest'`, the latest version will be installed.
   */
  version?: string;

  /**
   * If `true`, passes `--locked` to `cargo install` to use exact dependency
   * versions from `Cargo.lock` when installing the program.
   *
   * If `undefined`, defaults to `true`.
   */
  locked?: boolean;

  /**
   * Primary cache key to use when caching the installed program.
   *
   * If `undefined`, a default value will be used.
   * If set to `'no-cache'`, caching will be disabled.
   */
  primaryKey?: string;

  /**
   * Optional additional restore keys to use when looking for an installed
   * version of the program.
   */
  restoreKeys?: string[];
}

/**
 * Wrapper for the `cargo` command.
 *
 * To obtain the currently installed `cargo`, call {@link Cargo.get}.
 */
export class Cargo {
  protected readonly path: string;
  protected readonly options: CargoOptions;
  protected readonly cargoEnv: { [key: string]: string };

  protected constructor(path: string, options?: CargoOptions) {
    this.path = path;
    this.options = {
      ...options,
      toolchain: cargoToolchainArg(options?.toolchain),
    };
    this.cargoEnv = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        this.cargoEnv[key] = value;
      }
    }
    if (this.options.home !== undefined) {
      this.cargoEnv['CARGO_HOME'] = this.options.home;
    }
  }

  /**
   * Fetches the currently-installed version of `cargo`.
   *
   * @param options Options to use when calling `cargo`.
   */
  public static async get(options?: CargoOptions): Promise<Cargo> {
    try {
      const path = await io.which('cargo', true);

      return new Cargo(path, options);
    } catch (error) {
      core.error(
        'cargo is not installed by default for some virtual environments, \
see https://help.github.com/en/articles/software-in-virtual-environments-for-github-actions',
      );
      core.error(
        'To install it, use an action such as: https://github.com/actions-rust-lang/setup-rust-toolchain',
      );

      throw error;
    }
  }

  /**
   * Looks for a cached version of `program`. If none is found,
   * executes `cargo install ${program}` and caches the result.
   *
   * @param program Program to install.
   * @param options Optional installation options.
   * @returns Path to installed program. Since program will be installed in
   *          the cargo bin directory which is on the `PATH`, this will be
   *          equal to `program` currently (unless Cargo's
   *          {@link CargoOptions.home home} is customized).
   */
  public async install(
    program: string,
    options?: CargoInstallOptions,
  ): Promise<string> {
    const installOptions: CargoInstallOptions = {
      ...options,
      primaryKey: options?.primaryKey ?? 'rs-actions-core',
    };
    if (!installOptions.version || installOptions.version === 'latest') {
      installOptions.version = (await resolveVersion(program)) ?? '';
    }

    const paths = [
      path.join(
        ...(this.options.home
          ? [this.options.home, 'bin']
          : [path.dirname(this.path)]),
        program,
      ),
    ];
    const programKey = `${program}-${installOptions.version}-${installOptions.primaryKey}`;
    const programRestoreKeys = (installOptions.restoreKeys ?? []).map(
      (key) => `${program}-${installOptions.version}-${key}`,
    );

    if (installOptions.primaryKey !== 'no-cache') {
      let cacheKey;
      try {
        core.startGroup(`Looking for "${program}" in cache`);
        cacheKey = await cache.restoreCache(
          paths,
          programKey,
          programRestoreKeys,
        );
      } finally {
        core.endGroup();
      }

      if (cacheKey) {
        core.info(
          `Using cached \`${program}\` with version \`${installOptions.version}\``,
        );
        return program;
      }
    }

    const installPath = await this.cargoInstall(
      program,
      installOptions.version,
      installOptions.locked ?? true,
    );

    if (installOptions.primaryKey !== 'no-cache') {
      try {
        try {
          core.startGroup(`Caching "${program}" with key "${programKey}"`);
          await cache.saveCache(paths, programKey);
        } finally {
          core.endGroup();
        }
      } catch (error) {
        if ((error as Error).name === cache.ValidationError.name) {
          throw error;
        } else if ((error as Error).name === cache.ReserveCacheError.name) {
          core.info((error as Error).message);
        } else {
          core.warning((error as Error).message);
        }
      }
    }

    return installPath;
  }

  /**
   * Runs a `cargo` command.
   *
   * @param args Arguments to pass to `cargo`.
   * @param options Optional exec options.
   * @returns Cargo exit code.
   */
  public async call(
    args: string[],
    options?: exec.ExecOptions,
  ): Promise<number> {
    const execOptions: exec.ExecOptions = {
      ...options,
      env: {
        ...this.cargoEnv,
        ...options?.env,
      },
    };
    return await exec.exec(this.path, this.callArgs(args), execOptions);
  }

  protected callArgs(args: string[]): string[] {
    return this.options.toolchain ? [this.options.toolchain, ...args] : args;
  }

  private async cargoInstall(
    program: string,
    version: string,
    locked: boolean,
  ): Promise<string> {
    const args = ['install'];
    if (version !== 'latest') {
      args.push('--version');
      args.push(version);
    }
    if (locked) {
      args.push('--locked');
    }
    args.push(program);

    try {
      core.startGroup(`Installing "${program} = ${version}"`);
      await this.call(args);
    } finally {
      core.endGroup();
    }

    if (this.options.home) {
      return path.join(this.options.home, 'bin', program);
    }
    return program;
  }
}

/**
 * Computes the argument to pass to cargo to specify a toolchain.
 *
 * @param toolchain Toolchain to use, or `undefined` to use the default toolchain.
 * @returns Cargo toolchain argument. Either an empty string if the default
 *          toolchain must be used, or a toolchain identifier prepended with `+`.
 */
export function cargoToolchainArg(toolchain?: string): string {
  if (!toolchain) {
    return '';
  }

  return toolchain.startsWith('+') ? toolchain : `+${toolchain}`;
}

/**
 * Resolves the latest version of a Cargo crate by contacting crates.io.
 *
 * @param crate Crate name.
 * @returns Latest crate version.
 */
export async function resolveVersion(crate: string): Promise<string> {
  const url = `https://crates.io/api/v1/crates/${crate}`;
  const client = new http.HttpClient(
    '@clechasseur/rs-actions-core (https://github.com/clechasseur/rs-actions-core)',
  );

  const resp: any = await client.getJson(url); // eslint-disable-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!resp.result) {
    throw new Error('Unable to fetch latest crate version');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return resp.result.crate.newest_version;
}
