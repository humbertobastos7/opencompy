import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "pt.visualthinking.compyai",
	appName: "Compy.ai",
	webDir: "dist/frontend",
	plugins: {
		CapacitorHttp: {
			enabled: true,
		},
		LocalNotifications: {
			smallIcon: "ic_stat_icon_config_sample",
			iconColor: "#488AFF",
			sound: "alarm.mp3",
		},
	},
};

export default config;
