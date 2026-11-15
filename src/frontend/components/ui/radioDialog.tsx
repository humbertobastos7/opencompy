import {
	useRef,
	useState,
	type RefObject,
	useImperativeHandle,
	forwardRef,
	type ForwardedRef,
	useCallback,
} from "react";
import { dictionary } from "../../assets/i18n";
import { FaRadio } from "react-icons/fa6";
import { FaPause, FaPlay } from "react-icons/fa";

export interface RadioHandle {
	playRadio: (index: number) => void;
	pauseRadio: (index: number) => void;
}

interface Props {
	lang: string;
	radioRef: ForwardedRef<RadioHandle>;
}

export const radioSrcs = [
	{
		name: "RFM",
		src: "https://27903.live.streamtheworld.com/RFM_SC",
	},
	{
		name: "Nova Era",
		src: "https://centova.radios.pt/proxy/478?mp=/stream/1/",
	},
	{
		name: "Comercial",
		src: "https://stream-icy.bauermedia.pt/comercial.mp3",
	},
	{
		name: "Renascença",
		src: "https://23543.live.streamtheworld.com/RADIO_RENASCENCA_SC",
	},
];

const RadioDialog: React.FC<Props> = forwardRef(({ lang, radioRef }) => {
	const t = dictionary(lang);

	const dialogRef = useRef<HTMLDialogElement>(null);

	const [radioReferences, setRadioReferences] = useState<
		RefObject<HTMLAudioElement | null>[]
	>([
		useRef<HTMLAudioElement>(null),
		useRef<HTMLAudioElement>(null),
		useRef<HTMLAudioElement>(null),
		useRef<HTMLAudioElement>(null),
	]);

	const [loading, setLoading] = useState<number>();

	const playRadio = useCallback(
		(index: number) => {
			const alreadyPlaying = !radioReferences[index].current?.paused;
			for (const ref of radioReferences) {
				ref.current?.pause();
			}
			setTimeout(() => {
				if (radioReferences[index].current && !alreadyPlaying) {
					radioReferences[index].current.src = "";
					setTimeout(() => {
						if (!radioReferences[index].current) return;
						setLoading(index);
						radioReferences[index].current.src = radioSrcs[index].src;
						radioReferences[index].current.load();
						setTimeout(() => {
							if (!radioReferences[index].current) return;
							radioReferences[index].current.play();
							radioReferences[index].current.onplaying = () => {
								setLoading(undefined);
							};
							setRadioReferences([...radioReferences]);
						}, 5);
					}, 5);
				} else {
					setRadioReferences([...radioReferences]);
				}
			}, 5);
		},
		[radioReferences],
	);

	const pauseRadio = useCallback(
		(index: number) => {
			if (
				radioReferences[index].current &&
				!radioReferences[index].current?.paused
			) {
				radioReferences[index].current?.pause();
				setRadioReferences([...radioReferences]);
			}
		},
		[radioReferences],
	);

	useImperativeHandle(
		radioRef,
		() => ({
			playRadio,
			pauseRadio,
		}),
		[playRadio, pauseRadio],
	);

	const handleRadioClick = (index: number) => {
		if (radioReferences[index].current?.paused) {
			playRadio(index);
		} else {
			pauseRadio(index);
		}
	};

	return (
		<>
			{radioSrcs.map((src, index) => (
				<span key={`player-${src.src}`} className="hidden">
					{/* biome-ignore lint/a11y/useMediaCaption: This is radio, there's no captions */}
					<audio ref={radioReferences[index]} />
				</span>
			))}

			<button
				type="button"
				className="btn btn-primary btn-circle btn-lg"
				onClick={() => dialogRef.current?.showModal()}
			>
				<FaRadio className="h-9 w-9 -ml-0.5 -mt-0.5" />
			</button>
			<dialog className="modal" ref={dialogRef}>
				<div className="modal-box bg-base-100">
					<h3 className="font-bold text-lg pb-6">{t.common.games}</h3>
					<div className="flex flex-col gap-2">
						{radioSrcs.map((src, index) => (
							<button
								type="button"
								key={`button-${src.src}`}
								className="btn btn-primary btn-lg"
								onClick={() => handleRadioClick(index)}
							>
								{loading === index ? (
									<span className="loading loading-spinner loading-md" />
								) : radioReferences[index].current?.paused ? (
									<FaPlay />
								) : (
									<FaPause />
								)}
								<span className="w-48">{src.name}</span>
							</button>
						))}
					</div>
					<div className="modal-action">
						<button
							type="button"
							className="btn"
							onClick={() => {
								dialogRef.current?.close();
							}}
						>
							{t.common.close}
						</button>
					</div>
				</div>
			</dialog>
		</>
	);
});

RadioDialog.displayName = "RadioDialog";

export default RadioDialog;
