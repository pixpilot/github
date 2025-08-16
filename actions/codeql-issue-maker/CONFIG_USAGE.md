# CodeQL Configuration File Support

Your CodeQL Issue Maker action now supports CodeQL configuration files! 🎉

## How to Use

### 1. Create a Configuration File

Create a file like `.github/codeql/codeql-configuration.yml`:

```yaml
name: CodeQL Configuration

# Include only these paths
paths:
  - src
  - lib

# Exclude these paths
paths-ignore:
  - tests
  - **/__tests__/**
  - dist
  - build

# Filter out specific query results
query-filters:
  # Example: Exclude regex injection warnings for dynamic RegExp
  - exclude:
      id: js/regex-injection
  # Example: Exclude unused variable warnings
  - exclude:
      id: js/unused-local-variable

# Override language detection
language:
  - javascript
```

### 2. Update Your Workflow

```yaml
- name: Run CodeQL Analysis and Create Issues
  uses: pixpilot/github/actions/codeql-issue-maker@main
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    config-file: .github/codeql/codeql-configuration.yml
    # Optional: still can use individual parameters
    language: javascript
```

## Configuration Options

### `paths`

- **Purpose**: Include only files in these directories
- **Example**: `paths: [src, lib]` - only scan src/ and lib/ directories
- **Note**: If not specified, all files are included (subject to other filters)

### `paths-ignore`

- **Purpose**: Exclude files in these directories
- **Example**: `paths-ignore: [tests, dist]` - skip tests/ and dist/ directories
- **Note**: Applied after `paths` filter

### `query-filters`

- **Purpose**: Exclude specific CodeQL rules from results
- **Format**:
  ```yaml
  query-filters:
    - exclude:
        id: rule-id-to-exclude
  ```
- **Example**: Exclude regex injection warnings that are false positives

### `language`

- **Purpose**: Override the language parameter
- **Example**: `language: - javascript`

## Precedence Order

1. **Configuration file** settings are applied first
2. **Action inputs** can override config file settings
3. **Command line patterns** (include/exclude) are applied last

## Example Usage

For your current setup, you could use:

```yaml
# .github/codeql/codeql-configuration.yml
name: CodeQL Configuration

paths:
  - actions
  - workflows

paths-ignore:
  - tests
  - node_modules
  - dist

query-filters:
  - exclude:
      id: js/regex-injection # Your existing filter

language:
  - javascript
```

Then in your workflow:

```yaml
- name: Run CodeQL Analysis and Create Issues
  uses: pixpilot/github/actions/codeql-issue-maker@main
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    config-file: .github/codeql/codeql-configuration.yml
```

This way you can maintain all your CodeQL settings in one place! 🚀
