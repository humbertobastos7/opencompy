import type { Config } from "tailwindcss";
import Daisyui from "daisyui";
import { winter } from "daisyui/src/theming/themes";
import { nextui } from "@nextui-org/react";

export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
		"./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {},
	},
	plugins: [Daisyui, nextui()],
	daisyui: {
		themes: [
			"light",
			"dark",
			"night",
			"winter",
			{
				compy: {
					...winter,
					accent: "#057C7D",
					primary: "#3DC2EA",
					secondary: "#53C9CB",
					"base-content": "#057C7D",
					"primary-content": "#ffffff",
					"base-300": "#D8F3F6",
				},
			},
		],
	},
} satisfies Config;
