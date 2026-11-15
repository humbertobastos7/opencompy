import type { z } from "zod";

export type SwaggerSchemaMetadata = {
	description?: string;
	example?: unknown;
};

const swaggerMetadata = new WeakMap<z.ZodTypeAny, SwaggerSchemaMetadata>();

export function withSwagger<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: SwaggerSchemaMetadata,
) {
	swaggerMetadata.set(schema, metadata);
	return schema;
}

export function getSwaggerMetadata(schema: z.ZodTypeAny) {
	return swaggerMetadata.get(schema);
}
