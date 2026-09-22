// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

export interface SelectItem<T = unknown> {
  label?: string;
  value: T;
  disabled?: boolean;
  title?: string;
}
