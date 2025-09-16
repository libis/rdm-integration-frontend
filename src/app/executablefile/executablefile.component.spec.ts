import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExecutablefileComponent } from './executablefile.component';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ExecutablefileComponent', () => {
  let component: ExecutablefileComponent;
  let fixture: ComponentFixture<ExecutablefileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutablefileComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    })
      // Shallow render to avoid PrimeNG TreeTable internal provider requirements during unit tests
      .overrideComponent(ExecutablefileComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ExecutablefileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
