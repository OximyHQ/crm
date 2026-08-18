import { describe, expect, it } from "bun:test";
import { createQuoConnection, listQuoContacts } from "../agent/lib/quo-client";
import { QUO } from "../agent/lib/quo-config";

describe("Quo client", () => {
	it("loads one linked contact without scanning the account", async () => {
		const requests: string[] = [];
		const fetcher = (async (input: string | URL | Request) => {
			requests.push(String(input));
			return Response.json({ data: [], nextPageToken: null });
		}) as typeof fetch;

		expect(
			await listQuoContacts(
				"test-api-key",
				{ externalIds: ["contact-one"] },
				fetcher,
			),
		).toEqual([]);
		expect(
			new URL(requests[0] ?? "http://invalid").searchParams.getAll(
				"externalIds",
			),
		).toEqual(["contact-one"]);
	});

	it("replaces one account webhook with the complete event subscription", async () => {
		const requests: { url: string; init?: RequestInit }[] = [];
		const fetcher = (async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = String(input);
			requests.push({ url, init });
			if (url.endsWith("/users")) {
				return Response.json({
					data: [
						{
							id: "US123",
							email: "owner@example.com",
							firstName: "Owner",
							lastName: "User",
							role: "owner",
						},
					],
				});
			}
			if (url.endsWith("/v1/phone-numbers")) {
				return Response.json({
					data: [
						{
							id: "PN123",
							name: "Sales",
							number: "+14155550100",
							formattedNumber: "+1 415-555-0100",
							restrictions: {
								calling: { US: "unrestricted" },
								messaging: { US: "restricted" },
							},
						},
					],
				});
			}
			if (url.endsWith("/webhooks") && init?.method !== "POST") {
				return Response.json({
					data: [
						{
							id: "old-webhook",
							label: QUO.webhook.label,
							url: "https://crm.example.com/api/integrations/quo/webhook",
							status: "disabled",
						},
					],
				});
			}
			if (url.endsWith("/old-webhook")) {
				return new Response(null, { status: 204 });
			}
			return Response.json({
				id: "new-webhook",
				key: "whsec_c2lnbmluZy1zZWNyZXQ=",
			});
		}) as typeof fetch;

		const connection = await createQuoConnection(
			{
				apiKey: "test-api-key",
				webhookUrl: "https://crm.example.com/api/integrations/quo/webhook",
			},
			fetcher,
		);

		expect(connection.webhookId).toBe("new-webhook");
		expect(requests.some((request) => request.init?.method === "DELETE")).toBe(
			true,
		);
		const create = requests.find((request) => request.init?.method === "POST");
		const body = JSON.parse(String(create?.init?.body));
		expect(body).toEqual({
			label: QUO.webhook.label,
			url: "https://crm.example.com/api/integrations/quo/webhook",
			status: "enabled",
			resourceIds: ["*"],
			events: QUO.webhook.events,
		});
	});
});
