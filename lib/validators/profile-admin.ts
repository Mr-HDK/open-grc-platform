import { z } from "zod";

import { roles } from "@/lib/permissions/roles";

export const updateProfileRoleSchema = z.object({
  profileId: z.string().uuid("Invalid profile identifier."),
  role: z.enum(roles, {
    error: "Role must be admin, manager, contributor, or viewer.",
  }),
});

export type UpdateProfileRoleInput = z.infer<typeof updateProfileRoleSchema>;
