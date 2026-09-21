// src/pages/owner/Dashboard.jsx
import React, { useState } from 'react';
import { Building2, Plus, Users, Bus, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

export function OwnerDashboard() {
  const { allTenants, tenantKey, changeTenant } = useTenant();
  const { showSuccess } = useToast();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    domain: '',
    projectId: '',
    apiKey: '',
  });

  const tenantList = Object.entries(allTenants).map(([key, data]) => ({
    key,
    ...data
  }));

  const handleRegister = (e) => {
    e.preventDefault();
    showSuccess(`Tenant "${formData.name}" initialized`);
    setIsRegisterOpen(false);
    setFormData({ name: '', shortName: '', domain: '', projectId: '', apiKey: '' });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform Overview"
        subtitle="Multi-tenant management and cloud infrastructure"
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsRegisterOpen(true)}>
            Add Tenant
          </Button>
        }
      />

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Active Tenants"
          value={tenantList.length}
          subtitle="Campuses deployed"
          icon={Building2}
        />
        <MetricCard
          title="Total Fleet"
          value="48 Buses"
          subtitle="Across campuses"
          icon={Bus}
        />
        <MetricCard
          title="Daily Boardings"
          value="3,840"
          subtitle="Scans today"
          icon={Users}
        />
        <MetricCard
          title="Service Health"
          value="99.98%"
          subtitle="All instances online"
          icon={ShieldCheck}
        />
      </div>

      {/* Colleges & Tenants Directory */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">University Campuses</h3>
            <p className="text-xs text-gray-500">Partitioned client database environments</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tenantList.map((tenant) => {
            const isCurrent = tenant.key === tenantKey;

            return (
              <div
                key={tenant.key}
                className={`p-4 rounded-lg border transition-colors ${
                  isCurrent 
                    ? 'border-blue-300 bg-blue-50/20' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-gray-100 text-gray-800 font-semibold text-sm flex items-center justify-center">
                      {tenant.branding?.shortName?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {tenant.branding?.name || tenant.key}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {tenant.emailDomains?.[0] || `${tenant.key}.com`}
                      </p>
                    </div>
                  </div>

                  <Badge variant={isCurrent ? 'primary' : 'neutral'}>
                    {isCurrent ? 'Active' : 'Client'}
                  </Badge>
                </div>

                <div className="p-2.5 bg-gray-50 rounded-md space-y-1 text-xs text-gray-600 mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Project:</span>
                    <code className="font-mono text-gray-800">{tenant.firebaseConfig?.projectId || 'cloud-tenant'}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tenant ID:</span>
                    <span className="font-medium text-gray-800">{tenant.key}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-green-700 font-medium">Operational</span>
                  <Button
                    variant={isCurrent ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => changeTenant(tenant.key)}
                  >
                    {isCurrent ? 'Selected' : 'Switch Tenant'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Register Tenant Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Add University Tenant"
      >
        <form onSubmit={handleRegister} className="space-y-3">
          <Input
            label="Institution Name"
            placeholder="e.g. Prestige Institute of Management"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Short Code / Acronym"
              placeholder="e.g. PIMR"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              required
            />
            <Input
              label="Primary Domain"
              placeholder="e.g. pimrindore.ac.in"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Firebase Project ID"
              placeholder="e.g. cambus-pimr"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              required
            />
            <Input
              label="Firebase API Key"
              type="password"
              placeholder="AIzaSy..."
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsRegisterOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Initialize Tenant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
