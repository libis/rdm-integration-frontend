import {
  expectInlineActionStyle,
  parseInlineStyle,
} from './inline-style-test-helpers';

describe('inline-style-test-helpers', () => {
  describe('parseInlineStyle', () => {
    it('returns an empty object when style string is empty', () => {
      expect(parseInlineStyle('')).toEqual({});
    });

    it('ignores malformed declarations', () => {
      const style = 'color; background-color; --app-token:; width: 100px;';
      expect(parseInlineStyle(style)).toEqual(
        jasmine.objectContaining({
          width: '100px',
        }),
      );
      expect(parseInlineStyle(style)['color']).toBeUndefined();
      expect(parseInlineStyle(style)['--app-token']).toBeUndefined();
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

  describe('expectInlineActionStyle', () => {
    const background = '#123456';
    const color = '#ffffff';

    it('asserts the background declaration when background provided', () => {
      const style = `background-color: ${background};`;
      expect(() =>
        expectInlineActionStyle(style, background, undefined),
      ).not.toThrow();
    });

    it('asserts the color declaration when color provided', () => {
      const style = `color: ${color};`;
      expect(() =>
        expectInlineActionStyle(style, undefined, color),
      ).not.toThrow();
    });

    it('asserts variables are absent when expected values are not provided', () => {
      const style = 'border: 1px solid black;';
      expect(() =>
        expectInlineActionStyle(style, undefined, undefined),
      ).not.toThrow();
    });
  });
});
