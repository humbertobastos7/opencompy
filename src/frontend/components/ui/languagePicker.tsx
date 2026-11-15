import { useState } from "react";
import { localeDetails } from "../../assets/i18n";
import { FiGlobe } from "react-icons/fi";

/**
 * Rewrites the leading locale segment while preserving the rest of the route.
 */
const buildLocalizedPath = (pathname: string, localeCode: string) => {
	const segments = pathname.split("/");

	// TanStack Router always mounts locale-aware pages under "/$lang/...".
	// Replacing only the first real path segment keeps the nested route intact.
	if (segments.length > 1 && segments[1]) {
		segments[1] = localeCode;
		return segments.join("/");
	}

	return `/${localeCode}`;
};

/**
 * Renders the locale switcher using the app's exported locale metadata.
 */
export const LanguagePicker = ({ locale }: { locale: string }) => {
	const [isOpen, setIsOpen] = useState(false);

	/**
	 * Navigates to the same route under the requested locale.
	 */
	const handleLocaleChange = (code: string) => {
		const nextPath = buildLocalizedPath(window.location.pathname, code);
		window.location.replace(
			`${nextPath}${window.location.search}${window.location.hash}`,
		);
		setTimeout(() => setIsOpen(false), 100);
	};

	return (
		<>
			<div
				className={`dropdown dropdown-bottom dropdown-end ${isOpen ? "group" : ""}`}
			>
				<button
					tabIndex={0}
					type="button"
					className="btn btn-square btn-ghost group-focus-within:btn-disabled bg-base-300 shadow-md"
					onClick={() => setIsOpen(!isOpen)}
				>
					<FiGlobe className="h-6 w-6" />
				</button>
				{isOpen && (
					<ul
						// biome-ignore lint/a11y/noNoninteractiveTabindex: I need it to work with DaisyUI
						tabIndex={0}
						className="dropdown-content menu menu-lg bg-base-300 rounded-box z-50 w-72 p-2 shadow"
					>
						{localeDetails.map(({ code, name, flag }) => (
							// biome-ignore lint/a11y/useKeyWithClickEvents: the li is the interactive wrapper here
							<li key={code} onClick={() => handleLocaleChange(code)}>
								{/* biome-ignore lint/a11y/useValidAnchor: navigation is handled by the li click */}
								<a
									className={`p-1 pl-2 rounded-btn flex items-center gap-2 cursor-pointer select-none hover:bg-base-300 ${locale === code ? "font-bold" : ""}`}
								>
									<span>{flag}</span>
									<span>{name}</span>
								</a>
							</li>
						))}
					</ul>
				)}
			</div>
		</>
	);
};
