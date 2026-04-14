const ADMIN_PERMISSIONS = {
  EVENT_CREATE: "event:create",
  EVENT_READ: "event:read",
  REGISTRATION_READ: "registration:read",
  COMMAND_VIEW: "command:view",
  SCAN_TICKET: "scan:ticket",
  LIVE_OPS_UPDATE: "live-ops:update",
  USER_BROADCAST: "user:broadcast",
  FOOD_MANAGE: "food:manage",
  FOOD_ORDER_MANAGE: "food-order:manage",
  EMERGENCY_MANAGE: "emergency:manage",
  SOCIAL_MANAGE: "social:manage",
  QUEUE_VIEW: "queue:view",
  QUEUE_MANAGE: "queue:manage",
  SIMULATOR_CONTROL: "simulator:control",
  NAVIGATION_MANAGE: "navigation:manage",
  ADMIN_APPROVAL: "admin:approval",
};

const DEFAULT_ADMIN_PERMISSIONS = [
  ADMIN_PERMISSIONS.EVENT_CREATE,
  ADMIN_PERMISSIONS.EVENT_READ,
  ADMIN_PERMISSIONS.REGISTRATION_READ,
  ADMIN_PERMISSIONS.COMMAND_VIEW,
  ADMIN_PERMISSIONS.SCAN_TICKET,
  ADMIN_PERMISSIONS.LIVE_OPS_UPDATE,
  ADMIN_PERMISSIONS.USER_BROADCAST,
  ADMIN_PERMISSIONS.FOOD_MANAGE,
  ADMIN_PERMISSIONS.FOOD_ORDER_MANAGE,
  ADMIN_PERMISSIONS.EMERGENCY_MANAGE,
  ADMIN_PERMISSIONS.SOCIAL_MANAGE,
  ADMIN_PERMISSIONS.QUEUE_VIEW,
  ADMIN_PERMISSIONS.QUEUE_MANAGE,
  ADMIN_PERMISSIONS.SIMULATOR_CONTROL,
  ADMIN_PERMISSIONS.NAVIGATION_MANAGE,
];

const ALL_ADMIN_PERMISSION_VALUES = [
  "*",
  ...Object.values(ADMIN_PERMISSIONS),
];

const hasPermission = (admin, permission) => {
  if (!admin || !permission) {
    return false;
  }

  if (admin.role === "super-admin") {
    return true;
  }

  const permissions =
    Array.isArray(admin.permissions) && admin.permissions.length > 0
      ? admin.permissions
      : DEFAULT_ADMIN_PERMISSIONS;

  if (
    permission === ADMIN_PERMISSIONS.USER_BROADCAST &&
    permissions.includes(ADMIN_PERMISSIONS.LIVE_OPS_UPDATE)
  ) {
    return true;
  }

  if (
    [ADMIN_PERMISSIONS.FOOD_MANAGE, ADMIN_PERMISSIONS.FOOD_ORDER_MANAGE].includes(permission) &&
    permissions.includes(ADMIN_PERMISSIONS.LIVE_OPS_UPDATE)
  ) {
    return true;
  }

  if (
    [ADMIN_PERMISSIONS.EMERGENCY_MANAGE, ADMIN_PERMISSIONS.SOCIAL_MANAGE].includes(permission) &&
    permissions.includes(ADMIN_PERMISSIONS.LIVE_OPS_UPDATE)
  ) {
    return true;
  }

  return permissions.includes("*") || permissions.includes(permission);
};

const getEffectivePermissions = (admin) => {
  if (!admin) {
    return [];
  }

  if (admin.role === "super-admin") {
    return ["*"];
  }

  if (Array.isArray(admin.permissions) && admin.permissions.length > 0) {
    return admin.permissions;
  }

  return DEFAULT_ADMIN_PERMISSIONS;
};

module.exports = {
  ADMIN_PERMISSIONS,
  ALL_ADMIN_PERMISSION_VALUES,
  DEFAULT_ADMIN_PERMISSIONS,
  hasPermission,
  getEffectivePermissions,
};
