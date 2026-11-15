import { Module } from "@nestjs/common";
import { LocationsModule } from "@/backend/modules/locations/locations.module";
import { ChatModule } from "@/backend/modules/chat/chat.module";
import { ConversationContextService } from "@/backend/conversation-context.service";
import { SeniorsController } from "./seniors.controller";
import { SeniorAccessPolicy } from "./senior-access.policy";
import { SeniorsRepository } from "./seniors.repository";
import { SeniorsService } from "./seniors.service";

@Module({
	imports: [LocationsModule, ChatModule],
	controllers: [SeniorsController],
	providers: [
		SeniorsRepository,
		SeniorAccessPolicy,
		SeniorsService,
		ConversationContextService,
	],
	exports: [SeniorsService, SeniorAccessPolicy, ConversationContextService],
})
export class SeniorsModule {}
