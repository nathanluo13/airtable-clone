/**
 * Capture Reference Screenshots from Airtable
 *
 * Usage: pnpm capture [--feature=<id>] [--profile=<logged-in|logged-out>]
 *
 * This script navigates through Airtable and captures screenshots
 * for each feature defined in the manifest.
 *
 * Prerequisites:
 * - Run `pnpm setup:login` first to create browser profiles
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import FEATURES, { type Feature, type ClickStep } from '../features/manifest.js';

const PROFILES = {
  'logged-in': './profiles/logged-in',
  'logged-out': './profiles/logged-out',
} as const;

const REFERENCE_DIR = './reference';

async function executeClickSequence(page: Page, steps: ClickStep[]): Promise<void> {
  for (const step of steps) {
    console.log(`    ${step.action}: ${step.target || step.value || ''}`);

    switch (step.action) {
      case 'goto':
        await page.goto(step.target!, { waitUntil: 'networkidle' });
        break;
      case 'click':
        await page.click(step.target!);
        break;
      case 'hover':
        await page.hover(step.target!);
        break;
      case 'wait':
        await page.waitForTimeout(step.value as number);
        break;
      case 'waitForSelector':
        await page.waitForSelector(step.target!);
        break;
      case 'type':
        await page.fill(step.target!, step.value as string);
        break;
      case 'press':
        await page.keyboard.press(step.value as string);
        break;
    }
  }
}

async function captureFeature(
  page: Page,
  feature: Feature
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n📸 Capturing: ${feature.name} (${feature.id})`);

  try {
    // Execute click sequence
    await executeClickSequence(page, feature.clickSequence);

    // Wait for stability
    await page.waitForTimeout(500);

    // Determine output path
    const outputDir = path.join(REFERENCE_DIR, feature.profile);
    await fs.mkdir(outputDir, { recursive: true });
    const screenshotPath = path.join(outputDir, `${feature.id}.png`);

    // Take screenshot
    if (feature.screenshotTarget === 'fullPage') {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } else if (feature.screenshotTarget === 'viewport') {
      await page.screenshot({ path: screenshotPath });
    } else {
      // Element screenshot
      const element = page.locator(feature.screenshotTarget);
      await element.screenshot({ path: screenshotPath });
    }

    console.log(`  ✅ Saved: ${screenshotPath}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function runCapture(options: {
  featureId?: string;
  profile?: 'logged-in' | 'logged-out';
}) {
  const { featureId, profile } = options;

  // Filter features
  let features = FEATURES;
  if (featureId) {
    features = features.filter((f) => f.id === featureId);
    if (features.length === 0) {
      console.error(`❌ Feature not found: ${featureId}`);
      process.exit(1);
    }
  }
  if (profile) {
    features = features.filter((f) => f.profile === profile);
  }

  console.log(`\n🚀 Capturing ${features.length} features...\n`);

  // Group features by profile to minimize browser switches
  const loggedOutFeatures = features.filter((f) => f.profile === 'logged-out');
  const loggedInFeatures = features.filter((f) => f.profile === 'logged-in');

  const results: { feature: string; success: boolean; error?: string }[] = [];

  // Capture logged-out features
  if (loggedOutFeatures.length > 0) {
    console.log('\n📁 Using logged-out profile...');
    const context = await chromium.launchPersistentContext(PROFILES['logged-out'], {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const feature of loggedOutFeatures) {
      const result = await captureFeature(page, feature);
      results.push({ feature: feature.id, ...result });
    }

    await context.close();
  }

  // Capture logged-in features
  if (loggedInFeatures.length > 0) {
    console.log('\n📁 Using logged-in profile...');
    const context = await chromium.launchPersistentContext(PROFILES['logged-in'], {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const feature of loggedInFeatures) {
      const result = await captureFeature(page, feature);
      results.push({ feature: feature.id, ...result });
    }

    await context.close();
  }

  // Summary
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  CAPTURE COMPLETE: ${passed} succeeded, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('Failed features:');
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.feature}: ${r.error}`));
  }

  // Save results
  await fs.writeFile(
    './capture-results.json',
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
}

// Parse CLI args
const args = process.argv.slice(2);
const options: { featureId?: string; profile?: 'logged-in' | 'logged-out' } = {};

for (const arg of args) {
  if (arg.startsWith('--feature=')) {
    options.featureId = arg.replace('--feature=', '');
  } else if (arg.startsWith('--profile=')) {
    const p = arg.replace('--profile=', '');
    if (p === 'logged-in' || p === 'logged-out') {
      options.profile = p;
    }
  }
}

runCapture(options).catch(console.error);
