// src/components/domain/FleetMap.jsx
import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { getBusTrackingHealth } from '../../services/transit';

const DEFAULT_CENTER = [22.7196, 75.8577]; // Campus / Indore-Bhopal corridor default

export function FleetMap({
  buses = [],
  selectedBusId = null,
  selectedBus = null,
  onSelectBus = null,
  className = ''
}) {
  const activeSelectedBusId = selectedBusId || (selectedBus?.id ? selectedBus.id : null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));

  // Dynamically load Leaflet CSS & JS if not already in index.html
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) {
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById('leaflet-js');
    if (existingScript) {
      existingScript.addEventListener('load', () => setLeafletReady(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletReady(true);
    document.body.appendChild(script);
  }, []);

  // Initialize Map Instance
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: false
    });

    // Clean, high-contrast Carto Positron transit tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = {};
    };
  }, [leafletReady]);

  // Sync Bus Markers & Focus Selected Bus
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    const activeIds = new Set();

    buses.forEach((bus) => {
      const health = bus.trackingHealth || getBusTrackingHealth(bus, 110);
      const lat = Number(bus.location?.lat);
      const lng = Number(bus.location?.lng);
      const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

      if (!hasValidCoords) return;

      activeIds.add(bus.id);
      const isSelected = bus.id === activeSelectedBusId;

      const bgClass = health.isLive
        ? 'background:#059669;border:2px solid #ffffff;color:#ffffff;'
        : 'background:#e11d48;border:2px solid #ffffff;color:#ffffff;';

      const ringStyle = isSelected
        ? 'box-shadow:0 0 0 4px rgba(15,23,42,0.85), 0 4px 12px rgba(0,0,0,0.25);transform:scale(1.08);'
        : 'box-shadow:0 2px 6px rgba(0,0,0,0.2);';

      const iconHtml = `
        <div style="
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:3px 8px;
          border-radius:6px;
          font-family:'JetBrains Mono',monospace;
          font-size:11px;
          font-weight:700;
          white-space:nowrap;
          ${bgClass}
          ${ringStyle}
        ">
          <span>#${bus.number || '—'}</span>
          <span style="font-size:9px;opacity:0.9;">${health.isLive ? `${bus.speed || 0}km/h` : 'OFF'}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'cambus-fleet-marker',
        html: iconHtml,
        iconSize: [76, 28],
        iconAnchor: [38, 14]
      });

      const popupContent = `
        <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:170px;padding:2px;">
          <div style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13px;color:#0f172a;">
            Bus #${bus.number} — ${health.label}
          </div>
          <div style="font-size:11px;color:#475569;margin-top:2px;">
            Route: ${bus.route || 'Unassigned'}
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#334155;margin-top:6px;padding-top:4px;border-top:1px solid #e2e8f0;">
            Speed: ${bus.speed || 0} km/h · Occupancy: ${bus.headcount || 0}/${bus.capacity || 45}<br/>
            Broadcaster: ${health.broadcasterLabel}<br/>
            Updated: ${health.lastSeenText}
          </div>
        </div>
      `;

      if (markersRef.current[bus.id]) {
        markersRef.current[bus.id].setLatLng([lat, lng]);
        markersRef.current[bus.id].setIcon(customIcon);
        markersRef.current[bus.id].setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectBus) onSelectBus(bus.id);
        });
        markersRef.current[bus.id] = marker;
      }

      if (isSelected) {
        map.panTo([lat, lng], { animate: true, duration: 0.6 });
      }
    });

    // Clean up removed markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
  }, [buses, activeSelectedBusId, leafletReady, onSelectBus]);

  const focusedBus = buses.find((b) => b.id === activeSelectedBusId) || (buses.length === 1 ? buses[0] : null);
  const focusedHealth = focusedBus ? (focusedBus.trackingHealth || getBusTrackingHealth(focusedBus, 110)) : null;
  const focusedMissingCoords =
    focusedBus &&
    (focusedBus.location?.lat == null ||
      focusedBus.location?.lng == null ||
      isNaN(Number(focusedBus.location?.lat)));

  return (
    <div className={`relative w-full h-full min-h-[380px] bg-slate-100 select-none ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px] z-10" />

      {/* Overlay when selected bus has never broadcasted coordinates yet */}
      {focusedBus && focusedMissingCoords && (
        <div className="absolute inset-x-4 bottom-4 z-20 bg-slate-950/90 text-white p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 block">
              No GPS Coordinates Broadcasted
            </span>
            <p className="text-xs sm:text-sm font-medium mt-0.5">
              Bus #{focusedBus.number} ({focusedBus.route || 'No Route'}) does not have an active GPS fix yet ({focusedHealth?.lastSeenText}).
            </p>
          </div>
          <span className="px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs rounded shrink-0">
            OFFLINE
          </span>
        </div>
      )}
    </div>
  );
}

export default FleetMap;
