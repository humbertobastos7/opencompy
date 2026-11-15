import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/frontend/components/ui/NotFoundPage";

export const Route = createFileRoute("/$lang/$")({
	component: NotFoundPage,
});
