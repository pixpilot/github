import * as process from 'node:process';
import { exec } from '@actions/exec';

import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';

export class CodeQLInstaller {
  static async initializeCodeQL(_language: string): Promise<string> {
    // Check if CodeQL is available from GitHub Actions setup
    const codeqlEnv = process.env.CODEQL_CLI;
    if (codeqlEnv !== undefined && codeqlEnv.length > 0 && FileUtils.exists(codeqlEnv)) {
      Logger.info(`Using CodeQL from environment: ${codeqlEnv}`);
      return codeqlEnv;
    }

    // Try to find CodeQL in system PATH
    let codeqlPath = 'codeql';
    try {
      await exec('which', ['codeql'], { silent: true });
      Logger.info('CodeQL found in system PATH');
      return codeqlPath;
    } catch {
      Logger.info('CodeQL not found in PATH');
    }

    // Try to find CodeQL in common GitHub Actions locations
    const commonPaths = [
      '/opt/hostedtoolcache/CodeQL/*/x64/codeql',
      '/home/runner/codeql/codeql',
      './codeql/codeql',
    ];

    for (const commonPath of commonPaths) {
      try {
        if (FileUtils.exists(commonPath)) {
          Logger.info(`Found CodeQL at: ${commonPath}`);
          return commonPath;
        }
      } catch {
        // Continue searching
      }
    }

    // As last resort, download CodeQL
    Logger.info('CodeQL not found, attempting to download...');
    await this.downloadCodeQL();
    codeqlPath = FileUtils.joinPath(process.cwd(), 'codeql', 'codeql');

    return codeqlPath;
  }

  private static async downloadCodeQL(): Promise<void> {
    const codeqlVersion = '2.22.3'; // Use the latest available version
    const platform = process.platform === 'darwin' ? 'osx64' : 'linux64';
    const downloadUrl = `https://github.com/github/codeql-cli-binaries/releases/download/v${codeqlVersion}/codeql-${platform}.zip`;

    Logger.info(`Downloading CodeQL from: ${downloadUrl}`);

    try {
      // Download with better error handling and follow redirects
      await exec('curl', [
        '-L', // Follow redirects
        '-f', // Fail silently on HTTP errors
        '--retry',
        '3', // Retry up to 3 times
        '--retry-delay',
        '2', // Wait 2 seconds between retries
        downloadUrl,
        '-o',
        'codeql.zip',
      ]);

      // Verify the download was successful
      const stats = FileUtils.getFileStats('codeql.zip');
      const MIN_FILE_SIZE = 1000; // Minimum expected file size in bytes
      if (stats.size < MIN_FILE_SIZE) {
        throw new Error(`Download failed: file too small (${stats.size} bytes)`);
      }

      Logger.info(`Downloaded ${stats.size} bytes`);

      // Extract the zip archive (using unzip instead of tar)
      await exec('unzip', ['-q', 'codeql.zip']);
      await exec('chmod', ['+x', 'codeql/codeql']);

      // Verify extraction was successful
      if (!FileUtils.exists('codeql/codeql')) {
        throw new Error('CodeQL binary not found after extraction');
      }

      Logger.info('CodeQL downloaded and extracted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to download CodeQL: ${errorMessage}`);
      throw new Error(`CodeQL download failed: ${errorMessage}`);
    }
  }
}
