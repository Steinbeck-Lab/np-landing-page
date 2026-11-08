import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { initialResources } from "../src/content.js";

const destination = new URL("../public/logos/", import.meta.url);
await mkdir(destination, { recursive: true });
const identity = {
  slug: "natural-products",
  name: "Natural Products Online",
  source:
    "https://naturalproducts.net/wp-content/uploads/2020/07/cropped-NP3_S.png",
};
const groupIdentity = {
  slug: "steinbeck-group",
  name: "Steinbeck Group",
  source:
    "https://naturalproducts.net/wp-content/uploads/2025/01/cheminflogo_web.png",
};
const resources = [identity, groupIdentity, ...initialResources];
const requested = process.argv.slice(2);
for (const slug of requested) {
  if (!resources.some((resource) => resource.slug === slug)) {
    throw new Error(`Unknown logo slug: ${slug}`);
  }
}
for (const resource of resources.filter(
  (resource) => !requested.length || requested.includes(resource.slug),
)) {
  const response = await fetch(resource.source, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Logo import failed for ${resource.name}: HTTP ${response.status}`,
    );
  const image = await sharp(Buffer.from(await response.arrayBuffer()), {
    limitInputPixels: 16_000_000,
  })
    .resize({
      width: 640,
      height: 240,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();
  await writeFile(new URL(`${resource.slug}.webp`, destination), image);
  console.log(`Imported ${resource.name}`);
}
