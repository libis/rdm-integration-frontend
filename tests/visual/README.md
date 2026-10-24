# Visual checks

A mock backend and a screenshot script for the datasync frontend. Take screenshots of every
page before a UI change and again after it, then compare the two sets: byte identical images
mean the change left the pages as they were. Every capture is also measured, and `--strict`
turns the layout measurements into checks. Images go to `out/`, which is gitignored; the
scripts and fixtures are committed.

- `server.mjs`: serves a built app and answers `/api/*` from `fixtures/*.json`. Only Node
  built ins. Exports `startServer({dist, port, rejected, rejectedSize, longLabel})`, which
  resolves to `{url, close, setVariant, variant, takeProblems}`:
  `setVariant({rejected, rejectedSize, longLabel})` changes what the following requests answer
  and the `variant` getter returns the current variant. A route answers 200 with the JSON its
  handler returns, or any other status with `reply(status, body)`, a string body as
  `text/plain` the way the Go backend writes its errors. A request without a route (answered
  with a 404) or whose handler throws (answered with a 500) is logged and kept as a problem of
  the mock; `takeProblems()` hands them over, and `shoot.mjs` fails the capture on any of
  them, whatever the page expects.
- `shoot.mjs`: starts the server, drives headless Chromium with `puppeteer-core` and saves one
  full page PNG per page and viewport, plus `measurements.json`. The Chromium binary comes
  from `--chromium <path>`, else the `CHROMIUM` environment variable, else
  `/usr/bin/chromium`.
- `fixtures/`: the answers of the mock API. Taken from the stubs of the 2026-10-24 review (its
  `lib.cjs`): the frontend config without its REDCap plugin, the user info, the compare key
  and the cached comparison, the dataset lookups, the file lists, the first Globus listing
  (now with the home expanded), the endpoint search, the code exchange, the access check and
  the empty DDI-CDI output. Written new for the harness: the 12 file ids rejected for their
  size in `compare-cached.json`, the metadata, the REDCap variables, the collections, the
  Globus `/` listing, the user email, the REDCap plugin (`redcap2`) in the config, and a
  Globus download (`download.json`, task `task-1`) with its status, still running with 120 of
  300 files (`globus-status-active.json`). The frontend config has four plugins (local,
  GitHub, Globus with a token getter, REDCap reports). Dataset `doi:10.1234/ABC` has 300 files
  on compare and download, 40 Python files on compute and 60 CSV files on DDI-CDI. A fixture
  whose `data` is `{"generate": {"count", "extension"}}` gets a generated list: every third
  file at the root, the others in `folder0` to `folder4`, the status cycling through equal,
  new, updated and deleted. `compare-cached.json` is a finished comparison (status 2), so the
  compare page does not poll. The Globus folder listings follow the picker rules and the
  backend's `buildHierarchy`: the first listing (option `""`) is a selectable `/` that is
  never preselected, with `/home/alice/` below it preselected and expanded and its folder
  `Documents` listed. Expanding `/` lists `home` and `shared` (`options-globus-root.json`);
  expanding a folder of the first listing lists the children it has there, so `/home/alice/`
  lists `Documents` again. Any other options request is logged and answered with `[]`. The
  REDCap variables mark three identifier fields and carry two PHI-risk notes.

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

Open `http://localhost:4300/connect`. Variants: `--rejected <n>` lists the first `n` of the 12
rejected file names in `compare-cached.json` on the compare page (default 0),
`--rejected-size <n>` the first `n` of its 12 file ids rejected for their size (default 0),
and `--long-label` answers the dataset lookups with `dvobjects-datasets-long-label.json`.
While the server runs,
`http://localhost:4300/__variant?rejected=12&rejectedSize=12&longLabel=true` changes them.

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

