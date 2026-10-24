// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import {
  CdkListbox,
  CdkOption,
  ListboxValueChangeEvent,
} from '@angular/cdk/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectItem } from '../../../models/select-item';

let nextListId = 0;

@Directive({ selector: 'ng-template[appSelectOption]' })
export class SelectOptionDirective {
  constructor(
    readonly template: TemplateRef<{ $implicit: SelectItem<string> }>,
  ) {}
}

@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkListbox,
    CdkOption,
    NgTemplateOutlet,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  readonly options = input.required<SelectItem<string>[]>();
  readonly placeholder = input('');
  readonly filter = input(false);
  readonly editable = input(false);
  readonly disabled = input(false);
  readonly inputId = input<string | undefined>(undefined);

  readonly opened = output<void>();
  readonly filterChange = output<string>();
  readonly valueChange = output<string | undefined>();

  readonly optionTemplate = contentChild(SelectOptionDirective);
  /** The text input in editable mode, the select button otherwise. */
  readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
  /** The button that opens the panel in editable mode. */
  readonly toggleButton = viewChild<ElementRef<HTMLElement>>('toggleButton');
  readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  readonly listbox = viewChild(CdkListbox);
  readonly list = viewChild<ElementRef<HTMLElement>>('list');
  readonly listOptions = viewChildren<CdkOption<string>>(CdkOption);
  private readonly renderInjector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly listId = `app-select-list-${nextListId++}`;
  /** The name of the list: the label of the trigger, else the placeholder. */
  readonly listLabel = signal('Options');

  /** The form value. May be free text in editable mode. */
  readonly value = signal<string | undefined>(undefined);
  readonly open = signal(false);
  readonly filterText = signal('');
  readonly cvaDisabled = signal(false);

  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  /** Only values that exist in options reach the listbox; anything else would make it throw. */
  readonly listValue = computed<readonly string[]>(() => {
    const v = this.value();
    return v !== undefined && this.options().some((o) => o.value === v)
      ? [v]
      : [];
  });
  readonly selectedLabel = computed(() => {
    const v = this.value();
    if (v === undefined || v === null || v === '') return undefined;
    return this.options().find((o) => o.value === v)?.label ?? String(v);
  });
  readonly visibleOptions = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    if (!text) return this.options();
    return this.options().filter((o) =>
      (o.label ?? String(o.value)).toLowerCase().includes(text),
    );
  });

  private onChange: (v: string | undefined) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Focus stays on the list and the active option is its
    // aria-activedescendant, so replacing the options (a loading item by the
    // result, search results) cannot drop focus to the body. The active option
    // may go with the old options; the list then activates another one.
    effect(() => {
      this.visibleOptions();
      afterNextRender(
        () => {
          if (this.open() && document.activeElement === this.listElement()) {
            this.onListFocus();
          }
        },
        { injector: this.renderInjector },
      );
    });
  }

  writeValue(value: string | undefined | null): void {
    this.value.set(value ?? undefined);
  }
  registerOnChange(fn: (v: string | undefined) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
  }

  toggle(): void {
    if (this.isDisabled()) return;
    if (this.open()) this.close();
    else this.show();
  }

  show(): void {
    if (this.open()) return;
    this.listLabel.set(this.triggerLabel() || this.placeholder() || 'Options');
    this.open.set(true);
    this.opened.emit();
    afterNextRender(
      () => {
        if (!this.open()) return;
        const filterInput = this.filterInput();
        if (filterInput) filterInput.nativeElement.focus();
        else this.listbox()?.focus();
      },
      { injector: this.renderInjector },
    );
  }

  close(): void {
    // The panel is destroyed with the focused filter or list in it, which
    // would drop keyboard focus to the body. Hand it back to the trigger
    // before that happens, unless the user has already moved elsewhere.
    this.closePanel(this.focusIsLost());
  }

  private closePanel(restoreFocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.filterText.set('');
    this.onTouched();
    if (restoreFocus) this.trigger()?.nativeElement.focus();
  }

  /** The text of the label elements of the trigger (label for="inputId"). */
  private triggerLabel(): string {
    const el = this.trigger()?.nativeElement as
      HTMLButtonElement | HTMLInputElement | undefined;
    return Array.from(el?.labels ?? [], (l) => l.textContent?.trim() ?? '')
      .filter((text) => text !== '')
      .join(' ');
  }

  private focusIsLost(): boolean {
    const active = document.activeElement;
    return (
      active === null ||
      active === document.body ||
      (this.panel()?.nativeElement.contains(active) ?? false)
    );
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'Tab') {
      this.onPanelTab(event);
    } else if (
      event.key === 'ArrowDown' &&
      event.target === this.filterInput()?.nativeElement
    ) {
      // From the filter into the list, where onListFocus activates an option.
      event.preventDefault();
      this.listbox()?.focus();
    } else if (
      (event.key === 'Enter' || event.key === ' ') &&
      this.listElement()?.contains(event.target as Node)
    ) {
      const active = this.listOptions().find((o) => o.isActive());
      if (active && !active.disabled && active.value === this.value()) {
        this.close();
      }
    }
  }

  // The panel sits at the end of the document, so Tab from the list, or
  // Shift+Tab from the first stop of the panel (or from the panel itself,
  // focused by a click on its padding), would leave the select for the body or
  // the far end of the page. Like a native select, the panel closes and the
  // browser moves on from the select itself: from the trigger, or forwards
  // from the options button in editable mode.
  private onPanelTab(event: KeyboardEvent): void {
    const filter = this.filterInput()?.nativeElement;
    const inList = this.listElement()?.contains(event.target as Node) ?? false;
    const leaves = event.shiftKey
      ? event.target === this.panel()?.nativeElement ||
        event.target === filter ||
        (inList && !filter)
      : inList;
    if (!leaves) return;
    const from =
      !event.shiftKey && this.editable() ? this.toggleButton() : this.trigger();
    from?.nativeElement.focus();
    this.closePanel(false);
  }

  // Focus that moves from the panel to an element outside the select closes
  // the panel and stays where it went. Focus that goes nowhere (the window
  // loses focus) leaves it open; a click on the padding of the panel focuses
  // the panel itself (tabindex -1), and a click outside lands on the backdrop,
  // which closes it.
  onPanelFocusout(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (
      !(next instanceof Node) ||
      this.panel()?.nativeElement.contains(next) ||
      this.host.nativeElement.contains(next)
    ) {
      return;
    }
    this.closePanel(false);
  }

  /** With focus on the list, the selected option is active, else the first. */
  onListFocus(): void {
    const listbox = this.listbox();
    const options = this.listOptions();
    if (!listbox || options.some((o) => o.isActive())) return;
    const next =
      options.find((o) => !o.disabled && o.value === this.value()) ??
      options.find((o) => !o.disabled);
    if (next) listbox._setActiveOption(next);
  }

  private listElement(): HTMLElement | undefined {
    return this.list()?.nativeElement;
  }

  // The listbox emits no change when the selected option is activated again
  // (by click here, by Enter or Space in onPanelKeydown), so the panel closes
  // here; a pick of another option closes it in pick.
  onOptionClick(option: SelectItem<string>): void {
    if (!option.disabled && option.value === this.value()) this.close();
  }

  onFilterInput(text: string): void {
    this.filterText.set(text);
    this.filterChange.emit(text);
  }

  onEditableInput(text: string): void {
    this.value.set(text);
    this.onChange(text);
    this.valueChange.emit(text);
  }

  onListChange(event: ListboxValueChangeEvent<string>): void {
    const selected = event.value[0];
    if (selected === undefined) return;
    this.pick(selected);
  }

  pick(selected: string): void {
    this.value.set(selected);
    this.onChange(selected);
    this.valueChange.emit(selected);
    this.close();
  }

  optionLabel(option: SelectItem<string>): string {
    return option.label ?? String(option.value);
  }
}
