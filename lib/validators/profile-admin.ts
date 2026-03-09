import { z } from "zod";

import { roles } from "@/lib/permissions/roles";

export const profileStatuses = ["active", "invited", "deactivated"] as const;

export type ProfileStatus = (typeof profileStatuses)[number];

export const updateProfileRoleSchema = z.object({
  profileId: z.string().uuid("Invalid profile identifier."),
  role: z.enum(roles, {
    error: "Role must be admin, manager, contributor, or viewer.",
  }),
});

export type UpdateProfileRoleInput = z.infer<typeof updateProfileRoleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  fullName: z.string().trim().max(120, "Name is too long.").optional().or(z.literal("")),
  role: z.enum(roles, {
    error: "Role must be admin, manager, contributor, or viewer.",
  }),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateProfileStatusSchema = z.object({
  profileId: z.string().uuid("Invalid profile identifier."),
  status: z.enum(profileStatuses, {
    error: "Status must be active, invited, or deactivated.",
  }),
});

export type UpdateProfileStatusInput = z.infer<typeof updateProfileStatusSchema>;

export const transferOwnershipSchema = z.object({
  profileId: z.string().uuid("Invalid profile identifier."),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
