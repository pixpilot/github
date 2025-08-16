import type { CodeQLConfig, QueryFilter, SarifReport } from '../types';

import * as process from 'node:process';

import { exec } from '@actions/exec';

import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';
import { CodeQLDatabase } from './database';
import { QueryPackManager } from './query-packs';

export class CodeQLAnalyzer {
  static async analyzeWithCodeQL(
    codeqlPath: string,
    language: string,
    qlsProfile: string,
    config?: CodeQLConfig,
  ): Promise<void> {
    Logger.info('Running CodeQL analysis...');

    const dbPath = CodeQLDatabase.getDatabasePath();
    const outputPath = FileUtils.joinPath(process.cwd(), 'results.sarif');

    // Use language from config if available, otherwise use input parameter
    const effectiveLanguage = config?.language ?? language;

    const queryPack = QueryPackManager.getQueryPack(effectiveLanguage, qlsProfile);
    Logger.info(`Using query pack: ${queryPack}`);

    try {
      await exec(codeqlPath, [
        'database',
        'analyze',
        dbPath,
        '--ram=4000',
        '--format=sarif-latest',
        `--output=${outputPath}`,
        queryPack,
      ]);
    } catch (error) {
      // If the specific query suite fails, try with a simpler approach
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.warning(`Failed to analyze with ${queryPack}: ${errorMessage}`);
      Logger.warning('Trying fallback approach...');

      // Try with just the base query pack
      const fallbackQueryPack = `codeql/${effectiveLanguage.toLowerCase()}-queries`;
      Logger.info(`Using fallback query pack: ${fallbackQueryPack}`);

      await exec(codeqlPath, [
        'database',
        'analyze',
        dbPath,
        '--ram=4000',
        '--format=sarif-latest',
        `--output=${outputPath}`,
        fallbackQueryPack,
      ]);
    }

    // Apply query filters from config if specified
    if (config?.['query-filters'] && config['query-filters'].length > 0) {
      await this.applyQueryFilters(outputPath, config['query-filters']);
    }
  }

  private static async applyQueryFilters(
    sarifPath: string,
    queryFilters: QueryFilter[],
  ): Promise<void> {
    Logger.info('Applying query filters to SARIF results...');

    if (!FileUtils.exists(sarifPath)) {
      Logger.warning('SARIF file not found for filtering');
      return;
    }

    try {
      const sarif: SarifReport = JSON.parse(FileUtils.readFile(sarifPath)) as SarifReport;

      let filteredCount = 0;
      let totalCount = 0;

      if (sarif.runs && Array.isArray(sarif.runs)) {
        for (const run of sarif.runs) {
          if (run.results && Array.isArray(run.results)) {
            const originalCount = run.results.length;
            totalCount += originalCount;

            // Count filtered results before applying filter
            const filteredResults = run.results.filter(
              (result) =>
                !queryFilters.some((filter) => {
                  if (
                    filter.exclude?.id !== undefined &&
                    filter.exclude.id.length > 0 &&
                    result.ruleId === filter.exclude.id
                  ) {
                    Logger.debug(`Filtered out result for rule: ${result.ruleId}`);
                    return true; // This result should be filtered out
                  }
                  return false; // This result should be kept
                }),
            );

            filteredCount += originalCount - filteredResults.length;
            run.results = filteredResults;
          }
        }
      }

      // Write the filtered SARIF back to file
      const JSON_INDENT = 2;
      FileUtils.writeFile(sarifPath, JSON.stringify(sarif, null, JSON_INDENT));

      Logger.info(
        `Query filters applied: ${filteredCount} results filtered out of ${totalCount}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.warning(`Failed to apply query filters: ${errorMessage}`);
    }
  }

  static getResultsPath(): string {
    return FileUtils.joinPath(process.cwd(), 'results.sarif');
  }
}
