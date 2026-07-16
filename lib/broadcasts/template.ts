export function renderBroadcast(input: { displayName: string; entityType: string; riskLevel: string; riskScore: number; sourceCount: number; summary?: string; updatedAt?: string }) {
  return [
    '[CẢNH BÁO RỦI RO]',
    '',
    `Đối tượng: ${input.displayName}`,
    `Loại: ${input.entityType}`,
    `Mức độ: ${input.riskLevel.toUpperCase()} (${input.riskScore}/100)`,
    `Nguồn xác minh: ${input.sourceCount}`,
    input.summary ? `Thông tin: ${input.summary}` : '',
    `Cập nhật: ${input.updatedAt ?? new Date().toISOString()}`,
    '',
    'Thông tin mang tính cảnh báo cộng đồng, không thay thế kết luận pháp lý.',
  ].filter(Boolean).join('\n');
}
