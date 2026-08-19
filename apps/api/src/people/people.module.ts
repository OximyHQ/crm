import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { TrpcModule } from "../trpc/trpc.module";
import { PeopleRouter } from "./people.router";
import { PeopleService } from "./people.service";

@Module({
	imports: [TrpcModule, AgentModule],
	providers: [PeopleService, PeopleRouter],
	exports: [PeopleService],
})
export class PeopleModule {}
