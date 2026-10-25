/* istanbul ignore file */
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

// The ARIA structure of the first tree table in host, for the treegrid specs
// of the pages: the role, name and row count of the table, the role and row
// index of its header row, the roles of the header cells, each rendered body
// row as "<text of its first cell>: <role> <aria-rowindex>, level
// <aria-level>, expanded <aria-expanded>", and the roles of the body cells.
interface TreegridStructure {
  table: string | null;
  label: string | null;
  rowCount: string | null;
  header: string;
  headerCells: (string | null)[];
  rows: string[];
  cells: (string | null)[];
}

export function treegridStructure(host: HTMLElement): TreegridStructure {
  const table = host.querySelector<HTMLElement>('.tt')!;
  const header = table.querySelector<HTMLElement>('.tt-header')!;
  const rows = Array.from(
    table.querySelectorAll<HTMLElement>('.tt-body .tt-row'),
  );
  const roles = (elements: Element[]) =>
    elements.map((el) => el.getAttribute('role'));
  return {
    table: table.getAttribute('role'),
    label: table.getAttribute('aria-label'),
    rowCount: table.getAttribute('aria-rowcount'),
    header: `${header.getAttribute('role')} ${header.getAttribute('aria-rowindex')}`,
    headerCells: roles(Array.from(header.children)),
    rows: rows.map(
      (row) =>
        `${row.children[0]?.textContent?.trim()}: ${row.getAttribute('role')} ` +
        `${row.getAttribute('aria-rowindex')}, ` +
        `level ${row.getAttribute('aria-level')}, ` +
        `expanded ${row.getAttribute('aria-expanded')}`,
    ),
    cells: [...new Set(rows.flatMap((row) => roles(Array.from(row.children))))],
  };
}
