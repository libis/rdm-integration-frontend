// The dark colours of the global styles follow the Bootstrap colour mode on <html>
// (data-bs-theme, set by main.ts), not the media query, so they cannot disagree with the
// Bootstrap components. The test browser prefers light, so dark results here come from the
// attribute alone.
describe('Dark mode colours of the global styles', () => {
  const added: HTMLElement[] = [];
  const add = (html: string): HTMLElement => {
    const template = document.createElement('template');
    template.innerHTML = html;
    const el = template.content.firstElementChild as HTMLElement;
    document.body.appendChild(el);
    added.push(el);
    return el;
  };
  const token = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // A colour as the browser computes it, so tokens and colour names compare equal.
  const resolved = (value: string): string => {
    const probe = add(`<span style="color: ${value}"></span>`);
    return getComputedStyle(probe).color;
  };

  afterEach(() => {
    added.splice(0).forEach((el) => el.remove());
    document.documentElement.removeAttribute('data-bs-theme');
  });

  const expected = {
    light: {
      footer: 'rgb(29, 141, 176)',
      footerText: 'rgb(255, 255, 255)',
      logo: 'rgb(197, 91, 40)',
      copyBg: '#c3e6cb',
      iconSuccess: 'rgb(0, 128, 0)',
      iconInfo: 'rgb(0, 0, 255)',
      iconDanger: 'rgb(255, 0, 0)',
    },
    dark: {
      footer: 'rgb(21, 107, 132)',
      footerText: 'rgb(224, 224, 224)',
      logo: 'rgb(232, 138, 93)',
      copyBg: '#1e4620',
      // Bootstrap's success, primary and danger text emphasis colours.
      iconSuccess: 'rgb(117, 183, 152)',
      iconInfo: 'rgb(110, 168, 254)',
      iconDanger: 'rgb(234, 134, 143)',
    },
  };

  for (const theme of ['light', 'dark'] as const) {
    it(`follows data-bs-theme=${theme}`, () => {
      document.documentElement.setAttribute('data-bs-theme', theme);
      const want = expected[theme];
      const footer = add('<footer><div>Footer</div></footer>');
      expect(getComputedStyle(footer).backgroundColor).toBe(want.footer);
      expect(getComputedStyle(footer.firstElementChild!).color).toBe(
        want.footerText,
      );
      const logo = add('<span class="dataverse-navbar-logo">Logo</span>');
      expect(getComputedStyle(logo).color).toBe(want.logo);
      expect(token('--app-file-action-copy-bg')).toBe(want.copyBg);
      expect(resolved('var(--app-icon-success)')).toBe(want.iconSuccess);
      expect(resolved('var(--app-icon-info)')).toBe(want.iconInfo);
      expect(resolved('var(--app-icon-danger)')).toBe(want.iconDanger);
    });
  }
});
