import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);
const outputDir = resolve(process.cwd(), "out");
const notFoundPath = join(outputDir, "404.html");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolvePath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const candidatePath = join(outputDir, normalizedPath);

  if (existsSync(candidatePath) && statSync(candidatePath).isDirectory()) {
    return join(candidatePath, "index.html");
  }

  return candidatePath;
}

function sendFile(response, filePath, statusCode = 200) {
  const extension = extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] ?? "application/octet-stream";

  response.writeHead(statusCode, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const filePath = resolvePath(requestUrl.pathname);

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(response, filePath);
    return;
  }

  if (existsSync(notFoundPath)) {
    sendFile(response, notFoundPath, 404);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Serving static export from ${outputDir} at http://localhost:${port}`);
});
