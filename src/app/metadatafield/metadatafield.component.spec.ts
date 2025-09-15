import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetadatafieldComponent } from './metadatafield.component';

describe('MetadatafieldComponent', () => {
  let component: MetadatafieldComponent;
  let fixture: ComponentFixture<MetadatafieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetadatafieldComponent],
    })
      .overrideComponent(MetadatafieldComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MetadatafieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
