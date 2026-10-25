import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withDisabledInitialNavigation,
} from '@angular/router';
import { of } from 'rxjs';
import { settlePromises } from '../testing/promises';
import { AppComponent } from './app.component';
import { DatasetService } from './dataset.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'datasync'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('datasync');
  });

  it('should check access to queue and hide compute link when access is false', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Mock the compute link element
    const mockElement = document.createElement('li');
    mockElement.id = 'navbar-compute-li';
    document.body.appendChild(mockElement);

    const mockUnsubscribe = jasmine.createSpy('unsubscribe');
    spyOn(app.dataService, 'checkAccessToQueue').and.returnValue({
      subscribe: (callbacks: any) => {
        // Call callbacks synchronously, then return subscription
        setTimeout(() => {
          callbacks.next({ access: false, message: '' });
        }, 0);
        return { unsubscribe: mockUnsubscribe };
      },
    } as any);

    jasmine.clock().install();
    try {
      app.ngOnInit();
      jasmine.clock().tick(100);
      expect(mockElement.style.display).toBe('none');
      expect(mockUnsubscribe).toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
      document.body.removeChild(mockElement);
    }
  });

  it('should hide compute link on error', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Mock the compute link element
    const mockElement = document.createElement('li');
    mockElement.id = 'navbar-compute-li';
    document.body.appendChild(mockElement);

    spyOn(app.dataService, 'checkAccessToQueue').and.returnValue({
      subscribe: (callbacks: any) => {
        setTimeout(() => {
          callbacks.error(new Error('test error'));
        }, 0);
        return { unsubscribe: () => {} };
      },
    } as any);

    jasmine.clock().install();
    try {
      app.ngOnInit();
      jasmine.clock().tick(100);
      expect(mockElement.style.display).toBe('none');
    } finally {
      jasmine.clock().uninstall();
      document.body.removeChild(mockElement);
    }
  });

  it('should not hide compute link when access is true', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Mock the compute link element
    const mockElement = document.createElement('li');
    mockElement.id = 'navbar-compute-li';
    document.body.appendChild(mockElement);

    const mockUnsubscribe = jasmine.createSpy('unsubscribe');
    spyOn(app.dataService, 'checkAccessToQueue').and.returnValue({
      subscribe: (callbacks: any) => {
        setTimeout(() => {
          callbacks.next({ access: true, message: '' });
        }, 0);
        return { unsubscribe: mockUnsubscribe };
      },
    } as any);

    jasmine.clock().install();
    try {
      app.ngOnInit();
      jasmine.clock().tick(100);
      expect(mockElement.style.display).not.toBe('none');
      expect(mockUnsubscribe).toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
      document.body.removeChild(mockElement);
    }
  });

  // App template contains only a router-outlet, so no visible title to assert.
});

/**
 * Test suite for isDownloadFlow detection
 * Tests the logic that determines if a URL should skip login redirect
 */
