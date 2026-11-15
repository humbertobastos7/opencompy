import { customAlphabet } from "nanoid";

const alphabet = customAlphabet(
	"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
	4,
);

export function generateAccessCode() {
	return `${alphabet()}-${alphabet()}-${alphabet()}`;
}
