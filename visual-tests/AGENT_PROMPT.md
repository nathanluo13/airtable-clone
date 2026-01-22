# Visual Regression Testing - Agent Guide

This document explains how to use the visual regression testing system to achieve pixel-perfect UI matching between our Airtable clone and the real Airtable.

## Overview

The system compares localhost screenshots against reference screenshots captured from real Airtable. It uses two comparison methods:

1. **Visual Match (Primary)** - Tolerant comparison that handles anti-aliasing, small color shifts, and minor positioning differences. This is what determines pass/fail.

2. **Pixel Match (Reference)** - Strict pixel-by-pixel comparison. Useful for measuring exact similarity but not the primary metric.

## Quick Start

```bash
cd Workspace/airtable-clone/visual-tests

# First time: Set up localhost browser profile
pnpm setup:localhost
# Log in manually in the browser, then Ctrl+C to save

# Run visual regression test
pnpm test:visual

# View results
cat runs/latest/results.json
```

## Commands

### Setup

```bash
# Create localhost browser profile (interactive login)
pnpm setup:localhost

# Create with email auth (requires TEST_EMAIL and TEST_PASSWORD env vars)
TEST_EMAIL=user@example.com TEST_PASSWORD=pass pnpm setup:localhost --email
```

### Testing

```bash
# Full test: capture localhost + compare against references
pnpm test:visual

# Test specific feature only
pnpm test:visual --feature=ui-filter-panel

# Compare only (skip capture, use latest screenshots)
pnpm test:visual --compare-only

# JSON output only (for parsing)
pnpm test:visual --json
```

### Individual Scripts

```bash
# Capture localhost screenshots only
pnpm capture:localhost
pnpm capture:localhost --feature=ui-filter-panel

# Run comparison only
pnpm compare
pnpm compare --run=2026-01-22T13-30-00
pnpm compare --feature=ui-filter-panel
```

## Directory Structure

```
visual-tests/
├── reference/                    # Golden screenshots from Airtable
│   ├── logged-out/
│   │   └── page-login.png
│   └── logged-in/
│       ├── page-home.png
│       ├── page-table.png
│       ├── ui-filter-panel.png
│       └── ...
├── runs/                         # Test runs (never deleted)
│   ├── 2026-01-22T13-30-00/
│   │   ├── screenshots/          # Localhost screenshots
│   │   ├── diffs/                # Diff images for failures
│   │   │   ├── ui-filter-panel-visual.png   # Visual diff
│   │   │   └── ui-filter-panel-pixel.png    # Pixel diff
│   │   ├── capture-results.json
│   │   ├── results.json          # Comparison results
│   │   ├── capture.log
│   │   └── run.log
│   └── latest -> 2026-01-22T13-30-00
├── profiles/
│   ├── logged-in/                # Airtable session
│   └── localhost-session/        # Localhost session
└── features/
    ├── manifest.ts               # Feature definitions
    └── localhost-mapping.ts      # URL/selector mappings
```

## Understanding Results

### results.json Structure

```json
{
  "timestamp": "2026-01-22T13:30:00Z",
  "run": "2026-01-22T13-30-00",
  "summary": "10/14 passing",
  "stats": {
    "total": 14,
    "passed": 10,
    "failed": 4,
    "missing": 0,
    "errors": 0
  },
  "results": [
    {
      "featureId": "ui-filter-panel",
      "status": "fail",
      "visualMatch": false,
      "pixelDiffPercent": 12.5,
      "pixelDiffCount": 24000,
      "diffPath": "diffs/ui-filter-panel-visual.png"
    }
  ],
  "failed": ["ui-filter-panel", "ui-sort-panel", ...],
  "nextPriority": "ui-filter-panel"
}
```

### Status Values

- `pass` - Visual match passed (UI is close enough)
- `fail` - Visual match failed (noticeable differences)
- `missing` - Screenshot not found (reference or current)
- `error` - Comparison error (file read, etc.)

## Agent Workflow

### Continuous Improvement Loop

1. **Run tests**
   ```bash
   pnpm test:visual --json
   ```

