import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { productContext } from "./oximy-product-context";
import { OXIMY_PRODUCT_DOCUMENT } from "./oximy-products.generated";

describe("Oximy product context", () => {
	it("bundles the complete Markdown source", async () => {
		const source = await readFile(
			new URL("../knowledge/oximy-products.md", import.meta.url),
			"utf8",
		);
		expect(OXIMY_PRODUCT_DOCUMENT).toBe(source);
	});

	it("returns only the requested product section", async () => {
		const result = await productContext("relay");

		expect(result.product).toBe("relay");
		expect(result.label).toBe("Relay");
		expect(result.markdown).toStartWith("## Relay");
		expect(result.markdown).toContain("### ICP");
		expect(result.markdown).not.toContain("## Visibility");
		expect(result.markdown).not.toContain("## Sidekick");
	});
});
