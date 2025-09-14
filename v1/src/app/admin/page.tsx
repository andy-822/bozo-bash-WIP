'use client';

import { useState } from 'react';
import Header from '@/components/ui/Header';
import AppWrapper from '@/components/AppWrapper';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    gamesProcessed?: number;
    timestamp?: string;
    error?: string;
  } | null>(null);
  const [usage, setUsage] = useState<{
    currentMonthUsage?: number;
    remainingRequests?: number;
    canMakeRequest?: boolean;
    nextSyncRecommended?: string;
    error?: string;
  } | null>(null);

  const handleSyncOdds = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/sync-odds', {
        method: 'POST'
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkUsage = async () => {
    try {
      const response = await fetch('/api/sync-odds');
      const data = await response.json();
      setUsage(data);
    } catch (error) {
      setUsage({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <AppWrapper>
      <div className="min-h-screen bg-slate-900">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">
              Test odds API integration and monitor usage.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Odds Sync Testing */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
              <h2 className="text-xl font-semibold text-white mb-4">Test Odds Sync</h2>
              
              <div className="space-y-4">
                <button
                  onClick={handleSyncOdds}
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    loading 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loading ? 'Syncing Odds...' : 'Sync NFL Odds Now'}
                </button>

                {result && (
                  <div className={`p-4 rounded-lg ${
                    result.success 
                      ? 'bg-green-500/20 border border-green-500/30' 
                      : 'bg-red-500/20 border border-red-500/30'
                  }`}>
                    <pre className="text-sm text-white whitespace-pre-wrap">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Usage Monitoring */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
              <h2 className="text-xl font-semibold text-white mb-4">API Usage Monitor</h2>
              
              <div className="space-y-4">
                <button
                  onClick={checkUsage}
                  className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Check Current Usage
                </button>

                {usage && (
                  <div className="p-4 bg-slate-900 rounded-lg">
                    {usage.error ? (
                      <p className="text-red-400">{usage.error}</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">This Month:</span>
                          <span className="text-white font-medium">{usage.currentMonthUsage || 0} requests</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Remaining:</span>
                          <span className="text-white font-medium">{usage.remainingRequests || 500} requests</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Can Make Request:</span>
                          <span className={`font-medium ${usage.canMakeRequest ? 'text-green-400' : 'text-red-400'}`}>
                            {usage.canMakeRequest ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Next Sync:</span>
                          <span className="text-white font-medium">{usage.nextSyncRecommended}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-600">
            <h2 className="text-xl font-semibold text-white mb-4">Setup Instructions</h2>
            <div className="text-gray-300 space-y-2 text-sm">
              <p><strong>Step 1:</strong> Add your Odds API key to <code className="bg-slate-700 px-1 rounded">.env.local</code></p>
              <p><strong>Step 2:</strong> Run the database schema from <code className="bg-slate-700 px-1 rounded">odds-schema.sql</code></p>
              <p><strong>Step 3:</strong> Click &quot;Sync NFL Odds Now&quot; to test the integration</p>
              <p><strong>Step 4:</strong> Click &quot;Check Current Usage&quot; to monitor your API consumption</p>
            </div>
          </div>
        </main>
      </div>
    </AppWrapper>
  );
}