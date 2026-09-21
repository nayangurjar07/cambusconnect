// src/components/domain/StudentCsvImportModal.jsx
import React, { useState, useRef } from 'react';
import { 
  Upload, Download, FileText, CheckCircle2, AlertCircle, 
  X, RefreshCw, AlertTriangle, ShieldCheck 
} from 'lucide-react';
import { 
  parseCsv, 
  validateStudentRow, 
  generateCsvTemplate, 
  generateErrorCsv, 
  batchImportStudents, 
  DEFAULT_STUDENT_SCHEMA 
} from '../../services/students';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { useToast } from '../../contexts/ToastContext';

export function StudentCsvImportModal({ isOpen, onClose, schema = DEFAULT_STUDENT_SCHEMA, onImportComplete }) {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [validRows, setValidRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setImporting(false);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateCsvTemplate(schema);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cambus_student_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadErrorCsv = () => {
    if (invalidRows.length === 0) return;
    const errorCsv = generateErrorCsv(invalidRows);
    const blob = new Blob([errorCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'failed_student_import_rows.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.csv') || (selected.type && selected.type !== 'text/csv' && selected.type !== 'application/vnd.ms-excel')) {
      showError("Invalid file type. Please upload a standard CSV file.");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      showError("File size exceeds the 5MB limit. Please upload a smaller file.");
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const { headers, rows } = parseCsv(text);
        
        if (rows.length === 0) {
          showError("The uploaded CSV file is empty or missing data rows.");
          return;
        }

        const valid = [];
        const invalid = [];

        rows.forEach(r => {
          const validation = validateStudentRow(r, schema);
          if (validation.isValid) {
            valid.push(r);
          } else {
            invalid.push({
              rowNum: r.__rowNum,
              raw: r.__raw,
              data: r,
              errors: validation.errors
            });
          }
        });

        setParsedRows(rows);
        setValidRows(valid);
        setInvalidRows(invalid);
      } catch (err) {
        showError("Failed to parse CSV: " + err.message);
      }
    };
    reader.readAsText(selected);
  };

  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      showError("No valid rows available to import.");
      return;
    }

    setImporting(true);
    try {
      const imported = await batchImportStudents(validRows, (current, total) => {
        setImportProgress(Math.round((current / total) * 100));
      });

      showSuccess(`Successfully imported ${imported} students!`);
      if (onImportComplete) onImportComplete();
      handleClose();
    } catch (err) {
      showError("Batch import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Batch Import Student Directory (CSV)"
      className="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Step 1 & 2 Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <span className="text-xs font-bold text-gray-900 block">Step 1: Download Standard Template</span>
              <span className="text-[11px] text-gray-500">Includes current schema columns: name, email, collegeId, etc.</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Download}
            onClick={handleDownloadTemplate}
          >
            Download CSV Template
          </Button>
        </div>

        {/* Upload Zone */}
        {!file && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-white hover:bg-blue-50/20"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <span className="text-sm font-semibold text-gray-800 block">Click to select CSV file</span>
            <span className="text-xs text-gray-500 block mt-1">Supports standard CSV format with comma delimiters</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Preview and Validation Report */}
        {file && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <div>
                  <span className="text-xs font-bold text-gray-900">{file.name}</span>
                  <span className="text-[11px] text-gray-500 block">
                    {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} total rows parsed
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={validRows.length > 0 ? 'success' : 'neutral'}>
                  {validRows.length} Valid
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="danger">
                    {invalidRows.length} Errors
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset} title="Clear file">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Error Report Banner */}
            {invalidRows.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between gap-3 text-xs text-red-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Found {invalidRows.length} rows with errors (missing required fields or invalid formats).
                    These rows will be skipped during import.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleDownloadErrorCsv}
                >
                  Export Error Rows
                </Button>
              </div>
            )}

            {/* Data Preview Table */}
            <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-600">Row</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Name</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Email</th>
                    <th className="px-3 py-2 font-medium text-gray-600">College ID</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Route</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Status / Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRows.slice(0, 50).map((row, idx) => {
                    const errorObj = invalidRows.find(ir => ir.rowNum === row.__rowNum);
                    const isInvalid = Boolean(errorObj);

                    return (
                      <tr key={idx} className={isInvalid ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-1.5 font-mono text-gray-400">#{row.__rowNum}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900">{row.name || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600">{row.email || '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{row.collegeid || row.collegeId || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600">{row.busroute || row.busRoute || '—'}</td>
                        <td className="px-3 py-1.5">
                          {isInvalid ? (
                            <span className="text-red-600 font-medium" title={errorObj.errors.join('; ')}>
                              {errorObj.errors[0]}
                            </span>
                          ) : (
                            <span className="text-green-600 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedRows.length > 50 && (
                <div className="p-2 text-center text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                  Showing first 50 rows of {parsedRows.length}. All valid rows will be imported.
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {importing && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Importing batches to Firestore...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={validRows.length === 0 || importing}
            isLoading={importing}
            onClick={handleConfirmImport}
          >
            Import {validRows.length} Students
          </Button>
        </div>
      </div>
    </Modal>
  );
}
