import { createRootRoute, Outlet } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { PoweredByKindtech } from "../components/ui/PoweredByKindtech";
import { usePageBackgroundStore } from "../stores/pageBackground";
import { NotFoundPage } from "../components/ui/NotFoundPage";
import { ServerDownPage } from "../components/ui/ServerDownPage";

export const Route = createRootRoute({
	component: Root,
	notFoundComponent: NotFoundPage,
	errorComponent: ServerDownPage,
});

function Root() {
	const pageBackground = usePageBackgroundStore((s) => s.background);
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);
	const hideFooter = usePageBackgroundStore((s) => s.hideFooter);

	return (
		<div
			data-theme="compy"
			className="relative w-screen background flex-col antialiased"
			style={{ height: "100dvh" }}
		>
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<span />
			<div
				className="absolute top-0 left-0 w-screen backdrop-blur-2xl flex flex-col"
				style={{
					height: "100dvh",
					...(globalBackground
						? { backgroundImage: globalBackground }
						: pageBackground
							? { backgroundImage: pageBackground }
							: undefined),
				}}
			>
				<div className="flex-1 min-h-0 overflow-hidden">
					<Outlet />
				</div>
				{/* <TanStackRouterDevtools /> */}
				{!hideFooter && (
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: 0,
							pointerEvents: "none",
							zIndex: 20,
						}}
					>
						<PoweredByKindtech />
					</div>
				)}
			</div>
		</div>
	);
}
