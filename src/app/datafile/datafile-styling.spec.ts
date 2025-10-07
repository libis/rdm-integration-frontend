// Test to verify file action row styling works with @HostBinding
// This test focuses on the HostBinding logic without rendering the template
import { Fileaction } from '../models/datafile';
import { getFileActionClass } from '../shared/constants';

describe('File Action Styling - HostBinding Logic', () => {
  it('should return file-action-copy class for Copy action', () => {
    const result = getFileActionClass('COPY');
    expect(result).toBe('file-action-copy');
  });

  it('should return file-action-update class for Update action', () => {
    const result = getFileActionClass('UPDATE');
    expect(result).toBe('file-action-update');
  });

  it('should return file-action-delete class for Delete action', () => {
    const result = getFileActionClass('DELETE');
    expect(result).toBe('file-action-delete');
  });

  it('should return file-action-custom class for Custom action', () => {
    const result = getFileActionClass('CUSTOM');
    expect(result).toBe('file-action-custom');
  });

  it('should return empty string for Ignore action (no styling)', () => {
    const result = getFileActionClass('IGNORE');
    expect(result).toBe('');
  });

  // Test the enum-to-class mapping (simulates what HostBinding getter does)
  it('should map Fileaction enums to correct CSS classes', () => {
    const testCases = [
      { action: Fileaction.Copy, expected: 'file-action-copy' },
      { action: Fileaction.Update, expected: 'file-action-update' },
      { action: Fileaction.Delete, expected: 'file-action-delete' },
      { action: Fileaction.Custom, expected: 'file-action-custom' },
      { action: Fileaction.Ignore, expected: '' }, // No styling for ignored files
    ];

    testCases.forEach(({ action, expected }) => {
      let className: string;
      switch (action) {
        case Fileaction.Copy:
          className = getFileActionClass('COPY');
          break;
        case Fileaction.Update:
          className = getFileActionClass('UPDATE');
          break;
        case Fileaction.Delete:
          className = getFileActionClass('DELETE');
          break;
        case Fileaction.Custom:
          className = getFileActionClass('CUSTOM');
          break;
        default:
          className = getFileActionClass('IGNORE');
      }
      expect(className)
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
              [datafile]="rowData"
              [loading]="false"
              [rowNodeMap]="rowNodeMap"
              [rowNode]="rowNode"
              [isInFilter]="false"
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

  it('should apply file-action-copy class to Copy row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const copyRow = rows[0] as HTMLElement;

    expect(copyRow.classList.contains('file-action-copy'))
      .withContext(`Row classes: ${copyRow.className}`)
      .toBe(true);
  });

  it('should apply file-action-update class to Update row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const updateRow = rows[1] as HTMLElement;

    expect(updateRow.classList.contains('file-action-update'))
      .withContext(`Row classes: ${updateRow.className}`)
      .toBe(true);
  });

  it('should apply file-action-delete class to Delete row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const deleteRow = rows[2] as HTMLElement;

    expect(deleteRow.classList.contains('file-action-delete'))
      .withContext(`Row classes: ${deleteRow.className}`)
      .toBe(true);
  });

  it('should apply file-action-custom class to Custom row', () => {
    const rows = compiled.querySelectorAll('tr[app-datafile]');
    const customRow = rows[3] as HTMLElement;

    expect(customRow.classList.contains('file-action-custom'))
      .withContext(`Row classes: ${customRow.className}`)
      .toBe(true);
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
      .withContext(`Copy row background. Classes: ${copyRow.className}`)
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(copyBg).not.toBe('transparent');
    expect(copyBg).not.toBe('');

    expect(updateBg)
      .withContext(`Update row background. Classes: ${updateRow.className}`)
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(updateBg).not.toBe('transparent');
    expect(updateBg).not.toBe('');

    expect(deleteBg)
      .withContext(`Delete row background. Classes: ${deleteRow.className}`)
      .not.toBe('rgba(0, 0, 0, 0)');
    expect(deleteBg).not.toBe('transparent');
    expect(deleteBg).not.toBe('');

    expect(customBg)
      .withContext(`Custom row background. Classes: ${customRow.className}`)
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