describe('AppComponent isDownloadFlow', () => {
  let component: AppComponent;
  let fixture: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  // Helper to access private method
  function callIsDownloadFlow(
    params: Record<string, string | undefined>,
    windowLocationHref?: string,
  ): boolean {
    // Mock window.location.href by setting a test property on component
    if (windowLocationHref) {
      (component as any)._testWindowLocationHref = windowLocationHref;
    }
    return (component as any).isDownloadFlow(params);
  }

  afterEach(() => {
    // Clean up test property
    delete (component as any)._testWindowLocationHref;
  });

  describe('when Angular routing works correctly', () => {
    it('should return true when router.url includes /download', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/download',
      );
      expect(callIsDownloadFlow({})).toBe(true);
    });

    it('should return true when callback param contains downloadId', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/connect',
      );
      // Base64 encoded: "https://example.com/api/v1/datasets/123/globusDownloadParameters?downloadId=abc"
      const callback = btoa(
        'https://example.com/api/v1/datasets/123/globusDownloadParameters?downloadId=abc',
      );
      expect(callIsDownloadFlow({ callback })).toBe(true);
    });

    it('should return true when state param contains download flag', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/connect',
      );
      const state = JSON.stringify({ download: true });
      expect(callIsDownloadFlow({ state })).toBe(true);
    });

    it('should return false for normal connect page', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/connect',
      );
      expect(callIsDownloadFlow({})).toBe(false);
    });

    it('should return false when callback is invalid base64', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/connect',
      );
      expect(callIsDownloadFlow({ callback: 'invalid!!!' })).toBe(false);
    });

    it('should return false when state is invalid JSON', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/connect',
      );
      expect(callIsDownloadFlow({ state: '{invalid-json' })).toBe(false);
    });
  });

  describe('when Angular routing fails (route not matched)', () => {
    // This is the actual bug scenario:
    // URL: /integration/connect/download?callback=...
    // router.url returns "/" (default)
    // params is {} (empty because routing failed)
    // But window.location.href still has the full URL

    it('should detect download from window.location when params are empty and URL contains /download', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/');
      const result = callIsDownloadFlow(
        {},
        'https://www.rdm.libis.kuleuven.be/integration/connect/download?dvLocale=en&callback=aHR0cHM6Ly93d3cucmRtLmxpYmlzLmt1bGV1dmVuLmJlL2FwaS92MS9kYXRhc2V0cy84MTUzL2dsb2J1c0Rvd25sb2FkUGFyYW1ldGVycz9sb2NhbGU9ZW4mZG93bmxvYWRJZD03NmEzYjk2NC1hMGQyLTQwZWEtYWMxNy0xNzc4ODMzNmJmNTI=',
      );
      expect(result).toBe(true);
    });

    it('should detect download from window.location callback param when params are empty', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/');
      // Real URL from the bug report
      const result = callIsDownloadFlow(
        {},
        'https://www.rdm.libis.kuleuven.be/integration/connect/download?dvLocale=en&callback=aHR0cHM6Ly93d3cucmRtLmxpYmlzLmt1bGV1dmVuLmJlL2FwaS92MS9kYXRhc2V0cy84MTUzL2dsb2J1c0Rvd25sb2FkUGFyYW1ldGVycz9sb2NhbGU9ZW4mZG93bmxvYWRJZD03NmEzYjk2NC1hMGQyLTQwZWEtYWMxNy0xNzc4ODMzNmJmNTI=',
      );
      expect(result).toBe(true);
    });

    it('should NOT detect upload URL as download flow', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/');
      // Upload URL - no downloadId in callback
      const uploadCallback = btoa(
        'https://www.rdm.libis.kuleuven.be/api/v1/datasets/10442/globusUploadParameters?locale=en&until=2025-12-19T13:22:26.793&user=u0050020',
      );
      const result = callIsDownloadFlow(
        {},
        `https://www.rdm.libis.kuleuven.be/integration/connect/upload?dvLocale=en&callback=${uploadCallback}`,
      );
      expect(result).toBe(false);
    });

    it('should ignore upload URL when router already points to /connect', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue(
        '/connect',
      );
      const result = callIsDownloadFlow(
        {},
        'https://example.com/integration/connect/upload?callback=abc',
      );
      expect(result).toBe(false);
    });

    it('should return true when state in URL indicates download and params are empty', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/');
      const state = encodeURIComponent(JSON.stringify({ download: true }));
      const result = callIsDownloadFlow(
        {},
        `https://example.com/integration/connect/callback?state=${state}`,
      );
      expect(result).toBe(true);
    });

    it('should safely return false when window.location is malformed', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/');
      const result = callIsDownloadFlow({}, '%%%');
      expect(result).toBe(false);
    });
  });
});

/**
 * Test suite for parseGlobusCallback utility
 * Tests the parsing of base64-encoded Globus callback URLs
 */
