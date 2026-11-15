import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LocalNotifications } from "@capacitor/local-notifications";

export interface Alarm {
	time: string;
	title: string;
}

interface AlarmStoreState {
	alarms: Alarm[];
	addAlarm: (alarm: Alarm) => void;
	removeAlarm: (time: string) => void;
	emptyAlarms: () => void;
}

export const useAlarmStore = create<AlarmStoreState>()(
	persist(
		(set, state) => ({
			alarms: [],
			addAlarm: async (alarm) => {
				if (!state().alarms.some((a) => a.time === alarm.time)) {
					const newAlarms = [...state().alarms, alarm].sort((a, b) => {
						return +new Date(a.time) < +new Date(b.time) ? -1 : 1;
					});
					set({
						alarms: structuredClone(newAlarms),
					});

					if (Notification.permission === "default") {
						const p = await Notification.requestPermission();
						if (p === "denied") {
							return;
						}
					}
					const alarmDate = new Date(alarm.time);
					LocalNotifications.schedule({
						notifications: [
							{
								title: "Compy.AI",
								body: alarm.title,
								id: alarmDate.getTime(),
								schedule: { at: alarmDate },
								sound: "alarm.mp3",
								smallIcon: "ic_stat_icon_config_sample",
								iconColor: "#488AFF",
							},
						],
					});
				}
			},
			removeAlarm: (time) => {
				if (state().alarms.some((a) => a.time === time)) {
					const newAlarms = state().alarms.filter((a) => a.time !== time);
					set({
						alarms: structuredClone(newAlarms),
					});

					const alarmDate = new Date(time);

					LocalNotifications.cancel({
						notifications: [{ id: alarmDate.getTime() }],
					});
				}
			},
			emptyAlarms: () => {
				for (const alarm of state().alarms) {
					const alarmDate = new Date(alarm.time);
					LocalNotifications.cancel({
						notifications: [{ id: alarmDate.getTime() }],
					});
				}
				set({
					alarms: [],
				});
			},
		}),
		{
			name: "alarm",
			storage: createJSONStorage(() => localStorage),
		},
	),
);

export const emptyAlarms = () => useAlarmStore.getState().emptyAlarms();
