# Test Fixes: Page Reload Crash & Flaky Debounce Tests

## Summary

Fixed two categories of test failures in the Angular 21 (zoneless) Karma test suite:

1. **"Full page reload" crash** — Karma aborted the entire 543-test run mid-flight
2. **3 flaky debounce tests** — intermittently showed "searching..." instead of the expected error text

All 543 tests now pass reliably on consecutive runs.

---

## Root Causes

### Page Reload Crash

Multiple spec files used `provideRouter([])` without `withDisabledInitialNavigation()`. When the Angular Router initialized, it attempted to navigate to Karma's context URL, sometimes triggering a full page reload that killed the test runner.

Additionally, `PluginService.redirectToLogin()` assigned directly to `window.location.href`, which also triggered reloads during tests that exercised login-redirect paths.

### Flaky Debounce Tests

The search error-handling tests (`DownloadComponent.repoNameSearch`, `DownloadComponent.datasetSearch`, `ConnectComponent.repoNameSearch`) used a fixed `setTimeout(DEBOUNCE_TIME + 100)` to wait for the RxJS `debounceTime(750)` pipeline to settle. On slower CI or loaded machines, the debounce + async service call could exceed that window, leaving the placeholder at "searching..." instead of "search failed".

---

## Changes Made

### 1. `provideRouter([], withDisabledInitialNavigation())` across all spec files

**Files modified (9 total):**
- `src/app/app.component.spec.ts`
- `src/app/compute/compute.component.spec.ts`
- `src/app/connect/connect.component.spec.ts`
- `src/app/connect/connect.component.behavior.spec.ts`
- `src/app/connect/connect.component.advanced.spec.ts`
- `src/app/connect/connect.component.config.spec.ts`
- `src/app/ddi-cdi/ddi-cdi.component.spec.ts`
- `src/app/download/download.component.spec.ts`

Every `provideRouter([])` call was replaced with `provideRouter([], withDisabledInitialNavigation())` and the corresponding import added.

### 2. `PluginService.redirectToLogin()` refactored

**File:** `src/app/plugin.service.ts`

- Added `private readonly navigation = inject(NavigationService)`
- Replaced `window.location.href = finalUrl` and `window.location.href = loginUrl` with `this.navigation.assign(...)` 
- This makes the redirect mockable in tests (NavigationService is already mocked in spec files that need it)

### 3. `NavigationService` mock added to `connect.component.spec.ts`

Added `{ provide: NavigationService, useValue: { assign: () => {} } }` to the provider list.

### 4. `fixture.destroy()` in `connect.component.behavior.spec.ts`

The "deep-link" and "reset" tests use `TestBed.resetTestingModule()` followed by `TestBed.configureTestingModule()` to create a fresh environment with custom `ActivatedRoute` query params. Added `fixture.destroy()` before reset to prevent router teardown from triggering navigation during cleanup.

### 5. `waitForSignal()` polling helper replaces fixed `setTimeout`

**Files:** `download.component.spec.ts`, `connect.component.behavior.spec.ts`

```typescript
async function waitForSignal(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 50,
): Promise<void> { ... }
```

The 3 flaky tests now poll every 50ms (up to 5s) for the expected signal state instead of sleeping a fixed duration. This eliminates timing sensitivity entirely.

---

## Verification

Two consecutive full runs both produced:

```
TOTAL: 543 SUCCESS
```
