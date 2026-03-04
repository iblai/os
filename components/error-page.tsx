"use client";

import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
// @ts-expect-error - error-utils module does not exist yet
import { getErrorData, type ErrorData } from "@/lib/error-utils";

interface ErrorPageProps {
  errorCode: string;
  customTitle?: string;
  customDescription?: string;
  customIcon?: React.ReactNode;
  showHomeButton?: boolean;
  homeButtonText?: string;
  homeButtonHref?: string;
}

export function ErrorPage({
  errorCode,
  customTitle,
  customDescription,
  customIcon,
  showHomeButton = true,
  homeButtonText = "Back to Home",
  homeButtonHref = "/",
}: ErrorPageProps) {
  // Get default error data based on error code
  const defaultErrorData: ErrorData = getErrorData(errorCode);

  // Use custom values if provided, otherwise use defaults
  const title = customTitle || defaultErrorData.title;
  const description = customDescription || defaultErrorData.description;
  const icon = customIcon || defaultErrorData.icon;

  console.error(
    `Error page shown to user: title --> ${title}, description --> ${description}`
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 md:flex-row md:gap-16">
        {/* Left side - Icon */}
        <div className="flex h-80 w-80 items-center justify-center rounded-full bg-gray-100">
          {icon}
        </div>

        {/* Right side - Error content */}
        <div className="flex flex-col items-center">
          <h1 className="text-9xl font-bold text-blue-5000 text-center">
            {errorCode}
          </h1>
          <h2 className="mt-8 text-4xl font-medium text-gray-500 text-center">
            {title}
          </h2>
          <p
            className="mt-8 max-w-md text-center text-gray-600"
            dangerouslySetInnerHTML={{ __html: description }}
          />

          {showHomeButton && (
            <Link href={homeButtonHref} className="mt-8">
              <Button className="bg-blue-500 hover:bg-blue-600">
                {homeButtonText}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Footer with logo */}
      <div className="mt-16 flex items-center justify-center">
        <div className="flex items-end justify-center text-sm text-gray-500">
          <span className="flex items-end h-6 text-xs">
            Powered by
            <Image
              src="/iblai-logo.png"
              alt="ibl.ai"
              width={43}
              height={19}
              className="h-4 w-auto mx-2 mb-1"
            />
            in New York
          </span>
        </div>
      </div>
    </div>
  );
}