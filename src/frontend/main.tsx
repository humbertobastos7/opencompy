import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import "./index.css";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { NextUIProvider } from "@nextui-org/react";
import { NotFoundPage } from "./components/ui/NotFoundPage";
import { ServerDownPage } from "./components/ui/ServerDownPage";
import { CompyToastContainer } from "./components/ui/CompyToastContainer";

// Create a new router instance
const router = createRouter({
	routeTree,
	defaultErrorComponent: ServerDownPage,
	defaultNotFoundComponent: NotFoundPage,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<NextUIProvider>
				<RouterProvider router={router} />
			</NextUIProvider>
			<CompyToastContainer />
		</StrictMode>,
	);
}
