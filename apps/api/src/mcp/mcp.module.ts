import { Module } from "@nestjs/common";
import { ActivitiesModule } from "../activities/activities.module";
import { AgentModule } from "../agent/agent.module";
import { CommunicationsModule } from "../communications/communications.module";
import { CompaniesModule } from "../companies/companies.module";
import { ContactsModule } from "../contacts/contacts.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { DashboardModule } from "../dashboard/dashboard.module";
import { DealsModule } from "../deals/deals.module";
import { FieldsModule } from "../fields/fields.module";
import { SearchModule } from "../search/search.module";
import { UsersModule } from "../users/users.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import { McpAgentBridgeService } from "./mcp-agent-bridge.service";

@Module({
	imports: [
		ActivitiesModule,
		AgentModule,
		CompaniesModule,
		CommunicationsModule,
		ContactsModule,
		DealsModule,
		DashboardModule,
		FieldsModule,
		ConversationsModule,
		SearchModule,
		UsersModule,
	],
	controllers: [McpController],
	providers: [McpAgentBridgeService, McpService],
})
export class McpModule {}
