import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const runtimeDataDir = join(process.cwd(), "data", "runtime");

export async function readJsonStore<T>(
	fileName: string,
	fallback: T,
): Promise<T> {
	const filePath = join(runtimeDataDir, fileName);

	try {
		const content = await readFile(filePath, "utf8");
		return JSON.parse(content) as T;
	} catch {
		return fallback;
	}
}

export async function writeJsonStore<T>(fileName: string, value: T) {
	const filePath = join(runtimeDataDir, fileName);
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2));
}
