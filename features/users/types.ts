export interface ProfileImage {
  has_image: boolean;
  image_url_full: string;
  image_url_large: string;
  image_url_medium: string;
  image_url_small: string;
}

export interface UserProfile {
  account_privacy: 'private' | 'public';
  profile_image: ProfileImage;
  username: string;
  bio: string | null;
  course_certificates: string | null;
  country: string | null;
  date_joined: string;
  language_proficiencies: string[];
  level_of_education: string | null;
  social_links: string[];
  time_zone: string | null;
  accomplishments_shared: boolean;
  name: string;
  email: string;
  id: number;
  verified_name: string | null;
  extended_profile: unknown[];
  gender: string | null;
  state: string | null;
  goals: string | null;
  is_active: boolean;
  last_login: string;
  mailing_address: string | null;
  requires_parental_consent: boolean;
  secondary_email: string | null;
  secondary_email_enabled: boolean | null;
  year_of_birth: number | null;
  phone_number: string | null;
  activation_key: string | null;
  pending_name_change: boolean | null;
}

export type GetUserMetadataArgs = {
  params: {
    username: string;
  };
};
