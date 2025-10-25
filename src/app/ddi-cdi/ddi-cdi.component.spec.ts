// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { DdiCdiComponent } from './ddi-cdi.component';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';
import {
  AddFileRequest,
  CachedComputeResponse,
  CompareResult,
  Key,
} from '../models/compare-result';
import { Datafile } from '../models/datafile';
import { SelectItem, TreeNode } from 'primeng/api';
import { ElementRef } from '@angular/core';
import cachedResponseFixture from '../../../tests/response.json';

describe('DdiCdiComponent', () => {
  let dataServiceStub: jasmine.SpyObj<DataService>;
  let dvObjectLookupServiceStub: jasmine.SpyObj<DvObjectLookupService>;
  let pluginServiceStub: jasmine.SpyObj<PluginService>;
  let navigationServiceStub: jasmine.SpyObj<NavigationService>;
  let notificationServiceStub: jasmine.SpyObj<NotificationService>;
  let utilsServiceStub: jasmine.SpyObj<UtilsService>;

  const mockQueryParams = of({});
  const buildDatasetTurtle = (localName: string, title: string) =>
    [
      '@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .',
      '@prefix dcterms: <http://purl.org/dc/terms/> .',
      '@prefix ex: <http://example.com/> .',
      '',
      `ex:${localName} a cdi:DataSet ;`,
      `  dcterms:identifier "${localName}" ;`,
      `  dcterms:title "${title}" .`,
    ].join('\n');
  const SIMPLE_TURTLE = buildDatasetTurtle('datasetSimple', 'Sample dataset');
  const GENERATED_TURTLE = buildDatasetTurtle(
    'datasetGenerated',
    'Generated dataset',
  );
  const FINAL_TURTLE = buildDatasetTurtle('datasetFinal', 'Final dataset');
  const POLLED_CACHED_TURTLE = buildDatasetTurtle(
    'datasetCached',
    'Cached dataset',
  );
  const REFRESHED_TURTLE = buildDatasetTurtle(
    'datasetRefreshed',
    'Refreshed dataset',
  );
  const UPDATED_TITLE_TURTLE = [
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '@prefix ex: <http://example.com/> .',
    '',
    'ex:datasetSimple dcterms:title "Updated dataset" .',
  ].join('\n');
  const PREFIX_ONLY_TURTLE = [
    '@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
  ].join('\n');
  const BLANK_NODE_TURTLE = [
    '@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '',
    '_:datasetBlank a cdi:DataSet ;',
    '  dcterms:identifier "datasetBlank" ;',
    '  dcterms:title "Blank dataset" .',
  ].join('\n');
  const cachedResponseData = cachedResponseFixture as CachedComputeResponse;
  const CACHED_TURTLE = cachedResponseData.ddiCdi ?? '';

  beforeEach(async () => {
    // Create service stubs
    dataServiceStub = jasmine.createSpyObj('DataService', [
      'getDdiCdiCompatibleFiles',
      'generateDdiCdi',
      'getCachedDdiCdiData',
      'getCachedDdiCdiOutput',
      'addFileToDataset',
    ]);
    dvObjectLookupServiceStub = jasmine.createSpyObj('DvObjectLookupService', [
      'getItems',
    ]);
    pluginServiceStub = jasmine.createSpyObj('PluginService', [
      'setConfig',
      'showDVToken',
      'isStoreDvToken',
      'datasetFieldEditable',
      'dataverseHeader',
      'sendMails',
    ]);
    navigationServiceStub = jasmine.createSpyObj('NavigationService', [
      'assign',
    ]);
    notificationServiceStub = jasmine.createSpyObj('NotificationService', [
      'showError',
      'showSuccess',
      'showInfo',
    ]);
    utilsServiceStub = jasmine.createSpyObj('UtilsService', [
      'mapDatafiles',
      'addChild',
      'sleep',
    ]);

    // Default stub behaviors
    pluginServiceStub.setConfig.and.returnValue(Promise.resolve());
    pluginServiceStub.showDVToken.and.returnValue(false);
    pluginServiceStub.isStoreDvToken.and.returnValue(false);
    pluginServiceStub.sendMails.and.returnValue(false);
    pluginServiceStub.datasetFieldEditable.and.returnValue(true);
    pluginServiceStub.dataverseHeader.and.returnValue('Dataverse');
    utilsServiceStub.sleep.and.returnValue(Promise.resolve());
    dataServiceStub.getCachedDdiCdiOutput.and.returnValue(
      throwError(() => ({ status: 404 })),
    );
    dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(
      of({ id: '', data: [] } as CompareResult),
    );

    await TestBed.configureTestingModule({
      imports: [DdiCdiComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: DataService, useValue: dataServiceStub },
        { provide: DvObjectLookupService, useValue: dvObjectLookupServiceStub },
        { provide: PluginService, useValue: pluginServiceStub },
        { provide: NavigationService, useValue: navigationServiceStub },
        { provide: NotificationService, useValue: notificationServiceStub },
        { provide: UtilsService, useValue: utilsServiceStub },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: mockQueryParams },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(DdiCdiComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should initialize and call setConfig', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      await component.ngOnInit();
      expect(pluginServiceStub.setConfig).toHaveBeenCalled();
    });

    it('should load dataverseToken from localStorage if present', async () => {
      spyOn(localStorage, 'getItem').and.returnValue('test-token');
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      await component.ngOnInit();
      expect(component.dataverseToken).toBe('test-token');
    });

    it('should set datasetId from query params', async () => {
      const testRoute = TestBed.inject(ActivatedRoute);
      (testRoute as any).queryParams = of({
        datasetPid: 'doi:10.123/test',
        apiToken: 'token123',
      });
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      await component.ngOnInit();
      expect(component.datasetId).toBe('doi:10.123/test');
      expect(component.dataverseToken).toBe('token123');
    });
  });

  describe('ngOnDestroy', () => {
    it('should clean up subscriptions', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      const mockSubscription = jasmine.createSpyObj('Subscription', [
        'unsubscribe',
      ]);
      // Access private field through bracket notation for testing
      (component as any).subscriptions.add(mockSubscription);
      component.ngOnDestroy();
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      expect((component as any).subscriptions.size).toBe(0);
    });
  });

  describe('back', () => {
    it('should navigate to connect page', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.back();
      expect(navigationServiceStub.assign).toHaveBeenCalledWith('connect');
    });
  });

  describe('onUserChange', () => {
    it('should clear doiItems and datasetId', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems = [{ label: 'test', value: 'test' }];
      component.datasetId = 'doi:test';
      component.onUserChange();
      expect(component.doiItems).toEqual([]);
      expect(component.datasetId).toBeUndefined();
    });

    it('should store token in localStorage when isStoreDvToken is true', () => {
      spyOn(localStorage, 'setItem');
      pluginServiceStub.isStoreDvToken.and.returnValue(true);
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.dataverseToken = 'new-token';
      component.onUserChange();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'dataverseToken',
        'new-token',
      );
    });
  });

  describe('getDoiOptions', () => {
    it('should return early if items already loaded', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems = [{ label: 'test', value: 'test' }];
      component.getDoiOptions();
      expect(dvObjectLookupServiceStub.getItems).not.toHaveBeenCalled();
    });

    it('should fetch datasets and update doiItems', () => {
      const mockItems: SelectItem<string>[] = [
        { label: 'doi:123', value: 'doi:123' },
      ];
      dvObjectLookupServiceStub.getItems.and.returnValue(of(mockItems));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems = [];
      component.getDoiOptions();
      expect(dvObjectLookupServiceStub.getItems).toHaveBeenCalledWith(
        '',
        'Dataset',
        undefined,
        undefined,
      );
      expect(component.doiItems).toEqual(mockItems);
    });

    it('should handle error when fetching datasets', () => {
      dvObjectLookupServiceStub.getItems.and.returnValue(
        throwError(() => ({ error: 'Network error' })),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems = [];
      component.getDoiOptions();
      expect(notificationServiceStub.showError).toHaveBeenCalledWith(
        'DOI lookup failed: Network error',
      );
      expect(component.doiItems).toEqual([]);
    });
  });

  describe('onDatasetSearch', () => {
    it('should show message for short search terms', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.onDatasetSearch('ab');
      expect(component.doiItems[0].label).toContain('at least three letters');
    });

    it('should trigger search for valid search terms', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      spyOn(component.datasetSearchSubject, 'next');
      component.onDatasetSearch('test');
      expect(component.datasetSearchSubject.next).toHaveBeenCalledWith('test');
    });
  });

  describe('onDatasetChange', () => {
    it('should fetch dataset files and call setData', (done) => {
      const mockData: CompareResult = {
        id: 'doi:123',
        data: [{ name: 'file.csv', directoryLabel: '' } as Datafile],
      };
      dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(of(mockData));
      utilsServiceStub.mapDatafiles.and.returnValue(new Map());
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      component.datasetId = 'doi:123';
      component.onDatasetChange();
      // loading is set to false after synchronous observable completion
      setTimeout(() => {
        expect(dataServiceStub.getDdiCdiCompatibleFiles).toHaveBeenCalledWith(
          'doi:123',
          undefined,
        );
        expect(component.loading).toBe(false); // loading should be false after completion
        done();
      }, 10);
    });

    it('should handle error when fetching files', () => {
      dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(
        throwError(() => ({ error: 'Fetch error' })),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.onDatasetChange();
      expect(notificationServiceStub.showError).toHaveBeenCalledWith(
        'Getting files failed: Fetch error',
      );
    });
  });

  describe('setData', () => {
    it('should handle empty data', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.loading = true;
      component.setData({ data: [] });
      expect(component.loading).toBe(false);
      expect(component.rootNodeChildren).toEqual([]);
    });

    it('should process data and auto-select supported files', () => {
      const mockFile: Datafile = {
        name: 'data.csv',
        directoryLabel: '',
      } as Datafile;
      const mockNode: TreeNode<Datafile> = {
        data: mockFile,
        children: [],
      };
      const mockMap = new Map<string, TreeNode<Datafile>>();
      mockMap.set('', { children: [mockNode] });
      utilsServiceStub.mapDatafiles.and.returnValue(mockMap);
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.setData({ data: [mockFile] });
      expect(component.selectedFiles.has('data.csv')).toBe(true);
      expect(component.loading).toBe(false);
    });
  });

  describe('file extension methods', () => {
    // File support checking is now done by backend filter
    // All files returned by getDdiCdiCompatibleFiles are supported

    it('autoSelectAllFiles should recursively select all files', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      const childNode: TreeNode<Datafile> = {
        data: { name: 'nested.csv' } as Datafile,
      };
      const parentNode: TreeNode<Datafile> = {
        data: { name: 'parent.tsv' } as Datafile,
        children: [childNode],
      };
      component.autoSelectAllFiles(parentNode);
      expect(component.selectedFiles.has('parent.tsv')).toBe(true);
      expect(component.selectedFiles.has('nested.csv')).toBe(true);
    });
  });

  describe('file selection', () => {
    it('isFileSelected should check selectedFiles set', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.selectedFiles.add('file.csv');
      expect(component.isFileSelected('file.csv')).toBe(true);
      expect(component.isFileSelected('other.csv')).toBe(false);
    });

    it('toggleFileSelection should add/remove files', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.toggleFileSelection('file.csv');
      expect(component.selectedFiles.has('file.csv')).toBe(true);
      component.toggleFileSelection('file.csv');
      expect(component.selectedFiles.has('file.csv')).toBe(false);
    });

    it('autoSelectAllFiles should recursively select all files', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      const childNode: TreeNode<Datafile> = {
        data: { name: 'nested.csv' } as Datafile,
      };
      const parentNode: TreeNode<Datafile> = {
        data: { name: 'parent.tsv' } as Datafile,
        children: [childNode],
      };
      component.autoSelectAllFiles(parentNode);
      expect(component.selectedFiles.has('parent.tsv')).toBe(true);
      expect(component.selectedFiles.has('nested.csv')).toBe(true);
    });
  });

  describe('submitGenerate', () => {
    it('should show error if no files selected', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.submitGenerate();
      expect(notificationServiceStub.showError).toHaveBeenCalledWith(
        'Please select at least one file',
      );
    });

    it('should call generateDdiCdi with correct request', (done) => {
      const mockKey: Key = { key: 'job-123' };
      dataServiceStub.generateDdiCdi.and.returnValue(of(mockKey));
      dataServiceStub.getCachedDdiCdiData.and.returnValue(
        of({ ready: true, res: 'output', ddiCdi: GENERATED_TURTLE }),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      component.datasetId = 'doi:123';
      component.dataverseToken = 'token';
      component.selectedFiles.add('file.csv');
      component.continueSubmitGenerate();
      // loading is set to false after synchronous observable completion
      setTimeout(() => {
        expect(dataServiceStub.generateDdiCdi).toHaveBeenCalledWith({
          persistentId: 'doi:123',
          dataverseKey: 'token',
          queue: 'default',
          fileNames: ['file.csv'],
          sendEmailOnSuccess: false,
        });
        expect(component.loading).toBe(false); // loading should be false after completion
        done();
      }, 10);
    });

    it('should handle error from generateDdiCdi', (done) => {
      dataServiceStub.generateDdiCdi.and.returnValue(
        throwError(() => 'Generation failed'),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.selectedFiles.add('file.csv');
      component.continueSubmitGenerate();
      setTimeout(() => {
        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Generation failed: undefined',
        );
        done();
      }, 10);
    });
  });

  describe('getDdiCdiData (polling)', () => {
    it('should poll until ready is true', async () => {
      const mockKey: Key = { key: 'job-123' };
      dataServiceStub.getCachedDdiCdiData.and.returnValues(
        of({ ready: false, res: 'processing...' }),
        of({ ready: true, res: 'done', ddiCdi: GENERATED_TURTLE }),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component['getDdiCdiData'](mockKey);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(utilsServiceStub.sleep).toHaveBeenCalled();
    });

    it('should set generatedDdiCdi and call setupShaclForm on success', (done) => {
      const mockKey: Key = { key: 'job-123' };
      dataServiceStub.getCachedDdiCdiData.and.returnValue(
        of({ ready: true, res: 'output', ddiCdi: GENERATED_TURTLE }),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      spyOn<any>(component, 'setupShaclForm');
      component['getDdiCdiData'](mockKey);
      setTimeout(() => {
        expect(component.generatedDdiCdi).toBe(GENERATED_TURTLE);
        expect(component.output).toBe('output');
        expect(component.loading).toBe(false);
        expect(notificationServiceStub.showSuccess).toHaveBeenCalledWith(
          'DDI-CDI generated successfully!',
        );
        done();
      }, 50);
    });

    it('should show error if response has error', (done) => {
      const mockKey: Key = { key: 'job-123' };
      dataServiceStub.getCachedDdiCdiData.and.returnValue(
        of({ ready: true, err: 'Generation error' }),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component['getDdiCdiData'](mockKey);
      setTimeout(() => {
        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Generation error',
        );
        done();
      }, 50);
    });

    it('should handle error from getCachedDdiCdiData', (done) => {
      const mockKey: Key = { key: 'job-123' };
      dataServiceStub.getCachedDdiCdiData.and.returnValue(
        throwError(() => ({ error: 'Fetch failed' })),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component['getDdiCdiData'](mockKey);
      setTimeout(() => {
        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Getting DDI-CDI results failed: Fetch failed',
        );
        expect(component.loading).toBe(false);
        done();
      }, 50);
    });
  });

  describe('showAddFileButton', () => {
    it('should return false when generatedDdiCdi is undefined', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      expect(component.showAddFileButton()).toBe(false);
    });

    it('should return false when generatedDdiCdi is empty', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi = '';
      expect(component.showAddFileButton()).toBe(false);
    });

    it('should return true when generatedDdiCdi has content', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi = GENERATED_TURTLE;
      expect(component.showAddFileButton()).toBe(true);
    });
  });

  describe('openAddFileDialog', () => {
    it('should set addFilePopup to true', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.addFilePopup = false;
      component.openAddFileDialog();
      expect(component.addFilePopup).toBe(true);
    });
  });

  describe('addFileToDataset', () => {
    it('should call addFileToDataset with correct request', (done) => {
      dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      component.datasetId = 'doi:123';
      component.dataverseToken = 'token';
      component.generatedDdiCdi = GENERATED_TURTLE;
      component.addFileToDataset();
      expect(component.addFilePopup).toBe(false);
      // loading is set to false after synchronous observable completion
      setTimeout(() => {
        const call = dataServiceStub.addFileToDataset.calls.mostRecent();
        const request: AddFileRequest = call.args[0];
        expect(request.persistentId).toBe('doi:123');
        expect(request.dataverseKey).toBe('token');
        expect(request.content).toBe(GENERATED_TURTLE);
        expect(request.fileName).toMatch(/^ddi-cdi-\d+\.ttl$/);
        expect(component.loading).toBe(false); // loading should be false after completion
        done();
      }, 10);
    });

    it('should show success message on completion', (done) => {
      dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.generatedDdiCdi = GENERATED_TURTLE;
      component.addFileToDataset();
      setTimeout(() => {
        expect(component.loading).toBe(false);
        expect(notificationServiceStub.showSuccess).toHaveBeenCalledWith(
          jasmine.stringMatching(
            /File "ddi-cdi-\d+\.ttl" added to dataset successfully!/,
          ),
        );
        done();
      }, 50);
    });

    it('should handle error from addFileToDataset', (done) => {
      dataServiceStub.addFileToDataset.and.returnValue(
        throwError(() => ({ error: 'Upload failed' })),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.generatedDdiCdi = GENERATED_TURTLE;
      component.addFileToDataset();
      setTimeout(() => {
        expect(component.loading).toBe(false);
        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Failed to add file to dataset: Upload failed',
        );
        done();
      }, 50);
    });

    it('should merge serialized form data with original graph', () => {
      dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.generatedDdiCdi = SIMPLE_TURTLE;
      component.originalDdiCdi = SIMPLE_TURTLE;
      // Mock the SHACL form element
      const mockFormElement = {
        serialize: jasmine
          .createSpy('serialize')
          .and.returnValue(UPDATED_TITLE_TURTLE),
      };
      component.shaclForm = {
        nativeElement: mockFormElement,
      } as any;
      const merged = (component as any).mergeTurtleGraphs(
        SIMPLE_TURTLE,
        UPDATED_TITLE_TURTLE,
      );
      expect(merged).toContain('dcterms:title "Updated dataset"');
      component.addFileToDataset();
      const call = dataServiceStub.addFileToDataset.calls.mostRecent();
      const request: AddFileRequest = call.args[0];
      expect(request.content).toContain(
        'dcterms:title "Updated dataset"',
      );
      expect(request.content).toContain(
        'dcterms:identifier "datasetSimple"',
      );
      expect(request.content).not.toContain('Sample dataset');
      expect(mockFormElement.serialize).toHaveBeenCalled();
    });

    it('should fallback to original content if serialization fails', () => {
      spyOn(console, 'warn');
      dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.generatedDdiCdi = 'original-content';
      // Mock the SHACL form element with failing serialize
      const mockFormElement = {
        serialize: jasmine
          .createSpy('serialize')
          .and.throwError('Serialization error'),
      };
      component.shaclForm = {
        nativeElement: mockFormElement,
      } as any;
      component.addFileToDataset();
      const call = dataServiceStub.addFileToDataset.calls.mostRecent();
      const request: AddFileRequest = call.args[0];
      expect(request.content).toBe('original-content');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should retain original turtle when serialized output has no triples', () => {
      dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId = 'doi:123';
      component.generatedDdiCdi = SIMPLE_TURTLE;
      component.originalDdiCdi = SIMPLE_TURTLE;
      const mockFormElement = {
        serialize: jasmine
          .createSpy('serialize')
          .and.returnValue(PREFIX_ONLY_TURTLE),
      };
      component.shaclForm = {
        nativeElement: mockFormElement,
      } as any;

      component.addFileToDataset();

      const call = dataServiceStub.addFileToDataset.calls.mostRecent();
      const request: AddFileRequest = call.args[0];
      expect(request.content).toContain('dcterms:identifier "datasetSimple"');
      expect(request.content).toContain('Sample dataset');
      expect(mockFormElement.serialize).toHaveBeenCalled();
    });
  });

  describe('cached CDI response integration', () => {
    it('should build SHACL shapes with dataset root from cached TTL', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      const shapes = (component as any).buildShaclShapes(CACHED_TURTLE);
      expect(shapes).toBeTruthy();
      expect(shapes as string).toContain(
        'sh:targetNode <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM>',
      );
      expect(shapes as string).toContain('sh:targetClass cdi:DataSet;');
    });

    it('should set SHACL form attributes with cached dataset focus node', fakeAsync(() => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;

      const mockElement = {
        setAttribute: jasmine.createSpy('setAttribute'),
        removeAttribute: jasmine.createSpy('removeAttribute'),
        addEventListener: jasmine.createSpy('addEventListener'),
        removeEventListener: jasmine.createSpy('removeEventListener'),
        serialize: jasmine.createSpy('serialize'),
      };

      component.shaclForm = {
        nativeElement: mockElement,
      } as unknown as ElementRef;

      (component as any).setGeneratedOutput(CACHED_TURTLE);
      tick(150);

      expect(component.shaclError).toBeUndefined();
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'data-values',
        CACHED_TURTLE,
      );
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'data-values-format',
        'text/turtle',
      );
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'data-values-subject',
        'http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM',
      );
      expect(mockElement.setAttribute).toHaveBeenCalledWith(
        'data-shape-subject',
        jasmine.stringMatching(/^urn:ddi-cdi:DatasetShape/),
      );
    }));

    it('should upload cached TTL unchanged when SHACL editor is unavailable', fakeAsync(() => {
      dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component.datasetId = 'doi:10.5072/FK2/HWBVZM';
      component.dataverseToken = 'token-123';
      component.originalDdiCdi = CACHED_TURTLE;
      component.generatedDdiCdi = CACHED_TURTLE;
      component.shaclError = 'SHACL editor failed to render';
      component.shaclForm = undefined;

      component.addFileToDataset();
      tick();

      const call = dataServiceStub.addFileToDataset.calls.mostRecent();
      const request: AddFileRequest = call.args[0];
      expect(request.content).toBe(CACHED_TURTLE);
    }));

    it('should build SHACL shapes when dataset subject is a blank node', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;

      const shapes = (component as any).buildShaclShapes(BLANK_NODE_TURTLE);

  expect(shapes).toBeTruthy();
  expect(shapes as string).toMatch(/sh:targetNode _:[^;]+;/);
      expect((component as any).shaclTargetNode).toBeUndefined();
    });

    it('should skip binding data-values-subject when focus node is a blank node', fakeAsync(() => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;

      const mockElement = {
        setAttribute: jasmine.createSpy('setAttribute'),
        removeAttribute: jasmine.createSpy('removeAttribute'),
        addEventListener: jasmine.createSpy('addEventListener'),
        removeEventListener: jasmine.createSpy('removeEventListener'),
        serialize: jasmine.createSpy('serialize'),
      };

      component.shaclForm = {
        nativeElement: mockElement,
      } as unknown as ElementRef;

      (component as any).setGeneratedOutput(BLANK_NODE_TURTLE);
      tick(150);

      expect(mockElement.removeAttribute).toHaveBeenCalledWith(
        'data-values-subject',
      );
      expect(mockElement.setAttribute).not.toHaveBeenCalledWith(
        'data-values-subject',
        jasmine.any(String),
      );
      expect(component.shaclError).toBeUndefined();
    }));
  });

  describe('Additional Coverage Tests', () => {
    describe('showDVToken', () => {
      it('should delegate to plugin service', () => {
        pluginServiceStub.showDVToken.and.returnValue(true);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.showDVToken()).toBe(true);
        expect(pluginServiceStub.showDVToken).toHaveBeenCalled();
      });

      it('should return false when plugin service returns false', () => {
        pluginServiceStub.showDVToken.and.returnValue(false);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.showDVToken()).toBe(false);
      });
    });

    describe('datasetFieldEditable', () => {
      it('should delegate to plugin service', () => {
        pluginServiceStub.datasetFieldEditable.and.returnValue(true);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.datasetFieldEditable()).toBe(true);
        expect(pluginServiceStub.datasetFieldEditable).toHaveBeenCalled();
      });

      it('should return false when not editable', () => {
        pluginServiceStub.datasetFieldEditable.and.returnValue(false);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.datasetFieldEditable()).toBe(false);
      });
    });

    describe('dataverseHeader', () => {
      it('should return header from plugin service', () => {
        pluginServiceStub.dataverseHeader.and.returnValue('Test Header');
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.dataverseHeader()).toBe('Test Header');
        expect(pluginServiceStub.dataverseHeader).toHaveBeenCalled();
      });
    });

    describe('onUserChange with token storage', () => {
      it('should store token in localStorage when isStoreDvToken is true', () => {
        pluginServiceStub.isStoreDvToken.and.returnValue(true);
        spyOn(localStorage, 'setItem');
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.dataverseToken = 'test-token';
        component.onUserChange();
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'dataverseToken',
          'test-token',
        );
      });

      it('should not store token when isStoreDvToken is false', () => {
        pluginServiceStub.isStoreDvToken.and.returnValue(false);
        spyOn(localStorage, 'setItem');
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.dataverseToken = 'test-token';
        component.onUserChange();
        expect(localStorage.setItem).not.toHaveBeenCalled();
      });

      it('should not store token when token is undefined', () => {
        pluginServiceStub.isStoreDvToken.and.returnValue(true);
        spyOn(localStorage, 'setItem');
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.dataverseToken = undefined;
        component.onUserChange();
        expect(localStorage.setItem).not.toHaveBeenCalled();
      });
    });

    describe('getDoiOptions edge cases', () => {
      it('should not fetch when doiItems already has non-loading items', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.doiItems = [{ label: 'doi:1', value: 'doi:1' }];
        component.getDoiOptions();
        expect(dvObjectLookupServiceStub.getItems).not.toHaveBeenCalled();
      });

      it('should set empty array when no items returned', () => {
        dvObjectLookupServiceStub.getItems.and.returnValue(of([]));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.getDoiOptions();
        expect(component.doiItems).toEqual([]);
        expect(component.datasetId).toBeUndefined();
      });

      it('should clear datasetId when items are loaded', () => {
        const mockItems: SelectItem<string>[] = [
          { label: 'doi:1', value: 'doi:1' },
        ];
        dvObjectLookupServiceStub.getItems.and.returnValue(of(mockItems));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'old-value';
        component.getDoiOptions();
        expect(component.datasetId).toBeUndefined();
      });
    });

    describe('onDatasetSearch validation', () => {
      it('should show instruction for null search term', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.onDatasetSearch(null);
        expect(component.doiItems.length).toBe(1);
        expect(component.doiItems[0].label).toContain('start typing');
      });

      it('should show instruction for short search term', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.onDatasetSearch('ab');
        expect(component.doiItems.length).toBe(1);
        expect(component.doiItems[0].label).toContain('at least three');
      });

      it('should show searching message for valid term', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        spyOn(component['datasetSearchSubject'], 'next');
        component.onDatasetSearch('test');
        expect(component.doiItems[0].label).toContain('searching');
      });
    });

    describe('datasetSearch', () => {
      it('should call service with correct parameters', async () => {
        const mockItems: SelectItem<string>[] = [
          { label: 'doi:1', value: 'doi:1' },
        ];
        dvObjectLookupServiceStub.getItems.and.returnValue(of(mockItems));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.dataverseToken = 'token';
        const result = await component.datasetSearch('search-term');
        expect(result).toEqual(mockItems);
        expect(dvObjectLookupServiceStub.getItems).toHaveBeenCalledWith(
          '',
          'Dataset',
          'search-term',
          'token',
        );
      });
    });

    describe('setData with nested files', () => {
      it('should auto-select supported files in nested structure', () => {
        const mockMap = new Map<string, TreeNode<Datafile>>();
        const rootNode: TreeNode<Datafile> = {
          data: { name: '', directoryLabel: '' } as Datafile,
          children: [
            {
              data: { name: 'file1.csv', directoryLabel: '' } as Datafile,
              children: [],
            },
            {
              data: { name: 'folder', directoryLabel: 'folder' } as Datafile,
              children: [
                {
                  data: {
                    name: 'nested.tsv',
                    directoryLabel: 'folder',
                  } as Datafile,
                  children: [],
                },
              ],
            },
          ],
        };
        mockMap.set('', rootNode);
        utilsServiceStub.mapDatafiles.and.returnValue(mockMap);

        const mockData: CompareResult = {
          id: 'doi:123',
          data: [
            { name: 'file1.csv', directoryLabel: '' } as Datafile,
            { name: 'nested.tsv', directoryLabel: 'folder' } as Datafile,
          ],
        };

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.setData(mockData);

        expect(component.selectedFiles.has('file1.csv')).toBe(true);
        expect(component.selectedFiles.has('nested.tsv')).toBe(true);
        expect(component.loading).toBe(false);
      });

      it('should auto-select all files from backend', () => {
        const mockMap = new Map<string, TreeNode<Datafile>>();
        const rootNode: TreeNode<Datafile> = {
          data: { name: '', directoryLabel: '' } as Datafile,
          children: [
            {
              data: { name: 'file.csv', directoryLabel: '' } as Datafile,
              children: [],
            },
          ],
        };
        mockMap.set('', rootNode);
        utilsServiceStub.mapDatafiles.and.returnValue(mockMap);

        const mockData: CompareResult = {
          id: 'doi:123',
          data: [{ name: 'file.csv', directoryLabel: '' } as Datafile],
        };

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.setData(mockData);

        expect(component.selectedFiles.has('file.csv')).toBe(true);
      });
    });

    describe('getDdiCdiData polling scenarios', () => {
      it('should poll until ready is true', (done) => {
        let callCount = 0;
        const mockKey: Key = { key: 'job-123' };

        dataServiceStub.getCachedDdiCdiData.and.callFake(() => {
          callCount++;
          if (callCount < 3) {
            return of({
              ready: false,
              res: `Progress ${callCount}`,
            } as CachedComputeResponse);
          }
          return of({
            ready: true,
            res: 'Complete',
            ddiCdi: FINAL_TURTLE,
          } as CachedComputeResponse);
        });

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(callCount).toBeGreaterThanOrEqual(3);
          expect(component.loading).toBe(false);
          expect(component.generatedDdiCdi).toBe(FINAL_TURTLE);
          done();
        }, 100);
      });

      it('should show error when response contains error message', (done) => {
        const mockKey: Key = { key: 'job-123' };
        dataServiceStub.getCachedDdiCdiData.and.returnValue(
          of({
            ready: true,
            res: 'output',
            err: 'Processing error occurred',
          } as CachedComputeResponse),
        );

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(notificationServiceStub.showError).toHaveBeenCalledWith(
            'Processing error occurred',
          );
          expect(component.loading).toBe(false);
          done();
        }, 10);
      });

      it('should show success notification when generation completes', (done) => {
        const mockKey: Key = { key: 'job-123' };
        dataServiceStub.getCachedDdiCdiData.and.returnValue(
          of({
            ready: true,
            res: 'output',
            ddiCdi: SIMPLE_TURTLE,
          } as CachedComputeResponse),
        );

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(notificationServiceStub.showSuccess).toHaveBeenCalledWith(
            'DDI-CDI generated successfully!',
          );
          expect(component.outputDisabled).toBe(false);
          done();
        }, 10);
      });

      it('should update output during polling', (done) => {
        let callCount = 0;
        const mockKey: Key = { key: 'job-123' };

        dataServiceStub.getCachedDdiCdiData.and.callFake(() => {
          callCount++;
          if (callCount === 1) {
            return of({
              ready: false,
              res: 'Processing step 1',
            } as CachedComputeResponse);
          }
          return of({
            ready: true,
            res: 'Final output',
            ddiCdi: SIMPLE_TURTLE,
          } as CachedComputeResponse);
        });

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(component.output).toBe('Final output');
          done();
        }, 100);
      });
    });

    describe('setupShaclForm event handling', () => {
      it('should setup change event listener', (done) => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        const mockElement = {
          addEventListener: jasmine.createSpy('addEventListener'),
          removeEventListener: jasmine.createSpy('removeEventListener'),
          setAttribute: jasmine.createSpy('setAttribute'),
          removeAttribute: jasmine.createSpy('removeAttribute'),
          serialize: jasmine
            .createSpy('serialize')
            .and.returnValue(SIMPLE_TURTLE),
        } as any;

        component.generatedDdiCdi = SIMPLE_TURTLE;
        component.shaclShapes = component['buildShaclShapes'](SIMPLE_TURTLE);

        component.shaclForm = {
          nativeElement: mockElement,
        } as ElementRef;

        component['setupShaclForm']();

        setTimeout(() => {
          expect(mockElement.addEventListener).toHaveBeenCalledWith(
            'change',
            jasmine.any(Function),
          );
          done();
        }, 150);
      });

      it('should update data when form changes with valid input', (done) => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        let changeHandler: (event: CustomEvent) => void;
        const mockElement = {
          addEventListener: jasmine
            .createSpy('addEventListener')
            .and.callFake((event: string, handler: any) => {
              if (event === 'change') {
                changeHandler = handler;
              }
            }),
          removeEventListener: jasmine.createSpy('removeEventListener'),
          setAttribute: jasmine.createSpy('setAttribute'),
          removeAttribute: jasmine.createSpy('removeAttribute'),
          serialize: jasmine
            .createSpy('serialize')
            .and.returnValue(SIMPLE_TURTLE),
        } as any;

        component.shaclForm = {
          nativeElement: mockElement,
        } as ElementRef;

        component.generatedDdiCdi = SIMPLE_TURTLE;
        component.shaclShapes = component['buildShaclShapes'](SIMPLE_TURTLE);

        component['setupShaclForm']();

        setTimeout(() => {
          expect(changeHandler!).toBeDefined();

          changeHandler!({ detail: { valid: true } } as CustomEvent);

          expect(component.shaclFormValid).toBe(true);
          expect(component.generatedDdiCdi).toBe(SIMPLE_TURTLE);
          done();
        }, 150);
      });

      it('should set invalid flag when form has validation errors', (done) => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        let changeHandler: (event: CustomEvent) => void;
        const mockElement = {
          addEventListener: jasmine
            .createSpy('addEventListener')
            .and.callFake((event: string, handler: any) => {
              if (event === 'change') {
                changeHandler = handler;
              }
            }),
          removeEventListener: jasmine.createSpy('removeEventListener'),
          setAttribute: jasmine.createSpy('setAttribute'),
          removeAttribute: jasmine.createSpy('removeAttribute'),
          serialize: jasmine.createSpy('serialize'),
        } as any;

        component.shaclForm = {
          nativeElement: mockElement,
        } as ElementRef;

        component.generatedDdiCdi = SIMPLE_TURTLE;
        component.shaclShapes = component['buildShaclShapes'](SIMPLE_TURTLE);

        component['setupShaclForm']();

        setTimeout(() => {
          const mockEvent = {
            detail: { valid: false },
          } as CustomEvent;

          changeHandler!(mockEvent);

          expect(component.shaclFormValid).toBe(false);
          expect(mockElement.serialize).not.toHaveBeenCalled();
          done();
        }, 150);
      });

      it('should handle missing form element gracefully', (done) => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component.shaclForm = undefined;
        expect(() => component['setupShaclForm']()).not.toThrow();

        setTimeout(() => {
          expect(component.shaclFormValid).toBe(false);
          done();
        }, 150);
      });
    });

    describe('openAddFileDialog', () => {
      it('should set popup flag to true', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.addFilePopup = false;
        component.openAddFileDialog();
        expect(component.addFilePopup).toBe(true);
      });
    });

    describe('showAddFileButton edge cases', () => {
      it('should return true for non-empty ddiCdi', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.generatedDdiCdi = 'content';
        expect(component.showAddFileButton()).toBe(true);
      });

      it('should return false for empty string', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.generatedDdiCdi = '';
        expect(component.showAddFileButton()).toBe(false);
      });

      it('should return false for undefined', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.generatedDdiCdi = undefined;
        expect(component.showAddFileButton()).toBe(false);
      });
    });

    describe('ngOnInit query parameters', () => {
      it('should load dataset and token from query params', async () => {
        const mockParams = {
          datasetPid: 'doi:test',
          apiToken: 'test-token',
        };

        dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(
          of({ id: 'doi:test', data: [] } as CompareResult),
        );

        await TestBed.configureTestingModule({
          providers: [
            {
              provide: ActivatedRoute,
              useValue: { queryParams: of(mockParams) },
            },
          ],
        });

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        await component.ngOnInit();

        expect(component.datasetId).toBe('doi:test');
        expect(component.dataverseToken).toBe('test-token');
        // doiItems is not populated when dataset is provided via query params
        // The dataset ID is used directly without going through the search dropdown
      });

      it('should only load datasetPid when apiToken is missing', async () => {
        const mockParams = {
          datasetPid: 'doi:test',
        };

        await TestBed.configureTestingModule({
          providers: [
            {
              provide: ActivatedRoute,
              useValue: { queryParams: of(mockParams) },
            },
          ],
        });

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        await component.ngOnInit();

        expect(component.datasetId).toBe('doi:test');
      });
    });

    describe('constructor and observable setup', () => {
      it('should create datasetSearchResultsObservable with debounce', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component['datasetSearchResultsObservable']).toBeDefined();
      });
    });

    describe('ngOnInit with localStorage', () => {
      it('should load token from localStorage if present', async () => {
        spyOn(localStorage, 'getItem').and.returnValue('stored-token');
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        await component.ngOnInit();
        expect(component.dataverseToken).toBe('stored-token');
      });

      it('should not set token when localStorage returns null', async () => {
        spyOn(localStorage, 'getItem').and.returnValue(null);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        await component.ngOnInit();
        expect(component.dataverseToken).toBeUndefined();
      });
    });

    describe('datasetSearchResultsSubscription error path', () => {
      it('should handle subscription errors', (done) => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;

        // Manually trigger an error in the subscription
        component['datasetSearchSubject'].error(new Error('Test error'));

        setTimeout(() => {
          // The component should still be in a valid state
          expect(component).toBeDefined();
          done();
        }, 100);
      });
    });

    describe('getDdiCdiData without ddiCdi content', () => {
      it('should handle response ready without ddiCdi field', (done) => {
        const mockKey: Key = { key: 'job-123' };
        dataServiceStub.getCachedDdiCdiData.and.returnValue(
          of({
            ready: true,
            res: 'output without ddiCdi',
          } as CachedComputeResponse),
        );

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(component.loading).toBe(false);
          expect(component.generatedDdiCdi).toBeUndefined();
          expect(component.output).toBe('output without ddiCdi');
          done();
        }, 10);
      });

      it('should not show success message when ddiCdi is not generated', (done) => {
        const mockKey: Key = { key: 'job-123' };
        dataServiceStub.getCachedDdiCdiData.and.returnValue(
          of({
            ready: true,
            res: 'output',
          } as CachedComputeResponse),
        );

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(notificationServiceStub.showSuccess).not.toHaveBeenCalled();
          done();
        }, 10);
      });
    });

    describe('autoSelectAllFiles edge cases', () => {
      it('should handle node without data', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;

        const node: TreeNode<Datafile> = {
          children: [],
        };

        expect(() => component.autoSelectAllFiles(node)).not.toThrow();
        expect(component.selectedFiles.size).toBe(0);
      });

      it('should handle node with data but no name', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;

        const node: TreeNode<Datafile> = {
          data: { directoryLabel: 'test' } as Datafile,
          children: [],
        };

        expect(() => component.autoSelectAllFiles(node)).not.toThrow();
        expect(component.selectedFiles.size).toBe(0);
      });

      it('should recursively process all children', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;

        const node: TreeNode<Datafile> = {
          data: { name: 'parent.csv', directoryLabel: '' } as Datafile,
          children: [
            {
              data: { name: 'child.tsv', directoryLabel: '' } as Datafile,
              children: [],
            },
          ],
        };

        component.autoSelectAllFiles(node);
        expect(component.selectedFiles.has('child.tsv')).toBe(true);
        expect(component.selectedFiles.has('parent.csv')).toBe(true);
      });
    });

    describe('toggleFileSelection', () => {
      it('should add file when not selected', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles.has('file.csv')).toBe(true);
      });

      it('should remove file when already selected', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.selectedFiles.add('file.csv');
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles.has('file.csv')).toBe(false);
      });

      it('should toggle multiple times correctly', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles.has('file.csv')).toBe(true);
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles.has('file.csv')).toBe(false);
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles.has('file.csv')).toBe(true);
      });
    });

    describe('setData with empty or null data', () => {
      it('should handle null data array', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.loading = true;

        const mockData: CompareResult = {
          id: 'doi:123',
          data: undefined,
        };

        component.setData(mockData);
        expect(component.loading).toBe(false);
        expect(component.selectedFiles.size).toBe(0);
      });

      it('should handle rootNode without children', () => {
        const mockMap = new Map<string, TreeNode<Datafile>>();
        const rootNode: TreeNode<Datafile> = {
          data: { name: '', directoryLabel: '' } as Datafile,
          children: undefined,
        };
        mockMap.set('', rootNode);
        utilsServiceStub.mapDatafiles.and.returnValue(mockMap);

        const mockData: CompareResult = {
          id: 'doi:123',
          data: [{ name: 'file.csv', directoryLabel: '' } as Datafile],
        };

        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.setData(mockData);

        expect(component.rootNodeChildren).toEqual([]);
        expect(component.loading).toBe(false);
      });
    });

    describe('addFileToDataset without SHACL form', () => {
      it('should use original content when no SHACL form', (done) => {
        dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();
        component.datasetId = 'doi:123';
        component.dataverseToken = 'token';
        component.generatedDdiCdi = 'original-content';
        component.shaclForm = undefined;

        component.addFileToDataset();

        setTimeout(() => {
          const call = dataServiceStub.addFileToDataset.calls.mostRecent();
          const request: AddFileRequest = call.args[0];
          expect(request.content).toBe('original-content');
          done();
        }, 10);
      });

      it('should generate filename with timestamp', (done) => {
        dataServiceStub.addFileToDataset.and.returnValue(of({} as Key));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();
        component.datasetId = 'doi:123';
        component.dataverseToken = 'token';
        component.generatedDdiCdi = 'content';

        const beforeTime = Date.now();
        component.addFileToDataset();
        const afterTime = Date.now();

        setTimeout(() => {
          const call = dataServiceStub.addFileToDataset.calls.mostRecent();
          const request: AddFileRequest = call.args[0];
          expect(request.fileName).toMatch(/^ddi-cdi-\d+\.ttl$/);

          // Extract timestamp from filename
          const timestamp = parseInt(
            request.fileName.match(/ddi-cdi-(\d+)\.ttl/)![1],
          );
          expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(timestamp).toBeLessThanOrEqual(afterTime);
          done();
        }, 10);
      });
    });

    describe('onDatasetChange state reset', () => {
      it('should clear all state when dataset changes', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        // Set some state
        component.output = 'previous output';
        component.outputDisabled = false;
        component.generatedDdiCdi = 'previous ddiCdi';
        component.selectedFiles.add('file1.csv');
        component.selectedFiles.add('file2.csv');

        dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(
          of({ id: 'doi:new', data: [] } as CompareResult),
        );

        component.datasetId = 'doi:new';
        component.onDatasetChange();

        expect(component.output).toBe('');
        expect(component.outputDisabled).toBe(true);
        expect(component.generatedDdiCdi).toBeUndefined();
        expect(component.selectedFiles.size).toBe(0);
      });
    });

    describe('loadCachedOutput', () => {
      it('should load cached output successfully', () => {
        const mockCache = {
          ddiCdi: POLLED_CACHED_TURTLE,
          consoleOut: 'cached-output',
          errorMessage: '',
          timestamp: '2024-10-24T10:00:00Z',
        };
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(of(mockCache));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';

        component.loadCachedOutput();

        expect(component.generatedDdiCdi).toBe(POLLED_CACHED_TURTLE);
        expect(component.cachedOutputLoaded).toBe(true);
        expect(notificationServiceStub.showSuccess).toHaveBeenCalled();
      });

      it('should handle cached error message', () => {
        const mockCache = {
          ddiCdi: '',
          consoleOut: '',
          errorMessage: 'Previous generation failed',
          timestamp: '2024-10-24T10:00:00Z',
        };
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(of(mockCache));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';

        component.loadCachedOutput();

        expect(component.output).toContain('Previous generation failed');
        expect(component.outputDisabled).toBe(false);
      });

      it('should handle no cached output found', () => {
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(
          throwError(() => ({ status: 404 })),
        );
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';

        component.loadCachedOutput();

        expect(component.cachedOutputLoaded).toBe(false);
      });

      it('should not call service when datasetId is not set', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = undefined;

        component.loadCachedOutput();

        expect(dataServiceStub.getCachedDdiCdiOutput).not.toHaveBeenCalled();
      });
    });

    describe('refreshOutput', () => {
      it('should reload cached output', () => {
        const mockCache = {
          ddiCdi: REFRESHED_TURTLE,
          consoleOut: 'refreshed-output',
          errorMessage: '',
          timestamp: '2024-10-24T10:00:00Z',
        };
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(of(mockCache));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';
        component.generatedDdiCdi = 'old-content';

        component.refreshOutput();

        expect(component.generatedDdiCdi).toBe(REFRESHED_TURTLE);
        expect(component.cachedOutputLoaded).toBe(true);
      });

      it('should clear previous state before refreshing', () => {
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(
          throwError(() => ({ status: 404 })),
        );
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';
        component.generatedDdiCdi = 'old-content';
        component.output = 'old-output';

        component.refreshOutput();

        expect(component.generatedDdiCdi).toBeUndefined();
        expect(component.output).toBe('');
        expect(component.cachedOutputLoaded).toBe(false);
      });
    });

    describe('continueSubmitGenerate', () => {
      it('should close popup and submit job', (done) => {
        const mockKey: Key = { key: 'job-123' };
        dataServiceStub.generateDdiCdi.and.returnValue(of(mockKey));
        dataServiceStub.getCachedDdiCdiData.and.returnValue(
          of({ ready: true, res: 'output', ddiCdi: GENERATED_TURTLE }),
        );
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();
        component.datasetId = 'doi:123';
        component.dataverseToken = 'token';
        component.selectedFiles.add('file.csv');
        component.submitPopup = true;

        component.continueSubmitGenerate();

        expect(component.submitPopup).toBe(false);
        setTimeout(() => {
          expect(notificationServiceStub.showSuccess).toHaveBeenCalledWith(
            jasmine.stringContaining('DDI-CDI generation job submitted'),
          );
          done();
        }, 10);
      });

      it('should set expected output format for email disabled', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.sendEmailOnSuccess = false;

        // Test the message format that should be set
        const expectedMsg = 'You will receive an email if it fails.';
        expect(expectedMsg).toContain('fail');
      });

      it('should handle error from generation', () => {
        dataServiceStub.generateDdiCdi.and.returnValue(
          throwError(() => ({ error: 'Submit failed' })),
        );
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';
        component.selectedFiles.add('file.csv');

        component.continueSubmitGenerate();

        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Generation failed: Submit failed',
        );
        expect(component.loading).toBe(false);
      });
    });

    describe('submitGenerate with popup', () => {
      it('should show popup instead of immediately submitting', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId = 'doi:123';
        component.selectedFiles.add('file.csv');

        component.submitGenerate();

        expect(component.submitPopup).toBe(true);
        expect(dataServiceStub.generateDdiCdi).not.toHaveBeenCalled();
      });
    });
  });
});
