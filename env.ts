import { z } from "zod/mini";

const envSchema = z.object({
    TODOIST_API_KEY: z.string(),
    TODOIST_SECTION_ID: z.string(),
    TODOIST_PROJECT_ID: z.string(),
});

export const env = envSchema.parse(process.env);
