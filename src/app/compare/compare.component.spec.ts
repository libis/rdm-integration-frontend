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
  });
});
