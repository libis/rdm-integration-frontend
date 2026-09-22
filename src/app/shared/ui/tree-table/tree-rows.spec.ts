import { TreeNode } from '../../../models/tree-node';
import { flattenVisibleRows } from './tree-rows';

describe('flattenVisibleRows', () => {
  const tree: TreeNode<string>[] = [
    {
      data: 'a',
      expanded: true,
      children: [
        { data: 'a1' },
        { data: 'a2', expanded: false, children: [{ data: 'a2x' }] },
      ],
    },
    { data: 'b', children: [{ data: 'b1' }] },
    { data: 'c' },
  ];

  it('lists roots and the children of expanded nodes only, with levels', () => {
    expect(flattenVisibleRows(tree).map((r) => [r.node.data, r.level])).toEqual(
      [
        ['a', 0],
        ['a1', 1],
        ['a2', 1],
        ['b', 0],
        ['c', 0],
      ],
    );
  });

  it('follows a toggled node', () => {
    tree[1].expanded = true;
    expect(flattenVisibleRows(tree).map((r) => r.node.data)).toEqual([
      'a',
      'a1',
      'a2',
      'b',
      'b1',
      'c',
    ]);
    tree[1].expanded = false;
  });

  it('returns an empty list for no nodes', () => {
    expect(flattenVisibleRows([])).toEqual([]);
  });
});
