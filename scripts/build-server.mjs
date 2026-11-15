import { build } from "esbuild";

const sharedOptions = {
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node20",
	packages: "external",
	tsconfig: "tsconfig.backend.json",
	sourcemap: false,
	logLevel: "info",
};

await Promise.all([
	build({
		...sharedOptions,
		entryPoints: ["src/backend/main.ts"],
		outfile: "dist/backend/main.js",
	}),
	build({
		...sharedOptions,
		entryPoints: ["src/backend/seed.ts"],
		outfile: "dist/backend/seed.js",
	}),
	build({
		...sharedOptions,
		entryPoints: ["src/ai/main.ts"],
		outfile: "dist/ai/main.js",
	}),
]);
