'use client';

import { useUserStore } from '@/stores/userStore';
import Login from '@/components/Login';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/leagues');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // This shouldn't render since we redirect above, but just in case
  return null;
}
