import type { ZodType, z } from "zod";
import * as agents from "./agents";
import * as granola from "./granola";
import * as oximy from "./oximy";
import * as quo from "./quo";
import * as slack from "./slack";

export const schemas = { agents, granola, oximy, quo, slack } as const;

export type {
	Handoff,
	HandoffChannel,
	InputOption,
	InputRequest,
	InputRequested,
	Permission,
} from "./agents";
export type { OximyProduct } from "./oximy";
export {
	OXIMY_PRODUCT_FIELD_KEY,
	OXIMY_PRODUCT_LABELS,
	OXIMY_PRODUCTS,
	oximyProduct,
} from "./oximy";
export type { QuoWebhookEvent } from "./quo";
export type { AuthTest, Installation, JoinPayload, Reply } from "./slack";

export class InvalidInput extends Error {
	override readonly name = "InvalidInput";
}

export function parse<Schema extends ZodType>(
	schema: Schema,
	value: unknown,
	subject: string,
): z.infer<Schema> {
	const result = schema.safeParse(value);

	if (!result.success) {
		throw new InvalidInput(
			`${subject}: ${result.error.issues
				.map((issue) =>
					issue.path.length > 0
						? `${issue.path.join(".")} ${issue.message}`
						: issue.message,
				)
				.join("; ")}`,
		);
	}

	return result.data;
}
