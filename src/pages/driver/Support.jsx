// src/pages/driver/Support.jsx
import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createSupportQuery } from '../../services/communications';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function DriverSupport() {
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !message) return;
    setSubmitting(true);
    try {
      await createSupportQuery({
        subject, message,
        name: profile?.name || 'Driver',
        email: profile?.email || '',
        role: 'driver'
      });
      showSuccess('Request submitted');
      setSubject(''); setMessage('');
    } catch (err) {
      showError('Failed: ' + err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="Driver Support" subtitle="Report issues or request assistance" />
      <Card>
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Subject" placeholder="Issue summary" value={subject}
              onChange={(e) => setSubject(e.target.value)} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Details</label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                placeholder="Describe the issue..."
                value={message} onChange={(e) => setMessage(e.target.value)} required
              />
            </div>
            <Button type="submit" variant="primary" size="sm" icon={Send} isLoading={submitting}>Submit</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
