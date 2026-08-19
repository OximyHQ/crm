import { afterEach, describe, expect, it } from "bun:test";
import { McpAgentBridgeService } from "./mcp-agent-bridge.service";

const originalSecret = process.env.AGENT_BRIDGE_SECRET;

afterEach(() => {
	if (originalSecret === undefined) {
		delete process.env.AGENT_BRIDGE_SECRET;
	} else {
		process.env.AGENT_BRIDGE_SECRET = originalSecret;
	}
});

describe("MCP agent bridge", () => {
	it("returns unavailable without the optional agent capability", async () => {
		delete process.env.AGENT_BRIDGE_SECRET;
		const bridge = new McpAgentBridgeService();

		expect(await bridge.productContext({ product: "relay" })).toEqual({
			ok: false,
			configured: false,
			reason: "The CRM agent bridge is not configured.",
		});
	});
});
