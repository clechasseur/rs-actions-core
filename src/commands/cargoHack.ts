import * as io from '@actions/io';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

import { Cargo, CargoInstallOptions, CargoOptions } from './cargo.js';

/**
 * Wrapper for `cargo-hack`, called via `cargo`.
 *
 * Either fetch an existing installed version using {@link CargoHack.get}
 * or install one as required using {@link CargoHack.getOrInstall}.
 */
export class CargoHack {
  private constructor(private readonly options?: CargoOptions) {}

  /**
   * Gets the installed version of `cargo-hack`, or installs it if not yet
   * installed.
   *
   * @param options Options for calling `cargo-hack`, or for installing it
   *                if necessary. See {@link CargoInstallOptions}.
   */
  public static async getOrInstall(
    options?: CargoInstallOptions,
  ): Promise<CargoHack> {
    try {
      return await CargoHack.get(options);
    } catch (error) {
      core.debug((error as Error).message);
      return await CargoHack.install(options);
    }
  }

  /**
   * Gets the installed version of `cargo-hack`.
   * Throws an exception if not installed.
   *
   * @param options Options used when calling `cargo-hack`.
   */
  public static async get(options?: CargoOptions): Promise<CargoHack> {
    // io.which will throw an exception if not installed, but we don't need the path proper.
    await io.which('cargo-hack', true);

    return new CargoHack(options);
  }

  /**
   * Install `cargo-hack` and caches it for future use.
   *
   * @param options Options for calling and installing `cargo-hack`. See
   *                {@link CargoInstallOptions}.
   * @param cargoOptions Options used to fetch the {@link Cargo} wrapper
   *                     (see {@link Cargo.get}). If not specified, `options`
   *                     will be used for this as well.
   */
  public static async install(
    options?: CargoInstallOptions,
    cargoOptions?: CargoOptions,
  ): Promise<CargoHack> {
    const cargo = await Cargo.get(cargoOptions ?? options);
    await cargo.install('cargo-hack', options);
    return new CargoHack(options);
  }

  /**
   * Runs `cargo hack ${args}`.
   *
   * @param args Arguments to pass to `cargo-hack` (after `cargo hack ...`).
   * @param options Optional exec options.
   * @returns `cargo-hack` exit code.
   */
  public async call(
    args: string[],
    options?: exec.ExecOptions,
  ): Promise<number> {
    // cargo-hack is a cargo subcommand so we must actually call it through cargo.
    const cargo = await Cargo.get(this.options);
    return await cargo.call(['hack', ...args], options);
  }
}
