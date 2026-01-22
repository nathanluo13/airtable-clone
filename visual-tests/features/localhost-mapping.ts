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
 */
export const SELECTOR_MAP: Record<string, string> = {
  // Toolbar buttons - Airtable uses role="button" divs, we might use actual buttons
  '[role="button"][aria-label="Filter rows"]': '[aria-label="Filter rows"], button:has-text("Filter")',
  '[role="button"][aria-label="Sort rows"]': '[aria-label="Sort rows"], button:has-text("Sort")',
  '[role="button"][aria-label="Hide fields"]': '[aria-label="Hide fields"], button:has-text("Hide fields")',
  '[role="button"][aria-label="Group rows"]': '[aria-label="Group rows"], button:has-text("Group")',
  '[role="button"][aria-label="Row colors"]': '[aria-label="Row colors"], button:has-text("Color")',

  // Column menu
  '.cell.header.primary': '.cell.header, th:first-of-type, [data-column-header]',
  '[data-tutorial-selector-id="openColumnMenuButton"]': '[aria-label*="column menu"], .column-menu-button',

  // View selector
  'button:has-text("Create new")': 'button:has-text("Create"), button:has-text("Add view")',

  // Record modal - expand button
  'button:has-text("Expand"), [aria-label*="expand" i], .expandRowButton': 'button:has-text("Expand"), [aria-label*="expand" i], .expand-row',

  // Grid cells and rows
  '.dataRow .cell': '.data-row .cell, tr td, [role="gridcell"]',
  '.dataRow:nth-of-type(2)': '.data-row:nth-of-type(2), tr:nth-child(3)',

  // Filter condition button
  '[role="button"]:has-text("Add condition")': 'button:has-text("Add condition"), button:has-text("Add filter")',
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
 */
export const FEATURE_STATUS: Record<string, 'implemented' | 'partial' | 'missing'> = {
  'page-login': 'implemented',
  'page-home': 'implemented',
  'page-table': 'implemented',
  'ui-filter-panel': 'partial', // UI exists but may differ
  'ui-filter-condition': 'partial',
  'ui-sort-panel': 'partial',
  'ui-hide-fields-panel': 'partial',
  'ui-group-panel': 'partial',
  'ui-color-panel': 'partial',
  'ui-column-menu': 'partial',
  'ui-view-selector': 'partial',
  'ui-record-modal': 'partial',
  'ui-cell-selected': 'implemented',
  'ui-row-hover': 'implemented',
};

/**
 * Get all features that should be tested on localhost
 */
export function getTestableFeatures(): string[] {
  return Object.entries(FEATURE_STATUS)
    .filter(([_, status]) => status !== 'missing')
    .map(([id]) => id);
}
