import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { CompaniesModule } from "../companies/companies.module";
import { ContactsModule } from "../contacts/contacts.module";
import { DealsModule } from "../deals/deals.module";
import { FieldsModule } from "../fields/fields.module";
import { SearchModule } from "../search/search.module";
import { UsersModule } from "../users/users.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
	imports: [
		AgentModule,
		CompaniesModule,
		ContactsModule,
		DealsModule,
		FieldsModule,
		SearchModule,
		UsersModule,
	],
	controllers: [McpController],
	providers: [McpService],
})
export class McpModule {}
