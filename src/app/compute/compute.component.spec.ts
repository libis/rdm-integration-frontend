import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComputeComponent } from './compute.component';

describe('ComputeComponent', () => {
  let component: ComputeComponent;
  let fixture: ComponentFixture<ComputeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComputeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ComputeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
