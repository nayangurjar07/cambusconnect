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

/**
 * Evaluates GPS staleness based on timestamp
 * Returns: { label: 'LIVE' | 'STALE' | 'OFFLINE', color: string, text: string }
 */
function getGpsStatus(bus) {
  if (!bus.location || typeof bus.location.lat !== 'number' || typeof bus.location.lng !== 'number') {
    return { label: 'NO_LOCATION', color: 'gray', text: 'No GPS' };
  }

  let updateDate = null;
  if (bus.lastGpsUpdate?.toDate) {
    updateDate = bus.lastGpsUpdate.toDate();
  } else if (bus.lastGpsUpdate) {
    updateDate = new Date(bus.lastGpsUpdate);
  } else if (bus.updatedAt?.toDate) {
    updateDate = bus.updatedAt.toDate();
  } else if (bus.updatedAt) {
    updateDate = new Date(bus.updatedAt);
  }

  if (!updateDate || isNaN(updateDate.getTime())) {
    return { label: 'LIVE', color: 'emerald', text: 'Active Stream' };
  }

  const diffMinutes = Math.floor((Date.now() - updateDate.getTime()) / 60000);
  if (diffMinutes < 3) {
    return { label: 'LIVE', color: 'emerald', text: 'Live Now' };
  } else if (diffMinutes <= 15) {
    return { label: 'STALE', color: 'amber', text: `${diffMinutes}m ago` };
  } else {
    return { label: 'OFFLINE', color: 'rose', text: 'Offline' };
  }
}

