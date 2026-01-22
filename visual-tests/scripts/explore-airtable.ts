/**
 * Explore Airtable UI and capture screenshots of all features.
 *
 * Usage: pnpm explore
 *
 * Prerequisites:
 * - Run `pnpm setup:login` first to create a logged-in session
 * - Run `pnpm setup:logout` to create a logged-out session
 *
 * This script opens Airtable and provides an interactive exploration session.
 * Screenshots are saved to reference/{profile}/ directory.
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

const PROFILES = {
  'logged-in': './profiles/logged-in',
  'logged-out': './profiles/logged-out',
} as const;

const REFERENCE_DIR = './reference';

interface FeatureCapture {
  id: string;
  name: string;
  profile: 'logged-in' | 'logged-out';
  url: string;
  clickSequence: string[];
  selector?: string;
  screenshotPath: string;
  maskSelectors?: string[];
  notes?: string;
  capturedAt: string;
}

const capturedFeatures: FeatureCapture[] = [];

async function waitForStability(page: Page, timeout = 1000) {
  // Wait for network idle and animations to settle
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(timeout);
}

async function captureFeature(
  page: Page,
  profile: 'logged-in' | 'logged-out',
  id: string,
  name: string,
  clickSequence: string[],
  options: {
    selector?: string;
    maskSelectors?: string[];
    notes?: string;
  } = {}
): Promise<FeatureCapture> {
  const outputDir = path.join(REFERENCE_DIR, profile);
  await fs.mkdir(outputDir, { recursive: true });

  const screenshotPath = path.join(outputDir, `${id}.png`);

  await waitForStability(page);

  // Take screenshot
  if (options.selector) {
    const element = page.locator(options.selector);
    await element.screenshot({ path: screenshotPath });
  } else {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }

  const feature: FeatureCapture = {
    id,
    name,
    profile,
    url: page.url(),
    clickSequence,
    selector: options.selector,
    screenshotPath,
    maskSelectors: options.maskSelectors,
    notes: options.notes,
    capturedAt: new Date().toISOString(),
  };

  capturedFeatures.push(feature);
  console.log(`  ✅ Captured: ${name} -> ${screenshotPath}`);

  return feature;
}

async function saveManifest() {
  const manifestPath = './features/manifest.json';
  await fs.mkdir('./features', { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(capturedFeatures, null, 2));
  console.log(`\n📄 Manifest saved to ${manifestPath}`);
}

async function interactiveExplore(page: Page, context: BrowserContext, profile: 'logged-in' | 'logged-out') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  INTERACTIVE AIRTABLE EXPLORATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nCommands:');
  console.log('  capture <id> <name>  - Capture current state as a feature');
  console.log('  element <selector>   - Capture a specific element');
  console.log('  url <url>            - Navigate to URL');
  console.log('  click <selector>     - Click an element');
  console.log('  wait <ms>            - Wait for specified milliseconds');
  console.log('  list                 - Show captured features');
  console.log('  save                 - Save manifest and continue');
  console.log('  done                 - Save manifest and exit');
  console.log('  help                 - Show this help\n');

  const clickHistory: string[] = [];
  let running = true;

  while (running) {
    const input = await question('\n> ');
    const [cmd, ...args] = input.trim().split(' ');

    try {
      switch (cmd) {
        case 'capture': {
          const [id, ...nameParts] = args;
          const name = nameParts.join(' ') || id;
          if (!id) {
            console.log('Usage: capture <id> <name>');
            break;
          }
          await captureFeature(page, profile, id, name, [...clickHistory]);
          break;
        }

        case 'element': {
          const selector = args.join(' ');
          if (!selector) {
            console.log('Usage: element <selector>');
            break;
          }
          const id = `element-${Date.now()}`;
          await captureFeature(page, profile, id, `Element: ${selector}`, [...clickHistory], { selector });
          break;
        }

        case 'url': {
          const url = args[0];
          if (!url) {
            console.log('Usage: url <url>');
            break;
          }
          clickHistory.length = 0; // Reset click history on navigation
          clickHistory.push(`goto:${url}`);
          await page.goto(url);
          await waitForStability(page);
          console.log(`  Navigated to: ${url}`);
          break;
        }

        case 'click': {
          const selector = args.join(' ');
          if (!selector) {
            console.log('Usage: click <selector>');
            break;
          }
          clickHistory.push(`click:${selector}`);
          await page.click(selector);
          await waitForStability(page);
          console.log(`  Clicked: ${selector}`);
          break;
        }

        case 'wait': {
          const ms = parseInt(args[0] || '1000');
          await page.waitForTimeout(ms);
          console.log(`  Waited ${ms}ms`);
          break;
        }

        case 'list': {
          console.log('\nCaptured features:');
          capturedFeatures.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.id}: ${f.name}`);
          });
          break;
        }

        case 'save': {
          await saveManifest();
          break;
        }

        case 'done': {
          await saveManifest();
          running = false;
          break;
        }

        case 'help': {
          console.log('\nCommands:');
          console.log('  capture <id> <name>  - Capture current state as a feature');
          console.log('  element <selector>   - Capture a specific element');
          console.log('  url <url>            - Navigate to URL');
          console.log('  click <selector>     - Click an element');
          console.log('  wait <ms>            - Wait for specified milliseconds');
          console.log('  list                 - Show captured features');
          console.log('  save                 - Save manifest and continue');
          console.log('  done                 - Save manifest and exit');
          break;
        }

        default:
          if (cmd) console.log(`Unknown command: ${cmd}. Type 'help' for commands.`);
      }
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  rl.close();
}

async function runPredefinedExploration(page: Page, profile: 'logged-in' | 'logged-out') {
  console.log('\n📸 Running predefined feature capture...\n');

  if (profile === 'logged-out') {
    // Login page exploration
    await page.goto('https://airtable.com/login');
    await waitForStability(page, 2000);
    await captureFeature(page, profile, 'page-login', 'Login Page', ['goto:https://airtable.com/login']);
  } else {
    // Logged-in exploration
    await page.goto('https://airtable.com');
    await waitForStability(page, 3000);

    // Home page
    await captureFeature(page, profile, 'page-home', 'Home/Dashboard Page', ['goto:https://airtable.com']);

    console.log('\n⏸️  Please navigate to a table view in the browser, then press ENTER...');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise<void>((resolve) => rl.question('', () => { rl.close(); resolve(); }));

    // Table page
    await waitForStability(page, 2000);
    await captureFeature(page, profile, 'page-table', 'Table View Page', ['manual:navigate-to-table']);
  }
}

async function main() {
  const mode = process.argv[2] || 'interactive'; // 'interactive' or 'predefined'
  const profileArg = process.argv[3] || 'logged-in';
  const profile = profileArg === 'logged-out' ? 'logged-out' : 'logged-in' as const;

  const profilePath = PROFILES[profile];

  // Check if profile exists
  try {
    await fs.access(profilePath);
  } catch {
    console.error(`\n❌ Profile not found: ${profilePath}`);
    console.error(`Run 'pnpm setup:login' or 'pnpm setup:logout' first.\n`);
    process.exit(1);
  }

  console.log(`\n🚀 Launching browser with ${profile} profile...`);

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });

  const page = await context.newPage();

  try {
    if (mode === 'predefined') {
      await runPredefinedExploration(page, profile);
      await saveManifest();
    } else {
      await page.goto('https://airtable.com');
      await waitForStability(page, 2000);
      await interactiveExplore(page, context, profile);
    }
  } finally {
    await context.close();
  }

  console.log('\n🎉 Exploration complete!\n');
}

main().catch(console.error);
