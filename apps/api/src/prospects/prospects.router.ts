import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	prospectCompanyInput,
	prospectIdInput,
	prospectListInput,
} from "./prospects.contracts";
import { ProspectsService } from "./prospects.service";

@Router({ alias: "prospects" })
@UseMiddlewares(AuthMiddleware)
export class ProspectsRouter {
	constructor(
		@Inject(ProspectsService) private readonly prospects: ProspectsService,
	) {}

	@Query({ input: prospectListInput })
	async list(@Input("companyId") companyId: string) {
		return this.prospects.list(companyId);
	}

	@Mutation({ input: prospectIdInput })
	async addAsContact(@Input("id") id: string) {
		return this.prospects.addAsContact(id);
	}

	@Mutation({ input: prospectIdInput })
	async dismiss(@Input("id") id: string) {
		return this.prospects.dismiss(id);
	}

	@Mutation({ input: prospectIdInput })
	async restore(@Input("id") id: string) {
		return this.prospects.restore(id);
	}

	@Mutation({ input: prospectCompanyInput })
	async refresh(@Input("companyId") companyId: string) {
		return this.prospects.refresh(companyId);
	}
}
