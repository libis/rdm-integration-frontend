// Drives headless Chromium through the app against the mock server, saves one full page PNG
// per page and viewport and measures the layout of each capture. Console errors and page
// errors are printed per capture and fail the run. Usage (Chromium from --chromium, else the
// CHROMIUM environment variable, else /usr/bin/chromium):
// node shoot.mjs --dist <browser dir> --out <dir> [--dark] [--strict] [--chromium <path>]
//   [--pages <name>,<name>]
// The browser reports prefers-color-scheme: light, or dark with --dark, never the machine's own
// setting, and every capture checks that the page carries the matching data-bs-theme.
// With --strict the layout checks (see checkLayout) fail the run; without it they are printed.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import puppeteer from "puppeteer-core";
import { DEFAULT_VARIANT, startServer } from "./server.mjs";

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];
// The search inputs debounce by 750 ms, so "idle" must outlast that.
const IDLE_MS = 1500;
const SETTLE_MS = 500;
const TIMEOUT_MS = 30000;
// A table body under 12rem shows only a handful of rows.
const MIN_BODY_REM = 12;
// scrollHeight and clientHeight are whole pixels while the boxes they round are fractional, so
// content that fits can still come out 1 px taller.
const ROUNDING_PX = 1;
// Toasts close on a setTimeout of their life, 4 s to 8 s (ToastService.show), while a step
// settles for at least 2 s, so a capture would miss a toast or catch it only sometimes. On a
// page with holdToasts, every setTimeout of this delay or longer is held: it never fires.
const HOLD_TIMEOUTS_MS = 4000;
// The browser's time zone and locale are pinned, so the captures do not depend on the machine.
const TIME_ZONE = "UTC";
const LANGUAGE = "en-US";
const CLICKABLE = 'button, a, [role="button"]';
const DATASET = "doi:10.1234/ABC";

const { values: args } = parseArgs({
  options: {
    dist: { type: "string" },
    out: { type: "string" },
    chromium: {
      type: "string",
      default: process.env.CHROMIUM || "/usr/bin/chromium",
    },
    dark: { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    pages: { type: "string" },
  },
});
if (!args.dist || !args.out) {
  console.error(
    "usage: node shoot.mjs --dist <dir> --out <dir> [--dark] [--strict] " +
      "[--chromium <path>] [--pages <name>,<name>]",
  );
  process.exit(2);
}
const scheme = args.dark ? "dark" : "light";

// Every flow starts from a fresh browser context, so no session storage or connect snapshot
// carries over from the flow before it.
class Flow {
  constructor(page, origin) {
    this.page = page;
    this.origin = origin;
  }

  async settle() {
    await this.page.waitForNetworkIdle({
      idleTime: IDLE_MS,
      timeout: TIMEOUT_MS,
    });
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  }

  async open(urlPath) {
    await this.page.goto(`${this.origin}${urlPath}`, {
      waitUntil: "load",
      timeout: TIMEOUT_MS,
    });
    await this.settle();
  }

  async waitFor(selector) {
    await this.page.waitForSelector(selector, {
      visible: true,
      timeout: TIMEOUT_MS,
    });
  }

  // Clicks the first visible, enabled element matching selector whose text is one of texts
  // (any text when texts is omitted) with the real pointer, as a user would: the element is
  // scrolled into view and the mouse clicks the centre of its box, so a transparent backdrop
  // left on top would take the click. Such a click fails here, naming the element on top.
  // The pointer then leaves the page, so no hover style ends up in the capture, and the page
  // settles.
  async click(selector, texts) {
    const what = texts ? `"${texts.join('" or "')}" (${selector})` : selector;
    const found = await this.page.evaluateHandle(
      (selector, texts) => {
        const isVisible = (el) => {
          const box = el.getBoundingClientRect();
          return (
            box.width > 0 &&
            box.height > 0 &&
            getComputedStyle(el).visibility !== "hidden"
          );
        };
        const isEnabled = (el) =>
          !el.disabled && el.getAttribute("aria-disabled") !== "true";
        const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
        return (
          [...document.querySelectorAll(selector)].find(
            (el) =>
              (!texts || texts.includes(text(el))) &&
              isVisible(el) &&
              isEnabled(el),
          ) ?? null
        );
      },
      selector,
      texts,
    );
    const target = found.asElement();
    if (!target) {
      await found.dispose();
      throw new Error(`nothing visible to click for ${what}`);
    }
    try {
      await target.evaluate((el) =>
        el.scrollIntoView({ block: "nearest", inline: "nearest" }),
      );
      const { x, y } = await target.clickablePoint();
      const onTop = await target.evaluate(
        (el, x, y) => {
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === el || el.contains(hit))) {
            return null;
          }
          return hit
            ? `<${hit.localName}${[...hit.classList].map((c) => `.${c}`).join("")}>`
            : "nothing";
        },
        x,
        y,
      );
      if (onTop) {
        throw new Error(
          `a click on ${what} at (${Math.round(x)}, ${Math.round(y)}) would hit ${onTop}`,
        );
      }
      await this.page.mouse.click(x, y);
      await this.page.mouse.move(-1, -1);
    } finally {
      await target.dispose();
    }
    await this.settle();
  }

  // Opens the app-select whose trigger matches triggerSelector and picks the option with the
  // given text, or the first option.
  async choose(triggerSelector, text) {
    await this.click(triggerSelector);
    await this.waitFor(".cdk-overlay-container .app-select-option");
    await this.click(
      ".cdk-overlay-container .app-select-option",
      text && [text],
    );
  }
}

