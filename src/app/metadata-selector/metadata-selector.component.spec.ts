import { Location } from '@angular/common';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ComponentFixture,
  fakeAsync,
  flushMicrotasks,
  TestBed,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { DatasetService } from '../dataset.service';
import { MetadatafieldComponent } from '../metadatafield/metadatafield.component';
import {
  Field,
  Fieldaction,
  FieldDictonary,
  Metadata,
  MetadataField,
} from '../models/field';
import { MetadataSelectorComponent } from './metadata-selector.component';

describe('MetadataSelectorComponent', () => {
  let component: MetadataSelectorComponent;
  let fixture: ComponentFixture<MetadataSelectorComponent>;
  let routerNavigateSpy: jasmine.Spy;
  // Removed unused locationBackSpy variable to satisfy lint

  // Build a realistic metadata response with primitive, array, and compound fields
  const makeMetadata = (): Metadata => {
    const title: MetadataField = {
      typeName: 'title',
      typeClass: 'primitive' as any,
      multiple: false,
      value: 'My Dataset',
    } as any;
    const keyword: MetadataField = {
      typeName: 'keyword',
      typeClass: 'primitive' as any,
      multiple: true,
      value: ['science', 'data'],
    } as any;
    const author1: FieldDictonary = {
      authorName: {
        typeName: 'authorName',
        typeClass: 'primitive' as any,
        multiple: false,
        value: 'Alice',
      } as any,
      authorAffiliation: {
        typeName: 'authorAffiliation',
        typeClass: 'primitive' as any,
        multiple: false,
        value: 'KU Leuven',
      } as any,
    };
    const author2: FieldDictonary = {
      authorName: {
        typeName: 'authorName',
        typeClass: 'primitive' as any,
        multiple: false,
        value: 'Bob',
      } as any,
      authorAffiliation: {
        typeName: 'authorAffiliation',
        typeClass: 'primitive' as any,
        multiple: false,
        value: 'UAntwerpen',
      } as any,
    };
    const authorField: MetadataField = {
      typeName: 'author',
      typeClass: 'compound' as any,
      multiple: true,
      value: [author1, author2],
    } as any;
    const metadata: Metadata = {
      datasetVersion: {
        metadataBlocks: {
          citation: {
            displayName: 'Citation',
            name: 'citation',
            fields: [title, keyword, authorField],
          },
        },
      },
    } as any;
    return metadata;
  };

  beforeEach(async () => {
    const routerStub = {
      navigate: jasmine.createSpy('navigate'),
    } as unknown as Router;
    const datasetStub = {
      newDataset: () => of({ persistentId: 'doi:10.1234/created' }),
      getMetadata: () => of(makeMetadata()),
    } as unknown as DatasetService;
    const locationStub = { back: jasmine.createSpy('back') } as any as Location;
    await TestBed.configureTestingModule({
      imports: [MetadataSelectorComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
        { provide: DatasetService, useValue: datasetStub },
        { provide: Location, useValue: locationStub },
      ],
    })
      // Keep template as-is; component uses PrimeNG lightweightly
      .compileComponents();

    fixture = TestBed.createComponent(MetadataSelectorComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
    // Accessing Location back spy not needed for current expectations
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to submit with metadata in state when submitting', async () => {
    await component.submit();
    expect(routerNavigateSpy).toHaveBeenCalled();
    const args = (routerNavigateSpy.calls.mostRecent().args || []) as any[];
    expect(args[0]).toEqual(['/submit']);
    expect(args[1]).toBeDefined();
    expect(args[1].state).toBeDefined();
    // metadata can be undefined if metadata hasn't loaded yet; we only assert the shape
    expect(
      Object.prototype.hasOwnProperty.call(args[1].state, 'metadata'),
    ).toBeTrue();
  });

  it('should load metadata and build tree map', fakeAsync(() => {
    // ngOnInit already called; wait for async loadData to complete
    flushMicrotasks();
    fixture.detectChanges();
    expect(component.metadata).toBeTruthy();
    expect(component.root).toBeTruthy();
    expect(component.rootNodeChildren.length).toBeGreaterThan(0);
    // Expect names contain title, keyword, author
    const names = component.rootNodeChildren.map((n) => n.data?.name);
    expect(names).toContain('title');
    expect(names).toContain('keyword');
    expect(names).toContain('author');
    // Row map should have entries for all nodes
    expect(component.rowNodeMap.size).toBeGreaterThan(3);
  }));

  it('rowClass should reflect Fieldaction values', () => {
    const base: Field = {
      id: 'x',
      parent: '',
      name: 'f',
      action: Fieldaction.Ignore,
    };
    expect(component.rowClass({ ...base, action: Fieldaction.Ignore })).toBe(
      '',
    );
    expect(component.rowClass({ ...base, action: Fieldaction.Copy })).toBe(
      'copy-row',
    );
    expect(component.rowClass({ ...base, action: Fieldaction.Custom })).toBe(
      'custom-row',
    );
  });

  it('should apply CSS classes to rows for highlighting', fakeAsync(() => {
    flushMicrotasks();
    fixture.detectChanges();
    // query all table row elements within the component template
    const rows: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('tr.copy-row, tr.custom-row'),
    );
    // We expect at least one highlighted row (root children default to Copy)
    expect(rows.length).toBeGreaterThan(0);
    // Ensure they actually carry either copy-row or custom-row class
    const hasCopy = rows.some((r) => r.classList.contains('copy-row'));
    expect(hasCopy).toBeTrue();
  }));

  it('action() and toggleAction() should delegate to MetadatafieldComponent', () => {
    // prepare a fake root and spy on static methods
    const root: any = { data: { name: 'root' } };
    component.root = root;
    const iconSpy = spyOn(MetadatafieldComponent, 'actionIcon').and.returnValue(
      'icon-x',
    );
    const toggleSpy = spyOn(MetadatafieldComponent, 'toggleNodeAction');
    expect(component.action()).toBe('icon-x');
    component.toggleAction();
    expect(iconSpy).toHaveBeenCalledWith(root);
    expect(toggleSpy).toHaveBeenCalledWith(root);
  });

  it('filteredMetadata should return all fields by default', fakeAsync(() => {
    flushMicrotasks();
    fixture.detectChanges();
    const fm = component.filteredMetadata();
    expect(fm).toBeTruthy();
    const fields = fm!.datasetVersion.metadataBlocks.citation.fields;
    expect(fields.find((f) => f.typeName === 'title')!.value).toBe(
      'My Dataset',
    );
    expect(
      (fields.find((f) => f.typeName === 'keyword')!.value as string[]).length,
    ).toBe(2);
    expect(
      (fields.find((f) => f.typeName === 'author')!.value as any[]).length,
    ).toBe(2);
  }));

  it('filteredMetadata should prune ignored primitive and nested values', fakeAsync(() => {
    flushMicrotasks();
    fixture.detectChanges();
    // Ignore the title node
    const titleNode = Array.from(component.rowNodeMap.values()).find(
      (n) => n.data?.name === 'title',
    );
    expect(titleNode).toBeTruthy();
    if (titleNode && titleNode.data) {
      titleNode.data.action = Fieldaction.Ignore;
    }
    // For compound author, remove one dictionary completely by ignoring all its children
    const authorNameNodes = Array.from(component.rowNodeMap.values()).filter(
      (n) => n.data?.name === 'authorName',
    );
    expect(authorNameNodes.length).toBeGreaterThan(0);
    const parentId = authorNameNodes[0].data!.parent!;
    // Ignore all children under this parent (e.g., authorName and authorAffiliation)
    Array.from(component.rowNodeMap.values())
      .filter((n) => n.data?.parent === parentId)
      .forEach((n) => (n.data!.action = Fieldaction.Ignore));

    const fm = component.filteredMetadata();
    expect(fm).toBeTruthy();
    const fields = fm!.datasetVersion.metadataBlocks.citation.fields;
    // Title should be removed
    expect(fields.find((f) => f.typeName === 'title')).toBeUndefined();
    // Author list should be smaller than original
    const authors = fields.find((f) => f.typeName === 'author')!.value as any[];
    expect(authors.length).toBe(1);
  }));

  it('submit should navigate with populated metadata once loaded', fakeAsync(() => {
    flushMicrotasks();
    fixture.detectChanges();
    component.submit();
    const args = (routerNavigateSpy.calls.mostRecent().args || []) as any[];
    expect(args[0]).toEqual(['/submit']);
    const state = args[1]?.state;
    expect(state).toBeDefined();
    expect(state.metadata).toBeDefined();
    const fields = state.metadata.datasetVersion.metadataBlocks.citation.fields;
    expect(fields.length).toBeGreaterThan(0);
  }));

  it('back should navigate to compare with dataset id state', () => {
    component.back();
    expect(routerNavigateSpy).toHaveBeenCalled();
    const args = (routerNavigateSpy.calls.mostRecent().args || []) as any[];
    expect(args[0][0]).toBe('/compare');
    expect(args[1]?.state?.preserveCompare).toBeTrue();
  });
});
