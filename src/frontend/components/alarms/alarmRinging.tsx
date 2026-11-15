import { useRef, useEffect, useState } from "react";
import { dictionary } from "../../assets/i18n";
import { DS } from "@/frontend/designSystem";
import { useAlarmStore } from "../../stores/alarms";

interface Props {
	lang: string;
}

const AlarmRinging: React.FC<Props> = ({ lang }) => {
	const t = dictionary(lang);

	const { alarms, removeAlarm, addAlarm } = useAlarmStore();
	const [alarmTitle, setAlarmTitle] = useState<string>("");

	const dialogRef = useRef<HTMLDialogElement>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const playSound = () => {
		if (audioRef.current) {
			audioRef.current.currentTime = 0;
			audioRef.current.play();
		}
	};

	const stopSound = () => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
	};

	const suspendAlarm = () => {
		const newAlarmTime = new Date(new Date().getTime() + 5 * 60000);
		newAlarmTime.setSeconds(0);
		newAlarmTime.setMilliseconds(0);

		addAlarm({ time: newAlarmTime.toISOString(), title: alarmTitle });
		stopSound();
		dialogRef.current?.close();
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: removeAlarm is a function that is not a dependency
	useEffect(() => {
		const now = new Date().getTime();

		// Remove any alarms that are before the current time on the first render
		for (const alarm of alarms) {
			const alarmTime = new Date(alarm.time).getTime();
			if (alarmTime < now) {
				removeAlarm(alarm.time);
			}
		}

		const checkAlarms = () => {
			const now = new Date().getTime();
			const oneMinuteAgo = now - 60000;

			for (const alarm of alarms) {
				const alarmTime = new Date(alarm.time).getTime();
				if (alarmTime >= oneMinuteAgo && alarmTime <= now) {
					dialogRef.current?.showModal();
					playSound();
					removeAlarm(alarm.time);
					setAlarmTitle(alarm.title);
				}
			}
		};

		// Calculate the delay until the next full minute
		const nowDate = new Date();
		const delay =
			(60 - nowDate.getSeconds()) * 1000 - nowDate.getMilliseconds();

		// Set a timeout to start the interval at the next full minute
		const timeoutId = setTimeout(() => {
			checkAlarms(); // Initial check at the start of the interval
			const intervalId = setInterval(checkAlarms, 60000); // Check every minute

			return () => clearInterval(intervalId); // Cleanup interval on component unmount
		}, delay);

		return () => clearTimeout(timeoutId); // Cleanup timeout on component unmount
	}, [alarms, removeAlarm]);

	return (
		<>
			{/* biome-ignore lint/a11y/useMediaCaption: This is a song with no lyrics */}
			<audio ref={audioRef} className="hidden">
				<source src="/alarm.mp3" type="audio/mpeg" />
			</audio>
			<dialog ref={dialogRef} className="modal">
				<div className="modal-box" style={{ ...DS.glassCard }}>
					<h3 className="font-bold text-lg">Alarm</h3>
					<p className="py-4 text-center text-4xl font-light">{alarmTitle}</p>
					<div className="modal-action gap-4">
						<button
							type="button"
							style={DS.btnPrimary}
							onClick={() => {
								stopSound();
								dialogRef.current?.close();
							}}
						>
							{t.common.close}
						</button>
						<button
							type="button"
							style={{
								...DS.btnSecondary,
								borderColor: "#fb923c",
								color: "#c2410c",
							}}
							onClick={suspendAlarm}
						>
							{"Suspend 5 minutes"}
						</button>
					</div>
				</div>
			</dialog>
		</>
	);
};

export default AlarmRinging;