describe('AppComponent parseGlobusCallback', () => {
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  // Helper to access private method
  function callParseGlobusCallback(callback: string): {
    datasetDbId: string;
    downloadId?: string;
  } | null {
    return (component as any).parseGlobusCallback(callback);
  }

  it('should parse download callback with downloadId', () => {
    const callback = btoa(
      'https://example.com/api/v1/datasets/8153/globusDownloadParameters?locale=en&downloadId=76a3b964-a0d2-40ea-ac17-17788336bf52',
    );
    const result = callParseGlobusCallback(callback);
    expect(result).toEqual({
      datasetDbId: '8153',
      downloadId: '76a3b964-a0d2-40ea-ac17-17788336bf52',
    });
  });

  it('should parse upload callback without downloadId', () => {
    const callback = btoa(
      'https://example.com/api/v1/datasets/10442/globusUploadParameters?locale=en&until=2025-12-19T13:22:26.793&user=u0050020',
    );
    const result = callParseGlobusCallback(callback);
    expect(result).toEqual({
      datasetDbId: '10442',
      downloadId: undefined,
    });
  });

  it('should return null for invalid base64', () => {
    const result = callParseGlobusCallback('not-valid-base64!!!');
    expect(result).toBeNull();
  });

  it('should return null for too short URL path', () => {
    const callback = btoa('https://example.com/short');
    const result = callParseGlobusCallback(callback);
    expect(result).toBeNull();
  });
});

/**
 * Test suite for upload/download redirect handling
 * Tests that /connect/upload and /connect/download URLs are redirected correctly
 */
describe('AppComponent redirect handling', () => {
  let component: AppComponent;
  let routerNavigateSpy: jasmine.Spy;
  let datasetServiceSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = spyOn(component['router'], 'navigate');
  });

  afterEach(() => {
    delete (component as any)._testWindowLocationHref;
  });

  describe('redirectToConnect', () => {
    it('should redirect /connect/upload to /connect with datasetPid after fetching persistentId', async () => {
      const uploadCallback = btoa(
        'https://example.com/api/v1/datasets/10442/globusUploadParameters?locale=en&user=testuser',
      );
      const locationHref = `https://example.com/integration/connect/upload?dvLocale=en&callback=${uploadCallback}`;

      // Mock datasetService.getDatasetVersion to return persistentId
      datasetServiceSpy = spyOn(
        component['datasetService'],
        'getDatasetVersion',
      ).and.returnValue({
        subscribe: (callbacks: any) => {
          callbacks.next({ persistentId: 'doi:10.5072/FK2/ABCDEF' });
          return { unsubscribe: () => {} };
        },
      } as any);

      (component as any).redirectToConnect(locationHref);

      await settlePromises();
      expect(datasetServiceSpy).toHaveBeenCalledWith('10442', undefined);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect'], {
        queryParams: jasmine.objectContaining({
          datasetPid: 'doi:10.5072/FK2/ABCDEF',
        }),
      });
    });

    it('should navigate to /connect when callback is missing', () => {
      const locationHref = 'https://example.com/integration/connect/upload';
      (component as any).redirectToConnect(locationHref);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect']);
    });

    it('should navigate to /connect when callback cannot be parsed', () => {
      const locationHref =
        'https://example.com/integration/connect/upload?callback=invalid-base64';
      (component as any).redirectToConnect(locationHref);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect']);
    });

    it('should navigate to /connect on invalid location URL', () => {
      (component as any).redirectToConnect('%%%');
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect']);
    });
  });

  describe('redirectToDownload', () => {
    it('should redirect /connect/download to /download with datasetPid and downloadId', async () => {
      const downloadCallback = btoa(
        'https://example.com/api/v1/datasets/8153/globusDownloadParameters?locale=en&downloadId=76a3b964-a0d2-40ea-ac17-17788336bf52',
      );
      const locationHref = `https://example.com/integration/connect/download?dvLocale=en&callback=${downloadCallback}`;

      datasetServiceSpy = spyOn(
        component['datasetService'],
        'getDatasetVersion',
      ).and.returnValue({
        subscribe: (callbacks: any) => {
          callbacks.next({ persistentId: 'doi:10.5072/FK2/XYZABC' });
          return { unsubscribe: () => {} };
        },
      } as any);

      (component as any).redirectToDownload(locationHref);

      await settlePromises();
      expect(datasetServiceSpy).toHaveBeenCalledWith('8153', undefined);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/download'], {
        queryParams: jasmine.objectContaining({
          downloadId: '76a3b964-a0d2-40ea-ac17-17788336bf52',
          datasetPid: 'doi:10.5072/FK2/XYZABC',
        }),
      });
    });

    it('should navigate to /download when callback is missing', () => {
      const locationHref = 'https://example.com/integration/connect/download';
      (component as any).redirectToDownload(locationHref);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/download']);
    });

    it('should navigate to /download when callback cannot be parsed', () => {
      const locationHref =
        'https://example.com/integration/connect/download?callback=invalid-base64';
      (component as any).redirectToDownload(locationHref);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/download']);
    });

    it('should navigate to /download on invalid location URL', () => {
      (component as any).redirectToDownload('%%%');
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/download']);
    });
  });
});

