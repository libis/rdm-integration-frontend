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

type FileActionStyleKey =
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

type InlineStyleOptions = Readonly<{
  includeTableVariables?: boolean;
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
 * Convert a file-action style definition to an inline style string.
 * Optionally inject Bootstrap table CSS variables so descendant cells inherit the colors.
 */
export function buildInlineStyle(
  style: FileActionStyle,
  options: InlineStyleOptions = { includeTableVariables: true },
): string {
  const declarations: string[] = [];
  const includeTableVariables = options.includeTableVariables ?? true;

  if (style.backgroundColor) {
    const bg = style.backgroundColor;
    declarations.push(`background-color: ${bg}`);
    if (includeTableVariables) {
      declarations.push(`--bs-table-bg: ${bg}`);
      declarations.push(`--bs-table-striped-bg: ${bg}`);
      declarations.push(`--bs-table-hover-bg: ${bg}`);
      declarations.push(`--bs-table-active-bg: ${bg}`);
      declarations.push(`--bs-table-accent-bg: ${bg}`);
    }
  }

  if (style.color) {
    const color = style.color;
    declarations.push(`color: ${color}`);
    if (includeTableVariables) {
      declarations.push(`--bs-table-color: ${color}`);
      declarations.push(`--bs-table-striped-color: ${color}`);
      declarations.push(`--bs-table-hover-color: ${color}`);
      declarations.push(`--bs-table-active-color: ${color}`);
    }
  }

  return declarations.length ? `${declarations.join('; ')};` : '';
}
