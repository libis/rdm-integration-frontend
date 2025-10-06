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
  FILE_ACTION_STYLES: {
    // NOTE: Provide both light and dark mode friendly colors using CSS variables with fallbacks.
    // These inline styles deliberately keep only color hints; additional contrast handled in SCSS.
    IGNORE: 'color: foreground;',
    COPY: 'background-color: #c3e6cb; color: foretground;',
    UPDATE: 'background-color: #b8daff; color: foreground;',
    DELETE: 'background-color: #f5c6cb; color: foreground;',
    CUSTOM: 'background-color: #FFFAA0; color: foreground;',
  },
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DATAVERSE_TOKEN: 'dataverseToken',
} as const;
