import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { PrimeNG } from 'primeng/config';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, AppComponent],
      providers: [
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
