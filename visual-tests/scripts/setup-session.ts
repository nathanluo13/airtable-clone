/**
 * Setup persistent Airtable session for visual regression testing.
 *
 * Usage: pnpm setup:login
 *
 * This script launches a browser where you manually log into Airtable.
 * The session is saved to profiles/logged-in/ for reuse in future tests.
 *
 * Press Ctrl+C when done logging in - the session will be preserved.
 */

import { chromium } from 'playwright';
import * as readline from 'readline';

const PROFILES = {
  'logged-in': './profiles/logged-in',
  'logged-out': './profiles/logged-out',
} as const;

type ProfileType = keyof typeof PROFILES;

async function setupSession(profileType: ProfileType = 'logged-in') {
  const profilePath = PROFILES[profileType];

  console.log(`\n🚀 Launching browser with ${profileType} profile...`);
  console.log(`📁 Profile will be saved to: ${profilePath}\n`);

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });

  const page = await context.newPage();

  if (profileType === 'logged-in') {
    console.log('📍 Navigating to Airtable...\n');
    await page.goto('https://airtable.com');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MANUAL ACTION REQUIRED:');
    console.log('  1. Log in to Airtable using Google OAuth');
    console.log('  2. Navigate to a workspace with at least one base/table');
    console.log('  3. Press ENTER in this terminal when done');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } else {
    console.log('📍 Creating logged-out profile...\n');
    await page.goto('https://airtable.com/login');
    console.log('Press ENTER when ready to save the logged-out state.\n');
  }

  // Wait for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('Press ENTER to save session and close browser... ', () => {
      rl.close();
      resolve();
    });
  });

  // Get current URL for logging
  const currentUrl = page.url();
  console.log(`\n✅ Session saved at URL: ${currentUrl}`);
  console.log(`📁 Profile stored in: ${profilePath}`);

  await context.close();

  console.log('\n🎉 Setup complete! You can now run exploration scripts.\n');
}

// Parse command line args
const profileArg = process.argv[2] as ProfileType | undefined;
const profile: ProfileType = profileArg === 'logged-out' ? 'logged-out' : 'logged-in';

setupSession(profile).catch(console.error);
