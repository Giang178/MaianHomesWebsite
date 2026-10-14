export type PublicContactSettings = {
  phone: string | null;
  phone_href: string | null;
  zalo_oa_id?: string | null;
  zalo_url?: string | null;
  messenger_url: string | null;
  email: string | null;
  email_href: string | null;
};

export const EMPTY_CONTACT_SETTINGS: PublicContactSettings = {
  phone: null,
  phone_href: null,
  zalo_oa_id: null,
  zalo_url: null,
  messenger_url: null,
  email: null,
  email_href: null,
};
