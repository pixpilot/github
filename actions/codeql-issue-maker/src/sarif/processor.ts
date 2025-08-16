import type { SarifReport } from '../types';

import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';

export class SarifProcessor {
  static processSarifFile(sarifPath: string): SarifReport | null {
    if (!FileUtils.exists(sarifPath)) {
      Logger.info('No SARIF file found. Clean scan.');
      return null;
    }

    try {
      const sarif: SarifReport = JSON.parse(FileUtils.readFile(sarifPath)) as SarifReport;

      if (!sarif.runs || sarif.runs.length === 0) {
        Logger.info('No runs found in SARIF file.');
        return null;
      }

      return sarif;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to process SARIF file: ${errorMessage}`);
      throw error;
    }
  }

  static validateSarif(sarif: SarifReport): boolean {
    return Boolean(sarif.runs && Array.isArray(sarif.runs) && sarif.runs.length > 0);
  }

  static getTotalResultsCount(sarif: SarifReport): number {
    if (!sarif.runs) return 0;

    return sarif.runs.reduce((total, run) => total + (run.results?.length ?? 0), 0);
  }
}
