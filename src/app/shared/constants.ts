// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

/**
 * Detect if dark mode is active
 */
function isDarkMode(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

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

  // File action styles - Light mode colors (dark mode handled via getFileActionStyle)
  FILE_ACTION_STYLES_LIGHT: {
    IGNORE: '',
    COPY: 'background-color: #c3e6cb; color: #1a1a1a;',
    UPDATE: 'background-color: #b8daff; color: #1a1a1a;',
    DELETE: 'background-color: #f5c6cb; color: #1a1a1a;',
    CUSTOM: 'background-color: #FFFAA0; color: #1a1a1a;',
  },
  // File action styles - Dark mode colors
  FILE_ACTION_STYLES_DARK: {
    IGNORE: '',
    COPY: 'background-color: #1e4620; color: #c3e6cb;',
    UPDATE: 'background-color: #1a3d5c; color: #b8daff;',
    DELETE: 'background-color: #4a1f23; color: #f5c6cb;',
    CUSTOM: 'background-color: #4a4520; color: #FFFAA0;',
  },
} as const;

/**
 * Get file action style based on current theme
 * @param action - The file action type
 * @returns Inline style string for the action
 */
export function getFileActionStyle(
  action: 'IGNORE' | 'COPY' | 'UPDATE' | 'DELETE' | 'CUSTOM',
): string {
  const dark = isDarkMode();
  const styles = dark
    ? APP_CONSTANTS.FILE_ACTION_STYLES_DARK
    : APP_CONSTANTS.FILE_ACTION_STYLES_LIGHT;
  return styles[action];
}

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DATAVERSE_TOKEN: 'dataverseToken',
} as const;
