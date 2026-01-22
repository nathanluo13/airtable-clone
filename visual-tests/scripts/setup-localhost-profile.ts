/**
 * Setup Localhost Browser Profile
 *
 * Creates a persistent browser session for localhost testing.
 * User can log in manually or use email authentication.
 *
 * Usage:
 *   pnpm setup:localhost          # Interactive login
 *   pnpm setup:localhost --email  # Use email auth (requires env vars)
 */

import { chromium } from 'playwright';
import { LOCALHOST_URLS } from '../features/localhost-mapping.js';

const PROFILE_DIR = './profiles/localhost-session';

async function setupLocalhostProfile(options: { useEmailAuth?: boolean }) {
  console.log('🚀 Setting up localhost browser profile...\n');
  console.log(`📁 Profile directory: ${PROFILE_DIR}`);
  console.log(`🌐 Target URL: ${LOCALHOST_URLS.base}\n`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Navigate to login page
  await page.goto(LOCALHOST_URLS.login);
  console.log('📄 Navigated to login page\n');

  if (options.useEmailAuth) {
    // Automated email login
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
      console.error('❌ Email auth requires TEST_EMAIL and TEST_PASSWORD environment variables');
      await context.close();
      process.exit(1);
    }

    console.log(`🔐 Attempting email login as ${email}...`);

    try {
      // Fill email form
      await page.fill('input[name="email"], input[type="email"]', email);
      await page.fill('input[name="password"], input[type="password"]', password);
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard**', { timeout: 30000 });
      console.log('✅ Login successful!\n');
    } catch (error) {
      console.error('❌ Email login failed:', error);
      console.log('\n📝 Please log in manually in the browser window...');
      console.log('   Press Ctrl+C when done to save the session.\n');
    }
  } else {
    // Manual login
    console.log('📝 Please log in manually in the browser window.');
    console.log('   You can use Google OAuth or email login.');
    console.log('   Press Ctrl+C when done to save the session.\n');
  }

  // Keep browser open for manual interaction
  console.log('⏳ Browser will stay open. Press Ctrl+C to save session and exit.\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n💾 Saving session...');
    await context.close();
    console.log('✅ Session saved to:', PROFILE_DIR);
    console.log('\n🎉 Profile setup complete! You can now run localhost captures.\n');
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

// Parse CLI args
const args = process.argv.slice(2);
const useEmailAuth = args.includes('--email');

setupLocalhostProfile({ useEmailAuth }).catch(console.error);