export function FleetMap({
  buses = [],
  selectedBus = null,
  onSelectBus = () => {},
  className = ''
}) {
  const { tenant } = useTenant();
  const [googleReady, setGoogleReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // References for Google Maps
  const googleContainerRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkersRef = useRef({});
  const googleCampusMarkerRef = useRef(null);
  const googleInfoWindowRef = useRef(null);

  // Default campus center
  const defaultCenter = useMemo(() => {
    return tenant?.campusCenter || { lat: 22.8225, lng: 75.8370 }; // IIST Indore default
  }, [tenant]);

  // Load Google Maps JavaScript API
  useEffect(() => {
    let isMounted = true;
    loadGoogleMaps()
      .then(() => {
        if (isMounted) {
          setGoogleReady(true);
        }
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

  // Initialize Google Maps instance
  useEffect(() => {
    if (!googleReady || !googleContainerRef.current) return;
    if (googleMapRef.current) return; // already initialized

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
        streetViewControl: false, // Explicitly disabled
        fullscreenControl: false,
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
        ]
      });

      googleMapRef.current = gMap;
      googleInfoWindowRef.current = new window.google.maps.InfoWindow();

      // Add campus anchor pin
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
    } catch (err) {
      console.error('Failed to instantiate Google Maps:', err);
      setLoadError(err.message);
    }
  }, [googleReady, defaultCenter, tenant]);

  // Synchronize Google Maps bus markers
  useEffect(() => {
    if (!googleMapRef.current || !googleReady) return;
    const gMap = googleMapRef.current;
    const currentIds = new Set();

    buses.forEach(bus => {
      if (!bus.location || typeof bus.location.lat !== 'number' || typeof bus.location.lng !== 'number') return;
      const { lat, lng } = bus.location;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      currentIds.add(bus.id);
      const isSelected = selectedBus && selectedBus.id === bus.id;
      const gps = getGpsStatus(bus);

      // Color scheme
      let fillColor = '#16a34a'; // emerald
      if (bus.status === 'Delayed' || gps.label === 'STALE') fillColor = '#d97706'; // amber
      if (bus.status === 'Breakdown' || gps.label === 'OFFLINE') fillColor = '#dc2626'; // rose

      const markerColorEncoded = encodeURIComponent(fillColor);

      if (googleMarkersRef.current[bus.id]) {
        const marker = googleMarkersRef.current[bus.id];
        marker.setPosition({ lat, lng });
        marker.setZIndex(isSelected ? 9999 : 100);
      } else {
        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: gMap,
          title: `Bus ${bus.number} - ${bus.route || 'Campus Route'}`,
          label: {
            text: String(bus.number || ''),
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold'
          },
          icon: {
            url: `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 2 C9 2 3 8 3 16 C3 27 17 40 17 40 C17 40 31 27 31 16 C31 8 25 2 17 2 Z" fill="${markerColorEncoded}" stroke="%23ffffff" stroke-width="2.5"/><circle cx="17" cy="15" r="9" fill="${markerColorEncoded}"/></svg>`,
            scaledSize: new window.google.maps.Size(isSelected ? 40 : 34, isSelected ? 48 : 42),
            anchor: new window.google.maps.Point(isSelected ? 20 : 17, isSelected ? 48 : 42),
            labelOrigin: new window.google.maps.Point(isSelected ? 20 : 17, isSelected ? 16 : 14)
          },
          zIndex: isSelected ? 9999 : 100
        });

        marker.addListener('click', () => {
          onSelectBus(bus);
          if (googleInfoWindowRef.current) {
            googleInfoWindowRef.current.setContent(`
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; min-width: 200px; padding: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
                  <span style="font-weight: 700; font-size: 14px; color: #0f172a;">Bus ${bus.number}</span>
                  <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: #eff6ff; color: #1d4ed8;">
                    ${bus.status || 'On Time'}
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; color: #475569; font-size: 12px;">
                  <div><strong>Route:</strong> ${bus.route || 'Campus Route'}</div>
                  <div><strong>Driver:</strong> ${bus.driver || 'Unassigned'}</div>
                  <div><strong>Riders:</strong> ${bus.headcount || 0} / ${bus.capacity || 45}</div>
                  <div><strong>Speed:</strong> ${bus.speed || 0} km/h</div>
                  <div><strong>Telemetry:</strong> ${gps.text}</div>
                </div>
              </div>
            `);
            googleInfoWindowRef.current.open(gMap, marker);
          }
        });

        googleMarkersRef.current[bus.id] = marker;
      }
    });

    // Remove obsolete markers
    Object.keys(googleMarkersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        googleMarkersRef.current[id].setMap(null);
        delete googleMarkersRef.current[id];
      }
    });
  }, [buses, selectedBus, googleReady, onSelectBus]);

  // Google Maps Pan on Select
  useEffect(() => {
    if (!googleMapRef.current || !selectedBus) return;
    if (selectedBus.location && typeof selectedBus.location.lat === 'number') {
      googleMapRef.current.panTo({
        lat: selectedBus.location.lat,
        lng: selectedBus.location.lng
      });
      if (googleMarkersRef.current[selectedBus.id] && googleInfoWindowRef.current) {
        googleInfoWindowRef.current.open(googleMapRef.current, googleMarkersRef.current[selectedBus.id]);
      }
    }
  }, [selectedBus]);

  // Actions Toolbar
  const fitAllBuses = () => {
    if (googleMapRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      buses.forEach(b => {
        if (b.location && typeof b.location.lat === 'number') {
          bounds.extend({ lat: b.location.lat, lng: b.location.lng });
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

  const activeGpsBuses = buses.filter(b => b.location && typeof b.location.lat === 'number');
  const staleCount = buses.filter(b => getGpsStatus(b).label === 'STALE').length;
  const noLocationCount = buses.length - activeGpsBuses.length;

  return (
    <div className={`relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm ${className}`} style={{ minHeight: 380 }}>
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
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
        <button
          onClick={fitAllBuses}
          className="p-2.5 bg-white/95 hover:bg-white border border-slate-200 rounded-xl shadow-sm text-slate-700 hover:text-blue-600 transition-all cursor-pointer backdrop-blur-sm"
          title="Fit All Fleet Vehicles"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={centerOnCampus}
          className="p-2.5 bg-white/95 hover:bg-white border border-slate-200 rounded-xl shadow-sm text-slate-700 hover:text-blue-600 transition-all cursor-pointer backdrop-blur-sm"
          title="Center on Campus Gateway"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Status Badge Top-Left */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-1.5 max-w-[80%]">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-sm flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">{activeGpsBuses.length} Active</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-medium">{buses.length} Fleet</span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            Google Maps
          </span>
        </div>

        {staleCount > 0 && (
          <div className="bg-amber-50/95 border border-amber-200 text-amber-800 rounded-xl px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 backdrop-blur-sm">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>{staleCount} Stale</span>
          </div>
        )}

        {noLocationCount > 0 && (
          <div className="bg-slate-50/95 border border-slate-200 text-slate-500 rounded-xl px-2.5 py-1 text-[11px] flex items-center gap-1 backdrop-blur-sm">
            <AlertTriangle className="w-3 h-3 text-slate-400" />
            <span>{noLocationCount} Offline</span>
          </div>
        )}
      </div>

      {/* Map Legend Bottom-Left */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Live Active
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Delayed/Stale
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Issue/Offline
        </span>
      </div>
    </div>
  );
}
