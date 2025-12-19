import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
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
        provideRouter([]),
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
    windowLocationHref?: string
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
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/download');
      expect(callIsDownloadFlow({})).toBe(true);
    });

    it('should return true when callback param contains downloadId', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/connect');
      // Base64 encoded: "https://example.com/api/v1/datasets/123/globusDownloadParameters?downloadId=abc"
      const callback = btoa('https://example.com/api/v1/datasets/123/globusDownloadParameters?downloadId=abc');
      expect(callIsDownloadFlow({ callback })).toBe(true);
    });

    it('should return true when state param contains download flag', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/connect');
      const state = JSON.stringify({ download: true });
      expect(callIsDownloadFlow({ state })).toBe(true);
    });

    it('should return false for normal connect page', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/connect');
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
        'https://www.rdm.libis.kuleuven.be/integration/connect/download?dvLocale=en&callback=aHR0cHM6Ly93d3cucmRtLmxpYmlzLmt1bGV1dmVuLmJlL2FwaS92MS9kYXRhc2V0cy84MTUzL2dsb2J1c0Rvd25sb2FkUGFyYW1ldGVycz9sb2NhbGU9ZW4mZG93bmxvYWRJZD03NmEzYjk2NC1hMGQyLTQwZWEtYWMxNy0xNzc4ODMzNmJmNTI='
      );
      expect(result).toBe(true);
    });

    it('should detect download from window.location callback param when params are empty', () => {
      spyOnProperty(component['router'], 'url', 'get').and.returnValue('/');
      // Real URL from the bug report
      const result = callIsDownloadFlow(
        {},
        'https://www.rdm.libis.kuleuven.be/integration/connect/download?dvLocale=en&callback=aHR0cHM6Ly93d3cucmRtLmxpYmlzLmt1bGV1dmVuLmJlL2FwaS92MS9kYXRhc2V0cy84MTUzL2dsb2J1c0Rvd25sb2FkUGFyYW1ldGVycz9sb2NhbGU9ZW4mZG93bmxvYWRJZD03NmEzYjk2NC1hMGQyLTQwZWEtYWMxNy0xNzc4ODMzNmJmNTI='
      );
      expect(result).toBe(true);
    });
  });
});
