import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SubmitComponent } from './submit.component';

describe('SubmitComponent', () => {
  let component: SubmitComponent;
  let fixture: ComponentFixture<SubmitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmitComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    })
      // Shallow render to avoid PrimeNG TreeTable internal provider requirements during unit tests
      .overrideComponent(SubmitComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SubmitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
