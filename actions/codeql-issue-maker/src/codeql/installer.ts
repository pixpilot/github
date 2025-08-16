import * as process from 'node:process';
import { exec } from '@actions/exec';

import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  assets: GitHubAsset[];
}

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
    Logger.info('Fetching latest CodeQL bundle information from GitHub API...');

    try {
      // Get the latest CodeQL bundle release information
      const apiResponse = await this.getLatestCodeQLRelease();
      const platform = this.getPlatformIdentifier();
      const bundleAsset = this.findBundleAsset(apiResponse.assets, platform);

      if (!bundleAsset) {
        throw new Error(`No CodeQL bundle found for platform: ${platform}`);
      }

      Logger.info(`Downloading CodeQL bundle: ${bundleAsset.name} (${bundleAsset.size} bytes)`);

      // Download the bundle
      await exec('curl', [
        '-L', // Follow redirects
        '-f', // Fail silently on HTTP errors
        '--retry',
        '3', // Retry up to 3 times
        '--retry-delay',
        '2', // Wait 2 seconds between retries
        bundleAsset.browser_download_url,
        '-o',
        bundleAsset.name,
      ]);

      // Verify the download was successful
      const stats = FileUtils.getFileStats(bundleAsset.name);
      const MIN_FILE_SIZE = 1000000; // Minimum expected file size in bytes (1MB)
      if (stats.size < MIN_FILE_SIZE) {
        throw new Error(`Download failed: file too small (${stats.size} bytes)`);
      }

      Logger.info(`Downloaded ${stats.size} bytes`);

      // Extract the tar.gz archive
      if (bundleAsset.name.endsWith('.tar.gz')) {
        await exec('tar', ['-xzf', bundleAsset.name]);
      } else if (bundleAsset.name.endsWith('.tar.zst')) {
        // For .tar.zst files, we need zstd tool which might not be available
        // Fall back to .tar.gz if zstd is not available
        Logger.info('Zstandard format detected, but falling back to tar.gz for compatibility');
        // Re-download the .tar.gz version
        const gzAsset = apiResponse.assets.find((asset: GitHubAsset) => 
          asset.name === `codeql-bundle-${platform}.tar.gz`
        );
        if (gzAsset) {
          Logger.info(`Re-downloading .tar.gz version: ${gzAsset.name}`);
          await exec('curl', [
            '-L', '-f', '--retry', '3', '--retry-delay', '2',
            gzAsset.browser_download_url, '-o', gzAsset.name
          ]);
          await exec('tar', ['-xzf', gzAsset.name]);
        } else {
          throw new Error('No .tar.gz alternative found for bundle');
        }
      } else {
        throw new Error(`Unsupported archive format: ${bundleAsset.name}`);
      }

      // Make the CodeQL binary executable
      const codeqlBinary = process.platform === 'win32' ? 'codeql/codeql.exe' : 'codeql/codeql';
      if (process.platform !== 'win32') {
        await exec('chmod', ['+x', codeqlBinary]);
      }

      // Verify extraction was successful
      if (!FileUtils.exists(codeqlBinary)) {
        throw new Error(`CodeQL binary not found after extraction: ${codeqlBinary}`);
      }

      Logger.info('CodeQL bundle downloaded and extracted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to download CodeQL: ${errorMessage}`);
      throw new Error(`CodeQL download failed: ${errorMessage}`);
    }
  }

  private static async getLatestCodeQLRelease(): Promise<GitHubRelease> {
    // Use curl to fetch the latest release info from GitHub API
    const tempFile = 'codeql-release-info.json';
    
    try {
      await exec('curl', [
        '-L',
        '-f',
        '--retry',
        '3',
        'https://api.github.com/repos/github/codeql-action/releases/latest',
        '-o',
        tempFile,
      ]);

      // Read and parse the response
      const fs = await import('node:fs/promises');
      const releaseData = await fs.readFile(tempFile, 'utf8');
      const release = JSON.parse(releaseData) as GitHubRelease;

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {
        // Ignore cleanup errors
      });

      return release;
    } catch (error) {
      throw new Error(`Failed to fetch release information: ${error}`);
    }
  }

  private static getPlatformIdentifier(): string {
    switch (process.platform) {
      case 'darwin':
        return 'osx64';
      case 'win32':
        return 'win64';
      case 'linux':
      default:
        return 'linux64';
    }
  }

  private static findBundleAsset(assets: GitHubAsset[], platform: string): GitHubAsset | null {
    // Prefer .tar.gz over .tar.zst for better compatibility
    const gzAsset = assets.find((asset: GitHubAsset) => 
      asset.name === `codeql-bundle-${platform}.tar.gz`
    );
    
    if (gzAsset) {
      return gzAsset;
    }

    // Fall back to .tar.zst if .tar.gz is not available
    const zstAsset = assets.find((asset: GitHubAsset) => 
      asset.name === `codeql-bundle-${platform}.tar.zst`
    );
    
    return zstAsset || null;
  }
}
