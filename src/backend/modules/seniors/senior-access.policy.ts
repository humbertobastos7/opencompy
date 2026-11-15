import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { LocalSession } from "@/shared/contracts";
import { LocationsService } from "@/backend/modules/locations/locations.service";
import { SeniorsRepository } from "./seniors.repository";

@Injectable()
export class SeniorAccessPolicy {
	constructor(
		@Inject(SeniorsRepository)
		private readonly seniorsRepository: SeniorsRepository,
		@Inject(LocationsService)
		private readonly locationsService: LocationsService,
	) {}

	async assertSeniorAccess(localSession: LocalSession, seniorUserId: string) {
		const senior = await this.seniorsRepository.findSeniorProfile(seniorUserId);
		if (!senior) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		if (senior.userId === localSession.user.id) {
			return senior;
		}

		const user = await this.seniorsRepository.findUserOrganization(senior.userId);
		if (!user?.organizationId) {
			throw new ForbiddenException("YOU_DO_NOT_HAVE_ACCESS_TO_THIS_LOCATION");
		}

		const hasAccess = await this.locationsService.hasAccessToLocation(
			localSession.user.id,
			user.organizationId,
		);
		if (!hasAccess) {
			throw new ForbiddenException("YOU_DO_NOT_HAVE_ACCESS_TO_THIS_LOCATION");
		}

		return senior;
	}
}
