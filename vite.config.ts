import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

const ReactCompilerConfig = {
	target: "19",
};

export default defineConfig({
	publicDir: "./src/frontend/public",
	build: {
		outDir: "dist/frontend",
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
				ws: true,
			},
		},
	},
	plugins: [
		tsconfigPaths(),
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
			},
		}),
		TanStackRouterVite({
			routesDirectory: "./src/frontend/routes",
			generatedRouteTree: "./src/frontend/routeTree.gen.ts",
		}),
		VitePWA({
			registerType: "autoUpdate",
			devOptions: {
				enabled: false,
			},
			manifest: {
				name: "Compy.ai",
				short_name: "Compy",
				display: "fullscreen",
				display_override: ["standalone", "fullscreen"],
				theme_color: "#ffffff",
				background_color: "#ffffff",
				icons: [
					{
						src: "logo-app-192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "logo-app-512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "logo-app-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			},
		}),
	],
});
