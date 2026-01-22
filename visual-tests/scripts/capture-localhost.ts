/**
 * Capture Localhost Screenshots
 *
 * Captures screenshots from localhost using the same click sequences as Airtable.
 * Screenshots are saved to a timestamped run directory.
 *
 * Usage:
 *   pnpm capture:localhost              # Capture all features
 *   pnpm capture:localhost --feature=X  # Capture specific feature
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import FEATURES, { type ClickStep } from '../features/manifest.js';
import { mapFeatureToLocalhost, FEATURE_STATUS } from '../features/localhost-mapping.js';

const PROFILE_DIR = './profiles/localhost-session';
const RUNS_DIR = './runs';

// Test credentials for localhost email login (from Task 007)
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

interface CaptureResult {
  featureId: string;
  success: boolean;
  screenshotPath?: string;
  error?: string;
  duration: number;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function ensureLoggedIn(page: Page, log: string[]): Promise<void> {
  // Wait for any redirects to complete
  await page.waitForTimeout(500);

  // Check if we're on the login page
  const url = page.url();
  log.push(`   Current URL: ${url}`);
  console.log(`   Current URL: ${url}`);

  if (url.includes('/login')) {
    log.push('🔐 Detected login page, attempting email login...');
    console.log('🔐 Detected login page, attempting email login...');

    try {
      // Two-step login flow:
      // Step 1: Enter email and click Continue
      await page.fill('input[type="email"]', TEST_EMAIL, { timeout: 5000 });
      await page.click('button:has-text("Continue")', { timeout: 5000 });

      // Step 2: Wait for password form and fill it
      await page.waitForSelector('input[type="password"]', { timeout: 5000 });
      await page.fill('input[type="password"]', TEST_PASSWORD, { timeout: 5000 });
      await page.click('button[type="submit"]:has-text("Sign In")', { timeout: 5000 });

      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard**', { timeout: 30000 });
      log.push('✅ Login successful');
      console.log('✅ Login successful');

      // Wait for page to stabilize
      await page.waitForTimeout(2000);
    } catch (error) {
      const msg = `⚠️ Auto-login failed: ${error instanceof Error ? error.message : error}`;
      log.push(msg);
      console.log(msg);
    }
  }
}

async function executeClickSequence(page: Page, steps: ClickStep[], log: string[]): Promise<void> {
  for (const step of steps) {
    const logEntry = `    ${step.action}: ${step.target || step.value || ''}`;
    log.push(logEntry);
    console.log(logEntry);

    switch (step.action) {
      case 'goto':
        // Use 'load' instead of 'networkidle' - SPAs often have persistent connections
        await page.goto(step.target!, { waitUntil: 'load', timeout: 30000 });
        // Extra wait for React/SPA hydration
        await page.waitForTimeout(1000);
        break;
      case 'click':
        await page.click(step.target!, { timeout: 10000 });
        break;
      case 'hover':
        await page.hover(step.target!, { timeout: 10000 });
        break;
      case 'wait':
        await page.waitForTimeout(step.value as number);
        break;
      case 'waitForSelector':
        await page.waitForSelector(step.target!, { timeout: 30000 });
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
  featureId: string,
  runDir: string,
  log: string[]
): Promise<CaptureResult> {
  const startTime = Date.now();

  // Find the feature
  const originalFeature = FEATURES.find((f) => f.id === featureId);
  if (!originalFeature) {
    return {
      featureId,
      success: false,
      error: `Feature not found: ${featureId}`,
      duration: Date.now() - startTime,
    };
  }

  // Check if feature is available on localhost
  const status = FEATURE_STATUS[featureId];
  if (status === 'missing') {
    const msg = `Feature not implemented on localhost: ${featureId}`;
    log.push(`  ⏭️  Skipped: ${msg}`);
    console.log(`  ⏭️  Skipped: ${msg}`);
    return {
      featureId,
      success: false,
      error: msg,
      duration: Date.now() - startTime,
    };
  }

  // Map feature to localhost
  const feature = mapFeatureToLocalhost(originalFeature);

  const logHeader = `\n📸 Capturing: ${feature.name} (${feature.id})`;
  log.push(logHeader);
  console.log(logHeader);

  try {
    // Execute click sequence
    await executeClickSequence(page, feature.clickSequence, log);

    // Wait for stability
    await page.waitForTimeout(500);

    // Take screenshot
    const screenshotDir = path.join(runDir, 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });
    const screenshotPath = path.join(screenshotDir, `${feature.id}.png`);

    if (feature.screenshotTarget === 'fullPage') {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } else if (feature.screenshotTarget === 'viewport') {
      await page.screenshot({ path: screenshotPath });
    } else {
      const element = page.locator(feature.screenshotTarget);
      await element.screenshot({ path: screenshotPath });
    }

    const successMsg = `  ✅ Saved: ${screenshotPath}`;
    log.push(successMsg);
    console.log(successMsg);

    return {
      featureId,
      success: true,
      screenshotPath,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorMsg = `  ❌ Failed: ${errorMessage}`;
    log.push(errorMsg);
    console.error(errorMsg);

    return {
      featureId,
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  }
}

async function runCapture(options: { featureId?: string }) {
  const timestamp = getTimestamp();
  const runDir = path.join(RUNS_DIR, timestamp);
  const log: string[] = [];

  // Create run directory
  await fs.mkdir(runDir, { recursive: true });

  log.push(`🚀 Localhost Capture Run: ${timestamp}`);
  log.push(`📁 Run directory: ${runDir}`);
  console.log(`\n🚀 Localhost Capture Run: ${timestamp}`);
  console.log(`📁 Run directory: ${runDir}\n`);

  // Filter features
  let featureIds = FEATURES.map((f) => f.id);
  if (options.featureId) {
    if (!featureIds.includes(options.featureId)) {
      console.error(`❌ Feature not found: ${options.featureId}`);
      process.exit(1);
    }
    featureIds = [options.featureId];
  }

  log.push(`\n📋 Features to capture: ${featureIds.length}`);
  console.log(`📋 Features to capture: ${featureIds.length}\n`);

  // Check if profile exists
  try {
    await fs.access(PROFILE_DIR);
  } catch {
    console.error('❌ Localhost profile not found. Run `pnpm setup:localhost` first.');
    process.exit(1);
  }

  // Launch browser with profile
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  const results: CaptureResult[] = [];

  // Ensure logged in before capturing protected pages
  if (featureIds.some(id => id !== 'page-login')) {
    log.push('\n🔐 Checking login status...');
    console.log('\n🔐 Checking login status...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    await ensureLoggedIn(page, log);
  }

  try {
    for (const featureId of featureIds) {
      const result = await captureFeature(page, featureId, runDir, log);
      results.push(result);
    }
  } finally {
    await context.close();
  }

  // Summary
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const summary = `
═══════════════════════════════════════════════════════════════
  CAPTURE COMPLETE: ${passed} succeeded, ${failed} failed
═══════════════════════════════════════════════════════════════
`;
  log.push(summary);
  console.log(summary);

  // Save results
  const captureResults = {
    timestamp,
    runDir,
    summary: `${passed}/${results.length} captured`,
    results: results.map((r) => ({
      featureId: r.featureId,
      success: r.success,
      screenshotPath: r.screenshotPath,
      error: r.error,
      duration: r.duration,
    })),
  };

  await fs.writeFile(path.join(runDir, 'capture-results.json'), JSON.stringify(captureResults, null, 2));

  // Save log
  await fs.writeFile(path.join(runDir, 'capture.log'), log.join('\n'));

  // Update latest symlink
  const latestLink = path.join(RUNS_DIR, 'latest');
  try {
    await fs.unlink(latestLink);
  } catch {
    // Ignore if doesn't exist
  }
  await fs.symlink(timestamp, latestLink);

  console.log(`\n📄 Results saved to: ${runDir}/capture-results.json`);
  console.log(`📄 Log saved to: ${runDir}/capture.log`);
  console.log(`🔗 Latest symlink updated: runs/latest -> ${timestamp}\n`);

  return captureResults;
}

// Parse CLI args
const args = process.argv.slice(2);
let featureId: string | undefined;

for (const arg of args) {
  if (arg.startsWith('--feature=')) {
    featureId = arg.replace('--feature=', '');
  }
}

runCapture({ featureId }).catch(console.error);
