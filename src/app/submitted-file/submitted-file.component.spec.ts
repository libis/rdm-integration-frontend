import { ComponentFixture, TestBed } from '@angular/core/testing';
import { expectBootstrapTableStyle } from '../../testing/inline-style-test-helpers';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { SubmittedFileComponent } from './submitted-file.component';

describe('SubmittedFileComponent', () => {
  let component: SubmittedFileComponent;
  let fixture: ComponentFixture<SubmittedFileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmittedFileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmittedFileComponent);
    component = fixture.componentInstance;
  });

  const setDatafile = (overrides: Partial<Datafile>) => {
    const base: Datafile = {
      id: '1',
      name: 'file.txt',
      path: 'docs',
      hidden: false,
      action: Fileaction.Copy,
      status: Filestatus.Equal,
    } as Datafile;
    fixture.componentRef.setInput('datafile', { ...base, ...overrides });
    fixture.detectChanges();
  };

  it('applies inline style tokens based on file action', () => {
    setDatafile({ action: Fileaction.Copy });
    expectBootstrapTableStyle(
      component.getStyle(),
      'var(--app-file-action-copy-bg)',
      'var(--app-file-action-copy-color)',
    );

    setDatafile({ action: Fileaction.Update });
    expectBootstrapTableStyle(
      component.getStyle(),
      'var(--app-file-action-update-bg)',
      'var(--app-file-action-update-color)',
    );

    setDatafile({ action: Fileaction.Delete, status: Filestatus.New });
    expectBootstrapTableStyle(
      component.getStyle(),
      'var(--app-file-action-delete-bg)',
      'var(--app-file-action-delete-color)',
    );

    setDatafile({ action: Fileaction.Custom });
    expectBootstrapTableStyle(
      component.getStyle(),
      'var(--app-file-action-custom-bg)',
      'var(--app-file-action-custom-color)',
    );

    setDatafile({ action: Fileaction.Ignore });
    expect(component.getStyle()).toBe('');
  });

  it('formats file path including folder prefix when present', () => {
    setDatafile({ path: 'docs', name: 'file.txt' });
    expect(component.file()).toBe('docs/file.txt');

    setDatafile({ path: undefined, name: 'top.txt' });
    expect(component.file()).toBe('top.txt');
  });

  it('determines readiness and icon classes', () => {
    setDatafile({ action: Fileaction.Copy, status: Filestatus.Equal });
    expect(component.isReady()).toBeTrue();
    expect(component.iconClass()).toBe('pi pi-check');

    setDatafile({ action: Fileaction.Delete, status: Filestatus.New });
    expect(component.isReady()).toBeTrue();
    expect(component.iconClass()).toBe('pi pi-check');

    setDatafile({ action: Fileaction.Delete, status: Filestatus.Equal });
    expect(component.isReady()).toBeFalse();
    expect(component.iconClass()).toBe('pi pi-spin pi-spinner');
  });
});
