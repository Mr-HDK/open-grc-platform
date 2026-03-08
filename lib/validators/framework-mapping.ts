import { z } from "zod";

export const frameworkControlIdSchema = z.string().uuid();

export const frameworkRequirementIdsSchema = z.array(z.string().uuid()).max(80);