Time zone and locale: the browser runs with `TZ=UTC`, `--lang=en-US`, `LANG=en_US.UTF-8` and
`LANGUAGE=en_US` (Chromium on Linux takes its locale from the last two, `--lang` alone does
not change it), never the machine's settings. `measurements.json` records what the browser
reports: its version (`browser.version()`), `navigator.language` and the time zone, so a
browser upgrade or a locale change between two runs shows there. When the browser does not
take the pinned values, the run stops with exit code 1 before the first capture.

Scrollbars: `puppeteer-core` launches headless Chromium with `--hide-scrollbars`. Scrollbars
are never painted and an `overflow: scroll` or `auto` box reserves no width for one, so a page
taller than the window lays out 15 px wider than in a browser with classic scrollbars;
`scrollbar-gutter: stable` still reserves its 15 px. A dead scrollbar such as the one of the
review's finding M2 (`overflow-y: scroll` on the table header) cannot show in an image: check
it by computed style.

Every page is shot at 1366x768 and at 1920x1080, as `<page>-<width>x<height>.png`. Each
capture starts in a fresh browser context, so no session storage carries over. Pages, in
order:

- `connect`: `/connect`.
- `compare-r0`, `compare-r12` and `compare-rsize`: `/compare/doi%3A10.1234%2FABC` with no
  rejected files, with 12 files rejected for their names and with 12 rejected for their size.
  Each checks the headings of the rejected file lists, which count the files (none,
  `12 files with unsupported characters ...`, `12 files exceeding maximum allowed size ...`).
- `compare-filter`: compare, then the status filter button in the table header.
- `download`: the Globus OAuth callback `/connect?code=c1&state={"download": true, ...}`,
  which the app sends on to `/download`.
- `download-card`: the same, then every file marked with the header toggle, `End` typed in
  the endpoint search, `Endpoint A` picked, the folder placeholder expanded (the home is
  preselected) and `Start transfer`: the transfer card above the table shows the running task
  and polls its status every 5 s, and the success toast stays (`holdToasts`). At 1366x768
  the card and a table of 12rem do not both fit, so the page host scrolls (`hostScrolls`,
  below). The card's status icon spins, so its animations are stopped (`freezeAnimations`).
- `compute-40`: `/compute`, first option of the dataset select: 40 Python files, rendered as
  19 rows (the 14 files at the root and the 5 folders, collapsed).
- `compute-long-label`: the same with the long dataset label.
- `compute-dialog`: compute, first queue in the first row, then its run button.
- `ddi-cdi`: `/ddi-cdi?datasetPid=doi:10.1234/ABC`.
- `metadata-selector`: `/metadata-selector`.
- `submit`: compare, `Copy`, then `Confirm file actions`.
- `redcap2-export`: a REDCap connection with report 42 seeded into the connect page's session
  snapshot, then `Connect and compare`.
- `globus-picker`: the OAuth callback for the Globus plugin on the connect page (one
  `oauthtoken` code exchange), `End` typed in the endpoint search (one `search` request,
  answered with `Endpoint A`), `Endpoint A` picked, then the folder placeholder expanded once:
  one `options` request with option `""`, answered with the first listing above. The flow
  requests no other listing.

Clicks are real pointer clicks, as a user's: the element is scrolled into view and the mouse
clicks the centre of its box (`page.mouse`), so whatever lies on top there, a transparent
select backdrop left open for instance, would take the click. The script checks that point
first and fails the capture with the element on top instead of clicking it. It also listens
for the click on the window in the capture phase and fails the capture when the event target
is outside the element, as when the mousedown moves or covers it. After the click the pointer
leaves the page, so no hover style ends up in the capture.

After every navigation or click the script waits until the network has been idle for 1500 ms
(the search inputs debounce by 750 ms), then 500 ms more. A page that cannot be reached is
logged with the reason, the run goes on and exits with code 1. Console errors and page errors
are counted per capture, printed at the end and make the run exit with code 1 too. Chromium
logs every error status as `Failed to load resource`, without the URL; the script adds the URL
from the message's location. A request without a mock route shows up there. A page whose flow
needs an error status lists it in `expectedFailures` as `{path, status}`: failed resource
messages for that path with that status are recorded in `measurements.json` and do not fail
the run. A request the mock has no route for, or whose handler throws, fails the capture all
the same.

