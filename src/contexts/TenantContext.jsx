// src/contexts/TenantContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getActiveTenant } from '../config/firebase';

const TenantContext = createContext(null);

const DEFAULT_BRANDING = {
  name: "Cambus Connect",
  shortName: "Campus",
  logoUrl: "https://via.placeholder.com/150/2563eb/ffffff?text=Cambus",
  colors: {
    primary: "#2563eb",
    secondary: "#ffffff",
    background: "#f8fafc",
    text: "#0f172a"
  }
};

export function TenantProvider({ children }) {
  const [tenantKey, setTenantKey] = useState('default');
  const [tenant, setTenant] = useState({
    firebaseConfig: getActiveTenant().firebaseConfig,
    branding: DEFAULT_BRANDING
  });

  const updateTenantBranding = (brandingUpdates) => {
    setTenant(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        ...brandingUpdates
      }
    }));
  };

  const changeTenant = async (newKey) => {
    console.warn("Tenant switching is disabled.");
  };

  useEffect(() => {
    // Dynamic CSS variables for branding
    if (tenant?.branding?.colors?.primary) {
      document.documentElement.style.setProperty('--brand-primary', tenant.branding.colors.primary);
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={{
      tenantKey,
      tenant,
      branding: tenant.branding,
      changeTenant,
      updateTenantBranding,
      allTenants: { default: tenant }
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
