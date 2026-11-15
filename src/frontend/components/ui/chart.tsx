"use client";
import * as echarts from "echarts";
import type { ElementEvent } from "echarts";
import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useEffect,
	useRef,
} from "react";

// const colorArray = ["oklch(var(--p))", "oklch(var(--s))", "oklch(var(--a))"];
const colorArray = ["#3DC2EA", "#E5B4FF", "#98EBF2", "#E3E3D4"];

export interface ChartEvent {
	componentIndex: number;
	componentSubType: string;
	componentType: string;
	dataIndex: number;
	name: string;
	seriesId?: string;
	seriesIndex?: number;
	seriesName?: string;
	seriesType?: string;
	type: string;
	value?: string | number;
	ctrl: boolean;
	event?: ElementEvent;
}

interface Props {
	options: echarts.EChartsCoreOption;
	instance?: Dispatch<SetStateAction<echarts.EChartsType | null>>;
	onClick?: (e: ChartEvent) => void;
	onLegendFilter?: (e: string) => void;
	onMouseOver?: (e: echarts.ECElementEvent) => void;
	onMouseMove?: (e: echarts.ECElementEvent) => void;
	onMouseOut?: (e: echarts.ECElementEvent) => void;
	renderer?: "canvas" | "svg";
	id?: string;
}

