import { PatternMatcher } from '../../src/utils/pattern-matcher';

describe('patternMatcher', () => {
  describe('matchesPattern', () => {
    it('should return false for empty patterns', () => {
      expect(PatternMatcher.matchesPattern('file.js', '')).toBe(false);
      expect(PatternMatcher.matchesPattern('file.js', [])).toBe(false);
    });

    it('should match exact file names', () => {
      expect(PatternMatcher.matchesPattern('file.js', 'file.js')).toBe(true);
      expect(PatternMatcher.matchesPattern('file.js', 'other.js')).toBe(false);
    });

    it('should handle wildcard patterns', () => {
      expect(PatternMatcher.matchesPattern('file.js', '*.js')).toBe(true);
      expect(PatternMatcher.matchesPattern('file.ts', '*.js')).toBe(false);
      expect(PatternMatcher.matchesPattern('src/file.js', 'src/*.js')).toBe(true);
    });

    it('should handle recursive patterns', () => {
      expect(PatternMatcher.matchesPattern('src/deep/file.js', 'src/**/*.js')).toBe(true);
      expect(
        PatternMatcher.matchesPattern('src/deep/nested/file.js', 'src/**/*.js'),
      ).toBe(true);
      expect(PatternMatcher.matchesPattern('other/file.js', 'src/**/*.js')).toBe(false);
    });

    it('should handle comma-separated patterns', () => {
      expect(PatternMatcher.matchesPattern('file.js', '*.js,*.ts')).toBe(true);
      expect(PatternMatcher.matchesPattern('file.ts', '*.js,*.ts')).toBe(true);
      expect(PatternMatcher.matchesPattern('file.py', '*.js,*.ts')).toBe(false);
    });

    it('should handle array patterns', () => {
      expect(PatternMatcher.matchesPattern('file.js', ['*.js', '*.ts'])).toBe(true);
      expect(PatternMatcher.matchesPattern('file.ts', ['*.js', '*.ts'])).toBe(true);
      expect(PatternMatcher.matchesPattern('file.py', ['*.js', '*.ts'])).toBe(false);
    });
  });

  describe('matchesAnyPattern', () => {
    it('should return true if any pattern matches', () => {
      expect(PatternMatcher.matchesAnyPattern('file.js', ['*.ts', '*.js'])).toBe(true);
      expect(PatternMatcher.matchesAnyPattern('file.js', ['*.ts', '*.py'])).toBe(false);
    });
  });

  describe('filterByPatterns', () => {
    const files = ['src/file.js', 'src/file.ts', 'test/file.test.js', 'README.md'];

    it('should include all files when no patterns are provided', () => {
      const result = PatternMatcher.filterByPatterns(files);
      expect(result).toEqual(files);
    });

    it('should filter by include patterns', () => {
      const result = PatternMatcher.filterByPatterns(files, ['**/*.js']);
      expect(result).toEqual(['src/file.js', 'test/file.test.js']);
    });

    it('should filter by exclude patterns', () => {
      const result = PatternMatcher.filterByPatterns(files, undefined, ['*.md']);
      expect(result).toEqual(['src/file.js', 'src/file.ts', 'test/file.test.js']);
    });

    it('should apply both include and exclude patterns', () => {
      const result = PatternMatcher.filterByPatterns(files, ['src/**/*'], ['*.ts']);
      expect(result).toEqual(['src/file.js']);
    });

    it('should prioritize exclude patterns over include patterns', () => {
      const result = PatternMatcher.filterByPatterns(files, ['**/*.js'], ['test/**/*']);
      expect(result).toEqual(['src/file.js']);
    });
  });
});
