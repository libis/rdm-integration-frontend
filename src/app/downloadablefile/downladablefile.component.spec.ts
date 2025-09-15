import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownladablefileComponent } from './downladablefile.component';

describe('DownladablefileComponent', () => {
  let component: DownladablefileComponent;
  let fixture: ComponentFixture<DownladablefileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownladablefileComponent],
    })
      // Shallow render to avoid PrimeNG TreeTable internal provider requirements during unit tests
      .overrideComponent(DownladablefileComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DownladablefileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
