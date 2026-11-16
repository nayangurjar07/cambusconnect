// src/pages/Landing.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bus, 
  Map, 
  QrCode, 
  ShieldCheck, 
  Users, 
  Radio, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useTenant } from '../contexts/TenantContext';

export function LandingPage() {
  const { tenant } = useTenant();
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cambus-cookie-consent');
    if (!consent) {
      setShowCookieBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cambus-cookie-consent', 'accepted');
    setShowCookieBanner(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gray-900 flex items-center justify-center text-white">
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-base text-gray-900">Cambus Connect</span>
            <span className="hidden sm:inline text-xs text-gray-500 font-medium ml-2">Campus Mobility</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="primary" size="sm">
              Launch Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 border-b border-gray-100 bg-gray-50/50 flex-1 flex flex-col items-center justify-center text-center">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            University Transit & Fleet Operations
          </div>

          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Campus transit management, <br className="hidden sm:inline" />
            built for reliability.
          </h1>

          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Real-time GPS tracking, paperless digital boarding passes, and multi-tenant fleet administration designed specifically for educational institutions.
          </p>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button variant="primary" size="md" icon={ArrowRight}>
                Enter Portal
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="md">
                View Features
              </Button>
            </a>
          </div>

          {/* Social Proof Stats */}
          <div className="pt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto border-t border-gray-200/80 text-left">
            <div className="p-2">
              <div className="text-xl font-semibold text-gray-900">&lt; 3s</div>
              <div className="text-xs text-gray-500 mt-0.5">GPS Update Latency</div>
            </div>
            <div className="p-2">
              <div className="text-xl font-semibold text-gray-900">100%</div>
              <div className="text-xs text-gray-500 mt-0.5">Digital Pass Coverage</div>
            </div>
            <div className="p-2">
              <div className="text-xl font-semibold text-gray-900">Multi-Tenant</div>
              <div className="text-xs text-gray-500 mt-0.5">Campus Data Isolation</div>
            </div>
            <div className="p-2">
              <div className="text-xl font-semibold text-gray-900 whitespace-nowrap">Anti-Passback</div>
              <div className="text-xs text-gray-500 mt-0.5">Fraud Prevention Lock</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section id="features" className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
              Role-Based Portals
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
              Designed for every stakeholder
            </h2>
            <p className="text-sm text-gray-500">
              Tailored interfaces built for the specific operational demands of each role.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Student Card */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">Student Portal</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Real-time bus arrival tracking, verified QR digital bus pass, route search, and campus delay advisories.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <Link to="/login" className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
                  Sign in as Student <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Driver Cockpit */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-green-50 text-green-700 flex items-center justify-center mb-4">
                  <Radio className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">Driver Console</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Shift controls, live GPS broadcasting, passenger headcount counter, and fast pass validation scanner.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <Link to="/login" className="text-xs font-medium text-green-700 flex items-center gap-1 hover:underline">
                  Sign in as Driver <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Admin Command Center */}
            <div className="p-5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-gray-100 text-gray-800 flex items-center justify-center mb-4">
                  <Map className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">Operations Center</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Live fleet tracking, vehicle rosters, passholder management, shift operations, broadcasts, and support.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <Link to="/login" className="text-xs font-medium text-gray-900 flex items-center gap-1 hover:underline">
                  Sign in as Admin <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-gray-200 bg-gray-50 text-gray-500 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Cambus Connect. Enterprise Campus Transit SaaS.</p>
          <div className="flex items-center gap-4 text-gray-600">
            <Link to="/login" className="hover:text-gray-900 transition-colors">Portal Sign In</Link>
            <span>•</span>
            <a href="/privacy.html" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="/terms.html" className="hover:text-gray-900 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Cookie Consent Banner */}
      {showCookieBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">
            We use cookies to improve your experience and for analytics. By continuing to use our site, you accept our <a href="/privacy.html" className="underline hover:text-blue-300">Privacy Policy</a>.
          </p>
          <div className="flex gap-3 whitespace-nowrap">
            <button onClick={acceptCookies} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
