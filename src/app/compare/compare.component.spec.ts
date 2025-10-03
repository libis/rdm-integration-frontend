import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CompareComponent } from './compare.component';
import { Router } from '@angular/router';

describe('CompareComponent', () => {
  let component: CompareComponent;
  let fixture: ComponentFixture<CompareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('back() includes datasetId in navigation state', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    // simulate credentials (normally injected service provides it)
    (component as any).credentialsService = { credentials: { dataset_id: 'doi:10.777/TEST' } };
    component['data'] = { id: 'doiFallback' } as any;
    component.back();
    expect(navigateSpy).toHaveBeenCalled();
    const args: any[] = navigateSpy.calls.mostRecent().args;
    const navExtras: any = args[1];
    const ds = navExtras?.state?.['datasetId'];
    expect(ds === 'doi:10.777/TEST' || ds === 'doiFallback').toBeTrue();
  });
});
