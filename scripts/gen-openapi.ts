import fs from "node:fs";
import { buildOpenApi } from "../src/api/openapi";
fs.writeFileSync("docs/openapi.json", JSON.stringify(buildOpenApi(), null, 2));
console.log("wrote docs/openapi.json");
