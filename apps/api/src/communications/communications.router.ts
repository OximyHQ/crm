import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	communicationContactOptionsInput,
	communicationIdInput,
	communicationListInput,
	communicationResolveInput,
} from "./communications.contracts";
import { CommunicationsService } from "./communications.service";

@Router({ alias: "communications" })
@UseMiddlewares(AuthMiddleware)
export class CommunicationsRouter {
	constructor(
		@Inject(CommunicationsService)
		private readonly communications: CommunicationsService,
	) {}

	@Query({ input: communicationListInput })
	list(@Input() input: z.infer<typeof communicationListInput>) {
		return this.communications.list(input);
	}

	@Query({ input: communicationIdInput })
	byId(@Input("id") id: string) {
		return this.communications.byId(id);
	}

	@Query({ input: communicationContactOptionsInput })
	contactOptions(@Input("q") q: string) {
		return this.communications.contactOptions(q);
	}

	@Mutation({ input: communicationResolveInput })
	resolve(@Input() input: z.infer<typeof communicationResolveInput>) {
		return this.communications.resolve(input);
	}
}
