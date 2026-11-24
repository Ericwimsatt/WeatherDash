import { createHash } from "node:crypto";
import { readFile,readdir,writeFile } from "node:fs/promises";
const html = await readFile(new URL("../dist/index.html",import.meta.url));
const file = new URL("../dist/sw.js",import.meta.url);
const source = await readFile(file,"utf8");
const builtAssets = (await readdir(new URL("../dist/assets/",import.meta.url))).sort().map(name => "/assets/"+name);
const version = createHash("sha256").update(html).update(source).update(JSON.stringify(builtAssets)).digest("hex").slice(0,12);
await writeFile(file,source.replace("__SHELL_VERSION__",version).replace("__BUILT_ASSETS__",JSON.stringify(builtAssets)));
