const BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";

function UnpluggedIcon() {
	return (
		<svg
			width="100"
			height="148"
			viewBox="0 0 100 148"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			style={{ filter: "drop-shadow(0 8px 20px rgba(26,95,90,0.16))" }}
		>
			{/* Wavy cable */}
			<path
				d="M50 2 C40 9 60 16 50 23 C40 30 60 37 50 44"
				stroke="#1a5f5a"
				strokeWidth="3.5"
				strokeLinecap="round"
				fill="none"
			/>
			{/* Plug body */}
			<rect
				x="14"
				y="44"
				width="72"
				height="56"
				rx="11"
				fill="#e6f5f2"
				stroke="#1a5f5a"
				strokeWidth="2.5"
			/>
			{/* Left hole */}
			<circle
				cx="34"
				cy="66"
				r="6.5"
				fill="rgba(26,95,90,0.12)"
				stroke="#1a5f5a"
				strokeWidth="1.8"
			/>
			{/* Right hole */}
			<circle
				cx="66"
				cy="66"
				r="6.5"
				fill="rgba(26,95,90,0.12)"
				stroke="#1a5f5a"
				strokeWidth="1.8"
			/>
			{/* Bottom ridge on plug */}
			<line
				x1="24"
				y1="88"
				x2="76"
				y2="88"
				stroke="rgba(26,95,90,0.2)"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			{/* Left prong */}
			<rect x="34" y="100" width="9" height="24" rx="4.5" fill="#1a5f5a" />
			{/* Right prong */}
			<rect x="57" y="100" width="9" height="24" rx="4.5" fill="#1a5f5a" />
			{/* Dashed floor — nothing to connect to */}
			<line
				x1="8"
				y1="140"
				x2="92"
				y2="140"
				stroke="rgba(26,95,90,0.28)"
				strokeWidth="2"
				strokeDasharray="6,5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function ServerDownPage() {
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
				<UnpluggedIcon />

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
					Sem ligação ao servidor.
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
					Não conseguimos estabelecer ligação.
					<br />
					Verifica a tua rede ou tenta novamente
					<br />
					mais tarde.
				</p>

				<button
					type="button"
					onClick={() => window.location.reload()}
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
					Tentar novamente
				</button>
			</div>
		</div>
	);
}
