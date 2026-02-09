// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
import {
  convertToTreeNodes,
  createDefaultRootOptions,
  createPlaceholderRootOptions,
} from './tree-utils';

describe('tree-utils', () => {
  describe('createDefaultRootOptions', () => {
    it('should create default root options with "/" label', () => {
      const options = createDefaultRootOptions();
      expect(options.length).toBe(1);
      expect(options[0].label).toBe('/');
      expect(options[0].data).toBe('/');
      expect(options[0].leaf).toBe(false);
      expect(options[0].selectable).toBe(true);
      expect(options[0].expanded).toBe(false);
    });
  });

  describe('createPlaceholderRootOptions', () => {
    it('should create placeholder root options', () => {
      const options = createPlaceholderRootOptions();
      expect(options.length).toBe(1);
      expect(options[0].label).toBe('Expand and select');
      expect(options[0].data).toBe('');
      expect(options[0].leaf).toBe(false);
      expect(options[0].selectable).toBe(true);
    });
  });

  describe('convertToTreeNodes', () => {
    it('should convert flat items to tree nodes', () => {
      const items: HierarchicalSelectItem<string>[] = [
        { label: 'Folder A', value: '/a' },
        { label: 'Folder B', value: '/b' },
      ];
      const result = convertToTreeNodes(items);

      expect(result.treeNodes.length).toBe(2);
      expect(result.treeNodes[0].label).toBe('Folder A');
      expect(result.treeNodes[0].data).toBe('/a');
      expect(result.treeNodes[1].label).toBe('Folder B');
      expect(result.treeNodes[1].data).toBe('/b');
      expect(result.selectedNode).toBeUndefined();
    });

    it('should handle nested children', () => {
      const items: HierarchicalSelectItem<string>[] = [
        {
          label: 'Parent',
          value: '/parent',
          expanded: true,
          children: [{ label: 'Child', value: '/parent/child' }],
        },
      ];
      const result = convertToTreeNodes(items);

      expect(result.treeNodes.length).toBe(1);
      expect(result.treeNodes[0].children?.length).toBe(1);
      expect(result.treeNodes[0].children?.[0].label).toBe('Child');
      expect(result.treeNodes[0].expanded).toBe(true);
    });

    it('should detect selected node', () => {
      const items: HierarchicalSelectItem<string>[] = [
        { label: 'Folder A', value: '/a' },
        { label: 'Folder B', value: '/b', selected: true },
      ];
      const result = convertToTreeNodes(items);

      expect(result.selectedNode).toBeDefined();
      expect(result.selectedNode?.data).toBe('/b');
    });

    it('should propagate selected node from nested children', () => {
      const items: HierarchicalSelectItem<string>[] = [
        {
          label: 'Parent',
          value: '/parent',
          children: [
            { label: 'Child', value: '/parent/child', selected: true },
          ],
        },
      ];
      const result = convertToTreeNodes(items);

      expect(result.selectedNode).toBeDefined();
      expect(result.selectedNode?.data).toBe('/parent/child');
    });
  });
});
