# File Action Row Styling Fix - Complete Summary

## Problem

Action-based row colors (green for copy, yellow for custom) were not displaying in the metadata-selector component's TreeTable in dark mode.

## Root Causes

### 1. Missing @HostBinding in MetadatafieldComponent

**Problem**: The `metadatafield.component.ts` didn't have a `@HostBinding` to apply CSS classes based on the field's action.

**Solution**: Added `@HostBinding('class')` getter that returns the appropriate `file-action-*` class:

```typescript
@HostBinding('class') get hostClass(): string {
  const action = this.field().action ?? Fieldaction.Ignore;
  switch (action) {
    case Fieldaction.Copy:
      return 'file-action-copy';
    case Fieldaction.Custom:
      return 'file-action-custom';
    default:
      return ''; // No special class for Ignore
  }
}
```

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

### 1. `/src/app/metadatafield/metadatafield.component.ts`

- Added `HostBinding` import
- Added `@HostBinding('class')` getter method
- Maps Fieldaction enum to CSS class names

### 2. `/src/app/metadata-selector/metadata-selector.component.scss`

- Simplified and cleaned up CSS
- Changed `.table tr` to `.table tr:not([class*='file-action-'])`
- Removed redundant `:host ::ng-deep` nesting

### 3. `/src/app/compare/compare.component.scss`

- Applied same pattern for consistency
- Changed `.table tr` to `.table tr:not([class*='file-action-'])`

## Color Styling (Unchanged)

The actual colors are defined in `/src/app/metadatafield/metadatafield.component.scss`:

```scss
::ng-deep tr[app-metadatafield].file-action-copy {
  background-color: #c3e6cb !important; /* Light mode: light green */
  color: #1a1a1a !important;

  @media (prefers-color-scheme: dark) {
    background-color: #1e4620 !important; /* Dark mode: dark green */
    color: #c3e6cb !important;
  }
}

::ng-deep tr[app-metadatafield].file-action-custom {
  background-color: #fffaa0 !important; /* Light mode: light yellow */
  color: #1a1a1a !important;

  @media (prefers-color-scheme: dark) {
    background-color: #4a4520 !important; /* Dark mode: dark yellow */
    color: #fffaa0 !important;
  }
}
```

## Testing

Created `/src/app/metadata-selector/metadata-selector-styling.spec.ts` to verify:

1. Correct CSS classes are applied to rows
2. Background colors are visible (not transparent)
3. Action rows have different colors from each other and from default rows

## Pattern Consistency

Both `datafile.component.ts` and `metadatafield.component.ts` now use the same pattern:

- `@HostBinding('class')` getter
- Returns appropriate `file-action-*` class based on enum
- Parent component SCSS uses `:not([class*='file-action-'])` to exclude action rows

## Key Takeaways

1. **Always use @HostBinding** for dynamic CSS classes on component selectors
2. **Use :not() pseudo-class** to exclude specific elements from broad selectors
3. **Use ::ng-deep with !important** for styling that needs to pierce component encapsulation
4. **Test color visibility** with `window.getComputedStyle()` to ensure backgrounds aren't being overridden
