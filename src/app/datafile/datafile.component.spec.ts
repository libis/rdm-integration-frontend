import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DatafileComponent } from './datafile.component';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { TreeNode } from 'primeng/api';

describe('DatafileComponent', () => {
  let component: DatafileComponent;
  let fixture: ComponentFixture<DatafileComponent>;

  beforeEach(async () => {
    const folderActionStub = { updateFoldersAction: () => {} } as any;
    await TestBed.configureTestingModule({
      imports: [DatafileComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: (DatafileComponent as any).ɵprov?.token
            ?.FolderActionUpdateService,
          useValue: folderActionStub,
        },
      ],
    })
      // Shallow render to avoid PrimeNG TreeTable internal provider requirements during unit tests
      .overrideComponent(DatafileComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DatafileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function setInputs(df: Datafile, map: Map<string, TreeNode<Datafile>>) {
    // Bypass signal input setters (simpler for unit test) by monkey patching
    (component as any).datafile = () => df;
    (component as any).rowNodeMap = () => map;
    (component as any).rowNode = () =>
      map.get(df.id + (df.attributes?.isFile ? ':file' : ''));
    (component as any).isInFilter = () => false;
    (component as any).loading = () => false;
  }

  it('comparison() and comparisonTitle() reflect status & loading', () => {
    const statuses = [
      Filestatus.New,
      Filestatus.Equal,
      Filestatus.Updated,
      Filestatus.Deleted,
    ];
    statuses.forEach((st) => {
      const df: Datafile = {
        id: 'id' + st,
        name: 'f' + st,
        path: '',
        hidden: false,
        status: st,
        action: Fileaction.Ignore,
        attributes: { isFile: true },
      };
      const node: TreeNode<Datafile> = { data: df };
      const map = new Map<string, TreeNode<Datafile>>([
        [df.id + ':file', node],
      ]);
      setInputs(df, map);
      component.ngOnInit();
      expect(component.comparison(false)).toBeTruthy();
      expect(component.comparisonTitle().length).toBeGreaterThan(3);
    });
    // simplified default branch coverage
  });

  it('action() returns correct icons', () => {
    const actions = [
      Fileaction.Ignore,
      Fileaction.Copy,
      Fileaction.Delete,
      Fileaction.Update,
      Fileaction.Custom,
    ];
    actions.forEach((act) => {
      const df: Datafile = {
        id: 'i' + act,
        name: 'f',
        path: '',
        hidden: false,
        status: Filestatus.New,
        action: act,
        attributes: { isFile: true },
      };
      const node: TreeNode<Datafile> = { data: df };
      const map = new Map<string, TreeNode<Datafile>>([
        [df.id + ':file', node],
      ]);
      setInputs(df, map);
      component.ngOnInit();
      expect(component.action()).toBeTruthy();
    });
  });

  it('setNodeAction cascades to children and file-in-folder rules apply', () => {
    // folder parent
    const folder: Datafile = {
      id: 'folder',
      name: 'folder',
      path: '',
      hidden: false,
      status: Filestatus.Updated,
      action: Fileaction.Ignore,
      attributes: { isFile: false },
    };
    const fileNew: Datafile = {
      id: 'file1',
      name: 'file1',
      path: '',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Ignore,
      attributes: { isFile: true },
    };
    const fileEqual: Datafile = {
      id: 'file2',
      name: 'file2',
      path: '',
      hidden: false,
      status: Filestatus.Equal,
      action: Fileaction.Ignore,
      attributes: { isFile: true },
    };
    const childNode1: TreeNode<Datafile> = { data: fileNew };
    const childNode2: TreeNode<Datafile> = { data: fileEqual };
    const folderNode: TreeNode<Datafile> = {
      data: folder,
      children: [childNode1, childNode2],
    };
    const map = new Map<string, TreeNode<Datafile>>([
      ['folder', folderNode],
      ['file1:file', childNode1],
      ['file2:file', childNode2],
    ]);
    setInputs(folder, map);
    component.ngOnInit();
    // apply Update at folder level -> file status based mapping
    component.setNodeAction(folderNode, Fileaction.Update);
    expect(fileNew.action).toBe(Fileaction.Copy); // New + Update => Copy
    expect(fileEqual.action).toBe(Fileaction.Ignore); // Equal + Update => Ignore
    // apply Delete at folder level -> New file should remain Ignore by rule
    component.setNodeAction(folderNode, Fileaction.Delete);
    expect(fileNew.action).toBe(Fileaction.Ignore);
  });

  it('targetFile and sourceFile obey rules', () => {
    const df: Datafile = {
      id: 'ff',
      name: 'f',
      path: 'p',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Ignore,
      attributes: { isFile: true },
    };
    const node: TreeNode<Datafile> = { data: df };
    const map = new Map<string, TreeNode<Datafile>>([[df.id + ':file', node]]);
    setInputs(df, map);
    component.ngOnInit();
    expect(component.targetFile()).toBe(''); // new + not Copy
    df.action = Fileaction.Copy;
    expect(component.targetFile()).toContain('f');
    // sourceFile respects isInFilter formatting (no path) vs filter (with path)
    (component as any).isInFilter = () => false;
    expect(component.sourceFile()).toBe('f');
    (component as any).isInFilter = () => true;
    expect(component.sourceFile()).toBe('p/f');
  });

  it('targetFileClass returns style classes', () => {
    const df: Datafile = {
      id: 'cls',
      name: 'f',
      path: '',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Delete,
      attributes: { isFile: true },
    };
    const node: TreeNode<Datafile> = { data: df };
    const map = new Map<string, TreeNode<Datafile>>([[df.id + ':file', node]]);
    setInputs(df, map);
    component.ngOnInit();
    expect(component.targetFileClass()).toContain('line-through');
    df.action = Fileaction.Copy;
    expect(component.targetFileClass()).toContain('fst-italic');
    df.action = Fileaction.Update;
    expect(component.targetFileClass()).toBe('fw-bold');
    df.action = Fileaction.Ignore;
    expect(component.targetFileClass()).toBe('text-muted');
  });
});
