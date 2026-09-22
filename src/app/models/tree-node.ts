// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

export interface TreeNode<T = unknown> {
  key?: string;
  label?: string;
  data?: T;
  children?: TreeNode<T>[];
  parent?: TreeNode<T>;
  expanded?: boolean;
  leaf?: boolean;
  selectable?: boolean;
  type?: string;
}
