import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import TimelineControl from './TimelineControl';
import '../styles/TimelineControl.css';

/**
 * Cauldron node in the network
 * API should return data in this format
 */
interface Cauldron {
  id: string;
  name: string;
  longitude: number | null;        // Geographic coordinates
  latitude: number | null;
  capacity: number;
  currentFill: number;
  fillPercent: number;      // 0-100 for visualization
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Connection between two cauldrons
 * API should return data in this format
 */
interface CauldronPath {
  id: string;
  from: string;             // Source cauldron ID
  to: string;               // Destination cauldron ID
  bandwidth?: number;
  latency?: number;
  shouldPulse?: boolean;    // Enable pulsing animation
  metadata?: {
    [key: string]: any;
  };
}

function NetworkMap() {
  // Refs for map elements
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const initialFitDone = useRef<boolean>(false);
  
  // State populated from API
  const [cauldrons, setCauldrons] = useState<Cauldron[]>([]);
  const [paths, setPaths] = useState<CauldronPath[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>(new Date().toISOString());

  // Process API responses and update state
  const handleData = useCallback((sourceJson: any, networkJson: any, metaJson?: any) => {
    // sourceJson: either /api/Data result (array with cauldron_levels) or cauldron metadata array
    // metaJson: optional cauldron metadata array (when sourceJson is data)
    let cauldronLevels: { [key: string]: number } = {};
    let cauldronMetaFromApi: any[] | null = null;

    if (Array.isArray(sourceJson) && sourceJson.length > 0 && sourceJson[0].cauldron_levels) {
      cauldronLevels = sourceJson[0].cauldron_levels || {};
      if (Array.isArray(metaJson)) cauldronMetaFromApi = metaJson;
    } else if (Array.isArray(sourceJson) && sourceJson.length > 0 && sourceJson[0].id) {
      // sourceJson itself contains metadata
      cauldronMetaFromApi = sourceJson;
      sourceJson.forEach((c: any) => {
        if (c.currentFill != null) cauldronLevels[c.id] = Number(c.currentFill);
        else if (c.current_fill != null) cauldronLevels[c.id] = Number(c.current_fill);
        else if (c.fillPercent != null && c.max_volume != null) cauldronLevels[c.id] = (Number(c.fillPercent) / 100) * Number(c.max_volume);
      });
    }

    const cauldronsArr = cauldronMetaFromApi || [];

    const mappedCauldrons: Cauldron[] = cauldronsArr.map((c: any) => {
      const currentFill = cauldronLevels[c.id] || 0;
      const maxVolume = (c.max_volume != null ? Number(c.max_volume) : 1000);
      const fillPercent = maxVolume > 0 ? (currentFill / maxVolume) * 100 : 0;

      const cauldron = {
        id: c.id,
        name: c.name || c.id,
        longitude: c.longitude != null ? Number(c.longitude) : null,
        latitude: c.latitude != null ? Number(c.latitude) : null,
        capacity: maxVolume,
        currentFill: currentFill,
        fillPercent: fillPercent,
        metadata: c,
      };
      console.log('Mapped cauldron:', cauldron);
      return cauldron;
    });

    // Map network paths
    const edges = networkJson?.edges || [];
    const mappedPaths: CauldronPath[] = edges.map((e: any, idx: number) => ({
      id: e.id || `edge-${idx}-${e.from}-${e.to}`,
      from: e.from,
      to: e.to,
      bandwidth: e.bandwidth != null ? Number(e.bandwidth) : undefined,
      latency: e.travel_time_minutes != null ? Number(e.travel_time_minutes) : undefined,
      shouldPulse: typeof e.travel_time_minutes === 'number' ? e.travel_time_minutes < 10 : false,
      metadata: e,
    }));

  setCauldrons(mappedCauldrons);
  setPaths(mappedPaths);
  }, []);

  // Fetch historical data
  const fetchHistoricalData = useCallback(async (timestamp: string) => {
    try {
      // convert timestamp (ISO) to unix seconds for the /api/Data endpoint
      const date = Math.floor(new Date(timestamp).getTime() / 1000);
      console.log('Fetching historical data for date (unix):', date, 'iso:', timestamp);

      const [dataRes, networkRes, cauldronsRes] = await Promise.all([
        fetch(`/api/Data/?date=${date}`),
        // network may not vary by timestamp in this proxy; still request current network
        fetch('/api/Information/network'),
        // fetch cauldron metadata (locations, capacity)
        fetch('/api/Information/cauldrons'),
      ]);

      if (!dataRes.ok || !networkRes.ok || !cauldronsRes.ok) {
        throw new Error('Failed to fetch historical data');
      }


      const [dataJson, networkJson, cauldronsMetaJson] = await Promise.all([
        dataRes.json(),
        networkRes.json(),
        cauldronsRes.json()
      ]);

      // dataJson expected as array with first element containing cauldron_levels
  const cauldronsJson = Array.isArray(dataJson) ? dataJson : (dataJson ? [dataJson] : []);

  // cauldronsMetaJson may be an array of objects; pass as metaJson so handleData can merge locations
  handleData(cauldronsJson, networkJson, Array.isArray(cauldronsMetaJson) ? cauldronsMetaJson : null);
    } catch (err) {
      console.error('Failed to load historical data:', err);
    }
  }, [handleData]);

  // Handle timeline time changes
  const handleTimeChange = useCallback((timestamp: string) => {
    setSelectedTime(timestamp);
    fetchHistoricalData(timestamp);
  }, [fetchHistoricalData]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cRes, nRes] = await Promise.all([
          fetch('/api/Information/cauldrons'),
          fetch('/api/Information/network'),
        ]);

        if (!cRes.ok || !nRes.ok) {
          throw new Error('Failed to fetch initial data');
        }

        const [cauldronsJson, networkJson] = await Promise.all([
          cRes.json(),
          nRes.json(),
        ]);

        // Pass cauldrons metadata as both source and meta so handleData handles it
        handleData(cauldronsJson, networkJson, Array.isArray(cauldronsJson) ? cauldronsJson : null);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };

    loadInitialData();
  }, [handleData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;
    
    if (!mapboxgl.accessToken) {
      console.error('Mapbox token is missing!');
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/llinii/cmhqyfdby001k01s2e9ot3avh',
      center: [-74.006, 40.7128],
      zoom: 11
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map when data changes
  useEffect(() => {
    if (!map.current) return;

    console.log('Map update triggered with:', { 
      cauldronCount: cauldrons.length, 
      pathCount: paths.length
    });

    const updateMap = () => {
      console.log('Updating map...');
  addPaths();
  addCauldrons();
      // Only perform fit on initial data load. Prevents timeline scrubbing
      // from re-centering or zooming the map when only fill levels change.
      if (!initialFitDone.current) {
        try {
          fitMapToNodes();
        } catch (e) {
          console.warn('fitMapToNodes error:', e);
        }
        initialFitDone.current = true;
      }
      console.log('Map update complete');
    };

    // Make sure we only add the load handler once
    const loadHandler = () => {
      console.log('Map loaded event triggered');
      updateMap();
    };
    
    if (!map.current.loaded()) {
      console.log('Map not yet loaded, adding load handler');
      map.current.on('load', loadHandler);
    } else {
      console.log('Map already loaded, updating immediately');
      updateMap();
    }

    return () => {
      if (map.current) {
        map.current.off('load', loadHandler);
      }
    };
  }, [cauldrons, paths]);

  // Add paths between nodes
  const addPaths = useCallback(() => {
    if (!map.current) return;

    const resolveCoords = (id: string) => {
      const fromC = cauldrons.find((c) => c.id === id);
      if (fromC?.latitude != null && fromC?.longitude != null) return { latitude: fromC.latitude, longitude: fromC.longitude };
      return null;
    };

    const pathFeatures = paths
      .map((path) => {
        const fromCoords = resolveCoords(path.from);
        const toCoords = resolveCoords(path.to);
        if (!fromCoords || !toCoords) return null;

        return {
          type: 'Feature' as const,
          properties: {
            id: path.id,
            bandwidth: path.bandwidth,
            shouldPulse: path.shouldPulse || false,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [fromCoords.longitude, fromCoords.latitude],
              [toCoords.longitude, toCoords.latitude],
            ],
          },
        };
      })
      .filter(Boolean);

    if (map.current.getSource('paths')) {
      try {
        const src = map.current.getSource('paths') as mapboxgl.GeoJSONSource;
        src.setData({
          type: 'FeatureCollection',
          features: pathFeatures as any[]
        });
      } catch (e) {
        console.error('Failed to update paths source:', e);
      }
      return;
    }

    map.current.addSource('paths', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: pathFeatures as any[]
      }
    });

    // Add path layers
    map.current.addLayer({
      id: 'paths-glow',
      type: 'line',
      source: 'paths',
      paint: {
        'line-color': '#e0aaff',
        'line-width': 16,
        'line-opacity': 0.4,
        'line-blur': 8
      }
    });

    map.current.addLayer({
      id: 'paths-layer',
      type: 'line',
      source: 'paths',
      filter: ['!=', ['get', 'shouldPulse'], true],
      paint: {
        'line-color': '#c77dff',
        'line-width': 8,
        'line-opacity': 0.95,
        'line-blur': 1
      }
    });

    map.current.addLayer({
      id: 'paths-layer-pulse',
      type: 'line',
      source: 'paths',
      filter: ['==', ['get', 'shouldPulse'], true],
      paint: {
        'line-color': '#c77dff',
        'line-width': 8,
        'line-opacity': 0.95,
        'line-blur': 1
      }
    });

    map.current.addLayer({
      id: 'paths-core',
      type: 'line',
      source: 'paths',
      paint: {
        'line-color': '#ffffff',
        'line-width': 3,
        'line-opacity': 0.6,
        'line-blur': 0.5
      }
    });

    // Animation for pulsing paths
    let pulseOpacity = 0.5;
    let pulseDirection = 1;
    
    const interval = setInterval(() => {
      if (!map.current?.getLayer('paths-layer-pulse')) {
        clearInterval(interval);
        return;
      }
      
      pulseOpacity += 0.02 * pulseDirection;
      
      if (pulseOpacity >= 1.0) {
        pulseDirection = -1;
        pulseOpacity = 1.0;
      } else if (pulseOpacity <= 0.5) {
        pulseDirection = 1;
        pulseOpacity = 0.5;
      }
      
      map.current.setPaintProperty(
        'paths-layer-pulse',
        'line-opacity',
        pulseOpacity
      );
    }, 30);

    return () => clearInterval(interval);
  }, [cauldrons, paths]);

  // Fit map view to include all nodes
  const fitMapToNodes = useCallback(() => {
    if (!map.current) return;

    const coords = cauldrons
      .filter(c => c.latitude != null && c.longitude != null)
      .map(c => ({ latitude: c.latitude!, longitude: c.longitude! }));

    if (coords.length === 0) return;

    if (coords.length === 1) {
      const p = coords[0];
      try {
        map.current.flyTo({
          center: [p.longitude, p.latitude],
          zoom: 12,
          speed: 0.8
        });
      } catch (e) {
        console.error('Failed to fly to point:', e);
      }
      return;
    }

    const bounds = coords.reduce(
      (acc, p) => ({
        minLat: Math.min(acc.minLat, p.latitude),
        minLon: Math.min(acc.minLon, p.longitude),
        maxLat: Math.max(acc.maxLat, p.latitude),
        maxLon: Math.max(acc.maxLon, p.longitude),
      }),
      {
        minLat: Infinity,
        minLon: Infinity,
        maxLat: -Infinity,
        maxLon: -Infinity,
      }
    );

    try {
      map.current.fitBounds(
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        ],
        { padding: 80, maxZoom: 14, duration: 800 }
      );
    } catch (e) {
      console.error('Failed to fit bounds:', e);
    }
  }, [cauldrons]);

  // Add cauldron markers
  const addCauldrons = useCallback(() => {
    if (!map.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    cauldrons.forEach(cauldron => {
      if (cauldron.latitude == null || cauldron.longitude == null) return;

      const el = document.createElement('div');
      el.className = 'cauldron-marker';
      el.style.width = '40px';
      el.style.height = '60px';
      el.style.cursor = 'pointer';

      const pillContainer = document.createElement('div');
      pillContainer.style.width = '100%';
      pillContainer.style.height = '100%';
      pillContainer.style.borderRadius = '20px';
      pillContainer.style.border = '3px solid white';
      pillContainer.style.overflow = 'hidden';
      pillContainer.style.position = 'relative';
      pillContainer.style.backgroundColor = '#2a2a2a';
      pillContainer.style.boxShadow = '0 0 15px rgba(0,0,0,0.7)';

      const fillIndicator = document.createElement('div');
      fillIndicator.style.position = 'absolute';
      fillIndicator.style.bottom = '0';
      fillIndicator.style.left = '0';
      fillIndicator.style.width = '100%';
      fillIndicator.style.height = `${cauldron.fillPercent}%`;
      fillIndicator.style.transition = 'height 0.5s ease';
      
      const fillColor = cauldron.fillPercent >= 80 ? '#f5c9f3ff'
        : cauldron.fillPercent >= 60 ? '#c18fbfff'
        : cauldron.fillPercent >= 40 ? '#936691ff'
        : cauldron.fillPercent >= 20 ? '#7e4f7cff'
        : '#4d304cff';
      
      fillIndicator.style.backgroundColor = fillColor;
      fillIndicator.style.boxShadow = `0 0 10px ${fillColor}`;

      if (cauldron.fillPercent >= 80) {
        pillContainer.style.animation = 'pulse-warning 1.5s infinite';
      }

      const percentText = document.createElement('div');
      percentText.textContent = `${Math.round(cauldron.fillPercent)}%`;
      percentText.style.position = 'absolute';
      percentText.style.top = '50%';
      percentText.style.left = '50%';
      percentText.style.transform = 'translate(-50%, -50%)';
      percentText.style.color = 'white';
      percentText.style.fontSize = '10px';
      percentText.style.fontWeight = 'bold';
      percentText.style.textShadow = '0 0 3px black, 0 0 3px black';
      percentText.style.zIndex = '10';
      percentText.style.pointerEvents = 'none';

      pillContainer.appendChild(fillIndicator);
      pillContainer.appendChild(percentText);
      el.appendChild(pillContainer);

      const popupContent = `
        <div style="padding: 8px;">
          <strong>${cauldron.name}</strong><br/>
          <span style="color: #888;">ID: ${cauldron.id}</span><br/>
          Fill Level: <strong>${cauldron.fillPercent}%</strong><br/>
          Current: ${cauldron.currentFill} / ${cauldron.capacity}<br/>
          Available: ${cauldron.capacity - cauldron.currentFill}<br/>
          Location: [${cauldron.longitude.toFixed(4)}, ${cauldron.latitude.toFixed(4)}]
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 30 }).setHTML(popupContent);

      if (map.current) {
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([cauldron.longitude, cauldron.latitude])
          .setPopup(popup)
          .addTo(map.current);

        markersRef.current.push(marker);
      }
    });
  }, [cauldrons]);

  // No other node markers — we only render cauldrons (nodes data removed)

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 10px rgba(255,255,255,0.5); }
          50% { box-shadow: 0 0 20px rgba(255,255,255,0.8); }
          100% { box-shadow: 0 0 10px rgba(255,255,255,0.5); }
        }
        
        @keyframes pulse-warning {
          0% { box-shadow: 0 0 10px rgba(198, 41, 122, 0.5); }
          50% { box-shadow: 0 0 25px rgba(253, 28, 144, 0.5); }
          100% { box-shadow: 0 0 10px rgba(198, 41, 122, 0.5); }
        }
      `}</style>
      
      <div className="map-wrapper">
        <div ref={mapContainer} className="map-container" />
        <TimelineControl onTimeChange={handleTimeChange} />
      </div>
    </>
  );
}

export default NetworkMap;