// Runs in every new document of a holdToasts page, before the app (evaluateOnNewDocument), and
// holds every setTimeout of minDelay or longer. The id it returns is a real, idle timer, so
// clearTimeout keeps working. RxJS timers (debounceTime, timeout, timer) run on setInterval and
// are not held. In the app's code only the toast lives are that long today; of the libraries,
// Angular's animate.leave fallback (4 s) would be held too, and the app uses no animate.leave.
function holdTimeouts(minDelay) {
  const setTimeoutBefore = window.setTimeout;
  window.setTimeout = function (handler, delay, ...rest) {
    if (Number(delay) >= minDelay) {
      return setTimeoutBefore.call(window, () => {}, 2 ** 31 - 1);
    }
    return setTimeoutBefore.call(window, handler, delay, ...rest);
  };
}

// An OAuth callback: the connect page restores the form from the state and exchanges the code.
const oauthCallback = (state) =>
  `/connect?code=c1&state=${encodeURIComponent(JSON.stringify({ nonce: "n1", ...state }))}`;

async function openCompare(flow) {
  await flow.open(`/compare/${encodeURIComponent(DATASET)}`);
  await flow.waitFor("div[app-datafile]");
}

async function openCompute(flow) {
  await flow.open("/compute");
  await flow.choose("#datasetId");
  await flow.waitFor("div[app-executablefile]");
}

