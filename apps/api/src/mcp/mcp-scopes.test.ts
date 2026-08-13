import { describe, expect, it } from "bun:test";
import { MCP_SCOPES } from "@crm/auth";
import { toolGroupsFor } from "./mcp-scopes";

describe("MCP scopes", () => {
	it("does not expose write or agent tools to a read-only token", () => {
		expect(toolGroupsFor([MCP_SCOPES.read])).toEqual({
			read: true,
			write: false,
			agents: false,
			delete: false,
			admin: false,
		});
	});

	it("reads scopes from OAuth JWT claims", () => {
		expect(toolGroupsFor("crm:read crm:agents crm:delete crm:admin")).toEqual({
			read: true,
			write: false,
			agents: true,
			delete: true,
			admin: true,
		});
	});
});
