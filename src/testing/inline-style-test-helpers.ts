/* istanbul ignore file */
export type InlineStyleMap = Record<string, string>;

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
    expect(map).toEqual(
      jasmine.objectContaining({
        'background-color': expectedBackground,
        '--bs-table-bg': expectedBackground,
        '--bs-table-striped-bg': expectedBackground,
        '--bs-table-hover-bg': expectedBackground,
        '--bs-table-active-bg': expectedBackground,
        '--bs-table-accent-bg': expectedBackground,
      }),
    );
  } else {
    expect(map['background-color']).toBeUndefined();
    expect(map['--bs-table-bg']).toBeUndefined();
  }

  if (expectedColor) {
    expect(map).toEqual(
      jasmine.objectContaining({
        color: expectedColor,
        '--bs-table-color': expectedColor,
        '--bs-table-striped-color': expectedColor,
        '--bs-table-hover-color': expectedColor,
        '--bs-table-active-color': expectedColor,
      }),
    );
  } else {
    expect(map['color']).toBeUndefined();
    expect(map['--bs-table-color']).toBeUndefined();
  }
}
