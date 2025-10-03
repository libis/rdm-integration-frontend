import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject, delay } from 'rxjs';
import { ComputeComponent } from './compute.component';
import { DataService } from '../data.service';
import { UtilsService } from '../utils.service';
import { CompareResult, Key } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

class MockDataService {
  getExecutableFiles() {
    return of<CompareResult>({ data: [] });
  }
  compute() {
    return of<Key>({ key: 'k1' }).pipe(delay(0));
  }
  private responses: Subject<any> = new Subject();
  getCachedComputeData() {
    return this.responses.asObservable();
  }
  emit(res: any) {
    this.responses.next(res);
  }
}
class MockUtilsService {
  sleep(ms: number) {
    return Promise.resolve();
  }
  mapDatafiles(data: Datafile[]) {
    const map = new Map<string, any>();
    map.set('', { data: { id: '', action: Fileaction.Ignore }, children: [] });
    data.forEach((d) => map.set(d.id + ':file', { data: d }));
    return map as any;
  }
  addChild(v: any, map: Map<string, any>) {
    /* no-op for test */
  }
}

describe('ComputeComponent', () => {
  let component: ComputeComponent;
  let fixture: ComponentFixture<ComputeComponent>;
  let mockData: MockDataService;

  beforeEach(async () => {
    mockData = new MockDataService();
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, ComputeComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataService, useValue: mockData },
        { provide: UtilsService, useClass: MockUtilsService },
      ],
    })
      .overrideComponent(ComputeComponent, { set: { template: '<div></div>' } })
      .compileComponents();

    fixture = TestBed.createComponent(ComputeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('onDatasetSearch guards short terms then triggers search', () => {
    component.onDatasetSearch('ab');
    expect(component.doiItems[0].label).toContain('start typing');
    component.onDatasetSearch('abcd');
    expect(component.doiItems[0].label).toContain('searching');
  });

  it('setData builds tree or stops when empty', () => {
    component.setData({ data: [] });
    expect(component.loading).toBeFalse();
    const file: Datafile = {
      id: 'f1',
      path: 'x',
      name: 'f1',
      hidden: false,
      status: Filestatus.New,
      action: Fileaction.Copy,
    };
    component.setData({ data: [file] });
    expect(component.rowNodeMap.size).toBeGreaterThan(0);
  });

  it('continueSubmit polls until ready', fakeAsync(() => {
    component.submitCompute({
      persistentId: 'd1',
      queue: 'q',
      executable: 'run.sh',
      sendEmailOnSuccess: false,
    });
    component.sendEmailOnSuccess = true;
    component.continueSubmit();
    // flush compute() delayed emission to obtain key and trigger first getComputeData subscription
    tick();
    // first poll response: not ready yet
    mockData.emit({ ready: false, res: 'partial' });
    // allow microtasks (sleep immediate resolve) & re-subscription
    tick();
    // second poll response: ready
    mockData.emit({ ready: true, res: 'final', err: '' });
    tick();
    expect(component.output).toBe('final');
    expect(component.outputDisabled).toBeFalse();
  }));
});
