'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useGetStripeCallbackAssociationQuery } from '@/features/provider-association/api-slice';
import { hideInitialLoader } from '@/lib/initial-loader';

interface PageProps {
  params: Promise<{
    launch_id: string;
  }>;
}

export default function ProviderAssociationStripeCallback({
  params,
}: PageProps) {
  const resolvedParams = React.use(params);
  const { launch_id } = resolvedParams;
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    hideInitialLoader();
  }, []);
  const stripeCheckoutId = searchParams.get('stripe_checkout_id') || '';
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const redirectionDelay = 10000;
  const {
    isLoading,
    isError,
    isSuccess: isSuccessfullyAssociated,
  } = useGetStripeCallbackAssociationQuery({
    launch_id,
    params: { stripe_checkout_id: stripeCheckoutId },
  });

  const handleStripeAssociationCheckout = async () => {
    setLoaded(true);
    if (isSuccessfullyAssociated) {
      setTimeout(() => {
        router.push('/');
      }, redirectionDelay);
    } else {
      setError(true);
    }
  };

  useEffect(() => {
    if (!isLoading && (isError || isSuccessfullyAssociated)) {
      handleStripeAssociationCheckout();
    }
  }, [isLoading, isSuccessfullyAssociated, isError]);

  const handleGoBack = () => {
    router.push('/');
  };

  const Logo = () => (
    <div className="relative z-50 mt-6 mb-8 flex w-full justify-center">
      <Image
        src="/logo.gif"
        alt="Logo"
        width={240}
        height={60}
        className="h-[60px] object-contain"
      />
    </div>
  );

  if (!loaded) {
    return (
      <div>
        <Logo />
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin" />
            <p className="text-lg font-medium">Association in progress...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Logo />
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <div className="bg-destructive mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-semibold">Association failed</h2>
            <p className="text-muted-foreground mb-6">
              An error occurred while associating your account.
            </p>
            <Button onClick={handleGoBack} variant="destructive">
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Logo />
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-6">
            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-green-500">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-semibold">
            Association successful!
          </h2>
          <p className="text-muted-foreground mb-4">
            You&apos;ll be redirected to the app in a few seconds.
          </p>
          <Button onClick={handleGoBack} variant="default">
            Go to app
          </Button>
        </div>
      </div>
    </div>
  );
}
