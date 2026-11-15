import { createLazyFileRoute } from "@tanstack/react-router";
import { DS } from "@/frontend/designSystem";
import { MS } from "@/frontend/modalSystem";
import { useCallback, useEffect, useState } from "react";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { toast } from "react-toastify";
import {
	HiArrowLeft,
	HiUserPlus,
	HiUserGroup,
	HiBuildingOffice2,
	HiChartBar,
	HiUsers,
	HiUser,
	HiPencilSquare,
	HiTrash,
	HiXMark,
	HiChevronDown,
	HiHome,
} from "react-icons/hi2";
import { Settings } from "@/frontend/components/settings/settings";
import { PoweredByKindtech } from "@/frontend/components/ui/PoweredByKindtech";
import { useSessionStore } from "@/frontend/stores/session";
import { api_client } from "@/frontend/utils/api";
import { readApiError } from "@/frontend/utils/apiErrors";
import type {
	InstitutionResponse,
	AdminDashboardResponse,
	SeniorAdminResponse,
	CaregiverAdminResponse,
	PlanResponse,
} from "@/shared/contracts";
import type { CSSProperties } from "react";

export const Route = createLazyFileRoute("/$lang/_app/_app/_admin/admin/")({
	component: RouteComponent,
});

const BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";

const glowBase: CSSProperties = {
	position: "fixed",
	borderRadius: "50%",
	pointerEvents: "none",
	zIndex: 0,
};

const pageStyles: Record<string, CSSProperties> = {
	screen: {
		height: "100%",
		minHeight: "100%",
		maxHeight: "100%",
		width: "100%",
		background: BG,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		overflow: "hidden",
	},
	bgGlowTwo: {
		...glowBase,
		width: 200,
		height: 200,
		background: "rgba(255, 255, 255, 0.52)",
		filter: "blur(24px)",
		left: "51%",
		top: "46%",
		transform: "translateX(-50%)",
	},
	bgGlowThree: {
		...glowBase,
		width: 180,
		height: 180,
		background: "rgba(255, 252, 226, 0.34)",
		filter: "blur(26px)",
		right: -50,
		top: 130,
	},
};

const tableCard: CSSProperties = {
	background: "rgba(255,255,255,0.94)",
	borderRadius: 28,
	border: "1px solid rgba(33,91,88,0.14)",
	boxShadow: "0 18px 42px rgba(31,80,73,0.08)",
	overflow: "hidden",
};

const glassBtnCard: CSSProperties = {
	background: "rgba(255,255,255,0.92)",
	border: "1px solid rgba(33,91,88,0.14)",
	borderRadius: 28,
	boxShadow: "0 18px 42px rgba(31,80,73,0.08)",
	cursor: "pointer",
};

const softPanelCard: CSSProperties = {
	background: "#ffffff",
	border: "1px solid rgba(33,91,88,0.16)",
	borderRadius: 30,
	boxShadow: "0 18px 42px rgba(31,80,73,0.08)",
};

const labelStyle: CSSProperties = {
	margin: 0,
	fontSize: 11,
	fontWeight: 700,
	letterSpacing: "0.48px",
	color: "rgba(0,0,0,0.52)",
	textTransform: "uppercase",
};

const primaryButtonStyle: CSSProperties = {
	background: "#0a4a45",
	color: "#ffffff",
	border: "none",
	borderRadius: 18,
	boxShadow: "0 14px 28px rgba(8,34,35,0.14)",
	cursor: "pointer",
};

const editBtnStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 30,
	height: 30,
	borderRadius: 8,
	background: "rgba(26,95,90,0.07)",
	border: "none",
	cursor: "pointer",
	color: "#1a5f5a",
	transition: "background 150ms ease",
	flexShrink: 0,
};

const deleteBtnStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 30,
	height: 30,
	borderRadius: 8,
	background: "rgba(217,54,54,0.07)",
	border: "none",
	cursor: "pointer",
	color: "#d93636",
	transition: "background 150ms ease",
	flexShrink: 0,
};

type View =
	| "home"
	| "register-senior"
	| "register-caregiver"
	| "choose-institution-type"
	| "register-institution"
	| "register-plan"
	| "dashboard";

type CaregiverForm = {
	email: string;
	password: string;
	confirmPassword: string;
	fullName: string;
	institutionId: string;
};
type SeniorForm = {
	fullName: string;
	gender: string;
	birthDate: string;
	institutionId: string;
};
type InstitutionForm = {
	type: "ipss" | "family";
	designation: string;
	location: string;
	planId: string;
};

type PlanForm = {
	name: string;
	maxSeniors: string;
	maxTalkingMinutesPerMonth: string;
};

type EditTarget =
	| { type: "senior"; data: SeniorAdminResponse }
	| { type: "caregiver"; data: CaregiverAdminResponse }
	| { type: "institution"; data: InstitutionResponse };

const emptyCaregiverForm: CaregiverForm = {
	email: "",
	password: "",
	confirmPassword: "",
	fullName: "",
	institutionId: "",
};
const emptySeniorForm: SeniorForm = {
	fullName: "",
	gender: "",
	birthDate: "",
	institutionId: "",
};
const genderOptions = [
	{ value: "m", label: "Masculino" },
	{ value: "f", label: "Feminino" },
];
const emptyInstitutionForm: InstitutionForm = {
	type: "ipss",
	designation: "",
	location: "",
	planId: "",
};

const emptyPlanForm: PlanForm = {
	name: "",
	maxSeniors: "",
	maxTalkingMinutesPerMonth: "",
};

// ── Shared layout wrapper ──────────────────────────────────────────────────
function PageShell({
	lang,
	children,
	onBack,
	wide,
	subheader,
}: {
	lang: string;
	children: React.ReactNode;
	onBack?: () => void;
	wide?: boolean;
	subheader?: React.ReactNode;
}) {
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);
	return (
		<div style={{ ...pageStyles.screen, background: globalBackground ?? BG }}>
			<div style={pageStyles.bgGlowTwo} />
			<div style={pageStyles.bgGlowThree} />

			<div
				style={{
					position: "relative",
					zIndex: 1,
					width: "100%",
					flex: 1,
					overflowY: "auto",
					boxSizing: "border-box",
				}}
				className="px-5 sm:px-8 xl:px-12 pb-8"
			>
				<div
					style={{
						width: "100%",
						maxWidth: wide ? 1180 : 760,
						margin: "0 auto",
					}}
				>
					<div
						className="flex items-center justify-between"
						style={{ paddingTop: 20, paddingBottom: 0 }}
					>
						<img
							src="/compyTextLogo.png"
							alt="Compy"
							style={{ height: 28, filter: "brightness(0.12) saturate(1.05)" }}
							className="object-contain"
						/>
						<Settings locale={lang} btnClassName="text-black" />
					</div>

					<main style={{ paddingTop: 34 }}>
						{subheader && <div style={{ marginBottom: 28 }}>{subheader}</div>}

						{onBack && (
							<button
								type="button"
								onClick={onBack}
								className="flex items-center gap-1 text-sm transition-opacity hover:opacity-80 mb-6"
								style={{
									color: "#111111",
									background: "none",
									border: "none",
									padding: 0,
									cursor: "pointer",
								}}
							>
								<HiArrowLeft size={16} />
								<span>Voltar</span>
							</button>
						)}

						{children}

						<div
							className="flex"
							style={{
								marginTop: 48,
								marginBottom: 8,
								justifyContent: "center",
								pointerEvents: "none",
							}}
						>
							<PoweredByKindtech />
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}

