// src/components/domain/StudentSchemaEditor.jsx
import React, { useState, useEffect } from 'react';
import { 
  Shield, Plus, Trash2, Lock, Save, CheckCircle2, 
  AlertTriangle, HelpCircle, FileText 
} from 'lucide-react';
import { 
  subscribeToStudentSchema, 
  saveStudentSchema, 
  LOCKED_FIELDS, 
  FORBIDDEN_FIELDS 
} from '../../services/students';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useToast } from '../../contexts/ToastContext';

export function StudentSchemaEditor() {
  const { showSuccess, showError } = useToast();
  const [schemaFields, setSchemaFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  useEffect(() => {
    const unsub = subscribeToStudentSchema(setSchemaFields);
    return () => unsub();
  }, []);

  const handleToggleRequired = (key) => {
    if (LOCKED_FIELDS.includes(key)) return;
    setSchemaFields(prev => prev.map(f => {
      if (f.key === key) {
        return { ...f, required: !f.required };
      }
      return f;
    }));
  };

  const handleRemoveField = (key) => {
    if (LOCKED_FIELDS.includes(key)) {
      showError("Core identity fields cannot be removed.");
      return;
    }
    setSchemaFields(prev => prev.filter(f => f.key !== key));
  };

  const handleAddField = (e) => {
    e.preventDefault();
    const cleanKey = newFieldKey.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanKey) {
      showError("Please enter a valid field identifier (letters and numbers only).");
      return;
    }

    if (FORBIDDEN_FIELDS.includes(cleanKey)) {
      showError("Security violation: Password or secret fields are forbidden.");
      return;
    }

    if (schemaFields.some(f => f.key.toLowerCase() === cleanKey)) {
      showError(`Field "${cleanKey}" already exists in the schema.`);
      return;
    }

    const newField = {
      key: cleanKey,
      label: newFieldLabel.trim() || cleanKey,
      type: newFieldType,
      required: newFieldRequired,
      locked: false,
      description: 'Custom campus field'
    };

    setSchemaFields(prev => [...prev, newField]);
    setNewFieldKey('');
    setNewFieldLabel('');
    setNewFieldType('string');
    setNewFieldRequired(false);
  };

  const handleSaveSchema = async () => {
    setSaving(true);
    try {
      await saveStudentSchema(schemaFields);
      showSuccess("Student import schema updated successfully");
    } catch (err) {
      showError("Failed to save schema: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border border-blue-100 bg-blue-50/40">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 space-y-1">
            <span className="font-bold text-sm block text-blue-950">
              Student Import Schema & Data Protection
            </span>
            <p>
              Configure which columns are expected when importing students via CSV. 
              Required fields will block rows that are missing values.
            </p>
            <p className="text-amber-800 font-medium">
              Security Notice: Passwords and authentication secrets cannot be accepted in CSV imports. 
              Student accounts authenticate via institutional email verification or Firebase Auth.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Active Schema Columns ({schemaFields.length})</h3>
            <p className="text-xs text-gray-500">Columns matched during CSV import validation.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Save}
            isLoading={saving}
            onClick={handleSaveSchema}
          >
            Save Schema
          </Button>
        </div>

        <div className="divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
          {schemaFields.map(field => {
            const isLocked = LOCKED_FIELDS.includes(field.key);

            return (
              <div key={field.key} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {isLocked ? (
                    <div className="p-1 rounded bg-amber-50 text-amber-700" title="Core Required Field">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1 rounded bg-gray-100 text-gray-400">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">{field.label}</span>
                      <code className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1 py-0.2 rounded">
                        {field.key}
                      </code>
                      <Badge variant="neutral">{field.type}</Badge>
                    </div>
                    {field.description && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{field.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={field.required}
                      disabled={isLocked}
                      onChange={() => handleToggleRequired(field.key)}
                    />
                    <span className={field.required ? 'font-semibold text-blue-700' : 'text-gray-500'}>
                      {field.required ? 'Required' : 'Optional'}
                    </span>
                  </label>

                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField(field.key)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Remove Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add custom field form */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-800 block mb-2">
            Add Custom Column
          </span>
          <form onSubmit={handleAddField} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <Input
              label="Column Key (CSV Header)"
              placeholder="e.g. branch"
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              required
            />
            <Input
              label="Display Label"
              placeholder="e.g. Department / Branch"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              required
            />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Type</label>
              <select
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
              >
                <option value="string">Text (string)</option>
                <option value="phone">Phone Number</option>
                <option value="email">Email Address</option>
                <option value="date">Date (YYYY-MM-DD)</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                />
                <span>Required</span>
              </label>
              <Button type="submit" variant="outline" size="sm" icon={Plus} className="ml-auto">
                Add
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