/**
 * Test suite for redirect loop detection
 */
describe('AppComponent redirect loop detection', () => {
  let component: AppComponent;
  let fixture: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    // Clear any existing redirect data
    sessionStorage.removeItem('loginRedirectAttempt');
  });

  afterEach(() => {
    sessionStorage.removeItem('loginRedirectAttempt');
  });

  it('should detect redirect loop after MAX_REDIRECTS attempts', () => {
    // Simulate multiple redirects
    for (let i = 0; i < 3; i++) {
      (component as any).isRedirectLoop();
    }
    expect((component as any).isRedirectLoop()).toBe(true);
  });

  it('should reset redirect counter after time window expires', () => {
    // Set old timestamp
    const oldTimestamp = Date.now() - 60000; // 60 seconds ago
    sessionStorage.setItem(
      'loginRedirectAttempt',
      JSON.stringify({ count: 2, timestamp: oldTimestamp }),
    );

    expect((component as any).isRedirectLoop()).toBe(false);
  });

  it('should clear redirect counter', () => {
    sessionStorage.setItem(
      'loginRedirectAttempt',
      JSON.stringify({ count: 2, timestamp: Date.now() }),
    );
    (component as any).clearRedirectCounter();
    expect(sessionStorage.getItem('loginRedirectAttempt')).toBeNull();
  });

  it('should allow redirect when sessionStorage read throws', () => {
    const getItemSpy = spyOn(sessionStorage, 'getItem').and.throwError(
      'storage unavailable',
    );

    expect((component as any).isRedirectLoop()).toBe(false);
    expect(getItemSpy).toHaveBeenCalled();
  });

  it('clearRedirectCounter should ignore removeItem errors', () => {
    const removeSpy = spyOn(sessionStorage, 'removeItem').and.throwError(
      'storage unavailable',
    );

    expect(() => (component as any).clearRedirectCounter()).not.toThrow();
    // Prevent afterEach cleanup from failing in this describe block.
    removeSpy.and.callFake(() => {});
  });
});

/**
 * Test suite for navigateWithFallback
 */
describe('AppComponent navigateWithFallback', () => {
  let component: AppComponent;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = spyOn(component['router'], 'navigate');
  });

  it('should navigate with fallback params when getDatasetVersion fails', () => {
    (component as any).navigateWithFallback('/download', '12345', 'dl-123');
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/download'], {
      queryParams: { datasetDbId: '12345', downloadId: 'dl-123' },
    });
  });

  it('should navigate with fallback params without downloadId', () => {
    (component as any).navigateWithFallback('/connect', '67890');
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect'], {
      queryParams: { datasetDbId: '67890' },
    });
  });
});

/**
 * Test suite for checkLoginRequired
 */
