// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { SelectItem } from 'primeng/api';

/**
 * Extended SelectItem that supports hierarchical tree structures.
 * Used for folder navigation where we want to show the full path from root
 * with the path to the default directory pre-expanded.
 */
export interface HierarchicalSelectItem<T = string> extends SelectItem<T> {
  /** Pre-expand this node in tree view */
  expanded?: boolean;
  /** Nested children for hierarchical response */
  children?: HierarchicalSelectItem<T>[];
  /** Path from root to this item (for building full tree) */
  ancestors?: HierarchicalSelectItem<T>[];
  /** Mark this item as selected/highlighted */
  selected?: boolean;
}
