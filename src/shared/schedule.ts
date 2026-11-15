import dayjs from "dayjs";

/** Unit of time for scheduling intervals */
export type ScheduleUnit = "day" | "week";

/**
 * Configuration options for creating a schedule
 * @interface
 */
export interface ScheduleOptions {
	/** Number of units between occurrences */
	interval: number;
	/** Unit of time for the interval */
	unit: ScheduleUnit;
	/** Array of times in 24-hour format (HH:MM) */
	times: string[];
	/** Optional start date for the schedule */
	startDate?: dayjs.Dayjs;
}

/**
 * Creates a human-readable schedule expression string
 * @param {ScheduleOptions} options - The schedule configuration
 * @returns {string} A formatted schedule expression (e.g., "every 2 days at 09:00 and 18:00")
 * @throws {Error} If interval is less than 1 or times array is empty
 * @example
 * createScheduleExpression({
 *   interval: 2,
 *   unit: "day",
 *   times: ["09:00", "18:00"]
 * }) // returns "every 2 days at 09:00 and 18:00"
 */
export function createScheduleExpression({
	interval,
	unit,
	times,
	startDate,
}: ScheduleOptions): string {
	// Validate inputs
	if (interval < 1) throw new Error("Interval must be positive");
	if (!times.length) throw new Error("At least one time must be provided");
	if (!times.every((time) => TIME_FORMAT_REGEX.test(time))) {
		throw new Error("All times must be in HH:MM format");
	}

	// Sort times chronologically
	const sortedTimes = [...times].sort();

	// Pluralize unit if interval > 1
	const unitStr = interval === 1 ? unit : `${unit}s`;

	// Build base expression
	let expr = `every ${interval} ${unitStr} at ${sortedTimes.join(" and ")}`;

	// Add start date if provided
	if (startDate) {
		expr += ` starting at ${startDate.format("DD/MM/YYYY")}`;
	}

	return expr;
}

// Cache regex patterns
const EXPRESSION_REGEX =
	/every (\d+) (days?|weeks?) at ((?:\d{2}:\d{2}(?: and )?)+)(?:\s+starting at (\d{2}\/\d{2}\/\d{4}))?/i;
const TIME_FORMAT_REGEX = /^\d{2}:\d{2}$/;

function getOccurrenceHelper(
	expression: string,
	lookingForward: boolean,
	count = 10000,
): Date[] {
	const match = expression.match(EXPRESSION_REGEX);
	if (!match) {
		throw new Error(
			'Invalid expression format. Expected "every X days/weeks at HH:MM (and HH:MM)*" with optional "starting at DD/MM/YYYY"',
		);
	}

	const interval = Number.parseInt(match[1], 10);
	const unit = match[2].toLowerCase().startsWith("w") ? "week" : "day";
	const times = match[3].split(" and ").sort();
	const now = dayjs().startOf("minute");

	// Pre-calculate start date once
	const startDate = match[4]
		? dayjs(match[4].split("/").reverse().join("-")).startOf("day")
		: now.startOf("day");

	const occurrences: Date[] = [];
	let currentDate = startDate;

	// Pre-calculate time values
	const timeValues = times.map((time) => {
		const [hours, minutes] = time.split(":").map(Number);
		return { hours, minutes };
	});

	while (occurrences.length < count) {
		for (const { hours, minutes } of timeValues) {
			const date = currentDate.hour(hours).minute(minutes).second(0).toDate();

			if (lookingForward ? date > now.toDate() : true) {
				occurrences.push(date);
				if (occurrences.length >= count) break;
			}
		}

		currentDate = currentDate.add(interval, unit);
	}

	return occurrences;
}

/**
 * Gets the next occurrence of a schedule after a specified date
 * @param {string} expression - The schedule expression to parse
 * @param {Date} [after=new Date()] - The date to start looking from
 * @returns {Date|undefined} The next occurrence date or undefined if none found
 * @example
 * getNextOccurrence("every 1 day at 09:00")
 */
export function getNextOccurrence(
	expression: string,
	after: Date = new Date(),
) {
	const dates = getOccurrenceHelper(expression, true);
	return dates.find((date) => date > after);
}

/**
 * Gets the previous occurrence of a schedule before a specified date
 * @param {string} expression - The schedule expression to parse
 * @param {Date} [before=new Date()] - The date to look before
 * @returns {Date|undefined} The previous occurrence date or undefined if none found
 * @example
 * getPreviousOccurrence("every 1 day at 09:00")
 */
export function getPreviousOccurrence(expression: string, before = new Date()) {
	const dates = getOccurrenceHelper(expression, false);
	return dates.reverse().find((date) => date < before);
}

/**
 * Parses a schedule expression string back into ScheduleOptions
 * @param {string} expression - The schedule expression to parse
 * @returns {ScheduleOptions} The parsed schedule options
 * @throws {Error} If the expression format is invalid
 * @example
 * parseScheduleExpression("every 2 days at 09:00 and 18:00")
 */
export function parseScheduleExpression(expression: string): ScheduleOptions {
	const match = expression.match(EXPRESSION_REGEX);

	if (!match) {
		throw new Error(
			'Invalid expression format. Expected "every X days/weeks at HH:MM (and HH:MM)*" with optional "starting at DD/MM/YYYY"',
		);
	}

	const interval = Number.parseInt(match[1], 10);
	const unit = match[2].toLowerCase().startsWith("w")
		? "week"
		: ("day" as ScheduleUnit);
	const times = match[3].split(" and ").sort();

	const options: ScheduleOptions = {
		interval,
		unit,
		times,
	};

	if (match[4]) {
		// match[5] contains the date part if present
		const [day, month, year] = match[4].split("/").map(Number);
		options.startDate = dayjs(
			`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
		);
	}

	return options;
}

// // Example usage
// const now = performance.now();
// console.log("____multiple times per day_____");
// const dailyExpr = createScheduleExpression({
// 	interval: 3,
// 	unit: "day",
// 	times: ["09:00", "18:00", "21:00"],
// 	startDate: dayjs("2025-01-13"),
// });
// console.log(`Expression: ${dailyExpr}`);
// const next = getNextOccurrence(dailyExpr);
// const prev = getPreviousOccurrence(dailyExpr);
// console.log(`Execution time: ${performance.now() - now} milliseconds`);
// console.log(`Next occurrence: ${next}`);
// console.log(`prev occurrence: ${prev}`);

// console.log("\n___multiple times per week___");
// const weeklyExpr = createScheduleExpression({
// 	interval: 1,
// 	unit: "week",
// 	times: ["09:00", "18:00"],
// });
// console.log(`Expression: ${weeklyExpr}`);
// getNextFiveOccurrences(weeklyExpr);

// const monthExpr = createScheduleExpression({
// 	interval: 4,
// 	unit: "week",
// 	times: ["09:00", "18:00"],
// 	startDate: dayjs("2025-01-13"),
// });
// console.log(`Expression: ${monthExpr}`);
// getNextFiveOccurrences(monthExpr);
