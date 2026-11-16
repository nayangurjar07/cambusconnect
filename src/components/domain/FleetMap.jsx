// src/components/domain/FleetMap.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Maximize2, 
  Navigation, 
  AlertTriangle, 
  Clock
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { loadGoogleMaps } from '../../services/googleMaps';
import { getBusTrackingHealth } from '../../services/transit';

/**
 * FleetMap
 * Interactive Real-Time Google Maps Fleet Telemetry Component
 * Powered by Google Maps JavaScript API via secure backend /api/maps-config key pipeline.
 */
export function FleetMap({
  buses = [],
  selectedBusId = null,
  selectedBus = null,
  onSelectBus = null,
  singleBusMode = false,
  className = ''
}) {
  const { tenant } = useTenant();
  const [googleReady, setGoogleReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Resolves currently focused / selected bus object
  const activeSelectedBus = useMemo(() => {
    if (selectedBus) return selectedBus;
    if (selectedBusId) {
      return buses.find((b) => b.id === selectedBusId) || null;
    }
    return null;
  }, [selectedBus, selectedBusId, buses]);

  const activeSelectedBusId = activeSelectedBus?.id || selectedBusId;

  // DOM & Map references
  const googleContainerRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkersRef = useRef({});
  const googleCampusMarkerRef = useRef(null);
  const googleInfoWindowRef = useRef(null);

  // Default campus center coordinates (Indore Campus default)
  const defaultCenter = useMemo(() => {
    return tenant?.campusCenter || { lat: 22.7196, lng: 75.8577 };
  }, [tenant]);

  // Load Google Maps JavaScript API via secure backend key
  useEffect(() => {
    let isMounted = true;
    loadGoogleMaps()
      .then(() => {
        if (isMounted) setGoogleReady(true);
      })
      .catch((err) => {
        console.error('[FleetMap] Google Maps load error:', err);
        if (isMounted) {
          setLoadError(err.message || 'Failed to load Google Maps');
        }
      });

    const handleGoogleReady = () => {
      if (isMounted) setGoogleReady(true);
    };
    window.addEventListener('google-maps-ready', handleGoogleReady);

    return () => {
      isMounted = false;
      window.removeEventListener('google-maps-ready', handleGoogleReady);
    };
  }, []);

  // Initialize Google Maps instance with robust resize observer to prevent grey canvas
  useEffect(() => {
    if (!googleReady || !googleContainerRef.current) return;
    if (googleMapRef.current) return;

    try {
      const gMap = new window.google.maps.Map(googleContainerRef.current, {
        center: { lat: defaultCenter.lat, lng: defaultCenter.lng },
        zoom: 13,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: window.google.maps.ControlPosition.TOP_RIGHT
        },
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM
        },
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
        ]
      });

      googleMapRef.current = gMap;
      googleInfoWindowRef.current = new window.google.maps.InfoWindow();

      // Trigger resize when container settles to ensure map tiles render immediately
      const resizeObserver = new ResizeObserver(() => {
        if (googleMapRef.current && window.google?.maps) {
          window.google.maps.event.trigger(googleMapRef.current, 'resize');
        }
      });
      resizeObserver.observe(googleContainerRef.current);

      // Campus Gateway pin
      googleCampusMarkerRef.current = new window.google.maps.Marker({
        position: { lat: defaultCenter.lat, lng: defaultCenter.lng },
        map: gMap,
        title: tenant?.branding?.name || 'Campus Operations Gateway',
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#1e293b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      return () => {
        resizeObserver.disconnect();
      };
    } catch (err) {
      console.error('Failed to instantiate Google Maps:', err);
      setLoadError(err.message);
    }
  }, [googleReady, defaultCenter, tenant]);

  // Helper: Generates InfoWindow HTML content safely
  const createInfoWindowHTML = (bus, health) => {
    if (!bus) return '';
    const liveBadge = health?.isLive
      ? `<span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:6px; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; display:inline-flex; align-items:center; gap:4px;">● LIVE</span>`
      : `<span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:6px; background:#fff1f2; color:#be123c; border:1px solid #fecdd3;">OFFLINE</span>`;

    return `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; min-width: 220px; padding: 4px; color: #0f172a;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
          <span style="font-weight: 700; font-size: 14px; color: #0f172a;">Bus #${bus.number || '—'}</span>
          ${liveBadge}
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; color: #475569; font-size: 12px;">
          <div><strong style="color: #334155;">Route:</strong> ${bus.route || 'Campus Route'}</div>
          <div><strong style="color: #334155;">Broadcaster:</strong> ${health?.broadcasterLabel || 'Unassigned'}</div>
          <div><strong style="color: #334155;">Speed:</strong> ${bus.speed || 0} km/h</div>
          <div><strong style="color: #334155;">Occupancy:</strong> ${bus.headcount || 0} / ${bus.capacity || 45}</div>
          <div style="padding-top: 4px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #64748b;">
            Updated: ${health?.lastSeenText || 'Unknown'}
          </div>
        </div>
      </div>
    `;
  };

  // Synchronize Google Maps bus markers
  useEffect(() => {
    if (!googleMapRef.current || !googleReady || !window.google?.maps) return;
    const gMap = googleMapRef.current;
    const currentIds = new Set();

    buses.forEach((bus) => {
      const rawLat = bus.location?.lat;
      const rawLng = bus.location?.lng;
      const lat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat);
      const lng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng);
      const hasCoords = typeof lat === 'number' && !isNaN(lat) && lat !== 0 && typeof lng === 'number' && !isNaN(lng) && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      if (!hasCoords) return;

      currentIds.add(bus.id);
      const isSelected = bus.id === activeSelectedBusId;
      const health = bus.trackingHealth || getBusTrackingHealth(bus, 110);

      // Color coding: emerald for live, amber for stale, rose for offline
      let fillColor = '#10b981';
      if (health.status === 'STALE') fillColor = '#f59e0b';
      if (health.status === 'OFFLINE' || health.status === 'NO_LOCATION') fillColor = '#ef4444';

      const markerColorEncoded = encodeURIComponent(fillColor);
      const iconUrl = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 2 C10 2 3 9 3 17 C3 28 18 42 18 42 C18 42 33 28 33 17 C33 9 26 2 18 2 Z" fill="${markerColorEncoded}" stroke="%23ffffff" stroke-width="2.5"/><circle cx="18" cy="16" r="9" fill="${markerColorEncoded}"/></svg>`;

      const markerSize = isSelected ? new window.google.maps.Size(42, 50) : new window.google.maps.Size(34, 42);
      const markerAnchor = isSelected ? new window.google.maps.Point(21, 50) : new window.google.maps.Point(17, 42);
      const labelOrigin = isSelected ? new window.google.maps.Point(21, 16) : new window.google.maps.Point(17, 15);

      if (googleMarkersRef.current[bus.id]) {
        const marker = googleMarkersRef.current[bus.id];
        marker.setPosition({ lat, lng });
        marker.setZIndex(isSelected ? 9999 : 100);
        marker.setIcon({
          url: iconUrl,
          scaledSize: markerSize,
          anchor: markerAnchor,
          labelOrigin
        });
      } else {
        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: gMap,
          title: `Bus #${bus.number} - ${bus.route || 'Campus Route'}`,
          label: {
            text: String(bus.number || ''),
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold',
            fontFamily: 'Inter, sans-serif'
          },
          icon: {
            url: iconUrl,
            scaledSize: markerSize,
            anchor: markerAnchor,
            labelOrigin
          },
          zIndex: isSelected ? 9999 : 100
        });

        marker.addListener('click', () => {
          if (onSelectBus) {
            onSelectBus(bus.id);
          }
          if (googleInfoWindowRef.current) {
            const html = createInfoWindowHTML(bus, health);
            if (html) {
              googleInfoWindowRef.current.setContent(html);
              googleInfoWindowRef.current.open(gMap, marker);
            }
          }
        });

        googleMarkersRef.current[bus.id] = marker;
      }
    });

    // Remove obsolete markers
    Object.keys(googleMarkersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        googleMarkersRef.current[id].setMap(null);
        delete googleMarkersRef.current[id];
      }
    });
  }, [buses, activeSelectedBusId, googleReady, onSelectBus]);

  // Pan & Zoom on bus selection
  useEffect(() => {
    if (!googleMapRef.current) return;
    if (!activeSelectedBus) {
      if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
      googleMapRef.current.panTo({ lat: defaultCenter.lat, lng: defaultCenter.lng });
      return;
    }

    const rawLat = activeSelectedBus.location?.lat;
    const rawLng = activeSelectedBus.location?.lng;
    const lat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat);
    const lng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng);
    const hasCoords = typeof lat === 'number' && !isNaN(lat) && lat !== 0 && typeof lng === 'number' && !isNaN(lng) && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    if (hasCoords) {
      googleMapRef.current.panTo({ lat, lng });
      if (singleBusMode) {
        googleMapRef.current.setZoom(15);
      }
      const marker = googleMarkersRef.current[activeSelectedBus.id];
      if (marker && googleInfoWindowRef.current) {
        const health = activeSelectedBus.trackingHealth || getBusTrackingHealth(activeSelectedBus, 110);
        const html = createInfoWindowHTML(activeSelectedBus, health);
        if (html) {
          googleInfoWindowRef.current.setContent(html);
          googleInfoWindowRef.current.open(googleMapRef.current, marker);
        }
      }
    } else {
      // Offline / No Coordinates: Close InfoWindow and center on campus coordinates
      if (googleInfoWindowRef.current) {
        googleInfoWindowRef.current.close();
      }
      googleMapRef.current.panTo({ lat: defaultCenter.lat, lng: defaultCenter.lng });
      googleMapRef.current.setZoom(13);
    }
  }, [activeSelectedBus, singleBusMode, defaultCenter]);

  // Actions Toolbar
  const fitAllBuses = () => {
    if (googleMapRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      buses.forEach((b) => {
        const lat = Number(b.location?.lat);
        const lng = Number(b.location?.lng);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          bounds.extend({ lat, lng });
          hasPoints = true;
        }
      });
      bounds.extend({ lat: defaultCenter.lat, lng: defaultCenter.lng });

      if (hasPoints) {
        googleMapRef.current.fitBounds(bounds);
      } else {
        googleMapRef.current.setCenter({ lat: defaultCenter.lat, lng: defaultCenter.lng });
        googleMapRef.current.setZoom(13);
      }
    }
  };

  const centerOnCampus = () => {
    if (googleMapRef.current) {
      googleMapRef.current.panTo({ lat: defaultCenter.lat, lng: defaultCenter.lng });
      googleMapRef.current.setZoom(14);
    }
  };

  const liveBuses = buses.filter((b) => getBusTrackingHealth(b, 110).isLive);
  const staleBuses = buses.filter((b) => getBusTrackingHealth(b, 110).status === 'STALE');
  const offlineCount = buses.length - liveBuses.length;

  // Selected bus offline overlay check
  const focusedBus = activeSelectedBus || (buses.length === 1 ? buses[0] : null);
  const focusedHealth = focusedBus ? (focusedBus.trackingHealth || getBusTrackingHealth(focusedBus, 110)) : null;
  const focusedMissingCoords =
    focusedBus &&
    (focusedBus.location?.lat == null ||
      focusedBus.location?.lng == null ||
      isNaN(Number(focusedBus.location?.lat)) ||
      Number(focusedBus.location?.lat) === 0);

  return (
    <div className={`relative w-full h-full min-h-[380px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 select-none ${className}`}>
      {/* Map Surface: Google Maps */}
      <div ref={googleContainerRef} className="absolute inset-0 z-0 h-full w-full" />

      {/* Loading or Error State */}
      {!googleReady && !loadError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading Google Maps...</span>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 text-rose-600 p-6 text-center gap-2">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <span className="text-sm font-semibold">Google Maps unavailable</span>
          <span className="text-xs text-slate-500">{loadError}</span>
        </div>
      )}

      {/* Floating Map Controls Top-Right */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={fitAllBuses}
          className="p-2.5 bg-white/95 hover:bg-white border border-slate-200 rounded-lg shadow-xs text-slate-700 hover:text-blue-600 transition-all cursor-pointer backdrop-blur-xs"
          title="Fit All Fleet Vehicles"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={centerOnCampus}
          className="p-2.5 bg-white/95 hover:bg-white border border-slate-200 rounded-lg shadow-xs text-slate-700 hover:text-blue-600 transition-all cursor-pointer backdrop-blur-xs"
          title="Center on Campus Gateway"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Status Badge Top-Left */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 max-w-[85%]">
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-1.5 text-xs shadow-xs flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">{liveBuses.length} Live</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-medium">{buses.length} Fleet</span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            Google Maps
          </span>
        </div>

        {staleBuses.length > 0 && (
          <div className="bg-amber-50/95 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 backdrop-blur-xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>{staleBuses.length} Stale Heartbeat</span>
          </div>
        )}

        {offlineCount > 0 && (
          <div className="bg-rose-50/95 border border-rose-200 text-rose-700 rounded-lg px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 backdrop-blur-xs">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>{offlineCount} Offline / Unavailable</span>
          </div>
        )}
      </div>

      {/* Map Legend Bottom-Left: 36px clearance from bottom so it never overlaps the Google logo */}
      <div className="absolute bottom-9 left-3 z-20 hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-600 shadow-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Live (&lt;60s)
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Stale (60s-180s)
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Unavailable
        </span>
      </div>

      {/* Overlay when selected bus has never broadcasted coordinates yet (Centered so it does not block Google logo or zoom controls) */}
      {focusedBus && focusedMissingCoords && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-12 z-30 max-w-md w-[90%] bg-white/95 backdrop-blur-md text-slate-800 p-3 rounded-xl border border-rose-200/80 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 block">
              No GPS Coordinates Broadcasted
            </span>
            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-0.5">
              Bus #{focusedBus.number} ({focusedBus.route || 'No Route'}) does not have an active GPS fix yet ({focusedHealth?.lastSeenText}).
            </p>
          </div>
          <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs rounded-lg shrink-0">
            OFFLINE
          </span>
        </div>
      )}
    </div>
  );
}

export default FleetMap;
