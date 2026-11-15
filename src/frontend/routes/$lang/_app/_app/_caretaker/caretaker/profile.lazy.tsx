import { createLazyFileRoute, useRouter } from "@tanstack/react-router";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HiArrowLeft, HiCheck, HiMiniUserCircle } from "react-icons/hi2";
import { toast } from "react-toastify";
import { api_client } from "@/frontend/utils/api";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { useSessionStore } from "@/frontend/stores/session";
import { readApiError } from "@/frontend/utils/apiErrors";
import { DS } from "@/frontend/designSystem";
import { LoginShapeBackground } from "@/frontend/components/ui/shape-landing-background";
import type { CaregiverInstitutionResponse } from "@/shared/contracts";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/profile",
)({
	component: RouteComponent,
});

// ── Constants ──────────────────────────────────────────────────────────────

const HEADER_BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";

const BODY_BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.32) 0%, rgba(255,252,226,0.16) 24%, rgba(255,252,226,0.04) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.22) 0%, rgba(185,235,220,0.10) 18%, rgba(185,235,220,0.03) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffefb 0%, #ffffff 52%, #f8fefb 100%)";

const SF =
	'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
const SF_TEXT =
	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

const C = {
	text: DS.C.text,
	textSub: DS.C.textSub,
	textMuted: DS.C.textMuted,
	teal: "#2DBFA0",
	tealDark: DS.C.teal700,
	border: "rgba(26,95,90,0.12)",
	divider: "rgba(26,95,90,0.07)",
	surface: "rgba(255,255,255,0.88)",
	chip: "rgba(45,191,160,0.10)",
	chipText: DS.C.teal700,
	alert: "#7a3010",
	alertBg: "rgba(215,120,60,0.06)",
	alertBorder: "rgba(215,120,60,0.25)",
	cardBorder: "rgba(17,75,69,0.12)",
};

// ── Types ──────────────────────────────────────────────────────────────────

type CaregiverProfileForm = {
	fullName: string;
	email: string;
};

// ── Utilities ──────────────────────────────────────────────────────────────

function initialsFromName(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

// ── Design primitives ──────────────────────────────────────────────────────

function Divider() {
	return <div style={{ height: 1, background: C.divider, margin: "32px 0" }} />;
}

function SectionHeader({
	title,
	subtitle,
}: { title: string; subtitle?: string }) {
	return (
		<div style={{ marginBottom: 20 }}>
			<h3
				style={{
					margin: 0,
					fontSize: 15,
					fontWeight: 700,
					letterSpacing: "-0.01em",
					color: C.text,
				}}
			>
				{title}
			</h3>
			{subtitle && (
				<p
					style={{
						margin: "4px 0 0",
						fontSize: 13,
						lineHeight: 1.5,
						color: C.textMuted,
					}}
				>
					{subtitle}
				</p>
			)}
		</div>
	);
}

function FormRow({
	label,
	last,
	children,
}: { label: string; last?: boolean; children: ReactNode }) {
	return (
		<div
			className="grid grid-cols-1 gap-2 sm:grid-cols-[156px_1fr] sm:items-start sm:gap-4"
			style={{
				padding: "13px 0",
				borderBottom: last ? "none" : `1px solid ${C.divider}`,
			}}
		>
			<span
				style={{
					fontSize: 13,
					fontWeight: 600,
					color: C.textSub,
					paddingTop: 10,
					lineHeight: 1.3,
				}}
			>
				{label}
			</span>
			<div>{children}</div>
		</div>
	);
}

function ReadOnlyValue({
	value,
	placeholder = "Não definido",
}: { value: string; placeholder?: string }) {
	return (
		<div
			aria-readonly="true"
			style={{
				width: "100%",
				borderRadius: DS.radius.md,
				border: `1px solid ${C.border}`,
				background: "rgba(255,255,255,0.54)",
				color: value ? C.textSub : C.textMuted,
				padding: "10px 14px",
				fontSize: 14,
				lineHeight: "20px",
				boxSizing: "border-box",
			}}
		>
			{value || placeholder}
		</div>
	);
}

function StyledInput(props: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			{...props}
			style={{
				width: "100%",
				borderRadius: DS.radius.md,
				border: `1px solid ${C.border}`,
				background: "rgba(255,255,255,0.9)",
				color: C.text,
				padding: "10px 14px",
				fontSize: 14,
				outline: "none",
				transition: DS.transition.fast,
				boxSizing: "border-box",
				...(props.style ?? {}),
			}}
		/>
	);
}