// name: the image is <name>-<width>x<height>.png. fixedHeight: the page is laid out to fit the
// window, so a document taller than the window is a layout failure. table: the page shows a
// tree table, so a missing or hidden one fails the table checks instead of skipping them.
// variant: see server.mjs. expectedFailures: [{path, status}], the API answers with an error
// status that are part of the flow, so the browser's "Failed to load resource" message for that
// path and status is recorded, not counted. A request the mock has no route for, or whose
// handler throws, fails the capture anyway.
// holdToasts: toasts stay until the capture (see HOLD_TIMEOUTS_MS). freezeAnimations: CSS
// animations stop before the capture, so a spinner is drawn the same way in every run.
// hostScrolls: what the page shows above its table can be taller than the window leaves, so
// its host may scroll: the host must then be a scroll box (overflow-y auto or scroll), and the
// table is measured with the host scrolled to its end (see measure and checkLayout).
const PAGES = [
  {
    name: "connect",
    steps: async (flow) => {
      await flow.open("/connect");
      await flow.waitFor("#plugin");
    },
  },
  {
    name: "compare-r0",
    fixedHeight: true,
    table: true,
    variant: { rejected: 0 },
    steps: openCompare,
  },
  {
    name: "compare-r12",
    fixedHeight: true,
    table: true,
    variant: { rejected: 12 },
    steps: openCompare,
  },
  {
    name: "compare-filter",
    fixedHeight: true,
    table: true,
    steps: async (flow) => {
      await openCompare(flow);
      await flow.click(".tt-header button.btn-primary");
      await flow.waitFor(".cdk-overlay-container #filter-all");
    },
  },
  {
    name: "download",
    fixedHeight: true,
    table: true,
    steps: async (flow) => {
      await flow.open(
        oauthCallback({ download: true, datasetId: { value: DATASET } }),
      );
      await flow.waitFor("div[app-downloadablefile]");
    },
  },
  {
    // A running download: every file marked, Endpoint A and the preselected home folder, then
    // Start transfer. The transfer card above the table polls the task status (every 5 s, on
    // RxJS timers), and the success toast stays. At 1366x768 the card and a 12rem table do not
    // both fit, so the page host scrolls; its status icon spins.
    name: "download-card",
    fixedHeight: true,
    table: true,
    holdToasts: true,
    freezeAnimations: true,
    hostScrolls: true,
    steps: async (flow) => {
      await flow.open(
        oauthCallback({ download: true, datasetId: { value: DATASET } }),
      );
      await flow.waitFor("div[app-downloadablefile]");
      await flow.click(".tt-header button.btn-outline-secondary");
      await flow.click("#repoNameSearch");
      await flow.page.type(
        '.cdk-overlay-container input[placeholder="Filter"]',
        "End",
      );
      await flow.settle();
      await flow.click(".cdk-overlay-container .app-select-option", [
        "Endpoint A",
      ]);
      await flow.click("app-folder-tree button.folder-toggle");
      await flow.waitFor("app-folder-tree .folder-node.selected");
      await flow.click(CLICKABLE, ["Start transfer"]);
      await flow.waitFor("app-transfer-progress-card .progress");
      await flow.waitFor("app-toast .toast");
    },
  },
  { name: "compute-40", fixedHeight: true, table: true, steps: openCompute },
  {
    name: "compute-long-label",
    fixedHeight: true,
    table: true,
    variant: { longLabel: true },
    steps: openCompute,
  },
  {
    name: "compute-dialog",
    fixedHeight: true,
    table: true,
    steps: async (flow) => {
      await openCompute(flow);
      // The queue select of the first row; choosing a queue checks access and enables Run.
      await flow.choose("div[app-executablefile] .form-select");
      await flow.click("div[app-executablefile] button.btn-primary");
      await flow.waitFor(".modal");
    },
  },
  {
    name: "ddi-cdi",
    fixedHeight: true,
    table: true,
    steps: async (flow) => {
      await flow.open(`/ddi-cdi?datasetPid=${encodeURIComponent(DATASET)}`);
      await flow.waitFor(".tt-row");
    },
  },
  {
    name: "metadata-selector",
    fixedHeight: true,
    table: true,
    steps: async (flow) => {
      await flow.open("/metadata-selector");
      await flow.waitFor("div[app-metadatafield]");
    },
  },
  {
    name: "submit",
    steps: async (flow) => {
      await openCompare(flow);
      await flow.click(CLICKABLE, ["Copy"]);
      await flow.click(CLICKABLE, ["Confirm file actions"]);
      await flow.waitFor("tr[app-submitted-file]");
    },
  },
  {
    name: "redcap2-export",
    steps: async (flow) => {
      // The connect page restores a REDCap connection from its session snapshot, and
      // "Connect and compare" goes to the export settings with report 42.
      await flow.open("/connect");
      await flow.page.evaluate((dataset) => {
        sessionStorage.setItem(
          "rdm-connect-snapshot",
          JSON.stringify({
            plugin: "redcap2",
            pluginId: "redcap2",
            sourceUrl: "https://redcap.example",
            url: "https://redcap.example",
            token: "project-token",
            option: "42",
            dataset_id: dataset,
          }),
        );
      }, DATASET);
      await flow.open("/connect");
      await flow.click(CLICKABLE, ["Connect and compare"]);
      await flow.waitFor(".anonymization-col app-select");
    },
  },
  {
    name: "globus-picker",
    steps: async (flow) => {
      await flow.open(
        oauthCallback({
          plugin: { label: "Globus", value: "globus" },
          pluginId: { label: "Globus", value: "globus", hidden: true },
        }),
      );
      await flow.waitFor("#repoNameSearch");
      await flow.click("#repoNameSearch");
      await flow.page.type(
        '.cdk-overlay-container input[placeholder="Filter"]',
        "End",
      );
      await flow.settle();
      await flow.click(".cdk-overlay-container .app-select-option", [
        "Endpoint A",
      ]);
      // Expand the placeholder once: the first listing is / > home > alice > Documents, alice
      // selected and expanded.
      await flow.click("app-folder-tree button.folder-toggle");
      await flow.waitFor("app-folder-tree .folder-node.selected");
      await flow.waitFor("app-folder-tree .folder-label::-p-text(Documents)");
    },
  },
];

