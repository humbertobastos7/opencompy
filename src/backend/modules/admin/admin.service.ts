import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import type {
	AdminDashboardResponse,
	LocalSession,
	CaregiverAdminResponse,
	CreateCaregiverRequest,
	CreateInstitutionRequest,
	CreatePlanRequest,
	CreateSeniorRequest,
	InstitutionResponse,
	InstitutionDetailResponse,
	PlanResponse,
	ReassignInstitutionRequest,
	RegenerateSeniorAccessCodeResponse,
	SeniorAdminResponse,
	UpdateCaregiverRequest,
	UpdateInstitutionRequest,
	UpdatePlanRequest,
	UpdateSeniorRequest,
} from "@/shared/contracts";
import { generateAccessCode } from "@/backend/common/utils";
import { AdminRepository } from "./admin.repository";

@Injectable()
export class AdminService {
	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
	) {}

	private assertAdmin(session: LocalSession) {
		if (session.user.role !== "admin") {
			throw new ForbiddenException("ADMIN_ONLY_ENDPOINT");
		}
	}

	private mapInstitution(record: {
		id: string;
		type: "ipss" | "family";
		designation: string | null;
		location: string | null;
		planId?: string | null;
		planName?: string | null;
		createdAt: Date;
	}): InstitutionResponse {
		return {
			id: record.id,
			type: record.type,
			designation: record.designation ?? "",
			location: record.location,
			planId: record.planId ?? null,
			planName: record.planName ?? null,
			createdAt: record.createdAt.toISOString(),
		};
	}

	private mapPlan(record: {
		id: string;
		name: string;
		maxSeniors: number | null;
		maxTalkingMinutesPerMonth: number | null;
		createdAt: Date;
	}): PlanResponse {
		return {
			id: record.id,
			name: record.name,
			maxSeniors: record.maxSeniors,
			maxTalkingMinutesPerMonth: record.maxTalkingMinutesPerMonth,
			createdAt: record.createdAt.toISOString(),
		};
	}

	private mapCaregiver(record: {
		id: string;
		email: string;
		fullName: string | null;
		organizationId: string | null;
		organizationName: string | null;
		isActive: boolean;
		createdAt: Date;
	}): CaregiverAdminResponse {
		return {
			id: record.id,
			email: record.email,
			fullName: record.fullName ?? "",
			organizationId: record.organizationId,
			organizationName: record.organizationName,
			isActive: record.isActive,
			createdAt: record.createdAt.toISOString(),
		};
	}

	private mapSenior(record: {
		id: string;
		email: string;
		fullName: string | null;
		nickname: string | null;
		birthDate: string | null;
		gender: string | null;
		accessCode: string;
		organizationId: string | null;
		organizationName: string | null;
		isActive: boolean;
		createdAt: Date;
	}): SeniorAdminResponse {
		return {
			id: record.id,
			email: record.email,
			fullName: record.fullName ?? "",
			nickname: record.nickname,
			birthDate: record.birthDate,
			gender: (record.gender as "m" | "f" | null) ?? null,
			accessCode: record.accessCode,
			organizationId: record.organizationId,
			organizationName: record.organizationName,
			isActive: record.isActive,
			createdAt: record.createdAt.toISOString(),
		};
	}

	private async assertInstitutionExists(institutionId: string) {
		const institution = await this.adminRepository.findInstitutionById(
			institutionId,
		);
		if (!institution) {
			throw new NotFoundException("INSTITUTION_NOT_FOUND");
		}
		return institution;
	}

	async getInstitutions(session: LocalSession) {
		this.assertAdmin(session);
		return (await this.adminRepository.listInstitutions()).map((record) =>
			this.mapInstitution(record),
		);
	}

	async getInstitution(
		session: LocalSession,
		institutionId: string,
	): Promise<InstitutionDetailResponse> {
		this.assertAdmin(session);
		const institution = await this.adminRepository.findInstitution(institutionId);
		if (!institution) {
			throw new NotFoundException("INSTITUTION_NOT_FOUND");
		}

		const [caregivers, seniors] = await Promise.all([
			this.adminRepository.listCaregiversByInstitution(institutionId),
			this.adminRepository.listSeniorsByInstitution(institutionId),
		]);

		return {
			institution: this.mapInstitution(institution),
			caregivers: caregivers.map((record) => this.mapCaregiver(record)),
			seniors: seniors.map((record) => this.mapSenior(record)),
		};
	}

	async createInstitution(
		session: LocalSession,
		payload: CreateInstitutionRequest,
	) {
		this.assertAdmin(session);
		if (payload.planId) {
			const plan = await this.adminRepository.findPlanById(payload.planId);
			if (!plan) throw new NotFoundException("PLAN_NOT_FOUND");
		}
		const institution = await this.adminRepository.createInstitution(payload);
		return this.mapInstitution(institution!);
	}

	async getDashboard(session: LocalSession): Promise<AdminDashboardResponse> {
		this.assertAdmin(session);
		const [
			totalInstitutions,
			totalCaregivers,
			totalSeniors,
			totalActiveUsers,
			totalConversations,
			seniorsWithoutInstitution,
			caregiversWithoutInstitution,
		] = await Promise.all([
			this.adminRepository.countInstitutions(),
			this.adminRepository.countUsersByRole("caregiver"),
			this.adminRepository.countUsersByRole("senior"),
			this.adminRepository.countActiveUsers(),
			this.adminRepository.countConversations(),
			this.adminRepository.countUsersWithoutInstitution("senior"),
			this.adminRepository.countUsersWithoutInstitution("caregiver"),
		]);

		return {
			totalInstitutions,
			totalCaregivers,
			totalSeniors,
			totalActiveUsers,
			totalConversations,
			seniorsWithoutInstitution,
			caregiversWithoutInstitution,
		};
	}

	async updateInstitution(
		session: LocalSession,
		institutionId: string,
		payload: UpdateInstitutionRequest,
	) {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findInstitution(institutionId);
		if (!existing) {
			throw new NotFoundException("INSTITUTION_NOT_FOUND");
		}

		if (payload.planId) {
			const plan = await this.adminRepository.findPlanById(payload.planId);
			if (!plan) throw new NotFoundException("PLAN_NOT_FOUND");
		}

		const updated = await this.adminRepository.updateInstitution(institutionId, {
			...(payload.designation !== undefined
				? { designation: payload.designation }
				: {}),
			...(payload.location !== undefined ? { location: payload.location } : {}),
			...(payload.planId !== undefined ? { planId: payload.planId } : {}),
		});
		if (!updated) {
			throw new NotFoundException("INSTITUTION_NOT_FOUND");
		}

		return this.mapInstitution(updated);
	}

	async deleteInstitution(session: LocalSession, institutionId: string) {
		this.assertAdmin(session);
		const institution = await this.adminRepository.findInstitution(institutionId);
		if (!institution) {
			throw new NotFoundException("INSTITUTION_NOT_FOUND");
		}

		await this.adminRepository.hardDeleteInstitutionWithMembers(institutionId);
		return { success: true };
	}

	async getCaregivers(session: LocalSession) {
		this.assertAdmin(session);
		return (await this.adminRepository.listCaregivers()).map((record) =>
			this.mapCaregiver(record),
		);
	}

	async getCaregiver(session: LocalSession, caregiverId: string) {
		this.assertAdmin(session);
		const caregiver = await this.adminRepository.findCaregiverById(caregiverId);
		if (!caregiver) {
			throw new NotFoundException("CAREGIVER_NOT_FOUND");
		}
		return this.mapCaregiver(caregiver);
	}

	async createCaregiver(
		session: LocalSession,
		payload: CreateCaregiverRequest,
	) {
		this.assertAdmin(session);

		const existingUser = await this.adminRepository.findUserByEmail(payload.email);
		if (existingUser) {
			throw new BadRequestException("EMAIL_ALREADY_REGISTERED");
		}

		if (payload.institutionId) {
			const institution = await this.adminRepository.findInstitutionById(
				payload.institutionId,
			);
			if (!institution) {
				throw new NotFoundException("INSTITUTION_NOT_FOUND");
			}
		}

		const user = await this.adminRepository.createUser({
			email: payload.email,
			username: payload.email.split("@")[0] ?? payload.email,
			passwordHash: await argon2.hash(payload.password),
			role: "caregiver",
			organizationId: payload.institutionId ?? null,
		});

		await this.adminRepository.createCaregiverProfile(user.id, payload.fullName);
		return this.mapCaregiver(
			(await this.adminRepository.listCaregivers()).find(
				(record) => record.id === user.id,
			) ?? {
				id: user.id,
				email: user.email,
				fullName: payload.fullName,
				organizationId: user.organizationId,
				organizationName: null,
				isActive: user.isActive,
				createdAt: user.createdAt,
			},
		);
	}

	async updateCaregiver(
		session: LocalSession,
		caregiverId: string,
		payload: UpdateCaregiverRequest,
	) {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findCaregiverById(caregiverId);
		if (!existing) {
			throw new NotFoundException("CAREGIVER_NOT_FOUND");
		}

		if (payload.email && payload.email !== existing.email) {
			const duplicate = await this.adminRepository.findUserByEmail(payload.email);
			if (duplicate && duplicate.id !== caregiverId) {
				throw new BadRequestException("EMAIL_ALREADY_REGISTERED");
			}
		}

		if (payload.institutionId !== undefined && payload.institutionId !== null) {
			const institution = await this.adminRepository.findInstitutionById(
				payload.institutionId,
			);
			if (!institution) {
				throw new NotFoundException("INSTITUTION_NOT_FOUND");
			}
		}

		await this.adminRepository.updateUser(caregiverId, {
			...(payload.email !== undefined ? { email: payload.email } : {}),
			...(payload.institutionId !== undefined
				? { organizationId: payload.institutionId }
				: {}),
			...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
		});

		if (payload.fullName !== undefined) {
			await this.adminRepository.updateCaregiverProfile(
				caregiverId,
				payload.fullName,
			);
		}

		const updated = await this.adminRepository.findCaregiverById(caregiverId);
		if (!updated) {
			throw new NotFoundException("CAREGIVER_NOT_FOUND");
		}

		return this.mapCaregiver(updated);
	}

	async reassignCaregiverInstitution(
		session: LocalSession,
		caregiverId: string,
		payload: ReassignInstitutionRequest,
	) {
		this.assertAdmin(session);
		const caregiver = await this.adminRepository.findCaregiverById(caregiverId);
		if (!caregiver) {
			throw new NotFoundException("CAREGIVER_NOT_FOUND");
		}

		if (payload.institutionId) {
			await this.assertInstitutionExists(payload.institutionId);
		}

		await this.adminRepository.updateUser(caregiverId, {
			organizationId: payload.institutionId,
		});

		return this.getCaregiver(session, caregiverId);
	}

	async deleteCaregiver(session: LocalSession, caregiverId: string) {
		this.assertAdmin(session);
		const caregiver = await this.adminRepository.findCaregiverById(caregiverId);
		if (!caregiver) {
			throw new NotFoundException("CAREGIVER_NOT_FOUND");
		}

		await this.adminRepository.hardDeleteUser(caregiverId);
		return { success: true };
	}

	async getSeniors(session: LocalSession) {
		this.assertAdmin(session);
		return (await this.adminRepository.listSeniors()).map((record) =>
			this.mapSenior(record),
		);
	}

	async getSenior(session: LocalSession, seniorId: string) {
		this.assertAdmin(session);
		const senior = await this.adminRepository.findSeniorById(seniorId);
		if (!senior) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}
		return this.mapSenior(senior);
	}

	async createSenior(session: LocalSession, payload: CreateSeniorRequest) {
		this.assertAdmin(session);

		if (payload.institutionId) {
			const institution = await this.adminRepository.findInstitutionById(
				payload.institutionId,
			);
			if (!institution) {
				throw new NotFoundException("INSTITUTION_NOT_FOUND");
			}
		}

		const accessCode = generateAccessCode();
		const user = await this.adminRepository.createUser({
			email: `${accessCode.toLowerCase()}@compy.local`,
			username: accessCode,
			passwordHash: await argon2.hash(accessCode),
			role: "senior",
			organizationId: payload.institutionId ?? null,
		});

		await this.adminRepository.createSeniorProfile({
			userId: user.id,
			fullName: payload.fullName,
			nickname: null,
			birthdate: payload.birthDate.toISOString().slice(0, 10),
			gender: payload.gender,
		});
		await this.adminRepository.createSeniorSettings(user.id);

		return this.mapSenior(
			(await this.adminRepository.listSeniors()).find(
				(record) => record.id === user.id,
			) ?? {
				id: user.id,
				email: user.email,
				fullName: payload.fullName,
				nickname: null,
				birthDate: payload.birthDate.toISOString().slice(0, 10),
				gender: payload.gender ?? null,
				accessCode,
				organizationId: user.organizationId,
				organizationName: null,
				isActive: user.isActive,
				createdAt: user.createdAt,
			},
		);
	}

	async updateSenior(
		session: LocalSession,
		seniorId: string,
		payload: UpdateSeniorRequest,
	) {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findSeniorById(seniorId);
		if (!existing) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		if (payload.email && payload.email !== existing.email) {
			const duplicate = await this.adminRepository.findUserByEmail(payload.email);
			if (duplicate && duplicate.id !== seniorId) {
				throw new BadRequestException("EMAIL_ALREADY_REGISTERED");
			}
		}

		if (payload.institutionId !== undefined && payload.institutionId !== null) {
			const institution = await this.adminRepository.findInstitutionById(
				payload.institutionId,
			);
			if (!institution) {
				throw new NotFoundException("INSTITUTION_NOT_FOUND");
			}
		}

		await this.adminRepository.updateUser(seniorId, {
			...(payload.email !== undefined ? { email: payload.email } : {}),
			...(payload.institutionId !== undefined
				? { organizationId: payload.institutionId }
				: {}),
			...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
		});

		await this.adminRepository.updateSeniorProfile(seniorId, {
			...(payload.fullName !== undefined ? { fullname: payload.fullName } : {}),
			...(payload.nickname !== undefined ? { nickname: payload.nickname } : {}),
			...(payload.birthDate !== undefined
				? { birthdate: payload.birthDate.toISOString().slice(0, 10) }
				: {}),
			...(payload.gender !== undefined ? { gender: payload.gender } : {}),
		});

		const updated = await this.adminRepository.findSeniorById(seniorId);
		if (!updated) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		return this.mapSenior(updated);
	}

	async reassignSeniorInstitution(
		session: LocalSession,
		seniorId: string,
		payload: ReassignInstitutionRequest,
	) {
		this.assertAdmin(session);
		const senior = await this.adminRepository.findSeniorById(seniorId);
		if (!senior) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		if (payload.institutionId) {
			await this.assertInstitutionExists(payload.institutionId);
		}

		await this.adminRepository.updateUser(seniorId, {
			organizationId: payload.institutionId,
		});

		return this.getSenior(session, seniorId);
	}

	async deleteSenior(session: LocalSession, seniorId: string) {
		this.assertAdmin(session);
		const senior = await this.adminRepository.findSeniorById(seniorId);
		if (!senior) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		await this.adminRepository.hardDeleteUser(seniorId);
		return { success: true };
	}

	async regenerateSeniorAccessCode(
		session: LocalSession,
		seniorId: string,
	): Promise<RegenerateSeniorAccessCodeResponse> {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findSeniorById(seniorId);
		if (!existing) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		const accessCode = generateAccessCode();
		await this.adminRepository.updateUser(seniorId, {
			username: accessCode,
			passwordHash: await argon2.hash(accessCode),
		});

		return {
			seniorId,
			accessCode,
		};
	}

	// ── Plans ────────────────────────────────────────────────────────────────

	async getPlans(session: LocalSession) {
		this.assertAdmin(session);
		return (await this.adminRepository.listPlans()).map((p) =>
			this.mapPlan(p),
		);
	}

	async createPlan(session: LocalSession, payload: CreatePlanRequest) {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findPlanByName(payload.name);
		if (existing) {
			throw new BadRequestException("PLAN_NAME_TAKEN");
		}
		return this.mapPlan(await this.adminRepository.createPlan(payload));
	}

	async updatePlan(
		session: LocalSession,
		planId: string,
		payload: UpdatePlanRequest,
	) {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findPlanById(planId);
		if (!existing) {
			throw new NotFoundException("PLAN_NOT_FOUND");
		}
		if (payload.name && payload.name !== existing.name) {
			const duplicate = await this.adminRepository.findPlanByName(payload.name);
			if (duplicate) throw new BadRequestException("PLAN_NAME_TAKEN");
		}
		const updated = await this.adminRepository.updatePlan(planId, payload);
		if (!updated) throw new NotFoundException("PLAN_NOT_FOUND");
		return this.mapPlan(updated);
	}

	async deletePlan(session: LocalSession, planId: string) {
		this.assertAdmin(session);
		const existing = await this.adminRepository.findPlanById(planId);
		if (!existing) {
			throw new NotFoundException("PLAN_NOT_FOUND");
		}
		const inUse = await this.adminRepository.countInstitutionsWithPlan(planId);
		if (inUse > 0) {
			throw new BadRequestException("PLAN_IN_USE");
		}
		await this.adminRepository.deletePlan(planId);
		return { success: true };
	}
}
