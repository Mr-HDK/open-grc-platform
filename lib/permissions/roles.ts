export const roles = ["admin", "manager", "contributor", "viewer"] as const;

export type Role = (typeof roles)[number];

const roleRank: Record<Role, number> = {
  viewer: 0,
  contributor: 1,
  manager: 2,
  admin: 3,
};

export type Permission =
  | "view_dashboard"
  | "edit_records"
  | "manage_records"
  | "manage_frameworks"
  | "manage_users";

const minRoleByPermission: Record<Permission, Role> = {
  view_dashboard: "viewer",
  edit_records: "contributor",
  manage_records: "manager",
  manage_frameworks: "admin",
  manage_users: "admin",
};

export function isRole(value: string | null | undefined): value is Role {
  return Boolean(value && roles.includes(value as Role));
}

export function hasRole(required: Role, actual: Role | null | undefined) {
  if (!actual) {
    return false;
  }

  return roleRank[actual] >= roleRank[required];
}

export function can(permission: Permission, actual: Role | null | undefined) {
  return hasRole(minRoleByPermission[permission], actual);
}