// Runs in the page. The first visible tree table is measured: its body (the virtual scroll
// viewport or the static body, both .tt-body) and its header. The header's height with no rows
// is its height when it is kept out of flex shrinking, which is what an empty table gives it.
// The page host is the routed component (the element after the router outlet); its content can
// overflow it, or a table can end under the footer, while the document still fits the window.
// The body's clip is the topmost bottom edge among its ancestors that clip overflow (any
// overflow-y but visible; the edge is the inner border edge, scrollbars are hidden): rows below
// it are cut off, or on a scrolled host out of reach. Positions are in document coordinates.
function measure() {
  const round = (n) => Math.round(n * 10) / 10;
  const height = (el) => round(el.getBoundingClientRect().height);
  const top = (el) => round(el.getBoundingClientRect().top + window.scrollY);
  const bottom = (el) =>
    round(el.getBoundingClientRect().bottom + window.scrollY);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const footer = document.querySelector("body > footer");
  const host = document.querySelector(
    "app-root router-outlet",
  )?.nextElementSibling;
  const result = {
    window: window.innerHeight,
    document: document.documentElement.scrollHeight,
    rem,
    footerTop: footer ? top(footer) : null,
    host: host
      ? {
          element: host.localName,
          display: getComputedStyle(host).display,
          overflowY: getComputedStyle(host).overflowY,
          clientHeight: host.clientHeight,
          scrollHeight: host.scrollHeight,
          scrollTop: host.scrollTop,
        }
      : null,
    table: null,
  };
  const tt = [...document.querySelectorAll(".tt")].find((el) =>
    el.checkVisibility(),
  );
  if (tt) {
    const header = tt.querySelector(":scope > .tt-header");
    const body = tt.querySelector(":scope > .tt-body");
    const flex = header.style.flex;
    header.style.flex = "none";
    const headerNoRows = height(header);
    header.style.flex = flex;
    let clip = null;
    for (
      let el = body.parentElement;
      el && el !== document.documentElement;
      el = el.parentElement
    ) {
      const style = getComputedStyle(el);
      if (style.overflowY === "visible") {
        continue;
      }
      const edge = round(bottom(el) - parseFloat(style.borderBottomWidth));
      if (!clip || edge < clip.bottom) {
        const classes = [...el.classList].map((c) => `.${c}`).join("");
        clip = { bottom: edge, by: `<${el.localName}${classes}>` };
      }
    }
    result.table = {
      body: height(body),
      bodyBottom: bottom(body),
      clipBottom: clip?.bottom ?? null,
      clippedBy: clip?.by ?? null,
      header: height(header),
      headerNoRows,
      rows: tt.querySelectorAll(".tt-row").length,
    };
  }
  return result;
}

const round1 = (n) => Math.round(n * 10) / 10;

