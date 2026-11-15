import { useId, type SVGProps } from "react";

type GridPatternProps = SVGProps<SVGSVGElement> & {
	width?: number;
	height?: number;
	x?: number;
	y?: number;
	squares?: Array<[x: number, y: number]>;
	strokeDasharray?: string;
	squareFill?: string;
};

export function GridPattern({
	width = 40,
	height = 40,
	x = -1,
	y = -1,
	strokeDasharray = "0",
	squares,
	squareFill = "rgba(45, 191, 160, 0.08)",
	className,
	style,
	...props
}: GridPatternProps) {
	const id = useId();

	return (
		<svg
			aria-hidden="true"
			className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
			style={style}
			{...props}
		>
			<defs>
				<pattern
					id={id}
					width={width}
					height={height}
					patternUnits="userSpaceOnUse"
					x={x}
					y={y}
				>
					<path
						d={`M.5 ${height}V.5H${width}`}
						fill="none"
						stroke="rgba(31, 95, 90, 0.14)"
						strokeDasharray={strokeDasharray}
					/>
				</pattern>
			</defs>
			<rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
			{squares && (
				<svg x={x} y={y} className="overflow-visible">
					{squares.map(([squareX, squareY]) => (
						<rect
							key={`${squareX}-${squareY}`}
							width={width - 1}
							height={height - 1}
							x={squareX * width + 1}
							y={squareY * height + 1}
							strokeWidth="0"
							fill={squareFill}
						/>
					))}
				</svg>
			)}
		</svg>
	);
}