// ── Input component ────────────────────────────────────────────────────────
function FormInput({
	label,
	type = "text",
	placeholder,
	value,
	onChange,
}: {
	label: string;
	type?: string;
	placeholder?: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-col gap-1">
			<label className="text-sm font-medium" style={{ color: "#2a5a5a" }}>
				{label}
			</label>
			<input
				type={type}
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full"
				style={DS.formInput}
				onFocus={(e) => {
					e.currentTarget.style.borderColor = DS.C.teal400;
					e.currentTarget.style.boxShadow = "0 0 0 3px rgba(31,181,181,0.12)";
				}}
				onBlur={(e) => {
					e.currentTarget.style.borderColor = "rgba(26,95,90,0.18)";
					e.currentTarget.style.boxShadow = "none";
				}}
			/>
		</div>
	);
}

// ── Select component ───────────────────────────────────────────────────────
function FormSelect({
	label,
	value,
	onChange,
	options,
	emptyLabel,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string }[];
	emptyLabel: string;
}) {
	return (
		<div className="flex flex-col gap-1">
			<label className="text-sm font-medium" style={{ color: "#2a5a5a" }}>
				{label}
			</label>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="rounded-xl px-4 py-3 text-sm appearance-none outline-none w-full"
				style={{
					backgroundColor: "#fff",
					border: "1px solid rgba(26,95,90,0.18)",
					color: value ? "#1a2a2a" : "#9ab5b5",
					backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231a5f5a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
					backgroundRepeat: "no-repeat",
					backgroundPosition: "right 14px center",
					paddingRight: 36,
				}}
			>
				<option value="">{emptyLabel}</option>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</div>
	);
}

// ── Form card wrapper ──────────────────────────────────────────────────────
function FormCard({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle: string;
	children: React.ReactNode;
}) {
	return (
		<div className="w-full" style={{ ...softPanelCard, padding: "28px 32px" }}>
			<h2
				className="text-2xl font-semibold mb-1"
				style={{ color: "#111111", letterSpacing: "-0.25px" }}
			>
				{title}
			</h2>
			<p className="text-sm mb-6" style={{ color: "rgba(0,0,0,0.62)" }}>
				{subtitle}
			</p>
			<div className="flex flex-col gap-4">{children}</div>
		</div>
	);
}

