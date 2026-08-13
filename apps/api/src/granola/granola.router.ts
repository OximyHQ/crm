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
import {
	granolaConnectInput,
	granolaReviewAssignment,
} from "./granola.contracts";
import { GranolaConnectionService } from "./granola-connection.service";

@Router({ alias: "granola" })
@UseMiddlewares(AuthMiddleware)
export class GranolaRouter {
	constructor(
		@Inject(GranolaConnectionService)
		private readonly connection: GranolaConnectionService,
	) {}

	@Query()
	status(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.status(ctx.user.id);
	}

	@Mutation({ input: granolaConnectInput })
	connect(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof granolaConnectInput>,
	) {
		return this.connection.connect(input, ctx.user.id);
	}

	@Mutation()
	backfill(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.backfill(ctx.user.id);
	}

	@Query()
	review(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.review(ctx.user.id);
	}

	@Mutation({ input: granolaReviewAssignment })
	assign(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof granolaReviewAssignment>,
	) {
		return this.connection.assign(input, ctx.user.id);
	}

	@Mutation()
	disconnect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.disconnect(ctx.user.id);
	}
}
