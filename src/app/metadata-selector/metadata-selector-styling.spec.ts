// Test to verify metadata field action row styling works with @HostBinding
// This test focuses on rendering real TreeTable with MetadatafieldComponent rows
import { Fieldaction } from '../models/field';

describe('Metadata Field Action Styling - Real TreeTable Integration', () => {
  let fixture: any;
  let compiled: HTMLElement;
  let defaultTableBackgroundRgb: string;

  beforeEach(async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { Component } = await import('@angular/core');
    const { TreeTableModule } = await import('primeng/treetable');
    const { MetadatafieldComponent } = await import('../metadatafield/metadatafield.component');

    document.documentElement.style.setProperty('--p-content-background', '#111111');
    document.documentElement.style.setProperty('--p-text-color', '#f0f0f0');

    defaultTableBackgroundRgb = parseCssColor(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--p-content-background')
        .trim() || '#111111',
    );

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
    const copyCell = copyRow.querySelector('td') as HTMLElement;
    const copyCellBg = window.getComputedStyle(copyCell).backgroundColor;
    // Test Custom row (should have yellow background)
    const customRow = rows[1] as HTMLElement;
    const customStyle = window.getComputedStyle(customRow);
    const customBg = customStyle.backgroundColor;
    const customCell = customRow.querySelector('td') as HTMLElement;
    const customCellBg = window.getComputedStyle(customCell).backgroundColor;

    // Test Ignore row (should have default background)
    const ignoreRow = rows[2] as HTMLElement;
    const ignoreStyle = window.getComputedStyle(ignoreRow);
    const ignoreBg = ignoreStyle.backgroundColor;
    const ignoreCell = ignoreRow.querySelector('td') as HTMLElement;
    const ignoreCellBg = window.getComputedStyle(ignoreCell).backgroundColor;

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
    expect(copyBg).withContext('Copy should differ from Ignore default background').not.toBe(ignoreBg);
    expect(customBg).withContext('Custom should differ from Ignore default background').not.toBe(ignoreBg);

    // Ensure Copy/Custom do not fall back to theme default
    expect(copyBg)
      .withContext('Copy row should not be forced back to theme background by table styling')
      .not.toBe(defaultTableBackgroundRgb);
    expect(customBg)
      .withContext('Custom row should not be forced back to theme background by table styling')
      .not.toBe(defaultTableBackgroundRgb);

    // Default Ignore row should still match theme background
    expect([defaultTableBackgroundRgb, 'rgba(0, 0, 0, 0)'])
      .withContext('Ignore row should keep default table theme background or remain transparent (table handles paint)')
      .toContain(normalizeRgb(ignoreBg));

    expect(normalizeRgb(copyCellBg))
      .withContext('Copy cell must not use default table theme background color')
      .not.toBe(defaultTableBackgroundRgb);
    expect(normalizeRgb(customCellBg))
      .withContext('Custom cell must not use default table theme background color')
      .not.toBe(defaultTableBackgroundRgb);
    expect([defaultTableBackgroundRgb, 'rgba(0, 0, 0, 0)'])
      .withContext('Ignore cell should resolve to default theme background or be transparent (rendered via table)')
      .toContain(normalizeRgb(ignoreCellBg));
  });
});

function parseCssColor(color: string): string {
  if (!color) {
    return '';
  }

  if (color.startsWith('rgb')) {
    return normalizeRgb(color);
  }

  const probe = document.createElement('div');
  probe.style.display = 'none';
  probe.style.backgroundColor = color;
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).backgroundColor;
  document.body.removeChild(probe);
  return normalizeRgb(computed);
}

function normalizeRgb(value: string): string {
  if (!value) {
    return value;
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) {
    return value;
  }
  const parts = match[1]
    .split(',')
    .map((p) => p.trim())
    .map((p, idx) => (idx === 3 ? p : parseInt(p, 10)))
    .filter((p) => p !== '');

  if (parts.length === 4) {
    return `rgba(${parts.join(', ')})`;
  }
  return `rgb(${parts.join(', ')})`;
}