// ── Main component ─────────────────────────────────────────────────────────

function RouteComponent() {
	const { lang } = Route.useParams();
	const router = useRouter();
	const setPageBackground = usePageBackgroundStore((s) => s.setBackground);
	const setHideFooter = usePageBackgroundStore((s) => s.setHideFooter);
	const shouldReduce = useReducedMotion() ?? false;
	const { session, refreshSession } = useSessionStore();

	const [institution, setInstitution] =
		useState<CaregiverInstitutionResponse | null>(null);
	const [loadingInstitution, setLoadingInstitution] = useState(true);

	const initialForm = useMemo<CaregiverProfileForm>(
		() => ({
			fullName: session?.user.name ?? "",
			email: session?.user.email ?? "",
		}),
		[session?.user.name, session?.user.email],
	);

	const [form, setForm] = useState<CaregiverProfileForm>(initialForm);
	const [saving, setSaving] = useState(false);
	const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
	const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
	const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(
		null,
	);

	useEffect(() => {
		setPageBackground(null);
		setHideFooter(true);
		return () => {
			setHideFooter(false);
		};
	}, [setHideFooter, setPageBackground]);

	useEffect(() => {
		const load = async () => {
			setLoadingInstitution(true);
			const res = await api_client.caregiver.institution.$get();
			if (res.ok) {
				const payload = (await res.json()) as CaregiverInstitutionResponse;
				setInstitution(payload);
			}
			setLoadingInstitution(false);
		};
		void load();
	}, []);

	// Sync form when session loads
	useEffect(() => {
		if (session) {
			setForm({
				fullName: session.user.name ?? "",
				email: session.user.email ?? "",
			});
		}
	}, [session]);

	// Auto-dismiss success feedback
	useEffect(() => {
		if (!saveFeedback) return;
		const timer = setTimeout(() => setSaveFeedback(null), 3000);
		return () => clearTimeout(timer);
	}, [saveFeedback]);

	const isDirty = useMemo(() => {
		return (
			form.fullName !== initialForm.fullName || form.email !== initialForm.email
		);
	}, [form, initialForm]);

	const saveProfile = async () => {
		if (!form.fullName.trim() || !form.email.trim()) {
			setSaveFeedback("Nome e email são obrigatórios.");
			return;
		}
		setSaving(true);
		setSaveFeedback(null);

		const res = await api_client.caregiver.profile.$patch({
			json: { fullName: form.fullName.trim(), email: form.email.trim() },
		});

		if (!res.ok) {
			setSaveFeedback(await readApiError(res, lang));
			setSaving(false);
			return;
		}

		try {
			await refreshSession(true);
			setSaveFeedback("Perfil atualizado com sucesso.");
		} catch {
			setSaveFeedback("Guardado, mas não foi possível atualizar a sessão.");
		} finally {
			setSaving(false);
		}
	};

	const navigateBack = () =>
		router.navigate({ to: "/$lang/caretaker", params: { lang } });

	const goBack = () => {
		if (isDirty) {
			setPendingNavigate(() => navigateBack);
			setConfirmLeaveOpen(true);
		} else {
			navigateBack();
		}
	};

	const isSuccess = !!(
		saveFeedback?.includes("sucesso") || saveFeedback?.includes("guardado")
	);

	const profileInitials = initialsFromName(
		form.fullName || session?.user.name || "",
	);

	const institutionTypeLabel = institution
		? institution.type === "ipss"
			? "IPSS"
			: "Família"
		: null;

	return (
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* ── Header ──────────────────────────────────────────────────────── */}
			<div
				style={{ background: HEADER_BG, position: "relative", flexShrink: 0 }}
			>
				<LoginShapeBackground />
				<div
					style={{ position: "relative", zIndex: 1 }}
					className="px-5 sm:px-10 xl:px-14"
				>
					{/* Back button */}
					<div style={{ paddingTop: 18, paddingBottom: 0 }}>
						<button
							type="button"
							onClick={goBack}
							className="flex items-center gap-1.5 transition-opacity hover:opacity-70 active:scale-[0.97]"
							style={{
								background: "none",
								border: "none",
								padding: 0,
								cursor: "pointer",
								color: C.textSub,
								fontSize: 13,
								fontWeight: 500,
							}}
						>
							<HiArrowLeft size={14} />
							Voltar ao dashboard
						</button>
					</div>

					{/* Header main row */}
					<div className="flex flex-col gap-4 pb-7 pt-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-4">
							{/* Avatar */}
							<div
								style={{
									width: 76,
									height: 76,
									borderRadius: "50%",
									overflow: "hidden",
									border: "3px solid rgba(255,255,255,0.9)",
									boxShadow: "0 4px 20px rgba(10,74,69,0.18)",
									background:
										"linear-gradient(180deg, rgba(45,191,160,0.18) 0%, rgba(255,252,226,0.6) 100%)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}
							>
								{profileInitials ? (
									<span
										style={{ fontSize: 24, fontWeight: 700, color: C.tealDark }}
									>
										{profileInitials}
									</span>
								) : (
									<HiMiniUserCircle
										size={40}
										style={{ color: C.tealDark, opacity: 0.45 }}
									/>
								)}
							</div>

							{/* Name + role */}
							<div className="flex flex-col gap-1">
								<h1
									style={{
										margin: 0,
										fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
										fontWeight: 600,
										letterSpacing: "-0.03em",
										lineHeight: 1.1,
										color: C.text,
									}}
								>
									{form.fullName || "O meu perfil"}
								</h1>
								<p style={{ margin: 0, fontSize: 14, color: C.textSub }}>
									{form.email}
								</p>
								{institutionTypeLabel && !loadingInstitution && (
									<div
										className="flex flex-wrap items-center gap-2"
										style={{ marginTop: 2 }}
									>
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												borderRadius: DS.radius.full,
												border: `1px solid rgba(45,191,160,0.22)`,
												background: C.chip,
												color: C.chipText,
												padding: "3px 10px",
												fontSize: 12,
												fontWeight: 600,
											}}
										>
											{institutionTypeLabel}
											{institution?.designation
												? ` · ${institution.designation}`
												: ""}
										</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ── Body ────────────────────────────────────────────────────────── */}
			<div style={{ flex: 1, overflowY: "auto", background: BODY_BG }}>
				<div
					className="mx-auto w-full px-5 pb-16 pt-10 sm:px-10 xl:px-14"
					style={{ maxWidth: 920 }}
				>
					{/* Dados pessoais */}
					<SectionHeader
						title="Dados pessoais"
						subtitle="Nome e email utilizados para aceder ao Compy."
					/>
					<div>
						<FormRow label="Nome completo">
							<StyledInput
								value={form.fullName}
								onChange={(e) => setForm({ ...form, fullName: e.target.value })}
								placeholder="Nome completo"
							/>
						</FormRow>
						<FormRow label="Email" last>
							<StyledInput
								type="email"
								value={form.email}
								onChange={(e) => setForm({ ...form, email: e.target.value })}
								placeholder="email@exemplo.com"
							/>
						</FormRow>
					</div>

					<Divider />

					{/* Instituição */}
					<SectionHeader
						title="Instituição"
						subtitle="Informação sobre a organização à qual está associado."
					/>
					{loadingInstitution ? (
						<div style={{ padding: "14px 0" }}>
							<div
								className="skeleton-premium rounded-xl"
								style={{ height: 44, opacity: 0.7 }}
							/>
						</div>
					) : institution ? (
						<div>
							<FormRow label="Tipo">
								<ReadOnlyValue value={institutionTypeLabel ?? ""} />
							</FormRow>
							<FormRow label="Designação" last>
								<ReadOnlyValue
									value={institution.designation ?? ""}
									placeholder="Não definida"
								/>
							</FormRow>
						</div>
					) : (
						<div
							style={{
								padding: "22px 16px",
								borderRadius: DS.radius.lg,
								border: `1px dashed ${C.border}`,
								textAlign: "center",
								color: C.textMuted,
								fontSize: 14,
							}}
						>
							Informação de instituição não disponível.
						</div>
					)}

					{/* ── Save footer ────────────────────────────────────────────── */}
					<div
						style={{
							marginTop: 48,
							paddingTop: 24,
							borderTop: `1px solid ${C.divider}`,
							display: "flex",
							flexDirection: "column",
							gap: 12,
						}}
					>
						<AnimatePresence>
							{saveFeedback && (
								<motion.div
									key="save-feedback"
									initial={
										shouldReduce
											? false
											: { opacity: 0, y: 6, filter: "blur(4px)" }
									}
									animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
									exit={
										shouldReduce
											? undefined
											: { opacity: 0, filter: "blur(4px)" }
									}
									transition={{ type: "spring", duration: 0.28, bounce: 0 }}
									style={{
										borderRadius: DS.radius.lg,
										padding: "10px 14px",
										fontSize: 13,
										background: isSuccess ? C.chip : C.alertBg,
										color: isSuccess ? C.chipText : C.alert,
										border: `1px solid ${isSuccess ? "rgba(45,191,160,0.22)" : C.alertBorder}`,
									}}
								>
									{saveFeedback}
								</motion.div>
							)}
						</AnimatePresence>
						<div className="flex items-center justify-between gap-3 flex-wrap">
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={goBack}
									className="transition-opacity hover:opacity-70 active:scale-[0.97]"
									style={{ ...DS.btnGhost }}
								>
									Cancelar
								</button>
								<button
									type="button"
									onClick={() => void saveProfile()}
									disabled={saving || !isDirty}
									className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.97]"
									style={{
										...DS.btnPrimary,
										background: isDirty ? C.tealDark : "rgba(26,95,90,0.08)",
										color: isDirty ? "#fff" : C.textMuted,
										boxShadow: isDirty ? undefined : "none",
										opacity: saving ? 0.7 : 1,
										cursor: saving || !isDirty ? "default" : "pointer",
									}}
								>
									<HiCheck size={15} />
									{saving ? "A guardar..." : "Guardar"}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ── Unsaved changes dialog ─────────────────────────────────────── */}
			<AnimatePresence>
				{confirmLeaveOpen && (
					<motion.div
						key="confirm-leave-backdrop"
						initial={shouldReduce ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={shouldReduce ? undefined : { opacity: 0 }}
						transition={{ duration: 0.15 }}
						role="presentation"
						onClick={() => setConfirmLeaveOpen(false)}
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 700,
							background: "rgba(8,34,35,0.38)",
							backdropFilter: "blur(10px)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 20,
						}}
					>
						<motion.div
							key="confirm-leave-panel"
							initial={
								shouldReduce
									? false
									: { opacity: 0, y: 10, filter: "blur(4px)" }
							}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={
								shouldReduce
									? undefined
									: { opacity: 0, y: 6, filter: "blur(4px)" }
							}
							transition={{ type: "spring", duration: 0.3, bounce: 0 }}
							role="dialog"
							aria-modal="true"
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "min(440px, 100%)",
								background: "#fff",
								borderRadius: 20,
								border: `1px solid ${C.cardBorder}`,
								boxShadow: "0 28px 80px rgba(8,34,35,0.22)",
								padding: "28px 24px",
							}}
						>
							<h2
								style={{
									margin: 0,
									fontSize: 18,
									fontWeight: 600,
									color: C.text,
									fontFamily: SF,
									letterSpacing: "-0.02em",
								}}
							>
								Alterações não guardadas
							</h2>
							<p
								style={{
									margin: "10px 0 0",
									fontSize: 14,
									lineHeight: 1.6,
									color: C.textSub,
									fontFamily: SF_TEXT,
								}}
							>
								Tens alterações no perfil que ainda não foram guardadas. O que
								pretendes fazer?
							</p>
							<div
								className="flex items-center justify-end gap-3 flex-wrap"
								style={{ marginTop: 24 }}
							>
								<button
									type="button"
									onClick={() => {
										setConfirmLeaveOpen(false);
										pendingNavigate?.();
										setPendingNavigate(null);
									}}
									className="transition-opacity hover:opacity-70 active:scale-[0.97]"
									style={{ ...DS.btnGhost, color: "#7a3535" }}
								>
									Sair sem guardar
								</button>
								<button
									type="button"
									onClick={async () => {
										setConfirmLeaveOpen(false);
										await saveProfile();
										pendingNavigate?.();
										setPendingNavigate(null);
									}}
									className="flex items-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.97]"
									style={{ ...DS.btnPrimary, background: C.tealDark }}
								>
									<HiCheck size={15} />
									Guardar e sair
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

		</div>
	);
}
