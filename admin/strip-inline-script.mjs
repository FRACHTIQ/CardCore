import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const p = join(__dirname, "index.html");
let h = fs.readFileSync(p, "utf8");
const start = h.indexOf("  <script>");
const end = h.lastIndexOf("</script>");
if (start < 0 || end < 0) {
  console.error("markers not found", { start, end });
  process.exit(1);
}
const before = h.slice(0, start);
const after = h.slice(end + "</script>".length);
const inject = '  <script src="app.js" defer></script>\n';
fs.writeFileSync(p, before + inject + after, "utf8");
console.log("replaced inline script, bytes:", before.length, inject.length, after.length);
