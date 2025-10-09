import {
    expectBootstrapTableStyle,
    parseInlineStyle,
} from './inline-style-test-helpers';

describe('inline-style-test-helpers', () => {
  describe('parseInlineStyle', () => {
    it('returns an empty object when style string is empty', () => {
      expect(parseInlineStyle('')).toEqual({});
    });

    it('ignores malformed declarations', () => {
      const style = 'color; background-color; --bs-table-bg:; width: 100px;';
      expect(parseInlineStyle(style)).toEqual(
        jasmine.objectContaining({
          width: '100px',
        }),
      );
      expect(parseInlineStyle(style)['color']).toBeUndefined();
      expect(parseInlineStyle(style)['--bs-table-bg']).toBeUndefined();
    });

    it('handles colon characters inside values', () => {
      const style =
        '--custom-gradient: linear-gradient(90deg, red, blue); color: white';
      expect(parseInlineStyle(style)['--custom-gradient']).toBe(
        'linear-gradient(90deg, red, blue)',
      );
      expect(parseInlineStyle(style)['color']).toBe('white');
    });
  });

  describe('expectBootstrapTableStyle', () => {
    const background = '#123456';
    const color = '#ffffff';

    it('asserts all Bootstrap background variables when background provided', () => {
      const style = `background-color: ${background}; --bs-table-bg: ${background}; --bs-table-striped-bg: ${background}; --bs-table-hover-bg: ${background}; --bs-table-active-bg: ${background}; --bs-table-accent-bg: ${background};`;
      expect(() => expectBootstrapTableStyle(style, background, undefined)).not.toThrow();
    });

    it('asserts all Bootstrap color variables when color provided', () => {
      const style = `color: ${color}; --bs-table-color: ${color}; --bs-table-striped-color: ${color}; --bs-table-hover-color: ${color}; --bs-table-active-color: ${color};`;
      expect(() => expectBootstrapTableStyle(style, undefined, color)).not.toThrow();
    });

    it('asserts variables are absent when expected values are not provided', () => {
      const style = 'border: 1px solid black;';
      expect(() => expectBootstrapTableStyle(style, undefined, undefined)).not.toThrow();
    });
  });
});
