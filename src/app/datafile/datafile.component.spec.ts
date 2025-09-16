import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DatafileComponent } from './datafile.component';

describe('DatafileComponent', () => {
  let component: DatafileComponent;
  let fixture: ComponentFixture<DatafileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatafileComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    })
      // Shallow render to avoid PrimeNG TreeTable internal provider requirements during unit tests
      .overrideComponent(DatafileComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DatafileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
