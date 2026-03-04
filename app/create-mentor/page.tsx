'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateMentorModal } from '@/components/modals/create-mentor-modal';
import { hideInitialLoader } from '@/lib/initial-loader';

function CreateMentorContent() {
  const router = useRouter();

  return (
    <div>
      <CreateMentorModal isOpen={true} onClose={() => router.back()} />
    </div>
  );
}

export default function CreateMentor() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return (
    <Suspense fallback={null}>
      <CreateMentorContent />
    </Suspense>
  );
}
