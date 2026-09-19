import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

/** Loaded only by the settings command. No background listener or polling. */
export async function startSettingsWeb(
  snapshot: () => { settings: unknown },
  update: (value: unknown) => Promise<void>,
  idleMs: () => number,
) {
  const html = await readFile(new URL("./settings.html", import.meta.url));
  const token = randomBytes(24).toString("hex");
  let origin = "";
  let closed = false;
  let saving = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  const version = () => '"' + createHash("sha256").update(JSON.stringify(snapshot().settings)).digest("hex") + '"';
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    server.close();
    server.closeAllConnections();
  };
  const touch = () => {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => saving ? touch() : close(), idleMs());
    timer.unref();
  };
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (req.headers.host !== origin.slice(7) || (req.headers.origin && req.headers.origin !== origin)) {
      res.writeHead(403).end(); return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); return;
    }
    if (req.url !== "/settings" || req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(403).end(); return;
    }
    try {
      if (req.method === "PUT") {
        if (req.headers["content-type"] !== "application/json") { res.writeHead(415).end(); return; }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16384) { res.writeHead(413).end(); return; }
        }
        const value: unknown = JSON.parse(body);
        saving++;
        try {
          const pending = queue.then(async () => {
            if (req.headers["if-match"] !== version()) return false;
            await update(value);
            return true;
          });
          queue = pending.then(() => {}, () => {});
          if (!await pending) { res.writeHead(409).end("Settings changed elsewhere. Reopen settings before saving."); return; }
        } finally { saving--; }
      } else if (req.method !== "GET") { res.writeHead(405).end(); return; }
      touch();
      res.setHeader("ETag", version());
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(snapshot()));
    } catch (error) {
      res.writeHead(error instanceof TypeError || error instanceof SyntaxError ? 400 : 500);
      res.end("Unable to save settings. Check the values and file permissions.");
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") { close(); throw new Error("Unable to start settings"); }
  origin = `http://127.0.0.1:${address.port}`;
  server.unref();
  touch();
  return { url: `${origin}/#${token}`, close, touch, get closed() { return closed; } };
}
