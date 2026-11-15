import { Module } from "@nestjs/common";
import { AiModule } from "./ai.module";
import { ChatController } from "./controllers/chat.controller";

@Module({
	imports: [AiModule],
	controllers: [ChatController],
})
export class AiAppModule {}
