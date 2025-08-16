import { exec } from '@actions/exec';

import { Logger } from '../utils/logger';

export class QueryPackManager {
  static async downloadQueryPacks(codeqlPath: string): Promise<void> {
    Logger.info('Downloading CodeQL query packs...');

    // Common query packs to download
    const queryPacks = [
      'codeql/javascript-queries',
      'codeql/python-queries',
      'codeql/java-queries',
      'codeql/csharp-queries',
      'codeql/cpp-queries',
      'codeql/go-queries',
    ];

    const downloadPromises = queryPacks.map(async (pack) => {
      try {
        Logger.info(`Downloading query pack: ${pack}`);
        await exec(codeqlPath, ['pack', 'download', pack], {
          silent: true,
          ignoreReturnCode: true, // Don't fail if a specific pack isn't available
        });
      } catch {
        // Silently continue if pack download fails
        Logger.debug(`Failed to download query pack: ${pack}`);
      }
    });

    await Promise.all(downloadPromises);

    Logger.info('Query pack download completed');
  }

  static getQueryPack(language: string, profile: string): string {
    const queryPacks: Record<string, Record<string, string>> = {
      javascript: {
        'security-and-quality':
          'codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls',
        'security-extended':
          'codeql/javascript-queries:codeql-suites/javascript-security-extended.qls',
        security:
          'codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls',
      },
      typescript: {
        'security-and-quality':
          'codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls',
        'security-extended':
          'codeql/javascript-queries:codeql-suites/javascript-security-extended.qls',
        security:
          'codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls',
      },
      python: {
        'security-and-quality':
          'codeql/python-queries:codeql-suites/python-security-and-quality.qls',
        'security-extended':
          'codeql/python-queries:codeql-suites/python-security-extended.qls',
        security: 'codeql/python-queries:codeql-suites/python-security-and-quality.qls',
      },
      java: {
        'security-and-quality':
          'codeql/java-queries:codeql-suites/java-security-and-quality.qls',
        'security-extended':
          'codeql/java-queries:codeql-suites/java-security-extended.qls',
        security: 'codeql/java-queries:codeql-suites/java-security-and-quality.qls',
      },
      csharp: {
        'security-and-quality':
          'codeql/csharp-queries:codeql-suites/csharp-security-and-quality.qls',
        'security-extended':
          'codeql/csharp-queries:codeql-suites/csharp-security-extended.qls',
        security: 'codeql/csharp-queries:codeql-suites/csharp-security-and-quality.qls',
      },
      cpp: {
        'security-and-quality':
          'codeql/cpp-queries:codeql-suites/cpp-security-and-quality.qls',
        'security-extended': 'codeql/cpp-queries:codeql-suites/cpp-security-extended.qls',
        security: 'codeql/cpp-queries:codeql-suites/cpp-security-and-quality.qls',
      },
      go: {
        'security-and-quality':
          'codeql/go-queries:codeql-suites/go-security-and-quality.qls',
        'security-extended': 'codeql/go-queries:codeql-suites/go-security-extended.qls',
        security: 'codeql/go-queries:codeql-suites/go-security-and-quality.qls',
      },
    };

    const langQueries = queryPacks[language.toLowerCase()];
    if (langQueries === undefined) {
      // Fallback to simple query pack specification
      return `codeql/${language.toLowerCase()}-queries`;
    }

    return langQueries[profile] || langQueries['security-and-quality'];
  }
}
