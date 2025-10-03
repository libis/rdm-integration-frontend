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
    WARNING: 'pi pi-stop',
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
    NEUTRAL: 'black',
    DANGER: 'red',
  },

  // File action styles
  FILE_ACTION_STYLES: {
    // NOTE: Provide both light and dark mode friendly colors using CSS variables with fallbacks.
    // These inline styles deliberately keep only color hints; additional contrast handled in SCSS.
    IGNORE: '',
    COPY: 'background-color: var(--file-copy-bg, #284d33); color: var(--file-copy-fg, #d9f2e1)',
    UPDATE: 'background-color: var(--file-update-bg, #18324d); color: var(--file-update-fg, #d3ebff)',
    DELETE: 'background-color: var(--file-delete-bg, #4d1e23); color: var(--file-delete-fg, #f8d7da)',
    // Non-uniform selection: neutral accent
    CUSTOM: 'background-color: var(--file-custom-bg, #2d3a46); color: var(--file-custom-fg, #dde6ed)',
  },
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DATAVERSE_TOKEN: 'dataverseToken',
} as const;
