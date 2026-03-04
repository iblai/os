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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-200 p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border border-gray-300">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-700">
            <Terminal className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">ibl.ai {appName}</h1>
          </div>

          <Separator className="my-4" />

          <p className="text-sm text-muted-foreground mb-2">Current Version</p>
          <Badge className="text-base px-4 py-1 rounded-full bg-green-100 text-green-700">
            {appVersion}
          </Badge>

          <div className="w-full text-center mt-auto py-4">
            <div className="flex items-end justify-center text-sm text-gray-500">
              <span className="flex items-end h-6 text-xs">
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
