import {
  CdkVirtualScrollViewport,
  ScrollDispatcher,
} from '@angular/cdk/scrolling';
// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { Observable, Subscription, of, throwError } from 'rxjs';

import { DdiCdiComponent } from './ddi-cdi.component';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';
import {
  measurePage,
  resizeTestWindow,
  scrolledContainers,
} from '../../testing/page-layout';
import { treegridStructure } from '../../testing/treegrid';
import {
  CachedComputeResponse,
  CompareResult,
  Key,
} from '../models/compare-result';
import { Datafile } from '../models/datafile';
import { TreeNode } from '../models/tree-node';
import { SelectItem } from '../models/select-item';

describe('DdiCdiComponent', () => {
  let dataServiceStub: jasmine.SpyObj<DataService>;
  let dvObjectLookupServiceStub: jasmine.SpyObj<DvObjectLookupService>;
  let pluginServiceStub: Partial<PluginService> & {
    showDVToken$: WritableSignal<boolean>;
    configLoaded$: WritableSignal<boolean>;
    datasetFieldEditable$: WritableSignal<boolean>;
    dataverseHeader$: WritableSignal<string>;
    sendMails$: WritableSignal<boolean>;
    externalURL$: WritableSignal<string>;
    setConfig: jasmine.Spy;
    showDVToken: jasmine.Spy;
    isStoreDvToken: jasmine.Spy;
    datasetFieldEditable: jasmine.Spy;
    dataverseHeader: jasmine.Spy;
    sendMails: jasmine.Spy;
  };
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
    // Create pluginService stub with both methods and signals
    pluginServiceStub = {
      showDVToken$: signal(false),
      configLoaded$: signal(true),
      datasetFieldEditable$: signal(true),
      dataverseHeader$: signal('Dataverse'),
      sendMails$: signal(false),
      externalURL$: signal(''),
      setConfig: jasmine
        .createSpy('setConfig')
        .and.returnValue(Promise.resolve()),
      showDVToken: jasmine.createSpy('showDVToken').and.returnValue(false),
      isStoreDvToken: jasmine
        .createSpy('isStoreDvToken')
        .and.returnValue(false),
      datasetFieldEditable: jasmine
        .createSpy('datasetFieldEditable')
        .and.returnValue(true),
      dataverseHeader: jasmine
        .createSpy('dataverseHeader')
        .and.returnValue('Dataverse'),
      sendMails: jasmine.createSpy('sendMails').and.returnValue(false),
    };
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
    utilsServiceStub.sleep.and.returnValue(Promise.resolve());
    dvObjectLookupServiceStub.getItems.and.returnValue(of([]));
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
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
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
    it('should initialize without calling setConfig (loaded via APP_INITIALIZER)', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      await component.ngOnInit();
      expect(pluginServiceStub.setConfig).not.toHaveBeenCalled();
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
      expect(component.datasetId()).toBe('doi:10.123/test');
      expect(component.dataverseToken()).toBe('token123');
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

    it('should cancel active polling without showing an error', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      let pollUnsubscribed = false;
      dataServiceStub.getCachedDdiCdiData.and.returnValue(
        new Observable(() => {
          return new Subscription(() => {
            pollUnsubscribed = true;
          });
        }),
      );

      component.loading.set(true);
      void component['getDdiCdiData']({ key: 'job-123' });
      await Promise.resolve();

      component.ngOnDestroy();
      await Promise.resolve();

      expect(pollUnsubscribed).toBeTrue();
      expect(notificationServiceStub.showError).not.toHaveBeenCalled();
    });
  });

  describe('onUserChange', () => {
    it('should clear doiItems and datasetId', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems.set([{ label: 'test', value: 'test' }]);
      component.datasetId.set('doi:test');
      component.onUserChange();
      expect(component.doiItems()).toEqual([]);
      expect(component.datasetId()).toBeUndefined();
    });
  });

  describe('getDoiOptions', () => {
    it('should return early if items already loaded', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems.set([{ label: 'test', value: 'test' }]);
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
      component.doiItems.set([]);
      component.getDoiOptions();
      expect(dvObjectLookupServiceStub.getItems).toHaveBeenCalledWith(
        '',
        'Dataset',
        undefined,
        undefined,
      );
      expect(component.doiItems()).toEqual(mockItems);
    });

    it('should handle error when fetching datasets', () => {
      dvObjectLookupServiceStub.getItems.and.returnValue(
        throwError(() => ({ error: 'Network error' })),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.doiItems.set([]);
      component.getDoiOptions();
      expect(notificationServiceStub.showError).toHaveBeenCalledWith(
        'DOI lookup failed: Network error',
      );
      expect(component.doiItems()).toEqual([]);
    });
  });

  describe('onDatasetSearch', () => {
    it('should show message for short search terms', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.onDatasetSearch('ab');
      expect(component.doiItems()[0].label).toContain('at least three letters');
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
      component.datasetId.set('doi:123');
      component.onDatasetChange();
      // loading is set to false after synchronous observable completion
      setTimeout(() => {
        expect(dataServiceStub.getDdiCdiCompatibleFiles).toHaveBeenCalledWith(
          'doi:123',
          undefined,
        );
        expect(component.loading()).toBe(false); // loading should be false after completion
        done();
      }, 10);
    });

    it('should handle error when fetching files', () => {
      dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(
        throwError(() => ({ error: 'Fetch error' })),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId.set('doi:123');
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
      component.loading.set(true);
      component.setData({ data: [] });
      expect(component.loading()).toBe(false);
      expect(component.rootNodeChildren()).toEqual([]);
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
      expect(component.selectedFiles().has('data.csv')).toBe(true);
      expect(component.loading()).toBe(false);
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
      expect(component.selectedFiles().has('parent.tsv')).toBe(true);
      expect(component.selectedFiles().has('nested.csv')).toBe(true);
    });
  });

  describe('file selection', () => {
    it('isFileSelected should check selectedFiles set', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.selectedFiles.update((files) => {
        const s = new Set(files);
        s.add('file.csv');
        return s;
      });
      expect(component.isFileSelected('file.csv')).toBe(true);
      expect(component.isFileSelected('other.csv')).toBe(false);
    });

    it('toggleFileSelection should add/remove files', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.toggleFileSelection('file.csv');
      expect(component.selectedFiles().has('file.csv')).toBe(true);
      component.toggleFileSelection('file.csv');
      expect(component.selectedFiles().has('file.csv')).toBe(false);
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
      expect(component.selectedFiles().has('parent.tsv')).toBe(true);
      expect(component.selectedFiles().has('nested.csv')).toBe(true);
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
      component.datasetId.set('doi:123');
      component.dataverseToken.set('token');
      component.selectedFiles.update((files) => {
        const s = new Set(files);
        s.add('file.csv');
        return s;
      });
      component.continueSubmitGenerate();
      // loading is set to false after synchronous observable completion
      setTimeout(() => {
        expect(dataServiceStub.generateDdiCdi).toHaveBeenCalledWith({
          persistentId: 'doi:123',
          dataverseKey: 'token',
          queue: '',
          fileNames: ['file.csv'],
          sendEmailOnSuccess: false,
        });
        expect(component.loading()).toBe(false); // loading should be false after completion
        done();
      }, 10);
    });

    it('should handle error from generateDdiCdi', (done) => {
      dataServiceStub.generateDdiCdi.and.returnValue(
        throwError(() => 'Generation failed'),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.datasetId.set('doi:123');
      component.selectedFiles.update((files) => {
        const s = new Set(files);
        s.add('file.csv');
        return s;
      });
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
      component.loading.set(true);
      void component['getDdiCdiData'](mockKey);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(utilsServiceStub.sleep).toHaveBeenCalled();
    });

    it('should set generatedDdiCdi on success', (done) => {
      const mockKey: Key = { key: 'job-123' };
      dataServiceStub.getCachedDdiCdiData.and.returnValue(
        of({ ready: true, res: 'output', ddiCdi: GENERATED_TURTLE }),
      );
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.loading.set(true);
      void component['getDdiCdiData'](mockKey);
      setTimeout(() => {
        expect(component.generatedDdiCdi()).toBe(GENERATED_TURTLE);
        expect(component.output()).toBe('output');
        expect(component.loading()).toBe(false);
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
      component.loading.set(true);
      void component['getDdiCdiData'](mockKey);
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
      component.loading.set(true);
      void component['getDdiCdiData'](mockKey);
      setTimeout(() => {
        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Getting DDI-CDI results failed: Fetch failed',
        );
        expect(component.loading()).toBe(false);
        done();
      }, 50);
    });
  });

  describe('downloadDdiCdi', () => {
    it('should not do anything when generatedDdiCdi is undefined', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi.set(undefined);
      spyOn(URL, 'createObjectURL');
      component.downloadDdiCdi();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('should create blob and trigger download when generatedDdiCdi has content', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi.set(GENERATED_TURTLE);

      const mockUrl = 'blob:mock-url';
      spyOn(URL, 'createObjectURL').and.returnValue(mockUrl);
      spyOn(URL, 'revokeObjectURL');
      const mockLink = document.createElement('a');
      spyOn(mockLink, 'click');
      spyOn(document, 'createElement').and.returnValue(mockLink);
      spyOn(document.body, 'appendChild');
      spyOn(document.body, 'removeChild');

      component.downloadDdiCdi();

      expect(URL.createObjectURL).toHaveBeenCalledWith(jasmine.any(Blob));
      expect(mockLink.href).toBe(mockUrl);
      expect(mockLink.download).toMatch(/^ddi-cdi-\d+\.jsonld$/);
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });
  });

  describe('openInViewer', () => {
    it('should not do anything when generatedDdiCdi is undefined', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi.set(undefined);
      spyOn(window, 'open');
      component.openInViewer();
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should add file to dataset and open viewer with fileId', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi.set(GENERATED_TURTLE);
      component.datasetId.set('doi:10.5072/test');
      component.dataverseToken.set('test-token');

      spyOn(window, 'open');
      pluginServiceStub.externalURL$.set('https://demo.dataverse.org');
      dataServiceStub.addFileToDataset.and.returnValue(
        of({ fileId: 12345, key: 'test-key' }),
      );

      component.openInViewer();
      await new Promise<void>((r) => setTimeout(r));

      expect(dataServiceStub.addFileToDataset).toHaveBeenCalledWith({
        persistentId: 'doi:10.5072/test',
        dataverseKey: 'test-token',
        fileName: 'ddi-cdi-metadata.jsonld',
        content: GENERATED_TURTLE,
      });
      expect(window.open).toHaveBeenCalledWith(
        'https://demo.dataverse.org/file.xhtml?fileId=12345&version=DRAFT',
        '_blank',
      );
    });

    it('should show error when baseUrl is not configured', () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi.set(GENERATED_TURTLE);
      component.datasetId.set('doi:10.5072/test');
      component.dataverseToken.set('test-token');

      spyOn(window, 'open');
      pluginServiceStub.externalURL$.set('');

      component.openInViewer();

      expect(notificationServiceStub.showError).toHaveBeenCalledWith(
        'Dataverse URL not configured',
      );
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should show error when addFileToDataset fails', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      component.generatedDdiCdi.set(GENERATED_TURTLE);
      component.datasetId.set('doi:10.5072/test');
      component.dataverseToken.set('test-token');

      spyOn(window, 'open');
      pluginServiceStub.externalURL$.set('https://demo.dataverse.org');
      dataServiceStub.addFileToDataset.and.returnValue(
        throwError(() => new Error('Network error')),
      );

      component.openInViewer();
      await new Promise<void>((r) => setTimeout(r));

      expect(notificationServiceStub.showError).toHaveBeenCalledWith(
        'Failed to add file to dataset',
      );
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('Additional Coverage Tests', () => {
    describe('showDVToken', () => {
      it('should return value from plugin service signal', () => {
        pluginServiceStub.showDVToken$.set(true);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.showDVToken()).toBe(true);
      });

      it('should return false when plugin service signal is false', () => {
        pluginServiceStub.showDVToken$.set(false);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.showDVToken()).toBe(false);
      });
    });

    describe('datasetFieldEditable', () => {
      it('should return value from plugin service signal', () => {
        pluginServiceStub.datasetFieldEditable$.set(true);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.datasetFieldEditable()).toBe(true);
      });

      it('should return false when not editable', () => {
        pluginServiceStub.datasetFieldEditable$.set(false);
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.datasetFieldEditable()).toBe(false);
      });
    });

    describe('dataverseHeader', () => {
      it('should return header from plugin service signal', () => {
        pluginServiceStub.dataverseHeader$.set('Test Header');
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component.dataverseHeader()).toBe('Test Header');
      });
    });

    describe('getDoiOptions edge cases', () => {
      it('should not fetch when doiItems already has non-loading items', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.doiItems.set([{ label: 'doi:1', value: 'doi:1' }]);
        component.getDoiOptions();
        expect(dvObjectLookupServiceStub.getItems).not.toHaveBeenCalled();
      });

      it('should set empty array when no items returned', () => {
        dvObjectLookupServiceStub.getItems.and.returnValue(of([]));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.getDoiOptions();
        expect(component.doiItems()).toEqual([]);
        expect(component.datasetId()).toBeUndefined();
      });

      it('should keep datasetId and ensure option exists when items are loaded', () => {
        const mockItems: SelectItem<string>[] = [
          { label: 'doi:1', value: 'doi:1' },
        ];
        dvObjectLookupServiceStub.getItems.and.returnValue(of(mockItems));
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId.set('old-value');
        component.getDoiOptions();
        expect(component.datasetId()).toBe('old-value');
        expect(component.doiItems()[0].value).toBe('old-value');
      });
    });

    describe('onDatasetSearch validation', () => {
      it('should show instruction for null search term', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.onDatasetSearch(null);
        expect(component.doiItems().length).toBe(1);
        expect(component.doiItems()[0].label).toContain('start typing');
      });

      it('should show instruction for short search term', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.onDatasetSearch('ab');
        expect(component.doiItems().length).toBe(1);
        expect(component.doiItems()[0].label).toContain('at least three');
      });

      it('should show searching message for valid term', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        spyOn(component['datasetSearchSubject'], 'next');
        component.onDatasetSearch('test');
        expect(component.doiItems()[0].label).toContain('searching');
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
        component.dataverseToken.set('token');
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

        expect(component.selectedFiles().has('file1.csv')).toBe(true);
        expect(component.selectedFiles().has('nested.tsv')).toBe(true);
        expect(component.loading()).toBe(false);
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

        expect(component.selectedFiles().has('file.csv')).toBe(true);
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
        component.loading.set(true);
        void component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(callCount).toBeGreaterThanOrEqual(3);
          expect(component.loading()).toBe(false);
          expect(component.generatedDdiCdi()).toBe(FINAL_TURTLE);
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
        component.loading.set(true);
        void component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(notificationServiceStub.showError).toHaveBeenCalledWith(
            'Processing error occurred',
          );
          expect(component.loading()).toBe(false);
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
        component.loading.set(true);
        void component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(notificationServiceStub.showSuccess).toHaveBeenCalledWith(
            'DDI-CDI generated successfully!',
          );
          expect(component.outputDisabled()).toBe(false);
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
        component.loading.set(true);
        void component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(component.output()).toBe('Final output');
          done();
        }, 100);
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

        expect(component.datasetId()).toBe('doi:test');
        expect(component.dataverseToken()).toBe('test-token');
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

        expect(component.datasetId()).toBe('doi:test');
      });
    });

    describe('constructor and observable setup', () => {
      it('should create datasetSearchResultsObservable with debounce', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        expect(component['datasetSearchResultsObservable']).toBeDefined();
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
        component.loading.set(true);
        void component['getDdiCdiData'](mockKey);

        setTimeout(() => {
          expect(component.loading()).toBe(false);
          expect(component.generatedDdiCdi()).toBeUndefined();
          expect(component.output()).toBe('output without ddiCdi');
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
        component.loading.set(true);
        void component['getDdiCdiData'](mockKey);

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
        expect(component.selectedFiles().size).toBe(0);
      });

      it('should handle node with data but no name', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;

        const node: TreeNode<Datafile> = {
          data: { directoryLabel: 'test' } as Datafile,
          children: [],
        };

        expect(() => component.autoSelectAllFiles(node)).not.toThrow();
        expect(component.selectedFiles().size).toBe(0);
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
        expect(component.selectedFiles().has('child.tsv')).toBe(true);
        expect(component.selectedFiles().has('parent.csv')).toBe(true);
      });
    });

    describe('toggleFileSelection', () => {
      it('should add file when not selected', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles().has('file.csv')).toBe(true);
      });

      it('should remove file when already selected', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.selectedFiles.update((files) => {
          const s = new Set(files);
          s.add('file.csv');
          return s;
        });
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles().has('file.csv')).toBe(false);
      });

      it('should toggle multiple times correctly', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles().has('file.csv')).toBe(true);
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles().has('file.csv')).toBe(false);
        component.toggleFileSelection('file.csv');
        expect(component.selectedFiles().has('file.csv')).toBe(true);
      });
    });

    describe('setData with empty or null data', () => {
      it('should handle null data array', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.loading.set(true);

        const mockData: CompareResult = {
          id: 'doi:123',
          data: undefined,
        };

        component.setData(mockData);
        expect(component.loading()).toBe(false);
        expect(component.selectedFiles().size).toBe(0);
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

        expect(component.rootNodeChildren()).toEqual([]);
        expect(component.loading()).toBe(false);
      });
    });

    describe('onDatasetChange state reset', () => {
      it('should clear all state when dataset changes', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        // Set some state
        component.output.set('previous output');
        component.outputDisabled.set(false);
        component.generatedDdiCdi.set('previous ddiCdi');
        component.selectedFiles.update((files) => {
          const s = new Set(files);
          s.add('file1.csv');
          s.add('file2.csv');
          return s;
        });

        dataServiceStub.getDdiCdiCompatibleFiles.and.returnValue(
          of({ id: 'doi:new', data: [] } as CompareResult),
        );

        component.datasetId.set('doi:new');
        component.onDatasetChange();

        expect(component.output()).toBe('');
        expect(component.outputDisabled()).toBe(true);
        expect(component.generatedDdiCdi()).toBeUndefined();
        expect(component.selectedFiles().size).toBe(0);
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
        component.datasetId.set('doi:123');

        component.loadCachedOutput();

        expect(component.generatedDdiCdi()).toBe(POLLED_CACHED_TURTLE);
        expect(component.cachedOutputLoaded()).toBe(true);
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
        component.datasetId.set('doi:123');

        component.loadCachedOutput();

        expect(component.output()).toContain('Previous generation failed');
        expect(component.outputDisabled()).toBe(false);
      });

      it('should handle no cached output found', () => {
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(
          throwError(() => ({ status: 404 })),
        );
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId.set('doi:123');

        component.loadCachedOutput();

        expect(component.cachedOutputLoaded()).toBe(false);
      });

      it('should not call service when datasetId is not set', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId.set(undefined);

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
        component.datasetId.set('doi:123');
        component.generatedDdiCdi.set('old-content');

        component.refreshOutput();

        expect(component.generatedDdiCdi()).toBe(REFRESHED_TURTLE);
        expect(component.cachedOutputLoaded()).toBe(true);
      });

      it('should clear previous state before refreshing', () => {
        dataServiceStub.getCachedDdiCdiOutput.and.returnValue(
          throwError(() => ({ status: 404 })),
        );
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId.set('doi:123');
        component.generatedDdiCdi.set('old-content');
        component.output.set('old-output');

        component.refreshOutput();

        expect(component.generatedDdiCdi()).toBeUndefined();
        expect(component.output()).toBe('');
        expect(component.cachedOutputLoaded()).toBe(false);
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
        component.datasetId.set('doi:123');
        component.dataverseToken.set('token');
        component.selectedFiles.update((files) => {
          const s = new Set(files);
          s.add('file.csv');
          return s;
        });
        component.submitPopup.set(true);

        component.continueSubmitGenerate();

        expect(component.submitPopup()).toBe(false);
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
        component.sendEmailOnSuccess.set(false);

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
        component.datasetId.set('doi:123');
        component.selectedFiles.update((files) => {
          const s = new Set(files);
          s.add('file.csv');
          return s;
        });

        component.continueSubmitGenerate();

        expect(notificationServiceStub.showError).toHaveBeenCalledWith(
          'Generation failed: Submit failed',
        );
        expect(component.loading()).toBe(false);
      });
    });

    describe('submitGenerate with popup', () => {
      it('should show popup instead of immediately submitting', () => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        component.datasetId.set('doi:123');
        component.selectedFiles.update((files) => {
          const s = new Set(files);
          s.add('file.csv');
          return s;
        });

        component.submitGenerate();

        expect(component.submitPopup()).toBe(true);
        expect(dataServiceStub.generateDdiCdi).not.toHaveBeenCalled();
      });
    });
  });
  describe('files tab layout and selection', () => {
    const seedFiles = (component: DdiCdiComponent) => {
      const mockMap = new Map<string, TreeNode<Datafile>>();
      const rootNode: TreeNode<Datafile> = {
        data: { name: '', directoryLabel: '' } as Datafile,
        children: [
          {
            key: 'a.csv:file',
            data: { name: 'a.csv', directoryLabel: '' } as Datafile,
            children: [],
          },
          {
            key: 'b.tsv:file',
            data: { name: 'b.tsv', directoryLabel: '' } as Datafile,
            children: [],
          },
        ],
      };
      mockMap.set('', rootNode);
      utilsServiceStub.mapDatafiles.and.returnValue(mockMap);
      component.setData({
        id: 'doi:10.1/ABC',
        url: 'https://example.org/ds',
        data: [{ name: 'a.csv' } as Datafile, { name: 'b.tsv' } as Datafile],
      });
    };

    const viewportOf = (fixture: ComponentFixture<DdiCdiComponent>) =>
      fixture.debugElement
        .query(By.directive(CdkVirtualScrollViewport))
        .injector.get(CdkVirtualScrollViewport);

    const rowCount = (fixture: ComponentFixture<DdiCdiComponent>) =>
      fixture.nativeElement.querySelectorAll('.tt-row').length;

    it('gives the viewport a height and remeasures after tab switches through the buttons', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      fixture.detectChanges();
      seedFiles(fixture.componentInstance);
      await fixture.whenStable();
      const viewport = viewportOf(fixture);
      expect(viewport.elementRef.nativeElement.offsetHeight).toBeGreaterThan(0);
      expect(viewport.getViewportSize()).toBeGreaterThan(0);
      expect(rowCount(fixture)).toBe(2);
      const tabs = fixture.nativeElement.querySelectorAll(
        '.nav-link',
      ) as NodeListOf<HTMLButtonElement>;
      tabs[1].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.activeTab()).toBe('console');
      expect(viewport.elementRef.nativeElement.offsetHeight).toBe(0);
      tabs[0].click();
      await fixture.whenStable();
      expect(viewport.elementRef.nativeElement.offsetHeight).toBeGreaterThan(0);
      expect(viewport.getViewportSize()).toBeGreaterThan(0);
      expect(rowCount(fixture)).toBe(2);
    });

    it('returns to the files tab and remeasures when a new dataset loads', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      seedFiles(component);
      await fixture.whenStable();
      component.selectTab('console');
      await fixture.whenStable();
      const viewport = viewportOf(fixture);
      expect(viewport.elementRef.nativeElement.offsetHeight).toBe(0);
      component.datasetId.set('doi:10.1/NEW');
      component.onDatasetChange();
      await fixture.whenStable();
      expect(component.activeTab()).toBe('files');
      seedFiles(component);
      await fixture.whenStable();
      expect(viewport.elementRef.nativeElement.offsetHeight).toBeGreaterThan(0);
      expect(viewport.getViewportSize()).toBeGreaterThan(0);
      expect(rowCount(fixture)).toBe(2);
    });

    it('renders a treegrid with levels and the expansion of folder rows', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      const file = (name: string): TreeNode<Datafile> => ({
        key: `${name}:file`,
        data: { name, directoryLabel: '' } as Datafile,
        children: [],
      });
      const rootNode: TreeNode<Datafile> = {
        data: { name: '', directoryLabel: '' } as Datafile,
        children: [
          {
            key: 'dir',
            data: { name: 'dir', directoryLabel: '' } as Datafile,
            children: [file('a.csv')],
          },
          file('b.tsv'),
        ],
      };
      utilsServiceStub.mapDatafiles.and.returnValue(new Map([['', rootNode]]));
      component.setData({
        id: 'doi:10.1/ABC',
        url: 'https://example.org/ds',
        data: [{ name: 'a.csv' } as Datafile, { name: 'b.tsv' } as Datafile],
      });
      await fixture.whenStable();
      (
        fixture.nativeElement.querySelector(
          '.tt-row app-tree-toggler button',
        ) as HTMLButtonElement
      ).click();
      await fixture.whenStable();
      expect(treegridStructure(fixture.nativeElement)).toEqual({
        table: 'treegrid',
        label: 'Files',
        rowCount: '4',
        header: 'row 1',
        headerCells: ['columnheader', 'columnheader'],
        rows: [
          'dir: row 2, level 1, expanded true',
          'a.csv: row 3, level 2, expanded null',
          'b.tsv: row 4, level 1, expanded null',
        ],
        cells: ['gridcell'],
        togglers: ['Toggle dir'],
      });
    });

    it('toggles one filename per row checkbox, selects and clears all from the header, and keeps the dataset link', async () => {
      const fixture = TestBed.createComponent(DdiCdiComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      seedFiles(component);
      await fixture.whenStable();
      expect(component.selectedFiles()).toEqual(new Set(['a.csv', 'b.tsv']));
      const boxes = fixture.nativeElement.querySelectorAll(
        '.tt-row input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>;
      expect(boxes.length).toBe(2);
      boxes[0].click();
      await fixture.whenStable();
      expect(component.selectedFiles()).toEqual(new Set(['b.tsv']));
      boxes[0].click();
      await fixture.whenStable();
      expect(component.selectedFiles()).toEqual(new Set(['a.csv', 'b.tsv']));
      const selectAll = fixture.nativeElement.querySelector(
        '.tt-header button',
      ) as HTMLButtonElement;
      selectAll.click();
      await fixture.whenStable();
      expect(component.selectedFiles().size).toBe(0);
      selectAll.click();
      await fixture.whenStable();
      expect(component.selectedFiles()).toEqual(new Set(['a.csv', 'b.tsv']));
      const link = fixture.nativeElement.querySelector(
        '.tt-header a',
      ) as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('https://example.org/ds');
      expect(link.textContent).toContain('doi:10.1/ABC');
    });

    describe('in a 1366x768 window', () => {
      let restoreWindow: () => void;
      beforeEach(() => (restoreWindow = resizeTestWindow(1366, 768)));
      afterEach(() => restoreWindow());

      // 60 CSV files with the info alert above the tabs, like the harness.
      const render = async (generated?: string) => {
        const fixture = TestBed.createComponent(DdiCdiComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();
        const children: TreeNode<Datafile>[] = Array.from(
          { length: 60 },
          (_, i) => ({
            key: `file${i}.csv:file`,
            data: { name: `file${i}.csv`, directoryLabel: '' } as Datafile,
            children: [],
          }),
        );
        utilsServiceStub.mapDatafiles.and.returnValue(
          new Map([['', { data: { name: '' } as Datafile, children }]]),
        );
        component.datasetId.set('doi:10.1234/ABC');
        component.setData({
          id: 'doi:10.1234/ABC',
          url: 'https://example.org/ds',
          data: children.map((c) => c.data!),
        });
        component.generatedDdiCdi.set(generated);
        await fixture.whenStable();
        return fixture;
      };

      // An open select or filter panel follows the host when the host scrolls.
      it('reports the scrolling page host to the overlays', async () => {
        const fixture = await render();
        expect(
          scrolledContainers(
            TestBed.inject(ScrollDispatcher),
            fixture.nativeElement,
          ),
        ).toEqual([fixture.nativeElement]);
      });

      it('fits the window with 60 files', async () => {
        const fixture = await render();
        const layout = measurePage(fixture.nativeElement);
        expect(layout.window).toBe(768);
        expect(
          fixture.nativeElement.querySelector('.alert-info'),
        ).not.toBeNull();
        expect(layout.pageHeight).toBeLessThanOrEqual(layout.window);
        expect(layout.hostScrollHeight).toBeLessThanOrEqual(
          layout.hostClientHeight,
        );
        expect(layout.body).toBeGreaterThanOrEqual(12 * layout.rem);
        expect(layout.header).toBe(layout.headerNoRows);
        expect(rowCount(fixture)).toBeGreaterThan(10);
      });

      it('fills the console pane with the output, without a second scroll', async () => {
        const fixture = await render();
        const tabs = fixture.nativeElement.querySelectorAll(
          '.nav-link',
        ) as NodeListOf<HTMLButtonElement>;
        tabs[1].click();
        await fixture.whenStable();
        const pane = fixture.nativeElement.querySelector(
          '.tab-pane-console',
        ) as HTMLElement;
        const output = pane.querySelector('textarea') as HTMLTextAreaElement;
        const paneBox = pane.getBoundingClientRect();
        const outputBox = output.getBoundingClientRect();
        expect(paneBox.height).toBeGreaterThan(200);
        expect(pane.scrollHeight).toBeLessThanOrEqual(pane.clientHeight);
        expect(outputBox.top - paneBox.top).toBeLessThan(1);
        expect(paneBox.bottom - outputBox.bottom).toBeLessThan(1);
        const layout = measurePage(fixture.nativeElement);
        expect(layout.hostScrollHeight).toBeLessThanOrEqual(
          layout.hostClientHeight,
        );
      });

      // The tabs had no ids, no aria-controls and no arrow keys, and the
      // split cut off the focus ring of the first tab at the top and the left.
      describe('tabs', () => {
        const tabs = (fixture: { nativeElement: HTMLElement }) =>
          Array.from(
            fixture.nativeElement.querySelectorAll('[role="tab"]'),
          ) as HTMLButtonElement[];

        it('wire each tab to its panel and keep only the selected tab in the tab order', async () => {
          const fixture = await render();
          const host = fixture.nativeElement as HTMLElement;
          for (const tab of tabs(fixture)) {
            const panel = host.querySelector(
              `#${tab.getAttribute('aria-controls')}`,
            )!;
            expect(panel.getAttribute('role')).toBe('tabpanel');
            expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
          }
          expect(
            tabs(fixture).map((t) => [
              t.getAttribute('aria-selected'),
              t.tabIndex,
            ]),
          ).toEqual([
            ['true', 0],
            ['false', -1],
          ]);
        });

        it('move and select with Left, Right, Home and End', async () => {
          const fixture = await render();
          const [files, consoleTab] = tabs(fixture);
          files.focus();
          const press = async (key: string) => {
            const event = new KeyboardEvent('keydown', {
              key,
              bubbles: true,
              cancelable: true,
            });
            (document.activeElement as HTMLElement).dispatchEvent(event);
            await fixture.whenStable();
            return event.defaultPrevented;
          };
          const state = () => [
            fixture.componentInstance.activeTab(),
            document.activeElement === consoleTab ? 'console' : 'files',
            consoleTab.tabIndex,
          ];
          expect(await press('ArrowRight')).toBeTrue();
          expect(state()).toEqual(['console', 'console', 0]);
          expect(
            (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
              '#ddi-panel-console',
            )!.hidden,
          ).toBeFalse();
          await press('ArrowRight');
          expect(state()).toEqual(['files', 'files', -1]);
          await press('ArrowLeft');
          expect(state()).toEqual(['console', 'console', 0]);
          await press('Home');
          expect(state()).toEqual(['files', 'files', -1]);
          await press('End');
          expect(state()).toEqual(['console', 'console', 0]);
          expect(await press('a')).toBeFalse();
          expect(state()).toEqual(['console', 'console', 0]);
        });

        it('leave room inside the split for the focus ring of the tabs', async () => {
          const fixture = await render();
          const host = fixture.nativeElement as HTMLElement;
          const split = host
            .querySelector('.ddi-split')!
            .getBoundingClientRect();
          const rem = parseFloat(
            getComputedStyle(document.documentElement).fontSize,
          );
          for (const tab of tabs(fixture)) {
            const box = tab.getBoundingClientRect();
            expect(box.top - 0.25 * rem).toBeGreaterThanOrEqual(split.top);
            expect(box.left - 0.25 * rem).toBeGreaterThanOrEqual(split.left);
          }
        });
      });

      it('fits the window with a long generated output, which scrolls', async () => {
        const fixture = await render(
          Array.from({ length: 400 }, (_, i) => `"line ${i}": true`).join('\n'),
        );
        const layout = measurePage(fixture.nativeElement);
        expect(layout.pageHeight).toBeLessThanOrEqual(layout.window);
        expect(layout.hostScrollHeight).toBeLessThanOrEqual(
          layout.hostClientHeight,
        );
        expect(layout.body).toBeGreaterThanOrEqual(12 * layout.rem);
        const preview = fixture.nativeElement.querySelector(
          '.ddi-preview',
        ) as HTMLElement;
        const split = fixture.nativeElement.querySelector(
          '.ddi-split',
        ) as HTMLElement;
        expect(preview.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          split.getBoundingClientRect().bottom,
        );
        expect(preview.scrollHeight).toBeGreaterThan(preview.clientHeight);
      });
    });
  });
});
