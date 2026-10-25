/* istanbul ignore file */
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

// Drives an app-select through the DOM, as a user does: its trigger, the
// filter of its open panel and an option of its list. The panel is in the CDK
// overlay container at the end of the body.

/** Opens the select with this inputId: its trigger, or the button of an editable one. */
export function openSelect(host: HTMLElement, inputId: string): void {
  const trigger = host.querySelector(`#${inputId}`) as HTMLElement;
  const button =
    trigger instanceof HTMLButtonElement
      ? trigger
      : trigger.parentElement!.querySelector('button')!;
  button.click();
}

/** Types the text into the filter of the open panel, one letter at a time. */
export function typeInSelectFilter(text: string): void {
  const filter = document.querySelector(
    '.cdk-overlay-container input[placeholder="Filter"]',
  ) as HTMLInputElement;
  for (let i = 1; i <= text.length; i++) {
    filter.value = text.slice(0, i);
    filter.dispatchEvent(new Event('input'));
  }
}

/** Clicks the option of the open panel whose text contains the label. */
export function pickSelectOption(label: string): void {
  const option = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.cdk-overlay-container .app-select-option',
    ),
  ).find((o) => o.textContent!.includes(label));
  if (!option) throw new Error(`no option "${label}" in the select panel`);
  option.click();
}
