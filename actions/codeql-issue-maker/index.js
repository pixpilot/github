/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const glob = require('@actions/glob');

/**
 * Main entry point for the action
 */
async function run() {
  try {
    // Get inputs
    const language = core.getInput('language') || 'javascript';
    const qlsProfile = core.getInput('qls-profile') || 'security-and-quality';
    const includePatterns = core.getInput('include');
    const excludePatterns = core.getInput('exclude');
    const token = core.getInput('token', { required: true });

    core.info(`Starting CodeQL analysis for language: ${language}`);
    core.info(`QLS Profile: ${qlsProfile}`);
    if (includePatterns) core.info(`Include patterns: ${includePatterns}`);
    if (excludePatterns) core.info(`Exclude patterns: ${excludePatterns}`);

    // Step 1: Filter files based on include/exclude patterns
    const filteredPath = await filterFiles(includePatterns, excludePatterns);
    core.info(`Filtered files location: ${filteredPath}`);

    // Step 2: Initialize CodeQL
    const codeqlPath = await initializeCodeQL(language);
    core.info(`CodeQL initialized at: ${codeqlPath}`);

    // Step 3: Create CodeQL database
    await createCodeQLDatabase(codeqlPath, filteredPath, language);
    core.info('CodeQL database created successfully');

    // Step 4: Analyze with CodeQL
    await analyzeWithCodeQL(codeqlPath, language, qlsProfile);
    core.info('CodeQL analysis completed');

    // Step 5: Process SARIF and create issues
    await processSarifAndCreateIssues(token);
    core.info('SARIF processing and issue creation completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    core.setFailed(`Action failed: ${errorMessage}`);
    core.debug(errorStack);
  }
}

/**
 * Filter files based on include/exclude patterns
 */
async function filterFiles(includePatterns, excludePatterns) {
  const filteredRepoPath = path.join(process.cwd(), 'filtered-repo');

  // Create filtered-repo directory
  await exec.exec('mkdir', ['-p', filteredRepoPath]);

  // Function to check if file matches patterns
  function matchesPattern(file, patterns) {
    if (!patterns) return false;

    const patternArray = patterns.split(',').map((p) => p.trim());
    return patternArray.some((pattern) => {
      // Convert glob pattern to regex for simple matching
      const regexPattern = pattern
        .replace(/\*\*/gu, '.*')
        .replace(/\*/gu, '[^/]*')
        .replace(/\?/gu, '.');
      // eslint-disable-next-line require-unicode-regexp
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(file);
    });
  }

  // Get all files
  const globber = await glob.create('**/*', {
    implicitDescendants: false,
    followSymbolicLinks: false,
  });

  const allFiles = await globber.glob();
  let includedCount = 0;
  let excludedCount = 0;

  for (const file of allFiles) {
    const relativePath = path.relative(process.cwd(), file);

    // Skip directories and certain system files
    if (fs.lstatSync(file).isDirectory()) continue;
    if (
      relativePath.startsWith('.git/') ||
      relativePath.startsWith('.github/') ||
      relativePath.startsWith('node_modules/')
    ) {
      continue;
    }

    let shouldInclude = true;

    // Check exclude patterns first
    if (excludePatterns && matchesPattern(relativePath, excludePatterns)) {
      shouldInclude = false;
      excludedCount++;
      core.debug(`Excluding: ${relativePath}`);
    }

    // Check include patterns (if specified and not already excluded)
    if (includePatterns && shouldInclude) {
      if (!matchesPattern(relativePath, includePatterns)) {
        shouldInclude = false;
        excludedCount++;
        core.debug(`Excluding (not in include): ${relativePath}`);
      }
    }

    if (shouldInclude) {
      const destPath = path.join(filteredRepoPath, relativePath);
      const destDir = path.dirname(destPath);

      // Ensure destination directory exists
      await exec.exec('mkdir', ['-p', destDir]);

      // Copy file
      await exec.exec('cp', [file, destPath]);
      includedCount++;
      core.debug(`Including: ${relativePath}`);
    }
  }

  core.info(
    `Total files after filtering: ${includedCount} included, ${excludedCount} excluded`,
  );
  return filteredRepoPath;
}

/**
 * Initialize CodeQL
 */
async function initializeCodeQL(_language) {
  // Check if CodeQL is available from GitHub Actions setup
  if (process.env.CODEQL_CLI && fs.existsSync(process.env.CODEQL_CLI)) {
    core.info(`Using CodeQL from environment: ${process.env.CODEQL_CLI}`);
    return process.env.CODEQL_CLI;
  }

  // Try to find CodeQL in system PATH
  let codeqlPath = 'codeql';
  try {
    await exec.exec('which', ['codeql'], { silent: true });
    core.info('CodeQL found in system PATH');
    return codeqlPath;
  } catch {
    core.info('CodeQL not found in PATH');
  }

  // Try to find CodeQL in common GitHub Actions locations
  const commonPaths = [
    '/opt/hostedtoolcache/CodeQL/*/x64/codeql',
    '/home/runner/codeql/codeql',
    './codeql/codeql',
  ];

  for (const commonPath of commonPaths) {
    try {
      if (fs.existsSync(commonPath)) {
        core.info(`Found CodeQL at: ${commonPath}`);
        return commonPath;
      }
    } catch {
      // Continue searching
    }
  }

  // As last resort, download CodeQL
  core.info('CodeQL not found, attempting to download...');
  await downloadCodeQL();
  codeqlPath = path.join(process.cwd(), 'codeql', 'codeql');

  return codeqlPath;
}

/**
 * Download CodeQL if not available
 */
async function downloadCodeQL() {
  const codeqlVersion = '2.22.3'; // Use the latest available version
  const platform = process.platform === 'darwin' ? 'osx64' : 'linux64';
  const downloadUrl = `https://github.com/github/codeql-cli-binaries/releases/download/v${codeqlVersion}/codeql-${platform}.zip`;

  core.info(`Downloading CodeQL from: ${downloadUrl}`);

  try {
    // Download with better error handling and follow redirects
    await exec.exec('curl', [
      '-L', // Follow redirects
      '-f', // Fail silently on HTTP errors
      '--retry',
      '3', // Retry up to 3 times
      '--retry-delay',
      '2', // Wait 2 seconds between retries
      downloadUrl,
      '-o',
      'codeql.zip',
    ]);

    // Verify the download was successful
    const stats = fs.statSync('codeql.zip');
    const MIN_FILE_SIZE = 1000; // Minimum expected file size in bytes
    if (stats.size < MIN_FILE_SIZE) {
      throw new Error(`Download failed: file too small (${stats.size} bytes)`);
    }

    core.info(`Downloaded ${stats.size} bytes`);

    // Extract the zip archive (using unzip instead of tar)
    await exec.exec('unzip', ['-q', 'codeql.zip']);
    await exec.exec('chmod', ['+x', 'codeql/codeql']);

    // Verify extraction was successful
    if (!fs.existsSync('codeql/codeql')) {
      throw new Error('CodeQL binary not found after extraction');
    }

    core.info('CodeQL downloaded and extracted successfully');

    // Download standard query packs for better compatibility
    await downloadCodeQLQueryPacks();
  } catch (error) {
    core.error(`Failed to download CodeQL: ${error.message}`);
    throw new Error(`CodeQL download failed: ${error.message}`);
  }
}

/**
 * Download CodeQL query packs
 */
async function downloadCodeQLQueryPacks() {
  const codeqlPath = path.join(process.cwd(), 'codeql', 'codeql');

  core.info('Downloading CodeQL query packs...');

  // Common query packs to download
  const queryPacks = [
    'codeql/javascript-queries',
    'codeql/python-queries',
    'codeql/java-queries',
    'codeql/csharp-queries',
    'codeql/cpp-queries',
    'codeql/go-queries',
  ];

  for (const pack of queryPacks) {
    try {
      core.info(`Downloading query pack: ${pack}`);
      await exec.exec(codeqlPath, ['pack', 'download', pack], {
        silent: true,
        ignoreReturnCode: true, // Don't fail if a specific pack isn't available
      });
    } catch {
      // Silently continue if pack download fails
      core.debug(`Failed to download query pack: ${pack}`);
    }
  }

  core.info('Query pack download completed');
}

/**
 * Create CodeQL database
 */
async function createCodeQLDatabase(codeqlPath, filteredPath, language) {
  core.info('Creating CodeQL database from filtered files...');

  const dbPath = path.join(process.cwd(), 'codeql-db');

  // Change to filtered directory and create database
  await exec.exec(codeqlPath, [
    'database',
    'create',
    dbPath,
    `--language=${language}`,
    `--source-root=${filteredPath}`,
  ]);
}

/**
 * Analyze with CodeQL
 */
async function analyzeWithCodeQL(codeqlPath, language, qlsProfile) {
  core.info('Running CodeQL analysis...');

  const dbPath = path.join(process.cwd(), 'codeql-db');
  const outputPath = path.join(process.cwd(), 'results.sarif');

  // Map language and profile to the correct query pack
  const getQueryPack = (lang, profile) => {
    const queryPacks = {
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

    const langQueries = queryPacks[lang.toLowerCase()];
    if (!langQueries) {
      // Fallback to simple query pack specification
      return `codeql/${lang.toLowerCase()}-queries`;
    }

    return langQueries[profile] || langQueries['security-and-quality'];
  };

  const queryPack = getQueryPack(language, qlsProfile);
  core.info(`Using query pack: ${queryPack}`);

  try {
    await exec.exec(codeqlPath, [
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
    core.warning(`Failed to analyze with ${queryPack}: ${error.message || error}`);
    core.warning('Trying fallback approach...');

    // Try with just the base query pack
    const fallbackQueryPack = `codeql/${language.toLowerCase()}-queries`;
    core.info(`Using fallback query pack: ${fallbackQueryPack}`);

    await exec.exec(codeqlPath, [
      'database',
      'analyze',
      dbPath,
      '--ram=4000',
      '--format=sarif-latest',
      `--output=${outputPath}`,
      fallbackQueryPack,
    ]);
  }
}

/**
 * Process SARIF results and create GitHub issues
 */
async function processSarifAndCreateIssues(token) {
  const SARIF_PATH = path.join(process.cwd(), 'results.sarif');
  const FINGERPRINT_LENGTH = 8;
  const JSON_INDENT = 2;

  if (!fs.existsSync(SARIF_PATH)) {
    core.info('No SARIF file found. Clean scan.');
    return;
  }

  const sarif = JSON.parse(fs.readFileSync(SARIF_PATH, 'utf8'));

  if (!sarif.runs || sarif.runs.length === 0) {
    core.info('No runs found in SARIF file.');
    return;
  }

  const octokit = github.getOctokit(token);
  const { context } = github;

  // Get all existing issues with the codeql-finding label
  const { data: allIssues } = await octokit.rest.issues.listForRepo({
    ...context.repo,
    state: 'all',
    labels: 'codeql-finding',
  });

  const issueCreations = [];

  for (const run of sarif.runs) {
    if (!run.results) {
      continue;
    }

    for (const result of run.results) {
      const { ruleId, message, partialFingerprints, locations } = result;
      const msg = message.text;

      // Create unique fingerprint for this finding
      const findingHash = crypto
        .createHash('md5')
        .update(`${ruleId}|${JSON.stringify(partialFingerprints)}|${msg}`)
        .digest('hex')
        .substring(0, FINGERPRINT_LENGTH);

      const title = `CodeQL Finding: ${ruleId} [${findingHash}]`;

      // Build locations list
      let locationsList = '';
      if (locations) {
        for (const loc of locations) {
          const locFile = loc.physicalLocation.artifactLocation.uri;
          const locLine = loc.physicalLocation.region.startLine;
          const locMessage = loc.message ? ` - ${loc.message.text}` : '';
          locationsList += `- **File:** \`${locFile}\` **Line:** ${locLine}${locMessage}\n`;
        }
      }

      // Create issue body
      const resultJson = JSON.stringify(result, null, JSON_INDENT);
      const body = [
        `## 🚨 Security Alert: ${ruleId}`,
        `<strong>Message:</strong> ${msg}`,
        `<strong>Finding ID:</strong> <code>${findingHash}</code>`,
        '---',
        '### Vulnerability Locations',
        locationsList,
        '---',
        '<details>',
        '<summary>Click to view SARIF finding details</summary>',
        '',
        '```json',
        resultJson,
        '```',
        '</details>',
        '',
        '---',
        '*This issue was automatically generated by a custom CodeQL workflow.*',
      ].join('\n\n');

      // Check if issue already exists
      const existingIssue = allIssues.find((issue) => issue.title === title);

      if (existingIssue) {
        if (existingIssue.state === 'closed') {
          core.info(
            `Issue "${title}" was previously closed. Respecting user decision - not reopening.`,
          );
        } else {
          core.info(`Issue "${title}" already exists and is open. Skipping.`);
        }
      } else {
        issueCreations.push({
          ...context.repo,
          title,
          body,
          labels: ['codeql-finding'],
        });
      }
    }
  }

  // Create issues in parallel
  if (issueCreations.length > 0) {
    core.info(`Creating ${issueCreations.length} new issues...`);

    await Promise.all(
      issueCreations.map(async (issueData) => {
        try {
          await octokit.rest.issues.create(issueData);
          core.info(`Created issue: ${issueData.title}`);
        } catch (error) {
          core.error(`Failed to create issue: ${issueData.title} - ${error.message}`);
        }
      }),
    );
  } else {
    core.info('No new issues to create.');
  }
}

// Run the action
if (require.main === module) {
  run();
}

module.exports = { run };
