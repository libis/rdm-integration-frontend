// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

/**
 * Application-wide constants
 */
export const APP_CONSTANTS = {
  // Debounce time for search inputs
  DEBOUNCE_TIME: 750,

  // Maximum retry attempts for data updates
  MAX_UPDATE_RETRIES: 10,

  // Sleep duration between retries (ms)
  RETRY_SLEEP_DURATION: 1000,

  // PrimeNG icons
  ICONS: {
    NO_ACTION: 'pi pi-stop',
    UPDATE: 'pi pi-copy',
    MIRROR: 'pi pi-sync',
    SUBMIT: 'pi pi-save',
    COMPARE: 'pi pi-flag',
    ACTION: 'pi pi-bolt',
    // Use a clear warning triangle to avoid looking like an actionable checkbox/stop square
    WARNING: 'pi pi-exclamation-triangle',
    FILTER: 'pi pi-filter',
    PLAY: 'pi pi-play',
    NEW_FILE: 'pi pi-plus-circle',
    CHANGED_FILE: 'pi pi-exclamation-circle',
    UNCHANGED_FILE: 'pi pi-check-circle',
    DELETED_FILE: 'pi pi-minus-circle',
  },

  // Color scheme
  COLORS: {
    SUCCESS: 'green',
    INFO: 'blue',
    NEUTRAL: 'foreground',
    DANGER: 'red',
  },
} as const;

export type FileActionStyleKey =
  | 'IGNORE'
  | 'COPY'
  | 'UPDATE'
  | 'DELETE'
  | 'CUSTOM'
  | 'DOWNLOAD';

export type FileActionStyle = Readonly<{
  backgroundColor?: string;
  color?: string;
}>;

const FILE_ACTION_STYLES: Record<FileActionStyleKey, FileActionStyle> = {
  IGNORE: {},
  COPY: {
    backgroundColor: 'var(--app-file-action-copy-bg)',
    color: 'var(--app-file-action-copy-color)',
  },
  UPDATE: {
    backgroundColor: 'var(--app-file-action-update-bg)',
    color: 'var(--app-file-action-update-color)',
  },
  DELETE: {
    backgroundColor: 'var(--app-file-action-delete-bg)',
    color: 'var(--app-file-action-delete-color)',
  },
  CUSTOM: {
    backgroundColor: 'var(--app-file-action-custom-bg)',
    color: 'var(--app-file-action-custom-color)',
  },
  DOWNLOAD: {
    backgroundColor: 'var(--app-file-action-copy-bg)',
    color: 'var(--app-file-action-copy-color)',
  },
} as const;

/**
 * Get file action inline style tokens based on action type.
 * Values reference CSS variables so that light/dark modes render correctly.
 */
export function getFileActionStyle(
  action: FileActionStyleKey,
): FileActionStyle {
  return FILE_ACTION_STYLES[action];
}

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DATAVERSE_TOKEN: 'dataverseToken',
} as const;
