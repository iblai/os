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
  open: boolean;
  onClose: () => void;
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
  open,
  onClose,
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
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-5xl gap-0 overflow-y-auto max-h-[90vh] p-8">
        <DialogHeader className="text-center sm:text-center mb-8">
          <DialogTitle className="text-3xl font-bold tracking-tight">
            Choose your plan
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-2">
            Subscribe to get access to {pricing.item_name}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "grid gap-5",
            activePrices.length === 1 && "grid-cols-1 max-w-sm mx-auto",
            activePrices.length === 2 &&
              "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto",
            activePrices.length === 3 &&
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            activePrices.length >= 4 &&
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {activePrices.map((price) => (
            <div
              key={price.id}
              className="rounded-xl bg-muted/50 p-6 flex flex-col gap-5"
            >
              <div>
                <h3 className="text-xl font-bold">{price.name}</h3>
                {price.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {price.description}
                  </p>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  {formatPrice(price.amount, price.currency)}
                </span>
                {price.interval !== "one_time" && (
                  <span className="text-sm text-muted-foreground">
                    {formatInterval(price.interval)}
                  </span>
                )}
              </div>

              <Button
                onClick={() => handleCheckout(price)}
                disabled={isCheckoutLoading}
                className="w-full h-11 text-sm font-medium"
              >
                {isCheckoutLoading && selectedPriceId === price.id
                  ? "Redirecting..."
                  : "Pay"}
              </Button>

              {price.features.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3">This includes:</p>
                  <ul className="space-y-3">
                    {price.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
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