2. **Parse results**
   - Check `success` field
   - If false, get `nextPriority` for the feature to fix first

3. **Analyze failure**
   - Open `runs/latest/diffs/<feature>-visual.png` to see differences
   - Magenta highlights show areas that don't match
   - Compare with `reference/logged-in/<feature>.png`

4. **Fix the issue**
   - Identify CSS/component differences
   - Make changes in the source code
   - Common fixes:
     - Colors: Check CSS variables
     - Spacing: Check padding/margin values
     - Typography: Check font-size, font-weight, line-height
     - Borders: Check border-width, border-color, border-radius

5. **Re-test specific feature**
   ```bash
   pnpm test:visual --feature=ui-filter-panel
   ```

6. **Repeat until all pass**

### Prioritization Strategy

Features are sorted by severity (highest pixel diff first). Fix in this order:

1. **Page-level features first** (page-login, page-home, page-table)
   - These affect the overall layout
   - Fixing these may resolve multiple component issues

2. **High-diff features** (>20% pixel diff)
   - Major visual differences
   - Usually indicates missing styles or wrong components

3. **Low-diff features** (<5% pixel diff)
   - Minor tweaks
   - Often just color or spacing adjustments

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Wrong colors | Large diff areas | Check CSS color variables |
| Missing shadows | Subtle diff on edges | Add box-shadow |
| Wrong fonts | Text areas highlighted | Check font-family, font-weight |
| Spacing off | Gaps in diff | Adjust padding/margin |
| Missing icons | Icon areas magenta | Add/fix icon imports |
| Wrong borders | Border lines highlighted | Check border properties |
| Animation state | Random diff areas | Add wait time in manifest |

## Feature Manifest

Features are defined in `features/manifest.ts`. Each feature has:

```typescript
{
  id: 'ui-filter-panel',
  name: 'Filter Panel (Empty)',
  profile: 'logged-in',
  page: 'table',
  clickSequence: [
    { action: 'goto', target: 'https://airtable.com/...' },
    { action: 'wait', value: 2000 },
    { action: 'click', target: '[aria-label="Filter rows"]' },
    { action: 'wait', value: 500 },
  ],
  screenshotTarget: 'viewport',
}
```

### Adding New Features

1. Add feature to `features/manifest.ts`
2. Capture reference: `pnpm capture --feature=new-feature`
3. Add localhost mapping in `features/localhost-mapping.ts`
4. Test: `pnpm test:visual --feature=new-feature`

## Localhost Mapping

The `localhost-mapping.ts` file maps Airtable URLs and selectors to localhost equivalents:

```typescript
// URLs
'https://airtable.com/login' -> 'http://localhost:3000/login'

// Selectors (may differ between Airtable and our clone)
'[role="button"][aria-label="Filter rows"]' -> 'button:has-text("Filter")'
```

If a feature fails because the selector doesn't match, update the mapping.

## Comparison Settings

Located in `scripts/run-comparison.ts`:

```typescript
// Visual comparison (tolerant)
VISUAL_TOLERANCE = 5;          // Color tolerance (0-255)
ANTIALIASING_TOLERANCE = 5;    // Anti-aliasing tolerance

// Pixel comparison (strict reference)
PIXEL_THRESHOLD = 0.1;         // 0-1, lower = stricter
```

Adjust these if comparisons are too strict/lenient.

## Troubleshooting

### "Profile not found"
```bash
pnpm setup:localhost
```

### "Reference not found"
Reference screenshots missing. Re-capture from Airtable:
```bash
pnpm capture --feature=<id>
```

### "Localhost screenshots fail to capture"
1. Ensure localhost is running: `pnpm dev`
2. Check selector mapping in `localhost-mapping.ts`
3. Increase wait times if page loads slowly

### "All features fail with 100% diff"
- Screenshots may be different sizes
- Check viewport settings (should be 1920x1080)
- Ensure same browser profile settings

### "Visual passes but pixel diff is high"
This is expected! Visual comparison is tolerant of:
- Anti-aliasing differences
- Subpixel rendering
- Minor color shifts

The pixel diff is just a reference metric.
