import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	personCompanyInput,
	personIdInput,
	personListInput,
} from "./people.contracts";
import { PeopleService } from "./people.service";

@Router({ alias: "people" })
@UseMiddlewares(AuthMiddleware)
export class PeopleRouter {
	constructor(@Inject(PeopleService) private readonly people: PeopleService) {}

	@Query({ input: personListInput })
	async list(@Input("companyId") companyId: string) {
		return this.people.list(companyId);
	}

	@Query({ input: personIdInput })
	async byId(@Input("id") id: string) {
		return this.people.byId(id);
	}

	@Query({ input: personCompanyInput })
	async status(@Input("companyId") companyId: string) {
		return this.people.status(companyId);
	}

	@Mutation({ input: personIdInput })
	async addAsContact(@Input("id") id: string) {
		return this.people.addAsContact(id);
	}

	@Mutation({ input: personIdInput })
	async dismiss(@Input("id") id: string) {
		return this.people.dismiss(id);
	}

	@Mutation({ input: personIdInput })
	async restore(@Input("id") id: string) {
		return this.people.restore(id);
	}

	@Mutation({ input: personCompanyInput })
	async refresh(@Input("companyId") companyId: string) {
		return this.people.refresh(companyId);
	}
}
