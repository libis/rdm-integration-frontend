import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatafileComponent } from './datafile.component';

describe('DatafileComponent', () => {
  let component: DatafileComponent;
  let fixture: ComponentFixture<DatafileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatafileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DatafileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
