import { useId } from "react";

const CELL = 52;

export function LoginShapeBackground() {
	const gridId = useId();
	const filterId = useId();

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
		>
			<div
				className="absolute inset-0"
				style={{
					WebkitMaskImage:
						"radial-gradient(ellipse 85% 85% at center, black 5%, transparent 72%)",
					maskImage:
						"radial-gradient(ellipse 85% 85% at center, black 5%, transparent 72%)",
				}}
			>
				<div
					className="absolute"
					style={{ inset: "-60%", transform: "rotate(14deg)" }}
				>
					<svg aria-hidden="true" className="absolute inset-0 h-full w-full">
						<defs>
							<pattern
								id={gridId}
								width={CELL}
								height={CELL}
								patternUnits="userSpaceOnUse"
							>
								<path
									d={`M.5 ${CELL}V.5H${CELL}`}
									fill="none"
									stroke="rgba(45,160,142,0.13)"
									strokeWidth="1"
								/>
							</pattern>
							<filter
								id={filterId}
								x="-10%"
								y="-10%"
								width="120%"
								height="120%"
							>
								<feTurbulence
									type="fractalNoise"
									baseFrequency="0.0025 0.002"
									numOctaves="2"
									seed="7"
									result="noise"
								/>
								<feDisplacementMap
									in="SourceGraphic"
									in2="noise"
									scale="55"
									xChannelSelector="R"
									yChannelSelector="G"
								/>
							</filter>
						</defs>
						<g filter={`url(#${filterId})`}>
							<rect
								width="100%"
								height="100%"
								strokeWidth={0}
								fill={`url(#${gridId})`}
							/>
						</g>
					</svg>
				</div>
			</div>
		</div>
	);
}