// The checks that --strict enforces.
function checkLayout(name, def, m) {
  const failures = [];
  const fail = (text) => failures.push(`${name}: ${text}`);
  if (def.fixedHeight && m.document > m.window + ROUNDING_PX) {
    fail(
      `document ${m.document} px is taller than the window ${m.window} px ` +
        `(+${m.document - m.window})`,
    );
  }
  if (def.fixedHeight) {
    if (!m.host) {
      fail("no page host (no element after router-outlet)");
    } else if (def.hostScrolls) {
      if (!["auto", "scroll"].includes(m.host.overflowY)) {
        fail(
          `page host <${m.host.element}> does not scroll (overflow-y ${m.host.overflowY})`,
        );
      }
    } else if (m.host.scrollHeight > m.host.clientHeight + ROUNDING_PX) {
      fail(
        `page host <${m.host.element}> content ${m.host.scrollHeight} px is taller than ` +
          `the host ${m.host.clientHeight} px ` +
          `(+${m.host.scrollHeight - m.host.clientHeight})`,
      );
    }
    if (m.table && m.footerTop === null) {
      fail("no footer");
    } else if (m.table && m.table.bodyBottom > m.footerTop + 0.5) {
      fail(
        `table body ends at ${m.table.bodyBottom} px, under the footer top ` +
          `${m.footerTop} px (+${round1(m.table.bodyBottom - m.footerTop)})`,
      );
    }
  }
  if (def.table && !m.table) {
    fail("no visible tree table (.tt)");
  }
  if (m.table) {
    const { bodyBottom, clipBottom, clippedBy } = m.table;
    if (clipBottom !== null && bodyBottom > clipBottom + 0.5) {
      fail(
        `table body ends at ${bodyBottom} px, under the bottom of ${clippedBy} at ` +
          `${clipBottom} px (+${round1(bodyBottom - clipBottom)})`,
      );
    }
    const minBody = MIN_BODY_REM * m.rem;
    if (m.table.body < minBody) {
      fail(
        `table body ${m.table.body} px is under ${MIN_BODY_REM}rem (${minBody} px)`,
      );
    }
    if (m.table.header < m.table.headerNoRows - 0.5) {
      fail(
        `table header ${m.table.header} px is under its height with no rows ` +
          `(${m.table.headerNoRows} px)`,
      );
    }
  }
  return failures;
}

function describe(m) {
  const parts = [`document ${m.document}/${m.window}`];
  if (m.host) {
    parts.push(
      `host ${m.host.element} ${m.host.scrollHeight}/${m.host.clientHeight}` +
        (m.host.scrollTop ? ` scrolled ${m.host.scrollTop}` : ""),
    );
  }
  if (m.table) {
    parts.push(
      `table body ${m.table.body} (ends ${m.table.bodyBottom}, clip ${m.table.clipBottom}, ` +
        `footer ${m.footerTop})`,
      `header ${m.table.header} (no rows ${m.table.headerNoRows})`,
      `${m.table.rows} rows rendered`,
    );
  }
  return parts.join(", ");
}

const selected = args.pages ? args.pages.split(",") : PAGES.map((p) => p.name);
const unknown = selected.filter((name) => !PAGES.some((p) => p.name === name));
if (unknown.length > 0) {
  console.error(`unknown pages: ${unknown.join(", ")}`);
  process.exit(2);
}

// Chromium on Linux takes its locale from LANGUAGE and LANG; --lang alone leaves
// navigator.language at the machine's.
const browserEnv = () => ({
  ...process.env,
  TZ: TIME_ZONE,
  LANG: `${LANGUAGE.replace("-", "_")}.UTF-8`,
  LANGUAGE: LANGUAGE.replace("-", "_"),
});

// What the browser reports, recorded so that a browser upgrade or a locale change between two
// runs shows in measurements.json.
async function browserInfo(browser) {
  const page = await browser.newPage();
  try {
    return {
      version: await browser.version(),
      ...(await page.evaluate(() => ({
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }))),
    };
  } finally {
    await page.close();
  }
}

const server = await startServer({ dist: args.dist, port: 0 });
const browser = await puppeteer.launch({
  executablePath: args.chromium,
  headless: true,
  args: [`--lang=${LANGUAGE}`],
  env: browserEnv(),
});
const info = await browserInfo(browser);
console.log(
  `browser ${info.version}, language ${info.language}, time zone ${info.timeZone}`,
);
if (info.language !== LANGUAGE || info.timeZone !== TIME_ZONE) {
  console.warn(
    `the browser did not take the pinned language ${LANGUAGE} and time zone ${TIME_ZONE}`,
  );
}
fs.mkdirSync(args.out, { recursive: true });
const measurements = {};
const failures = [];
const missed = [];
// The texts of the console and page errors, by capture.
const errors = new Map();

