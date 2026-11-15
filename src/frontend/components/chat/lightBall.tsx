import type React from "react";
import { FaMicrophone } from "react-icons/fa";
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";
import { PiSpinnerBold } from "react-icons/pi";

interface Props {
	listening: boolean;
	loading: boolean;
	speaking: boolean;
}

const LightBall: React.FC<Props> = ({ listening, loading, speaking }) => {
	const active = listening || loading || speaking;

	return (
		<div
			className="relative rounded-full ring-2 ring-white/50"
			style={{
				animation: !active ? "scaleInOut 2s ease-in-out infinite" : "none",
			}}
		>
			<div
				className="relative w-32 h-32 overflow-clip rounded-full transition-all duration-200"
				style={{
					animation: "spin 6s linear infinite",
					filter: active ? "grayscale(0)" : "grayscale(0.7)",
				}}
			>
				<div className="absolute inset-0 bg-gradient-to-r from-secondary via-primary to-accent rounded-full blur-xl opacity-75 animate-spin" />
				<div
					style={{ animation: "spin 3s linear infinite" }}
					className="absolute inset-0 bg-gradient-to-r from-secondary via-primary to-accent rounded-full blur-lg opacity-50"
				/>
				<div
					style={{ animation: "spin 2s linear infinite" }}
					className="absolute inset-0 bg-gradient-to-r from-secondary via-primary to-accent rounded-full blur-md opacity-25"
				/>
			</div>
			<div
				className={
					active
						? "w-full h-full absolute top-0 left-0 glass opacity-50 rounded-full transition-all duration-200"
						: "w-full h-full absolute top-0 left-0 glass opacity-50 rounded-full bg-base-200 transition-all duration-200"
				}
			/>
			<div className="w-full h-full absolute top-0 left-0 flex items-center justify-center text-5xl text-white">
				{listening ? (
					<div className="h-10 w-10 rounded-full bg-red-600 border-3 border-white" />
				) : loading ? (
					<span className="loading loading-spinner loading-lg" />
				) : speaking ? (
					<IoChatbubbleEllipsesOutline />
				) : (
					<FaMicrophone />
				)}
			</div>
			{!active && (
				<div
					className="w-full h-full absolute top-0 left-0 flex items-center justify-center text-6xl text-white"
					style={{
						animation: "customPing 2s cubic-bezier(0, 0, 0.2, 1) infinite",
					}}
				>
					<PiSpinnerBold />
				</div>
			)}
		</div>
	);
};

export default LightBall;
