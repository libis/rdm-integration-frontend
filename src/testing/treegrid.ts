/* istanbul ignore file */
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

// The ARIA structure of the first tree table in host, for the treegrid specs
// of the pages: the roles of the table, its header row and header cells, each
// rendered body row as "<text of its first cell>: <role> <aria-level>
// <aria-expanded>", and the roles of the body cells.
interface TreegridStructure {
  table: string | null;
  header: string | null;
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
    header: header.getAttribute('role'),
    headerCells: roles(Array.from(header.children)),
    rows: rows.map(
      (row) =>
        `${row.children[0]?.textContent?.trim()}: ${row.getAttribute('role')} ` +
        `${row.getAttribute('aria-level')} ${row.getAttribute('aria-expanded')}`,
    ),
    cells: [...new Set(rows.flatMap((row) => roles(Array.from(row.children))))],
  };
}
