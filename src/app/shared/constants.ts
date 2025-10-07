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

  // File action styles
  // NOTE: These are inline styles for row highlighting.
  // Background colors provide visual distinction for different file actions.
  FILE_ACTION_STYLES: {
    IGNORE: '',
    COPY: 'background-color: #c3e6cb; color: black;',
    UPDATE: 'background-color: #b8daff; color: black;',
    DELETE: 'background-color: #f5c6cb; color: black;',
    CUSTOM: 'background-color: #FFFAA0; color: black;',
  },
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DATAVERSE_TOKEN: 'dataverseToken',
} as const;