// ── Edit modal ─────────────────────────────────────────────────────────────
function EditModal({
	lang,
	target,
	institutions,
	onClose,
	onSaved,
}: {
	lang: string;
	target: EditTarget;
	institutions: InstitutionResponse[];
	onClose: () => void;
	onSaved: () => void;
}) {
	const institutionOptions = institutions.map((i) => ({
		value: i.id,
		label: i.designation,
	}));
	const [submitting, setSubmitting] = useState(false);

	const [seniorFullName, setSeniorFullName] = useState(
		target.type === "senior" ? target.data.fullName : "",
	);
	const [seniorGender, setSeniorGender] = useState(
		target.type === "senior" ? (target.data.gender ?? "") : "",
	);
	const [seniorBirthDate, setSeniorBirthDate] = useState(
		target.type === "senior"
			? (target.data.birthDate?.split("T")[0] ?? "")
			: "",
	);
	const [seniorInstitutionId, setSeniorInstitutionId] = useState(
		target.type === "senior" ? (target.data.organizationId ?? "") : "",
	);

	const [caregiverFullName, setCaregiverFullName] = useState(
		target.type === "caregiver" ? target.data.fullName : "",
	);
	const [caregiverEmail, setCaregiverEmail] = useState(
		target.type === "caregiver" ? target.data.email : "",
	);
	const [caregiverInstitutionId, setCaregiverInstitutionId] = useState(
		target.type === "caregiver" ? (target.data.organizationId ?? "") : "",
	);

	const [instDesignation, setInstDesignation] = useState(
		target.type === "institution" ? target.data.designation : "",
	);
	const [instLocation, setInstLocation] = useState(
		target.type === "institution" ? (target.data.location ?? "") : "",
	);

	const instTitle =
		target.type === "institution"
			? target.data.type === "family"
				? "Editar família"
				: "Editar IPSS"
			: "";
	const titleMap = {
		senior: "Editar sénior",
		caregiver: "Editar cuidador",
		institution: instTitle,
	};

	const handleSave = async () => {
		setSubmitting(true);
		try {
			if (target.type === "senior") {
				const res = await api_client.admin.seniors[":seniorId"].$patch({
					param: { seniorId: target.data.id },
					json: {
						fullName: seniorFullName,
						gender: (seniorGender as "m" | "f") || undefined,
						birthDate: seniorBirthDate
							? new Date(seniorBirthDate).toISOString()
							: undefined,
						institutionId: seniorInstitutionId || undefined,
					},
				});
				if (!res.ok) {
					toast.error(await readApiError(res, lang));
					return;
				}
				toast.success("Sénior atualizado.");
			} else if (target.type === "caregiver") {
				const res = await api_client.admin.caregivers[":caregiverId"].$patch({
					param: { caregiverId: target.data.id },
					json: {
						fullName: caregiverFullName,
						email: caregiverEmail,
						institutionId: caregiverInstitutionId || undefined,
					},
				});
				if (!res.ok) {
					toast.error(await readApiError(res, lang));
					return;
				}
				toast.success("Cuidador atualizado.");
			} else {
				const res = await api_client.admin.institutions[
					":institutionId"
				].$patch({
					param: { institutionId: target.data.id },
					json: {
						designation: instDesignation,
						location: instLocation || undefined,
					},
				});
				if (!res.ok) {
					toast.error(await readApiError(res, lang));
					return;
				}
				toast.success(
					target.type === "institution" && target.data.type === "family"
						? "Família atualizada."
						: "IPSS atualizada.",
				);
			}
			onSaved();
			onClose();
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<style>{MS.keyframes}</style>
			<div style={MS.overlay} onClick={onClose}>
				<div
					className="modal-card"
					style={{ ...MS.card, maxWidth: 480 }}
					onClick={(e) => e.stopPropagation()}
				>
					<div style={MS.header}>
						<span style={MS.headerTitle}>{titleMap[target.type]}</span>
						<button type="button" onClick={onClose} style={MS.closeButton}>
							<HiXMark size={16} />
						</button>
					</div>
					<div style={{ ...MS.body, gap: 16 }}>
						{target.type === "senior" && (
							<>
								<FormInput
									label="Nome completo"
									value={seniorFullName}
									onChange={setSeniorFullName}
								/>
								<FormSelect
									label="Género"
									value={seniorGender}
									onChange={setSeniorGender}
									options={genderOptions}
									emptyLabel="Selecionar género"
								/>
								<FormInput
									label="Data de nascimento"
									type="date"
									value={seniorBirthDate}
									onChange={setSeniorBirthDate}
								/>
								<FormSelect
									label="Instituição / Família"
									value={seniorInstitutionId}
									onChange={setSeniorInstitutionId}
									options={institutionOptions}
									emptyLabel="Sem grupo"
								/>
							</>
						)}
						{target.type === "caregiver" && (
							<>
								<FormInput
									label="Nome completo"
									value={caregiverFullName}
									onChange={setCaregiverFullName}
								/>
								<FormInput
									label="Email"
									type="email"
									value={caregiverEmail}
									onChange={setCaregiverEmail}
								/>
								<FormSelect
									label="Instituição / Família"
									value={caregiverInstitutionId}
									onChange={setCaregiverInstitutionId}
									options={institutionOptions}
									emptyLabel="Sem grupo"
								/>
							</>
						)}
						{target.type === "institution" && (
							<>
								<FormInput
									label="Designação"
									value={instDesignation}
									onChange={setInstDesignation}
								/>
								<FormInput
									label="Localização"
									placeholder="Localização (opcional)"
									value={instLocation}
									onChange={setInstLocation}
								/>
							</>
						)}
						<div
							style={{
								marginTop: 8,
								display: "flex",
								flexDirection: "column",
								gap: 10,
							}}
						>
							<button
								type="button"
								onClick={() => void handleSave()}
								disabled={submitting}
								style={{ ...MS.confirmButton, opacity: submitting ? 0.65 : 1 }}
							>
								{submitting ? "A guardar..." : "Guardar alterações"}
							</button>
							<button type="button" onClick={onClose} style={MS.cancelLink}>
								Cancelar
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

// ── Delete confirmation modal ───────────────────────────────────────────────
function DeleteConfirmModal({
	label,
	onConfirm,
	onClose,
	loading,
}: {
	label: string;
	onConfirm: () => void;
	onClose: () => void;
	loading: boolean;
}) {
	return (
		<>
			<style>{MS.keyframes}</style>
			<div style={MS.overlay} onClick={onClose}>
				<div
					className="modal-card"
					style={{ ...MS.card, maxWidth: 420 }}
					onClick={(e) => e.stopPropagation()}
				>
				<div style={MS.header}>
					<h2 style={MS.headerTitle}>Tens a certeza?</h2>
					<button type="button" onClick={onClose} style={MS.closeButton}>
						<HiXMark size={18} />
					</button>
				</div>
				<div style={{ padding: "0 24px 24px" }}>
					<p className="text-sm mb-6" style={{ color: "rgba(0,0,0,0.62)" }}>
						{label}
					</p>
					<div className="flex flex-col gap-3">
						<button
							type="button"
							onClick={() => void onConfirm()}
							disabled={loading}
							style={{
								...MS.confirmButton,
								background: loading ? "#e05555" : "#d93636",
								opacity: loading ? 0.75 : 1,
							}}
						>
							{loading ? "A apagar..." : "Apagar definitivamente"}
						</button>
						<button type="button" onClick={onClose} style={MS.cancelLink}>
							Cancelar
						</button>
					</div>
				</div>
			</div>
			</div>
		</>
	);
}

// ── Dashboard view ─────────────────────────────────────────────────────────
function DashboardView({ lang, onBack }: { lang: string; onBack: () => void }) {
	const [stats, setStats] = useState<AdminDashboardResponse | null>(null);
	const [seniors, setSeniors] = useState<SeniorAdminResponse[]>([]);
	const [caregivers, setCaregivers] = useState<CaregiverAdminResponse[]>([]);
	const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);
	const [plans, setPlans] = useState<PlanResponse[]>([]);
	const [loading, setLoading] = useState(true);
	const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<{
		type: "senior" | "caregiver" | "institution";
		id: string;
		label: string;
	} | null>(null);
	const [deleting, setDeleting] = useState(false);

	const loadAll = useCallback(async () => {
		setLoading(true);
		const [statsRes, seniorsRes, caregiversRes, institutionsRes, plansRes] =
			await Promise.all([
				api_client.admin.dashboard.$get(),
				api_client.admin.seniors.$get(),
				api_client.admin.caregivers.$get(),
				api_client.admin.institutions.$get(),
				api_client.admin.plans.$get(),
			]);
		if (statsRes.ok)
			setStats((await statsRes.json()) as AdminDashboardResponse);
		if (seniorsRes.ok)
			setSeniors((await seniorsRes.json()) as SeniorAdminResponse[]);
		if (caregiversRes.ok)
			setCaregivers((await caregiversRes.json()) as CaregiverAdminResponse[]);
		if (institutionsRes.ok)
			setInstitutions((await institutionsRes.json()) as InstitutionResponse[]);
		if (plansRes.ok) setPlans((await plansRes.json()) as PlanResponse[]);
		setLoading(false);
	}, []);

	useEffect(() => {
		void loadAll();
	}, [loadAll]);

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			let res: Response;
			if (deleteTarget.type === "senior") {
				res = await api_client.admin.seniors[":seniorId"].$delete({
					param: { seniorId: deleteTarget.id },
				});
			} else if (deleteTarget.type === "caregiver") {
				res = await api_client.admin.caregivers[":caregiverId"].$delete({
					param: { caregiverId: deleteTarget.id },
				});
			} else {
				res = await api_client.admin.institutions[":institutionId"].$delete({
					param: { institutionId: deleteTarget.id },
				});
			}
			if (!res.ok) {
				toast.error(await readApiError(res, lang));
				return;
			}
			toast.success("Apagado com sucesso.");
			setDeleteTarget(null);
			void loadAll();
		} finally {
			setDeleting(false);
		}
	};

	const thStyle: CSSProperties = {
		color: "#1a5f5a",
		fontSize: 11,
		fontWeight: 600,
		textAlign: "left",
		padding: "8px 12px",
	};
	const tdStyle: CSSProperties = {
		padding: "9px 12px",
		color: "#3a7a70",
		fontSize: 13,
	};
	const tdBold: CSSProperties = {
		...tdStyle,
		color: "#1a2a2a",
		fontWeight: 500,
	};
	const rowBorder = "1px solid rgba(26,95,90,0.06)";

	const typeBadgeStyle = (type: "ipss" | "family"): CSSProperties => ({
		display: "inline-flex",
		fontSize: 10,
		fontWeight: 700,
		letterSpacing: "0.04em",
		textTransform: "uppercase",
		padding: "2px 8px",
		borderRadius: 999,
		background:
			type === "ipss" ? "rgba(45,191,160,0.12)" : "rgba(251,191,36,0.15)",
		color: type === "ipss" ? "#0a6a5a" : "#92610a",
		border: `1px solid ${type === "ipss" ? "rgba(45,191,160,0.25)" : "rgba(251,191,36,0.3)"}`,
		flexShrink: 0,
	});

	const unassignedSeniors = seniors.filter((s) => !s.organizationId);
	const unassignedCaregivers = caregivers.filter((c) => !c.organizationId);
	const hasUnassigned =
		unassignedSeniors.length > 0 || unassignedCaregivers.length > 0;

	const InstAccordion = ({ inst }: { inst: InstitutionResponse }) => {
		const instSeniors = seniors.filter((s) => s.organizationId === inst.id);
		const instCaregivers = caregivers.filter(
			(c) => c.organizationId === inst.id,
		);
		const isOpen = expandedId === inst.id;
		const total = instSeniors.length + instCaregivers.length;

		return (
			<div style={{ ...tableCard, overflow: "hidden" }}>
				<button
					type="button"
					onClick={() => setExpandedId(isOpen ? null : inst.id)}
					className="w-full flex items-center gap-3 text-left"
					style={{
						padding: "14px 18px",
						background: "none",
						border: "none",
						cursor: "pointer",
						transition: "background 150ms ease",
					}}
					onMouseEnter={(e) =>
						(e.currentTarget.style.background = "rgba(26,95,90,0.02)")
					}
					onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
				>
					<span style={typeBadgeStyle(inst.type)}>
						{inst.type === "ipss" ? "IPSS" : "Família"}
					</span>
					<span
						className="flex-1 font-semibold text-sm"
						style={{ color: "#1a2a2a" }}
					>
						{inst.designation}
					</span>
					{inst.location && (
						<span
							className="text-xs hidden sm:block"
							style={{ color: "#7aaa9a" }}
						>
							{inst.location}
						</span>
					)}
					<span className="text-xs shrink-0" style={{ color: "#9ab5b5" }}>
						{total} utilizadores
					</span>
					<button
						type="button"
						style={{ ...editBtnStyle, marginLeft: 2 }}
						onClick={(e) => {
							e.stopPropagation();
							setEditTarget({ type: "institution", data: inst });
						}}
						title="Editar"
					>
						<HiPencilSquare size={13} />
					</button>
					<button
						type="button"
						style={deleteBtnStyle}
						onClick={(e) => {
							e.stopPropagation();
							setDeleteTarget({
								type: "institution",
								id: inst.id,
								label: `Apagar "${inst.designation}" e todos os seus membros e dados? Esta acção é irreversível.`,
							});
						}}
						title="Apagar"
					>
						<HiTrash size={13} />
					</button>
					<HiChevronDown
						size={16}
						style={{
							color: "#1a5f5a",
							flexShrink: 0,
							transition: "transform 200ms ease",
							transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
						}}
					/>
				</button>

				{isOpen && (
					<div
						style={{
							borderTop: "1px solid rgba(26,95,90,0.08)",
							padding: "0 18px 16px",
						}}
					>
						{instSeniors.length > 0 && (
							<div style={{ marginTop: 14 }}>
								<p
									className="text-xs font-semibold mb-2 uppercase tracking-wide"
									style={{ color: "#1a5f5a" }}
								>
									Seniores ({instSeniors.length})
								</p>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[380px] text-sm">
										<thead>
											<tr style={{ borderBottom: rowBorder }}>
												{["Nome", "Data de nascimento", "Password", ""].map(
													(h) => (
														<th key={h} style={thStyle}>
															{h}
														</th>
													),
												)}
											</tr>
										</thead>
										<tbody>
											{instSeniors.map((s, i) => (
												<tr
													key={s.id}
													style={{
														borderBottom:
															i < instSeniors.length - 1
																? rowBorder
																: undefined,
													}}
												>
													<td style={tdBold}>{s.fullName}</td>
													<td style={tdStyle}>
														{s.birthDate ? s.birthDate.split("T")[0] : "—"}
													</td>
													<td
														style={{
															...tdStyle,
															fontFamily: "monospace",
															fontWeight: 600,
															color: "#1a5f5a",
															fontSize: 11,
														}}
													>
														{s.accessCode}
													</td>
													<td style={{ ...tdStyle, width: 72, whiteSpace: "nowrap" }}>
														<div className="flex gap-1">
															<button
																type="button"
																style={editBtnStyle}
																onClick={() =>
																	setEditTarget({ type: "senior", data: s })
																}
																title="Editar"
															>
																<HiPencilSquare size={13} />
															</button>
															<button
																type="button"
																style={deleteBtnStyle}
																onClick={() =>
																	setDeleteTarget({
																		type: "senior",
																		id: s.id,
																		label: `Apagar "${s.fullName}" e todos os seus dados? Esta acção é irreversível.`,
																	})
																}
																title="Apagar"
															>
																<HiTrash size={13} />
															</button>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
						{instCaregivers.length > 0 && (
							<div style={{ marginTop: 14 }}>
								<p
									className="text-xs font-semibold mb-2 uppercase tracking-wide"
									style={{ color: "#1a5f5a" }}
								>
									Cuidadores ({instCaregivers.length})
								</p>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[300px] text-sm">
										<thead>
											<tr style={{ borderBottom: rowBorder }}>
												{["Nome", "Email", ""].map((h) => (
													<th key={h} style={thStyle}>
														{h}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{instCaregivers.map((c, i) => (
												<tr
													key={c.id}
													style={{
														borderBottom:
															i < instCaregivers.length - 1
																? rowBorder
																: undefined,
													}}
												>
													<td style={tdBold}>{c.fullName}</td>
													<td style={tdStyle}>{c.email}</td>
													<td style={{ ...tdStyle, width: 72, whiteSpace: "nowrap" }}>
														<div className="flex gap-1">
															<button
																type="button"
																style={editBtnStyle}
																onClick={() =>
																	setEditTarget({ type: "caregiver", data: c })
																}
																title="Editar"
															>
																<HiPencilSquare size={13} />
															</button>
															<button
																type="button"
																style={deleteBtnStyle}
																onClick={() =>
																	setDeleteTarget({
																		type: "caregiver",
																		id: c.id,
																		label: `Apagar "${c.fullName}" e todos os seus dados? Esta acção é irreversível.`,
																	})
																}
																title="Apagar"
															>
																<HiTrash size={13} />
															</button>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
						{instSeniors.length === 0 && instCaregivers.length === 0 && (
							<p className="text-sm mt-4" style={{ color: "#9ab5b5" }}>
								Sem utilizadores atribuídos.
							</p>
						)}
					</div>
				)}
			</div>
		);
	};

	return (
		<PageShell lang={lang} onBack={onBack} wide>
			<style>{MS.keyframes}</style>

			<header
				className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
				style={{ marginBottom: 24 }}
			>
				<div>
					<p style={labelStyle}>Visão geral</p>
					<h1
						className="text-4xl font-light mt-2"
						style={{ color: "#111111", letterSpacing: "-0.8px", lineHeight: 1 }}
					>
						Dashboard
					</h1>
				</div>
				<p className="text-sm max-w-sm" style={{ color: "rgba(0,0,0,0.62)" }}>
					Consulta e edita os registos principais da plataforma num só lugar.
				</p>
			</header>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
				{[
					{
						label: "Seniores",
						value: stats?.totalSeniors,
						icon: <HiUser size={28} />,
					},
					{
						label: "Cuidadores",
						value: stats?.totalCaregivers,
						icon: <HiUsers size={28} />,
					},
					{
						label: "Registadas",
						value: stats?.totalInstitutions,
						icon: <HiBuildingOffice2 size={28} />,
					},
				].map(({ label, value, icon }) => (
					<div
						key={label}
						className="px-6 py-5 flex items-center gap-4"
						style={softPanelCard}
					>
						<div
							className="flex items-center justify-center rounded-xl shrink-0"
							style={{
								width: 52,
								height: 52,
								backgroundColor: "rgba(45,191,160,0.12)",
								color: "#0a4a45",
							}}
						>
							{icon}
						</div>
						<div>
							<p
								className="text-3xl font-light"
								style={{ color: "#111111", lineHeight: 1 }}
							>
								{loading ? "—" : (value ?? "—")}
							</p>
							<p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.58)" }}>
								{label}
							</p>
						</div>
					</div>
				))}
			</div>

			{loading && (
				<div className="flex justify-center py-10">
					<span
						className="loading loading-spinner loading-md"
						style={{ color: "#1a5f5a" }}
					/>
				</div>
			)}

			{!loading && (
				<div className="flex flex-col gap-3">
					<h2
						className="text-base font-semibold mb-1"
						style={{ color: "#1a2a2a" }}
					>
						Instituições e famílias ({institutions.length})
					</h2>
					{institutions.length === 0 && (
						<p className="text-sm" style={{ color: "#3a7a70" }}>
							Nenhuma instituição registada.
						</p>
					)}
					{institutions.map((inst) => (
						<InstAccordion key={inst.id} inst={inst} />
					))}

					{hasUnassigned && (
						<div style={{ ...tableCard, marginTop: 4 }}>
							<button
								type="button"
								onClick={() =>
									setExpandedId(
										expandedId === "__unassigned" ? null : "__unassigned",
									)
								}
								className="w-full flex items-center gap-3 text-left"
								style={{
									padding: "14px 18px",
									background: "none",
									border: "none",
									cursor: "pointer",
								}}
							>
								<span
									style={{
										display: "inline-flex",
										fontSize: 10,
										fontWeight: 700,
										letterSpacing: "0.04em",
										textTransform: "uppercase",
										padding: "2px 8px",
										borderRadius: 999,
										background: "rgba(107,114,128,0.1)",
										color: "#6b7280",
										border: "1px solid rgba(107,114,128,0.2)",
										flexShrink: 0,
									}}
								>
									Sem grupo
								</span>
								<span
									className="flex-1 font-semibold text-sm"
									style={{ color: "#1a2a2a" }}
								>
									Utilizadores sem grupo
								</span>
								<span className="text-xs shrink-0" style={{ color: "#9ab5b5" }}>
									{unassignedSeniors.length + unassignedCaregivers.length}{" "}
									utilizadores
								</span>
								<HiChevronDown
									size={16}
									style={{
										color: "#1a5f5a",
										flexShrink: 0,
										transition: "transform 200ms ease",
										transform:
											expandedId === "__unassigned"
												? "rotate(180deg)"
												: "rotate(0deg)",
									}}
								/>
							</button>
							{expandedId === "__unassigned" && (
								<div
									style={{
										borderTop: "1px solid rgba(26,95,90,0.08)",
										padding: "0 18px 16px",
									}}
								>
									{unassignedSeniors.length > 0 && (
										<div style={{ marginTop: 14 }}>
											<p
												className="text-xs font-semibold mb-2 uppercase tracking-wide"
												style={{ color: "#1a5f5a" }}
											>
												Seniores ({unassignedSeniors.length})
											</p>
											{unassignedSeniors.map((s, i) => (
												<div
													key={s.id}
													className="flex items-center justify-between py-2"
													style={{
														borderBottom:
															i < unassignedSeniors.length - 1
																? rowBorder
																: undefined,
													}}
												>
													<span
														className="text-sm font-medium"
														style={{ color: "#1a2a2a" }}
													>
														{s.fullName}
													</span>
													<div className="flex gap-1">
														<button
															type="button"
															style={editBtnStyle}
															onClick={() =>
																setEditTarget({ type: "senior", data: s })
															}
														>
															<HiPencilSquare size={13} />
														</button>
														<button
															type="button"
															style={deleteBtnStyle}
															onClick={() =>
																setDeleteTarget({
																	type: "senior",
																	id: s.id,
																	label: `Apagar "${s.fullName}" e todos os seus dados? Esta acção é irreversível.`,
																})
															}
														>
															<HiTrash size={13} />
														</button>
													</div>
												</div>
											))}
										</div>
									)}
									{unassignedCaregivers.length > 0 && (
										<div style={{ marginTop: 14 }}>
											<p
												className="text-xs font-semibold mb-2 uppercase tracking-wide"
												style={{ color: "#1a5f5a" }}
											>
												Cuidadores ({unassignedCaregivers.length})
											</p>
											{unassignedCaregivers.map((c, i) => (
												<div
													key={c.id}
													className="flex items-center justify-between py-2"
													style={{
														borderBottom:
															i < unassignedCaregivers.length - 1
																? rowBorder
																: undefined,
													}}
												>
													<span
														className="text-sm font-medium"
														style={{ color: "#1a2a2a" }}
													>
														{c.fullName}
													</span>
													<div className="flex gap-1">
														<button
															type="button"
															style={editBtnStyle}
															onClick={() =>
																setEditTarget({ type: "caregiver", data: c })
															}
														>
															<HiPencilSquare size={13} />
														</button>
														<button
															type="button"
															style={deleteBtnStyle}
															onClick={() =>
																setDeleteTarget({
																	type: "caregiver",
																	id: c.id,
																	label: `Apagar "${c.fullName}" e todos os seus dados? Esta acção é irreversível.`,
																})
															}
														>
															<HiTrash size={13} />
														</button>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{plans.length > 0 && (
				<div className="flex flex-col gap-3 mt-6">
					<h2
						className="text-base font-semibold mb-1"
						style={{ color: "#1a2a2a" }}
					>
						Planos ({plans.length})
					</h2>
					<div style={{ ...tableCard, overflow: "hidden" }}>
						<table className="w-full text-sm">
							<thead>
								<tr style={{ borderBottom: "1px solid rgba(26,95,90,0.08)" }}>
									{["Nome", "Máx. seniores", "Máx. minutos/mês"].map((h) => (
										<th key={h} style={thStyle}>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{plans.map((p, i) => (
									<tr
										key={p.id}
										style={{
											borderBottom:
												i < plans.length - 1
													? "1px solid rgba(26,95,90,0.06)"
													: undefined,
										}}
									>
										<td
											style={{ ...tdStyle, color: "#1a2a2a", fontWeight: 500 }}
										>
											{p.name}
										</td>
										<td style={tdStyle}>{p.maxSeniors ?? "Ilimitado"}</td>
										<td style={tdStyle}>
											{p.maxTalkingMinutesPerMonth ?? "Ilimitado"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{editTarget && (
				<EditModal
					lang={lang}
					target={editTarget}
					institutions={institutions}
					onClose={() => setEditTarget(null)}
					onSaved={() => void loadAll()}
				/>
			)}
			{deleteTarget && (
				<DeleteConfirmModal
					label={deleteTarget.label}
					loading={deleting}
					onConfirm={() => void handleDelete()}
					onClose={() => setDeleteTarget(null)}
				/>
			)}
		</PageShell>
	);
}

// ── Route component ────────────────────────────────────────────────────────
function RouteComponent() {
	const { lang } = Route.useParams();
	const { session } = useSessionStore();
	const adminName = session?.user.name ?? "Admin";
	const setPageBackground = usePageBackgroundStore((s) => s.setBackground);
	const setHideFooter = usePageBackgroundStore((s) => s.setHideFooter);
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);
	const effectiveBackground = globalBackground ?? BG;

	useEffect(() => {
		setPageBackground(effectiveBackground);
		setHideFooter(true);
		return () => {
			setPageBackground(null);
			setHideFooter(false);
		};
	}, [effectiveBackground, setPageBackground, setHideFooter]);

	const [view, setView] = useState<View>("home");
	const [institutions, setInstitutions] = useState<InstitutionResponse[]>([]);
	const [plans, setPlans] = useState<PlanResponse[]>([]);
	const [submitting, setSubmitting] = useState(false);

	const [caregiverForm, setCaregiverForm] =
		useState<CaregiverForm>(emptyCaregiverForm);
	const [seniorForm, setSeniorForm] = useState<SeniorForm>(emptySeniorForm);
	const [institutionForm, setInstitutionForm] =
		useState<InstitutionForm>(emptyInstitutionForm);
	const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);

	useEffect(() => {
		const load = async () => {
			const [instRes, plansRes] = await Promise.all([
				api_client.admin.institutions.$get(),
				api_client.admin.plans.$get(),
			]);
			if (instRes.ok)
				setInstitutions((await instRes.json()) as InstitutionResponse[]);
			if (plansRes.ok) setPlans((await plansRes.json()) as PlanResponse[]);
		};
		void load();
	}, []);

	const institutionOptions = institutions.map((i) => ({
		value: i.id,
		label: i.designation,
	}));

	const planOptions = plans.map((p) => ({
		value: p.id,
		label: p.name,
	}));

	const submitCaregiver = async () => {
		setSubmitting(true);
		const res = await api_client.admin.caregivers.$post({
			json: {
				...caregiverForm,
				institutionId: caregiverForm.institutionId || undefined,
			},
		});
		setSubmitting(false);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Cuidador registado com sucesso.");
		setCaregiverForm(emptyCaregiverForm);
		setView("home");
	};

	const submitSenior = async () => {
		setSubmitting(true);
		const res = await api_client.admin.seniors.$post({
			json: {
				fullName: seniorForm.fullName,
				gender: seniorForm.gender as "m" | "f",
				birthDate: new Date(seniorForm.birthDate).toISOString(),
				institutionId: seniorForm.institutionId || undefined,
			},
		});
		setSubmitting(false);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Sénior registado com sucesso.");
		setSeniorForm(emptySeniorForm);
		setView("home");
	};

	const submitInstitution = async () => {
		setSubmitting(true);
		const res = await api_client.admin.institutions.$post({
			json: {
				type: institutionForm.type,
				designation: institutionForm.designation,
				location: institutionForm.location || undefined,
				planId: institutionForm.planId || undefined,
			},
		});
		setSubmitting(false);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success(
			institutionForm.type === "family"
				? "Agregado registado com sucesso."
				: "IPSS registada com sucesso.",
		);
		setInstitutionForm(emptyInstitutionForm);
		const updated = await api_client.admin.institutions.$get();
		if (updated.ok)
			setInstitutions((await updated.json()) as InstitutionResponse[]);
		setView("home");
	};

	const submitPlan = async () => {
		setSubmitting(true);
		const res = await api_client.admin.plans.$post({
			json: {
				name: planForm.name.trim(),
				maxSeniors: planForm.maxSeniors
					? Number(planForm.maxSeniors)
					: undefined,
				maxTalkingMinutesPerMonth: planForm.maxTalkingMinutesPerMonth
					? Number(planForm.maxTalkingMinutesPerMonth)
					: undefined,
			},
		});
		setSubmitting(false);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		toast.success("Plano criado com sucesso.");
		setPlanForm(emptyPlanForm);
		const updatedPlans = await api_client.admin.plans.$get();
		if (updatedPlans.ok)
			setPlans((await updatedPlans.json()) as PlanResponse[]);
		setView("home");
	};

	if (view === "dashboard") {
		return <DashboardView lang={lang} onBack={() => setView("home")} />;
	}

	if (view === "register-plan") {
		const valid = planForm.name.trim().length > 0;
		return (
			<PageShell lang={lang} onBack={() => setView("home")}>
				<FormCard
					title="Criar plano"
					subtitle="Define os limites do plano. Deixa em branco para ilimitado."
				>
					<FormInput
						label="Nome do plano"
						placeholder="Ex: efanor"
						value={planForm.name}
						onChange={(v) => setPlanForm((f) => ({ ...f, name: v }))}
					/>
					<FormInput
						label="Máximo de seniores (opcional)"
						type="number"
						placeholder="Sem limite"
						value={planForm.maxSeniors}
						onChange={(v) => setPlanForm((f) => ({ ...f, maxSeniors: v }))}
					/>
					<FormInput
						label="Máximo de minutos por mês (opcional)"
						type="number"
						placeholder="Sem limite"
						value={planForm.maxTalkingMinutesPerMonth}
						onChange={(v) =>
							setPlanForm((f) => ({ ...f, maxTalkingMinutesPerMonth: v }))
						}
					/>
					<button
						type="button"
						onClick={() => void submitPlan()}
						disabled={!valid || submitting}
						className="w-full rounded-xl py-3.5 text-sm font-semibold mt-2 transition-opacity hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
						style={{ backgroundColor: "#1a5f5a", color: "#fff" }}
					>
						{submitting ? "A criar..." : "Criar plano"}
					</button>
				</FormCard>
			</PageShell>
		);
	}

	if (view === "register-caregiver") {
		const passwordsMatch =
			caregiverForm.password === caregiverForm.confirmPassword;
		const valid =
			caregiverForm.email.trim() &&
			caregiverForm.password.trim() &&
			caregiverForm.confirmPassword.trim() &&
			caregiverForm.fullName.trim() &&
			passwordsMatch;
		return (
			<PageShell lang={lang} onBack={() => setView("home")}>
				<FormCard
					title="Registo de cuidador"
					subtitle="Preenche os dados abaixo para registar um novo cuidador na IPSS."
				>
					<FormInput
						label="Nome completo"
						placeholder="Nome completo"
						value={caregiverForm.fullName}
						onChange={(v) => setCaregiverForm((f) => ({ ...f, fullName: v }))}
					/>
					<FormInput
						label="Email"
						type="email"
						placeholder="email@exemplo.pt"
						value={caregiverForm.email}
						onChange={(v) => setCaregiverForm((f) => ({ ...f, email: v }))}
					/>
					<div className="flex flex-col gap-1">
						<FormInput
							label="Palavra-passe"
							type="password"
							placeholder="••••••••"
							value={caregiverForm.password}
							onChange={(v) => setCaregiverForm((f) => ({ ...f, password: v }))}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<FormInput
							label="Confirmar palavra-passe"
							type="password"
							placeholder="••••••••"
							value={caregiverForm.confirmPassword}
							onChange={(v) =>
								setCaregiverForm((f) => ({ ...f, confirmPassword: v }))
							}
						/>
						{caregiverForm.confirmPassword.length > 0 && !passwordsMatch && (
							<p className="text-xs mt-1" style={{ color: "#b85c5c" }}>
								As palavras-passe não coincidem.
							</p>
						)}
					</div>
					<FormSelect
						label="Instituição / Família"
						value={caregiverForm.institutionId}
						onChange={(v) =>
							setCaregiverForm((f) => ({ ...f, institutionId: v }))
						}
						options={institutionOptions}
						emptyLabel="Selecionar grupo"
					/>
					<button
						type="button"
						onClick={() => void submitCaregiver()}
						disabled={!valid || submitting}
						className="w-full rounded-xl py-3.5 text-sm font-semibold mt-2 transition-opacity hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
						style={{ backgroundColor: "#1a5f5a", color: "#fff" }}
					>
						{submitting ? "A registar..." : "Registar cuidador"}
					</button>
				</FormCard>
			</PageShell>
		);
	}

	if (view === "register-senior") {
		const valid =
			seniorForm.fullName.trim() && seniorForm.gender && seniorForm.birthDate;
		return (
			<PageShell lang={lang} onBack={() => setView("home")}>
				<FormCard
					title="Registar sénior"
					subtitle="Preenche os dados básicos do sénior que queres registar."
				>
					<FormInput
						label="Nome completo"
						placeholder="Nome completo"
						value={seniorForm.fullName}
						onChange={(v) => setSeniorForm((f) => ({ ...f, fullName: v }))}
					/>
					<FormSelect
						label="Género"
						value={seniorForm.gender}
						onChange={(v) => setSeniorForm((f) => ({ ...f, gender: v }))}
						options={genderOptions}
						emptyLabel="Selecionar género"
					/>
					<FormInput
						label="Data de nascimento"
						type="date"
						value={seniorForm.birthDate}
						onChange={(v) => setSeniorForm((f) => ({ ...f, birthDate: v }))}
					/>
					<FormSelect
						label="Instituição / Família"
						value={seniorForm.institutionId}
						onChange={(v) => setSeniorForm((f) => ({ ...f, institutionId: v }))}
						options={institutionOptions}
						emptyLabel="Selecionar grupo"
					/>
					<button
						type="button"
						onClick={() => void submitSenior()}
						disabled={!valid || submitting}
						className="w-full rounded-xl py-3.5 text-sm font-semibold mt-2 transition-opacity hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
						style={{ backgroundColor: "#1a5f5a", color: "#fff" }}
					>
						{submitting ? "A registar..." : "Registar sénior"}
					</button>
				</FormCard>
			</PageShell>
		);
	}

	if (view === "choose-institution-type") {
		return (
			<PageShell lang={lang} onBack={() => setView("home")}>
				<div>
					<p style={labelStyle}>Registar</p>
					<h1
						className="text-4xl font-light mt-3"
						style={{ color: "#111111", letterSpacing: "-0.8px", lineHeight: 1 }}
					>
						Que tipo de registo?
					</h1>
					<p className="text-base mt-3" style={{ color: "rgba(0,0,0,0.62)" }}>
						Escolhe o tipo de grupo que queres adicionar ao sistema.
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
						<button
							type="button"
							onClick={() => {
								setInstitutionForm((f) => ({ ...f, type: "ipss" }));
								setView("register-institution");
							}}
							className="p-7 flex flex-col items-start gap-4 text-left transition hover:opacity-90 active:scale-[0.985]"
							style={{ ...softPanelCard, cursor: "pointer" }}
						>
							<div
								className="flex items-center justify-center"
								style={{
									width: 52,
									height: 52,
									borderRadius: 18,
									background: "rgba(45,191,160,0.12)",
									color: "#0a4a45",
								}}
							>
								<HiBuildingOffice2 size={26} />
							</div>
							<div>
								<p
									className="text-lg font-semibold"
									style={{ color: "#111111" }}
								>
									Instituição / IPSS
								</p>
								<p
									className="text-sm mt-1"
									style={{ color: "rgba(0,0,0,0.58)" }}
								>
									Centro de dia, lar, IPSS ou outra organização de cuidados.
								</p>
							</div>
						</button>
						<button
							type="button"
							onClick={() => {
								setInstitutionForm((f) => ({ ...f, type: "family" }));
								setView("register-institution");
							}}
							className="p-7 flex flex-col items-start gap-4 text-left transition hover:opacity-90 active:scale-[0.985]"
							style={{ ...softPanelCard, cursor: "pointer" }}
						>
							<div
								className="flex items-center justify-center"
								style={{
									width: 52,
									height: 52,
									borderRadius: 18,
									background: "rgba(251,191,36,0.13)",
									color: "#92610a",
								}}
							>
								<HiHome size={26} />
							</div>
							<div>
								<p
									className="text-lg font-semibold"
									style={{ color: "#111111" }}
								>
									Agregado familiar
								</p>
								<p
									className="text-sm mt-1"
									style={{ color: "rgba(0,0,0,0.58)" }}
								>
									Família privada com idosos e cuidador associado.
								</p>
							</div>
						</button>
					</div>
				</div>
			</PageShell>
		);
	}

	if (view === "register-institution") {
		const isFamily = institutionForm.type === "family";
		const valid = institutionForm.designation.trim();
		return (
			<PageShell lang={lang} onBack={() => setView("choose-institution-type")}>
				<FormCard
					title={isFamily ? "Registar agregado familiar" : "Registar nova IPSS"}
					subtitle={
						isFamily
							? "Preenche os dados da família que queres adicionar ao sistema."
							: "Preenche os dados da instituição que queres adicionar ao sistema."
					}
				>
					<FormInput
						label={isFamily ? "Nome da família" : "Nome da instituição"}
						placeholder={isFamily ? "Ex: Família Silva" : "Nome da IPSS"}
						value={institutionForm.designation}
						onChange={(v) =>
							setInstitutionForm((f) => ({ ...f, designation: v }))
						}
					/>
					<FormInput
						label={isFamily ? "Morada" : "Localização"}
						placeholder={
							isFamily ? "Morada (opcional)" : "Localização (opcional)"
						}
						value={institutionForm.location}
						onChange={(v) => setInstitutionForm((f) => ({ ...f, location: v }))}
					/>
					{planOptions.length > 0 && (
						<FormSelect
							label="Plano (opcional)"
							value={institutionForm.planId}
							onChange={(v) => setInstitutionForm((f) => ({ ...f, planId: v }))}
							options={planOptions}
							emptyLabel="Sem plano"
						/>
					)}
					<button
						type="button"
						onClick={() => void submitInstitution()}
						disabled={!valid || submitting}
						className="w-full rounded-xl py-3.5 text-sm font-semibold mt-2 transition-opacity hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
						style={{ backgroundColor: "#1a5f5a", color: "#fff" }}
					>
						{submitting
							? "A registar..."
							: isFamily
								? "Registar família"
								: "Registar IPSS"}
					</button>
				</FormCard>
			</PageShell>
		);
	}

	// ── Home ─────────────────────────────────────────────────────────────────
	return (
		<PageShell
			lang={lang}
			wide
			subheader={
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p style={labelStyle}>Painel administrativo</p>
						<h1
							className="text-5xl font-light mt-3"
							style={{
								color: "#111111",
								letterSpacing: "-1px",
								lineHeight: 0.96,
							}}
						>
							Olá, {adminName}
						</h1>
						<p
							className="text-base mt-3 max-w-xl"
							style={{ color: "rgba(0,0,0,0.62)" }}
						>
							Gere seniores, cuidadores e IPSS com uma vista simples e
							organizada.
						</p>
					</div>
					<div
						className="self-start lg:self-end"
						style={{
							borderRadius: 999,
							border: "1px solid rgba(33,91,88,0.14)",
							background: "rgba(255,255,255,0.72)",
							padding: "9px 14px",
							color: "#0a4a45",
							fontSize: 12,
							fontWeight: 600,
							boxShadow: "0 10px 24px rgba(31,80,73,0.06)",
						}}
					>
						{institutions.length}{" "}
						{institutions.length === 1 ? "registada" : "registadas"}
					</div>
				</div>
			}
		>
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4">
				<button
					type="button"
					onClick={() => setView("dashboard")}
					className="w-full p-8 sm:p-10 flex flex-col items-start justify-between gap-8 text-left transition hover:opacity-90 active:scale-[0.985]"
					style={{ ...softPanelCard, minHeight: 340, cursor: "pointer" }}
				>
					<div className="flex items-start justify-between gap-4 w-full">
						<div
							className="flex items-center justify-center shrink-0"
							style={{
								width: 56,
								height: 56,
								borderRadius: 18,
								background: "rgba(45,191,160,0.12)",
								color: "#0a4a45",
							}}
						>
							<HiChartBar size={30} />
						</div>
						<span
							style={{
								color: "#0a4a45",
								background: "rgba(45,191,160,0.12)",
								borderRadius: 999,
								padding: "7px 12px",
								fontSize: 12,
								fontWeight: 700,
							}}
						>
							Abrir
						</span>
					</div>
					<div>
						<p style={labelStyle}>Dashboard</p>
						<h2
							className="text-4xl font-light mt-3"
							style={{
								color: "#111111",
								letterSpacing: "-0.8px",
								lineHeight: 1,
							}}
						>
							Ver toda a atividade
						</h2>
						<p
							className="text-sm mt-4 max-w-md"
							style={{ color: "rgba(0,0,0,0.62)" }}
						>
							Consulta seniores, cuidadores e IPSS registadas, com edição rápida
							quando precisares.
						</p>
					</div>
				</button>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
					<button
						type="button"
						onClick={() => setView("register-senior")}
						className="p-6 flex items-center gap-4 text-left transition hover:opacity-90 active:scale-[0.985]"
						style={glassBtnCard}
					>
						<div
							className="flex items-center justify-center shrink-0"
							style={{
								width: 48,
								height: 48,
								borderRadius: 16,
								background: "rgba(45,191,160,0.12)",
								color: "#0a4a45",
							}}
						>
							<HiUserPlus size={25} />
						</div>
						<div>
							<p
								className="text-base font-semibold"
								style={{ color: "#111111" }}
							>
								Registar sénior
							</p>
							<p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.58)" }}>
								Criar acesso e associar a uma IPSS.
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => setView("register-caregiver")}
						className="p-6 flex items-center gap-4 text-left transition hover:opacity-90 active:scale-[0.985]"
						style={glassBtnCard}
					>
						<div
							className="flex items-center justify-center shrink-0"
							style={{
								width: 48,
								height: 48,
								borderRadius: 16,
								background: "rgba(45,191,160,0.12)",
								color: "#0a4a45",
							}}
						>
							<HiUserGroup size={25} />
						</div>
						<div>
							<p
								className="text-base font-semibold"
								style={{ color: "#111111" }}
							>
								Registar cuidador
							</p>
							<p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.58)" }}>
								Adicionar utilizador para acompanhar seniores.
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => setView("register-plan")}
						className="p-6 flex items-center gap-4 text-left transition hover:opacity-90 active:scale-[0.985]"
						style={glassBtnCard}
					>
						<div
							className="flex items-center justify-center shrink-0"
							style={{
								width: 48,
								height: 48,
								borderRadius: 16,
								background: "rgba(45,191,160,0.12)",
								color: "#0a4a45",
							}}
						>
							<HiChartBar size={24} />
						</div>
						<div>
							<p
								className="text-base font-semibold"
								style={{ color: "#111111" }}
							>
								Criar plano
							</p>
							<p className="text-xs mt-1" style={{ color: "rgba(0,0,0,0.58)" }}>
								Definir limites de seniores e tempo de uso.
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => setView("choose-institution-type")}
						className="p-6 flex items-center gap-4 text-left transition hover:opacity-90 active:scale-[0.985] sm:col-span-2 lg:col-span-1"
						style={{ ...primaryButtonStyle, minHeight: 108 }}
					>
						<div
							className="flex items-center justify-center shrink-0"
							style={{
								width: 48,
								height: 48,
								borderRadius: 16,
								background: "rgba(255,255,255,0.12)",
								color: "#dff5f3",
							}}
						>
							<HiBuildingOffice2 size={26} />
						</div>
						<div>
							<p
								className="text-base font-semibold"
								style={{ color: "#ffffff" }}
							>
								Registar
							</p>
							<p
								className="text-xs mt-1"
								style={{ color: "rgba(255,255,255,0.72)" }}
							>
								Adicionar IPSS ou agregado familiar ao sistema.
							</p>
						</div>
					</button>
				</div>
			</div>
		</PageShell>
	);
}
