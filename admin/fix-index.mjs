import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
const p = join(dir, "index.html");
const h = fs.readFileSync(p, "utf8");

const openIdx = h.indexOf("<script");
if (openIdx < 0) {
  console.error("no <script> found");
  process.exit(1);
}
const afterOpen = h.slice(openIdx, openIdx + 80);
if (afterOpen.includes("src=")) {
  console.log("already using external app.js — nothing to do");
  process.exit(0);
}

const start = h.indexOf("  <script>");
const end = h.lastIndexOf("  </script>");
if (start < 0 || end < 0 || end <= start) {
  console.error("inline script markers", start, end);
  process.exit(1);
}

const inject = '  <script src="app.js" defer></script>\n';
const out = h.slice(0, start) + inject + h.slice(end + "  </script>".length);
fs.writeFileSync(p, out);
console.log("replaced inline script, bytes:", out.length);
