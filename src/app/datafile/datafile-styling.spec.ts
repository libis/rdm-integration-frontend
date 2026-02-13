// Test to verify file action row styling works with inline style bindings
// This test focuses on the style mapping logic without rendering the template
import { Fileaction } from '../models/datafile';
import { getFileActionStyle } from '../shared/constants';

describe('File Action Styling - HostBinding Logic', () => {
  it('should expose var-based styles for Copy action', () => {
    const result = getFileActionStyle('COPY');
    expect(result).toEqual({
      backgroundColor: 'var(--app-file-action-copy-bg)',
      color: 'var(--app-file-action-copy-color)',
    });
  });

  it('should expose var-based styles for Update action', () => {
    const result = getFileActionStyle('UPDATE');
    expect(result).toEqual({
      backgroundColor: 'var(--app-file-action-update-bg)',
      color: 'var(--app-file-action-update-color)',
    });
  });

  it('should expose var-based styles for Delete action', () => {
    const result = getFileActionStyle('DELETE');
    expect(result).toEqual({
      backgroundColor: 'var(--app-file-action-delete-bg)',
      color: 'var(--app-file-action-delete-color)',
    });
  });

  it('should expose var-based styles for Custom action', () => {
    const result = getFileActionStyle('CUSTOM');
    expect(result).toEqual({
      backgroundColor: 'var(--app-file-action-custom-bg)',
      color: 'var(--app-file-action-custom-color)',
    });
  });

  it('should return empty object for Ignore action (no styling)', () => {
    const result = getFileActionStyle('IGNORE');
    expect(result).toEqual({});
  });

  // Test the enum-to-style mapping (simulates what HostBinding getter does)
  it('should map Fileaction enums to correct inline styles', () => {
    const testCases = [
      {
        action: Fileaction.Copy,
        expected: 'var(--app-file-action-copy-bg)',
      },
      {
        action: Fileaction.Update,
        expected: 'var(--app-file-action-update-bg)',
      },
      {
        action: Fileaction.Delete,
        expected: 'var(--app-file-action-delete-bg)',
      },
      {
        action: Fileaction.Custom,
        expected: 'var(--app-file-action-custom-bg)',
      },
      { action: Fileaction.Ignore, expected: undefined },
    ];

    testCases.forEach(({ action, expected }) => {
      let style: ReturnType<typeof getFileActionStyle>;
      switch (action) {
        case Fileaction.Copy:
          style = getFileActionStyle('COPY');
          break;
        case Fileaction.Update:
          style = getFileActionStyle('UPDATE');
          break;
        case Fileaction.Delete:
          style = getFileActionStyle('DELETE');
          break;
        case Fileaction.Custom:
          style = getFileActionStyle('CUSTOM');
          break;
        default:
          style = getFileActionStyle('IGNORE');
      }
      expect(style.backgroundColor)
        .withContext(`Fileaction.${Fileaction[action]}`)
        .toBe(expected);
    });
  });
});