const ChartBase = ({
	options,
	onClick,
	instance,
	onLegendFilter,
	onMouseOver,
	onMouseMove,
	onMouseOut,
	renderer,
}: Props) => {
	const ref = useRef<HTMLDivElement>(null);
	let chart: echarts.ECharts;

	if (typeof window !== "undefined") {
		window.addEventListener("resize", () => {
			if (chart) {
				chart.resize();
			}
		});
	}

	const theme = {
		color: colorArray,
		backgroundColor: "rgba(0, 0, 0, 0)",
		textStyle: {},
		title: {
			textStyle: {
				color: "oklch(var(--bc))",
			},
			subtextStyle: {
				color: "#6E7079",
			},
		},
		line: {
			itemStyle: {
				borderWidth: 1,
			},
			lineStyle: {
				width: 2,
			},
			symbolSize: 4,
			symbol: "emptyCircle",
			smooth: false,
		},
		radar: {
			itemStyle: {
				borderWidth: 1,
			},
			lineStyle: {
				width: 2,
			},
			symbolSize: 4,
			symbol: "emptyCircle",
			smooth: false,
		},
		bar: {
			itemStyle: {
				barBorderWidth: 0,
				barBorderColor: "#ccc",
			},
		},
		pie: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		scatter: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		boxplot: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		parallel: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		sankey: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		funnel: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		gauge: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
		},
		candlestick: {
			itemStyle: {
				color: "#eb5454",
				color0: "#47b262",
				borderColor: "#eb5454",
				borderColor0: "#47b262",
				borderWidth: 1,
			},
		},
		graph: {
			itemStyle: {
				borderWidth: 0,
				borderColor: "#ccc",
			},
			lineStyle: {
				width: 1,
				color: "#aaa",
			},
			symbolSize: 4,
			symbol: "emptyCircle",
			smooth: false,
			color: colorArray,
			label: {
				color: "#eee",
			},
		},
		map: {
			itemStyle: {
				areaColor: "#eee",
				borderColor: "#444",
				borderWidth: 0.5,
			},
			label: {
				color: "oklch(var(--bc))",
			},
			emphasis: {
				itemStyle: {
					areaColor: "rgba(255,215,0,0.8)",
					borderColor: "#444",
					borderWidth: 1,
				},
				label: {
					color: "rgb(100,0,0)",
				},
			},
		},
		geo: {
			itemStyle: {
				areaColor: "#eee",
				borderColor: "#444",
				borderWidth: 0.5,
			},
			label: {
				color: "oklch(var(--bc))",
			},
			emphasis: {
				itemStyle: {
					areaColor: "rgba(255,215,0,0.8)",
					borderColor: "#444",
					borderWidth: 1,
				},
				label: {
					color: "rgb(100,0,0)",
				},
			},
		},
		categoryAxis: {
			axisLine: {
				show: true,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisTick: {
				show: true,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisLabel: {
				show: true,
				color: "oklch(var(--bc))",
			},
			splitLine: {
				show: false,
				lineStyle: {
					color: ["#E0E6F1"],
				},
			},
			splitArea: {
				show: false,
				areaStyle: {
					color: ["rgba(250,250,250,0.2)", "rgba(210,219,238,0.2)"],
				},
			},
		},
		valueAxis: {
			axisLine: {
				show: false,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisTick: {
				show: false,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisLabel: {
				show: true,
				color: "oklch(var(--bc))",
			},
			splitLine: {
				show: true,
				lineStyle: {
					color: ["oklch(var(--bc))"],
				},
			},
			splitArea: {
				show: false,
				areaStyle: {
					color: ["rgba(250,250,250,0.2)", "rgba(210,219,238,0.2)"],
				},
			},
		},
		logAxis: {
			axisLine: {
				show: false,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisTick: {
				show: false,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisLabel: {
				show: true,
				color: "oklch(var(--bc))",
			},
			splitLine: {
				show: true,
				lineStyle: {
					color: ["#E0E6F1"],
				},
			},
			splitArea: {
				show: false,
				areaStyle: {
					color: ["rgba(250,250,250,0.2)", "rgba(210,219,238,0.2)"],
				},
			},
		},
		timeAxis: {
			axisLine: {
				show: true,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisTick: {
				show: true,
				lineStyle: {
					color: "oklch(var(--bc))",
				},
			},
			axisLabel: {
				show: true,
				color: "oklch(var(--bc))",
			},
			splitLine: {
				show: false,
				lineStyle: {
					color: ["#E0E6F1"],
				},
			},
			splitArea: {
				show: false,
				areaStyle: {
					color: ["rgba(250,250,250,0.2)", "rgba(210,219,238,0.2)"],
				},
			},
		},
		toolbox: {
			iconStyle: {
				borderColor: "#999",
			},
			emphasis: {
				iconStyle: {
					borderColor: "#666",
				},
			},
		},
		legend: {
			textStyle: {
				color: "oklch(var(--b1))",
			},
		},
		tooltip: {
			backgroundColor: "oklch(var(--b3))",
			borderColor: "oklch(var(--b3))",
			borderRadius: 16,
			padding: 4,
			axisPointer: {
				lineStyle: {
					color: "#ccc",
					width: 1,
				},
				crossStyle: {
					color: "#ccc",
					width: 1,
				},
			},
			textStyle: {
				color: "oklch(var(--b1))",
			},
		},
		label: {
			color: "oklch(var(--b1))",
		},
		timeline: {
			lineStyle: {
				color: "#DAE1F5",
				width: 2,
			},
			itemStyle: {
				color: "#A4B1D7",
				borderWidth: 1,
			},
			controlStyle: {
				color: "#A4B1D7",
				borderColor: "#A4B1D7",
				borderWidth: 1,
			},
			checkpointStyle: {
				color: "#316bf3",
				borderColor: "fff",
			},
			label: {
				color: "#A4B1D7",
			},
			emphasis: {
				itemStyle: {
					color: "#FFF",
				},
				controlStyle: {
					color: "#A4B1D7",
					borderColor: "#A4B1D7",
					borderWidth: 1,
				},
				label: {
					color: "#A4B1D7",
				},
			},
		},
		visualMap: {
			color: ["#bf444c", "#d88273", "#f6efa6"],
		},
		dataZoom: {
			handleSize: "undefined%",
			textStyle: {},
		},
		markPoint: {
			label: {
				color: "#eee",
			},
			emphasis: {
				label: {
					color: "#eee",
				},
			},
		},
	};

	const renderChart = (
		ref: RefObject<HTMLDivElement | null>,
		renderer?: "canvas" | "svg",
	) => {
		if (ref?.current && ref.current.childElementCount === 0) {
			echarts.registerTheme("osb", theme);
			chart = echarts.init(ref.current, "osb", {
				renderer: renderer ? renderer : "svg",
			});
			chart.setOption({
				...options,
				animationDuration: options.animationDuration ?? 1000,
			});

			if (onClick) {
				chart.on("click", (e) => {
					onClick({
						...e,
						value: typeof e.value === "number" ? e.value : `${e.value}`,
						ctrl: e.event?.event.ctrlKey || false,
					});
				});
			}

			if (onLegendFilter) {
				chart.on("legendselectchanged", (e) => {
					const el = e as { name: string };
					onLegendFilter(el.name);
				});
			}

			if (onMouseOver) {
				chart.on("mouseover", (e) => {
					onMouseOver(e);
				});
			}

			if (onMouseMove) {
				chart.on("mousemove", (e) => {
					onMouseMove(e);
				});
			}

			if (onMouseOut) {
				chart.on("mouseout", (e) => {
					onMouseOut(e);
				});
			}

			if (instance) {
				instance(chart);
			}
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: ref is a ref object
	useEffect(() => {
		renderChart(ref, renderer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ref]);

	return <div ref={ref} className="w-full h-full" />;
};

const Chart = ({
	options,
	onClick,
	instance,
	fullscreenInstance,
	onLegendFilter,
	onMouseOver,
	onMouseOut,
	id,
}: Props & {
	fullscreenInstance?: Dispatch<SetStateAction<echarts.EChartsType | null>>;
}) => {
	if (!id) {
		return (
			<ChartBase
				id={id}
				instance={instance}
				options={options}
				onClick={onClick}
				onLegendFilter={onLegendFilter}
				onMouseOver={onMouseOver}
				onMouseOut={onMouseOut}
			/>
		);
	}

	return (
		<div className="p-2 w-full h-full">
			<ChartBase
				id={id}
				instance={fullscreenInstance}
				options={options}
				onClick={onClick}
				onLegendFilter={onLegendFilter}
				onMouseOver={onMouseOver}
				onMouseOut={onMouseOut}
			/>
		</div>
	);
};

export default Chart;
