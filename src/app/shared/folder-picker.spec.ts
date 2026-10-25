import { signal } from '@angular/core';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
import { TreeNode } from '../models/tree-node';
import { FolderPicker, updateExpandedNodeChildren } from './folder-picker';
import { createPlaceholderRootOptions } from './tree-utils';

describe('FolderPicker', () => {
  const setup = () => {
    const state = {
      rootOptions: signal<TreeNode<string>[]>(createPlaceholderRootOptions()),
      branchItems: signal<HierarchicalSelectItem<string>[]>([]),
      option: signal<string | undefined>(undefined),
      selectedOption: signal<TreeNode<string> | undefined>(undefined),
      optionsLoading: signal(false),
    };
    return { state, picker: new FolderPicker(state) };
  };

  const home: HierarchicalSelectItem<string>[] = [
    {
      label: '/',
      value: '/',
      expanded: true,
      children: [
        {
          label: 'home',
          value: '/home/',
          expanded: true,
          children: [
            {
              label: 'alice',
              value: '/home/alice/',
              selected: true,
              expanded: true,
              children: [],
            },
          ],
        },
      ],
    },
  ];

  it('puts the first listing in place of the placeholder and selects the node the backend marked', () => {
    const { state, picker } = setup();
    const placeholder = state.rootOptions()[0];
    state.optionsLoading.set(true);
    picker.handleOptionsResponse(home, placeholder);
    expect(state.rootOptions().map((n) => n.data)).toEqual(['/']);
    expect(state.rootOptions()[0].children?.[0].data).toBe('/home/');
    expect(state.branchItems()).toBe(home);
    expect(state.option()).toBe('/home/alice/');
    expect(state.selectedOption()?.data).toBe('/home/alice/');
    expect(state.optionsLoading()).toBeFalse();
    expect(placeholder.children).toBeUndefined();
  });

  it('takes a first listing asked without a node the same way', () => {
    const { state, picker } = setup();
    picker.handleOptionsResponse(home);
    expect(state.rootOptions()[0].data).toBe('/');
    expect(state.option()).toBe('/home/alice/');
  });

  it('never selects the root by itself', () => {
    const { state, picker } = setup();
    picker.handleOptionsResponse(
      [
        {
          label: '/',
          value: '/',
          children: [{ label: 'pub', value: '/pub/' }],
        },
      ],
      state.rootOptions()[0],
    );
    expect(state.rootOptions()[0].data).toBe('/');
    expect(state.option()).toBeUndefined();
    expect(state.selectedOption()).toBeUndefined();
  });

  it('lists the children of an expanded folder in a new tree and keeps the rest', () => {
    const { state, picker } = setup();
    picker.handleOptionsResponse([
      { label: '/', value: '/' },
      { label: 'tmp', value: '/tmp/' },
    ]);
    const before = state.rootOptions();
    const root = before[0];
    state.optionsLoading.set(true);
    picker.handleOptionsResponse(
      [
        { label: 'home', value: '/home/' },
        { label: 'srv', value: '/srv/', selected: true },
      ],
      root,
    );
    const after = state.rootOptions();
    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(root);
    expect(after[0].children?.map((n) => n.data)).toEqual(['/home/', '/srv/']);
    expect(after[1]).toBe(before[1]);
    // The node of the event gets the children too.
    expect(root.children).toBe(after[0].children);
    expect(state.option()).toBe('/srv/');
    expect(state.optionsLoading()).toBeFalse();
  });

  it('gives the tree a new array when the expanded folder is not in it', () => {
    const { state, picker } = setup();
    picker.handleOptionsResponse([{ label: '/', value: '/' }]);
    const before = state.rootOptions();
    const detached: TreeNode<string> = { label: 'gone', data: '/gone/' };
    picker.handleOptionsResponse([{ label: 'x', value: '/gone/x/' }], detached);
    expect(state.rootOptions()).not.toBe(before);
    expect(state.rootOptions()).toEqual(before);
    expect(detached.children?.map((n) => n.data)).toEqual(['/gone/x/']);
  });

  it('stops loading and selects nothing on an empty listing', () => {
    const { state, picker } = setup();
    const before = state.rootOptions();
    state.branchItems.set([{ label: 'Loading...', value: 'loading' }]);
    picker.handleOptionsResponse([]);
    expect(state.branchItems()).toEqual([]);
    expect(state.rootOptions()).toBe(before);
    // The placeholder expanded: it stays, without children.
    state.optionsLoading.set(true);
    picker.handleOptionsResponse([], before[0]);
    expect(state.optionsLoading()).toBeFalse();
    expect(state.rootOptions()[0].label).toBe('Expand and select');
    expect(state.rootOptions()[0].children).toEqual([]);
    expect(state.option()).toBeUndefined();
    expect(state.selectedOption()).toBeUndefined();
  });

  it('keeps the selection when an expanded folder lists nothing', () => {
    const { state, picker } = setup();
    picker.handleOptionsResponse(home);
    const alice = state.selectedOption()!;
    picker.handleOptionsResponse([], alice);
    expect(state.option()).toBe('/home/alice/');
    expect(state.selectedOption()).toBe(alice);
    expect(alice.children).toEqual([]);
  });

  it('goes back to the placeholder with nothing listed and nothing selected', () => {
    const { state, picker } = setup();
    picker.handleOptionsResponse(home);
    state.optionsLoading.set(true);
    const listed = state.rootOptions();
    picker.reset();
    expect(state.rootOptions()).not.toBe(listed);
    expect(state.rootOptions()).toEqual(createPlaceholderRootOptions());
    expect(state.branchItems()).toEqual([]);
    expect(state.option()).toBeUndefined();
    expect(state.selectedOption()).toBeUndefined();
    // A listing under way keeps its spinner.
    expect(state.optionsLoading()).toBeTrue();
  });

  it('selects any folder, the root included, and unselecting clears the path', () => {
    const { state, picker } = setup();
    const root: TreeNode<string> = { label: '/', data: '/' };
    picker.optionSelected(root);
    expect(state.option()).toBe('/');
    expect(state.selectedOption()).toBe(root);
    picker.optionSelected({ label: '', data: '' });
    expect(state.option()).toBe('');
    picker.optionSelected(undefined);
    expect(state.option()).toBeUndefined();
    expect(state.selectedOption()).toBeUndefined();
    picker.optionSelected(root);
    picker.optionSelected({ label: 'x' });
    expect(state.option()).toBeUndefined();
    picker.optionSelected(root);
    picker.optionSelected([root]);
    expect(state.option()).toBeUndefined();
    picker.optionSelected(root);
    picker.optionSelected(null);
    expect(state.selectedOption()).toBeUndefined();
  });
});

