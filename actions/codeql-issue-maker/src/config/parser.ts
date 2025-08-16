import type { CodeQLConfig, QueryFilter } from '../types';
import { FileUtils } from '../utils/file-utils';
import { Logger } from '../utils/logger';

export class ConfigParser {
  static async parseConfigFile(configPath: string): Promise<CodeQLConfig> {
    try {
      if (!FileUtils.exists(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      const configContent = FileUtils.readFile(configPath);

      // Simple YAML parsing for basic configuration
      // This is a simplified parser - for production use, consider using a proper YAML library
      const config: CodeQLConfig = {
        paths: [],
        'paths-ignore': [],
        'query-filters': [],
        language: undefined,
      };

      const lines = configContent.split('\n');
      let currentSection: string | null = null;
      let currentFilter: QueryFilter | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) {
          // Skip empty lines and comments
        } else if (trimmed.startsWith('paths:')) {
          currentSection = 'paths';
        } else if (trimmed.startsWith('paths-ignore:')) {
          currentSection = 'paths-ignore';
        } else if (trimmed.startsWith('query-filters:')) {
          currentSection = 'query-filters';
        } else if (trimmed.startsWith('language:')) {
          currentSection = 'language';
          // Handle inline language definition like "language: javascript"
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex !== -1 && colonIndex < trimmed.length - 1) {
            const languageValue = trimmed.substring(colonIndex + 1).trim();
            if (languageValue.length > 0) {
              config.language = languageValue;
            }
          }
        } else if (currentSection === 'paths' && trimmed.startsWith('-')) {
          config.paths?.push(trimmed.substring(1).trim());
        } else if (currentSection === 'paths-ignore' && trimmed.startsWith('-')) {
          config['paths-ignore']?.push(trimmed.substring(1).trim());
        } else if (currentSection === 'language' && trimmed.startsWith('-')) {
          config.language = trimmed.substring(1).trim();
        } else if (
          currentSection === 'language' &&
          !trimmed.startsWith('-') &&
          !trimmed.endsWith(':')
        ) {
          config.language = trimmed;
        } else if (currentSection === 'query-filters') {
          if (trimmed.startsWith('- exclude:')) {
            currentFilter = { exclude: {} };
            config['query-filters']?.push(currentFilter);
          } else if (trimmed.startsWith('id:') && currentFilter !== null) {
            if (currentFilter.exclude) {
              currentFilter.exclude.id = trimmed.split(':')[1].trim();
            }
          }
        }
      }

      const JSON_INDENT = 2;
      Logger.info(`Parsed configuration: ${JSON.stringify(config, null, JSON_INDENT)}`);
      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to parse configuration file: ${errorMessage}`);
      throw error;
    }
  }
}
