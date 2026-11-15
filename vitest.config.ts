import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	esbuild: {
		target: "esnext",
		tsconfigRaw: {
			compilerOptions: {
				experimentalDecorators: true,
				emitDecoratorMetadata: true,
			},
		},
	},
	test: {
		environment: "node",
		include: [
			"src/backend/**/*.test.ts",
			"src/ai/**/*.test.ts",
			"src/shared/**/*.test.ts",
		],
		env: {
			DATABASE_URL: "postgres://user:pass@localhost:5432/test",
			AI_SERVICE_URL: "http://127.0.0.1:3001",
			NODE_ENV: "test",
		},
	},
});
