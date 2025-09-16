import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { MetadataSelectorComponent } from './metadata-selector.component';
import { DatasetService } from '../dataset.service';

describe('MetadataSelectorComponent', () => {
  let component: MetadataSelectorComponent;
  let fixture: ComponentFixture<MetadataSelectorComponent>;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    const routerStub = {
      navigate: jasmine.createSpy('navigate'),
    } as unknown as Router;
    const datasetStub = {
      newDataset: () => of({ persistentId: 'doi:10.1234/created' }),
      getMetadata: () =>
        of({
          datasetVersion: {
            metadataBlocks: {
              citation: {
                displayName: 'Citation',
                name: 'citation',
                fields: [],
              },
            },
          },
        }),
    } as unknown as DatasetService;
    await TestBed.configureTestingModule({
      imports: [MetadataSelectorComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
        { provide: DatasetService, useValue: datasetStub },
      ],
    })
      // Keep template as-is; component uses PrimeNG lightweightly
      .compileComponents();

    fixture = TestBed.createComponent(MetadataSelectorComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to submit after continueSubmit when new dataset is created', async () => {
    (component as any).pid = 'collectionId:New Dataset';
    await component.continueSubmit();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/submit']);
  });
});
