import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { quoConnectInput } from "./quo.contracts";
import { QuoConnectionService } from "./quo-connection.service";

@Router({ alias: "quo" })
@UseMiddlewares(AuthMiddleware)
export class QuoRouter {
	constructor(
		@Inject(QuoConnectionService)
		private readonly connection: QuoConnectionService,
	) {}

	@Query()
	status(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.status(ctx.user.id);
	}

	@Mutation({ input: quoConnectInput })
	connect(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof quoConnectInput>,
	) {
		return this.connection.connect(input, ctx.user.id);
	}

	@Mutation()
	disconnect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.disconnect(ctx.user.id);
	}
}
