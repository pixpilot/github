import type { AnalysisInputs } from './types';

import * as core from '@actions/core';

import { CodeQLAnalyzer } from './codeql/analyzer';
import { CodeQLDatabase } from './codeql/database';
import { CodeQLInstaller } from './codeql/installer';
import { QueryPackManager } from './codeql/query-packs';
import { ConfigParser } from './config/parser';
import { FileFilter } from './file-filtering/filter';
import { IssueCreator } from './github/issue-creator';
import { SarifProcessor } from './sarif/processor';
import { Logger } from './utils/logger';

/**
 * Main entry point for the action
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const inputs: AnalysisInputs = {
      language: core.getInput('language') || 'javascript',
      qlsProfile: core.getInput('qls-profile') || 'security-and-quality',
      includePatterns: core.getInput('include'),
      excludePatterns: core.getInput('exclude'),
      configFile: core.getInput('config-file'),
      token: core.getInput('token', { required: true }),
    };

    Logger.info(`Starting CodeQL analysis for language: ${inputs.language}`);
    Logger.info(`QLS Profile: ${inputs.qlsProfile}`);
    if (typeof inputs.includePatterns === 'string' && inputs.includePatterns.length > 0) {
      Logger.info(`Include patterns: ${inputs.includePatterns}`);
    }
    if (typeof inputs.excludePatterns === 'string' && inputs.excludePatterns.length > 0) {
      Logger.info(`Exclude patterns: ${inputs.excludePatterns}`);
    }
    if (typeof inputs.configFile === 'string' && inputs.configFile.length > 0) {
      Logger.info(`Config file: ${inputs.configFile}`);
    }

    // Step 1: Parse configuration file if provided
    let config = null;
    if (inputs.configFile !== undefined && inputs.configFile.length > 0) {
      config = await ConfigParser.parseConfigFile(inputs.configFile);
      Logger.info('Configuration file loaded successfully');
    }

    // Step 2: Filter files based on include/exclude patterns (or config)
    const filteredPath = await FileFilter.filterFiles(
      inputs.includePatterns,
      inputs.excludePatterns,
      config ?? undefined,
    );
    Logger.info(`Filtered files location: ${filteredPath}`);

    // Step 3: Initialize CodeQL
    const codeqlPath = await CodeQLInstaller.initializeCodeQL(inputs.language);
    Logger.info(`CodeQL initialized at: ${codeqlPath}`);

    // Step 3.5: Download query packs for better compatibility
    await QueryPackManager.downloadQueryPacks(codeqlPath);

    // Step 4: Create CodeQL database
    await CodeQLDatabase.createDatabase(
      codeqlPath,
      filteredPath,
      inputs.language,
      config ?? undefined,
    );
    Logger.info('CodeQL database created successfully');

    // Step 5: Analyze with CodeQL
    await CodeQLAnalyzer.analyzeWithCodeQL(
      codeqlPath,
      inputs.language,
      inputs.qlsProfile,
      config ?? undefined,
    );
    Logger.info('CodeQL analysis completed');

    // Step 6: Process SARIF and create issues
    const sarif = SarifProcessor.processSarifFile(CodeQLAnalyzer.getResultsPath());
    if (sarif) {
      await IssueCreator.createIssuesFromSarif(sarif, inputs.token);
      Logger.info('SARIF processing and issue creation completed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    Logger.setFailed(`Action failed: ${errorMessage}`);
    Logger.debug(errorStack ?? 'No stack trace available');
  }
}

// Run the action
if (require.main === module) {
  run().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.setFailed(`Unhandled error: ${errorMessage}`);
  });
}

export { run };
