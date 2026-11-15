import { Module } from "@nestjs/common";
import { ChatService } from "./chat/chat.service";

@Module({
	providers: [ChatService],
	exports: [ChatService],
})
export class AiModule {}
