// Test to verify metadata field action row styling works with @HostBinding
// This test focuses on rendering real TreeTable with MetadatafieldComponent rows
import { Fieldaction } from '../models/field';

describe('Metadata Field Action Styling - Real TreeTable Integration', () => {
  let fixture: any;
  let compiled: HTMLElement;

  beforeEach(async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { Component } = await import('@angular/core');
    const { TreeTableModule } = await import('primeng/treetable');
    const { MetadatafieldComponent } = await import('../metadatafield/metadatafield.component');

    @Component({
      selector: 'app-test-metadata-treetable',
      standalone: true,
      imports: [TreeTableModule, MetadatafieldComponent],
      template: `
        <div class="treetable-cell">
          <p-treeTable [value]="fields" [scrollable]="true" styleClass="table">
            <ng-template pTemplate="body" let-rowNode let-rowData="rowData">
              <tr app-metadatafield
                  [field]="rowData"
                  [rowNodeMap]="rowNodeMap"
                  [rowNode]="rowNode">
              </tr>
            </ng-template>
          </p-treeTable>
        </div>
      `
    })
    class TestMetadataTreeTableComponent {
      rowNodeMap = new Map();

      fields: any[] = [
        {
          data: {
            id: 'field1',
            name: 'title',
            leafValue: 'Test Title',
            action: Fieldaction.Copy
          }
        },
        {
          data: {
            id: 'field2',
            name: 'description',
            leafValue: 'Test Description',
            action: Fieldaction.Custom
          }
        },
        {
          data: {
            id: 'field3',
            name: 'author',
            leafValue: 'Test Author',
            action: Fieldaction.Ignore
          }
        }
      ];
    }

    await TestBed.configureTestingModule({
      imports: [TestMetadataTreeTableComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestMetadataTreeTableComponent);
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should render TreeTable with metadata field rows', () => {
    const rows = compiled.querySelectorAll('tr[app-metadatafield]');
    expect(rows.length).withContext('Should have 3 metadata field rows').toBe(3);
  });

  it('should apply file-action-copy class to Copy row', () => {
    const rows = compiled.querySelectorAll('tr[app-metadatafield]');
    const copyRow = rows[0] as HTMLElement;

    expect(copyRow.classList.contains('file-action-copy'))
      .withContext(`Row classes: ${copyRow.className}`)
      .toBe(true);
  });

  it('should apply file-action-custom class to Custom row', () => {
    const rows = compiled.querySelectorAll('tr[app-metadatafield]');
    const customRow = rows[1] as HTMLElement;

    expect(customRow.classList.contains('file-action-custom'))
      .withContext(`Row classes: ${customRow.className}`)
      .toBe(true);
  });

  it('should NOT apply any file-action class to Ignore row', () => {
    const rows = compiled.querySelectorAll('tr[app-metadatafield]');
    const ignoreRow = rows[2] as HTMLElement;

    expect(ignoreRow.className).withContext('Ignore row should not have file-action classes').not.toContain('file-action');
  });

  it('should have VISIBLE background colors applied via component SCSS - NOT OVERRIDDEN BY .table selector', () => {
    const rows = compiled.querySelectorAll('tr[app-metadatafield]');

    // Test Copy row (should have green background)
    const copyRow = rows[0] as HTMLElement;
    const copyStyle = window.getComputedStyle(copyRow);
    const copyBg = copyStyle.backgroundColor;

    // Test Custom row (should have yellow background)
    const customRow = rows[1] as HTMLElement;
    const customStyle = window.getComputedStyle(customRow);
    const customBg = customStyle.backgroundColor;

    // Test Ignore row (should have default background)
    const ignoreRow = rows[2] as HTMLElement;
    const ignoreStyle = window.getComputedStyle(ignoreRow);
    const ignoreBg = ignoreStyle.backgroundColor;

    // THE CRITICAL TEST: Copy and Custom should have visible backgrounds
    // This tests that .table tr selector in metadata-selector.component.scss
    // does NOT override the file-action classes
    expect(copyBg).withContext(`Copy row background. Classes: ${copyRow.className}`).not.toBe('rgba(0, 0, 0, 0)');
    expect(copyBg).not.toBe('transparent');
    expect(copyBg).not.toBe('');

    expect(customBg).withContext(`Custom row background. Classes: ${customRow.className}`).not.toBe('rgba(0, 0, 0, 0)');
    expect(customBg).not.toBe('transparent');
    expect(customBg).not.toBe('');

    // Verify Copy and Custom have DIFFERENT colors from each other
    expect(copyBg).withContext('Copy and Custom should have different colors').not.toBe(customBg);

    // Verify Copy and Custom have DIFFERENT colors from Ignore (default)
    expect(copyBg).withContext('Copy should have different color than Ignore').not.toBe(ignoreBg);
    expect(customBg).withContext('Custom should have different color than Ignore').not.toBe(ignoreBg);
  });
});
