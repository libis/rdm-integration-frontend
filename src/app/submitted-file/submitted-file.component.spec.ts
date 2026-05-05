import { ComponentFixture, TestBed } from '@angular/core/testing';
import { expectBootstrapTableStyle } from '../../testing/inline-style-test-helpers';
import { CredentialsService } from '../credentials.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { SubmittedFileComponent } from './submitted-file.component';

describe('SubmittedFileComponent', () => {
  let component: SubmittedFileComponent;
  let fixture: ComponentFixture<SubmittedFileComponent>;
  let credentialsService: CredentialsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmittedFileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmittedFileComponent);
    component = fixture.componentInstance;
    credentialsService = TestBed.inject(CredentialsService);
    credentialsService.clearCredentials();
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
    expect(() =>
      expectBootstrapTableStyle(
        component.hostStyle(),
        'var(--app-file-action-copy-bg)',
        'var(--app-file-action-copy-color)',
      ),
    ).not.toThrow();

    setDatafile({ action: Fileaction.Update });
    expect(() =>
      expectBootstrapTableStyle(
        component.hostStyle(),
        'var(--app-file-action-update-bg)',
        'var(--app-file-action-update-color)',
      ),
    ).not.toThrow();

    setDatafile({ action: Fileaction.Delete, status: Filestatus.New });
    expect(() =>
      expectBootstrapTableStyle(
        component.hostStyle(),
        'var(--app-file-action-delete-bg)',
        'var(--app-file-action-delete-color)',
      ),
    ).not.toThrow();

    setDatafile({ action: Fileaction.Custom });
    expect(() =>
      expectBootstrapTableStyle(
        component.hostStyle(),
        'var(--app-file-action-custom-bg)',
        'var(--app-file-action-custom-color)',
      ),
    ).not.toThrow();

    setDatafile({ action: Fileaction.Ignore });
    expect(component.hostStyle()).toBe('');
  });

  it('falls back to ignore styling when action is missing', () => {
    setDatafile({ action: undefined, status: Filestatus.Equal });
    expect(component.hostStyle()).toBe('');
  });

  it('formats file path including folder prefix when present', () => {
    setDatafile({ path: 'docs', name: 'file.txt' });
    expect(component.fileName()).toBe('docs/file.txt');

    setDatafile({ path: undefined, name: 'top.txt' });
    expect(component.fileName()).toBe('top.txt');
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

  it('detects globus submissions based on credentials service', () => {
    credentialsService.setCredentials({ plugin: 'globus' });
    expect(component.isGlobus()).toBeTrue();

    credentialsService.setCredentials({ plugin: 'dataverse' });
    expect(component.isGlobus()).toBeFalse();
  });
});
