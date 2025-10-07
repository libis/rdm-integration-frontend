import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction } from '../models/datafile';
import { DownladablefileComponent } from './downladablefile.component';

describe('DownladablefileComponent', () => {
  let component: DownladablefileComponent;
  let fixture: ComponentFixture<DownladablefileComponent>;

  const buildTree = () => {
    const root: TreeNode<Datafile> = {
      key: '',
      data: {
        id: '',
        name: '',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [],
    };

    const child: TreeNode<Datafile> = {
      key: 'file1:file',
      data: {
        id: 'file1',
        name: 'README.md',
        path: 'docs',
        hidden: false,
        action: Fileaction.Ignore,
        attributes: { isFile: true },
      } as Datafile,
      children: [],
    };

    root.children!.push(child);

    const map = new Map<string, TreeNode<Datafile>>();
    map.set('', root);
    map.set('file1:file', child);

    return { root, child, map };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownladablefileComponent],
    })
      .overrideComponent(DownladablefileComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DownladablefileComponent);
    component = fixture.componentInstance;
  });

  it('initialises node from row map and exposes helpers', () => {
    const { child, map } = buildTree();
    child.data!.action = Fileaction.Download;
    fixture.componentRef.setInput('datafile', {
      id: 'file1',
      name: 'README.md',
      path: 'docs',
      hidden: false,
      action: Fileaction.Download,
      attributes: { isFile: true },
    });
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.componentRef.setInput('rowNode', child);
    fixture.detectChanges();

    expect(component.node).toBe(child);
    expect(component.action()).toBe(DownladablefileComponent.icon_download);
    expect(component.sourceFile()).toBe('README.md');
  });

  it('toggleAction cycles file actions and updates parent folder', () => {
    const { child, root, map } = buildTree();
    fixture.componentRef.setInput('datafile', child.data);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.componentRef.setInput('rowNode', child);
    fixture.detectChanges();

    expect(child.data?.action).toBe(Fileaction.Ignore);
    component.toggleAction();
    expect(child.data?.action).toBe(Fileaction.Download);
    component.toggleAction();
    expect(child.data?.action).toBe(Fileaction.Ignore);

    // mix actions amongst siblings to force Custom
    const sibling: TreeNode<Datafile> = {
      key: 'file2:file',
      data: {
        id: 'file2',
        name: 'notes.txt',
        path: 'docs',
        hidden: false,
        action: Fileaction.Download,
        attributes: { isFile: true },
      },
      children: [],
    };
    root.children!.push(sibling);

    const aggregated = component.updateFolderActions(root);
    expect(aggregated).toBe(Fileaction.Custom);
    expect(root.data?.action).toBe(Fileaction.Custom);
  });

  it('toggleNodeAction static helper cascades to children', () => {
    const parent: TreeNode<Datafile> = {
      key: 'parent',
      data: {
        id: 'parent',
        name: 'folder',
        path: 'docs',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [
        {
          key: 'child',
          data: {
            id: 'child',
            name: 'file',
            path: 'docs',
            hidden: false,
            action: Fileaction.Ignore,
            attributes: { isFile: true },
          },
          children: [],
        },
      ],
    };

    DownladablefileComponent.toggleNodeAction(parent);
    expect(parent.data?.action).toBe(Fileaction.Download);
    expect(parent.children?.[0].data?.action).toBe(Fileaction.Download);

    DownladablefileComponent.toggleNodeAction(parent);
    expect(parent.data?.action).toBe(Fileaction.Ignore);
    expect(parent.children?.[0].data?.action).toBe(Fileaction.Ignore);
  });
});
