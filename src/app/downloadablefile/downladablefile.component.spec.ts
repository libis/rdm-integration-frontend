import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownladablefileComponent } from './downladablefile.component';

describe('DownladablefileComponent', () => {
  let component: DownladablefileComponent;
  let fixture: ComponentFixture<DownladablefileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DownladablefileComponent ]
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
