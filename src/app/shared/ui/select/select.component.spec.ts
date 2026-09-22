import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SelectComponent, SelectOptionDirective } from './select.component';

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
  const keyCodes = { ArrowDown: 40, Enter: 13, Escape: 27 };
  const key = (el: Element, k: keyof typeof keyCodes) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: k,
        keyCode: keyCodes[k],
        bubbles: true,
        cancelable: true,
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

  it('focuses the filter after the panel has rendered', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      panel()!.querySelector('input.form-control'),
    );
  });

  it('focuses the first option when the panel has no filter', async () => {
    host.filter.set(false);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(panelOptions()[0]);
  });

  it('selects Beta with ArrowDown then Enter after focusing Alpha', async () => {
    trigger().click();
    await fixture.whenStable();
    const listbox = document.querySelector(
      '.cdk-overlay-container .app-select-list',
    ) as HTMLElement;
    listbox.focus();
    expect(document.activeElement).toBe(panelOptions()[0]);
    key(document.activeElement!, 'ArrowDown');
    key(document.activeElement!, 'Enter');
    await fixture.whenStable();
    expect(host.value()).toBe('b');
    expect(panel()).toBeNull();
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