describe('AppComponent checkLoginRequired', () => {
  let component: AppComponent;
  let fixture: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    sessionStorage.removeItem('loginRedirectAttempt');
  });

  afterEach(() => {
    sessionStorage.removeItem('loginRedirectAttempt');
  });

  it('should redirect to login when user is not logged in', async () => {
    spyOnProperty(component['router'], 'url', 'get').and.returnValue(
      '/connect',
    );
    spyOn(component['pluginService'], 'setConfig').and.returnValue(
      Promise.resolve(),
    );
    spyOn(component.dataService, 'getUserInfo').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.next({ loggedIn: false });
        return { unsubscribe: () => {} };
      },
    } as any);
    const redirectSpy = spyOn(
      component['pluginService'],
      'redirectToLogin',
    ).and.stub();

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(redirectSpy).toHaveBeenCalled();
  });

  it('should clear redirect counter when user is logged in', async () => {
    sessionStorage.setItem(
      'loginRedirectAttempt',
      JSON.stringify({ count: 1, timestamp: Date.now() }),
    );
    spyOnProperty(component['router'], 'url', 'get').and.returnValue(
      '/connect',
    );
    spyOn(component['pluginService'], 'setConfig').and.returnValue(
      Promise.resolve(),
    );
    spyOn(component.dataService, 'getUserInfo').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.next({ loggedIn: true });
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(sessionStorage.getItem('loginRedirectAttempt')).toBeNull();
  });

  it('should redirect to login on getUserInfo error', async () => {
    spyOnProperty(component['router'], 'url', 'get').and.returnValue(
      '/connect',
    );
    spyOn(component['pluginService'], 'setConfig').and.returnValue(
      Promise.resolve(),
    );
    spyOn(component.dataService, 'getUserInfo').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.error(new Error('Network error'));
        return { unsubscribe: () => {} };
      },
    } as any);
    const redirectSpy = spyOn(
      component['pluginService'],
      'redirectToLogin',
    ).and.stub();

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(redirectSpy).toHaveBeenCalled();
  });

  it('should not redirect when redirect loop is detected', async () => {
    // Set up redirect loop
    for (let i = 0; i < 3; i++) {
      (component as any).isRedirectLoop();
    }

    spyOnProperty(component['router'], 'url', 'get').and.returnValue(
      '/connect',
    );
    spyOn(component['pluginService'], 'setConfig').and.returnValue(
      Promise.resolve(),
    );
    spyOn(component.dataService, 'getUserInfo').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.next({ loggedIn: false });
        return { unsubscribe: () => {} };
      },
    } as any);
    const redirectSpy = spyOn(
      component['pluginService'],
      'redirectToLogin',
    ).and.stub();

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('should skip login check entirely for download flow', async () => {
    spyOn(component as any, 'isDownloadFlow').and.returnValue(true);
    const setConfigSpy = spyOn(
      component['pluginService'],
      'setConfig',
    ).and.returnValue(Promise.resolve());
    const getUserInfoSpy = spyOn(
      component.dataService,
      'getUserInfo',
    ).and.returnValue({
      subscribe: () => ({ unsubscribe: () => {} }),
    } as any);
    const redirectSpy = spyOn(component['pluginService'], 'redirectToLogin');

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(setConfigSpy).not.toHaveBeenCalled();
    expect(getUserInfoSpy).not.toHaveBeenCalled();
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('should show warning when redirect loop is detected for logged-out user', async () => {
    for (let i = 0; i < 3; i++) {
      (component as any).isRedirectLoop();
    }

    const warningSpy = spyOn(
      (component as any).notificationService,
      'showWarning',
    );
    spyOnProperty(component['router'], 'url', 'get').and.returnValue(
      '/connect',
    );
    spyOn(component['pluginService'], 'setConfig').and.returnValue(
      Promise.resolve(),
    );
    spyOn(component.dataService, 'getUserInfo').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.next({ loggedIn: false });
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(warningSpy).toHaveBeenCalledWith(
      'Login redirect loop detected. Please refresh and try again.',
    );
  });

  it('should show warning when redirect loop is detected after getUserInfo error', async () => {
    for (let i = 0; i < 3; i++) {
      (component as any).isRedirectLoop();
    }

    const warningSpy = spyOn(
      (component as any).notificationService,
      'showWarning',
    );
    spyOnProperty(component['router'], 'url', 'get').and.returnValue(
      '/connect',
    );
    spyOn(component['pluginService'], 'setConfig').and.returnValue(
      Promise.resolve(),
    );
    spyOn(component.dataService, 'getUserInfo').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.error(new Error('Network error'));
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).checkLoginRequired({});

    await settlePromises();
    expect(warningSpy).toHaveBeenCalledWith(
      'Login redirect loop detected. Please refresh and try again.',
    );
  });
});

/**
 * Test suite for fetchAndRedirect error handling
 */
