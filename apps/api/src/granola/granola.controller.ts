import type { IncomingMessage } from "node:http";
import type { Db } from "@crm/db";
import { readGranolaConnection } from "@crm/db/settings";
import {
	BadRequestException,
	Controller,
	ForbiddenException,
	Headers,
	HttpCode,
	Post,
	Req,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import { parseJson, readBody } from "../integrations/request-body";
import { granolaWebhookEvent } from "./granola.contracts";
import { GRANOLA } from "./granola-config";
import { verifyGranolaWebhook } from "./granola-webhook";

@Controller("api/integrations/granola")
export class GranolaController {
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
			readGranolaConnection(this.db),
			readBody(request, GRANOLA.webhook.maxBodyBytes),
		]);
		if (!connection) {
			throw new ServiceUnavailableException("Granola is not connected.");
		}

		if (
			!rawBody ||
			!webhookId ||
			!webhookTimestamp ||
			!webhookSignature ||
			!verifyGranolaWebhook({
				rawBody,
				secret: connection.webhookSecret,
				webhookId,
				webhookTimestamp,
				webhookSignature,
			})
		) {
			throw new ForbiddenException("The Granola webhook signature is invalid.");
		}

		const event = granolaWebhookEvent.safeParse(parseJson(rawBody));
		if (!event.success || event.data.event_id !== webhookId) {
			throw new BadRequestException("The Granola webhook payload is invalid.");
		}

		await this.agent.granolaNoteRequested({
			noteId: event.data.note_id,
			eventId: event.data.event_id,
			eventType: event.data.event_type,
		});

		return { accepted: true };
	}
}
