export interface GetStripeCallbackAssociationArgs {
  launch_id: string;
  params: {
    stripe_checkout_id?: string;
  };
}

export interface StripeCallbackAssociationResponse {
  message?: string;
}