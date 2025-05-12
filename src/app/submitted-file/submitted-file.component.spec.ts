import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmittedFileComponent } from './submitted-file.component';

describe('SubmittedFileComponent', () => {
  let component: SubmittedFileComponent;
  let fixture: ComponentFixture<SubmittedFileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubmittedFileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmittedFileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
