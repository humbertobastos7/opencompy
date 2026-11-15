import type { ReactElement } from "react";
import { CiPill } from "react-icons/ci";
import { TbAlarmFilled } from "react-icons/tb";
import { FaGamepad, FaRadio } from "react-icons/fa6";
import { FaInfoCircle } from "react-icons/fa";

interface ItemProps {
	icon: ReactElement;
	id: number;
	selected: number;
	setSelected: (v: number) => void;
	disabled?: boolean;
}

const BottomBarItem = ({
	icon,
	id,
	selected,
	setSelected,
	disabled,
}: ItemProps) => {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={() =>
				!disabled && (id === selected ? setSelected(0) : setSelected(id))
			}
			onMouseDown={(e) => {
				e.currentTarget.style.transform = "scale(0.90)";
				e.currentTarget.style.transition = "transform 100ms ease";
			}}
			onMouseUp={(e) => {
				e.currentTarget.style.transform = "scale(1)";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.transform = "scale(1)";
			}}
			className={
				id === selected
					? "h-[4.5rem] w-[4.5rem] bg-base-300 rounded-full flex items-center justify-center transition-all pb-6"
					: "h-14 w-14 bg-base-200 rounded-full flex items-center justify-center transition-all"
			}
		>
			<div
				className={
					id === selected
						? "h-[4.5rem] w-[4.5rem] text-base-100 bg-secondary border-4 border-base-300 rounded-full flex items-center justify-center transition-all"
						: disabled
							? "h-full w-full text-neutral-300 bg-base-300 rounded-full flex items-center justify-center transition-all"
							: "h-full w-full text-accent bg-base-300 rounded-full flex items-center justify-center transition-all hover:bg-secondary/30 border-4 border-base-300"
				}
			>
				<span className={id === selected ? "scale-125" : "scale-100"}>
					{icon}
				</span>
			</div>
		</button>
	);
};

interface Props {
	selected: number;
	setSelected: (v: number) => void;
	disabled?: boolean;
	short?: boolean;
}

const BottomBar = ({ selected, setSelected, disabled, short }: Props) => {
	return (
		<div className="relative h-20 w-96">
			<div className="absolute bottom-0 left-0 h-14 w-full bg-base-300 rounded-full" />

			<div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-between">
				{!short && (
					<BottomBarItem
						id={1}
						icon={<FaInfoCircle size={28} />}
						selected={selected}
						setSelected={setSelected}
						disabled={disabled}
					/>
				)}

				<BottomBarItem
					id={short ? 1 : 2}
					icon={<FaGamepad size={34} />}
					selected={selected}
					setSelected={setSelected}
					disabled={disabled}
				/>

				{!short && (
					<BottomBarItem
						id={3}
						icon={<FaRadio size={28} />}
						selected={selected}
						setSelected={setSelected}
						disabled={disabled}
					/>
				)}

				<BottomBarItem
					id={short ? 2 : 4}
					icon={<CiPill size={30} />}
					selected={selected}
					setSelected={setSelected}
					disabled={disabled}
				/>

				<BottomBarItem
					id={short ? 3 : 5}
					icon={<TbAlarmFilled size={32} />}
					selected={selected}
					setSelected={setSelected}
					disabled={disabled}
				/>
			</div>
		</div>
	);
};

export default BottomBar;
