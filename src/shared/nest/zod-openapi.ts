import type { z } from "zod";
import { getSwaggerMetadata } from "./zod-swagger-metadata";

type OpenApiSchema = Record<string, unknown>;

type ZodSchemaWithInternals = z.ZodTypeAny & {
	_def: {
		typeName: string;
		innerType?: z.ZodTypeAny;
		schema?: z.ZodTypeAny;
		defaultValue?: () => unknown;
		shape?: () => Record<string, z.ZodTypeAny>;
		type?: z.ZodTypeAny;
		valueType?: z.ZodTypeAny;
		options?: z.ZodTypeAny[];
		values?: readonly unknown[];
		value?: unknown;
		checks?: Array<Record<string, unknown>>;
	};
	description?: string;
	isOptional?: () => boolean;
};

function withMetadata(
	schema: ZodSchemaWithInternals,
	openApiSchema: OpenApiSchema,
	metadata: {
		defaultValue?: unknown;
		description?: string;
		nullable?: boolean;
	},
): OpenApiSchema {
	const result = { ...openApiSchema } as Record<string, unknown>;
	const swaggerMetadata = getSwaggerMetadata(schema);

	if (
		swaggerMetadata?.description ??
		metadata.description ??
		schema.description
	) {
		result.description =
			swaggerMetadata?.description ??
			metadata.description ??
			schema.description;
	}
	if (metadata.defaultValue !== undefined) {
		result.default = metadata.defaultValue;
	}
	if (swaggerMetadata?.example !== undefined) {
		result.example = swaggerMetadata.example;
	}
	if (metadata.nullable) {
		result.nullable = true;
	}

	return result;
}

function unwrapSchema(schema: z.ZodTypeAny) {
	let current = schema as ZodSchemaWithInternals;
	let defaultValue: unknown;
	let nullable = false;

	for (;;) {
		switch (current._def.typeName) {
			case "ZodDefault":
				defaultValue ??= current._def.defaultValue?.();
				current = current._def.innerType as ZodSchemaWithInternals;
				continue;
			case "ZodOptional":
				current = current._def.innerType as ZodSchemaWithInternals;
				continue;
			case "ZodNullable":
				nullable = true;
				current = current._def.innerType as ZodSchemaWithInternals;
				continue;
			case "ZodEffects":
				current = current._def.schema as ZodSchemaWithInternals;
				continue;
			default:
				return { schema: current, defaultValue, nullable };
		}
	}
}

function stringSchema(schema: ZodSchemaWithInternals): OpenApiSchema {
	const result: Record<string, unknown> = { type: "string" };

	for (const check of schema._def.checks ?? []) {
		switch (check.kind) {
			case "email":
				result.format = "email";
				break;
			case "url":
				result.format = "uri";
				break;
			case "min":
				result.minLength = check.value as number;
				break;
			case "max":
				result.maxLength = check.value as number;
				break;
		}
	}

	return result;
}

function numberSchema(schema: ZodSchemaWithInternals): OpenApiSchema {
	const result: Record<string, unknown> = { type: "number" };

	for (const check of schema._def.checks ?? []) {
		switch (check.kind) {
			case "int":
				result.type = "integer";
				break;
			case "min":
				result.minimum = check.value as number;
				break;
			case "max":
				result.maximum = check.value as number;
				break;
		}
	}

	return result;
}

export function zodToOpenApiSchema(schema: z.ZodTypeAny): OpenApiSchema {
	const { schema: unwrapped, defaultValue, nullable } = unwrapSchema(schema);

	let openApiSchema: OpenApiSchema;

	switch (unwrapped._def.typeName) {
		case "ZodString":
			openApiSchema = stringSchema(unwrapped);
			break;
		case "ZodNumber":
			openApiSchema = numberSchema(unwrapped);
			break;
		case "ZodBoolean":
			openApiSchema = { type: "boolean" };
			break;
		case "ZodDate":
			openApiSchema = { type: "string", format: "date-time" };
			break;
		case "ZodLiteral": {
			const value = unwrapped._def.value;
			openApiSchema =
				typeof value === "string"
					? { type: "string", enum: [value] }
					: typeof value === "number"
						? {
								type: Number.isInteger(value) ? "integer" : "number",
								enum: [value],
							}
						: typeof value === "boolean"
							? { type: "boolean", enum: [value] }
							: {};
			break;
		}
		case "ZodEnum":
			openApiSchema = {
				type: "string",
				enum: [...(unwrapped._def.values ?? [])] as string[],
			};
			break;
		case "ZodObject": {
			const shape = (unwrapped._def.shape?.() ?? {}) as Record<
				string,
				ZodSchemaWithInternals
			>;
			const properties = Object.fromEntries(
				Object.entries(shape).map(([key, value]) => [
					key,
					zodToOpenApiSchema(value),
				]),
			);
			const required = Object.entries(shape)
				.filter(([, value]) => !value.isOptional?.())
				.map(([key]) => key);

			openApiSchema = {
				type: "object",
				properties,
				...(required.length > 0 ? { required } : {}),
			};
			break;
		}
		case "ZodArray":
			openApiSchema = {
				type: "array",
				items: zodToOpenApiSchema(unwrapped._def.type as z.ZodTypeAny),
			};
			break;
		case "ZodRecord":
			openApiSchema = {
				type: "object",
				additionalProperties: zodToOpenApiSchema(
					unwrapped._def.valueType as z.ZodTypeAny,
				),
			};
			break;
		case "ZodUnion":
			openApiSchema = {
				oneOf: (unwrapped._def.options ?? []).map((option: z.ZodTypeAny) =>
					zodToOpenApiSchema(option),
				),
			};
			break;
		case "ZodUnknown":
			openApiSchema = {};
			break;
		default:
			openApiSchema = {};
			break;
	}

	return withMetadata(unwrapped, openApiSchema, {
		defaultValue,
		nullable,
	});
}

export function swaggerRequestBody(schema: z.ZodTypeAny) {
	return {
		schema: zodToOpenApiSchema(schema),
	};
}

export function swaggerResponse(
	schema: z.ZodTypeAny,
	options?: { description?: string },
) {
	return {
		...(options?.description ? { description: options.description } : {}),
		schema: zodToOpenApiSchema(schema),
	};
}
