import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Terminal } from 'lucide-react';

export function Version({
  appName,
  appVersion,
  poweredBy,
}: {
  appName: string;
  appVersion: string;
  poweredBy: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-blue-200 p-4">
      <Card className="w-full max-w-md rounded-2xl border border-gray-300 shadow-xl">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-700">
            <Terminal className="text-primary h-6 w-6" />
            <h1 className="text-2xl font-semibold tracking-tight">
              ibl.ai {appName}
            </h1>
          </div>

          <Separator className="my-4" />

          <p className="text-muted-foreground mb-2 text-sm">Current Version</p>
          <Badge className="rounded-full bg-green-100 px-4 py-1 text-base text-green-700">
            {appVersion}
          </Badge>

          <div className="mt-auto w-full py-4 text-center">
            <div className="flex items-end justify-center text-sm text-gray-500">
              <span className="flex h-6 items-end text-xs">
                Powered by
                {poweredBy}
                in New York
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
