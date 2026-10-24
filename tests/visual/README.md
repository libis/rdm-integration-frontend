# Visual checks

A mock backend and a screenshot script for the datasync frontend. Take screenshots of every
page before a UI change and again after it, then compare the two sets: byte identical images
mean the change left the pages as they were. Every capture is also measured, and `--strict`
turns the layout measurements into checks. Images go to `out/`, which is gitignored; the
scripts and fixtures are committed.

- `server.mjs`: serves a built app and answers `/api/*` from `fixtures/*.json`. Only Node
  built ins. Exports `startServer({dist, port, rejected, longLabel})`, which resolves to
  `{url, close, setVariant}`. Requests without a route are logged and answered with 404.
- `shoot.mjs`: starts the server, drives headless Chromium with `puppeteer-core` and saves
  one full page PNG per page and viewport, plus `measurements.json`. The Chromium binary comes
  from `--chromium <path>`, else the `CHROMIUM` environment variable, else
  `/usr/bin/chromium`.
- `fixtures/`: the answers of the mock API, taken from the stubs of the 2026-10-24 review.
  The frontend config has four plugins (local, GitHub, Globus with a token getter, REDCap
  reports). Dataset `doi:10.1234/ABC` has 300 files on compare and download, 40 Python files
  on compute and 60 CSV files on DDI-CDI. A fixture whose `data` is
  `{"generate": {"count", "extension"}}` gets a generated list: every third file at the root,
  the others in `folder0` to `folder4`, the status cycling through equal, new, updated and
  deleted. `compare-cached.json` is a finished comparison (status 2), so the compare page does
  not poll. The Globus folder listing follows the picker rules: the first listing is a
  selectable `/` that is never preselected, with `/home/alice/` below it preselected;
  expanding `/` lists `home` and `shared`. The REDCap variables mark three identifier fields
  and carry two PHI-risk notes.

The commands below run from the repository root, with the Node version pinned in
`.tool-versions` (installed with mise).

## Build the app

```sh
npx ng build --configuration development
```

Output: `dist/datasync/browser`. `npx ng build` (production) writes to the same folder; shoot
the same configuration before and after a change.

## Run the server alone

```sh
node tests/visual/server.mjs --dist dist/datasync/browser --port 4300
```

Open `http://localhost:4300/connect`. Variants: `--rejected <n>` lists the first `n` of the
12 rejected file names in `compare-cached.json` on the compare page (default 0), and
`--long-label` answers the dataset lookups with `dvobjects-datasets-long-label.json`. While
the server runs, `http://localhost:4300/__variant?rejected=12&longLabel=true` changes them.

## Shoot

Install the driver once: `cd tests/visual && npm install`.

```sh
node tests/visual/shoot.mjs --dist dist/datasync/browser --out tests/visual/out/<label>-light
node tests/visual/shoot.mjs --dist dist/datasync/browser --out tests/visual/out/<label>-dark --dark
```

If `ELECTRON_RUN_AS_NODE` is set in the shell (VS Code terminals), run it with
`env -u ELECTRON_RUN_AS_NODE`. `--pages connect,compare-r0` shoots only the named pages.

Colour scheme: the browser reports `prefers-color-scheme: light`, or `dark` with `--dark`,
never the machine's own setting. The app follows it by setting `data-bs-theme` on `<html>`
(`src/main.ts`), and every capture checks that the attribute matches and fails otherwise.
Shoot once without and once with `--dark`, into different `--out` folders.

Every page is shot at 1366x768 and at 1920x1080, as `<page>-<width>x<height>.png`. Each
capture starts in a fresh browser context, so no session storage carries over. Pages, in
order:

- `connect`: `/connect`.
- `compare-r0` and `compare-r12`: `/compare/doi%3A10.1234%2FABC` with 0 and with 12 rejected
  file names.
- `compare-filter`: compare, then the status filter button in the table header.
- `download`: the Globus OAuth callback `/connect?code=c1&state={"download": true, ...}`,
  which the app sends on to `/download`.
- `compute-40`: `/compute`, first option of the dataset select; 40 rows.
- `compute-long-label`: the same with the long dataset label.
- `compute-dialog`: compute, first queue in the first row, then its run button.
- `ddi-cdi`: `/ddi-cdi?datasetPid=doi:10.1234/ABC`.
- `metadata-selector`: `/metadata-selector`.
- `submit`: compare, `Copy`, then `Confirm file actions`.
- `redcap2-export`: a REDCap connection with report 42 seeded into the connect page's session
  snapshot, then `Connect and compare`.
- `globus-picker`: the OAuth callback for the Globus plugin on the connect page, endpoint
  search `End`, `Endpoint A`, then the folder placeholder expanded once.

After every navigation or click the script waits until the network has been idle for
1500 ms (the search inputs debounce by 750 ms), then 500 ms more. A page that cannot be
reached is logged with the reason, the run goes on and exits with code 1. Console errors and
page errors are counted per capture and printed at the end; any of them also makes the run
exit with code 1. A request without a mock route shows up there as a failed resource.

Captures are full page with the viewport at the top, so the dialog backdrop and other fixed
elements cover only the first window height of a taller page. That is expected.

## Measurements and `--strict`

Each capture prints and records in `<out>/measurements.json`: the document height
(`scrollHeight`) against the window height; the page host (the routed component, the element
after `router-outlet`) with its `display`, `scrollHeight` and `clientHeight`; the top of the
`footer`; and for the first visible tree table the body height and bottom (`.tt-body`, the
virtual scroll viewport or the static body), the header height (`.tt-header`) and the
header's height with no rows (measured with the header kept out of flex shrinking, which is
what an empty table gives it). Positions are in document coordinates. Without `--strict` the
failed checks are printed; with `--strict` they make the run exit with code 1:

- a page laid out to fit the window (compare, download, compute, DDI-CDI, metadata selector)
  has a document taller than the window, a page host whose content is taller than the host,
  or a table body that ends below the top of the footer;
- a page that shows a tree table (every page above) has no visible `.tt`;
- a table body is under 12rem (192 px);
- a table header is shorter than its height with no rows.

Document and host heights are whole pixels rounded from fractional boxes, so both checks allow
1 px. The document can fit the window while the page does not: host overflow does not push the
footer down, so on compare up to 86 px of it (the 16 px container padding under the host and
the 70 px footer) stays inside the document, and content cut off by an `overflow: hidden`
ancestor never reaches the document height. The host and footer checks catch both. A host with
an inline `display` (download, compute and DDI-CDI today) has no box of its own and reports 0
for both heights, so only the footer check applies to it.

## Compare two runs

Two runs of the same build give byte identical images, so `cmp` is enough:

```sh
for f in tests/visual/out/before-light/*.png; do
  cmp -s "$f" "tests/visual/out/after-light/${f##*/}" || echo "changed: ${f##*/}"
done
```

Do the same for the dark folders, then open the changed images and check that only the
intended pixels moved.
