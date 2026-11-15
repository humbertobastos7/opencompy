import { useSessionStore } from "@/frontend/stores/session";

const BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";
const LANG = "pt-PT";

function Door() {
	return (
		<svg
			width="110"
			height="148"
			viewBox="0 0 110 148"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			style={{ filter: "drop-shadow(0 8px 20px rgba(26,95,90,0.16))" }}
		>
			{/* Outer frame */}
			<rect
				x="3"
				y="3"
				width="104"
				height="142"
				rx="5"
				fill="#c5e8e3"
				stroke="#1a5f5a"
				strokeWidth="3"
			/>
			{/* Door surface */}
			<rect
				x="10"
				y="10"
				width="90"
				height="130"
				rx="4"
				fill="#e6f5f2"
				stroke="#1a5f5a"
				strokeWidth="2"
			/>
			{/* Top inset panel */}
			<rect
				x="20"
				y="18"
				width="70"
				height="50"
				rx="3"
				fill="rgba(255,255,255,0.65)"
				stroke="rgba(26,95,90,0.22)"
				strokeWidth="1.5"
			/>
			{/* Bottom inset panel */}
			<rect
				x="20"
				y="78"
				width="70"
				height="50"
				rx="3"
				fill="rgba(255,255,255,0.65)"
				stroke="rgba(26,95,90,0.22)"
				strokeWidth="1.5"
			/>
			{/* Door knob */}
			<circle cx="80" cy="76" r="5" fill="#1a5f5a" />
			<circle cx="80" cy="76" r="2.8" fill="#c5e8e3" />
			{/* Question mark on top panel */}
			<text
				x="55"
				y="53"
				textAnchor="middle"
				fontSize="28"
				fontWeight="700"
				fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
				fill="#1a5f5a"
				opacity="0.65"
			>
				?
			</text>
		</svg>
	);
}

export function NotFoundPage() {
	const { session } = useSessionStore();

	const handleBack = () => {
		const role = session?.user.role;
		if (role === "senior") {
			window.location.href = `/${LANG}/senior`;
		} else if (role === "caregiver") {
			window.location.href = `/${LANG}/caretaker`;
		} else if (role === "admin") {
			window.location.href = `/${LANG}/admin`;
		} else {
			window.location.href = `/${LANG}`;
		}
	};

	const destinationLabel = () => {
		const role = session?.user.role;
		if (role === "senior") return "O meu Compy";
		if (role === "caregiver") return "Dashboard";
		if (role === "admin") return "Painel de Admin";
		return "Página inicial";
	};

	return (
		<div
			data-theme="compy"
			style={{
				width: "100%",
				height: "100%",
				minHeight: "100vh",
				background: BG,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "32px 24px",
				boxSizing: "border-box",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Background glows */}
			<div
				style={{
					position: "absolute",
					top: "8%",
					left: "18%",
					width: 280,
					height: 280,
					borderRadius: "50%",
					background: "rgba(185,235,220,0.36)",
					filter: "blur(44px)",
					pointerEvents: "none",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: "10%",
					right: "12%",
					width: 220,
					height: 220,
					borderRadius: "50%",
					background: "rgba(255,252,226,0.52)",
					filter: "blur(38px)",
					pointerEvents: "none",
				}}
			/>

			{/* Card */}
			<div
				style={{
					background: "rgba(255,255,255,0.80)",
					backdropFilter: "blur(18px)",
					WebkitBackdropFilter: "blur(18px)",
					borderRadius: 28,
					border: "1px solid rgba(26,95,90,0.11)",
					boxShadow: "0 8px 40px rgba(26,95,90,0.09)",
					padding: "36px 32px 28px",
					maxWidth: 380,
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					textAlign: "center",
				}}
			>
				<Door />

				<h1
					style={{
						fontSize: 20,
						fontWeight: 700,
						color: "#1a2a2a",
						margin: "24px 0 6px",
						fontFamily:
							"-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
						lineHeight: 1.3,
					}}
				>
					Esta porta não existe.
				</h1>

				<p
					style={{
						fontSize: 13,
						color: "#5a8a85",
						margin: "0 0 24px",
						lineHeight: 1.6,
						fontFamily:
							"-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
					}}
				>
					A página que estás à procura não foi encontrada
					<br />
					ou foi removida.
				</p>

				<button
					type="button"
					onClick={handleBack}
					style={{
						backgroundColor: "#1a5f5a",
						color: "#fff",
						border: "none",
						borderRadius: 14,
						padding: "13px 0",
						fontSize: 14,
						fontWeight: 600,
						cursor: "pointer",
						width: "100%",
						fontFamily:
							"-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.opacity = "0.85";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.opacity = "1";
					}}
				>
					Ir para {destinationLabel()}
				</button>
			</div>
		</div>
	);
}
