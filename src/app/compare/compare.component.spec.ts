import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CompareComponent } from './compare.component';
import { Router } from '@angular/router';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';

describe('CompareComponent', () => {
  let component: CompareComponent;
  let fixture: ComponentFixture<CompareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('back() navigates to /connect and persists snapshot to storage', () => {
    const router = TestBed.inject(Router);
    const snapshotService = TestBed.inject(SnapshotStorageService);
    const navigateSpy = spyOn(router, 'navigate');
    const mergeSpy = spyOn(snapshotService, 'mergeConnect');
    // Ensure no breadcrumb state from prior tests
    if (window && window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '/');
    }
    (component as any).credentialsService = {
      credentials: { dataset_id: 'doi:10.777/TEST' },
    };
    component['data'] = { id: 'doiFallback' } as any;
    component.back();
    expect(mergeSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ dataset_id: 'doi:10.777/TEST' }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/connect']);
  });

  it('back() navigates to metadata-selector when history.state.fromMetadata is set', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    (component as any).credentialsService = {
      credentials: { dataset_id: 'doi:10.X/TEST' },
    };
    component['data'] = { id: 'doi:10.X/TEST' } as any;
    // Simulate breadcrumb left by metadata-selector -> compare transition
    window.history.pushState({ fromMetadata: true }, '', '/');
    component.back();
    expect(navigateSpy).toHaveBeenCalledWith(['/metadata-selector'], {
      state: { fromCompare: true },
    });
  });

  it('submit() navigates to metadata-selector with state when new dataset path', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    // Stub required services/fields for submit()
    (component as any).dataStateService = {
      updateState: jasmine.createSpy('updateState'),
    };
    (component as any).credentialsService = {
      credentials: { newly_created: true },
    };
    component['data'] = { id: '' } as any; // new dataset heuristic
    component.submit();
    expect(navigateSpy).toHaveBeenCalled();
    const args = (navigateSpy.calls.mostRecent().args || []) as any[];
    expect(args[0]).toEqual(['/metadata-selector']);
    expect(args[1]?.state?.fromCompare).toBeTrue();
  });

  describe('canProceed() logic', () => {
    function setCreds(creds: any) {
      (component as any).credentialsService = { credentials: creds };
    }
    function addFileSelection() {
      // simulate one selected file node with non-Ignore action
      (component as any).rowNodeMap.set('file1', {
        data: { attributes: { isFile: true }, action: 1 },
      } as any);
    }

    beforeEach(() => {
      (component as any).rowNodeMap = new Map();
    });

    it('non-new dataset requires selection', () => {
      setCreds({ newly_created: false });
      component['data'] = { id: 'doi:10/EXISTING' } as any;
      expect(component.canProceed()).toBeFalse();
      addFileSelection();
      expect(component.canProceed()).toBeTrue();
    });

    it('new dataset with metadata_available true can proceed without selection', () => {
      setCreds({ newly_created: true, metadata_available: true });
      component['data'] = { id: '' } as any; // new dataset scenario
      expect(component.canProceed()).toBeTrue();
    });

    it('new dataset without metadata_available requires selection', () => {
      setCreds({ newly_created: true, metadata_available: false });
      component['data'] = { id: '' } as any;
      expect(component.canProceed()).toBeFalse();
      addFileSelection();
      expect(component.canProceed()).toBeTrue();
    });

    it('proceedTitle reflects metadata-only vs blocked states', () => {
      // Blocked: new dataset, no metadata, no files
      setCreds({ newly_created: true, metadata_available: false });
      component['data'] = { id: '' } as any;
      expect(component.proceedTitle()).toContain('Select at least one file');

      // Metadata-only allowed: new dataset, metadata available, no files
      setCreds({ newly_created: true, metadata_available: true });
      component['data'] = { id: '' } as any;
      // Ensure no selection yet
      (component as any).rowNodeMap = new Map();
      expect(component.canProceed()).toBeTrue();
      expect(component.proceedTitle()).toContain('metadata-only');

      // Existing dataset: need selection
      setCreds({ newly_created: false });
      component['data'] = { id: 'doi:10/EXISTING' } as any;
      expect(component.canProceed()).toBeFalse();
      expect(component.proceedTitle()).toBe('Action not available yet');
    });

    it('new dataset with undefined metadata_available allowed metadata-only', () => {
      setCreds({ newly_created: true });
      component['data'] = { id: '' } as any;
      expect(component.canProceed()).toBeTrue();
      expect(component.proceedTitle()).toContain('metadata-only');
    });

    it('isNewDataset() falls back to dataset id heuristic when flag missing', () => {
      // No newly_created flag, id includes New Dataset (case-insensitive)
      (component as any).credentialsService = { credentials: {} };
      component['data'] = { id: 'root:COLL:New Dataset' } as any;
      expect(component['isNewDataset']()).toBeTrue();

      // Plain empty id treated as new
      component['data'] = { id: '' } as any;
      expect(component['isNewDataset']()).toBeTrue();

      // Non-new id without flag
      component['data'] = { id: 'doi:10.123/EXISTING' } as any;
      expect(component['isNewDataset']()).toBeFalse();
    });
  });
});
