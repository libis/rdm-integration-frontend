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

  // File action CSS class names (styles defined in styles.scss using CSS variables)
  FILE_ACTION_CLASSES: {
    IGNORE: '',
    COPY: 'file-action-copy',
    UPDATE: 'file-action-update',
    DELETE: 'file-action-delete',
    CUSTOM: 'file-action-custom',
  },
} as const;

/**
 * Get file action CSS class based on action type
 * Returns a CSS class name that automatically adapts to light/dark theme via CSS variables
 * @param action - The file action type
 * @returns CSS class name for the action
 */
export function getFileActionClass(
  action: 'IGNORE' | 'COPY' | 'UPDATE' | 'DELETE' | 'CUSTOM',
): string {
  return APP_CONSTANTS.FILE_ACTION_CLASSES[action];
}

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DATAVERSE_TOKEN: 'dataverseToken',
} as const;
