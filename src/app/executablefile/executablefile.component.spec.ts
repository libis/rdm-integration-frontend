import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeNode } from 'primeng/api';
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
    })
      .overrideComponent(ExecutablefileComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

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
    fixture.componentRef.setInput('rowNode', exec);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.componentRef.setInput('pid', 'doi:10.123/ABC');
    fixture.componentRef.setInput('dv_token', 'secret');
    fixture.detectChanges();
  };

  it('initialises node and loads queues based on file extension', () => {
    initialiseComponent();
    expect(component.node?.data?.id).toBe('script.py');
    expect(component.queues.map((q) => q.value)).toEqual(['cpu', 'gpu']);
  });

  it('onSelectQueue enables compute when access granted', async () => {
    initialiseComponent();
    component.queue = 'cpu';
    component.onSelectQueue();
    await Promise.resolve();
    expect(component.spinning).toBeFalse();
    expect(component.computeEnabled).toBeTrue();
  });

  it('onSelectQueue resets queue and reports error when access denied', async () => {
    initialiseComponent();
    dataService.nextResponse = {
      access: false,
      message: 'no access',
    };
    component.queue = 'gpu';
    component.onSelectQueue();
    await Promise.resolve();
    expect(component.computeEnabled).toBeFalse();
    expect(component.queue).toBeUndefined();
    expect(notifications.errors.pop()).toContain('no access');
  });

  it('onSelectQueue handles transport errors', async () => {
    initialiseComponent();
    dataService.shouldError = true;
    component.queue = 'gpu';
    component.onSelectQueue();
    await Promise.resolve();
    expect(component.queue).toBeUndefined();
    expect(component.spinning).toBeFalse();
    expect(notifications.errors.pop()).toContain('Checking access to queue failed');
  });

  it('compute emits request payload', () => {
    initialiseComponent();
    component.queue = 'gpu';
    component.computeEnabled = true;
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
});
