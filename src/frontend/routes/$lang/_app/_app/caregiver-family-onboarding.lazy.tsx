import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CSSProperties } from "react";
import { api_client } from "@/frontend/utils/api";
import { useSessionStore } from "@/frontend/stores/session";
import { toast } from "react-toastify";
import { FaCircleCheck, FaRegClipboard, FaCheck } from "react-icons/fa6";
import { HiUser, HiIdentification } from "react-icons/hi2";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/caregiver-family-onboarding",
)({
	component: FamilyOnboarding,
});

const BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";

const C = {
	teal: "#1fb59f",
	tealDark: "#0f6a62",
	text: "#111111",
	textSub: "#4d4d4d",
	textMuted: "#767676",
	card: "#ffffff",
	cardBorder: "rgba(17,75,69,0.14)",
	inputBorder: "rgba(17,75,69,0.22)",
};

const baseInput: CSSProperties = {
	width: "100%",
	padding: "11px 14px",
	borderRadius: 10,
	border: `1.5px solid ${C.inputBorder}`,
	fontSize: 15,
	color: C.text,
	background: "#fafffe",
	outline: "none",
	boxSizing: "border-box",
	transition: "border-color 180ms ease",
};

const baseBtnPrimary: CSSProperties = {
	background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)`,
	color: "#fff",
	border: "none",
	borderRadius: 12,
	padding: "13px 28px",
	fontSize: 15,
	fontWeight: 600,
	cursor: "pointer",
	width: "100%",
	transition: "opacity 180ms ease, transform 120ms ease",
};

const baseLabel: CSSProperties = {
	display: "block",
	fontSize: 13,
	fontWeight: 600,
	color: C.textSub,
	marginBottom: 6,
	letterSpacing: "0.02em",
};

type Step = "profile" | "senior" | "done";

function btn(loading = false): CSSProperties {
	return { ...baseBtnPrimary, marginTop: 24, opacity: loading ? 0.7 : 1 };
}

function hoverIn(e: React.MouseEvent<HTMLButtonElement>, loading = false) {
	if (!loading) e.currentTarget.style.opacity = "0.88";
}
function hoverOut(e: React.MouseEvent<HTMLButtonElement>, loading = false) {
	e.currentTarget.style.opacity = loading ? "0.7" : "1";
}
function pressIn(e: React.MouseEvent<HTMLButtonElement>) {
	e.currentTarget.style.transform = "scale(0.97)";
}
function pressOut(e: React.MouseEvent<HTMLButtonElement>) {
	e.currentTarget.style.transform = "scale(1)";
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
	const order: Step[] = ["profile", "senior", "done"];
	const idx = order.indexOf(step);
	const labels = ["O seu perfil", "Idoso", "Código"];
	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				gap: 0,
				marginBottom: 32,
			}}
		>
			{labels.map((label, i) => {
				const done = i < idx;
				const active = i === idx;
				return (
					<div
						key={label}
						style={{ display: "flex", alignItems: "flex-start" }}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 5,
								minWidth: 72,
							}}
						>
							<div
								style={{
									width: 30,
									height: 30,
									borderRadius: "50%",
									background:
										done || active
											? `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`
											: "rgba(17,75,69,0.10)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 13,
									fontWeight: 700,
									color: done || active ? "#fff" : C.textMuted,
									transition: "background 280ms ease",
									flexShrink: 0,
								}}
							>
								{done ? <FaCheck size={11} /> : i + 1}
							</div>
							<span
								style={{
									fontSize: 11,
									fontWeight: active ? 700 : done ? 500 : 400,
									color: active ? C.tealDark : done ? C.teal : C.textMuted,
									textAlign: "center",
									lineHeight: 1.2,
								}}
							>
								{label}
							</span>
						</div>
						{i < labels.length - 1 && (
							<div
								style={{
									height: 2,
									width: 36,
									borderRadius: 1,
									background: done
										? `linear-gradient(90deg, ${C.teal}, ${C.tealDark})`
										: "rgba(17,75,69,0.10)",
									marginTop: 14,
									flexShrink: 0,
									transition: "background 280ms ease",
								}}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ── Access code display ───────────────────────────────────────────────────────

function AccessCodeBox({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const copy = () => {
		navigator.clipboard.writeText(code).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2200);
		});
	};

	return (
		<div style={{ width: "100%" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12,
					padding: "14px 18px",
					borderRadius: 14,
					border: `2px solid ${C.teal}55`,
					background: `linear-gradient(135deg, ${C.teal}0a, ${C.tealDark}08)`,
				}}
			>
				<span
					style={{
						fontFamily: "monospace",
						fontSize: 22,
						fontWeight: 700,
						letterSpacing: "0.12em",
						color: C.tealDark,
						flexShrink: 1,
						wordBreak: "break-all",
					}}
				>
					{code}
				</span>
				<button
					type="button"
					onClick={copy}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "8px 14px",
						borderRadius: 9,
						border: "none",
						background: copied
							? `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`
							: "rgba(17,75,69,0.10)",
						color: copied ? "#fff" : C.tealDark,
						fontWeight: 600,
						fontSize: 13,
						cursor: "pointer",
						flexShrink: 0,
						transition: "all 180ms ease",
					}}
					title="Copiar código"
				>
					{copied ? <FaCheck size={13} /> : <FaRegClipboard size={13} />}
					<span>{copied ? "Copiado!" : "Copiar"}</span>
				</button>
			</div>
			<p
				style={{
					fontSize: 12,
					color: C.textMuted,
					textAlign: "center",
					marginTop: 8,
				}}
			>
				Partilhe este código com o seu familiar para ele entrar na aplicação.
			</p>
		</div>
	);
}

// ── Step 1: Caregiver profile ─────────────────────────────────────────────────

function ProfileStep({ onNext }: { onNext: () => void }) {
	const { session, refreshSession } = useSessionStore();
	const [fullName, setFullName] = useState(session?.user.name ?? "");
	const [email, setEmail] = useState(session?.user.email ?? "");
	const [loading, setLoading] = useState(false);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!fullName.trim() || !email.trim()) return;
		setLoading(true);
		try {
			const res = await api_client.caregiver.profile.$patch({
				json: { fullName: fullName.trim(), email: email.trim() },
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: res.statusText }));
				toast.error(
					(err as { message?: string }).message ?? "Erro ao guardar perfil",
				);
				return;
			}
			await refreshSession(true);
			onNext();
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={submit}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					marginBottom: 24,
				}}
			>
				<div
					style={{
						width: 40,
						height: 40,
						borderRadius: 12,
						background: `linear-gradient(135deg, ${C.teal}20, ${C.tealDark}10)`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<HiUser size={20} color={C.tealDark} />
				</div>
				<div>
					<div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
						Os seus dados
					</div>
					<div style={{ fontSize: 13, color: C.textMuted }}>
						Atualize o seu nome e email de acesso
					</div>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div>
					<label style={baseLabel}>Nome completo</label>
					<input
						style={baseInput}
						value={fullName}
						onChange={(e) => setFullName(e.target.value)}
						placeholder="ex: Ana Silva"
						required
						autoFocus
					/>
				</div>
				<div>
					<label style={baseLabel}>Email de acesso</label>
					<input
						style={baseInput}
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="ana@exemplo.com"
						required
					/>
					<p style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>
						Este email ficará a ser o seu login no Compy.
					</p>
				</div>
			</div>

			<button
				type="submit"
				style={btn(loading)}
				disabled={loading}
				onMouseEnter={(e) => hoverIn(e, loading)}
				onMouseLeave={(e) => hoverOut(e, loading)}
				onMouseDown={pressIn}
				onMouseUp={pressOut}
			>
				{loading ? "A guardar…" : "Continuar"}
			</button>
		</form>
	);
}

// ── Step 2: Senior registration ───────────────────────────────────────────────

function SeniorStep({ onNext }: { onNext: (accessCode: string) => void }) {
	const [fullName, setFullName] = useState("");
	const [gender, setGender] = useState<"m" | "f" | "">("");
	const [birthDate, setBirthDate] = useState("");
	const [loading, setLoading] = useState(false);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!fullName.trim() || !birthDate) return;
		setLoading(true);
		try {
			const res = await api_client.caregiver.seniors.$post({
				json: {
					fullName: fullName.trim(),
					gender: gender || null,
					birthDate: new Date(birthDate),
				},
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: res.statusText }));
				toast.error(
					(err as { message?: string }).message ?? "Erro ao registar familiar",
				);
				return;
			}
			const data = (await res.json()) as { accessCode: string };
			onNext(data.accessCode);
		} finally {
			setLoading(false);
		}
	};

	const radioBtn = (selected: boolean): CSSProperties => ({
		flex: 1,
		padding: "10px 0",
		borderRadius: 10,
		border: `1.5px solid ${selected ? C.teal : C.inputBorder}`,
		background: selected ? `${C.teal}18` : "transparent",
		color: selected ? C.tealDark : C.textSub,
		fontWeight: selected ? 700 : 400,
		cursor: "pointer",
		fontSize: 14,
		transition: "all 150ms ease",
		userSelect: "none",
	});

	return (
		<form onSubmit={submit}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					marginBottom: 24,
				}}
			>
				<div
					style={{
						width: 40,
						height: 40,
						borderRadius: 12,
						background: `linear-gradient(135deg, ${C.teal}20, ${C.tealDark}10)`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<HiIdentification size={20} color={C.tealDark} />
				</div>
				<div>
					<div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
						Registar sénior
					</div>
					<div style={{ fontSize: 13, color: C.textMuted }}>
						Quem vai usar o Compy em casa?
					</div>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div>
					<label style={baseLabel}>Nome completo</label>
					<input
						style={baseInput}
						value={fullName}
						onChange={(e) => setFullName(e.target.value)}
						placeholder="ex: António Silva"
						required
						autoFocus
					/>
				</div>

				<div>
					<label style={baseLabel}>Género (opcional)</label>
					<div style={{ display: "flex", gap: 10 }}>
						{(
							[
								["m", "Masculino"],
								["f", "Feminino"],
							] as const
						).map(([val, label]) => (
							<button
								key={val}
								type="button"
								style={radioBtn(gender === val)}
								onClick={() => setGender((prev) => (prev === val ? "" : val))}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				<div>
					<label style={baseLabel}>Data de nascimento</label>
					<input
						style={baseInput}
						type="date"
						value={birthDate}
						onChange={(e) => setBirthDate(e.target.value)}
						max={new Date().toISOString().slice(0, 10)}
						required
					/>
				</div>
			</div>

			<button
				type="submit"
				style={btn(loading)}
				disabled={loading}
				onMouseEnter={(e) => hoverIn(e, loading)}
				onMouseLeave={(e) => hoverOut(e, loading)}
				onMouseDown={pressIn}
				onMouseUp={pressOut}
			>
				{loading ? "A registar…" : "Registar sénior"}
			</button>
		</form>
	);
}

// ── Step 3: Success ───────────────────────────────────────────────────────────

function DoneStep({
	accessCode,
	onDone,
}: { accessCode: string; onDone: () => void }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 20,
				paddingTop: 4,
			}}
		>
			<FaCircleCheck size={44} color={C.teal} />
			<div style={{ textAlign: "center" }}>
				<div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
					Sénior registado!
				</div>
				<div
					style={{
						fontSize: 13,
						color: C.textMuted,
						marginTop: 6,
						lineHeight: 1.5,
					}}
				>
					Guarde o código abaixo. O sénior precisará dele para aceder à
					aplicação.
				</div>
			</div>

			<AccessCodeBox code={accessCode} />

			<button
				type="button"
				style={{ ...baseBtnPrimary, marginTop: 4 }}
				onClick={onDone}
				onMouseEnter={hoverIn}
				onMouseLeave={hoverOut}
				onMouseDown={pressIn}
				onMouseUp={pressOut}
			>
				Entrar no painel
			</button>
		</div>
	);
}

// ── Root ─────────────────────────────────────────────────────────────────────

function FamilyOnboarding() {
	const { lang } = Route.useParams();
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>("profile");
	const [accessCode, setAccessCode] = useState("");

	const handleDone = () => {
		navigate({ to: "/$lang/caretaker", params: { lang } });
	};

	const renderStep = () => {
		if (step === "profile")
			return <ProfileStep onNext={() => setStep("senior")} />;
		if (step === "senior") {
			return (
				<SeniorStep
					onNext={(code) => {
						setAccessCode(code);
						setStep("done");
					}}
				/>
			);
		}
		return <DoneStep accessCode={accessCode} onDone={handleDone} />;
	};

	return (
		<div
			style={{
				height: "100%",
				minHeight: "100%",
				width: "100%",
				background: BG,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflowY: "auto",
				padding: "32px 18px 48px",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					width: "100%",
					maxWidth: 460,
					textAlign: "center",
					marginBottom: 8,
				}}
			>
				<div
					style={{
						fontSize: 22,
						fontWeight: 800,
						color: C.tealDark,
						letterSpacing: "-0.02em",
					}}
				>
					Bem-vindo ao Compy
				</div>
				<div style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>
					Vamos configurar o seu espaço familiar
				</div>
			</div>

			<div
				style={{
					background: C.card,
					border: `1px solid ${C.cardBorder}`,
					borderRadius: 20,
					boxShadow: "0 8px 32px rgba(31,80,73,0.08)",
					padding: "32px 28px 28px",
					width: "100%",
					maxWidth: 460,
					marginTop: 20,
					overflow: "hidden",
				}}
			>
				<StepIndicator step={step} />

				<div
					key={step}
					style={{ animation: "familyOnboardingStepIn 220ms ease-out" }}
				>
					{renderStep()}
				</div>
			</div>

			<style>{`
        @keyframes familyOnboardingStepIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
		</div>
	);
}
