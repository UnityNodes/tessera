#!/usr/bin/env node
/**
 *
 *
 *   STITCH_KEY=... node scripts/stitch-pull.mjs [projectId ...]
 *
 */

const KEY = process.env.STITCH_KEY;
if (!KEY) {
  console.error("STITCH_KEY");
  process.exit(1);
}

const ENDPOINT = "https://stitch.googleapis.com/mcp";
const OUT = new URL("../stitch/", import.meta.url).pathname;

let id = 0;
async function call(name, args = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Goog-Api-Key": KEY,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const body = await res.json();
  if (body.result?.isError) throw new Error(body.result.content?.[0]?.text ?? "Stitch");
  return JSON.parse(body.result.content[0].text);
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "screen";

const { mkdir, writeFile } = await import("node:fs/promises");

const wanted = process.argv.slice(2);
const { projects = [] } = await call("list_projects");
const targets = projects.filter((p) => !wanted.length || wanted.includes(p.name.split("/").pop()));

let saved = 0;
let skipped = 0;

for (const project of targets) {
  const pid = project.name.split("/").pop();
  const dir = `${OUT}${slug(project.title ?? pid)}`;
  const { screens = [] } = await call("list_screens", { projectId: pid });

  for (const screen of screens) {
    const url = screen.htmlCode?.downloadUrl;
    const short = screen.name.split("/").pop().slice(0, 8);
    if (!url) {
      skipped++;
      console.log(`  --   ${screen.title} (${short}) `);
      continue;
    }
    await mkdir(dir, { recursive: true });
    const html = await fetch(url, { headers: { "X-Goog-Api-Key": KEY } }).then((r) => r.text());
    const file = `${dir}/${slug(screen.title ?? short)}-${short}.html`;
    await writeFile(file, html);
    saved++;
    console.log(`  CODE ${screen.title} (${short}) → ${file.replace(OUT, "stitch/")}`);
  }
}

console.log(`\n${saved}, ${skipped}`);
