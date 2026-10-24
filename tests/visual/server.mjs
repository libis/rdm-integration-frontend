// Mock backend for the visual checks: serves the built app and answers /api/* from the JSON
// fixtures in fixtures/. Run alone:
// node server.mjs --dist <browser dir> [--rejected <n>] [--long-label] [--port 4300]
// The variant (rejected file names on compare, long dataset label on compute) can also be
// changed while the server runs: GET /__variant?rejected=12&longLabel=true.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

// rejected: how many of the names in compare-cached.json the compare result lists as
// rejected. longLabel: answer the dataset lookups with dvobjects-datasets-long-label.json.
export const DEFAULT_VARIANT = { rejected: 0, longLabel: false };

// A route handler returns the JSON body of a 200 answer, or reply(status, body) for any other
// status: a string body is sent as text/plain, as the Go backend writes its errors, anything
// else as JSON. The browser logs every error status as a console error, which fails the run
// unless the page lists the path and status in expectedFailures (shoot.mjs). A request without
// a route, or whose handler throws, is a problem of the mock instead (see takeProblems).
class Reply {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}
const reply = (status, body) => new Reply(status, body);

// Fixtures are read on every request, so an edited fixture applies without a restart.
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

// The file lists follow the reviewer's stubs: every third file at the root, the others in
// folder0 to folder4, the status cycling through equal, new, updated and deleted.
function generateFiles({ count, extension }) {
  return Array.from({ length: count }, (_, i) => {
    const folder = i % 3 === 0 ? "" : `folder${i % 5}`;
    const name = `file${i}.${extension}`;
    return {
      id: folder ? `${folder}/${name}` : name,
      name,
      path: folder,
      status: i % 4,
      action: 0,
      hidden: false,
      attributes: { isFile: true },
    };
  });
}

// A fixture whose data is {"generate": {"count", "extension"}} gets the generated list.
function withFiles(result) {
  const spec = result.data?.generate;
  return spec ? { ...result, data: generateFiles(spec) } : result;
}

function compareCached(variant) {
  const cached = fixture("compare-cached.json");
  const names = cached.res.rejectedName;
  if (variant.rejected > names.length) {
    throw new Error(
      `compare-cached.json lists ${names.length} rejected names, ${variant.rejected} asked`,
    );
  }
  const res = withFiles(cached.res);
  return {
    ...cached,
    res: { ...res, rejectedName: names.slice(0, variant.rejected) },
  };
}

function dvObjects(ctx) {
  if (ctx.body?.objectType === "Dataverse") {
    return fixture("dvobjects-collections.json");
  }
  return fixture(
    ctx.variant.longLabel
      ? "dvobjects-datasets-long-label.json"
      : "dvobjects-datasets.json",
  );
}

// Finds the node with the given value in a nested listing.
function findNode(items, value) {
  for (const item of items) {
    if (item.value === value) {
      return item;
    }
    const found = item.children && findNode(item.children, value);
    if (found) {
      return found;
    }
  }
  return null;
}

// The Globus folder listings. The first one (option "") follows the picker rules and the
// backend's buildHierarchy (globus/options.go): a selectable "/" that is never preselected,
// with the resolved home below it preselected and expanded, its folders listed. Expanding "/"
// lists options-globus-root.json, without another root wrapper. Expanding a folder of the first
// listing lists the children it has there, flat (label and value), as the backend lists a
// folder, so "/home/alice/" answers its Documents again. null for any other folder.
function globusListing(option) {
  const first = fixture("options-globus-home.json");
  if (!option) {
    return first;
  }
  if (option === "/") {
    return fixture("options-globus-root.json");
  }
  return (
    findNode(first, option)?.children?.map(({ label, value }) => ({
      label,
      value,
    })) ?? null
  );
}

// The REDCap export page asks for its variables through the options route; the Globus
// picker asks for folders. Any other request is logged and answered with an empty list.
function options(ctx) {
  const body = ctx.body ?? {};
  let pluginOptions = {};
  try {
    pluginOptions = body.pluginOptions ? JSON.parse(body.pluginOptions) : {};
  } catch {
    pluginOptions = {};
  }
  if (body.plugin === "redcap2" && pluginOptions.request === "variables") {
    return fixture("options-redcap-variables.json");
  }
  const listing = body.plugin === "globus" ? globusListing(body.option) : null;
  if (listing) {
    return listing;
  }
  console.warn(
    `mock: no options for plugin ${body.plugin} option ${JSON.stringify(body.option)}, ` +
      "answering []",
  );
  return [];
}