async function capture(def, viewport) {
  const name = `${def.name}-${viewport.width}x${viewport.height}`;
  const logError = (text) =>
    errors.set(name, [...(errors.get(name) ?? []), text]);
  const expected = [];
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() !== "error") {
        return;
      }
      // A failed resource message has no URL in its text; its location has it. The text has
      // the status: "... responded with a status of 404 (Not Found)".
      const url = message.location()?.url;
      if (!url || !message.text().startsWith("Failed to load resource")) {
        logError(message.text());
        return;
      }
      const pathname = new URL(url).pathname;
      const status = Number(/status of (\d+)/.exec(message.text())?.[1]);
      if (
        def.expectedFailures?.some(
          (f) => f.path === pathname && f.status === status,
        )
      ) {
        expected.push(`${message.text()}: ${url}`);
      } else {
        logError(`${message.text()}: ${url}`);
      }
    });
    page.on("pageerror", (err) => logError(`page error: ${err.message}`));
    page.on("dialog", (dialog) => dialog.dismiss());
    if (def.holdToasts) {
      await page.evaluateOnNewDocument(holdTimeouts, HOLD_TIMEOUTS_MS);
    }
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: scheme },
    ]);
    server.setVariant({ ...DEFAULT_VARIANT, ...def.variant });
    await def.steps(new Flow(page, server.url));
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-bs-theme"),
    );
    if (theme !== scheme) {
      throw new Error(`data-bs-theme is ${theme}, not ${scheme}`);
    }
    if (def.freezeAnimations) {
      await page.addStyleTag({
        content: "*, *::before, *::after { animation: none !important; }",
      });
    }
    // Fixed overlays are drawn relative to the viewport, so keep it at the top of the page.
    await page.evaluate(() => window.scrollTo(0, 0));
    // A host that may scroll is measured scrolled to its end, where its table must end above
    // the footer, and captured at its top, as the user first sees it.
    const scrollHost = (toEnd) =>
      page.evaluate((toEnd) => {
        const host = document.querySelector(
          "app-root router-outlet",
        )?.nextElementSibling;
        if (host) {
          host.scrollTop = toEnd ? host.scrollHeight : 0;
        }
      }, toEnd);
    if (def.hostScrolls) {
      await scrollHost(true);
    }
    const m = await page.evaluate(measure);
    if (def.hostScrolls) {
      await scrollHost(false);
    }
    await page.screenshot({
      path: path.join(args.out, `${name}.png`),
      fullPage: true,
    });
    const found = checkLayout(name, def, m);
    measurements[name] = {
      page: def.name,
      viewport,
      fixedHeight: !!def.fixedHeight,
      expectTable: !!def.table,
      holdToasts: !!def.holdToasts,
      hostScrolls: !!def.hostScrolls,
      ...m,
      checks: found,
      expectedFailures: expected,
    };
    failures.push(...found);
    console.log(`captured ${name}: ${describe(m)}`);
  } catch (err) {
    console.warn(`not captured ${name}: ${err.message}`);
    missed.push(name);
  } finally {
    await context.close();
    // Whatever the page expects, a request the mock could not answer fails the capture.
    for (const problem of server.takeProblems()) {
      logError(`mock: ${problem}`);
    }
  }
}

try {
  for (const def of PAGES.filter((p) => selected.includes(p.name))) {
    for (const viewport of VIEWPORTS) {
      await capture(def, viewport);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

fs.writeFileSync(
  path.join(args.out, "measurements.json"),
  `${JSON.stringify(
    {
      browser: info,
      scheme,
      strict: args.strict,
      captures: measurements,
      failures,
      missed,
      errors: Object.fromEntries(errors),
    },
    null,
    2,
  )}\n`,
);
if (failures.length > 0) {
  console.warn(
    args.strict
      ? "layout checks failed:"
      : "layout checks (enforced with --strict):",
  );
  for (const failure of failures) {
    console.warn(`  ${failure}`);
  }
  if (args.strict) {
    process.exitCode = 1;
  }
}
if (missed.length > 0) {
  console.warn(`not captured: ${missed.join(", ")}`);
  process.exitCode = 1;
}
for (const [name, texts] of errors) {
  console.warn(`console errors on ${name}: ${texts.length}`);
  for (const text of texts) {
    console.warn(`  ${text}`);
  }
}
if (errors.size > 0) {
  process.exitCode = 1;
}
