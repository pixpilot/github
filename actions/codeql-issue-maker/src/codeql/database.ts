import type { CodeQLConfig } from '../types';

import * as process from 'node:process';

import { exec } from '@actions/exec';

import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';

export class CodeQLDatabase {
  static async createDatabase(
    codeqlPath: string,
    filteredPath: string,
    language: string,
    config?: CodeQLConfig,
  ): Promise<void> {
    Logger.info('Creating CodeQL database from filtered files...');

    const dbPath = FileUtils.joinPath(process.cwd(), 'codeql-db');

    // Use language from config if available, otherwise use input parameter
    const effectiveLanguage = config?.language ?? language;

    // Change to filtered directory and create database
    await exec(codeqlPath, [
      'database',
      'create',
      dbPath,
      `--language=${effectiveLanguage}`,
      `--source-root=${filteredPath}`,
    ]);
  }

  static getDatabasePath(): string {
    return FileUtils.joinPath(process.cwd(), 'codeql-db');
  }
}
