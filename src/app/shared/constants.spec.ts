import {
  expectBootstrapTableStyle,
  parseInlineStyle,
} from '../../testing/inline-style-test-helpers';
import { buildInlineStyle, getFileActionStyle } from './constants';

describe('buildInlineStyle', () => {
  it('returns an empty string when no style tokens are provided', () => {
    expect(buildInlineStyle({})).toBe('');
  });

  it('injects Bootstrap table variables by default', () => {
    const style = buildInlineStyle(getFileActionStyle('COPY'));
    expect(() =>
      expectBootstrapTableStyle(
        style,
        'var(--app-file-action-copy-bg)',
        'var(--app-file-action-copy-color)',
      ),
    ).not.toThrow();
  });

  it('can omit Bootstrap table variables when disabled', () => {
    const style = buildInlineStyle(getFileActionStyle('UPDATE'), {
      includeTableVariables: false,
    });

    expect(parseInlineStyle(style)).toEqual({
      'background-color': 'var(--app-file-action-update-bg)',
      color: 'var(--app-file-action-update-color)',
    });
  });

  it('treats undefined includeTableVariables as enabled', () => {
    const style = buildInlineStyle(getFileActionStyle('COPY'), {
      includeTableVariables: undefined,
    });

    expect(() =>
      expectBootstrapTableStyle(
        style,
        'var(--app-file-action-copy-bg)',
        'var(--app-file-action-copy-color)',
      ),
    ).not.toThrow();
  });

  it('only injects color-related table variables when background is missing', () => {
    const style = buildInlineStyle({ color: 'var(--app-token-text)' });

    expect(parseInlineStyle(style)).toEqual({
      color: 'var(--app-token-text)',
      '--bs-table-color': 'var(--app-token-text)',
      '--bs-table-striped-color': 'var(--app-token-text)',
      '--bs-table-hover-color': 'var(--app-token-text)',
      '--bs-table-active-color': 'var(--app-token-text)',
    });
  });

  it('only injects background-related table variables when color is missing', () => {
    const style = buildInlineStyle({
      backgroundColor: 'var(--app-token-bg)',
    });

    expect(parseInlineStyle(style)).toEqual({
      'background-color': 'var(--app-token-bg)',
      '--bs-table-bg': 'var(--app-token-bg)',
      '--bs-table-striped-bg': 'var(--app-token-bg)',
      '--bs-table-hover-bg': 'var(--app-token-bg)',
      '--bs-table-active-bg': 'var(--app-token-bg)',
      '--bs-table-accent-bg': 'var(--app-token-bg)',
    });
  });
});
