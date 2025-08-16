import { ConfigParser } from '../../src/config/parser';
import { FileUtils } from '../../src/utils/file-utils';

// Mock the FileUtils
jest.mock('../../src/utils/file-utils', () => ({
  FileUtils: {
    exists: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFileUtils = FileUtils as jest.Mocked<typeof FileUtils>;

describe('configParser', () => {
  describe('parseConfigFile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw error if config file does not exist', async () => {
      mockFileUtils.exists.mockReturnValue(false);

      await expect(ConfigParser.parseConfigFile('nonexistent.yml')).rejects.toThrow(
        'Configuration file not found: nonexistent.yml',
      );
    });

    it('should parse basic YAML configuration', async () => {
      const mockYamlContent = `
paths:
  - src/**
  - lib/**
paths-ignore:
  - test/**
  - node_modules/**
language: javascript
query-filters:
  - exclude:
      id: js/unused-local-variable
`;

      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(mockYamlContent);

      const result = await ConfigParser.parseConfigFile('test.yml');

      expect(result).toEqual({
        paths: ['src/**', 'lib/**'],
        'paths-ignore': ['test/**', 'node_modules/**'],
        language: 'javascript',
        'query-filters': [
          {
            exclude: {
              id: 'js/unused-local-variable',
            },
          },
        ],
      });
    });

    it('should handle empty configuration file', async () => {
      const mockYamlContent = `# Empty config file
# Just comments`;

      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(mockYamlContent);

      const result = await ConfigParser.parseConfigFile('empty.yml');

      expect(result).toEqual({
        paths: [],
        'paths-ignore': [],
        'query-filters': [],
        language: undefined,
      });
    });

    it('should ignore comments and empty lines', async () => {
      const mockYamlContent = `
# This is a comment
paths:
  - src/**
  # Another comment

paths-ignore:
  - test/**
`;

      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(mockYamlContent);

      const result = await ConfigParser.parseConfigFile('test.yml');

      expect(result.paths).toEqual(['src/**']);
      expect(result['paths-ignore']).toEqual(['test/**']);
    });

    it('should handle multiple query filters', async () => {
      const mockYamlContent = `
query-filters:
  - exclude:
      id: js/unused-local-variable
  - exclude:
      id: js/unreachable-statement
`;

      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(mockYamlContent);

      const result = await ConfigParser.parseConfigFile('test.yml');

      expect(result['query-filters']).toEqual([
        { exclude: { id: 'js/unused-local-variable' } },
        { exclude: { id: 'js/unreachable-statement' } },
      ]);
    });

    it('should handle malformed configuration gracefully', async () => {
      const mockYamlContent = `
paths:
  invalid structure
  - src/**
`;

      mockFileUtils.exists.mockReturnValue(true);
      mockFileUtils.readFile.mockReturnValue(mockYamlContent);

      const result = await ConfigParser.parseConfigFile('test.yml');

      expect(result.paths).toEqual(['src/**']);
    });
  });
});
