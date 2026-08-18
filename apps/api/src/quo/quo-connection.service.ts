import { canManageConnections } from "@crm/auth";
import type { Db } from "@crm/db";
import {
	clearQuoConnection,
	maskKey,
	readQuoConnection,
	writeQuoConnection,
} from "@crm/db/settings";
import { schemas } from "@crm/validation";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentAccessService } from "../agent/agent-access.service";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import type { QuoConnectInput } from "./quo.contracts";
import { QuoBridgeService } from "./quo-bridge.service";

@Injectable()
export class QuoConnectionService {
	private readonly logger = new Logger(QuoConnectionService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AgentAccessService,
		private readonly agent: AgentTriggerService,
		private readonly bridge: QuoBridgeService,
	) {}

	async status(userId: string) {
		const role = await this.access.assertMember(userId);
		const [connection, row, imported, needsReview, pending] = await Promise.all(
			[
				readQuoConnection(this.db),
				this.db.appSetting.findUnique({
					where: { id: "app" },
					select: { quoLastSyncedAt: true, quoLastError: true },
				}),
				this.db.communication.count(),
				this.db.communication.count({
					where: { matchStatus: "NEEDS_REVIEW" },
				}),
				this.db.agentTask.count({
					where: {
						kind: { in: ["quo-event", "quo-sync", "quo-contact-sync"] },
						finishedAt: null,
					},
				}),
			],
		);
		const phoneNumbers = connection
			? schemas.quo.phoneNumberSnapshot.array().parse(connection.phoneNumbers)
			: [];
		const users = connection
			? schemas.quo.userSnapshot.array().parse(connection.users)
			: [];

		return {
			connected: connection !== null,
			canManage: canManageConnections(role),
			keyHint: connection ? maskKey(connection.apiKey) : null,
			webhookId: connection?.webhookId ?? null,
			connectedAt: connection?.connectedAt.toISOString() ?? null,
			lastSyncedAt: row?.quoLastSyncedAt?.toISOString() ?? null,
			lastError: row?.quoLastError ?? null,
			phoneNumbers,
			userCount: users.length,
			imported,
			needsReview,
			pending,
		};
	}

	async connect(input: QuoConnectInput, userId: string) {
		const role = await this.access.assertMember(userId);
		if (!canManageConnections(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can connect Quo.",
			);
		}
		if (await readQuoConnection(this.db)) {
			throw new ConflictException("Quo is already connected.");
		}

		const apiBase = process.env.API_URL?.trim() || "http://localhost:3001";
		const webhookUrl = new URL(
			"/api/integrations/quo/webhook",
			apiBase,
		).toString();
		const registered = await this.bridge.connect(input, webhookUrl);

		try {
			await writeQuoConnection(this.db, {
				apiKey: input.apiKey,
				...registered,
			});
		} catch (error) {
			await this.bridge
				.disconnect({ apiKey: input.apiKey, webhookId: registered.webhookId })
				.catch((cleanupError: unknown) => {
					this.logger.error(
						{ message: "Could not remove the unused Quo webhook" },
						cleanupError instanceof Error
							? cleanupError.stack
							: String(cleanupError),
					);
				});
			throw error;
		}
		await this.agent.quoSyncRequested();

		return this.status(userId);
	}

	async disconnect(userId: string) {
		const role = await this.access.assertMember(userId);
		if (!canManageConnections(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can disconnect Quo.",
			);
		}
		const connection = await readQuoConnection(this.db);
		if (!connection) throw new NotFoundException("Quo is not connected.");

		await this.bridge.disconnect(connection);
		await clearQuoConnection(this.db);
		return { disconnected: true };
	}
}
