# CodeQL Issue Maker Action

A JavaScript action that runs CodeQL analysis on your repository and automatically creates GitHub issues for each security finding.

## Features

- 🔍 **File Filtering**: Include/exclude files using glob patterns
- 🛡️ **CodeQL Analysis**: Runs CodeQL security analysis
- 📋 **Issue Creation**: Creates a GitHub issue for each finding
- 🔄 **Deduplication**: Prevents duplicate issues using fingerprinting
- 🏷️ **Smart Labeling**: Labels issues with `codeql-finding`

## Usage

```yaml
name: CodeQL Security Scan

permissions:
  security-events: write
  actions: read
  contents: read
  issues: write

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '30 1 * * 0'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run CodeQL Analysis and Create Issues
        uses: pixpilot/github/actions/codeql-issue-maker@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          language: javascript
          exclude: 'tests/**,**/__tests__/**,**/*.test.ts,*.spec.ts,**/*.min.js,dist/**,build/**,coverage/**,*.md,*.txt,*.pdf,*.png,*.jpg,*.ico'
```

## Inputs

| Input         | Description                                | Required | Default                |
| ------------- | ------------------------------------------ | -------- | ---------------------- |
| `language`    | Programming language to scan               | Yes      | `javascript`           |
| `qls-profile` | CodeQL QLS profile                         | No       | `security-and-quality` |
| `include`     | Glob patterns to include (comma-separated) | No       | -                      |
| `exclude`     | Glob patterns to exclude (comma-separated) | No       | -                      |
| `token`       | GitHub token for creating issues           | Yes      | -                      |

## Development

To modify this action:

1. Edit `index.js`
2. Run `npm run build` to create the bundled `dist/index.js`
3. Commit both the source and dist files

## Building

```bash
npm install
npm run build
```

## License

MIT License - see the action.yml file for details.
