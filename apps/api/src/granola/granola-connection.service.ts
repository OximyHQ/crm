import { canManageConnections } from "@crm/auth";
import { type Db, DealStage } from "@crm/db";
import {
	clearGranolaConnection,
	maskKey,
	readGranolaConnection,
	writeGranolaConnection,
} from "@crm/db/settings";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentAccessService } from "../agent/agent-access.service";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import type { GranolaConnectInput } from "./granola.contracts";
import { GranolaBridgeService } from "./granola-bridge.service";

@Injectable()
export class GranolaConnectionService {
	private readonly logger = new Logger(GranolaConnectionService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AgentAccessService,
		private readonly agent: AgentTriggerService,
		private readonly bridge: GranolaBridgeService,
	) {}

	async status(userId: string) {
		const role = await this.access.assertMember(userId);
		const [connection, row, imported, needsReview, pending] = await Promise.all(
			[
				readGranolaConnection(this.db),
				this.db.appSetting.findUnique({
					where: { id: "app" },
					select: { granolaLastSyncedAt: true, granolaLastError: true },
				}),
				this.db.activity.count({ where: { granolaNoteId: { not: null } } }),
				this.db.activity.count({
					where: { granolaMatchStatus: "needs_review" },
				}),
				this.db.agentTask.count({
					where: {
						kind: { in: ["granola-backfill", "granola-note"] },
						finishedAt: null,
					},
				}),
			],
		);

		return {
			connected: connection !== null,
			canManage: canManageConnections(role),
			keyHint: connection ? maskKey(connection.apiKey) : null,
			folderId: connection?.folderId ?? null,
			scope: connection?.scope ?? null,
			connectedAt: connection?.connectedAt.toISOString() ?? null,
			lastSyncedAt: row?.granolaLastSyncedAt?.toISOString() ?? null,
			lastError: row?.granolaLastError ?? null,
			imported,
			needsReview,
			pending,
		};
	}

	async connect(input: GranolaConnectInput, userId: string) {
		const role = await this.access.assertMember(userId);
		if (!canManageConnections(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can connect Granola.",
			);
		}
		if (await readGranolaConnection(this.db)) {
			throw new ConflictException("Granola is already connected.");
		}

		const apiBase = process.env.API_URL?.trim() || "http://localhost:3001";
		const webhookUrl = new URL(
			"/api/integrations/granola/webhook",
			apiBase,
		).toString();
		const registered = await this.bridge.connect(input, webhookUrl);

		try {
			await writeGranolaConnection(this.db, {
				apiKey: input.apiKey,
				scope: input.scope,
				...registered,
			});
		} catch (error) {
			await this.bridge
				.disconnect({
					apiKey: input.apiKey,
					webhookEndpointId: registered.webhookEndpointId,
				})
				.catch((cleanupError: unknown) => {
					this.logger.error(
						{ message: "Could not remove the unused Granola webhook" },
						cleanupError instanceof Error
							? cleanupError.stack
							: String(cleanupError),
					);
				});
			throw error;
		}

		try {
			await this.agent.granolaBackfillRequested();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.db.appSetting.updateMany({
				where: { id: "app" },
				data: {
					granolaLastError:
						`The initial import did not queue: ${message}`.slice(0, 500),
				},
			});
		}

		return this.status(userId);
	}

	async backfill(userId: string) {
		await this.access.assertMember(userId);
		if (!(await readGranolaConnection(this.db))) {
			throw new NotFoundException("Granola is not connected.");
		}
		await this.agent.granolaBackfillRequested();
		return { requested: true };
	}

	async review(userId: string) {
		await this.access.assertMember(userId);
		const activities = await this.db.activity.findMany({
			where: { granolaMatchStatus: "needs_review" },
			orderBy: { occurredAt: "desc" },
			take: 50,
			select: {
				id: true,
				subject: true,
				occurredAt: true,
				granolaUrl: true,
				contact: {
					select: { id: true, firstName: true, lastName: true },
				},
				company: {
					select: {
						id: true,
						name: true,
						deals: {
							where: {
								stage: {
									notIn: [DealStage.CLOSED_WON, DealStage.CLOSED_LOST],
								},
							},
							orderBy: { updatedAt: "desc" },
							select: { id: true, name: true },
						},
					},
				},
			},
		});

		return activities.map((activity) => ({
			...activity,
			occurredAt: activity.occurredAt?.toISOString() ?? null,
		}));
	}

	async assign(input: { activityId: string; dealId: string }, userId: string) {
		await this.access.assertMember(userId);
		const [activity, deal] = await Promise.all([
			this.db.activity.findFirst({
				where: {
					id: input.activityId,
					granolaMatchStatus: "needs_review",
				},
				select: { companyId: true },
			}),
			this.db.deal.findUnique({
				where: { id: input.dealId },
				select: { companyId: true, stage: true },
			}),
		]);
		if (!activity || !deal || activity.companyId !== deal.companyId) {
			throw new BadRequestException(
				"The selected deal does not belong to this Granola activity.",
			);
		}
		if (
			deal.stage === DealStage.CLOSED_WON ||
			deal.stage === DealStage.CLOSED_LOST
		) {
			throw new BadRequestException("The selected deal is closed.");
		}

		await this.db.activity.update({
			where: { id: input.activityId },
			data: { dealId: input.dealId, granolaMatchStatus: "matched" },
		});
		return { assigned: true };
	}

	async disconnect(userId: string) {
		const role = await this.access.assertMember(userId);
		if (!canManageConnections(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can disconnect Granola.",
			);
		}
		const connection = await readGranolaConnection(this.db);
		if (!connection) throw new NotFoundException("Granola is not connected.");

		await this.bridge.disconnect(connection);
		await clearGranolaConnection(this.db);

		return { disconnected: true };
	}
}
