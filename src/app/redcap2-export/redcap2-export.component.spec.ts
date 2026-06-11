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
import { RepoLookupRequest } from '../models/repo-lookup';
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

  it('does not offer the nonexistent rawOrLabel=both API value', () => {
    expect(component.rawOrLabelItems.map((item) => item.value)).toEqual([
      'raw',
      'label',
    ]);
  });

  it('forces flat record type in report mode (content=report has no type parameter)', () => {
    component.recordType.set('eav');
    component.continueToCompare();
    const saved = JSON.parse(
      credentialsService.credentials$().plugin_options ?? '{}',
    ) as { recordType?: string };
    expect(saved.recordType).toBe('flat');
  });

  it('loads variables when a new report ID is entered (blur)', () => {
    repoLookupService.getOptions.calls.reset();
    component.reportId.set('4020');
    component.onReportIdBlur();
    expect(repoLookupService.getOptions).toHaveBeenCalledTimes(1);
    expect(component.lastLoadedReportId()).toBe('4020');
  });

  it('does not reload variables on blur when the report ID is unchanged', () => {
    repoLookupService.getOptions.calls.reset();
    component.onReportIdBlur(); // id 3010 was already loaded in ngOnInit
    expect(repoLookupService.getOptions).not.toHaveBeenCalled();
  });

  it('requires a report ID before manual variable reload in report mode', () => {
    const notificationService = TestBed.inject(
      NotificationService,
    ) as unknown as NotificationServiceStub;
    repoLookupService.getOptions.calls.reset();
    component.reportId.set('');
    component.reloadVariables();
    expect(notificationService.showError).toHaveBeenCalledWith(
      'Enter a report ID first.',
    );
    expect(repoLookupService.getOptions).not.toHaveBeenCalled();
  });

  it('loads project variables when switching to records mode', () => {
    repoLookupService.getOptions.calls.reset();
    component.setExportMode('records');
    expect(repoLookupService.getOptions).toHaveBeenCalledTimes(1);
    const req = repoLookupService.getOptions.calls.mostRecent()
      .args[0] as RepoLookupRequest;
    expect(JSON.parse(req.pluginOptions ?? '{}')).toEqual({
      request: 'variables',
      exportMode: 'records',
      reportId: '',
    });
  });

  it('pre-selects identifier-tagged variables as blank', () => {
    repoLookupService.getOptions.and.returnValue(
      of([
        { label: 'record_id', value: 'record_id' },
        { label: 'email', value: 'email', selected: true },
      ]),
    );
    component.setExportMode('records');
    expect(component.variables()).toEqual([
      { name: 'email', anonymization: 'blank' },
      { name: 'record_id', anonymization: 'none' },
    ]);
  });

  it('offers all four anonymization modes', () => {
    expect(component.anonymizationItems.map((item) => item.value)).toEqual([
      'none',
      'blank',
      'drop',
      'pseudonymize',
    ]);
  });

  it('keeps PHI-risk notes from the variable lookup', () => {
    repoLookupService.getOptions.and.returnValue(
      of([
        { label: 'record_id', value: 'record_id' },
        {
          label: 'comments',
          value: 'comments',
          note: 'free-text notes field: may contain identifying information',
        },
      ]),
    );
    component.setExportMode('records');
    expect(component.variables()).toEqual([
      {
        name: 'comments',
        anonymization: 'none',
        note: 'free-text notes field: may contain identifying information',
      },
      { name: 'record_id', anonymization: 'none' },
    ]);
  });

  it('rejects pseudonymization without a valid base64 key', () => {
    const notificationService = TestBed.inject(
      NotificationService,
    ) as unknown as NotificationServiceStub;
    component.setVariableAnonymization('record_id', 'pseudonymize');
    expect(component.usesPseudonymization()).toBeTrue();

    component.pseudonymizationKey.set('!!!not-base64!!!');
    component.continueToCompare();
    expect(notificationService.showError).toHaveBeenCalledWith(
      'The pseudonymization key is not valid base64. Generate one with: openssl rand -base64 32',
    );
    expect(router.navigate).not.toHaveBeenCalledWith(
      ['/compare', 'doi:10.5072/FK2/TEST'],
      jasmine.anything(),
    );
  });

  it('rejects a too-short pseudonymization key', () => {
    const notificationService = TestBed.inject(
      NotificationService,
    ) as unknown as NotificationServiceStub;
    component.setVariableAnonymization('record_id', 'pseudonymize');
    component.pseudonymizationKey.set(btoa('tooshort'));
    component.continueToCompare();
    expect(notificationService.showError).toHaveBeenCalledWith(
      jasmine.stringContaining('too short'),
    );
  });

  it('submits the pseudonymization key only when pseudonymization is used', () => {
    const key = btoa('0123456789abcdef0123456789abcdef');
    component.setVariableAnonymization('record_id', 'pseudonymize');
    component.pseudonymizationKey.set(key);
    component.continueToCompare();
    let saved = JSON.parse(
      credentialsService.credentials$().plugin_options ?? '{}',
    ) as { pseudonymizationKey?: string };
    expect(saved.pseudonymizationKey).toBe(key);

    component.setVariableAnonymization('record_id', 'blank');
    component.continueToCompare();
    saved = JSON.parse(
      credentialsService.credentials$().plugin_options ?? '{}',
    ) as { pseudonymizationKey?: string };
    expect(saved.pseudonymizationKey).toBeUndefined();
  });

  it('strips display-only notes from submitted variables', () => {
    repoLookupService.getOptions.and.returnValue(
      of([{ label: 'comments', value: 'comments', note: 'free-text' }]),
    );
    component.setExportMode('records');
    component.continueToCompare();
    const saved = JSON.parse(
      credentialsService.credentials$().plugin_options ?? '{}',
    ) as { variables?: Array<Record<string, unknown>> };
    expect(saved.variables).toEqual([
      { name: 'comments', anonymization: 'none' },
    ]);
  });

  it('restores a saved pseudonymization key and modes', () => {
    credentialsService.updateCredentials({
      plugin_options: JSON.stringify({
        exportMode: 'report',
        reportId: '3010',
        dataFormat: 'csv',
        variables: [{ name: 'record_id', anonymization: 'pseudonymize' }],
        pseudonymizationKey: 'c2F2ZWQta2V5',
      }),
    });
    const newFixture = TestBed.createComponent(Redcap2ExportComponent);
    newFixture.detectChanges();
    const newComponent = newFixture.componentInstance;
    expect(newComponent.pseudonymizationKey()).toBe('c2F2ZWQta2V5');
    expect(newComponent.variables()).toEqual([
      { name: 'record_id', anonymization: 'pseudonymize' },
    ]);
  });
});
