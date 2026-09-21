// src/pages/student/Support.jsx
import React, { useState, useEffect } from 'react';
import { Send, LifeBuoy, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToSupportQueries, createSupportQuery } from '../../services/communications';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

export function StudentSupport() {
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [queries, setQueries] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSupportQueries((list) => {
      setQueries(list.filter(q => q.email === profile?.email));
    });
    return () => unsub();
  }, [profile?.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !message) return;
    setSubmitting(true);
    try {
      await createSupportQuery({
        subject,
        message,
        name: profile?.name || 'Student',
        email: profile?.email || '',
        role: 'student'
      });
      showSuccess('Support request submitted');
      setSubject('');
      setMessage('');
    } catch (err) {
      showError('Failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Support" subtitle="Get help with transit services" />

      {/* New Request Form */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Request</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Subject" placeholder="Brief summary of your issue" value={subject}
              onChange={(e) => setSubject(e.target.value)} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                placeholder="Describe your issue in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="primary" size="sm" icon={Send} isLoading={submitting}>
              Submit Request
            </Button>
          </form>
        </div>
      </Card>

      {/* Previous Requests */}
      {queries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Requests</h3>
          <div className="space-y-2">
            {queries.map(q => (
              <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{q.subject}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{q.message}</div>
                </div>
                <Badge variant={q.status === 'Resolved' ? 'success' : q.status === 'Pending' ? 'warning' : 'neutral'}>
                  {q.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
