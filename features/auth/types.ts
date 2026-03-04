export interface IntegratedProviderRequest {
  platform_key: string;
  username: string;
}

export interface IntegratedProviderResponse {
  providers: {
    slug: string;
    backend_uri: string;
  }[];
}
