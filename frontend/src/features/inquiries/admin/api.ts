import { websiteAdminApi } from '@/features/website/admin/api';

export const inquiriesAdminApi = websiteAdminApi.leads;
export {
  downloadLeadExport,
  downloadLeadImagesZip,
} from '@/features/website/admin/api';
export type { WebsiteLead, WebsiteLeadCounts } from '@/features/website/admin/api';
