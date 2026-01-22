/**
 * Agent Runner - Visual Regression Test Entry Point
 *
 * Combines localhost capture and comparison into a single command.
 * Designed for agent-driven continuous improvement loops.
 *
 * Usage:
 *   pnpm test:visual                    # Capture + compare all features
 *   pnpm test:visual --feature=X        # Test specific feature
 *   pnpm test:visual --compare-only     # Compare latest run (skip capture)
 *   pnpm test:visual --json             # Output only JSON (for parsing)
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const RUNS_DIR = './runs';

interface AgentOutput {
  success: boolean;
  timestamp: string;
  runDir: string;
  summary: string;
  passed: number;
  failed: number;
  total: number;
  failedFeatures: string[];
  nextPriority: string | null;
  message: string;
}

async function runScript(script: string, args: string[] = []): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', script, ...args], {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let output = '';

    proc.stdout?.on('data', (data) => {
      const str = data.toString();
      output += str;
      if (!process.argv.includes('--json')) {
        process.stdout.write(str);
      }
    });

    proc.stderr?.on('data', (data) => {
      const str = data.toString();
      output += str;
      if (!process.argv.includes('--json')) {
        process.stderr.write(str);
      }
    });

    proc.on('close', (code) => {
      resolve({ code: code || 0, output });
    });
  });
}

async function getLatestRunDir(): Promise<string | null> {
  try {
    const latestLink = path.join(RUNS_DIR, 'latest');
    const latest = await fs.readlink(latestLink);
    return path.join(RUNS_DIR, latest);
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const compareOnly = args.includes('--compare-only');
  const featureArg = args.find((a) => a.startsWith('--feature='));

  const startTime = Date.now();

  if (!jsonOnly) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          VISUAL REGRESSION TEST RUNNER                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  // Step 1: Capture (unless --compare-only)
  if (!compareOnly) {
    if (!jsonOnly) {
      console.log('📸 Step 1: Capturing localhost screenshots...\n');
    }

    const captureArgs = featureArg ? [featureArg] : [];
    const captureResult = await runScript('scripts/capture-localhost.ts', captureArgs);

    if (captureResult.code !== 0) {
      const output: AgentOutput = {
        success: false,
        timestamp: new Date().toISOString(),
        runDir: '',
        summary: 'Capture failed',
        passed: 0,
        failed: 0,
        total: 0,
        failedFeatures: [],
        nextPriority: null,
        message: 'Screenshot capture failed. Check if localhost is running and profile exists.',
      };

      if (jsonOnly) {
        console.log(JSON.stringify(output, null, 2));
      }
      process.exit(1);
    }
  }

  // Step 2: Compare
  if (!jsonOnly) {
    console.log('\n🔬 Step 2: Comparing against references...\n');
  }

  const compareArgs = featureArg ? [featureArg] : [];
  const compareResult = await runScript('scripts/run-comparison.ts', compareArgs);

  // Load results
  const runDir = await getLatestRunDir();
  if (!runDir) {
    const output: AgentOutput = {
      success: false,
      timestamp: new Date().toISOString(),
      runDir: '',
      summary: 'No run found',
      passed: 0,
      failed: 0,
      total: 0,
      failedFeatures: [],
      nextPriority: null,
      message: 'No test run found. Ensure capture completed successfully.',
    };

    if (jsonOnly) {
      console.log(JSON.stringify(output, null, 2));
    }
    process.exit(1);
  }

  // Read results.json
  let results: any;
  try {
    const resultsPath = path.join(runDir, 'results.json');
    const resultsJson = await fs.readFile(resultsPath, 'utf-8');
    results = JSON.parse(resultsJson);
  } catch (error) {
    const output: AgentOutput = {
      success: false,
      timestamp: new Date().toISOString(),
      runDir,
      summary: 'Results not found',
      passed: 0,
      failed: 0,
      total: 0,
      failedFeatures: [],
      nextPriority: null,
      message: 'Could not load results.json. Comparison may have failed.',
    };

    if (jsonOnly) {
      console.log(JSON.stringify(output, null, 2));
    }
    process.exit(1);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Build agent output
  const output: AgentOutput = {
    success: results.stats.failed === 0,
    timestamp: results.timestamp,
    runDir,
    summary: results.summary,
    passed: results.stats.passed,
    failed: results.stats.failed,
    total: results.stats.total,
    failedFeatures: results.failed,
    nextPriority: results.nextPriority,
    message: results.stats.failed === 0
      ? `All ${results.stats.passed} features match! Visual regression test passed.`
      : `${results.stats.failed} feature(s) need attention. Start with: ${results.nextPriority}`,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n  Summary: ${output.summary}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Run: ${path.basename(runDir)}`);
    console.log(`\n  ${output.message}`);

    if (output.failedFeatures.length > 0) {
      console.log('\n  Failed features (fix in order):');
      output.failedFeatures.forEach((f, i) => {
        console.log(`    ${i + 1}. ${f}`);
      });
      console.log(`\n  View diffs: ${runDir}/diffs/`);
    }

    console.log('\n  Full results: ' + path.join(runDir, 'results.json'));
    console.log('');
  }

  process.exit(output.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
