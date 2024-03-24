import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutablefileComponent } from './executablefile.component';

describe('ExecutablefileComponent', () => {
  let component: ExecutablefileComponent;
  let fixture: ComponentFixture<ExecutablefileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutablefileComponent]
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
