import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  fakeAsync,
  flushMicrotasks,
  TestBed,
  tick,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of, Subject, Subscription, throwError } from 'rxjs';
import { DataService } from './data.service';
import { DataStateService } from './data.state.service';
import { NotificationService } from './shared/notification.service';
import { UtilsService } from './utils.service';

class MockDataService {
  key$ = of({ key: 'k1' });
  cached$ = new Subject<any>();
  getData() {
    return this.key$;
  }
  getCachedData() {
    return this.cached$.asObservable();
  }
}
class MockUtilsService {
  sleep(_ms: number) {
    return Promise.resolve();
  }
}
class MockNotification {
  errors: string[] = [];
  showError(m: string) {
    this.errors.push(m);
  }
}
class MockRouter {
  navigated: { commands: any; extras?: any }[] = [];
  navigate(commands: any, extras?: any) {
    this.navigated.push({ commands, extras });
  }
}

describe('DataStateService', () => {
  let service: DataStateService;
  let data: MockDataService;
  let router: MockRouter;
  let notify: MockNotification;

  beforeEach(() => {
    data = new MockDataService();
    router = new MockRouter();
    notify = new MockNotification();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataService, useValue: data },
        { provide: UtilsService, useClass: MockUtilsService },
        { provide: NotificationService, useValue: notify },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(DataStateService);
  });

  function init() {
    service.initializeState();
  }

  it('initializes and polls until ready true then stores result', fakeAsync(() => {
    init();
    data.cached$.next({ ready: false });
    data.cached$.next({
      ready: true,
      res: {
        data: [
          { id: 'b', name: 'b', path: '', hidden: false },
          { id: 'a', name: 'a', path: '', hidden: false },
        ],
      },
    });
    tick();
    const v = service.getCurrentValue();
    expect(v?.data?.map((f) => f.id)).toEqual(['a', 'b']);
  }));

  it('handles ready true with error message', fakeAsync(() => {
    init();
    data.cached$.next({ ready: true, res: { data: [] }, err: 'boom' });
    tick();
    expect(notify.errors.some((e) => e.includes('boom'))).toBeTrue();
  }));

  it('handles ready true with missing response by leaving state null', fakeAsync(() => {
    init();
    data.cached$.next({ ready: true, res: undefined });
    tick();
    expect(service.getCurrentValue()).toBeNull();
  }));

  it('handles getData error and navigates', fakeAsync(() => {
    data.getData = () => throwError(() => ({ error: 'x' })) as any;
    init();
    tick();
    expect(notify.errors.length).toBe(1);
    expect(router.navigated[0].commands).toEqual(['/connect']);
    expect(router.navigated[0].extras?.queryParams).toEqual({});
  }));

  it('handles getData 401 and requests reset navigation', fakeAsync(() => {
    data.getData = () =>
      throwError(() => ({ error: 'denied', status: 401 })) as any;
    init();
    tick();
    expect(router.navigated[0].commands).toEqual(['/connect']);
    expect(router.navigated[0].extras?.queryParams).toEqual({ reset: 'true' });
  }));

  it('handles cached error and navigates', fakeAsync(() => {
    init();
    data.getCachedData = () => throwError(() => ({ error: '401 forbidden' }));
    const generation = (service as any).pollGeneration;
    (service as any).getCompareData({ key: 'k2' }, generation);
    tick();
    expect(
      notify.errors.some((e) => e.includes('Comparing failed')),
    ).toBeTrue();
    expect(
      router.navigated.some(
        (n) =>
          n.commands[0] === '/connect' &&
          n.extras?.queryParams?.reset === 'true',
      ),
    ).toBeTrue();
  }));

  it('cancelInitialization unsubscribes and resets by default', () => {
    let dataObserver: any;
    let dataUnsubscribed = false;
    let cachedUnsubscribed = false;

    data.getData = () =>
      new Observable((observer) => {
        dataObserver = observer;
        return new Subscription(() => {
          dataUnsubscribed = true;
        });
      });
    data.getCachedData = () =>
      new Observable(() => {
        return new Subscription(() => {
          cachedUnsubscribed = true;
        });
      });

    service.initializeState();
    dataObserver.next({ key: 'kCancel' });
    service.updateState({ id: 'to-reset' } as any);

    service.cancelInitialization();

    expect(dataUnsubscribed).toBeTrue();
    expect(cachedUnsubscribed).toBeTrue();
    expect(service.getCurrentValue()).toBeNull();
  });

  it('cancelInitialization can skip state reset', () => {
    service.updateState({ id: 'persist' } as any);
    service.cancelInitialization(false);
    expect(service.getCurrentValue()?.id).toBe('persist');
  });

  it('ignores polling results once generation changes mid-flight', fakeAsync(() => {
    let dataObserver: any;
    let cachedObserver: any;
    let cachedUnsubscribed = false;

    data.getData = () =>
      new Observable((observer) => {
        dataObserver = observer;
        return new Subscription();
      });
    data.getCachedData = () =>
      new Observable((observer) => {
        cachedObserver = observer;
        return new Subscription(() => {
          cachedUnsubscribed = true;
        });
      });

    service.initializeState();
    dataObserver.next({ key: 'kPoll' });
    cachedObserver.next({ ready: false });

    service.cancelInitialization();
    flushMicrotasks();

    expect(service.getCurrentValue()).toBeNull();
    expect(cachedUnsubscribed).toBeTrue();
  }));

  it('updateState and resetState manipulate current value', () => {
    service.updateState({ data: [] });
    expect(service.getCurrentValue()).not.toBeNull();
    service.resetState();
    expect(service.getCurrentValue()).toBeNull();
  });
});
