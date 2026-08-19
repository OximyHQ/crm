import { OXIMY_PRODUCT_LABELS, type OximyProduct } from "@crm/validation";
import { OXIMY_PRODUCT_DOCUMENT } from "./oximy-products.generated";

export async function productContext(product: OximyProduct) {
	const label = OXIMY_PRODUCT_LABELS[product];
	const markdown = OXIMY_PRODUCT_DOCUMENT;
	const heading = `## ${label}`;
	const start = markdown.indexOf(heading);

	if (start === -1) {
		throw new Error(`The product document has no ${label} section.`);
	}

	const next = markdown.indexOf("\n## ", start + heading.length);
	const section = markdown.slice(start, next === -1 ? undefined : next).trim();

	return {
		ok: true as const,
		configured: true as const,
		product,
		label,
		markdown: section,
	};
}
