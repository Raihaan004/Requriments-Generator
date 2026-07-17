'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [status, setStatus] = useState<string>('Connecting...');
  const [responseDetails, setResponseDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkConnectivity = async () => {
    try {
      setStatus('Fetching...');
      setError(null);
      const res = await axios.get('http://localhost:8000/health');
      setResponseDetails(res.data);
      setStatus('Connected');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not reach backend');
      setStatus('Disconnected');
      setResponseDetails(null);
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">
            Requirements Generator
          </h1>
          <p className="text-slate-400 text-sm">
            Phase 0: Connectivity Verification
          </p>
        </div>

        <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Target Endpoint:</span>
            <span className="text-indigo-400">GET :8000/health</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Connection Status:</span>
            <span className={`font-semibold ${
              status === 'Connected' ? 'text-emerald-400' :
              status === 'Disconnected' ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {status}
            </span>
          </div>
          {responseDetails && (
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-slate-400 block mb-1">Response Data:</span>
              <pre className="text-emerald-300 bg-emerald-950/20 p-2 rounded border border-emerald-900/30 overflow-x-auto">
                {JSON.stringify(responseDetails)}
              </pre>
            </div>
          )}
          {error && (
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-rose-400 block mb-1">Error Details:</span>
              <p className="text-rose-300 text-xs bg-rose-950/20 p-2 rounded border border-rose-900/30 overflow-x-auto whitespace-pre-wrap">
                {error}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={checkConnectivity}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Check Connectivity
        </button>
      </div>
    </main>
  );
}
