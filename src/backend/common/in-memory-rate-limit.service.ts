import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

type Bucket = {
	count: number;
	resetAt: number;
};

@Injectable()
export class InMemoryRateLimitService {
	private readonly MAX_BUCKETS = 10_000;
	private readonly buckets = new Map<string, Bucket>();

	enforce(key: string, max: number, windowMs: number) {
		const now = Date.now();
		const existing = this.buckets.get(key);

		if (!existing || existing.resetAt <= now) {
			this.buckets.set(key, { count: 1, resetAt: now + windowMs });
			this.cleanup(now);
			return;
		}

		if (existing.count >= max) {
			throw new HttpException(
				"RATE_LIMIT_EXCEEDED",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		existing.count += 1;
	}

	private cleanup(now: number) {
		for (const [key, value] of this.buckets.entries()) {
			if (value.resetAt <= now) {
				this.buckets.delete(key);
			}
		}

		if (this.buckets.size > this.MAX_BUCKETS) {
			const firstKey = this.buckets.keys().next().value;
			if (firstKey) this.buckets.delete(firstKey);
		}
	}
}
