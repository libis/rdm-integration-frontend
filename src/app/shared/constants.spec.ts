import {
  expectInlineActionStyle,
  parseInlineStyle,
} from '../../testing/inline-style-test-helpers';
import { buildInlineStyle, getFileActionStyle } from './constants';

describe('buildInlineStyle', () => {
  it('returns an empty string when no style tokens are provided', () => {
    expect(buildInlineStyle({})).toBe('');
  });

  it('emits standard background and color declarations', () => {
    const style = buildInlineStyle(getFileActionStyle('COPY'));
    expect(() =>
      expectInlineActionStyle(
        style,
        'var(--app-file-action-copy-bg)',
        'var(--app-file-action-copy-color)',
      ),
    ).not.toThrow();
  });

  it('only emits color when background is missing', () => {
    const style = buildInlineStyle({ color: 'var(--app-token-text)' });

    expect(parseInlineStyle(style)).toEqual({
      color: 'var(--app-token-text)',
    });
  });

  it('only emits background when color is missing', () => {
    const style = buildInlineStyle({
      backgroundColor: 'var(--app-token-bg)',
    });

    expect(parseInlineStyle(style)).toEqual({
      'background-color': 'var(--app-token-bg)',
    });
  });
});
