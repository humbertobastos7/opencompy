import type { ButtonHTMLAttributes, CSSProperties } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ");
}

function hexToRgba(hex: string, alpha = 1): string {
	let hexValue = hex.replace("#", "");

	if (hexValue.length === 3) {
		hexValue = hexValue
			.split("")
			.map((char) => char + char)
			.join("");
	}

	const r = Number.parseInt(hexValue.substring(0, 2), 16);
	const g = Number.parseInt(hexValue.substring(2, 4), 16);
	const b = Number.parseInt(hexValue.substring(4, 6), 16);

	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
		return "rgba(163, 230, 53, 1)";
	}

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type GlowingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	glowColor?: string;
	selected?: boolean;
};

export function GlowingButton({
	children,
	className,
	glowColor = "#a3e635",
	selected = false,
	style,
	type = "button",
	...props
}: GlowingButtonProps) {
	const glowColorRgba = hexToRgba(glowColor);
	const glowColorVia = hexToRgba(glowColor, 0.075);
	const glowColorTo = hexToRgba(glowColor, 0.2);

	return (
		<button
			type={type}
			style={
				{
					"--glow-color": glowColorRgba,
					"--glow-color-via": glowColorVia,
					"--glow-color-to": glowColorTo,
					borderColor: selected ? glowColorRgba : "rgba(226, 232, 240, 0.96)",
					boxShadow: selected
						? `0 10px 24px ${glowColorVia}`
						: "0 1px 2px rgba(15, 23, 42, 0.04)",
					...style,
				} as CSSProperties
			}
			className={cn(
				"w-min h-10 !px-5 text-sm rounded-md border flex items-center justify-center relative transition-colors overflow-hidden bg-gradient-to-t border-r-0 duration-200 whitespace-nowrap",
				"from-white via-white to-slate-50 text-slate-800 hover:text-slate-600",
				"after:pointer-events-none after:inset-0 after:absolute after:rounded-[inherit] after:bg-gradient-to-r after:from-transparent after:from-40% after:via-[var(--glow-color-via)] after:to-[var(--glow-color-to)] after:via-70% after:shadow-[rgba(15,23,42,0.08)_0px_1px_0px_inset] z-20",
				"before:pointer-events-none before:absolute before:w-[5px] hover:before:translate-x-full before:transition-all before:duration-200 before:h-[60%] before:bg-[var(--glow-color)] before:right-0 before:rounded-l before:shadow-[-2px_0_10px_var(--glow-color)] z-10",
				selected && "text-slate-900",
				className,
			)}
			{...props}
		>
			<span className="relative z-30">{children}</span>
		</button>
	);
}

export const Component = GlowingButton;
