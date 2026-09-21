// src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Bus, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-6">
        <Bus className="w-8 h-8" />
      </div>
      <span className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">404 Error</span>
      <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
        Transit Stop Not Found
      </h1>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-8">
        The route or dashboard view you are attempting to reach does not exist or has been relocated in the network schedule.
      </p>

      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="primary" icon={ArrowLeft}>
            Back to Home
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" className="bg-slate-800 text-white border-slate-700">
            Sign In Portal
          </Button>
        </Link>
      </div>
    </div>
  );
}