Toasts close on a `setTimeout` of their life (`ToastService.show`: 4 s for success and info,
6 s for warnings, 8 s for errors, 5 s by default), while every step settles for at least 2 s,
so a capture would miss a toast or catch it only sometimes. A page with `holdToasts: true`
gets an init script (`evaluateOnNewDocument`, before the app) that holds every `setTimeout` of
4000 ms or more: it never fires, so the toasts stay until the capture. RxJS timers
(`debounceTime`, `timeout`, `timer`) run on `setInterval` and are not held, and in the app's
code only the toast lives are that long today. A toast timer that pauses on hover or focus and
restarts with the remaining time can fall under 4000 ms and fire after all, so a toast page
should still check that its toast is in the capture.

A page with `freezeAnimations: true` gets `animation: none` on every element just before
the capture, so a spinner is drawn the same way in every run.

Captures are full page with the viewport at the top, so the dialog backdrop and other fixed
elements cover only the first window height of a taller page. That is expected.

## Measurements and `--strict`

Each capture prints and records in `<out>/measurements.json`: the document height
(`scrollHeight`) against the window height; the page host (the routed component, the element
after `router-outlet`) with its `display`, `scrollHeight` and `clientHeight`; the top of the
`footer`; and for the first visible tree table the body height and bottom (`.tt-body`, the
virtual scroll viewport or the static body), the bottom it is clipped at (`clipBottom`: the
topmost inner bottom edge among its ancestors whose `overflow-y` is not `visible`, named in
`clippedBy`), the header height (`.tt-header`) and the header's height with no rows (measured
with the header kept out of flex shrinking, which is what an empty table gives it). Positions
are in document coordinates. Without `--strict` the failed checks are printed; with `--strict`
they make the run exit with code 1:

- a page laid out to fit the window (compare, download, compute, DDI-CDI, metadata selector)
  has a document taller than the window, an inline page host, a page host whose content is
  taller than the host, or a table body that ends below the top of the footer;
- a page that shows a tree table (every page above) has no visible `.tt`;
- a table body ends more than 0.5 px below the bottom it is clipped at, so its last rows are
  cut off by a container with `overflow: hidden` or out of reach of a scrolled host, even
  where the body still ends above the footer;
- a table body is under 12rem (192 px);
- a table header is shorter than its height with no rows.

A page with `hostScrolls: true` shows more above its table than the window can leave room for,
so its host may scroll instead: the host check then requires a scroll box (`overflow-y` `auto`
or `scroll`) instead of content that fits, and the page is measured with the host scrolled to
its end, where the table must still end above the footer and within the host (the host is one
of the clipping ancestors), and captured with the host at its top. Today only `download-card`
has it.

Document and host heights are whole pixels rounded from fractional boxes, so both checks allow
1 px. The document can fit the window while the page does not: host overflow does not push the
footer down, so on compare up to 86 px of it (the 16 px container padding under the host and
the 70 px footer) stays inside the document, and content cut off by an `overflow: hidden`
ancestor never reaches the document height. The host, clip and footer checks catch both. A
host with an inline `display` (or `contents`) has no box of its own and reports 0 for both
heights, so the host check could not fail: on a fixed height page such a host fails instead.
The five fixed height pages have block flex column hosts that scroll vertically (`fill-window`
in `src/app/shared/_page-layout.scss`).

## Compare two runs

Two runs of the same build give byte identical images, so `cmp` is enough:

```sh
for f in tests/visual/out/before-light/*.png; do
  cmp -s "$f" "tests/visual/out/after-light/${f##*/}" || echo "changed: ${f##*/}"
done
```

Do the same for the dark folders, then open the changed images and check that only the
intended pixels moved.
