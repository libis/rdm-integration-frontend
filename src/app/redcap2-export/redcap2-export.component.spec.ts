import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';

import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { RepoLookupService } from '../repo.lookup.service';
import { NotificationService } from '../shared/notification.service';
import { Redcap2ExportComponent } from './redcap2-export.component';

class CredentialsServiceStub {
  private readonly credentials = signal({
    pluginId: 'redcap2',
    plugin: 'redcap2',
    repo_name: undefined as string | undefined,
    url: 'https://example.redcap.test',
    option: '3010',
    user: undefined as string | undefined,
    token: 'token-1',
    dataset_id: 'doi:10.5072/FK2/TEST',
    dataverse_token: 'dv-token',
    plugin_options: undefined as string | undefined,
  });

  readonly credentials$ = this.credentials.asReadonly();
  readonly datasetId$ = computed(() => this.credentials().dataset_id);

  updateCredentials(partial: Record<string, unknown>): void {
    this.credentials.update((current) => ({
      ...current,
      ...(partial as Partial<typeof current>),
    }));
  }
}

class RepoLookupServiceStub {
  getOptions = jasmine
    .createSpy('getOptions')
    .and.returnValue(of([{ label: 'record_id', value: 'record_id' }]));
}

class NotificationServiceStub {
  showError = jasmine.createSpy('showError');
}

class DataStateServiceStub {
  resetState = jasmine.createSpy('resetState');
}

describe('Redcap2ExportComponent', () => {
  let fixture: ComponentFixture<Redcap2ExportComponent>;
  let component: Redcap2ExportComponent;
  let router: jasmine.SpyObj<Router>;
  let repoLookupService: RepoLookupServiceStub;
  let credentialsService: CredentialsServiceStub;

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [Redcap2ExportComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'doi:10.5072/FK2/TEST' }),
            },
          },
        },
        { provide: CredentialsService, useClass: CredentialsServiceStub },
        { provide: RepoLookupService, useClass: RepoLookupServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        { provide: DataStateService, useClass: DataStateServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Redcap2ExportComponent);
    component = fixture.componentInstance;
    repoLookupService = TestBed.inject(
      RepoLookupService,
    ) as unknown as RepoLookupServiceStub;
    credentialsService = TestBed.inject(
      CredentialsService,
    ) as unknown as CredentialsServiceStub;
    fixture.detectChanges();
  });

  it('loads variables from repo options for the selected report', () => {
    expect(repoLookupService.getOptions).toHaveBeenCalled();
    expect(component.reportId()).toBe('3010');
    expect(component.variables()).toEqual([
      { name: 'record_id', anonymization: 'none' },
    ]);
  });

  it('stores plugin options and navigates to compare', () => {
    component.setVariableAnonymization('record_id', 'blank');
    component.continueToCompare();

    const savedRaw = credentialsService.credentials$().plugin_options;
    expect(typeof savedRaw).toBe('string');

    const saved = JSON.parse(savedRaw ?? '{}') as {
      reportId?: string;
      dataFormat?: string;
      rawOrLabel?: string;
      rawOrLabelHeaders?: string;
      variables?: Array<{ name: string; anonymization: string }>;
      generatedAt?: string;
    };

    expect(saved.reportId).toBe('3010');
    expect(saved.dataFormat).toBe('csv');
    expect(saved.rawOrLabel).toBe('raw');
    expect(saved.rawOrLabelHeaders).toBe('raw');
    expect(saved.variables).toEqual([
      { name: 'record_id', anonymization: 'blank' },
    ]);
    expect(typeof saved.generatedAt).toBe('string');

    expect(router.navigate).toHaveBeenCalledWith(
      ['/compare', 'doi:10.5072/FK2/TEST'],
      {
        state: {
          collectionId: undefined,
          collectionItems: undefined,
        },
      },
    );
  });

  it('shows error when continuing without report ID', () => {
    const notificationService = TestBed.inject(
      NotificationService,
    ) as unknown as NotificationServiceStub;
    component.reportId.set('');
    component.continueToCompare();
    expect(notificationService.showError).toHaveBeenCalledWith(
      'Report ID is missing.',
    );
  });
});
