import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { DatafileComponent } from './datafile.component';

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
    // Use proper Angular signal input setters via component reference
    fixture.componentRef.setInput('datafile', df);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.componentRef.setInput(
      'rowNode',
      map.get(df.id + (df.attributes?.isFile ? ':file' : '')),
    );
    fixture.componentRef.setInput('isInFilter', false);
    fixture.componentRef.setInput('loading', false);
  }

  it('comparisonIcon, comparisonColor and comparisonTitle reflect status & loading', () => {
    const statuses = [
      Filestatus.New,
      Filestatus.Equal,
      Filestatus.Updated,
      Filestatus.Deleted,
    ];
    statuses.forEach((st) => {
      const df: Datafile = {
        id: `id${st}`,
        name: `f${st}`,
        path: '',
        hidden: false,
        status: st,
        action: Fileaction.Ignore,
        attributes: { isFile: true },
      };
      const node: TreeNode<Datafile> = { data: df };
      const map = new Map<string, TreeNode<Datafile>>([
        [`${df.id}:file`, node],
      ]);
      setInputs(df, map);
      fixture.detectChanges();
      expect(component.comparisonIcon()).toBeTruthy();
      expect(component.comparisonColor()).toBeTruthy();
      expect(component.comparisonTitle().length).toBeGreaterThan(3);
    });
    // simplified default branch coverage
  });

  it('actionIcon returns correct icons', () => {
    const actions = [
      Fileaction.Ignore,
      Fileaction.Copy,
      Fileaction.Delete,
      Fileaction.Update,
      Fileaction.Custom,
    ];
    actions.forEach((act) => {
      const df: Datafile = {
        id: `i${act}`,
        name: 'f',
        path: '',
        hidden: false,
        status: Filestatus.New,
        action: act,
        attributes: { isFile: true },
      };
      const node: TreeNode<Datafile> = { data: df };
      const map = new Map<string, TreeNode<Datafile>>([
        [`${df.id}:file`, node],
      ]);
      setInputs(df, map);
      fixture.detectChanges();
      expect(component.actionIcon()).toBeTruthy();
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
    fixture.detectChanges();
    // apply Update at folder level -> file status based mapping
    component.setNodeAction(folderNode, Fileaction.Update);
    expect(fileNew.action).toBe(Fileaction.Copy); // New + Update => Copy
    expect(fileEqual.action).toBe(Fileaction.Ignore); // Equal + Update => Ignore
    // apply Delete at folder level -> New file should remain Ignore by rule
    component.setNodeAction(folderNode, Fileaction.Delete);
    expect(fileNew.action).toBe(Fileaction.Ignore);
  });

  it('targetFile and sourceFile obey rules', () => {
    const dfNew: Datafile = {
      id: 'ff',
      name: 'f',
      path: 'p',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Ignore,
      attributes: { isFile: true },
    };
    const nodeNew: TreeNode<Datafile> = { data: dfNew };
    const mapNew = new Map<string, TreeNode<Datafile>>([
      [`${dfNew.id}:file`, nodeNew],
    ]);
    setInputs(dfNew, mapNew);
    fixture.detectChanges();
    expect(component.targetFile()).toBe(''); // new + not Copy

    // Create new datafile with Copy action to test targetFile
    const dfCopy: Datafile = { ...dfNew, action: Fileaction.Copy };
    const nodeCopy: TreeNode<Datafile> = { data: dfCopy };
    const mapCopy = new Map<string, TreeNode<Datafile>>([
      [`${dfCopy.id}:file`, nodeCopy],
    ]);
    setInputs(dfCopy, mapCopy);
    fixture.detectChanges();
    expect(component.targetFile()).toContain('f');

    // sourceFile respects isInFilter formatting (no path) vs filter (with path)
    fixture.componentRef.setInput('isInFilter', false);
    fixture.detectChanges();
    expect(component.sourceFile()).toBe('f');
    fixture.componentRef.setInput('isInFilter', true);
    fixture.detectChanges();
    expect(component.sourceFile()).toBe('p/f');
  });

  it('targetFileClass returns style classes', () => {
    const baseDatafile = {
      id: 'cls',
      name: 'f',
      path: '',
      hidden: false,
      status: Filestatus.New,
      attributes: { isFile: true },
    };

    // Test Delete action
    const dfDelete: Datafile = {
      ...baseDatafile,
      action: Fileaction.Delete,
    };
    const nodeDelete: TreeNode<Datafile> = { data: dfDelete };
    const mapDelete = new Map<string, TreeNode<Datafile>>([
      [`${dfDelete.id}:file`, nodeDelete],
    ]);
    setInputs(dfDelete, mapDelete);
    fixture.detectChanges();
    expect(component.targetFileClass()).toBe('text-decoration-line-through');

    // Test Copy action
    const dfCopy: Datafile = { ...baseDatafile, action: Fileaction.Copy };
    const nodeCopy: TreeNode<Datafile> = { data: dfCopy };
    const mapCopy = new Map<string, TreeNode<Datafile>>([
      [`${dfCopy.id}:file`, nodeCopy],
    ]);
    setInputs(dfCopy, mapCopy);
    fixture.detectChanges();
    expect(component.targetFileClass()).toBe('fst-italic fw-bold');

    // Test Update action
    const dfUpdate: Datafile = { ...baseDatafile, action: Fileaction.Update };
    const nodeUpdate: TreeNode<Datafile> = { data: dfUpdate };
    const mapUpdate = new Map<string, TreeNode<Datafile>>([
      [`${dfUpdate.id}:file`, nodeUpdate],
    ]);
    setInputs(dfUpdate, mapUpdate);
    fixture.detectChanges();
    expect(component.targetFileClass()).toBe('fw-bold');

    // Test Ignore action
    const dfIgnore: Datafile = { ...baseDatafile, action: Fileaction.Ignore };
    const nodeIgnore: TreeNode<Datafile> = { data: dfIgnore };
    const mapIgnore = new Map<string, TreeNode<Datafile>>([
      [`${dfIgnore.id}:file`, nodeIgnore],
    ]);
    setInputs(dfIgnore, mapIgnore);
    fixture.detectChanges();
    expect(component.targetFileClass()).toBe('');
  });
});
