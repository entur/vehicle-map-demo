// Snapshots the OpenFreeMap styles the base map is built from into
// src/components/basemap/. The app composes both into one style at build time
// (see basemap.ts), so the layer ids must be known to the tests, not fetched at
// runtime. Refresh: run `npm run fetch-basemap`, check both colour schemes in
// the browser, commit.
import { writeFile } from "node:fs/promises";

const STYLES = {
  positron: "https://tiles.openfreemap.org/styles/positron",
  fiord: "https://tiles.openfreemap.org/styles/fiord",
};

for (const [name, url] of Object.entries(STYLES)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const style = await response.json();
  const target = new URL(
    `../src/components/basemap/${name}.json`,
    import.meta.url,
  );
  await writeFile(target, JSON.stringify(style, null, 2) + "\n");
  console.log(`wrote ${target.pathname} (${style.layers.length} layers)`);
}