const ROUTES = [
  ["GET", "/api/frontend/config", () => fixture("frontend-config.json")],
  ["GET", "/api/common/userinfo", () => fixture("userinfo.json")],
  ["POST", "/api/plugin/compare", () => fixture("compare-key.json")],
  ["POST", "/api/common/cached", (ctx) => compareCached(ctx.variant)],
  ["POST", "/api/common/dvobjects", dvObjects],
  [
    "POST",
    "/api/common/executable",
    () => withFiles(fixture("executable.json")),
  ],
  [
    "POST",
    "/api/common/downloadable",
    () => withFiles(fixture("downloadable.json")),
  ],
  [
    "POST",
    "/api/common/ddicdicompatible",
    () => withFiles(fixture("ddicdi-compatible.json")),
  ],
  // No previously generated DDI-CDI output. The backend (ddi_cdi.go) answers that with
  // reply(404, "404 - no cached output found"); the page treats {} the same, and {} logs no
  // failed resource.
  [
    "POST",
    "/api/common/cachedddicdioutput",
    () => fixture("ddicdi-cached-output.json"),
  ],
  ["POST", "/api/plugin/options", options],
  ["POST", "/api/plugin/search", () => fixture("search.json")],
  ["POST", "/api/common/oauthtoken", () => fixture("oauthtoken.json")],
  ["POST", "/api/common/checkaccess", () => fixture("checkaccess.json")],
  ["POST", "/api/common/useremail", () => fixture("useremail.json")],
  ["POST", "/api/common/metadata", () => fixture("metadata.json")],
  // A Globus download: the task it starts and that task's status, still running, so the
  // download page shows its transfer card.
  ["POST", "/api/common/download", () => fixture("download.json")],
  [
    "GET",
    "/api/common/globus/status",
    () => fixture("globus-status-active.json"),
  ],
];

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": CONTENT_TYPES[".json"],
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "content-type": CONTENT_TYPES[".txt"],
    "cache-control": "no-store",
  });
  res.end(text);
}

function sendFile(res, file) {
  res.writeHead(200, {
    "content-type":
      CONTENT_TYPES[path.extname(file).toLowerCase()] ||
      "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

// Resolves a URL path inside root; null when it escapes root or is not a file.
function fileIn(root, urlPath) {
  const file = path.resolve(root, `.${urlPath}`);
  if (file !== root && !file.startsWith(root + path.sep)) {
    return null;
  }
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(text ? JSON.parse(text) : null);
      } catch {
        resolve(text);
      }
    });
  });
}

function parseVariant(changes) {
  const variant = {};
  if (changes.rejected !== undefined) {
    const rejected = Number(changes.rejected);
    if (!Number.isInteger(rejected) || rejected < 0) {
      throw new Error(`rejected must be a count, not "${changes.rejected}"`);
    }
    variant.rejected = rejected;
  }
  if (changes.longLabel !== undefined) {
    variant.longLabel =
      changes.longLabel === true || changes.longLabel === "true";
  }
  return variant;
}

// Resolves to {url, close, setVariant, variant, takeProblems}; setVariant({rejected, longLabel})
// changes what the following API requests answer. takeProblems() returns and forgets the
// requests the mock could not answer as meant: no route (answered 404) or a handler that threw
// (answered 500).
export function startServer({ dist, port = 0, ...variant }) {
  if (!dist || !fs.existsSync(path.join(dist, "index.html"))) {
    return Promise.reject(new Error(`no index.html in dist folder "${dist}"`));
  }
  const distDir = path.resolve(dist);
  let current = { ...DEFAULT_VARIANT, ...parseVariant(variant) };
  let origin = "";
  let problems = [];

  async function handleApi(req, res, url) {
    const route = ROUTES.find(
      ([method, p]) => method === req.method && p === url.pathname,
    );
    const ctx = {
      body: await readBody(req),
      query: url.searchParams,
      variant: current,
    };
    let answer;
    if (route) {
      answer = route[2](ctx);
    } else {
      const problem = `no route for ${req.method} ${url.pathname}`;
      console.warn(`mock: ${problem}`);
      problems.push(problem);
      answer = reply(404, { detail: "Not Found" });
    }
    if (!(answer instanceof Reply)) {
      sendJson(res, 200, answer);
    } else if (typeof answer.body === "string") {
      sendText(res, answer.status, answer.body);
    } else {
      sendJson(res, answer.status, answer.body);
    }
  }

  function handleVariant(res, url) {
    let changes;
    try {
      changes = parseVariant(Object.fromEntries(url.searchParams));
    } catch (err) {
      sendJson(res, 400, { detail: err.message });
      return;
    }
    current = { ...current, ...changes };
    console.log(`mock: variant ${JSON.stringify(current)}`);
    sendJson(res, 200, current);
  }

  async function handle(req, res) {
    const url = new URL(req.url, origin);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else if (url.pathname === "/__variant") {
      handleVariant(res, url);
    } else {
      // Every other path is the app: a file from dist, else index.html for the router.
      const file = fileIn(distDir, decodeURIComponent(url.pathname));
      sendFile(res, file || path.join(distDir, "index.html"));
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(
        `mock: ${req.method} ${req.url} failed: ${err.stack || err}`,
      );
      problems.push(`${req.method} ${req.url} failed: ${err.message ?? err}`);
      if (!res.headersSent) {
        sendJson(res, 500, { detail: String(err) });
      } else {
        res.end();
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      origin = `http://localhost:${server.address().port}`;
      resolve({
        url: origin,
        get variant() {
          return { ...current };
        },
        setVariant: (changes) => {
          current = { ...current, ...parseVariant(changes) };
        },
        takeProblems: () => {
          const taken = problems;
          problems = [];
          return taken;
        },
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const { values: args } = parseArgs({
    options: {
      dist: { type: "string" },
      port: { type: "string", default: "4300" },
      rejected: { type: "string" },
      "long-label": { type: "boolean" },
    },
  });
  const { url, variant } = await startServer({
    dist: args.dist,
    port: Number(args.port),
    rejected: args.rejected,
    longLabel: args["long-label"],
  });
  console.log(
    `mock server on ${url}, variant ${JSON.stringify(variant)} (Ctrl+C to stop)`,
  );
}
