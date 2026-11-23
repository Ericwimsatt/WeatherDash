import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [outputDirectory] = process.argv.slice(2);
if (!outputDirectory) throw new Error("Pass an output directory for the HTML renderings.");

const read = name => readFile(new URL(name, import.meta.url), "utf8");
const [template, css, snapshot, geography, script] = await Promise.all([
  read("index.html"), read("preview.css"), read("snapshot.js"), read("geography.js"), read("preview.js"),
]);

function inlineScript(source) {
  return `<script>\n${source.replace(/<\/script/gi, "<\\/script")}\n</script>`;
}

const portable = template
  .replace('<link rel="stylesheet" href="preview.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="snapshot.js"></script>', () => inlineScript(snapshot))
  .replace('<script src="geography.js"></script>', () => inlineScript(geography))
  .replace('<script src="preview.js"></script>', () => inlineScript(script));
for (const view of ["table", "map"]) {
  const html = portable.replace('<html lang="en">', `<html lang="en" data-initial-view="${view}">`);
  await writeFile(join(outputDirectory, `san-diego-beach-finder-evidence-matrix-${view}.html`), html);
}
