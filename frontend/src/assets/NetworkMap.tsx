import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * Cauldron node in the network
 * API should return data in this format
 */
interface Cauldron {
  id: string;
  name: string;
  longitude: number;        // Geographic coordinates
  latitude: number;
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

// TODO: Replace with API call - GET /api/cauldrons
const sampleCauldrons: Cauldron[] = [
  {
    id: 'cauldron-1',
    name: 'North Hub',
    longitude: -74.006,
    latitude: 40.7128,
    capacity: 1000,
    currentFill: 750,
    fillPercent: 75
  },
  {
    id: 'cauldron-2',
    name: 'East Station',
    longitude: -73.935,
    latitude: 40.730,
    capacity: 500,
    currentFill: 200,
    fillPercent: 40
  },
  {
    id: 'cauldron-3',
    name: 'West Node',
    longitude: -74.075,
    latitude: 40.680,
    capacity: 750,
    currentFill: 680,
    fillPercent: 90
  }
];

// TODO: Replace with API call - GET /api/paths
const samplePaths: CauldronPath[] = [
  {
    id: 'path-1',
    from: 'cauldron-1',
    to: 'cauldron-2',
    bandwidth: 100,
    shouldPulse: true
  },
  {
    id: 'path-2',
    from: 'cauldron-1',
    to: 'cauldron-3',
    bandwidth: 50,
    shouldPulse: false
  },
  {
    id: 'path-3',
    from: 'cauldron-2',
    to: 'cauldron-3',
    bandwidth: 25,
    shouldPulse: true
  }
];

function NetworkMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  // TODO: Replace with API data fetching
  const [cauldrons] = useState<Cauldron[]>(sampleCauldrons);
  const [paths] = useState<CauldronPath[]>(samplePaths);

  // Initialize map once
  useEffect(() => {
    if (map.current) return;
    
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;
    
    if (!mapboxgl.accessToken) {
      console.error('Mapbox token is missing!');
      return;
    }
    
    if (!mapContainer.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/llinii/cmhqyfdby001k01s2e9ot3avh',
      center: [-74.006, 40.7128],
      zoom: 11
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      console.log('✅ Map loaded successfully!');
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map when data changes
  useEffect(() => {
    if (!map.current) return;

    map.current.on('load', () => {
      addPaths();
      addCauldrons();
    });

    if (map.current.loaded()) {
      addPaths();
      addCauldrons();
    }
  }, [cauldrons, paths]);

  // Draw connection lines between cauldrons
  const addPaths = () => {
    if (!map.current) return;

    const pathFeatures = paths.map(path => {
      const fromCauldron = cauldrons.find(c => c.id === path.from);
      const toCauldron = cauldrons.find(c => c.id === path.to);

      if (!fromCauldron || !toCauldron) return null;

      return {
        type: 'Feature' as const,
        properties: {
          id: path.id,
          bandwidth: path.bandwidth,
          shouldPulse: path.shouldPulse || false
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [fromCauldron.longitude, fromCauldron.latitude],
            [toCauldron.longitude, toCauldron.latitude]
          ]
        }
      };
    }).filter(Boolean);

    if (!map.current.getSource('paths')) {
      map.current.addSource('paths', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pathFeatures as any[]
        }
      });

      // Outer glow layer
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

      // Static paths
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

      // Pulsing paths (animated)
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

      // Inner bright core
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

      // Pulse animation
      let pulseOpacity = 0.5;
      let pulseDirection = 1;
      
      setInterval(() => {
        if (!map.current || !map.current.getLayer('paths-layer-pulse')) return;
        
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
    }
  };

  // Create pill-shaped markers for cauldrons
  const addCauldrons = () => {
    if (!map.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    cauldrons.forEach(cauldron => {
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

      // Fill indicator grows from bottom based on fillPercent
      const fillIndicator = document.createElement('div');
      fillIndicator.style.position = 'absolute';
      fillIndicator.style.bottom = '0';
      fillIndicator.style.left = '0';
      fillIndicator.style.width = '100%';
      fillIndicator.style.height = `${cauldron.fillPercent}%`;
      fillIndicator.style.transition = 'height 0.5s ease';
      
      // Color based on fill level
      let fillColor;
      if (cauldron.fillPercent >= 80) {
        fillColor = '#f5c9f3ff';
      } else if (cauldron.fillPercent >= 60) {
        fillColor = '#c18fbfff';
      } else if (cauldron.fillPercent >= 40) {
        fillColor = '#936691ff';
      } else if (cauldron.fillPercent >= 20) {
        fillColor = '#7e4f7cff';
      } else {
        fillColor = '#4d304cff';
      }
      
      fillIndicator.style.backgroundColor = fillColor;
      fillIndicator.style.boxShadow = `0 0 10px ${fillColor}`;

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

      // Pulse animation for critically full cauldrons
      if (cauldron.fillPercent >= 80) {
        pillContainer.style.animation = 'pulse-warning 1.5s infinite';
      }

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

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([cauldron.longitude, cauldron.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  };

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
      </div>
    </>
  );
}

export default NetworkMap;