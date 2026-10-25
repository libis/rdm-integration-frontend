import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SelectComponent, SelectOptionDirective } from './select.component';
import { SelectItem } from '../../../models/select-item';

@Component({
  imports: [SelectComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-select
      inputId="ds"
      [options]="options()"
      [filter]="filter()"
      [editable]="editable()"
      placeholder="Select dataset"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      (opened)="opens = opens + 1"
      (filterChange)="lastFilter = $event"
      (valueChange)="changes.push($event)"
    ></app-select>
  `,
})
class HostComponent {
  readonly options = signal([
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
  ]);
  readonly value = signal<string | undefined>(undefined);
  readonly filter = signal(true);
  readonly editable = signal(false);
  opens = 0;
  lastFilter = '';
  changes: (string | undefined)[] = [];
}

describe('SelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const trigger = () =>
    fixture.nativeElement.querySelector('.form-select') as HTMLButtonElement;
  const panel = () =>
    document.querySelector(
      '.cdk-overlay-container .app-select-panel',
    ) as HTMLElement | null;
  const panelOptions = () =>
    Array.from(
      document.querySelectorAll('.cdk-overlay-container .app-select-option'),
    ) as HTMLElement[];
  const list = () =>
    document.querySelector(
      '.cdk-overlay-container .app-select-list',
    ) as HTMLElement | null;
  // Focus stays on the list; the active option is its aria-activedescendant.
  const activeOption = () => {
    const id = list()?.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id) : null;
  };
  const keyCodes = {
    ArrowDown: 40,
    ArrowUp: 38,
    Enter: 13,
    Escape: 27,
    ' ': 32,
  };
  const key = (
    el: Element,
    k: keyof typeof keyCodes,
    init: KeyboardEventInit = {},
  ) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: k,
        keyCode: keyCodes[k],
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );

  it('shows the placeholder, opens on click and emits opened once', async () => {
    expect(trigger().textContent).toContain('Select dataset');
    trigger().click();
    await fixture.whenStable();
    expect(host.opens).toBe(1);
    expect(panelOptions().map((o) => o.textContent!.trim())).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('selects an option by click, updates ngModel, emits valueChange and closes', async () => {
    trigger().click();
    await fixture.whenStable();
    panelOptions()[1].click();
    await fixture.whenStable();
    expect(host.value()).toBe('b');
    expect(host.changes).toEqual(['b']);
    expect(trigger().textContent).toContain('Beta');
    expect(panel()).toBeNull();
  });

  // The listbox emits no change when the selected option is activated again,
  // so the panel stayed open and its transparent backdrop took the next click.
  it('closes when the selected option is clicked again, without a valueChange', async () => {
    host.value.set('b');
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    panelOptions()[1].click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(host.value()).toBe('b');
    expect(host.changes).toEqual([]);
  });

  for (const k of ['Enter', ' '] as const) {
    it(`closes on ${k === ' ' ? 'Space' : k} on the selected option and focuses the trigger again`, async () => {
      host.filter.set(false);
      host.value.set('b');
      await fixture.whenStable();
      trigger().click();
      await fixture.whenStable();
      expect(document.activeElement).toBe(list());
      expect(activeOption()).toBe(panelOptions()[1]);
      key(document.activeElement!, k);
      await fixture.whenStable();
      expect(panel()).toBeNull();
      expect(host.value()).toBe('b');
      expect(host.changes).toEqual([]);
      expect(document.activeElement).toBe(trigger());
    });
  }

  it('focuses the filter after the panel has rendered', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      panel()!.querySelector('input.form-control'),
    );
  });

  // As with a native select: the arrow keys open the panel from the closed
  // trigger and go straight into the list, past the filter.
  for (const [k, altKey] of [
    ['ArrowDown', false],
    ['ArrowUp', false],
    ['ArrowDown', true],
  ] as const) {
    it(`opens from the trigger on ${altKey ? 'Alt+' : ''}${k} and moves into the list`, async () => {
      host.value.set('b');
      await fixture.whenStable();
      trigger().focus();
      expect(key(trigger(), k, { altKey })).toBeFalse();
      await fixture.whenStable();
      expect(panel()).not.toBeNull();
      expect(host.opens).toBe(1);
      expect(document.activeElement).toBe(list());
      expect(activeOption()).toBe(panelOptions()[1]);
    });
  }

  for (const altKey of [false, true]) {
    it(`opens from the editable input on ${altKey ? 'Alt+' : ''}ArrowDown and moves into the list`, async () => {
      host.editable.set(true);
      await fixture.whenStable();
      const input = fixture.nativeElement.querySelector(
        'input.form-control',
      ) as HTMLInputElement;
      input.focus();
      expect(key(input, 'ArrowDown', { altKey })).toBeFalse();
      await fixture.whenStable();
      expect(panel()).not.toBeNull();
      expect(document.activeElement).toBe(list());
      expect(activeOption()).toBe(panelOptions()[0]);
    });
  }

  it('leaves ArrowUp to the caret in the editable input', async () => {
    host.editable.set(true);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      'input.form-control',
    ) as HTMLInputElement;
    input.focus();
    expect(key(input, 'ArrowUp')).toBeTrue();
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });

  it('moves focus from the filter into the list on ArrowDown', async () => {
    trigger().click();
    await fixture.whenStable();
    const filter = panel()!.querySelector('input.form-control')!;
    expect(document.activeElement).toBe(filter);
    // Handled: the key neither moves the caret nor scrolls the page.
    expect(key(filter, 'ArrowDown')).toBeFalse();
    await fixture.whenStable();
    expect(document.activeElement).toBe(list());
    expect(activeOption()).toBe(panelOptions()[0]);
  });

  it('activates the selected option on ArrowDown from the filter', async () => {
    host.value.set('b');
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    key(document.activeElement!, 'ArrowDown');
    await fixture.whenStable();
    expect(document.activeElement).toBe(list());
    expect(activeOption()).toBe(panelOptions()[1]);
  });

  // Firefox dropped the ring, an invalid declaration there, and the active
  // and selected options then looked the same.
  it('rings the active option and sets it apart from the selected one', async () => {
    host.filter.set(false);
    host.value.set('a');
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    key(list()!, 'ArrowDown');
    await fixture.whenStable();
    const [alpha, beta] = panelOptions();
    expect(activeOption()).toBe(beta);
    expect(list()!.matches(':focus-visible')).toBeTrue();
    const active = getComputedStyle(beta);
    const selected = getComputedStyle(alpha);
    expect(active.outlineStyle).not.toBe('none');
    expect(parseFloat(active.outlineWidth)).toBeGreaterThan(0);
    expect(selected.outlineStyle).toBe('none');
    expect(active.backgroundColor).not.toBe(selected.backgroundColor);
  });

  // Chromium accepts both outlines and its CSSOM rule keeps only the last, so
  // the spec finds the rule through the CSSOM and reads the source of its
  // stylesheet: without the first line Firefox draws no ring at all.
  it('keeps the outline Firefox reads before the one it drops', () => {
    const holds = (sheet: CSSStyleSheet) => {
      try {
        return Array.from(sheet.cssRules).some(
          (r) =>
            r.cssText.includes('.cdk-option-active') &&
            r.cssText.includes('outline'),
        );
      } catch {
        return false;
      }
    };
    const sheet = Array.from(document.styleSheets).find(holds);
    const source = (sheet?.ownerNode?.textContent ?? '').replace(/\s/g, '');
    const block = /\.cdk-option-active[^{]*\{([^}]*)\}/.exec(source)?.[1];
    expect(block?.match(/outline:[^;]*/g)).toEqual([
      'outline:auto1px',
      'outline:auto1px-webkit-focus-ring-color',
    ]);
  });

  it('focuses the list with the first option active when the panel has no filter', async () => {
    host.filter.set(false);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(list());
    expect(activeOption()).toBe(panelOptions()[0]);
  });

  it('selects Beta with ArrowDown then Enter after focusing Alpha', async () => {
    trigger().click();
    await fixture.whenStable();
    list()!.focus();
    await fixture.whenStable();
    expect(activeOption()).toBe(panelOptions()[0]);
    key(document.activeElement!, 'ArrowDown');
    key(document.activeElement!, 'Enter');
    await fixture.whenStable();
    expect(host.value()).toBe('b');
    expect(panel()).toBeNull();
  });

  // Replacing the options destroyed the focused option element and dropped
  // focus to the body with the panel still open.
  it('keeps focus on the list when the options are replaced while it has focus', async () => {
    trigger().click();
    await fixture.whenStable();
    list()!.focus();
    await fixture.whenStable();
    expect(activeOption()?.textContent?.trim()).toBe('Alpha');
    host.options.set([
      { label: 'Gamma', value: 'g' },
      { label: 'Delta', value: 'd' },
    ]);
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(list());
    expect(activeOption()?.textContent?.trim()).toBe('Gamma');
  });

  it('closes on Escape without changing the value and focuses the trigger again', async () => {
    trigger().click();
    await fixture.whenStable();
    key(document.activeElement!, 'Escape');
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(host.value()).toBeUndefined();
    expect(document.activeElement).toBe(trigger());
  });

  it('focuses the trigger again after an option is picked by keyboard', async () => {
    host.filter.set(false);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    key(document.activeElement!, 'ArrowDown');
    key(document.activeElement!, 'Enter');
    await fixture.whenStable();
    expect(host.value()).toBe('b');
    expect(document.activeElement).toBe(trigger());
  });

  it('focuses the trigger again after a backdrop click', async () => {
    trigger().click();
    await fixture.whenStable();
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  // The panel sits at the end of the document: Tab out of it went to the
  // body and then the page header, with the panel and its backdrop still open.
  const tab = (el: Element, shiftKey = false) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        keyCode: 9,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );

  it('closes on Tab from the list and lets the browser move on from the trigger', async () => {
    trigger().click();
    await fixture.whenStable();
    list()!.focus();
    // Not handled: the browser moves focus on from the trigger.
    expect(tab(list()!)).toBeTrue();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on Shift+Tab from the filter and lets the browser move back from the trigger', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(tab(document.activeElement!, true)).toBeTrue();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('stays open on Tab from the filter and Shift+Tab from the list, which stay in the panel', async () => {
    trigger().click();
    await fixture.whenStable();
    tab(document.activeElement!);
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
    list()!.focus();
    tab(list()!, true);
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
  });

  // A click on the padding of the panel focused nothing, so focus fell to
  // the body and Shift+Tab from there left the panel open with its backdrop.
  it('takes focus itself after a click on its padding, and Shift+Tab from there closes it', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(panel()!.getAttribute('tabindex')).toBe('-1');
    // What a click on the padding does: focus the nearest focusable ancestor.
    panel()!.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(panel());
    expect(panel()).not.toBeNull();
    expect(tab(panel()!, true)).toBeTrue();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on Shift+Tab from the list when the panel has no filter', async () => {
    host.filter.set(false);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    tab(list()!, true);
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('focuses the options button on Tab from the list in editable mode', async () => {
    host.editable.set(true);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector(
      '.app-select .btn',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    list()!.focus();
    tab(list()!);
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes and leaves focus where it went when focus moves out of the panel', async () => {
    const other = document.createElement('button');
    document.body.appendChild(other);
    try {
      trigger().click();
      await fixture.whenStable();
      list()!.focus();
      other.focus();
      await fixture.whenStable();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(other);
    } finally {
      other.remove();
    }
  });

  it('stays open when focus leaves for nowhere, as when the window loses focus', async () => {
    trigger().click();
    await fixture.whenStable();
    list()!.focus();
    list()!.blur();
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
  });

  it('leaves focus alone when it already moved outside the panel', async () => {
    const other = document.createElement('button');
    document.body.appendChild(other);
    try {
      trigger().click();
      await fixture.whenStable();
      other.focus();
      key(panel()!, 'Escape');
      await fixture.whenStable();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(other);
    } finally {
      other.remove();
    }
  });

  it('focuses the text input again when the editable panel closes', async () => {
    host.editable.set(true);
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector(
        '.app-select .btn',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    key(document.activeElement!, 'Escape');
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('input.form-control'),
    );
  });

  it('filters locally and emits filterChange', async () => {
    trigger().click();
    await fixture.whenStable();
    const input = document.querySelector(
      '.cdk-overlay-container input.form-control',
    ) as HTMLInputElement;
    input.value = 'bet';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.lastFilter).toBe('bet');
    expect(panelOptions().map((o) => o.textContent!.trim())).toEqual(['Beta']);
  });

  // A listbox may hold only options (axe: aria-required-children).
  it('holds only options in the list and shows No results outside it', async () => {
    trigger().click();
    await fixture.whenStable();
    const roles = () =>
      Array.from(list()!.children).map((c) => c.getAttribute('role'));
    expect(roles()).toEqual(['option', 'option']);
    expect(panel()!.textContent).not.toContain('No results');
    const input = panel()!.querySelector(
      'input.form-control',
    ) as HTMLInputElement;
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(roles()).toEqual([]);
    const message = panel()!.querySelector('.app-select-empty')!;
    expect(message.textContent!.trim()).toBe('No results');
    expect(list()!.contains(message)).toBeFalse();
  });

  // The status region is there while the panel is open, so screen readers
  // announce the message when the filter empties the list.
  it('announces No results through a status region of the panel', async () => {
    trigger().click();
    await fixture.whenStable();
    const status = () =>
      panel()!.querySelector('[role="status"]') as HTMLElement | null;
    expect(status()).not.toBeNull();
    expect(status()!.textContent!.trim()).toBe('');
    const region = status();
    const input = panel()!.querySelector(
      'input.form-control',
    ) as HTMLInputElement;
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(status()).toBe(region);
    expect(status()!.textContent!.trim()).toBe('No results');
  });

  it('shows the label of a value that is set from outside', async () => {
    host.value.set('a');
    await fixture.whenStable();
    expect(trigger().textContent).toContain('Alpha');
  });

  it('editable mode accepts free text as the value and can still open the panel', async () => {
    host.editable.set(true);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      'input.form-control',
    ) as HTMLInputElement;
    input.value = 'doi:10.1/custom';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.value()).toBe('doi:10.1/custom');
    (
      fixture.nativeElement.querySelector(
        '.app-select .btn',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(panelOptions().length).toBe(2);
    expect(host.value()).toBe('doi:10.1/custom');
  });
});

@Component({
  imports: [SelectComponent, SelectOptionDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-select [options]="options">
      <ng-template appSelectOption let-option>
        <span class="custom-option">{{ option.label }}!</span>
      </ng-template>
    </app-select>
  `,
})
class TemplateHostComponent {
  readonly options = [{ label: 'Alpha', value: 'a' }];
}

describe('SelectComponent with a custom option template', () => {
  it('renders every option through the appSelectOption template', async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TemplateHostComponent);
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector('.form-select') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    const custom = document.querySelector(
      '.cdk-overlay-container .app-select-option .custom-option',
    );
    expect(custom?.textContent?.trim()).toBe('Alpha!');
  });
});

