"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateCheckoutMutation } from "@iblai/iblai-js/data-layer";
import type { PaywallPrice } from "@iblai/iblai-js/data-layer";
import { cn } from "@/lib/utils";

interface PaywallModalProps {
  pricing: {
    item_name: string;
    prices: PaywallPrice[];
  };
  platformKey: string;
  mentorId: string;
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatInterval(interval: string) {
  if (interval === "one_time") return "";
  return `/${interval}`;
}

export function PaywallModal({
  pricing,
  platformKey,
  mentorId,
}: PaywallModalProps) {
  useEffect(() => {
    console.log("[MONETIZATION] Paywall modal pricing ", { pricing });
  }, [pricing]);
  const [createCheckout, { isLoading: isCheckoutLoading }] =
    useCreateCheckoutMutation();
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  const activePrices = pricing.prices;

  const handleCheckout = async (price: PaywallPrice) => {
    setSelectedPriceId(price.id);
    try {
      const result = await createCheckout({
        platform_key: platformKey,
        item_type: "mentor",
        item_id: mentorId,
        price_id: price.id,
        success_url: window.location.href,
        cancel_url: window.location.href,
      }).unwrap();

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      setSelectedPriceId(null);
    }
  };

  return (
    <Dialog open modal>
      <DialogContent
        showCloseButton={false}
        className="max-w-5xl gap-6 overflow-y-auto max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl font-bold">
            Subscribe to {pricing.item_name}
          </DialogTitle>
          <DialogDescription>Choose a plan to get started</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "grid gap-6",
            activePrices.length === 1 && "grid-cols-1 max-w-sm mx-auto",
            activePrices.length === 2 && "grid-cols-1 sm:grid-cols-2",
            activePrices.length === 3 &&
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            activePrices.length >= 4 &&
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {activePrices.map((price) => (
            <div
              key={price.id}
              className="border rounded-lg p-6 flex flex-col gap-4 bg-background"
            >
              <div>
                <h3 className="text-lg font-semibold">{price.name}</h3>
                {price.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {price.description}
                  </p>
                )}
              </div>

              <div className="text-3xl font-bold">
                {formatPrice(price.amount, price.currency)}
                <span className="text-sm font-normal text-muted-foreground">
                  {formatInterval(price.interval)}
                </span>
              </div>

              <Button
                onClick={() => handleCheckout(price)}
                disabled={isCheckoutLoading}
                className="w-full"
              >
                {isCheckoutLoading && selectedPriceId === price.id
                  ? "Redirecting..."
                  : "Subscribe"}
              </Button>

              {price.features.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">This includes:</p>
                  <ul className="space-y-2">
                    {price.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
