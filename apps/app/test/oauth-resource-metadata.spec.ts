import { afterEach, expect, it } from "bun:test";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

it("publishes the issuer returned by the OAuth service", async () => {
	globalThis.fetch = Object.assign(
		async () =>
			Response.json({
				issuer: "https://crm.oximy.com/api/auth",
			}),
		{ preconnect: originalFetch.preconnect },
	);

	const { GET } = await import(
		"../app/.well-known/oauth-protected-resource/api/mcp/route"
	);
	const response = await GET();
	const metadata = await response.json();

	expect(metadata.authorization_servers).toEqual([
		"https://crm.oximy.com/api/auth",
	]);
});
