import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/frontend/stores/session";

export const Route = createFileRoute("/$lang/_app/_app/_admin")({
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session.data) {
			throw redirect({
				to: "/$lang",
				params: { lang: params.lang },
			});
		}

		if (session.data.user.role !== "admin") {
			throw redirect({
				to: "/$lang/caretaker",
				params: { lang: params.lang },
			});
		}
	},
	component: Layout,
});

function Layout() {
	return (
		<div className="w-full h-full">
			<Outlet />
		</div>
	);
}
