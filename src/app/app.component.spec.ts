import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
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

  it('should set ripple to true on init', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const primengConfig = (app as any).primengConfig;

    spyOn(primengConfig.ripple, 'set');
    app.ngOnInit();

    expect(primengConfig.ripple.set).toHaveBeenCalledWith(true);
  });

  it('should check access to queue and hide compute link when access is false', (done) => {
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

    app.ngOnInit();

    setTimeout(() => {
      expect(mockElement.style.display).toBe('none');
      expect(mockUnsubscribe).toHaveBeenCalled();
      document.body.removeChild(mockElement);
      done();
    }, 100);
  });

  it('should hide compute link on error', (done) => {
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

    app.ngOnInit();

    setTimeout(() => {
      expect(mockElement.style.display).toBe('none');
      document.body.removeChild(mockElement);
      done();
    }, 100);
  });

  it('should not hide compute link when access is true', (done) => {
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

    app.ngOnInit();

    setTimeout(() => {
      expect(mockElement.style.display).not.toBe('none');
      expect(mockUnsubscribe).toHaveBeenCalled();
      document.body.removeChild(mockElement);
      done();
    }, 100);
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
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
    it('should redirect /connect/upload to /connect with datasetPid after fetching persistentId', (done) => {
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

      setTimeout(() => {
        expect(datasetServiceSpy).toHaveBeenCalledWith('10442', undefined);
        expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect'], {
          queryParams: jasmine.objectContaining({
            datasetPid: 'doi:10.5072/FK2/ABCDEF',
          }),
        });
        done();
      }, 10);
    });
  });

  describe('redirectToDownload', () => {
    it('should redirect /connect/download to /download with datasetPid and downloadId', (done) => {
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

      setTimeout(() => {
        expect(datasetServiceSpy).toHaveBeenCalledWith('8153', undefined);
        expect(routerNavigateSpy).toHaveBeenCalledWith(['/download'], {
          queryParams: jasmine.objectContaining({
            downloadId: '76a3b964-a0d2-40ea-ac17-17788336bf52',
            datasetPid: 'doi:10.5072/FK2/XYZABC',
          }),
        });
        done();
      }, 10);
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    sessionStorage.removeItem('loginRedirectAttempt');
  });

  afterEach(() => {
    sessionStorage.removeItem('loginRedirectAttempt');
  });

  it('should redirect to login when user is not logged in', (done) => {
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

    setTimeout(() => {
      expect(redirectSpy).toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should clear redirect counter when user is logged in', (done) => {
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

    setTimeout(() => {
      expect(sessionStorage.getItem('loginRedirectAttempt')).toBeNull();
      done();
    }, 100);
  });

  it('should redirect to login on getUserInfo error', (done) => {
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

    setTimeout(() => {
      expect(redirectSpy).toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should not redirect when redirect loop is detected', (done) => {
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

    setTimeout(() => {
      expect(redirectSpy).not.toHaveBeenCalled();
      done();
    }, 100);
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PrimeNG, useValue: { ripple: { set: () => {} } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = spyOn(component['router'], 'navigate');
  });

  it('should use fallback when getDatasetVersion returns empty persistentId', (done) => {
    spyOn(component['datasetService'], 'getDatasetVersion').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.next({ persistentId: '' });
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).fetchAndRedirect('/download', '8153', 'dl-uuid');

    setTimeout(() => {
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/download'], {
        queryParams: { datasetDbId: '8153', downloadId: 'dl-uuid' },
      });
      done();
    }, 10);
  });

  it('should use fallback when getDatasetVersion errors', (done) => {
    spyOn(component['datasetService'], 'getDatasetVersion').and.returnValue({
      subscribe: (callbacks: any) => {
        callbacks.error(new Error('Not found'));
        return { unsubscribe: () => {} };
      },
    } as any);

    (component as any).fetchAndRedirect('/connect', '9999');

    setTimeout(() => {
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/connect'], {
        queryParams: { datasetDbId: '9999' },
      });
      done();
    }, 10);
  });
});
