import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { TrpcModule } from "../trpc/trpc.module";
import { GranolaController } from "./granola.controller";
import { GranolaRouter } from "./granola.router";
import { GranolaBridgeService } from "./granola-bridge.service";
import { GranolaConnectionService } from "./granola-connection.service";

@Module({
	imports: [TrpcModule, AgentModule],
	controllers: [GranolaController],
	providers: [GranolaBridgeService, GranolaConnectionService, GranolaRouter],
})
export class GranolaModule {}
