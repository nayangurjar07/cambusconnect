import { readFileSync, writeFileSync } from 'fs';

const f = 'src/pages/driver/ScanPass.jsx';
const full = readFileSync(f, 'utf8');

// Find the return( line inside the component (line 666 in 1-indexed = index 665)
const lines = full.split('\n');

// Keep everything up to and including line 665 (index 664), which is the closing brace of executeVerify
const head = lines.slice(0, 665).join('\n');

const newReturn = `
  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 font-sans text-slate-900">

      {/* Page Header — compact on mobile */}
      <PageHeader
        title="Boarding Terminal"
        subtitle={<span className="hidden sm:inline">Optical QR validation, cryptographic auth &amp; live occupancy</span>}
        badge={<Badge variant="primary" dot>Field Ready</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('/driver/dashboard')}>
              <span className="hidden sm:inline">Cockpit</span>
            </Button>
          </div>
        }
      />

      {/* ── Compact Headcount Strip ── */}
      <Card>
        <CardBody className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">Bus #{selectedBus?.number || '—'}</span>
                  <Badge variant="primary" className="text-[10px]">{selectedBus?.route || 'Route'}</Badge>
                </div>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  <strong className="text-slate-800">{currentCount}</strong> / {capacity} seats
                </p>
              </div>
            </div>
            <div className={\`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border-2 shrink-0 \${
              occupancyPercent >= 90 ? 'bg-rose-50 border-rose-300 text-rose-700' :
              occupancyPercent >= 70 ? 'bg-amber-50 border-amber-300 text-amber-700' :
              'bg-blue-50 border-blue-200 text-blue-700'
            }\`}>
              <span className="text-xl font-black tabular-nums leading-none">{currentCount}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">aboard</span>
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className={\`h-full transition-all duration-300 rounded-full \${
                occupancyPercent >= 90 ? 'bg-rose-500' : occupancyPercent >= 70 ? 'bg-amber-500' : 'bg-blue-500'
              }\`}
              style={{ width: \`\${occupancyPercent}%\` }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>Bus #{b.number} ({b.headcount || 0}/{b.capacity || 45})</option>
              ))}
            </select>

            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button type="button" onClick={() => handleHeadcountChange(-1)} disabled={currentCount <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all disabled:opacity-30 cursor-pointer touch-manipulation">
                <Minus className="w-4 h-4 text-slate-700" />
              </button>
              <span className="px-1 text-xs font-black tabular-nums text-slate-800 min-w-[22px] text-center">{currentCount}</span>
              <button type="button" onClick={() => handleHeadcountChange(1)} disabled={currentCount >= capacity}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all disabled:opacity-30 cursor-pointer touch-manipulation">
                <Plus className="w-4 h-4 text-blue-600" />
              </button>
              <button type="button" onClick={handleHeadcountReset}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 active:scale-90 transition-all cursor-pointer touch-manipulation">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            <button type="button" onClick={handleToggleFastMode}
              className={\`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all shrink-0 cursor-pointer touch-manipulation \${
                fastMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200'
              }\`}>
              <span className={\`w-1.5 h-1.5 rounded-full \${fastMode ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'}\`} />
              {fastMode ? 'Auto +1' : 'Manual'}
            </button>
          </div>
        </CardBody>
      </Card>

      {/* ── Scanner + Controls Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Scanner Column (full-width on mobile) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <CardTitle>Optical Pass Scanner</CardTitle>
              </div>
              <Badge variant={isCameraActive ? 'success' : 'neutral'} dot>
                {isCameraActive ? 'Live' : 'Standby'}
              </Badge>
            </CardHeader>
            <CardBody className="p-3 sm:p-5 space-y-3">
              <ValidateBusPassScanner
                elementId="driver-qr-viewfinder"
                isCameraActive={isCameraActive}
                onStartCamera={() => startCamera()}
                onStopCamera={stopCamera}
                cameraLoading={cameraLoading}
                cameraError={cameraError}
                torchActive={torchActive}
                onToggleTorch={handleToggleTorch}
                showTorch={true}
                showFlip={hasMultipleCameras}
                onFlipCamera={handleFlipCamera}
                compact={false}
              />

              {/* Manual entry inline under camera for fast mobile access */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Manual Lookup (Email / Roll No / Pass ID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 0827CS211001 or student@edu"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeVerify(manualInput)}
                    className="flex-1 px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                  <Button variant="primary" size="sm" onClick={() => executeVerify(manualInput)} isLoading={verifying}>
                    Verify
                  </Button>
                </div>
              </div>
            </CardBody>

            {/* Verification Result */}
            {verificationResult && (
              <div className={\`p-4 border-t text-xs transition-colors \${
                verificationResult.status === 'approved'
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950'
              }\`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {verificationResult.status === 'approved'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    }
                    <span className="font-bold text-sm">
                      {verificationResult.status === 'approved' ? 'Pass Approved · Boarding Recorded (+1)' : 'Pass Denied'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">Auto-reset 3s</span>
                </div>

                {verificationResult.student && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-700 shrink-0">
                        {verificationResult.student.photoURL
                          ? <img src={verificationResult.student.photoURL} alt="" className="w-full h-full object-cover" />
                          : verificationResult.student.name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Verified Student</span>
                        <h4 className="font-bold text-slate-900 truncate">{verificationResult.student.name}</h4>
                        <p className="text-[11px] text-slate-500 tabular-nums truncate">
                          ID: {verificationResult.student.collegeId || verificationResult.student.enrollment || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Stop', val: verificationResult.student.pickupStop || verificationResult.student.stop || 'Campus' },
                        { label: 'Route', val: verificationResult.student.busRoute || selectedBus?.route || 'Campus' },
                        { label: 'Valid', val: verificationResult.student.passValidity || 'Active' },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-400 block text-[9px] uppercase font-semibold">{label}</span>
                          <span className="font-bold text-slate-900 truncate block mt-0.5 text-[11px]">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {verificationResult.reason && (
                  <p className="mt-2 font-medium text-slate-600"><strong>Detail:</strong> {verificationResult.reason}</p>
                )}
                {verificationResult.recommendation && (
                  <p className="mt-1 text-[11px] text-slate-500"><strong>Action:</strong> {verificationResult.recommendation}</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Boarding Policy + Log */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <CardTitle>Boarding Policy</CardTitle>
              </div>
              <Badge variant={fastMode ? 'primary' : 'neutral'}>{fastMode ? 'Auto Count' : 'Manual'}</Badge>
            </CardHeader>
            <CardBody className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">Fast Headcount Mode</p>
                  <p className="text-[11px] text-slate-500">{fastMode ? 'Auto +1 on valid scan' : 'Manual count mode'}</p>
                </div>
                <button type="button" onClick={handleToggleFastMode}
                  className={\`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors \${fastMode ? 'bg-blue-600' : 'bg-slate-200'}\`}
                  aria-label="Toggle Fast Headcount">
                  <div className={\`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform \${fastMode ? 'translate-x-5' : 'translate-x-0'}\`} />
                </button>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">Anti-Duplicate Lock</p>
                  <p className="text-[11px] text-slate-500">{sameBusScanLock ? 'Rejects repeat same-pass scans' : 'Warning: repeats allowed'}</p>
                </div>
                <button type="button" onClick={() => setSameBusScanLock(!sameBusScanLock)}
                  className={\`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors \${sameBusScanLock ? 'bg-blue-600' : 'bg-slate-200'}\`}
                  aria-label="Toggle Anti-Duplicate Lock">
                  <div className={\`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform \${sameBusScanLock ? 'translate-x-5' : 'translate-x-0'}\`} />
                </button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <CardTitle>Today's Boardings</CardTitle>
              </div>
              <Badge variant="neutral">{boardingLog.length} recorded</Badge>
            </CardHeader>
            <CardBody className="p-0">
              {boardingLog.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No boardings on Bus #{selectedBus?.number || '—'} today.
                </div>
              ) : (
                <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 text-xs">
                  {boardingLog.slice(0, 15).map((log) => (
                    <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div>
                        <p className="font-bold text-slate-900">{log.studentName || 'Student'}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{log.studentId}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-slate-600 block tabular-nums">
                          {log.time ? log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium">Boarded</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Headcount Reset Confirmation */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={confirmHeadcountReset}
        isLoading={isResetting}
        title="Reset Passenger Count"
        message={\`Reset the passenger count for Bus #\${selectedBus?.number} to 0? This will also clear today's boarding list so all passes can be scanned fresh.\`}
        confirmText="Reset to 0"
        variant="danger"
      />
    </div>
  );
}

export default DriverScanPass;
`;

const final = head + '\n' + newReturn;
writeFileSync(f, final, 'utf8');
console.log('Done. Total lines:', final.split('\n').length);
