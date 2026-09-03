import fs from "node:fs";
import path from "node:path";

/** Minimal .env loader (no dependency): loads .env then .env.local without overriding existing vars. */
export function loadEnv(cwd = process.cwd()) {
  for (const file of [".env", ".env.local"]) {
    const p = path.join(cwd, file);
    if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      const hash = val.indexOf(" #");
      if (hash >= 0 && !val.startsWith('"')) val = val.slice(0, hash).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadEnv();
