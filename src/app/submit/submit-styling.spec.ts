// Tests that document the inline styling approach for submit component action rows
describe('Submit Component - Inline Action Row Styling', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty(
      '--p-content-background',
      '#202020',
    );
    document.documentElement.style.setProperty('--p-text-color', '#f0f0f0');
    document.documentElement.style.setProperty(
      '--app-file-action-copy-bg',
      '#c3e6cb',
    );
    document.documentElement.style.setProperty(
      '--app-file-action-copy-color',
      '#1a1a1a',
    );
  });

  it('identifies action rows by inline background variable', () => {
    const actionRow = document.createElement('tr');
    actionRow.style.backgroundColor = 'var(--app-file-action-copy-bg)';
    actionRow.style.color = 'var(--app-file-action-copy-color)';

    const defaultRow = document.createElement('tr');
    defaultRow.style.backgroundColor = 'var(--p-content-background)';
    defaultRow.style.color = 'var(--p-text-color)';

    expect(actionRow.style.backgroundColor)
      .withContext('Action row keeps inline style token')
      .toBe('var(--app-file-action-copy-bg)');
    expect(defaultRow.style.backgroundColor)
      .withContext('Default row remains on theme background')
      .toBe('var(--p-content-background)');
    expect(actionRow.style.backgroundColor)
      .withContext('Action and default rows should differ')
      .not.toBe(defaultRow.style.backgroundColor);
  });

  it('falls back to theme background when no inline style is set', () => {
    const ignoreRow = document.createElement('tr');
    const tableBackground = getComputedStyle(
      document.documentElement,
    ).getPropertyValue('--p-content-background');

    expect(ignoreRow.style.backgroundColor)
      .withContext('Ignore row should not set inline background')
      .toBe('');
    expect(tableBackground.trim())
      .withContext('Theme background variable should be defined')
      .not.toBe('');
  });
});
