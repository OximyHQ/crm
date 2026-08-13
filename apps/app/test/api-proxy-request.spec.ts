import { describe, expect, test } from "bun:test";
import { bufferedRequestBody } from "../lib/api-proxy-request";

describe("API proxy requests", () => {
	test("preserves an MCP JSON-RPC body byte for byte", async () => {
		const payload = JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: { protocolVersion: "2025-06-18" },
		});
		const request = new Request("https://crm.oximy.com/api/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: payload,
		});

		const body = await bufferedRequestBody(request);

		if (!body) throw new Error("Expected a buffered request body.");
		expect(new TextDecoder().decode(body)).toBe(payload);
	});

	test("returns no body for GET and HEAD requests", async () => {
		for (const method of ["GET", "HEAD"]) {
			const request = new Request("https://crm.oximy.com/api/health", {
				method,
			});

			expect(await bufferedRequestBody(request)).toBeNull();
		}
	});
});
