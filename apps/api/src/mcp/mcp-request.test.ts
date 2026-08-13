import { describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import { readMcpRequestBody } from "./mcp-request";

describe("MCP request body", () => {
	it("parses JSON-RPC from an unread request stream", async () => {
		const payload = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: { protocolVersion: "2025-11-25" },
		};
		const request = Readable.from([JSON.stringify(payload)]);

		expect(await readMcpRequestBody(request)).toEqual(payload);
	});

	it("returns a body that middleware already parsed", async () => {
		const payload = { jsonrpc: "2.0", method: "notifications/initialized" };
		const request = Object.assign(Readable.from([]), { body: payload });

		expect(await readMcpRequestBody(request)).toBe(payload);
	});
});
