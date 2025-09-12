'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/ui/Header';
import LeagueManagement from '@/components/LeagueManagement';
import AppWrapper from '@/components/AppWrapper';

export default function LeaguesPage() {
  return (
    <AppWrapper>
      <div className="min-h-screen bg-slate-900">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-400 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">Manage Leagues</h1>
            <p className="text-gray-400">
              Create new leagues or join existing ones with invite codes.
            </p>
          </div>

          <LeagueManagement />
        </main>
      </div>
    </AppWrapper>
  );
}