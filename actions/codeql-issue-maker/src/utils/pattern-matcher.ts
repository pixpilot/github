import * as path from 'node:path';
import * as minimatch from 'minimatch';

export class PatternMatcher {
  static matchesPattern(filePath: string, pattern: string | string[]): boolean {
    if (Array.isArray(pattern)) {
      return pattern.some((p) => this.matchesPattern(filePath, p));
    }

    // Handle comma-separated patterns
    if (pattern.includes(',')) {
      return pattern.split(',').some((p) => this.matchesPattern(filePath, p.trim()));
    }

    // If pattern contains no directory separators, match against basename
    if (!pattern.includes('/') && !pattern.includes('\\')) {
      const basename = path.basename(filePath);
      return minimatch.minimatch(basename, pattern);
    }

    // Otherwise match against full path
    return minimatch.minimatch(filePath, pattern);
  }

  static matchesAnyPattern(file: string, patterns: string[]): boolean {
    return patterns.some((pattern) => this.matchesPattern(file, pattern));
  }

  static filterByPatterns(
    files: string[],
    includePatterns?: string[],
    excludePatterns?: string[],
  ): string[] {
    let filteredFiles = [...files];

    // Apply include patterns
    if (includePatterns && includePatterns.length > 0) {
      filteredFiles = filteredFiles.filter((file) =>
        includePatterns.some((pattern) => this.matchesPattern(file, pattern)),
      );
    }

    // Apply exclude patterns
    if (excludePatterns && excludePatterns.length > 0) {
      filteredFiles = filteredFiles.filter(
        (file) => !excludePatterns.some((pattern) => this.matchesPattern(file, pattern)),
      );
    }

    return filteredFiles;
  }
}
