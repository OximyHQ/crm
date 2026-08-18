import { describe, expect, it } from "bun:test";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { readBody } from "./request-body";

describe("integration request bodies", () => {
	it("reads exact bytes preserved by the JSON parser", async () => {
		const rawBody = Buffer.from('{ "event": true }');
		const request = Object.assign(Readable.from([]), {
			rawBody,
		}) as IncomingMessage & { rawBody: Buffer };

		expect(await readBody(request, rawBody.length)).toBe(
			rawBody.toString("utf8"),
		);
	});

	it("rejects a preserved body above the integration limit", async () => {
		const request = Object.assign(Readable.from([]), {
			rawBody: Buffer.from("too long"),
		}) as IncomingMessage & { rawBody: Buffer };

		expect(await readBody(request, 3)).toBeNull();
	});

	it("still reads an unparsed request stream", async () => {
		const request = Readable.from(["one", "two"]) as IncomingMessage;

		expect(await readBody(request, 6)).toBe("onetwo");
	});
});
