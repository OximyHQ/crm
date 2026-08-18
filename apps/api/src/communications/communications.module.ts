import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { CommunicationsRouter } from "./communications.router";
import { CommunicationsService } from "./communications.service";

@Module({
	imports: [TrpcModule],
	providers: [CommunicationsService, CommunicationsRouter],
	exports: [CommunicationsService],
})
export class CommunicationsModule {}