// The connect page pattern (getOptions on opened): a loading item first, the
// result of the lookup a moment later, while the panel is open.
@Component({
  imports: [SelectComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-select
      inputId="branch"
      [options]="options()"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      (opened)="options.set([{ label: 'Loading...', value: 'loading' }])"
    ></app-select>
  `,
})
class LazyHostComponent {
  readonly options = signal<SelectItem<string>[]>([]);
  readonly value = signal<string | undefined>(undefined);
}

describe('SelectComponent with options that arrive while it is open', () => {
  it('keeps focus on the list and activates the first result', async () => {
    await TestBed.configureTestingModule({
      imports: [LazyHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(LazyHostComponent);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector(
      '#branch',
    ) as HTMLElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    const list = document.querySelector(
      '.cdk-overlay-container .app-select-list',
    ) as HTMLElement;
    const active = () =>
      document
        .getElementById(list.getAttribute('aria-activedescendant') ?? '')
        ?.textContent?.trim();
    expect(document.activeElement).toBe(list);
    expect(active()).toBe('Loading...');
    fixture.componentInstance.options.set([
      { label: 'main', value: 'main' },
      { label: 'dev', value: 'dev' },
    ]);
    await fixture.whenStable();
    expect(
      document.querySelector('.cdk-overlay-container .app-select-panel'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(list);
    expect(active()).toBe('main');
    list.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        keyCode: 40,
        bubbles: true,
      }),
    );
    list.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        bubbles: true,
      }),
    );
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('dev');
    expect(document.activeElement).toBe(trigger);
  });
});

@Component({
  imports: [SelectComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <label for="lbl">Dataset DOI</label>
    <app-select
      class="labelled"
      inputId="lbl"
      [options]="options"
      [filter]="true"
      placeholder="Select dataset"
    ></app-select>
    <app-select
      class="placeholder"
      [options]="options"
      placeholder="Select queue"
    ></app-select>
    <app-select class="bare" [options]="options"></app-select>
    <app-select
      class="named"
      ariaLabel="Queue for run.py"
      [options]="options"
      placeholder="Select queue"
    ></app-select>
    <app-select
      class="named-free"
      ariaLabel="Free DOI"
      [options]="options"
      [editable]="true"
    ></app-select>
    <label for="free">DOI</label>
    <app-select
      class="free"
      inputId="free"
      [options]="options"
      [editable]="true"
    ></app-select>
  `,
})
class AriaHostComponent {
  readonly options = [
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
  ];
}

describe('SelectComponent ARIA', () => {
  let fixture: ComponentFixture<AriaHostComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AriaHostComponent);
    await fixture.whenStable();
  });

  const el = (selector: string) =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;
  const list = () =>
    document.querySelector(
      '.cdk-overlay-container .app-select-list',
    ) as HTMLElement | null;
  const escape = () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    );

  it('wires the trigger to the list it opens and names the list and the filter', async () => {
    const trigger = el('.labelled .form-select');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBeFalse();
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(list()!.id).toBeTruthy();
    expect(trigger.getAttribute('aria-controls')).toBe(list()!.id);
    expect(list()!.getAttribute('aria-label')).toBe('Dataset DOI');
    const filter = document.querySelector(
      '.cdk-overlay-container input.form-control',
    ) as HTMLInputElement;
    expect(filter.getAttribute('aria-label')).toBe('Filter options');
    expect(filter.getAttribute('aria-controls')).toBe(list()!.id);
  });

  // A button names itself after its label and drops its content, the value;
  // a combobox keeps the label as its name and the content as its value.
  it('makes the trigger a combobox named by its label', () => {
    const trigger = el('.labelled .form-select') as HTMLButtonElement;
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.hasAttribute('aria-label')).toBeFalse();
    expect(Array.from(trigger.labels, (l) => l.textContent)).toEqual([
      'Dataset DOI',
    ]);
  });

  it('names a select without a label after ariaLabel, and its list too', async () => {
    const trigger = el('.named .form-select');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-label')).toBe('Queue for run.py');
    expect(
      el('.named-free input.form-control').getAttribute('aria-label'),
    ).toBe('Free DOI');
    expect(el('.labelled .form-select').hasAttribute('aria-label')).toBeFalse();
    trigger.click();
    await fixture.whenStable();
    expect(list()!.getAttribute('aria-label')).toBe('Queue for run.py');
  });

  it('names the list after the placeholder without a label, else Options', async () => {
    el('.placeholder .form-select').click();
    await fixture.whenStable();
    expect(list()!.getAttribute('aria-label')).toBe('Select queue');
    const first = list()!.id;
    escape();
    await fixture.whenStable();
    el('.bare .form-select').click();
    await fixture.whenStable();
    expect(list()!.getAttribute('aria-label')).toBe('Options');
    expect(list()!.id).not.toBe(first);
  });

  it('gives the editable input the combobox role and the open state', async () => {
    const input = el('.free input.form-control');
    const button = el('.free .btn');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-controls')).toBeFalse();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(list()!.id);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(list()!.id);
    expect(list()!.getAttribute('aria-label')).toBe('DOI');
  });
});

