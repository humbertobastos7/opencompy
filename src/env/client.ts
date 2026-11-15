import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_USE_REALTIME_CHAT: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
	},
	runtimeEnv: import.meta.env,
});