describe('updateExpandedNodeChildren', () => {
  it('replaces the children of the node with the same data and label', () => {
    const tree: TreeNode<string>[] = [
      { label: 'x', data: '/x/', children: [] },
      { label: 'a', data: '/a/', children: [{ label: 'b', data: '/a/b/' }] },
    ];
    const children = [{ label: 'c', data: '/a/b/c/' }];
    const hit = updateExpandedNodeChildren(
      tree,
      { label: 'b', data: '/a/b/' },
      children,
    );
    expect(hit.found).toBeTrue();
    expect(hit.tree[0]).toBe(tree[0]);
    expect(hit.tree[1]).not.toBe(tree[1]);
    expect(hit.tree[1].children?.[0].children).toBe(children);
    expect(tree[1].children?.[0].children).toBeUndefined();
  });

  it('matches the node itself and reports a miss', () => {
    const target: TreeNode<string> = { label: 'same', data: '/same/' };
    const hit = updateExpandedNodeChildren([target], target, []);
    expect(hit.found).toBeTrue();
    expect(hit.tree[0].children).toEqual([]);
    const miss = updateExpandedNodeChildren(
      [target],
      { label: 'other', data: '/same/' },
      [],
    );
    expect(miss.found).toBeFalse();
    expect(miss.tree[0]).toBe(target);
  });
});
