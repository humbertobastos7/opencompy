import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type {
	AdminDashboardResponse,
	CaregiverAdminResponse,
	InstitutionDetailResponse,
	InstitutionResponse,
	SeniorAdminResponse,
} from "@/shared/contracts";
import { api_client } from "@/frontend/utils/api";
import { readApiError } from "@/frontend/utils/apiErrors";

type Props = {
	lang: string;
};

type CaregiverFormState = {
	email: string;
	password: string;
	fullName: string;
	institutionId: string;
};

type SeniorFormState = {
	email: string;
	fullName: string;
	nickname: string;
	birthDate: string;
	institutionId: string;
};

const emptyCaregiverForm: CaregiverFormState = {
	email: "",
	password: "",
	fullName: "",
	institutionId: "",
};

const emptySeniorForm: SeniorFormState = {
	email: "",
	fullName: "",
	nickname: "",
	birthDate: "",
	institutionId: "",
};

export default function AdminControlCenter({ lang }: Props) {
	const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(
		null,
	);
	const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);
	const [caregivers, setCaregivers] = useState<CaregiverAdminResponse[]>([]);
	const [seniors, setSeniors] = useState<SeniorAdminResponse[]>([]);
	const [selectedInstitutionId, setSelectedInstitutionId] =
		useState<string>("");
	const [selectedInstitutionDetail, setSelectedInstitutionDetail] =
		useState<InstitutionDetailResponse | null>(null);
	const [institutionForm, setInstitutionForm] = useState({
		designation: "",
		location: "",
	});
	const [caregiverForm, setCaregiverForm] =
		useState<CaregiverFormState>(emptyCaregiverForm);
	const [seniorForm, setSeniorForm] =
		useState<SeniorFormState>(emptySeniorForm);
	const [loading, setLoading] = useState(true);

	const loadData = async () => {
		setLoading(true);
		const [dashboardRes, institutionsRes, caregiversRes, seniorsRes] =
			await Promise.all([
				api_client.admin.dashboard.$get(),
				api_client.admin.institutions.$get(),
				api_client.admin.caregivers.$get(),
				api_client.admin.seniors.$get(),
			]);

		if (
			!dashboardRes.ok ||
			!institutionsRes.ok ||
			!caregiversRes.ok ||
			!seniorsRes.ok
		) {
			const failingResponse =
				(!dashboardRes.ok && dashboardRes) ||
				(!institutionsRes.ok && institutionsRes) ||
				(!caregiversRes.ok && caregiversRes) ||
				seniorsRes;
			toast.error(await readApiError(failingResponse, lang));
			setLoading(false);
			return;
		}

		setDashboard((await dashboardRes.json()) as AdminDashboardResponse);
		setInstitutions((await institutionsRes.json()) as InstitutionResponse[]);
		setCaregivers((await caregiversRes.json()) as CaregiverAdminResponse[]);
		setSeniors((await seniorsRes.json()) as SeniorAdminResponse[]);
		if (selectedInstitutionId) {
			const detailRes = await api_client.admin.institutions[
				":institutionId"
			].$get({
				param: { institutionId: selectedInstitutionId },
			});
			if (detailRes.ok) {
				setSelectedInstitutionDetail(
					(await detailRes.json()) as InstitutionDetailResponse,
				);
			}
		}
		setLoading(false);
	};

	useEffect(() => {
		void loadData();
	}, []);

	useEffect(() => {
		const loadInstitutionDetail = async () => {
			if (!selectedInstitutionId) {
				setSelectedInstitutionDetail(null);
				return;
			}

			const res = await api_client.admin.institutions[":institutionId"].$get({
				param: { institutionId: selectedInstitutionId },
			});
			if (!res.ok) {
				toast.error(await readApiError(res, lang));
				return;
			}

			setSelectedInstitutionDetail(
				(await res.json()) as InstitutionDetailResponse,
			);
		};

		void loadInstitutionDetail();
	}, [selectedInstitutionId]);

	const saveInstitution = async (
		institutionId: string,
		payload: Partial<InstitutionResponse>,
	) => {
		const res = await api_client.admin.institutions[":institutionId"].$patch({
			param: { institutionId },
			json: {
				designation: payload.designation,
				location: payload.location,
			},
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Institution updated");
		await loadData();
	};

	const createInstitution = async () => {
		const res = await api_client.admin.institutions.$post({
			json: {
				designation: institutionForm.designation,
				location: institutionForm.location || undefined,
			},
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		setInstitutionForm({ designation: "", location: "" });
		toast.success("Institution created");
		await loadData();
	};

	const deleteInstitution = async (institutionId: string) => {
		const confirmed = window.confirm(
			"Delete this institution? This only works when no users are assigned to it.",
		);
		if (!confirmed) {
			return;
		}

		const res = await api_client.admin.institutions[":institutionId"].$delete({
			param: { institutionId },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}

		if (selectedInstitutionId === institutionId) {
			setSelectedInstitutionId("");
			setSelectedInstitutionDetail(null);
		}
		toast.success("Institution deleted");
		await loadData();
	};

	const saveCaregiver = async (
		caregiverId: string,
		payload: Partial<CaregiverAdminResponse>,
	) => {
		const res = await api_client.admin.caregivers[":caregiverId"].$patch({
			param: { caregiverId },
			json: {
				email: payload.email,
				fullName: payload.fullName,
				institutionId: payload.organizationId,
				isActive: payload.isActive,
			},
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Caregiver updated");
		await loadData();
	};

	const createCaregiver = async () => {
		const res = await api_client.admin.caregivers.$post({
			json: {
				...caregiverForm,
				institutionId: caregiverForm.institutionId || undefined,
			},
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		setCaregiverForm(emptyCaregiverForm);
		toast.success("Caregiver created");
		await loadData();
	};

	const reassignCaregiverInstitution = async (
		caregiverId: string,
		institutionId: string | null,
	) => {
		const res = await api_client.admin.caregivers[
			":caregiverId"
		].institution.$patch({
			param: { caregiverId },
			json: { institutionId },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Caregiver institution updated");
		await loadData();
	};

	const deleteCaregiver = async (caregiverId: string) => {
		const confirmed = window.confirm("Deactivate this caregiver account?");
		if (!confirmed) {
			return;
		}

		const res = await api_client.admin.caregivers[":caregiverId"].$delete({
			param: { caregiverId },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Caregiver deactivated");
		await loadData();
	};

	const saveSenior = async (
		seniorId: string,
		payload: Partial<SeniorAdminResponse>,
	) => {
		const res = await api_client.admin.seniors[":seniorId"].$patch({
			param: { seniorId },
			json: {
				email: payload.email,
				fullName: payload.fullName,
				nickname: payload.nickname ?? undefined,
				birthDate: payload.birthDate
					? new Date(payload.birthDate).toISOString()
					: undefined,
				institutionId: payload.organizationId,
				isActive: payload.isActive,
			},
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Senior updated");
		await loadData();
	};

	const createSenior = async () => {
		const res = await api_client.admin.seniors.$post({
			json: {
				...seniorForm,
				birthDate: new Date(seniorForm.birthDate).toISOString(),
				institutionId: seniorForm.institutionId || undefined,
			},
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		setSeniorForm(emptySeniorForm);
		toast.success("Senior created");
		await loadData();
	};

	const reassignSeniorInstitution = async (
		seniorId: string,
		institutionId: string | null,
	) => {
		const res = await api_client.admin.seniors[":seniorId"].institution.$patch({
			param: { seniorId },
			json: { institutionId },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Senior institution updated");
		await loadData();
	};

	const deleteSenior = async (seniorId: string) => {
		const confirmed = window.confirm("Deactivate this senior account?");
		if (!confirmed) {
			return;
		}

		const res = await api_client.admin.seniors[":seniorId"].$delete({
			param: { seniorId },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Senior deactivated");
		await loadData();
	};

	const regenerateAccessCode = async (seniorId: string) => {
		const res = await api_client.admin.seniors[":seniorId"][
			"regenerate-access-code"
		].$post({
			param: { seniorId },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}

		const payload = (await res.json()) as { accessCode: string };
		await navigator.clipboard.writeText(payload.accessCode);
		toast.success("New access code copied");
		await loadData();
	};

	return (
		<div className="w-full flex flex-col gap-6 px-4 pb-8">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-black tracking-tight">
						Admin Control Center
					</h2>
					<p className="text-sm opacity-70">
						Operational controls for institutions, caregivers, and seniors.
					</p>
				</div>
				<div className="badge badge-outline badge-lg">{lang.toUpperCase()}</div>
			</div>

			<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
				{[
					["Institutions", dashboard?.totalInstitutions ?? 0],
					["Caregivers", dashboard?.totalCaregivers ?? 0],
					["Seniors", dashboard?.totalSeniors ?? 0],
					["Active Users", dashboard?.totalActiveUsers ?? 0],
					["Conversations", dashboard?.totalConversations ?? 0],
					[
						"Unassigned",
						(dashboard?.seniorsWithoutInstitution ?? 0) +
							(dashboard?.caregiversWithoutInstitution ?? 0),
					],
				].map(([label, value]) => (
					<div key={label} className="rounded-box bg-base-300 p-4">
						<div className="text-xs uppercase tracking-[0.2em] opacity-60">
							{label}
						</div>
						<div className="pt-2 text-3xl font-black">{value}</div>
					</div>
				))}
			</div>

			<div className="grid gap-6 xl:grid-cols-3">
				<section className="rounded-box bg-base-300 p-4">
					<h3 className="text-lg font-bold">Create Institution</h3>
					<div className="mt-3 flex flex-col gap-3">
						<input
							className="input input-bordered w-full"
							placeholder="Designation"
							value={institutionForm.designation}
							onChange={(event) =>
								setInstitutionForm((current) => ({
									...current,
									designation: event.target.value,
								}))
							}
						/>
						<input
							className="input input-bordered w-full"
							placeholder="Location"
							value={institutionForm.location}
							onChange={(event) =>
								setInstitutionForm((current) => ({
									...current,
									location: event.target.value,
								}))
							}
						/>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => void createInstitution()}
							disabled={!institutionForm.designation.trim()}
						>
							Create
						</button>
					</div>
				</section>

				<section className="rounded-box bg-base-300 p-4">
					<h3 className="text-lg font-bold">Create Caregiver</h3>
					<div className="mt-3 flex flex-col gap-3">
						<input
							className="input input-bordered w-full"
							placeholder="Full name"
							value={caregiverForm.fullName}
							onChange={(event) =>
								setCaregiverForm((current) => ({
									...current,
									fullName: event.target.value,
								}))
							}
						/>
						<input
							className="input input-bordered w-full"
							placeholder="Email"
							value={caregiverForm.email}
							onChange={(event) =>
								setCaregiverForm((current) => ({
									...current,
									email: event.target.value,
								}))
							}
						/>
						<input
							className="input input-bordered w-full"
							placeholder="Password"
							type="password"
							value={caregiverForm.password}
							onChange={(event) =>
								setCaregiverForm((current) => ({
									...current,
									password: event.target.value,
								}))
							}
						/>
						<select
							className="select select-bordered w-full"
							value={caregiverForm.institutionId}
							onChange={(event) =>
								setCaregiverForm((current) => ({
									...current,
									institutionId: event.target.value,
								}))
							}
						>
							<option value="">No institution</option>
							{institutions.map((institution) => (
								<option key={institution.id} value={institution.id}>
									{institution.designation}
								</option>
							))}
						</select>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => void createCaregiver()}
							disabled={
								!caregiverForm.fullName.trim() ||
								!caregiverForm.email.trim() ||
								!caregiverForm.password.trim()
							}
						>
							Create
						</button>
					</div>
				</section>

				<section className="rounded-box bg-base-300 p-4">
					<h3 className="text-lg font-bold">Create Senior</h3>
					<div className="mt-3 flex flex-col gap-3">
						<input
							className="input input-bordered w-full"
							placeholder="Full name"
							value={seniorForm.fullName}
							onChange={(event) =>
								setSeniorForm((current) => ({
									...current,
									fullName: event.target.value,
								}))
							}
						/>
						<input
							className="input input-bordered w-full"
							placeholder="Nickname"
							value={seniorForm.nickname}
							onChange={(event) =>
								setSeniorForm((current) => ({
									...current,
									nickname: event.target.value,
								}))
							}
						/>
						<input
							className="input input-bordered w-full"
							placeholder="Email"
							value={seniorForm.email}
							onChange={(event) =>
								setSeniorForm((current) => ({
									...current,
									email: event.target.value,
								}))
							}
						/>
						<input
							className="input input-bordered w-full"
							type="date"
							value={seniorForm.birthDate}
							onChange={(event) =>
								setSeniorForm((current) => ({
									...current,
									birthDate: event.target.value,
								}))
							}
						/>
						<select
							className="select select-bordered w-full"
							value={seniorForm.institutionId}
							onChange={(event) =>
								setSeniorForm((current) => ({
									...current,
									institutionId: event.target.value,
								}))
							}
						>
							<option value="">No institution</option>
							{institutions.map((institution) => (
								<option key={institution.id} value={institution.id}>
									{institution.designation}
								</option>
							))}
						</select>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => void createSenior()}
							disabled={
								!seniorForm.fullName.trim() ||
								!seniorForm.nickname.trim() ||
								!seniorForm.email.trim() ||
								!seniorForm.birthDate
							}
						>
							Create
						</button>
					</div>
				</section>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1fr_1fr_1.1fr]">
				<section className="rounded-box bg-base-300 p-4 xl:col-span-1">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-lg font-bold">Institutions</h3>
						{loading && <span className="loading loading-spinner loading-sm" />}
					</div>
					<div className="flex max-h-[32rem] flex-col gap-3 overflow-auto pr-1">
						{institutions.map((institution) => (
							<div key={institution.id} className="rounded-box bg-base-100 p-3">
								<input
									className="input input-bordered input-sm w-full"
									defaultValue={institution.designation}
									onBlur={(event) => {
										if (event.target.value !== institution.designation) {
											void saveInstitution(institution.id, {
												designation: event.target.value,
												location: institution.location,
											});
										}
									}}
								/>
								<input
									className="input input-bordered input-sm mt-2 w-full"
									defaultValue={institution.location ?? ""}
									placeholder="Location"
									onBlur={(event) => {
										const nextLocation = event.target.value || null;
										if (nextLocation !== institution.location) {
											void saveInstitution(institution.id, {
												designation: institution.designation,
												location: nextLocation,
											});
										}
									}}
								/>
								<div className="mt-2 flex gap-2">
									<button
										type="button"
										className={`btn btn-sm flex-1 ${selectedInstitutionId === institution.id ? "btn-primary" : "btn-outline"}`}
										onClick={() => setSelectedInstitutionId(institution.id)}
									>
										View detail
									</button>
									<button
										type="button"
										className="btn btn-sm btn-error btn-outline"
										onClick={() => void deleteInstitution(institution.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-box bg-base-300 p-4 xl:col-span-1">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-lg font-bold">Institution Detail</h3>
						<div className="badge badge-outline">
							{selectedInstitutionDetail?.institution.designation ??
								"None selected"}
						</div>
					</div>
					{selectedInstitutionDetail ? (
						<div className="flex max-h-[32rem] flex-col gap-4 overflow-auto pr-1">
							<div className="rounded-box bg-base-100 p-4">
								<div className="text-sm font-bold uppercase tracking-[0.2em] opacity-60">
									Location
								</div>
								<div className="pt-2 text-base">
									{selectedInstitutionDetail.institution.location ||
										"No location"}
								</div>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-box bg-base-100 p-4">
									<div className="text-xs uppercase tracking-[0.2em] opacity-60">
										Caregivers
									</div>
									<div className="pt-2 text-3xl font-black">
										{selectedInstitutionDetail.caregivers.length}
									</div>
								</div>
								<div className="rounded-box bg-base-100 p-4">
									<div className="text-xs uppercase tracking-[0.2em] opacity-60">
										Seniors
									</div>
									<div className="pt-2 text-3xl font-black">
										{selectedInstitutionDetail.seniors.length}
									</div>
								</div>
							</div>
							<div className="rounded-box bg-base-100 p-4">
								<div className="text-sm font-bold">Assigned Caregivers</div>
								<div className="mt-3 flex flex-col gap-2">
									{selectedInstitutionDetail.caregivers.map((caregiver) => (
										<div
											key={caregiver.id}
											className="rounded-box bg-base-200 px-3 py-2 text-sm"
										>
											<div className="font-semibold">{caregiver.fullName}</div>
											<div className="opacity-70">{caregiver.email}</div>
										</div>
									))}
									{selectedInstitutionDetail.caregivers.length === 0 && (
										<div className="text-sm opacity-70">
											No caregivers assigned.
										</div>
									)}
								</div>
							</div>
							<div className="rounded-box bg-base-100 p-4">
								<div className="text-sm font-bold">Assigned Seniors</div>
								<div className="mt-3 flex flex-col gap-2">
									{selectedInstitutionDetail.seniors.map((senior) => (
										<div
											key={senior.id}
											className="rounded-box bg-base-200 px-3 py-2 text-sm"
										>
											<div className="font-semibold">{senior.fullName}</div>
											<div className="opacity-70">{senior.email}</div>
										</div>
									))}
									{selectedInstitutionDetail.seniors.length === 0 && (
										<div className="text-sm opacity-70">
											No seniors assigned.
										</div>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-box bg-base-100 p-4 text-sm opacity-70">
							Select an institution to inspect current assignments.
						</div>
					)}
				</section>

				<section className="rounded-box bg-base-300 p-4 xl:col-span-1">
					<h3 className="mb-3 text-lg font-bold">Caregivers</h3>
					<div className="flex max-h-[32rem] flex-col gap-3 overflow-auto pr-1">
						{caregivers.map((caregiver) => (
							<div key={caregiver.id} className="rounded-box bg-base-100 p-3">
								<input
									className="input input-bordered input-sm w-full"
									defaultValue={caregiver.fullName}
									onBlur={(event) => {
										if (event.target.value !== caregiver.fullName) {
											void saveCaregiver(caregiver.id, {
												...caregiver,
												fullName: event.target.value,
											});
										}
									}}
								/>
								<input
									className="input input-bordered input-sm mt-2 w-full"
									defaultValue={caregiver.email}
									onBlur={(event) => {
										if (event.target.value !== caregiver.email) {
											void saveCaregiver(caregiver.id, {
												...caregiver,
												email: event.target.value,
											});
										}
									}}
								/>
								<div className="mt-2 flex gap-2">
									<select
										className="select select-bordered select-sm flex-1"
										defaultValue={caregiver.organizationId ?? ""}
										onChange={(event) => {
											void reassignCaregiverInstitution(
												caregiver.id,
												event.target.value || null,
											);
										}}
									>
										<option value="">No institution</option>
										{institutions.map((institution) => (
											<option key={institution.id} value={institution.id}>
												{institution.designation}
											</option>
										))}
									</select>
									<button
										type="button"
										className={`btn btn-sm ${caregiver.isActive ? "btn-outline" : "btn-primary"}`}
										onClick={() =>
											void saveCaregiver(caregiver.id, {
												...caregiver,
												isActive: !caregiver.isActive,
											})
										}
									>
										{caregiver.isActive ? "Disable" : "Enable"}
									</button>
								</div>
								<div className="mt-2 flex justify-end">
									<button
										type="button"
										className="btn btn-sm btn-error btn-outline"
										onClick={() => void deleteCaregiver(caregiver.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-box bg-base-300 p-4 xl:col-span-3">
					<h3 className="mb-3 text-lg font-bold">Seniors</h3>
					<div className="grid max-h-[32rem] gap-3 overflow-auto pr-1 lg:grid-cols-2">
						{seniors.map((senior) => (
							<div key={senior.id} className="rounded-box bg-base-100 p-3">
								<input
									className="input input-bordered input-sm w-full"
									defaultValue={senior.fullName}
									onBlur={(event) => {
										if (event.target.value !== senior.fullName) {
											void saveSenior(senior.id, {
												...senior,
												fullName: event.target.value,
											});
										}
									}}
								/>
								<div className="mt-2 grid gap-2 sm:grid-cols-2">
									<input
										className="input input-bordered input-sm w-full"
										defaultValue={senior.nickname ?? ""}
										placeholder="Nickname"
										onBlur={(event) => {
											if (event.target.value !== (senior.nickname ?? "")) {
												void saveSenior(senior.id, {
													...senior,
													nickname: event.target.value,
												});
											}
										}}
									/>
									<input
										className="input input-bordered input-sm w-full"
										type="date"
										defaultValue={senior.birthDate ?? ""}
										onBlur={(event) => {
											if (event.target.value !== (senior.birthDate ?? "")) {
												void saveSenior(senior.id, {
													...senior,
													birthDate: event.target.value,
												});
											}
										}}
									/>
								</div>
								<input
									className="input input-bordered input-sm mt-2 w-full"
									defaultValue={senior.email}
									onBlur={(event) => {
										if (event.target.value !== senior.email) {
											void saveSenior(senior.id, {
												...senior,
												email: event.target.value,
											});
										}
									}}
								/>
								<div className="mt-2 flex gap-2">
									<select
										className="select select-bordered select-sm flex-1"
										defaultValue={senior.organizationId ?? ""}
										onChange={(event) => {
											void reassignSeniorInstitution(
												senior.id,
												event.target.value || null,
											);
										}}
									>
										<option value="">No institution</option>
										{institutions.map((institution) => (
											<option key={institution.id} value={institution.id}>
												{institution.designation}
											</option>
										))}
									</select>
									<button
										type="button"
										className={`btn btn-sm ${senior.isActive ? "btn-outline" : "btn-primary"}`}
										onClick={() =>
											void saveSenior(senior.id, {
												...senior,
												isActive: !senior.isActive,
											})
										}
									>
										{senior.isActive ? "Disable" : "Enable"}
									</button>
								</div>
								<div className="mt-2 flex items-center gap-2">
									<div className="flex-1 rounded-btn bg-base-200 px-3 py-2 font-mono text-sm">
										{senior.accessCode}
									</div>
									<button
										type="button"
										className="btn btn-primary btn-sm"
										onClick={() => void regenerateAccessCode(senior.id)}
									>
										Regenerate
									</button>
								</div>
								<div className="mt-2 flex justify-end">
									<button
										type="button"
										className="btn btn-sm btn-error btn-outline"
										onClick={() => void deleteSenior(senior.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
