import { describe, expect, it } from "bun:test";
import { describeOAuthScopes } from "./oauth-consent";

describe("OAuth consent", () => {
	it("describes CRM permissions without an import capability", () => {
		const permissions = describeOAuthScopes(
			"openid profile email offline_access crm:read crm:write crm:agents",
		);

		expect(permissions).toEqual([
			"See your CRM companies, contacts, deals, users, and fields",
			"Create and update CRM companies, contacts, and deals",
			"Start CRM research and agent runs through Eve",
			"Keep this connection active until you disconnect it",
		]);
		expect(permissions.join(" ").toLowerCase()).not.toContain("import");
	});
});
