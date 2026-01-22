/**
 * Localhost Mapping for Visual Regression Testing
 *
 * Maps Airtable URLs and selectors to their localhost equivalents.
 * This allows us to run the same test sequences on both Airtable and localhost.
 */

import { AIRTABLE_URLS, type Feature, type ClickStep } from './manifest.js';

// Localhost URLs - Update these based on your local environment
export const LOCALHOST_URLS = {
  base: 'http://localhost:3000',
  login: 'http://localhost:3000/login',
  home: 'http://localhost:3000/dashboard',
  // Map to a specific base/table/view in localhost
  // Update these IDs to match your seeded data
  table: 'http://localhost:3000/dashboard?base=cmkoh4rbz0001gobn2zr3pg3j&table=cmkoh51hg0003gobnfbhstfvq&view=cmkoh51t3001mgobno2gyvmda',
};

/**
 * Selector mappings from Airtable to Localhost
 * Airtable uses specific patterns; our clone may use different selectors
 *
 * Key differences:
 * - Airtable uses role="button" divs, localhost uses actual <button> elements
 * - Airtable uses aria-labels on toolbar, localhost uses visible text only
 * - Localhost uses id="cell-{rowId}-{columnId}" pattern for cells
 * - Localhost column headers are clickable divs (no separate menu button)
 */
export const SELECTOR_MAP: Record<string, string> = {
  // Toolbar buttons - Airtable uses role="button" divs with aria-labels, we use actual buttons
  // Using :has-text() for consistent substring matching across all toolbar buttons
  '[role="button"][aria-label="Filter rows"]': 'button:has-text("Filter")',
  '[role="button"][aria-label="Sort rows"]': 'button:has-text("Sort")',
  '[role="button"][aria-label="Hide fields"]': 'button:has-text("Hide fields")',
  '[role="button"][aria-label="Group rows"]': 'button:has-text("Group")',
  '[role="button"][aria-label="Row colors"]': 'button:has-text("Color")',

  // Column menu - localhost: click the column header div directly (no separate menu button)
  // Target the first column header with cursor-pointer class (skip row number column)
  '.cell.header.primary': '.cursor-pointer >> nth=0',
  '[data-tutorial-selector-id="openColumnMenuButton"]': '.cursor-pointer >> nth=0',

  // View selector - localhost button says "Create..." not "Create new"
  'button:has-text("Create new")': 'button:has-text("Create...")',

  // Record modal - expand button has aria-label="Expand record"
  // For hover: target the group container that contains the expand button
  '.dataRow:first-child, tr:nth-child(2), [role="row"]:nth-child(2)': '.group:has([aria-label="Expand record"]) >> nth=0',
  'button:has-text("Expand"), [aria-label*="expand" i], .expandRowButton': '[aria-label="Expand record"]',

  // Grid cells - localhost uses id="cell-{rowId}-{columnId}" pattern
  // Click any cell to select it
  '.dataRow .cell': '[id^="cell-"]',

  // Row hover - target rows in the grid that have the expand button
  // These are group divs in the left pane column
  '.dataRow:nth-of-type(2)': '.group:has([aria-label="Expand record"]) >> nth=1',

  // Filter condition button - inside filter panel
  '[role="button"]:has-text("Add condition")': 'button:has-text("Add condition")',
};

/**
 * Map a URL from Airtable to localhost
 */
export function mapUrl(airtableUrl: string): string {
  if (airtableUrl === AIRTABLE_URLS.login) {
    return LOCALHOST_URLS.login;
  }
  if (airtableUrl === AIRTABLE_URLS.home) {
    return LOCALHOST_URLS.home;
  }
  if (airtableUrl === AIRTABLE_URLS.table || airtableUrl.includes('airtable.com/app')) {
    return LOCALHOST_URLS.table;
  }
  // Default: replace airtable.com with localhost
  return airtableUrl.replace('https://airtable.com', LOCALHOST_URLS.base);
}

/**
 * Map a selector from Airtable to localhost
 * Returns the localhost selector, or the original if no mapping exists
 */
export function mapSelector(airtableSelector: string): string {
  return SELECTOR_MAP[airtableSelector] || airtableSelector;
}

/**
 * Transform a click sequence for localhost
 * - Maps URLs to localhost
 * - Maps selectors to localhost equivalents
 */
export function mapClickSequence(steps: ClickStep[]): ClickStep[] {
  return steps.map((step) => {
    const mapped = { ...step };

    if (step.action === 'goto' && step.target) {
      mapped.target = mapUrl(step.target);
    } else if ((step.action === 'click' || step.action === 'hover') && step.target) {
      mapped.target = mapSelector(step.target);
    }

    return mapped;
  });
}

/**
 * Create a localhost version of a feature
 */
export function mapFeatureToLocalhost(feature: Feature): Feature {
  return {
    ...feature,
    clickSequence: mapClickSequence(feature.clickSequence),
  };
}

/**
 * Feature availability on localhost
 * Some features may not be implemented yet
 *
 * Status meanings:
 * - 'implemented': Feature works with current selectors
 * - 'partial': Feature exists but selectors may differ or need adjustment
 * - 'missing': Feature doesn't exist or requires table data that doesn't exist
 * - 'needs-data': Feature requires table with rows/columns to test (grid-dependent)
 */
export const FEATURE_STATUS: Record<string, 'implemented' | 'partial' | 'missing' | 'needs-data'> = {
  'page-login': 'implemented',
  'page-home': 'implemented',
  'page-table': 'implemented',
  'ui-filter-panel': 'implemented', // Toolbar button works
  'ui-filter-condition': 'implemented', // Add condition button works
  'ui-sort-panel': 'implemented', // Toolbar button works
  'ui-hide-fields-panel': 'implemented', // Toolbar button works (may be flaky)
  'ui-group-panel': 'implemented', // Toolbar button works
  'ui-color-panel': 'implemented', // Toolbar button works (may be flaky)
  'ui-column-menu': 'needs-data', // Requires table with columns
  'ui-view-selector': 'implemented', // Sidebar Create... button
  'ui-record-modal': 'needs-data', // Requires table with rows
  'ui-cell-selected': 'needs-data', // Requires table with cells
  'ui-row-hover': 'needs-data', // Requires table with rows
};

/**
 * Get all features that should be tested on localhost
 */
export function getTestableFeatures(): string[] {
  return Object.entries(FEATURE_STATUS)
    .filter(([_, status]) => status !== 'missing')
    .map(([id]) => id);
}
