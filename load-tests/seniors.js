/**
 * Seniors & reports load test — simulates browsing the local senior's data and reports.
 *
 * Run:
 *   k6 run load-tests/seniors.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const errorRate = new Rate("errors");

export const options = {
	stages: [
		{ duration: "10s", target: 10 },
		{ duration: "40s", target: 30 },
		{ duration: "10s", target: 0 },
	],
	thresholds: {
		http_req_duration: ["p(95)<800"],
		errors: ["rate<0.02"],
	},
};

export default function () {
	const headers = { "Content-Type": "application/json" };

	// 1. List seniors
	const listRes = http.get(`${BASE_URL}/api/seniors`, { headers });
	const listOk = check(listRes, {
		"list seniors 200": (r) => r.status === 200,
		"returns array": (r) => Array.isArray(r.json()),
	});
	errorRate.add(!listOk);

	const seniors = listOk ? listRes.json() : [];
	if (seniors.length === 0) {
		sleep(1);
		return;
	}

	sleep(0.5);

	// 2. Get one senior profile
	const senior = seniors[Math.floor(Math.random() * seniors.length)];
	const seniorRes = http.get(`${BASE_URL}/api/seniors/${senior.id}`, {
		headers,
	});
	check(seniorRes, { "get senior 200": (r) => r.status === 200 });

	sleep(0.5);

	// 3. Get available report dates
	const datesRes = http.get(`${BASE_URL}/api/seniors/available-dates`, {
		headers,
	});
	check(datesRes, { "available dates 200": (r) => r.status === 200 });

	sleep(0.5);

	// 4. Fetch a report if dates exist
	const dateGroups = datesRes.status === 200 ? datesRes.json() : [];
	const group = dateGroups.find(
		(g) => g.seniorId === senior.id && g.dates.length > 0,
	);
	if (group) {
		const date = group.dates[Math.floor(Math.random() * group.dates.length)];
		const reportRes = http.get(
			`${BASE_URL}/api/seniors/${senior.id}/report/${date}`,
			{ headers },
		);
		check(reportRes, { "report 200": (r) => r.status === 200 });
	}

	sleep(1);
}
