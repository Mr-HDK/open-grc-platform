import { z } from "zod";

export const commentEntityOptions = ["risk", "control", "action_plan"] as const;

export type CommentEntity = (typeof commentEntityOptions)[number];

export const createCommentSchema = z.object({
  entityType: z.enum(commentEntityOptions, {
    error: "Invalid comment entity.",
  }),
  entityId: z.string().uuid("Invalid entity identifier."),
  body: z
    .string()
    .trim()
    .min(3, "Comment must be at least 3 characters.")
    .max(2000, "Comment must be under 2000 characters."),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
