import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$lang/_app/_app/feedback")({
	beforeLoad: async ({ params }) => {
		throw redirect({
			to: "/$lang",
			params,
		});
	},
	component: () => null,
});
