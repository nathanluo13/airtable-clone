/**
 * Run Visual Comparison
 *
 * Compares localhost screenshots against Airtable references using:
 * 1. Visual match (looks-same) - tolerant, handles anti-aliasing and small shifts
 * 2. Pixel match (pixelmatch) - strict reference metric
 *
 * Usage:
 *   pnpm compare                    # Compare latest run
 *   pnpm compare --run=TIMESTAMP    # Compare specific run
 *   pnpm compare --feature=X        # Compare specific feature
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
// @ts-ignore - looks-same types
import looksSame from 'looks-same';
import FEATURES from '../features/manifest.js';

const REFERENCE_DIR = './reference';
const RUNS_DIR = './runs';

// Visual comparison settings (tolerant)
const VISUAL_TOLERANCE = 5; // Color tolerance (0-255)
const ANTIALIASING_TOLERANCE = 5;

// Pixel comparison settings (strict reference)
const PIXEL_THRESHOLD = 0.1; // 0-1, lower = stricter

interface ComparisonResult {
  featureId: string;
  status: 'pass' | 'fail' | 'missing' | 'error';
  // Visual match (primary - tolerant)
  visualMatch: boolean;
  // Pixel match (reference - strict)
  pixelDiffPercent: number;
  pixelDiffCount: number;
  // Paths
  referencePath: string;
  currentPath: string;
  diffPath?: string;
  // Error
  error?: string;
}

async function loadPng(filePath: string): Promise<PNG> {
  const buffer = await fs.readFile(filePath);
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function savePng(png: PNG, filePath: string): Promise<void> {
  const buffer = PNG.sync.write(png);
  await fs.writeFile(filePath, buffer);
}

async function visualCompare(
  referencePath: string,
  currentPath: string
): Promise<{ equal: boolean }> {
  // looks-same returns a Promise in newer versions
  const result = await (looksSame as any)(referencePath, currentPath, {
    tolerance: VISUAL_TOLERANCE,
    antialiasingTolerance: ANTIALIASING_TOLERANCE,
    ignoreAntialiasing: true,
    ignoreCaret: true,
  });
  return result;
}

async function createVisualDiff(
  referencePath: string,
  currentPath: string,
  diffPath: string
): Promise<void> {
  await (looksSame as any).createDiff({
    reference: referencePath,
    current: currentPath,
    diff: diffPath,
    highlightColor: '#ff00ff', // Magenta for differences
    tolerance: VISUAL_TOLERANCE,
    antialiasingTolerance: ANTIALIASING_TOLERANCE,
    ignoreAntialiasing: true,
    ignoreCaret: true,
  });
}

async function pixelCompare(
  referencePath: string,
  currentPath: string
): Promise<{ diffPercent: number; diffCount: number; diffPng: PNG | null }> {
  try {
    const reference = await loadPng(referencePath);
    const current = await loadPng(currentPath);

    // Handle size mismatch
    if (reference.width !== current.width || reference.height !== current.height) {
      console.log(
        `    ⚠️  Size mismatch: ref=${reference.width}x${reference.height} vs cur=${current.width}x${current.height}`
      );
      // Return 100% diff for size mismatch
      return { diffPercent: 100, diffCount: -1, diffPng: null };
    }

    const { width, height } = reference;
    const diffPng = new PNG({ width, height });

    const diffCount = pixelmatch(
      reference.data,
      current.data,
      diffPng.data,
      width,
      height,
      { threshold: PIXEL_THRESHOLD }
    );

    const totalPixels = width * height;
    const diffPercent = (diffCount / totalPixels) * 100;

    return { diffPercent, diffCount, diffPng };
  } catch (error) {
    console.error('Pixel compare error:', error);
    return { diffPercent: 100, diffCount: -1, diffPng: null };
  }
}

async function compareFeature(
  featureId: string,
  runDir: string,
  diffsDir: string,
  log: string[]
): Promise<ComparisonResult> {
  const feature = FEATURES.find((f) => f.id === featureId);
  if (!feature) {
    return {
      featureId,
      status: 'error',
      visualMatch: false,
      pixelDiffPercent: 100,
      pixelDiffCount: -1,
      referencePath: '',
      currentPath: '',
      error: `Feature not found: ${featureId}`,
    };
  }

  // Build paths
  const referencePath = path.join(REFERENCE_DIR, feature.profile, `${featureId}.png`);
  const currentPath = path.join(runDir, 'screenshots', `${featureId}.png`);

  log.push(`\n🔍 Comparing: ${feature.name} (${featureId})`);
  console.log(`\n🔍 Comparing: ${feature.name} (${featureId})`);

  // Check if files exist
  try {
    await fs.access(referencePath);
  } catch {
    const msg = `    ⚠️  Reference not found: ${referencePath}`;
    log.push(msg);
    console.log(msg);
    return {
      featureId,
      status: 'missing',
      visualMatch: false,
      pixelDiffPercent: 100,
      pixelDiffCount: -1,
      referencePath,
      currentPath,
      error: 'Reference screenshot not found',
    };
  }

  try {
    await fs.access(currentPath);
  } catch {
    const msg = `    ⚠️  Current not found: ${currentPath}`;
    log.push(msg);
    console.log(msg);
    return {
      featureId,
      status: 'missing',
      visualMatch: false,
      pixelDiffPercent: 100,
      pixelDiffCount: -1,
      referencePath,
      currentPath,
      error: 'Current screenshot not found',
    };
  }

  try {
    // Visual comparison (primary - tolerant)
    const visualResult = await visualCompare(referencePath, currentPath);
    log.push(`    Visual match: ${visualResult.equal ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Visual match: ${visualResult.equal ? '✅ PASS' : '❌ FAIL'}`);

    // Pixel comparison (reference - strict)
    const pixelResult = await pixelCompare(referencePath, currentPath);
    log.push(`    Pixel diff: ${pixelResult.diffPercent.toFixed(2)}% (${pixelResult.diffCount} pixels)`);
    console.log(`    Pixel diff: ${pixelResult.diffPercent.toFixed(2)}% (${pixelResult.diffCount} pixels)`);

    // Determine overall status based on VISUAL match (tolerant)
    const status = visualResult.equal ? 'pass' : 'fail';

    // Generate diff images if failed
    let diffPath: string | undefined;
    if (!visualResult.equal) {
      await fs.mkdir(diffsDir, { recursive: true });

      // Visual diff (shows differences with tolerance)
      const visualDiffPath = path.join(diffsDir, `${featureId}-visual.png`);
      await createVisualDiff(referencePath, currentPath, visualDiffPath);
      log.push(`    Visual diff saved: ${visualDiffPath}`);
      console.log(`    Visual diff saved: ${visualDiffPath}`);

      // Pixel diff (strict)
      if (pixelResult.diffPng) {
        const pixelDiffPath = path.join(diffsDir, `${featureId}-pixel.png`);
        await savePng(pixelResult.diffPng, pixelDiffPath);
        log.push(`    Pixel diff saved: ${pixelDiffPath}`);
        console.log(`    Pixel diff saved: ${pixelDiffPath}`);
      }

      diffPath = visualDiffPath;
    }

    const statusEmoji = status === 'pass' ? '✅' : '❌';
    log.push(`    Status: ${statusEmoji} ${status.toUpperCase()}`);
    console.log(`    Status: ${statusEmoji} ${status.toUpperCase()}`);

    return {
      featureId,
      status,
      visualMatch: visualResult.equal,
      pixelDiffPercent: pixelResult.diffPercent,
      pixelDiffCount: pixelResult.diffCount,
      referencePath,
      currentPath,
      diffPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.push(`    ❌ Error: ${errorMessage}`);
    console.error(`    ❌ Error: ${errorMessage}`);

    return {
      featureId,
      status: 'error',
      visualMatch: false,
      pixelDiffPercent: 100,
      pixelDiffCount: -1,
      referencePath,
      currentPath,
      error: errorMessage,
    };
  }
}

async function runComparison(options: { runTimestamp?: string; featureId?: string }) {
  const log: string[] = [];

  // Determine which run to compare
  let runDir: string;
  if (options.runTimestamp) {
    runDir = path.join(RUNS_DIR, options.runTimestamp);
  } else {
    // Use latest
    const latestLink = path.join(RUNS_DIR, 'latest');
    try {
      const latest = await fs.readlink(latestLink);
      runDir = path.join(RUNS_DIR, latest);
    } catch {
      console.error('❌ No runs found. Run `pnpm capture:localhost` first.');
      process.exit(1);
    }
  }

  // Check run exists
  try {
    await fs.access(runDir);
  } catch {
    console.error(`❌ Run not found: ${runDir}`);
    process.exit(1);
  }

  const runName = path.basename(runDir);
  log.push(`🔬 Visual Regression Comparison`);
  log.push(`📁 Run: ${runName}`);
  log.push(`📁 Run directory: ${runDir}`);
  console.log(`\n🔬 Visual Regression Comparison`);
  console.log(`📁 Run: ${runName}`);
  console.log(`📁 Run directory: ${runDir}\n`);

  // Get features to compare
  let featureIds = FEATURES.map((f) => f.id);
  if (options.featureId) {
    if (!featureIds.includes(options.featureId)) {
      console.error(`❌ Feature not found: ${options.featureId}`);
      process.exit(1);
    }
    featureIds = [options.featureId];
  }

  const diffsDir = path.join(runDir, 'diffs');
  const results: ComparisonResult[] = [];

  for (const featureId of featureIds) {
    const result = await compareFeature(featureId, runDir, diffsDir, log);
    results.push(result);
  }

  // Summary
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const missing = results.filter((r) => r.status === 'missing').length;
  const errors = results.filter((r) => r.status === 'error').length;

  const summary = `
═══════════════════════════════════════════════════════════════
  COMPARISON COMPLETE
  ✅ Passed: ${passed}
  ❌ Failed: ${failed}
  ⚠️  Missing: ${missing}
  💥 Errors: ${errors}
═══════════════════════════════════════════════════════════════
`;
  log.push(summary);
  console.log(summary);

  // Prioritize failed features by pixel diff (most different first)
  const failedFeatures = results
    .filter((r) => r.status === 'fail')
    .sort((a, b) => b.pixelDiffPercent - a.pixelDiffPercent)
    .map((r) => r.featureId);

  if (failedFeatures.length > 0) {
    log.push('Failed features (by severity):');
    console.log('Failed features (by severity):');
    failedFeatures.forEach((id, i) => {
      const r = results.find((x) => x.featureId === id)!;
      const line = `  ${i + 1}. ${id} (${r.pixelDiffPercent.toFixed(1)}% pixel diff)`;
      log.push(line);
      console.log(line);
    });
  }

  // Build output
  const output = {
    timestamp: new Date().toISOString(),
    run: runName,
    summary: `${passed}/${results.length} passing`,
    settings: {
      visualTolerance: VISUAL_TOLERANCE,
      antialiasingTolerance: ANTIALIASING_TOLERANCE,
      pixelThreshold: PIXEL_THRESHOLD,
    },
    stats: {
      total: results.length,
      passed,
      failed,
      missing,
      errors,
    },
    results: results.map((r) => ({
      featureId: r.featureId,
      status: r.status,
      visualMatch: r.visualMatch,
      pixelDiffPercent: Number(r.pixelDiffPercent.toFixed(2)),
      pixelDiffCount: r.pixelDiffCount,
      diffPath: r.diffPath,
      error: r.error,
    })),
    failed: failedFeatures,
    nextPriority: failedFeatures[0] || null,
  };

  // Save results
  await fs.writeFile(path.join(runDir, 'results.json'), JSON.stringify(output, null, 2));
  log.push(`\n📄 Results saved to: ${runDir}/results.json`);
  console.log(`\n📄 Results saved to: ${runDir}/results.json`);

  // Append to run log
  await fs.appendFile(path.join(runDir, 'run.log'), '\n\n' + log.join('\n'));
  console.log(`📄 Log appended to: ${runDir}/run.log\n`);

  return output;
}

// Parse CLI args
const args = process.argv.slice(2);
let runTimestamp: string | undefined;
let featureId: string | undefined;

for (const arg of args) {
  if (arg.startsWith('--run=')) {
    runTimestamp = arg.replace('--run=', '');
  } else if (arg.startsWith('--feature=')) {
    featureId = arg.replace('--feature=', '');
  }
}

runComparison({ runTimestamp, featureId }).catch(console.error);
