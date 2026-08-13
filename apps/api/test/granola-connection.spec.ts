import { describe, expect, it } from "bun:test";
import type { WorkspaceRole } from "@crm/auth";
import type { Db } from "@crm/db";
import type { AgentAccessService } from "../src/agent/agent-access.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { GranolaBridgeService } from "../src/granola/granola-bridge.service";
import { GranolaConnectionService } from "../src/granola/granola-connection.service";

function serviceFor(role: WorkspaceRole) {
	let row: Record<string, unknown> | null = null;
	const calls: string[] = [];
	const db = {
		appSetting: {
			findUnique: async () => row,
			upsert: async (input: {
				create: Record<string, unknown>;
				update: Record<string, unknown>;
			}) => {
				row = row ? { ...row, ...input.update } : input.create;
				return row;
			},
		},
		activity: { count: async () => 0 },
		agentTask: { count: async () => 1 },
	} as unknown as Db;
	const access = {
		assertMember: async () => role,
	} as unknown as AgentAccessService;
	const agent = {
		granolaBackfillRequested: async () => {
			calls.push("backfill");
		},
	} as unknown as AgentTriggerService;
	const bridge = {
		connect: async () => {
			calls.push("connect");
			return {
				folderId: "fol_12345678901234",
				webhookEndpointId: "whe_12345678901234",
				webhookSecret: "whsec_c2lnbmluZy1zZWNyZXQ=",
			};
		},
	} as unknown as GranolaBridgeService;

	return {
		service: new GranolaConnectionService(db, access, agent, bridge),
		calls,
		stored: () => row,
	};
}

describe("Granola connection", () => {
	it("registers the webhook, stores the connection, and queues the backfill", async () => {
		const { service, calls, stored } = serviceFor("admin");

		const status = await service.connect(
			{
				apiKey: "grn_test_key",
				scope: "personal",
			},
			"user-1",
		);

		expect(calls).toEqual(["connect", "backfill"]);
		expect(stored()).toMatchObject({
			granolaApiKey: "grn_test_key",
			granolaFolderId: "fol_12345678901234",
			granolaScope: "personal",
			granolaWebhookEndpointId: "whe_12345678901234",
		});
		expect(status.connected).toBe(true);
		expect(status.pending).toBe(1);
	});

	it("refuses a member before it calls Granola", async () => {
		const { service, calls } = serviceFor("member");

		await expect(
			service.connect(
				{
					apiKey: "grn_test_key",
					scope: "personal",
				},
				"user-1",
			),
		).rejects.toThrow("Only an owner or an admin can connect Granola.");
		expect(calls).toEqual([]);
	});

	it("assigns a reviewed call only to a deal at the same company", async () => {
		const updates: unknown[] = [];
		const db = {
			activity: {
				findFirst: async () => ({ companyId: "company-1" }),
				update: async (input: unknown) => updates.push(input),
			},
			deal: {
				findUnique: async () => ({
					companyId: "company-1",
					stage: "QUALIFIED",
				}),
			},
		} as unknown as Db;
		const access = {
			assertMember: async () => "member",
		} as unknown as AgentAccessService;
		const service = new GranolaConnectionService(
			db,
			access,
			{} as AgentTriggerService,
			{} as GranolaBridgeService,
		);

		expect(
			await service.assign(
				{ activityId: "activity-1", dealId: "deal-1" },
				"user-1",
			),
		).toEqual({ assigned: true });
		expect(updates).toEqual([
			{
				where: { id: "activity-1" },
				data: { dealId: "deal-1", granolaMatchStatus: "matched" },
			},
		]);
	});

	it("refuses a reviewed call assignment from another company", async () => {
		const db = {
			activity: {
				findFirst: async () => ({ companyId: "company-1" }),
			},
			deal: {
				findUnique: async () => ({
					companyId: "company-2",
					stage: "QUALIFIED",
				}),
			},
		} as unknown as Db;
		const access = {
			assertMember: async () => "member",
		} as unknown as AgentAccessService;
		const service = new GranolaConnectionService(
			db,
			access,
			{} as AgentTriggerService,
			{} as GranolaBridgeService,
		);

		await expect(
			service.assign({ activityId: "activity-1", dealId: "deal-2" }, "user-1"),
		).rejects.toThrow(
			"The selected deal does not belong to this Granola activity.",
		);
	});
});
