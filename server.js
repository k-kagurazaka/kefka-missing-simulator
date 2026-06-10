const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const docsRoot = path.join(root, "docs");
const devRoot = path.join(root, "dev");
const logFile = path.join(root, "dev-log.jsonl");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const reloadClients = new Set();
const reloadSnippet = `<script>(()=>{const es=new EventSource('/__reload');es.onmessage=()=>location.reload();es.onerror=()=>es.close();})();</script>`;

http
  .createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);

    if (pathname === "/__reload") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      response.write(": connected\n\n");
      reloadClients.add(response);
      request.on("close", () => reloadClients.delete(response));
      return;
    }

    if (pathname === "/__dev/log" && request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          const line = JSON.stringify({ t: new Date().toISOString(), ...data }) + "\n";
          fs.appendFileSync(logFile, line);
          response.writeHead(204);
          response.end();
        } catch {
          response.writeHead(400);
          response.end("Invalid JSON");
        }
      });
      return;
    }

    let baseRoot;
    let relativePath;
    if (pathname.startsWith("/dev/")) {
      baseRoot = devRoot;
      relativePath = pathname.slice("/dev/".length);
    } else {
      baseRoot = docsRoot;
      relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    }
    const filePath = path.resolve(baseRoot, relativePath);

    if (!filePath.startsWith(baseRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });

    if (ext === ".html") {
      const html = fs.readFileSync(filePath, "utf8");
      response.end(html.includes("</body>") ? html.replace("</body>", `${reloadSnippet}</body>`) : html + reloadSnippet);
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  })
  .listen(port, () => {
    console.log(`Missing simulator: http://localhost:${port}`);
  });

let reloadTimer = null;
fs.watch(root, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const normalized = filename.replace(/\\/g, "/");
  if (normalized.startsWith(".git/") || normalized.startsWith("node_modules/")) return;
  if (normalized === "dev-log.jsonl") return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of reloadClients) client.write("data: reload\n\n");
  }, 80);
});