describe('File Action Styling - Real TreeTable Integration', () => {
  // This is the REAL test - render actual TreeTable with DatafileComponent rows
  // and verify that the background colors are applied

  let fixture: any;
  let compiled: HTMLElement;

  beforeEach(async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { Component } = await import('@angular/core');
    const { TreeTableModule } = await import('primeng/treetable');
    const { DatafileComponent } = await import('./datafile.component');

    @Component({
      selector: 'app-test-treetable',
      standalone: true,
      imports: [TreeTableModule, DatafileComponent],
      template: `
        <p-treeTable [value]="files" [scrollable]="true">
          <ng-template pTemplate="body" let-rowNode let-rowData="rowData">
            <tr
              app-datafile
              #row="appDatafile"
              [datafile]="rowData"
              [loading]="false"
              [rowNodeMap]="rowNodeMap"
              [rowNode]="rowNode"
              [isInFilter]="false"
              [style]="row.getStyle()"
            ></tr>
          </ng-template>
        </p-treeTable>
      `,
    })
    class TestTreeTableComponent {
      rowNodeMap = new Map();

      files: any[] = [
        {
          data: {
            id: 'file1',
            name: 'copy-file.txt',
            path: '',
            action: Fileaction.Copy,
            attributes: { isFile: true },
          },
        },
        {
          data: {
            id: 'file2',
            name: 'update-file.txt',
            path: '',
            action: Fileaction.Update,
            attributes: { isFile: true },
          },
        },
        {
          data: {
            id: 'file3',
            name: 'delete-file.txt',
            path: '',
            action: Fileaction.Delete,
            attributes: { isFile: true },
          },
        },
        {
          data: {
            id: 'file4',
            name: 'custom-file.txt',
            path: '',
            action: Fileaction.Custom,
            attributes: { isFile: true },
          },
        },
        {
          data: {
            id: 'file5',
            name: 'ignore-file.txt',
            path: '',
            action: Fileaction.Ignore,
            attributes: { isFile: true },
          },
        },
      ];
    }

    await TestBed.configureTestingModule({
      imports: [TestTreeTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestTreeTableComponent);
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should render TreeTable with file rows', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    expect(rows.length).withContext('Should have 5 datafile rows').toBe(5);
  });

  it('should apply inline style vars to Copy row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const copyRow = rows[0] as HTMLElement;

    expect(copyRow.style.backgroundColor).toBe(
      'var(--app-file-action-copy-bg)',
    );
    expect(copyRow.style.color).toBe('var(--app-file-action-copy-color)');
  });

  it('should apply inline style vars to Update row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const updateRow = rows[1] as HTMLElement;

    expect(updateRow.style.backgroundColor).toBe(
      'var(--app-file-action-update-bg)',
    );
    expect(updateRow.style.color).toBe('var(--app-file-action-update-color)');
  });

  it('should apply inline style vars to Delete row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const deleteRow = rows[2] as HTMLElement;

    expect(deleteRow.style.backgroundColor).toBe(
      'var(--app-file-action-delete-bg)',
    );
    expect(deleteRow.style.color).toBe('var(--app-file-action-delete-color)');
  });

  it('should apply inline style vars to Custom row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const customRow = rows[3] as HTMLElement;

    expect(customRow.style.backgroundColor).toBe(
      'var(--app-file-action-custom-bg)',
    );
    expect(customRow.style.color).toBe('var(--app-file-action-custom-color)');
  });

  it('should leave ignore row without inline style overrides', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const ignoreRow = rows[4] as HTMLElement;

    expect(ignoreRow.style.backgroundColor).toBe('');
    expect(ignoreRow.style.color).toBe('');
  });

  it('should have VISIBLE background colors applied via component SCSS', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');

    // Test Copy row (should have green background)
    const copyRow = rows[0] as HTMLElement;
    const copyStyle = window.getComputedStyle(copyRow);
    const copyBg = copyStyle.backgroundColor;

    // Test Update row (should have blue background)
    const updateRow = rows[1] as HTMLElement;
    const updateStyle = window.getComputedStyle(updateRow);
    const updateBg = updateStyle.backgroundColor;

    // Test Delete row (should have red background)
    const deleteRow = rows[2] as HTMLElement;
    const deleteStyle = window.getComputedStyle(deleteRow);
    const deleteBg = deleteStyle.backgroundColor;

    // Test Custom row (should have yellow background)
    const customRow = rows[3] as HTMLElement;
    const customStyle = window.getComputedStyle(customRow);
    const customBg = customStyle.backgroundColor;

    // THE CRITICAL TEST: These should NOT be transparent
    // If they are transparent, it means component SCSS is not being applied!
    expect(copyBg)
      .withContext(
        `Copy row inline style. Style: ${copyRow.getAttribute('style')}`,
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(copyBg).not.toBe('transparent');
    expect(copyBg).not.toBe('');

    expect(updateBg)
      .withContext(
        `Update row inline style. Style: ${updateRow.getAttribute('style')}`,
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(updateBg).not.toBe('transparent');
    expect(updateBg).not.toBe('');

    expect(deleteBg)
      .withContext(
        `Delete row inline style. Style: ${deleteRow.getAttribute('style')}`,
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(deleteBg).not.toBe('transparent');
    expect(deleteBg).not.toBe('');

    expect(customBg)
      .withContext(
        `Custom row inline style. Style: ${customRow.getAttribute('style')}`,
      )
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(customBg).not.toBe('transparent');
    expect(customBg).not.toBe('');

    // Verify they have DIFFERENT colors
    expect(copyBg)
      .withContext('Copy and Update should have different colors')
      .not.toBe(updateBg);
    expect(copyBg)
      .withContext('Copy and Delete should have different colors')
      .not.toBe(deleteBg);
    expect(updateBg)
      .withContext('Update and Delete should have different colors')
      .not.toBe(deleteBg);
  });
});
