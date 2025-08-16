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
  // Use GitHub's CodeQL action to initialize
  // const _codeqlActionPath = path.join(
  //   process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache',
  //   'CodeQL',
  // );

  // Try to find CodeQL in common locations
  let codeqlPath = 'codeql'; // Default to system PATH

  // Check if CodeQL is available in PATH
  try {
    await exec.exec('which', ['codeql'], { silent: true });
    core.info('CodeQL found in system PATH');
  } catch {
    // Try to download CodeQL if not found
    core.info('CodeQL not found in PATH, attempting to download...');
    await downloadCodeQL();
    codeqlPath = path.join(process.cwd(), 'codeql', 'codeql');
  }

  return codeqlPath;
}

/**
 * Download CodeQL if not available
 */
async function downloadCodeQL() {
  const codeqlVersion = '2.15.3';
  const platform = process.platform === 'darwin' ? 'osx64' : 'linux64';
  const downloadUrl = `https://github.com/github/codeql-cli-binaries/releases/download/v${codeqlVersion}/codeql-${platform}.tar.gz`;

  core.info(`Downloading CodeQL from: ${downloadUrl}`);

  await exec.exec('curl', ['-L', downloadUrl, '-o', 'codeql.tar.gz']);
  await exec.exec('tar', ['-xzf', 'codeql.tar.gz']);
  await exec.exec('chmod', ['+x', 'codeql/codeql']);

  core.info('CodeQL downloaded and extracted');
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

  await exec.exec(codeqlPath, [
    'database',
    'analyze',
    dbPath,
    '--ram=4000',
    '--format=sarif-latest',
    `--output=${outputPath}`,
    `${language}-${qlsProfile}.qls`,
  ]);
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
