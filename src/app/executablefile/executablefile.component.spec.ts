import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeNode } from '../models/tree-node';
import { Observable, Subject } from 'rxjs';
import { DataService } from '../data.service';
import { Datafile, Fileaction } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { NotificationService } from '../shared/notification.service';
import { ExecutablefileComponent } from './executablefile.component';

class PluginServiceStub {
  getQueues(ext: string) {
    if (ext === 'py') {
      return [
        { label: 'CPU', value: 'cpu' },
        { label: 'GPU', value: 'gpu' },
      ];
    }
    return [];
  }
}

class NotificationServiceStub {
  errors: string[] = [];
  showError(msg: string) {
    this.errors.push(msg);
  }
}

class DataServiceStub {
  nextResponse: { access: boolean; message: string } = {
    access: true,
    message: 'ok',
  };
  shouldError = false;

  checkAccessToQueue(): Observable<{ access: boolean; message: string }> {
    const subject = new Subject<{ access: boolean; message: string }>();
    queueMicrotask(() => {
      if (this.shouldError) {
        subject.error({ error: 'boom' });
        return;
      }
      subject.next(this.nextResponse);
      subject.complete();
    });
    return subject.asObservable();
  }
}

describe('ExecutablefileComponent', () => {
  let component: ExecutablefileComponent;
  let fixture: ComponentFixture<ExecutablefileComponent>;
  let dataService: DataServiceStub;
  let notifications: NotificationServiceStub;

  const buildTree = () => {
    const root: TreeNode<Datafile> = {
      key: '',
      data: {
        id: '',
        name: 'root',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [],
    };

    const exec: TreeNode<Datafile> = {
      key: 'script.py:file',
      data: {
        id: 'script.py',
        name: 'script.py',
        path: 'bin',
        hidden: false,
        action: Fileaction.Ignore,
        attributes: { isFile: true },
      },
      children: [],
    };

    root.children!.push(exec);

    const map = new Map<string, TreeNode<Datafile>>();
    map.set('', root);
    map.set('script.py:file', exec);

    return { root, exec, map };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutablefileComponent],
      providers: [
        { provide: PluginService, useClass: PluginServiceStub },
        { provide: DataService, useClass: DataServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutablefileComponent);
    component = fixture.componentInstance;
    dataService = TestBed.inject(DataService) as unknown as DataServiceStub;
    notifications = TestBed.inject(
      NotificationService,
    ) as unknown as NotificationServiceStub;
  });

  const initialiseComponent = () => {
    const { exec, map } = buildTree();
    fixture.componentRef.setInput('datafile', exec.data);
    fixture.componentRef.setInput('node', exec);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.componentRef.setInput('pid', 'doi:10.123/ABC');
    fixture.componentRef.setInput('dv_token', 'secret');
    fixture.detectChanges();
  };

  it('initialises node and loads queues based on file extension', () => {
    initialiseComponent();
    expect(component.node()?.data?.id).toBe('script.py');
    expect(component.queues().map((q) => q.value)).toEqual(['cpu', 'gpu']);
    const cells = fixture.nativeElement.querySelectorAll('.tt-cell');
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toContain('script.py');
    expect(fixture.nativeElement.querySelector('app-select')).not.toBeNull();
  });

  it('onSelectQueue enables compute when access granted', async () => {
    initialiseComponent();
    component.queue.set('cpu');
    component.onSelectQueue();
    await Promise.resolve();
    expect(component.spinning()).toBeFalse();
    expect(component.computeEnabled()).toBeTrue();
  });

  it('onSelectQueue resets queue and reports error when access denied', async () => {
    initialiseComponent();
    dataService.nextResponse = {
      access: false,
      message: 'no access',
    };
    component.queue.set('gpu');
    component.onSelectQueue();
    await Promise.resolve();
    expect(component.computeEnabled()).toBeFalse();
    expect(component.queue()).toBeUndefined();
    expect(notifications.errors.pop()).toContain('no access');
  });

  it('onSelectQueue handles transport errors', async () => {
    initialiseComponent();
    dataService.shouldError = true;
    component.queue.set('gpu');
    component.onSelectQueue();
    await Promise.resolve();
    expect(component.queue()).toBeUndefined();
    expect(component.spinning()).toBeFalse();
    expect(notifications.errors.pop()).toContain(
      'Checking access to queue failed',
    );
  });

  it('compute emits request payload', () => {
    initialiseComponent();
    component.queue.set('gpu');
    component.computeEnabled.set(true);
    const events: any[] = [];
    component.computeClicked.subscribe((evt) => events.push(evt));
    component.compute();
    expect(events[0]).toEqual({
      persistentId: 'doi:10.123/ABC',
      dataverseKey: 'secret',
      queue: 'gpu',
      executable: 'script.py',
      sendEmailOnSuccess: false,
    });
  });

  it('names the queue select after the file', async () => {
    initialiseComponent();
    await fixture.whenStable();
    expect(
      fixture.nativeElement
        .querySelector('.form-select')
        .getAttribute('aria-label'),
    ).toBe('Queue for script.py');
  });

  // "Run on" after the queue select pointed at nothing; the name of the
  // button says which file runs and starts with its visible label.
  it('labels the run button Run and names the file in its accessible name', async () => {
    initialiseComponent();
    await fixture.whenStable();
    const run = fixture.nativeElement.querySelector(
      'button.btn-primary',
    ) as HTMLButtonElement;
    expect(run.textContent!.trim()).toBe('Run');
    expect(run.getAttribute('aria-label')).toBe('Run script.py');
  });

  // Run then OK posted a computation without a persistentId when the rows
  // of a dataset outlived its selection.
  it('disables Run while no dataset is selected', async () => {
    initialiseComponent();
    const events: unknown[] = [];
    component.computeClicked.subscribe((evt) => events.push(evt));
    fixture.componentRef.setInput('pid', undefined);
    component.queue.set('gpu');
    component.computeEnabled.set(true);
    await fixture.whenStable();
    const run = fixture.nativeElement.querySelector(
      'button.btn-primary',
    ) as HTMLButtonElement;
    expect(run.disabled).toBeTrue();
    run.click();
    expect(events).toEqual([]);

    fixture.componentRef.setInput('pid', 'doi:10.123/ABC');
    await fixture.whenStable();
    expect(run.disabled).toBeFalse();
  });

  it('gives the run button the height of the queue select', async () => {
    initialiseComponent();
    await fixture.whenStable();
    const run = fixture.nativeElement.querySelector(
      'button.btn-primary',
    ) as HTMLButtonElement;
    const trigger = fixture.nativeElement.querySelector(
      '.form-select',
    ) as HTMLElement;
    expect(run.style.height).toBe('');
    expect(run.getBoundingClientRect().height).toBe(
      trigger.getBoundingClientRect().height,
    );
  });

  it('leaves room in the clipping cell for the 4 px focus rings', async () => {
    initialiseComponent();
    await fixture.whenStable();
    const cell = fixture.nativeElement.querySelectorAll(
      '.tt-cell',
    )[1] as HTMLElement;
    expect(getComputedStyle(cell).overflow).toBe('hidden');
    const box = cell.getBoundingClientRect();
    for (const control of [
      fixture.nativeElement.querySelector('.form-select'),
      fixture.nativeElement.querySelector('button.btn-primary'),
    ] as HTMLElement[]) {
      const ring = control.getBoundingClientRect();
      expect(ring.top - box.top).toBeGreaterThanOrEqual(4);
      expect(box.bottom - ring.bottom).toBeGreaterThanOrEqual(4);
    }
  });
});
