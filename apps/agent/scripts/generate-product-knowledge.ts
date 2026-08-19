import { readFile, writeFile } from "node:fs/promises";

const source = new URL("../agent/knowledge/oximy-products.md", import.meta.url);
const target = new URL(
	"../agent/lib/oximy-products.generated.ts",
	import.meta.url,
);

const markdown = await readFile(source, "utf8");
const moduleSource = `export const OXIMY_PRODUCT_DOCUMENT =\n\t${JSON.stringify(markdown)};\n`;

await writeFile(target, moduleSource, "utf8");
