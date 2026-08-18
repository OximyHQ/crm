import { describe, expect, it } from "bun:test";
import {
	createQuoConnection,
	getQuoUser,
	listQuoContacts,
} from "../agent/lib/quo-client";
import { QUO } from "../agent/lib/quo-config";

describe("Quo client", () => {
	it("loads a newly added workspace user by id", async () => {
		const requests: string[] = [];
		const fetcher = (async (input: string | URL | Request) => {
			requests.push(String(input));
			return Response.json({
				data: {
					id: "US789",
					email: "new-rep@example.com",
					firstName: "New",
					lastName: "Rep",
					role: "member",
				},
			});
		}) as typeof fetch;

		expect(await getQuoUser("test-api-key", "US789", fetcher)).toMatchObject({
			id: "US789",
			email: "new-rep@example.com",
		});
		expect(requests).toEqual(["https://api.quo.com/v1/users/US789"]);
	});

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
			if (url.includes("/v1/users?")) {
				const pageToken = new URL(url).searchParams.get("pageToken");
				return Response.json({
					data: [
						pageToken
							? {
									id: "US456",
									email: "rep@example.com",
									firstName: "Sales",
									lastName: "Rep",
									role: "member",
								}
							: {
									id: "US123",
									email: "owner@example.com",
									firstName: "Owner",
									lastName: "User",
									role: "owner",
								},
					],
					nextPageToken: pageToken ? null : "users-page-two",
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
						{
							id: "PN456",
							name: "Support",
							number: "+14155550101",
							formattedNumber: "+1 415-555-0101",
							restrictions: {
								calling: { US: "unrestricted" },
								messaging: { US: "unrestricted" },
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
				data: {
					id: "new-webhook",
					key: "whsec_c2lnbmluZy1zZWNyZXQ=",
				},
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
		expect(connection.users.map((user) => user.id)).toEqual(["US123", "US456"]);
		expect(connection.phoneNumbers.map((number) => number.id)).toEqual([
			"PN123",
			"PN456",
		]);
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
