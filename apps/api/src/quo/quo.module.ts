import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { TrpcModule } from "../trpc/trpc.module";
import { QuoController } from "./quo.controller";
import { QuoRouter } from "./quo.router";
import { QuoBridgeService } from "./quo-bridge.service";
import { QuoConnectionService } from "./quo-connection.service";

@Module({
	imports: [TrpcModule, AgentModule],
	controllers: [QuoController],
	providers: [QuoBridgeService, QuoConnectionService, QuoRouter],
})
export class QuoModule {}
