/**
 * Guard the shacl-form implementation so that multi-value blank nodes remain visible even when
 * nested nodes currently violate their shape (e.g., missing required fields). Without this guard
 * the component drops every value after validation and users cannot fix the data.
 */
import '@ulb-darmstadt/shacl-form';

interface ShaclPropertyPrototype extends HTMLElement {
  template?: { qualifiedValueShape?: unknown };
  filterValidValues?: (
    values: unknown[],
    subject: unknown,
  ) => Promise<unknown[]>;
}

const shaclPropertyCtor = customElements.get(
  'shacl-property',
) as CustomElementConstructor & {
  __rdmFilterGuardApplied?: boolean;
};

if (shaclPropertyCtor && !shaclPropertyCtor.__rdmFilterGuardApplied) {
  const prototype =
    shaclPropertyCtor.prototype as unknown as ShaclPropertyPrototype;

  const originalFilter = prototype.filterValidValues;

  if (typeof originalFilter === 'function') {
    prototype.filterValidValues = async function (
      this: ShaclPropertyPrototype,
      values: unknown[],
      subject: unknown,
    ) {
      if (!this?.template?.qualifiedValueShape) {
        return values;
      }

      return originalFilter.call(this, values, subject);
    };
  }

  shaclPropertyCtor.__rdmFilterGuardApplied = true;
}
