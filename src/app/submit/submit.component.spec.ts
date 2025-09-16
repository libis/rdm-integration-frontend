import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { SubmitComponent } from './submit.component';
import { DataStateService } from '../data.state.service';

describe('SubmitComponent', () => {
  let component: SubmitComponent;
  let fixture: ComponentFixture<SubmitComponent>;
  let routerNavigateSpy: jasmine.Spy;
  let dataStateStub: Partial<DataStateService>;

  beforeEach(async () => {
    const routerStub = {
      navigate: jasmine.createSpy('navigate'),
    } as unknown as Router;
    dataStateStub = {
      getCurrentValue: () =>
        ({ id: 'collectionId:New Dataset', data: [] }) as any,
    };
    await TestBed.configureTestingModule({
      imports: [SubmitComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
        { provide: DataStateService, useValue: dataStateStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should redirect to metadata-selector when pid indicates new dataset on init', () => {
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/metadata-selector']);
  });
});
