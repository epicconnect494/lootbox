export const PERMISSIONS = [
  "admin.access",
  "inventory.read",
  "inventory.write",
  "packs.read",
  "packs.write",
  "packs.approve",
  "packs.publish",
  "battles.read",
  "battles.void",
  "races.read",
  "races.write",
  "races.settle",
  "raffles.read",
  "raffles.write",
  "raffles.draw",
  "fulfillment.read",
  "fulfillment.write",
  "marketplace.read",
  "marketplace.write",
  "users.read",
  "users.write",
  "risk.write",
  "finance.read",
  "finance.write",
  "audit.read",
  "fairness.reveal",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = {
  CUSTOMER: { name: "Customer", permissions: [] as Permission[] },
  SUPPORT: {
    name: "Support",
    permissions: ["admin.access", "users.read", "fulfillment.read", "fulfillment.write", "battles.read", "packs.read", "inventory.read", "audit.read", "raffles.read", "races.read", "marketplace.read"] as Permission[],
  },
  RISK: {
    name: "Risk & Compliance",
    permissions: ["admin.access", "users.read", "users.write", "risk.write", "battles.read", "battles.void", "audit.read", "races.read", "packs.read", "finance.read", "raffles.read", "inventory.read", "fairness.reveal"] as Permission[],
  },
  CATALOG_MANAGER: {
    name: "Catalog Manager",
    permissions: ["admin.access", "inventory.read", "inventory.write", "packs.read", "packs.write", "packs.publish", "races.read", "races.write", "raffles.read", "raffles.write", "marketplace.read", "audit.read", "battles.read"] as Permission[],
  },
  FINANCE: {
    name: "Finance",
    permissions: ["admin.access", "finance.read", "finance.write", "packs.read", "packs.approve", "audit.read", "users.read", "races.read", "races.settle", "raffles.read", "raffles.draw", "marketplace.read", "marketplace.write", "inventory.read", "battles.read", "fulfillment.read"] as Permission[],
  },
  SUPER_ADMIN: { name: "Super Admin", permissions: [...PERMISSIONS] as Permission[] },
} as const;
export type RoleKey = keyof typeof ROLES;
