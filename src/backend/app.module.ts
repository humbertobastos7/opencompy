import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiErrorFilter } from "@/backend/common/api-error.filter";
import { RequestLoggingInterceptor } from "@/backend/common/request-logging.interceptor";
import { DatabaseModule } from "@/backend/database/database.module";
import { LocalUserGuard } from "@/backend/common/local-user.guard";
import { ChatController } from "@/backend/controllers/chat.controller";
import { HealthController } from "@/backend/controllers/health.controller";
import { AiClientService } from "@/backend/integrations/ai.client";
import { InMemoryRateLimitService } from "@/backend/common/in-memory-rate-limit.service";
import { AdminModule } from "@/backend/modules/admin/admin.module";
import { ChatModule } from "@/backend/modules/chat/chat.module";
import { CaregiverModule } from "@/backend/modules/caregiver/caregiver.module";
import { LocationsModule } from "@/backend/modules/locations/locations.module";
import { LocalUserModule } from "@/backend/modules/local-user/local-user.module";
import { SeniorsModule } from "@/backend/modules/seniors/seniors.module";
import { OnboardingModule } from "@/backend/modules/onboarding/onboarding.module";
import { VoiceGateway } from "@/backend/gateways/voice.gateway";

@Module({
	imports: [
		DatabaseModule,
		AdminModule,
		CaregiverModule,
		LocationsModule,
		LocalUserModule,
		SeniorsModule,
		OnboardingModule,
		ChatModule,
	],
	controllers: [ChatController, HealthController],
	providers: [
		AiClientService,
		InMemoryRateLimitService,
		VoiceGateway,
		{
			provide: APP_FILTER,
			useClass: ApiErrorFilter,
		},
		{
			provide: APP_GUARD,
			useClass: LocalUserGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: RequestLoggingInterceptor,
		},
	],
})
export class AppModule {}
