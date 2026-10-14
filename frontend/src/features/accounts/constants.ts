export const PERMISSION_GROUPS = [
  {
    key: 'pages',
    label: 'Nội dung website',
    description: 'Trang, SEO và tham số GEO',
    values: [
      'website.dashboard.read',
      'website.pages.read',
      'website.pages.create',
      'website.pages.update',
      'website.pages.review',
      'website.pages.publish',
      'website.pages.unpublish',
      'website.seo.read',
      'website.seo.update',
      'website.seo.publish',
      'website.geo.read',
      'website.geo.update',
      'website.geo.publish',
    ],
  },
  {
    key: 'articles',
    label: 'Dự án và bài viết',
    description: 'Dự án BĐS và bài viết tin tức',
    values: [
      'website.projects.read',
      'website.projects.create',
      'website.projects.update',
      'website.projects.publish',
      'website.projects.delete',
      'website.articles.read',
      'website.articles.create',
      'website.articles.update',
      'website.articles.publish',
      'website.articles.delete',
    ],
  },
  {
    key: 'team',
    label: 'Đội ngũ & tuyển dụng',
    description: 'Nhân sự công khai và tin tuyển dụng',
    values: [
      'website.staff.read',
      'website.staff.create',
      'website.staff.update',
      'website.staff.publish',
      'website.staff.archive',
      'website.staff.delete',
      'website.recruitment.read',
      'website.recruitment.create',
      'website.recruitment.update',
      'website.recruitment.publish',
      'website.recruitment.archive',
    ],
  },
  {
    key: 'branding',
    label: 'Thương hiệu & media',
    description: 'Nhận diện thương hiệu và thư viện ảnh',
    values: [
      'website.branding.read',
      'website.branding.update',
      'website.branding.publish',
      'website.media.read',
      'website.media.upload',
      'website.media.update',
      'website.media.delete',
    ],
  },
  {
    key: 'leads',
    label: 'Lead, thống kê & quản trị',
    description: 'Khách hàng, analytics, tài khoản và hệ thống',
    values: [
      'website.leads.read',
      'website.leads.update',
      'website.leads.archive',
      'website.leads.export',
      'website.leads.delete',
      'website.analytics.read',
      'website.accounts.read',
      'website.accounts.create',
      'website.accounts.update',
      'website.accounts.disable',
      'website.permissions.manage',
      'website.audit.read',
      'website.system.monitoring.read',
      'website.system.monitoring.run',
      'website.system.email.read',
      'website.system.email.update',
      'website.system.email.test',
    ],
  },
  {
    key: 'workspaces',
    label: 'Dịch vụ (Workspace)',
    description: 'Co-working Space và Maian Office',
    values: [
      'website.workspaces.read',
      'website.workspaces.update',
      'website.workspaces.publish',
      'website.workspaces.delete',
    ],
  },
] as const;

export const MARKETING_DEFAULTS = PERMISSION_GROUPS.flatMap((group) => group.values).filter(
  (permission) =>
    !permission.includes('.publish') &&
    !permission.endsWith('.delete') &&
    !permission.startsWith('website.leads.') &&
    !permission.startsWith('website.accounts.') &&
    permission !== 'website.permissions.manage' &&
    permission !== 'website.audit.read',
);

const DOMAIN_LABELS: Record<string, string> = {
  dashboard: 'Tổng quan website',
  pages: 'Nội dung trang',
  seo: 'SEO',
  geo: 'GEO',
  branding: 'Thương hiệu',
  media: 'Thư viện ảnh',
  projects: 'Dự án BĐS',
  articles: 'Bài viết tin tức',
  staff: 'Đội ngũ nhân sự',
  recruitment: 'Tuyển dụng',
  workspaces: 'Dịch vụ',
  leads: 'Khách hàng',
  analytics: 'Thống kê truy cập',
  accounts: 'Tài khoản',
  permissions: 'Phân quyền',
  audit: 'Nhật ký kiểm toán',
  system: 'Hệ thống',
  company_email: 'Email công ty',
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Xem',
  create: 'Tạo',
  update: 'Sửa',
  review: 'Duyệt',
  publish: 'Xuất bản',
  unpublish: 'Gỡ bài',
  upload: 'Tải lên',
  archive: 'Lưu trữ',
  export: 'Xuất tệp',
  delete: 'Xóa',
  disable: 'Khóa',
  manage: 'Quản lý',
  run: 'Chạy kiểm tra',
  test: 'Gửi thử nghiệm',
};

export function permissionLabel(permission: string): string {
  const parts = permission.split('.');
  const domain = parts[1] === 'system' && parts[2] === 'email' ? 'company_email' : parts[1];
  const action = parts.at(-1) || '';
  return `${ACTION_LABELS[action] || action} ${DOMAIN_LABELS[domain] || domain}`;
}

export function permissionAllowedForRole(permission: string, role: string): boolean {
  if (role !== 'MARKETING') return true;
  if (permission.startsWith('website.branding.') || permission.startsWith('website.media.')) return false;
  return !permission.startsWith('website.pages.') || permission === 'website.pages.read';
}

export function getPermissionRiskLevel(permission: string): 'safe' | 'medium' | 'sensitive' {
  if (permission.endsWith('.delete') || permission.endsWith('.disable') || permission.includes('.permissions.')) {
    return 'sensitive';
  }
  if (permission.includes('.publish') || permission.includes('.export') || permission.includes('.upload') || permission.includes('.update') || permission.includes('.create')) {
    return 'medium';
  }
  return 'safe';
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa đăng nhập';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function resolvePermissionToggle(
  current: string[],
  permission: string,
  dependencies: Record<string, string[]>
): string[] {
  const selected = new Set(current);
  if (selected.has(permission)) {
    selected.delete(permission);
    let changed = true;
    while (changed) {
      changed = false;
      for (const granted of [...selected]) {
        if ((dependencies[granted] || []).some((required) => !selected.has(required))) {
          selected.delete(granted);
          changed = true;
        }
      }
    }
  } else {
    selected.add(permission);
    const addRequirements = (item: string) => {
      for (const required of dependencies[item] || []) {
        if (!selected.has(required)) {
          selected.add(required);
          addRequirements(required);
        }
      }
    };
    addRequirements(permission);
  }
  return [...selected].sort();
}
