import * as io from '@actions/io';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

import { Cargo, CargoInstallOptions, CargoOptions } from './cargo.js';

/**
 * Wrapper for `cross`.
 *
 * Either fetch an existing installed version using {@link Cross.get}
 * or install one as required using {@link Cross.getOrInstall}.
 */
export class Cross {
  private constructor(
    private readonly path: string,
    private readonly options?: CargoOptions,
  ) {}

  /**
   * Gets the installed version of `cross`, or installs it if not yet installed.
   *
   * @param options Options for calling `cross`, or for installing it if
   *                necessary. See {@link CargoInstallOptions}.
   */
  public static async getOrInstall(
    options?: CargoInstallOptions,
  ): Promise<Cross> {
    try {
      return await Cross.get(options);
    } catch (error) {
      core.debug((error as Error).message);
      return await Cross.install(options);
    }
  }

  /**
   * Gets the installed version of `cross`.
   * Throws an exception if not installed.
   *
   * @param options Options used when calling `cross`.
   */
  public static async get(options?: CargoOptions): Promise<Cross> {
    const path = await io.which('cross', true);

    return new Cross(path, options);
  }

  /**
   * Install `cross` and caches it for future use.
   *
   * @param options Options for calling and installing `cross`. See
   *                {@link CargoInstallOptions}.
   * @param cargoOptions Options used to fetch the {@link Cargo} wrapper
   *                     (see {@link Cargo.get}). If not specified, `options`
   *                     will be used for this as well.
   */
  public static async install(
    options?: CargoInstallOptions,
    cargoOptions?: CargoOptions,
  ): Promise<Cross> {
    const cargo = await Cargo.get(cargoOptions ?? options);
    const crossPath = await cargo.install('cross', options);
    return new Cross(crossPath, options);
  }

  /**
   * Runs a `cross` command.
   *
   * @param args Arguments to pass to `cross`.
   * @param options Optional exec options.
   * @returns `cross` exit code.
   */
  public async call(
    args: string[],
    options?: exec.ExecOptions,
  ): Promise<number> {
    return await exec.exec(this.path, this.callArgs(args), options);
  }

  private callArgs(args: string[]): string[] {
    return this.options?.toolchain ? [this.options.toolchain, ...args] : args;
  }
}
