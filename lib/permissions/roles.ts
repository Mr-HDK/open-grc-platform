export const roles = ["admin", "manager", "contributor", "viewer"] as const;

export type Role = (typeof roles)[number];

const roleRank: Record<Role, number> = {
  viewer: 0,
  contributor: 1,
  manager: 2,
  admin: 3,
};

export function hasRole(required: Role, actual: Role | null | undefined) {
  if (!actual) {
    return false;
  }

  return roleRank[actual] >= roleRank[required];
}
