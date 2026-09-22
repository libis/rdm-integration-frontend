import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastService and ToastComponent', () => {
  beforeEach(async () => {
    jasmine.clock().install();
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
    }).compileComponents();
  });
  afterEach(() => jasmine.clock().uninstall());

  it('queues a message, renders it with the severity class and removes it after its life', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    service.show({
      severity: 'error',
      summary: 'Error',
      detail: 'boom',
      life: 1000,
    });
    fixture.detectChanges();
    const toast = fixture.nativeElement.querySelector('.toast') as HTMLElement;
    expect(toast.classList).toContain('text-bg-danger');
    expect(toast.textContent).toContain('boom');
    jasmine.clock().tick(1001);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  it('dismisses a message when its close button is clicked', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    TestBed.inject(ToastService).show({
      severity: 'info',
      summary: 'Info',
      detail: 'stay',
      life: 0,
    });
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });
});
