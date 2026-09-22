// Test to verify metadata field action row styling works with inline style bindings
// This test focuses on rendering real TreeTable with MetadatafieldComponent rows
import { Fieldaction } from '../models/field';

describe('Metadata Field Action Styling - Real TreeTable Integration', () => {
  let fixture: any;
  let compiled: HTMLElement;
  let defaultTableBackgroundRgb: string;

  beforeEach(async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { Component } = await import('@angular/core');
    const { TreeTableComponent } =
      await import('../shared/ui/tree-table/tree-table.component');
    const { TreeTableHeaderDirective, TreeTableRowDirective } =
      await import('../shared/ui/tree-table/tree-table-templates');
    const { MetadatafieldComponent } =
      await import('../metadatafield/metadatafield.component');

    document.documentElement.style.setProperty('--app-bg', '#111111');
    document.documentElement.style.setProperty('--app-text', '#f0f0f0');

    defaultTableBackgroundRgb = parseCssColor(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--app-bg')
        .trim() || '#111111',
    );

    @Component({
      selector: 'app-test-metadata-treetable',
      standalone: true,
      imports: [
        TreeTableComponent,
        TreeTableHeaderDirective,
        TreeTableRowDirective,
        MetadatafieldComponent,
      ],
      template: `
        <div class="treetable-cell" style="height: 300px">
          <app-tree-table #tt [nodes]="fields" columns="2fr 2fr 1fr 4rem">
            <ng-template appTreeTableHeader>
              <div class="tt-cell">Metadata field</div>
              <div class="tt-cell">Value</div>
              <div class="tt-cell">Metadata source</div>
              <div class="tt-cell"></div>
            </ng-template>
            <ng-template appTreeTableRow let-node let-level="level">
              <div
                app-metadatafield
                #fieldRow="appMetadatafield"
                class="tt-row"
                [field]="node.data"
                [node]="node"
                [level]="level"
                [rowNodeMap]="rowNodeMap"
                (toggle)="tt.toggle(node)"
                [style]="fieldRow.hostStyle()"
              ></div>
            </ng-template>
          </app-tree-table>
        </div>
      `,
    })
    class TestMetadataTreeTableComponent {
      rowNodeMap = new Map();

      fields: any[] = [
        {
          data: {
            id: 'field1',
            name: 'title',
            leafValue: 'Test Title',
            action: Fieldaction.Copy,
          },
        },
        {
          data: {
            id: 'field2',
            name: 'description',
            leafValue: 'Test Description',
            action: Fieldaction.Custom,
          },
        },
        {
          data: {
            id: 'field3',
            name: 'author',
            leafValue: 'Test Author',
            action: Fieldaction.Ignore,
          },
        },
      ];
    }

    await TestBed.configureTestingModule({
      imports: [TestMetadataTreeTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestMetadataTreeTableComponent);
    compiled = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--app-bg');
    document.documentElement.style.removeProperty('--app-text');
  });

  it('should render the tree table with metadata field rows', () => {
    const rows = compiled.querySelectorAll('div[app-metadatafield]');
    expect(rows.length)
      .withContext('Should have 3 metadata field rows')
      .toBe(3);
  });

  it('should apply inline style vars to Copy row', () => {
    const rows = compiled.querySelectorAll('div[app-metadatafield]');
    const copyRow = rows[0] as HTMLElement;

    expect(copyRow.style.backgroundColor).toBe(
      'var(--app-file-action-copy-bg)',
    );
    expect(copyRow.style.color).toBe('var(--app-file-action-copy-color)');
  });

  it('should apply inline style vars to Custom row', () => {
    const rows = compiled.querySelectorAll('div[app-metadatafield]');
    const customRow = rows[1] as HTMLElement;

    expect(customRow.style.backgroundColor).toBe(
      'var(--app-file-action-custom-bg)',
    );
    expect(customRow.style.color).toBe('var(--app-file-action-custom-color)');
  });

  it('should NOT apply inline styles to Ignore row', () => {
    const rows = compiled.querySelectorAll('div[app-metadatafield]');
    const ignoreRow = rows[2] as HTMLElement;

    expect(ignoreRow.style.backgroundColor)
      .withContext('Ignore row should have no inline background')
      .toBe('');
    expect(ignoreRow.style.color)
      .withContext('Ignore row should have no inline text color override')
      .toBe('');
  });

  it('should have VISIBLE background colors applied via the app tokens - NOT OVERRIDDEN BY the table styling', () => {
    const rows = compiled.querySelectorAll('div[app-metadatafield]');

    // Test Copy row (should have green background)
    const copyRow = rows[0] as HTMLElement;
    const copyStyle = window.getComputedStyle(copyRow);
    const copyBg = copyStyle.backgroundColor;
    const copyCell = copyRow.querySelector('.tt-cell') as HTMLElement;
    const copyCellBg = window.getComputedStyle(copyCell).backgroundColor;
    // Test Custom row (should have yellow background)
    const customRow = rows[1] as HTMLElement;
    const customStyle = window.getComputedStyle(customRow);
    const customBg = customStyle.backgroundColor;
    const customCell = customRow.querySelector('.tt-cell') as HTMLElement;
    const customCellBg = window.getComputedStyle(customCell).backgroundColor;

    // Test Ignore row (should have default background)
    const ignoreRow = rows[2] as HTMLElement;
    const ignoreStyle = window.getComputedStyle(ignoreRow);
    const ignoreBg = ignoreStyle.backgroundColor;
    const ignoreCell = ignoreRow.querySelector('.tt-cell') as HTMLElement;
    const ignoreCellBg = window.getComputedStyle(ignoreCell).backgroundColor;

    // THE CRITICAL TEST: Copy and Custom should have visible backgrounds
    // This tests that the tree table styling does NOT override the file-action styles
    expect(copyBg)
      .withContext(
        `Copy row inline style. Style: ${copyRow.getAttribute('style')}`,
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(copyBg).not.toBe('transparent');
    expect(copyBg).not.toBe('');

    expect(customBg)
      .withContext(
        `Custom row inline style. Style: ${customRow.getAttribute('style')}`,
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(customBg).not.toBe('transparent');
    expect(customBg).not.toBe('');

    // Verify Copy and Custom have DIFFERENT colors from each other
    expect(copyBg)
      .withContext('Copy and Custom should have different colors')
      .not.toBe(customBg);

    // Verify Copy and Custom have DIFFERENT colors from Ignore (default)
    expect(copyBg)
      .withContext('Copy should differ from Ignore default background')
      .not.toBe(ignoreBg);
    expect(customBg)
      .withContext('Custom should differ from Ignore default background')
      .not.toBe(ignoreBg);

    // Ensure Copy/Custom do not fall back to theme default
    expect(copyBg)
      .withContext(
        'Copy row should not be forced back to theme background by table styling',
      )
      .not.toBe(defaultTableBackgroundRgb);
    expect(customBg)
      .withContext(
        'Custom row should not be forced back to theme background by table styling',
      )
      .not.toBe(defaultTableBackgroundRgb);

    // Default Ignore row should still match theme background
    expect([defaultTableBackgroundRgb, 'rgba(0, 0, 0, 0)'])
      .withContext(
        'Ignore row should keep default table theme background or remain transparent (table handles paint)',
      )
      .toContain(normalizeRgb(ignoreBg));

    expect(normalizeRgb(copyCellBg))
      .withContext(
        'Copy cell must not use default table theme background color',
      )
      .not.toBe(defaultTableBackgroundRgb);
    expect(normalizeRgb(customCellBg))
      .withContext(
        'Custom cell must not use default table theme background color',
      )
      .not.toBe(defaultTableBackgroundRgb);
    expect([defaultTableBackgroundRgb, 'rgba(0, 0, 0, 0)'])
      .withContext(
        'Ignore cell should resolve to default theme background or be transparent (rendered via table)',
      )
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
