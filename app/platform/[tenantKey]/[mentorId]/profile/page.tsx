'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <div className="p-6">
      {/* <Button onClick={() => setIsModalOpen(true)}>Edit Profile</Button> */}
      {/* <UserProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      /> */}
    </div>
  );
}
