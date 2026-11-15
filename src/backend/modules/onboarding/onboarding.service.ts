import {
	BadRequestException,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { generateAccessCode } from "@/backend/common/utils";
import type {
	ApproveLocationRequest,
	AssignSeniorRequest,
	LocalSession,
	OnboardSeniorRequest,
} from "@/shared/contracts";
import { LocationsService } from "@/backend/modules/locations/locations.service";
import { SeniorsService } from "@/backend/modules/seniors/seniors.service";
import { OnboardingRepository } from "./onboarding.repository";

@Injectable()
export class OnboardingService {
	constructor(
		@Inject(OnboardingRepository)
		private readonly onboardingRepository: OnboardingRepository,
		@Inject(LocationsService)
		private readonly locationsService: LocationsService,
		@Inject(SeniorsService)
		private readonly seniorsService: SeniorsService,
	) {}

	async onboardSenior(
		localSession: LocalSession,
		payload: OnboardSeniorRequest,
	) {
		const initialContext = payload.initialContext?.trim();

		if (payload.email) {
			const existingUser = await this.onboardingRepository.findUserByEmail(
				payload.email,
			);
			if (existingUser && existingUser.id !== localSession.user.id) {
				throw new BadRequestException("EMAIL_ALREADY_REGISTERED");
			}
		}

		if (localSession.user.role === "senior") {
			if (payload.email) {
				await this.onboardingRepository.updateUserEmail(
					localSession.user.id,
					payload.email,
				);
			}

			const existingSenior = await this.seniorsService.getSeniorByUserId(
				localSession.user.id,
			);

			if (existingSenior) {
				await this.onboardingRepository.updateSeniorProfile(
					existingSenior.userId,
					{
						fullName: payload.fullName,
						nickname: payload.nickname ?? "",
						birthdate: payload.birthDate
							? payload.birthDate.toISOString().slice(0, 10)
							: null,
					},
				);
				if (initialContext) {
					await this.seniorsService.updateSeniorProfile(
						localSession,
						existingSenior.userId,
						{ initialContext },
					);
				}

				return {
					seniorId: existingSenior.userId,
					accessCode: localSession.user.accessCode,
				};
			}

			await this.onboardingRepository.createSeniorProfile({
				userId: localSession.user.id,
				fullName: payload.fullName,
				nickname: payload.nickname ?? "",
				birthdate: payload.birthDate
					? payload.birthDate.toISOString().slice(0, 10)
					: null,
			});
			if (initialContext) {
				await this.seniorsService.updateSeniorProfile(
					localSession,
					localSession.user.id,
					{ initialContext },
				);
			}

			return {
				seniorId: localSession.user.id,
				accessCode: localSession.user.accessCode,
			};
		}

		const ownerLocation = await this.locationsService.findFirstOwnedLocation(
			localSession.user.id,
		);
		if (!ownerLocation?.location_id) {
			throw new UnauthorizedException("YOU_DO_NOT_HAVE_ACCESS_TO_ANY_LOCATIONS");
		}

		const accessCode = generateAccessCode();
		const user = await this.onboardingRepository.createSeniorAccount({
			locationId: ownerLocation.location_id,
			email: payload.email ?? `${accessCode}@placeholder.compy.ai`,
			username: accessCode,
			passwordHash: "$NO_PIN$",
			fullName: payload.fullName,
			nickname: payload.nickname ?? "",
			birthdate: payload.birthDate
				? payload.birthDate.toISOString().slice(0, 10)
				: null,
		});
		if (initialContext) {
			await this.seniorsService.updateSeniorProfile(localSession, user.id, {
				initialContext,
			});
		}

		return {
			seniorId: user.id,
			accessCode,
		};
	}

	async assignSenior(
		localSession: LocalSession,
		payload: AssignSeniorRequest,
	) {
		if (localSession.user.role === "senior") {
			throw new UnauthorizedException(
				"ONLY_CAREGIVERS_OR_ADMINS_CAN_ASSIGN_SENIORS",
			);
		}

		const ownerLocation = await this.locationsService.findFirstOwnedLocation(
			localSession.user.id,
		);
		if (!ownerLocation?.location_id) {
			throw new UnauthorizedException("YOU_DO_NOT_HAVE_ACCESS_TO_ANY_LOCATIONS");
		}

		const user = await this.onboardingRepository.findSeniorByAccessCode(
			payload.accessCode,
		);
		if (!user) {
			throw new BadRequestException("INVALID_ACCESS_CODE");
		}

		await this.onboardingRepository.assignSeniorToLocation(
			user.id,
			ownerLocation.location_id,
		);

		return { success: true };
	}

	async approveLocation(
		localSession: LocalSession,
		payload: ApproveLocationRequest,
	) {
		if (localSession.user.role !== "senior") {
			throw new UnauthorizedException(
				"ONLY_SENIORS_CAN_APPROVE_ASSOCIATIONS",
			);
		}

		if (!payload.approved) {
			await this.onboardingRepository.clearSeniorLocation(localSession.user.id);
		}

		return { success: true };
	}

	async getOnboardingStatus(localSession: LocalSession) {
		if (localSession.user.role !== "senior") {
			throw new UnauthorizedException(
				"ONLY_SENIORS_CAN_CHECK_ONBOARDING_STATUS",
			);
		}

		const user = await this.onboardingRepository.findUserOrganization(
			localSession.user.id,
		);
		if (!user?.organizationId) {
			return {
				locationApproved: false,
				locationId: null,
				caregiverName: "",
			};
		}

		const owner = await this.onboardingRepository.findLocationCaregiverName(
			user.organizationId,
		);

		return {
			locationApproved: true,
			locationId: user.organizationId,
			caregiverName: owner?.name ?? "",
		};
	}
}
