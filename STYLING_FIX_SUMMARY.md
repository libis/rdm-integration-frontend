# File Action Row Styling Fix - Complete Summary

## Problem

Action-based row colors (green for copy, yellow for custom) were not displaying in the metadata-selector component's TreeTable in dark mode.

## Root Causes

### 1. Styling coupled to CSS classes and HostBinding

**Problem**: Row colors depended on dynamically assigned `file-action-*` classes via `@HostBinding`. The styles lived in SCSS with `::ng-deep` overrides, which was brittle and made the palette hard to reason about across themes.

**Solution**: Removed the HostBinding layer entirely. Each row component (`DatafileComponent`, `MetadatafieldComponent`, `SubmittedFileComponent`, `DownladablefileComponent`) now exposes a `getStyle()` helper that maps the current action to inline CSS using `getFileActionStyle()` tokens. The row templates consume it via `<tr [style]="rowRef.getStyle()">`, guaranteeing the style survives theme switches and build-time tree-shaking.

### 2. CSS Selector Override in metadata-selector.component.scss

**Problem**: The `.table tr` selector was applying `background-color: var(--p-content-background)` to ALL rows, overriding the action-specific colors.

**Solution**: Updated selector to exclude rows with file-action classes:

```scss
// OLD (overwrote action colors):
.table tr {
  background-color: var(--p-content-background);
}

// NEW (excludes action rows):
.table tr:not([class*="file-action-"]) {
  background-color: var(--p-content-background);
}
```

## Files Modified

### 1. `/src/app/shared/constants.ts`

- Centralized `FILE_ACTION_STYLES` record with theme-aware CSS variables.
- Provides `getFileActionStyle()` used by all file-action components.

### 2. `/src/app/metadatafield/metadatafield.component.ts`

- Removed `@HostBinding` usage.
- Added `getStyle()` that emits inline declarations assembled from `getFileActionStyle()`.

### 3. `/src/app/datafile/datafile.component.ts`

- Mirrors the `getStyle()` pattern for compare table rows and exports the template reference.

### 4. `/src/app/submitted-file/submitted-file.component.ts`

- Applies the same inline style helper for submit review tables.

### 5. `/src/app/downloadablefile/downladablefile.component.ts`

- Uses `getStyle()` for download TreeTable rows.

### 6. Templates consuming the helpers

- `compare.component.html`, `metadata-selector.component.html`, `submit.component.html`, and `download.component.html` bind `[style]` through a template reference variable (e.g., `#row="appDatafile"`).

### 7. `/src/app/metadata-selector/metadata-selector.component.scss`

- Sets semantic defaults on `.table` while relying on inline row styles to win when present.

### 8. `/src/app/compare/compare.component.scss`

- Mirrors the theme-aware defaults for the compare screen tables.

## Color Styling Source of Truth

Row colors are now driven by CSS variables defined in `getFileActionStyle()`:

```typescript
const FILE_ACTION_STYLES = {
  COPY: {
    backgroundColor: "var(--app-file-action-copy-bg)",
    color: "var(--app-file-action-copy-color)",
  },
  UPDATE: {
    backgroundColor: "var(--app-file-action-update-bg)",
    color: "var(--app-file-action-update-color)",
  },
  DELETE: {
    backgroundColor: "var(--app-file-action-delete-bg)",
    color: "var(--app-file-action-delete-color)",
  },
  CUSTOM: {
    backgroundColor: "var(--app-file-action-custom-bg)",
    color: "var(--app-file-action-custom-color)",
  },
  DOWNLOAD: {
    backgroundColor: "var(--app-file-action-copy-bg)",
    color: "var(--app-file-action-copy-color)",
  },
  IGNORE: {},
} as const;
```

The variables live in `styles.scss`, so the palette automatically adapts to light and dark modes without additional SCSS overrides.

## Testing

Expanded `/src/app/datafile/datafile-styling.spec.ts` and `/src/app/metadata-selector/metadata-selector-styling.spec.ts` to validate:

1. Inline `[style]` bindings emit the expected CSS custom properties.
2. Computed backgrounds are non-transparent in the rendered DOM.
3. Action rows remain visually distinct from each other and from default rows.

## Pattern Consistency

All file-action components now share the same contract:

- `getStyle()` builds inline declarations from the shared constants.
- Templates bind `[style]` through a local template reference (e.g., `#row="appDatafile"`).
- Parent SCSS sets fallbacks but avoids overriding inline declarations.

## Key Takeaways

1. **Prefer inline `[style]` bindings** when you need guaranteed theme-safe action colors.
2. **Keep broad selectors guarded** with `:not()` so they don't override action rows.
3. **Centralize color tokens** in `shared/constants.ts` and surface them via helper functions.
4. **Test computed styles** with `window.getComputedStyle()` to detect regressions across themes.
