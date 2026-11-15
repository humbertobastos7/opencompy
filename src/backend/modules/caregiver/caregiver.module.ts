import { Module } from "@nestjs/common";
import { AiClientService } from "@/backend/integrations/ai.client";
import { SeniorsModule } from "@/backend/modules/seniors/seniors.module";
import { CaregiverController } from "./caregiver.controller";
import { CaregiverRepository } from "./caregiver.repository";
import { CaregiverService } from "./caregiver.service";

@Module({
	imports: [SeniorsModule],
	controllers: [CaregiverController],
	providers: [CaregiverRepository, CaregiverService, AiClientService],
})
export class CaregiverModule {}