describe('AppComponent fetchAndRedirect', () => {
  let component: AppComponent;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = spyOn(component['router'], 'navigate');
  });

  it('should use fallback when getDatasetVersion returns empty persistentId', async () => {
    spyOn(component['datasetService'], 'getDatasetVersion').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.next({ persistentId: '' });
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).fetchAndRedirect('/download', '8153', 'dl-uuid');

    await settlePromises();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/download'], {
      queryParams: { datasetDbId: '8153', downloadId: 'dl-uuid' },
    });
  });

  it('should use fallback when getDatasetVersion errors', async () => {
    spyOn(component['datasetService'], 'getDatasetVersion').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.error(new Error('Not found'));
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).fetchAndRedirect('/connect', '9999');

    await settlePromises();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect'], {
      queryParams: { datasetDbId: '9999' },
    });
  });
});

// A page load: the router navigates to the URL of the page while the app takes
// its first query parameters, with router.url still '/'. The base href is the
// one of the production build, /integration/.
describe('AppComponent on a page load', () => {
  @Component({ template: '' })
  class PageStub {}

  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: 'connect', component: PageStub },
          { path: 'download', component: PageStub },
        ]),
        provideLocationMocks(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    (TestBed.inject(Location) as SpyLocation).setBaseHref('/integration');
  });

  async function load(href: string): Promise<void> {
    const fixture = TestBed.createComponent(AppComponent);
    (fixture.componentInstance as any)._testWindowLocationHref = href;
    const url = new URL(href);
    // No route matches /connect/download: that navigation fails, and the app
    // redirects.
    const navigation = router
      .navigateByUrl(url.pathname.replace(/^\/integration/, '') + url.search)
      .catch(() => false);
    fixture.detectChanges();
    await navigation;
    await fixture.whenStable();
  }

  const page = () => {
    const tree = router.parseUrl(router.url);
    return {
      path: router.url.split('?')[0],
      queryParams: tree.queryParams,
    };
  };

  // A reload of the page ended at a bare /download: at the first query
  // parameters the app redirected the download URL as if it were the
  // Dataverse entry, without its parameters.
  it('keeps datasetPid and downloadId on a reload of the download page', async () => {
    await load(
      'https://host/integration/download?datasetPid=doi:10.1/ABC&downloadId=dl-1',
    );
    expect(page()).toEqual({
      path: '/download',
      queryParams: { datasetPid: 'doi:10.1/ABC', downloadId: 'dl-1' },
    });
  });

  it('brings the apiToken of a link to the download page', async () => {
    await load('https://host/integration/download?apiToken=secret');
    expect(page()).toEqual({
      path: '/download',
      queryParams: { apiToken: 'secret' },
    });
  });

  // Dataverse builds its entry as :GlobusAppUrl + "/download?...&callback=";
  // with :GlobusAppUrl set to the app root, the entry is the download path
  // itself, and the download page does not read callback.
  it('sends an entry with a callback on the download path on to the download page', async () => {
    const getDatasetVersion = spyOn(
      TestBed.inject(DatasetService),
      'getDatasetVersion',
    ).and.returnValue(of({ persistentId: 'doi:10.1/CB' }) as any);
    const callback = btoa(
      'https://host/api/v1/datasets/8153/globusDownloadParameters?locale=en&downloadId=dl-9',
    );
    await load(
      `https://host/integration/download?dvLocale=en&callback=${callback}`,
    );
    expect(getDatasetVersion).toHaveBeenCalledOnceWith('8153', undefined);
    expect(page()).toEqual({
      path: '/download',
      queryParams: { datasetPid: 'doi:10.1/CB', downloadId: 'dl-9' },
    });
  });

  it('still sends the Dataverse entry with a callback on to the download page', async () => {
    const getDatasetVersion = spyOn(
      TestBed.inject(DatasetService),
      'getDatasetVersion',
    ).and.returnValue(of({ persistentId: 'doi:10.1/CB' }) as any);
    const callback = btoa(
      'https://host/api/v1/datasets/8153/globusDownloadParameters?locale=en&downloadId=dl-9',
    );
    await load(
      `https://host/integration/connect/download?dvLocale=en&callback=${callback}`,
    );
    expect(getDatasetVersion).toHaveBeenCalledOnceWith('8153', undefined);
    expect(page()).toEqual({
      path: '/download',
      queryParams: { datasetPid: 'doi:10.1/CB', downloadId: 'dl-9' },
    });
  });
});
