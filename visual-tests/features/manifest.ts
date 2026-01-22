/**
 * Feature Manifest for Visual Regression Testing
 *
 * Each feature defines:
 * - id: Unique identifier for the feature
 * - name: Human-readable name
 * - profile: Browser profile to use (logged-in or logged-out)
 * - page: Which page to start from
 * - clickSequence: Steps to reach the feature state
 * - screenshotTarget: 'fullPage' or a selector for element screenshot
 * - maskSelectors: Dynamic elements to mask (timestamps, avatars, data)
 */

export interface ClickStep {
  action: 'goto' | 'click' | 'hover' | 'wait' | 'waitForSelector' | 'type' | 'press';
  target?: string; // selector or URL
  value?: string | number; // for type/wait
}

export interface Feature {
  id: string;
  name: string;
  profile: 'logged-in' | 'logged-out';
  page: 'login' | 'home' | 'table';
  clickSequence: ClickStep[];
  screenshotTarget: 'fullPage' | 'viewport' | string;
  maskSelectors?: string[];
  notes?: string;
}

// Airtable URLs - UPDATE THESE with your actual workspace/base/table IDs
export const AIRTABLE_URLS = {
  login: 'https://airtable.com/login',
  home: 'https://airtable.com/',
  // Update this with a real base/table URL from your Airtable account
  table: 'https://airtable.com/appOu9uCgQuG82YWo/tblp1eWqneE3E0p8J/viwFYDdf4oD39TpyK?blocks=hide',
};

export const FEATURES: Feature[] = [
  // ==================== PAGES ====================

  {
    id: 'page-login',
    name: 'Login Page',
    profile: 'logged-out',
    page: 'login',
    clickSequence: [{ action: 'goto', target: AIRTABLE_URLS.login }],
    screenshotTarget: 'viewport',
    notes: 'Main login page with Google OAuth button',
  },

  {
    id: 'page-home',
    name: 'Home/Dashboard Page',
    profile: 'logged-in',
    page: 'home',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.home },
      { action: 'wait', value: 5000 },
    ],
    screenshotTarget: 'viewport',
    maskSelectors: [
      '[data-testid="base-card"]', // Base cards have dynamic timestamps
      'time',
      '[class*="timestamp"]',
    ],
    notes: 'Dashboard with workspace list and base cards',
  },

  {
    id: 'page-table',
    name: 'Table View Page',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
    ],
    screenshotTarget: 'viewport',
    maskSelectors: [
      '[class*="cell"]', // Cell data is dynamic
    ],
    notes: 'Main grid view with toolbar, sidebar, and data grid',
  },

  // ==================== TOOLBAR PANELS ====================

  {
    id: 'ui-filter-panel',
    name: 'Filter Panel (Empty)',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: '[role="button"][aria-label="Filter rows"]' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Filter dropdown panel with "Add condition" button',
  },

  {
    id: 'ui-filter-condition',
    name: 'Filter Panel (With Condition)',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: '[role="button"][aria-label="Filter rows"]' },
      { action: 'wait', value: 1500 },
      { action: 'click', target: '[role="button"]:has-text("Add condition")' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Filter panel with field/operator/value row',
  },

  {
    id: 'ui-sort-panel',
    name: 'Sort Panel',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: '[role="button"][aria-label="Sort rows"]' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Sort panel with field picker',
  },

  {
    id: 'ui-hide-fields-panel',
    name: 'Hide Fields Panel',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: '[role="button"][aria-label="Hide fields"]' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Hide fields panel with toggle switches',
  },

  {
    id: 'ui-group-panel',
    name: 'Group Panel',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: '[role="button"][aria-label="Group rows"]' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Group panel with field picker',
  },

  {
    id: 'ui-color-panel',
    name: 'Color Panel',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: '[role="button"][aria-label="Row colors"]' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Color panel with Select field / Conditions options',
  },

  // ==================== MENUS ====================

  {
    id: 'ui-column-menu',
    name: 'Column Header Menu',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      // Hover over the first column header cell to reveal menu button
      { action: 'hover', target: '.cell.header.primary' },
      { action: 'wait', value: 1500 },
      { action: 'click', target: '[data-tutorial-selector-id="openColumnMenuButton"]' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Column header dropdown with Edit, Sort, Filter, Delete options',
  },

  {
    id: 'ui-view-selector',
    name: 'View Type Selector',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      { action: 'click', target: 'button:has-text("Create new")' },
      { action: 'wait', value: 1500 },
    ],
    screenshotTarget: 'viewport',
    notes: 'View creation menu with Grid, Calendar, Gallery, etc.',
  },

  // ==================== MODALS ====================

  {
    id: 'ui-record-modal',
    name: 'Record Expansion Modal',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      // Click the expand button on the first row (appears on hover)
      { action: 'hover', target: '.dataRow:first-child, tr:nth-child(2), [role="row"]:nth-child(2)' },
      { action: 'wait', value: 1500 },
      { action: 'click', target: 'button:has-text("Expand"), [aria-label*="expand" i], .expandRowButton' },
      { action: 'wait', value: 2000 },
    ],
    screenshotTarget: 'viewport',
    maskSelectors: ['input', 'textarea'], // Mask input values
    notes: 'Record expansion modal with field list and comments',
  },

  // ==================== INTERACTIVE STATES ====================

  {
    id: 'ui-cell-selected',
    name: 'Cell Selected State',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      // Click a cell in the first data row
      { action: 'click', target: '.dataRow .cell' },
      { action: 'wait', value: 2000 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Cell with blue selection border',
  },

  {
    id: 'ui-row-hover',
    name: 'Row Hover State',
    profile: 'logged-in',
    page: 'table',
    clickSequence: [
      { action: 'goto', target: AIRTABLE_URLS.table },
      { action: 'wait', value: 5000 },
      // Hover the second data row
      { action: 'hover', target: '.dataRow:nth-of-type(2)' },
      { action: 'wait', value: 2000 },
    ],
    screenshotTarget: 'viewport',
    notes: 'Row with hover background highlight',
  },
];

// Helper to get features by category
export const getFeaturesByPage = (page: Feature['page']) =>
  FEATURES.filter((f) => f.page === page);

export const getFeaturesByProfile = (profile: Feature['profile']) =>
  FEATURES.filter((f) => f.profile === profile);

export default FEATURES;
