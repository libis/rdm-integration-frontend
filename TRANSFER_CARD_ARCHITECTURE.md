# Transfer Progress Card Architecture

## Overview

The `TransferProgressCardComponent` is a **universal component** that handles transfer progress tracking for **all transfer plugins** (Globus and non-Globus).

## How It Works

### Plugin Mode Selection

The component requires an **explicit `isGlobus` input** from the parent component to determine the transfer mode. This avoids relying on global state and ensures correct behavior regardless of how the user navigated to the page.

```typescript
@Input({ required: true })
isGlobus = false;  // Must be set by parent: submit or download component
```

**Why explicit input instead of auto-detection?**

- Download component can be accessed directly (bypassing connect page)
- Global `credentialsService.credentials.plugin` may not reflect actual transfer mode
- Parent component knows the context better than shared child component

### Globus Transfers

**Input Requirements:**

- `isGlobus`: `true` (required)
- `taskId`: Globus task ID (returned by backend)
- `monitorUrl`: (optional) Globus monitor URL

**Polling Behavior:**

- Polls `submitService.getGlobusTransferStatus(taskId)` every 5 seconds
- Returns real-time Globus transfer status from Globus API
- Shows Globus-specific messages ("Checking Globus transfer status…")
- Links to Globus web interface for detailed monitoring

**Data Flow:**

```
Globus API → submitService → TransferTaskStatus → UI
```

### Non-Globus Transfers

**Input Requirements:**

- `isGlobus`: `false` (required)
- `taskId`: Dataset ID (used as identifier, not a real "task")
- `data`: CompareResult containing file list
- `dataUpdate`: Callback to update parent component's data

**Polling Behavior:**

- Polls `dataUpdatesService.updateData(files, datasetId)` every 5 seconds
- Backend checks actual file statuses in the repository
- Maps file statuses to TransferTaskStatus format
- Updates parent component via `dataUpdate` callback
- Shows generic messages ("Checking transfer status…")

**Data Flow:**

```
Backend Polling → CompareResult → buildStatusFromCompareResult() → TransferTaskStatus → UI
                                ↓
                           dataUpdate callback → Parent Component
```

### Status Mapping (Non-Globus)

The component maps `CompareResult` data to unified `TransferTaskStatus`:

| CompareResult Status    | Mapped Status | Message                            |
| ----------------------- | ------------- | ---------------------------------- |
| `ResultStatus.Finished` | `SUCCEEDED`   | "Transfer completed successfully." |
| `ResultStatus.Updating` | `ACTIVE`      | "Transfer in progress…"            |
| `ResultStatus.New`      | `PENDING`     | "Preparing transfer…"              |
| Other                   | `ACTIVE`      | "Waiting for repository updates…"  |

| File Status          | Counted As              |
| -------------------- | ----------------------- |
| `Filestatus.Equal`   | Completed (transferred) |
| `Filestatus.Deleted` | Skipped                 |
| `Filestatus.Unknown` | Failed                  |

## Usage in Submit Component

### Properties

```typescript
// Works for ALL plugins
transferTaskId?: string | null;     // Globus task ID or dataset ID
transferMonitorUrl?: string | null; // External URL (Globus only)
transferInProgress = false;         // Polling state
```

### After Submit Success

```typescript
if (this.isGlobus()) {
  // Use Globus task ID from backend response
  this.transferTaskId = data.globusTransferTaskId ?? null;
  this.transferMonitorUrl = data.globusTransferMonitorUrl ?? null;
} else {
  // Use dataset ID for backend polling
  this.transferTaskId = this.pid;
}
this.transferInProgress = true;
```

### Template

```html
<app-transfer-progress-card [isGlobus]="isGlobus()" [taskId]="transferTaskId" [monitorUrl]="transferMonitorUrl" [submitting]="transferInProgress && !transferTaskId" (pollingChange)="onStatusPollingChange($event)" [data]="compareResult" [dataUpdate]="onDataUpdate.bind(this)" (completed)="done = true"></app-transfer-progress-card>
```

### Key Inputs Explained

- **`isGlobus`**: Transfer mode selector (required)
  - `true` → Globus API polling
  - `false` → Backend polling with file status mapping

- **`taskId`**: The identifier for polling
  - Globus: actual Globus task ID
  - Others: dataset ID (PID)

- **`data`**: CompareResult with file list (non-Globus only)
  - Contains current file states
  - Updated by card's polling → triggers `dataUpdate` callback

- **`dataUpdate`**: Callback to sync parent's data (non-Globus only)
  - Card polls backend → gets updated CompareResult
  - Calls this callback → parent updates its file list UI

- **`monitorUrl`**: External monitor link (Globus only)
  - If provided: used as-is
  - If not: constructed from taskId

## Usage in Download Component

Download component **always uses Globus**, so it's simpler:

```html
<app-transfer-progress-card [isGlobus]="true" [taskId]="lastTransferTaskId" [monitorUrl]="globusMonitorUrl" [submitting]="downloadInProgress && !lastTransferTaskId" (pollingChange)="onStatusPollingChange($event)"></app-transfer-progress-card>
```

Note:

- `isGlobus` is hardcoded to `true` (download always uses Globus)
- No `data` or `dataUpdate` needed because download is always Globus

## Key Design Decisions

1. **Single Component for All Plugins**: Reduces code duplication and ensures consistent UX
2. **Explicit Mode Selection**: Parent component passes `isGlobus` flag to avoid global state dependency
3. **Unified Status Model**: Both paths produce `TransferTaskStatus` for consistent UI
4. **Generic Naming**: Properties named for function, not specific plugin (e.g., `transferTaskId` not `globusTaskId`)
5. **Conditional Messages**: UI text adapts based on plugin ("Globus" vs generic)
6. **No Implicit Assumptions**: Component doesn't guess plugin type from navigation history

## Benefits

✅ **Consistent UX**: Same progress card for all transfers
✅ **Maintainable**: One component to update, not multiple variants
✅ **Flexible**: Easy to add new plugin types
✅ **Clear Separation**: Plugin-specific logic contained in card
✅ **Type-Safe**: TypeScript enforces correct data flow
✅ **Reliable**: No dependency on global state or navigation history
✅ **Explicit**: Parent controls behavior through clear input contract

## Future Extensions

To add a new transfer plugin:

**Option 1: Keep binary mode (if new plugin is non-Globus)**

- No changes needed! New plugin uses `isGlobus=false` path
- Works exactly like existing non-Globus plugins

**Option 2: Add specific plugin type (if new plugin needs different behavior)**

1. Change `isGlobus` input to `pluginType: 'globus' | 'backend' | 'newtype'`
2. Add case in `getTransferStatus()` for new plugin's polling method
3. Add case in error messages if plugin needs specific messaging
4. Update submit component to pass correct plugin type
5. Download remains `pluginType='globus'` (if unchanged)
