import { websiteAdminApi } from '@/features/website/admin/api';

export const teamAdminApi = websiteAdminApi.staff;
export type {
  PublicStaffDraft,
  PublicStaffOptions,
  PublicStaffRecord,
  StaffAvatarUpload,
} from '@/features/website/admin/api';
