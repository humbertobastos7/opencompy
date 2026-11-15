import { Module } from "@nestjs/common";
import { LocationsModule } from "@/backend/modules/locations/locations.module";
import { SeniorsModule } from "@/backend/modules/seniors/seniors.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingRepository } from "./onboarding.repository";
import { OnboardingService } from "./onboarding.service";

@Module({
	imports: [LocationsModule, SeniorsModule],
	controllers: [OnboardingController],
	providers: [OnboardingRepository, OnboardingService],
})
export class OnboardingModule {}
