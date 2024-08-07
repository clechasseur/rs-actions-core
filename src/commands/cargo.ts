import * as io from '@actions/io';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as http from '@actions/http-client';
import * as path from 'path';

export async function resolveVersion(crate: string): Promise<string> {
  const url = `https://crates.io/api/v1/crates/${crate}`;
  const client = new http.HttpClient(
    '@clechasseur/rs-actions-core (https://github.com/clechasseur/rs-actions-core)',
  );

  const resp: any = await client.getJson(url); // eslint-disable-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (resp.result == null) {
    throw new Error('Unable to fetch latest crate version');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return resp.result.crate.newest_version;
}

export class Cargo {
  private readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  public static async get(): Promise<Cargo> {
    try {
      const path = await io.which('cargo', true);

      return new Cargo(path);
    } catch (error) {
      core.error(
        'cargo is not installed by default for some virtual environments, \
see https://help.github.com/en/articles/software-in-virtual-environments-for-github-actions',
      );
      core.error(
        'To install it, use this action: https://github.com/dtolnay/rust-toolchain',
      );

      throw error;
    }
  }

  /**
   * Executes `cargo install ${program}`.
   *
   * `version` argument could be either actual program version or `"latest"` string,
   * which can be provided by user input.
   *
   * If `version` is `undefined` or `"latest"`, this method could call the Crates.io API,
   * fetch the latest version and search for it in cache.
   * TODO: Actually implement this.
   *
   * ## Returns
   *
   * Path to the installed program.
   * As the $PATH should be already tuned properly at this point,
   * returned value at the moment is simply equal to the `program` argument.
   */
  public async installCached(
    program: string,
    version?: string,
    primaryKey?: string,
    restoreKeys?: string[],
  ): Promise<string> {
    if (version == 'latest') {
      version = await resolveVersion(program);
    }
    if (primaryKey) {
      restoreKeys = restoreKeys ?? [];
      const paths = [path.join(path.dirname(this.path), program)];
      const programKey = `${program}-${version ?? ''}-${primaryKey}`;
      const programRestoreKeys = restoreKeys.map(
        (key) => `${program}-${version ?? ''}-${key}`,
      );
      const cacheKey = await cache.restoreCache(
        paths,
        programKey,
        programRestoreKeys,
      );
      if (cacheKey) {
        core.info(
          `Using cached \`${program}\` with version \`${version ?? ''}\``,
        );
        return program;
      } else {
        const res = await this.install(program, version);
        try {
          core.info(`Caching \`${program}\` with key ${programKey}`);
          await cache.saveCache(paths, programKey);
        } catch (error) {
          if ((error as Error).name === cache.ValidationError.name) {
            throw error;
          } else if ((error as Error).name === cache.ReserveCacheError.name) {
            core.info((error as Error).message);
          } else {
            core.info('[warning]' + (error as Error).message);
          }
        }
        return res;
      }
    } else {
      return await this.install(program, version);
    }
  }

  async install(program: string, version?: string): Promise<string> {
    const args = ['install'];
    if (version && version != 'latest') {
      args.push('--version');
      args.push(version);
    }
    args.push(program);

    try {
      core.startGroup(`Installing "${program} = ${version ?? 'latest'}"`);
      await this.call(args);
    } finally {
      core.endGroup();
    }

    return program;
  }

  /**
   * Find the cargo sub-command or install it
   */
  public async findOrInstall(
    program: string,
    version?: string,
  ): Promise<string> {
    try {
      return await io.which(program, true);
    } catch {
      core.info(`${program} is not installed, installing it now`);
    }

    return await this.installCached(program, version);
  }

  public async call(
    args: string[],
    options?: exec.ExecOptions,
  ): Promise<number> {
    return await exec.exec(this.path, args, options);
  }
}
