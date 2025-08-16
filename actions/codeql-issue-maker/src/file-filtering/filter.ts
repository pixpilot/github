import type { CodeQLConfig, FilterOptions } from '../types';
import * as process from 'node:process';

import * as glob from '@actions/glob';
import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';
import { PatternMatcher } from '../utils/pattern-matcher';

export class FileFilter {
  static async filterFiles(
    includePatterns?: string,
    excludePatterns?: string,
    config?: CodeQLConfig,
  ): Promise<string> {
    const filteredRepoPath = FileUtils.joinPath(process.cwd(), 'filtered-repo');

    // Create filtered-repo directory
    await FileUtils.ensureDirectoryExists(filteredRepoPath);

    // Get all files
    const globber = await glob.create('**/*', {
      implicitDescendants: false,
      followSymbolicLinks: false,
    });

    let allFiles = await globber.glob();
    let includedCount = 0;
    let excludedCount = 0;

    // Apply configuration-based filtering first if config is provided
    if (config) {
      allFiles = this.applyConfigFiltering(allFiles, config);
    }

    const copyPromises: Promise<void>[] = [];

    for (const file of allFiles) {
      const relativePath = FileUtils.getRelativePath(process.cwd(), file);

      // Skip directories and certain system files
      if (FileUtils.isDirectory(file)) {
        // Skip directories
      } else if (this.isSystemFile(relativePath)) {
        // Skip system files
      } else {
        const shouldInclude = this.shouldIncludeFile(relativePath, {
          includePatterns,
          excludePatterns,
          config,
        });

        if (shouldInclude) {
          copyPromises.push(
            this.copyFileToFiltered(file, relativePath, filteredRepoPath),
          );
          includedCount++;
          Logger.debug(`Including: ${relativePath}`);
        } else {
          excludedCount++;
          Logger.debug(`Excluding: ${relativePath}`);
        }
      }
    }

    // Wait for all file copies to complete
    await Promise.all(copyPromises);

    Logger.info(
      `Total files after filtering: ${includedCount} included, ${excludedCount} excluded`,
    );
    return filteredRepoPath;
  }

  private static applyConfigFiltering(files: string[], config: CodeQLConfig): string[] {
    let filteredFiles = [...files];

    // Apply paths filter (include only these paths)
    if (config.paths && config.paths.length > 0) {
      filteredFiles = filteredFiles.filter((file) => {
        const relativePath = FileUtils.getRelativePath(process.cwd(), file);
        return config.paths!.some(
          (configPath) =>
            PatternMatcher.matchesPattern(relativePath, [`${configPath}/**`]) ||
            relativePath.startsWith(configPath),
        );
      });
    }

    // Apply paths-ignore filter (exclude these paths)
    if (config['paths-ignore'] && config['paths-ignore'].length > 0) {
      filteredFiles = filteredFiles.filter((file) => {
        const relativePath = FileUtils.getRelativePath(process.cwd(), file);
        return !config['paths-ignore']!.some(
          (ignorePath) =>
            PatternMatcher.matchesPattern(relativePath, [`${ignorePath}/**`]) ||
            relativePath.startsWith(ignorePath),
        );
      });
    }

    return filteredFiles;
  }

  private static isSystemFile(relativePath: string): boolean {
    return (
      relativePath.startsWith('.git/') ||
      relativePath.startsWith('.github/') ||
      relativePath.startsWith('node_modules/')
    );
  }

  private static shouldIncludeFile(
    relativePath: string,
    options: FilterOptions,
  ): boolean {
    const { includePatterns, excludePatterns } = options;

    // Check exclude patterns first
    if (
      Array.isArray(excludePatterns) &&
      excludePatterns.length > 0 &&
      PatternMatcher.matchesPattern(relativePath, excludePatterns)
    ) {
      return false;
    }

    // Check include patterns (if specified)
    if (Array.isArray(includePatterns) && includePatterns.length > 0) {
      return PatternMatcher.matchesPattern(relativePath, includePatterns);
    }

    return true;
  }

  private static async copyFileToFiltered(
    file: string,
    relativePath: string,
    filteredRepoPath: string,
  ): Promise<void> {
    const destPath = FileUtils.joinPath(filteredRepoPath, relativePath);
    await FileUtils.copyFile(file, destPath);
  }
}
