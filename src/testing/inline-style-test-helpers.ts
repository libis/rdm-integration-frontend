/* istanbul ignore file */
export type InlineStyleMap = Partial<Record<string, string>>;

/**
 * Convert a semicolon-delimited inline style string into a property map.
 * Empty declarations and stray whitespace are ignored so callers can
 * assert on individual CSS variables without depending on ordering.
 */
export function parseInlineStyle(style: string): InlineStyleMap {
  if (!style) {
    return {};
  }

  const declarations = style
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return declarations.reduce<InlineStyleMap>((acc, declaration) => {
    const [rawProperty, ...rawValue] = declaration.split(':');
    if (!rawProperty || rawValue.length === 0) {
      return acc;
    }

    const property = rawProperty.trim();
    const value = rawValue.join(':').trim();
    if (property.length === 0 || value.length === 0) {
      return acc;
    }

    acc[property] = value;
    return acc;
  }, {});
}

/**
 * Convenience helper for tests to verify Bootstrap table CSS variables are present.
 */
export function expectBootstrapTableStyle(
  style: string,
  expectedBackground: string | undefined,
  expectedColor: string | undefined,
): void {
  const map = parseInlineStyle(style);

  if (expectedBackground) {
    const entries: Record<string, string> = {
      'background-color': expectedBackground,
      '--bs-table-bg': expectedBackground,
      '--bs-table-striped-bg': expectedBackground,
      '--bs-table-hover-bg': expectedBackground,
      '--bs-table-active-bg': expectedBackground,
      '--bs-table-accent-bg': expectedBackground,
    };

    for (const [key, value] of Object.entries(entries)) {
      if (!Object.prototype.hasOwnProperty.call(map, key) || map[key] !== value) {
        throw new Error(
          `Expected ${key} to equal "${value}" but received "${map[key] ?? 'undefined'}"`,
        );
      }
    }
  } else {
    const offending = ['background-color', '--bs-table-bg', '--bs-table-striped-bg', '--bs-table-hover-bg', '--bs-table-active-bg', '--bs-table-accent-bg'].filter((key) =>
      Object.prototype.hasOwnProperty.call(map, key),
    );

    if (offending.length > 0) {
      throw new Error(
        `Expected no Bootstrap background variables but found: ${offending.join(', ')}`,
      );
    }
  }

  if (expectedColor) {
    const entries: Record<string, string> = {
      color: expectedColor,
      '--bs-table-color': expectedColor,
      '--bs-table-striped-color': expectedColor,
      '--bs-table-hover-color': expectedColor,
      '--bs-table-active-color': expectedColor,
    };

    for (const [key, value] of Object.entries(entries)) {
      if (!Object.prototype.hasOwnProperty.call(map, key) || map[key] !== value) {
        throw new Error(
          `Expected ${key} to equal "${value}" but received "${map[key] ?? 'undefined'}"`,
        );
      }
    }
  } else {
    const offending = ['color', '--bs-table-color', '--bs-table-striped-color', '--bs-table-hover-color', '--bs-table-active-color'].filter((key) =>
      Object.prototype.hasOwnProperty.call(map, key),
    );

    if (offending.length > 0) {
      throw new Error(
        `Expected no Bootstrap color variables but found: ${offending.join(', ')}`,
      );
    }
  }
}
