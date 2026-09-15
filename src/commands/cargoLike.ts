import path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';

import {
  Cargo,
  cargoCallArgs,
  CargoInstallOptions,
  CargoOptions,
  getCargoEnv,
} from './cargo.js';

/**
 * Wrapper for a `cargo`-like tool binary that is callable like `cargo`.
 *
 * Supports standalone tools like [`cross`](https://github.com/cross-rs/cross)
 * as well as cargo subcommands like [`cargo-hack`](https://github.com/taiki-e/cargo-hack).
 */
export class CargoLike {
  protected readonly cargoEnv: { [key: string]: string };

  protected constructor(
    public readonly name: string,
    public readonly path: string,
    protected readonly options?: CargoOptions,
  ) {
    this.cargoEnv = getCargoEnv(options);
  }

  /**
   * Gets the installed version of a Cargo-like tool, or installs it using
   * `cargo install` if not yet installed.
   *
   * @param name Name of the Cargo-like tool (the executable name). If tool is
   *             a cargo subcommand, name must include the `cargo-` prefix.
   * @param options Options for calling the tool, or for installing it if
   *                necessary. See {@link CargoInstallOptions}.
   */
  public static async getOrInstall(
    name: string,
    options?: CargoInstallOptions,
  ): Promise<CargoLike> {
    try {
      return await CargoLike.get(name, options);
    } catch (error) {
      core.debug((error as Error).message);
      return await CargoLike.install(name, options);
    }
  }

  /**
   * Gets the installed version of a Cargo-like tool.
   * Throws an exception if not installed.
   *
   * @param name Name of the Cargo-like tool (the executable name). If tool is
   *             a cargo subcommand, name must include the `cargo-` prefix.
   * @param options Options used when calling the tool. See {@link CargoOptions}.
   */
  public static async get(
    name: string,
    options?: CargoOptions,
  ): Promise<CargoLike> {
    const whichPath = options?.home
      ? path.join(options.home, 'bin', name)
      : name;
    const toolPath = await io.which(whichPath, true);

    return new CargoLike(name, toolPath, options);
  }

  /**
   * Installs a Cargo-like tool using `cargo install` and caches it for future use.
   *
   * @param name Name of the Cargo-like tool (the executable name). If tool is
   *             a cargo subcommand, name must include the `cargo-` prefix.
   * @param options Options for calling and installing the tool. See
   *                {@link CargoInstallOptions}.
   * @param cargoOptions Options used to fetch the {@link Cargo} wrapper
   *                     (see {@link Cargo.get}). If not specified, `options`
   *                     will be used for this as well.
   */
  public static async install(
    name: string,
    options?: CargoInstallOptions,
    cargoOptions?: CargoOptions,
  ): Promise<CargoLike> {
    const cargo = await Cargo.get(cargoOptions ?? options);
    const toolPath = await cargo.install(name, options);
    return new CargoLike(name, toolPath, options);
  }

  /**
   * Runs this Cargo-like tool with the provided arguments.
   *
   * @param args Arguments to pass to the tool.
   * @param options Optional exec options.
   * @returns Tool exit code.
   */
  public async call(
    args: string[],
    options?: exec.ExecOptions,
  ): Promise<number> {
    if (this.name.startsWith('cargo-')) {
      // This is a cargo subcommand so we must actually call it through cargo.
      const subcommand = this.name.substring('cargo-'.length);
      const cargo = await Cargo.get(this.options);
      return await cargo.call([subcommand, ...args], options);
    }

    const callArgs = cargoCallArgs(args, this.options);
    const execOptions: exec.ExecOptions = {
      ...options,
      env: {
        ...this.cargoEnv,
        ...options?.env,
      },
    };
    return await exec.exec(this.path, callArgs, execOptions);
  }
}
