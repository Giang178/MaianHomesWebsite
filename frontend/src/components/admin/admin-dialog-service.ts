export type AdminDialogRequest = { type: 'confirm' | 'reason'; title: string; description?: string; initialValue?: string; required?: boolean; confirmLabel?: string };
function requestAdminDialog<T extends boolean | string | null>(request: AdminDialogRequest): Promise<T> { return new Promise(resolve => { if (typeof window === 'undefined') { resolve((request.type === 'confirm' ? false : null) as T); return; } window.dispatchEvent(new CustomEvent('admin:dialog', { detail: { request, resolve } })); }); }
export function confirmAdminDialog(request: Omit<AdminDialogRequest, 'type'>): Promise<boolean> { return requestAdminDialog<boolean>({ ...request, type: 'confirm' }); }
export function reasonAdminDialog(request: Omit<AdminDialogRequest, 'type'>): Promise<string | null> { return requestAdminDialog<string | null>({ ...request, type: 'reason' }); }

export function noticeAdmin(message: string, tone: 'success'|'error'|'warning'|'info' = 'error'): void {
  if (typeof window === 'undefined') return;
  const inferredTone = tone === 'error' && /^(Đã|Tạo|Gửi|Cập nhật|Hoàn tất|Đăng|Khôi phục|Đã phê duyệt)/i.test(message) ? 'success' : tone;
  window.dispatchEvent(new CustomEvent('admin:notice', { detail: { message, tone: inferredTone } }));
}

export function adminConfirm(message: string): Promise<boolean> { return confirmAdminDialog({ title: 'Xác nhận thao tác', description: message }); }
export function adminPrompt(message: string): Promise<string|null> { return reasonAdminDialog({ title: 'Nhập lý do', description: message }); }
