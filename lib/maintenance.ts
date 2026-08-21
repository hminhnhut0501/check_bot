export function isMaintenanceModeEnabled() {
  const value = process.env.APP_MAINTENANCE_MODE ?? process.env.GROUP_BOT_MAINTENANCE_MODE;
  return value === '1' || value?.toLowerCase() === 'true';
}

export function getMaintenanceMessage() {
  return process.env.APP_MAINTENANCE_MESSAGE ?? 'Hệ thống đang ở chế độ bảo trì ngắn hạn để nâng cấp độ ổn định.';
}
