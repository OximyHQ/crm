import type { IncomingMessage } from "node:http";
import type { Db } from "@crm/db";
import { readQuoConnection } from "@crm/db/settings";
import { schemas } from "@crm/validation";
import {
	BadRequestException,
	Controller,
	ForbiddenException,
	Headers,
	HttpCode,
	Logger,
	Post,
	Req,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import { parseJson, readBody } from "../integrations/request-body";
import { verifyStandardWebhook } from "../integrations/standard-webhook";
import { QUO } from "./quo-config";

@Controller("api/integrations/quo")
export class QuoController {
	private readonly logger = new Logger(QuoController.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
	) {}

	@Post("webhook")
	@AllowAnonymous()
	@HttpCode(202)
	async webhook(
		@Req() request: IncomingMessage,
		@Headers("webhook-id") webhookId?: string,
		@Headers("webhook-timestamp") webhookTimestamp?: string,
		@Headers("webhook-signature") webhookSignature?: string,
	): Promise<{ accepted: true }> {
		const [connection, rawBody] = await Promise.all([
			readQuoConnection(this.db),
			readBody(request, QUO.webhook.maxBodyBytes),
		]);
		if (!connection) {
			throw new ServiceUnavailableException("Quo is not connected.");
		}

		if (
			!rawBody ||
			!webhookId ||
			!webhookTimestamp ||
			!webhookSignature ||
			!verifyStandardWebhook({
				rawBody,
				secret: connection.webhookSecret,
				webhookId,
				webhookTimestamp,
				webhookSignature,
				maxAgeMs: QUO.webhook.maxAgeMs,
			})
		) {
			throw new ForbiddenException("The Quo webhook signature is invalid.");
		}

		const event = schemas.quo.webhookEvent.safeParse(parseJson(rawBody));
		if (!event.success) {
			this.logger.warn({
				webhookId,
				issues: event.error.issues.map((issue) => ({
					code: issue.code,
					path: issue.path.join("."),
				})),
			});
			throw new BadRequestException("The Quo webhook payload is invalid.");
		}
		await this.agent.quoEventRequested(event.data);
		return { accepted: true };
	}
}