// Selects without inputId, like the per variable selects of the REDCap export
// and the queue selects of compute: none of them may render id="undefined".
@Component({
  imports: [SelectComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-select class="plain" [options]="options"></app-select>
    <app-select class="plain" [options]="options"></app-select>
    <app-select class="free" [options]="options" [editable]="true"></app-select>
    <app-select class="named" inputId="q" [options]="options"></app-select>
    <app-select
      class="named-free"
      inputId="f"
      [options]="options"
      [editable]="true"
    ></app-select>
  `,
})
class IdHostComponent {
  readonly options = [{ label: 'Alpha', value: 'a' }];
}

describe('SelectComponent ids', () => {
  it('renders an id only when inputId is set', async () => {
    await TestBed.configureTestingModule({
      imports: [IdHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(IdHostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const ids = (selector: string) =>
      Array.from(el.querySelectorAll(selector)).map((e) =>
        e.getAttribute('id'),
      );
    expect(ids('.plain .form-select')).toEqual([null, null]);
    expect(ids('.free input.form-control')).toEqual([null]);
    expect(ids('.named .form-select')).toEqual(['q']);
    expect(ids('.named-free input.form-control')).toEqual(['f']);
  });
});

const LONG_LABEL =
  'doi:10.1234/ABC - A rather long dataset title about measurements of ' +
  'something in several Flemish rivers between 2019 and 2024';

// A long label in a narrow block, and in a flex row next to a button, like
// the dataset select on compute and the queue select in its rows.
@Component({
  imports: [SelectComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="block" style="width: 20rem">
      <app-select
        class="w-100"
        [options]="options()"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
      ></app-select>
    </div>
    <div class="row-box d-flex gap-2" style="width: 20rem">
      <app-select
        class="flex-grow-1"
        [options]="options()"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
      ></app-select>
      <button type="button" class="btn btn-primary run">Run</button>
    </div>
  `,
})
class LongLabelHostComponent {
  readonly options = signal([
    { label: 'Short', value: 's' },
    { label: LONG_LABEL, value: 'l' },
  ]);
  readonly value = signal<string | undefined>('s');
}

describe('SelectComponent with a long label', () => {
  it('stays on one line with an ellipsis and shows the label in a title', async () => {
    await TestBed.configureTestingModule({
      imports: [LongLabelHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(LongLabelHostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('.block .form-select') as HTMLElement;
    const oneLine = trigger.getBoundingClientRect().height;
    expect(trigger.getAttribute('title')).toBe('Short');
    fixture.componentInstance.value.set('l');
    await fixture.whenStable();
    expect(trigger.textContent!.trim()).toBe(LONG_LABEL);
    expect(trigger.getAttribute('title')).toBe(LONG_LABEL);
    expect(trigger.getBoundingClientRect().height).toBe(oneLine);
    expect(getComputedStyle(trigger).textOverflow).toBe('ellipsis');
    expect(trigger.scrollWidth).toBeGreaterThan(trigger.clientWidth);
    // In a flex row the select gives way and the button stays inside the row.
    const box = el.querySelector('.row-box')!.getBoundingClientRect();
    const rowTrigger = el.querySelector('.row-box .form-select')!;
    const run = el.querySelector('.run')!.getBoundingClientRect();
    expect(rowTrigger.getBoundingClientRect().height).toBe(oneLine);
    expect(rowTrigger.getBoundingClientRect().right).toBeLessThanOrEqual(
      run.left,
    );
    expect(run.right).toBeLessThanOrEqual(box.right);
  });

  it('has no title without a value', async () => {
    await TestBed.configureTestingModule({
      imports: [LongLabelHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(LongLabelHostComponent);
    fixture.componentInstance.value.set(undefined);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector(
      '.block .form-select',
    ) as HTMLElement;
    expect(trigger.hasAttribute('title')).toBeFalse();
  });
});
