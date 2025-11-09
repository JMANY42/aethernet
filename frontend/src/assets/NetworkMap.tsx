import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import GraphPopup from './GraphPopup.tsx'
import ReactDOMServer from "react-dom/server";
import ReactDOM from "react-dom/client";

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

interface CauldronLevels {
  cauldron_001: number,
  cauldron_002: number,
  cauldron_003: number,
  cauldron_004: number,
  cauldron_005: number,
  cauldron_006: number,
  cauldron_007: number,
  cauldron_008: number,
  cauldron_009: number,
  cauldron_010: number,
  cauldron_011: number,
  cauldron_012: number
}

interface HistoricalData {
  timestamp: string;
  cauldron_levels: CauldronLevels;
}



function findClosestTimestamp(data: HistoricalData[]): HistoricalData | null {
  if (data.length === 0) return null;

  const now = new Date();
  
  return data.reduce((closest, current) => {
    const currentDiff = Math.abs(new Date(current.timestamp).getTime() - now.getTime());
    const closestDiff = Math.abs(new Date(closest.timestamp).getTime() - now.getTime());
    
    return currentDiff < closestDiff ? current : closest;
  })
}
// TODO: Replace with API call - GET /api/cauldrons
const sampleCauldrons: Cauldron[] = [
  {
    id: 'cauldron_001',
    name: 'North Hub',
    longitude: -74.006,
    latitude: 40.7128,
    capacity: 1000,
    currentFill: 750,
    fillPercent: 75
  },
  {
    id: 'cauldron_002',
    name: 'East Station',
    longitude: -73.935,
    latitude: 40.730,
    capacity: 500,
    currentFill: 200,
    fillPercent: 40
  },
  {
    id: 'cauldron_003',
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
  
  // State populated from API
  const [cauldrons, setCauldrons] = useState<Cauldron[]>([]);
  const [paths, setPaths] = useState<CauldronPath[]>([]);
  const [cauldronLevels, setCauldronLevels] = useState<HistoricalData[]>([]);

  // Fetch cauldrons, network edges and node index from the backend proxy on mount
  // We keep a separate nodesArray so we can resolve coordinates for edges
  // that reference nodes which are not in the cauldrons list (e.g. markets).
  const [nodesArray, setNodesArray] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [cRes, nRes, nodesRes, hData] = await Promise.all([
          fetch('/api/Information/cauldrons'),
          fetch('/api/Information/network'),
          fetch('/api/Information/nodes'),
          fetch('/api/Data')
        ]);

        const cauldronsJson = cRes.ok ? await cRes.json() : null;
        const networkJson = nRes.ok ? await nRes.json() : null;
        const nodesJson = nodesRes.ok ? await nodesRes.json() : null;
        const cauldronLevelsJson = hData.ok ? await hData.json() : null;
        // cauldrons endpoint is expected to return an array
        const cauldronsArr = Array.isArray(cauldronsJson) ? cauldronsJson : (cauldronsJson && cauldronsJson.nodes) || [];

          const mappedCauldrons = cauldronsArr.map((c: any) => ({
          id: c.id,
          name: c.name || c.id,
          longitude: c.longitude != null ? Number(c.longitude) : null,
          latitude: c.latitude != null ? Number(c.latitude) : null,
          capacity: c.max_volume != null ? Number(c.max_volume) : 0,
          // preserve unknowns — UI uses fillPercent; if not present default to 0
          currentFill: 0,
          fillPercent: c.fillPercent != null ? Number(c.fillPercent) : 0,
          metadata: c,
        }));

              // const key: keyof CauldronLevels = cauldron.id as keyof CauldronLevels;

        
        // let mappedCauldrons = _mappedCauldrons;
        // if (closestData) {
        //   mappedCauldrons = _mappedCauldrons.map((c) => ({
        //   currentFill: closestData[c.name as keyof CauldronLevels],
        // }))
        // }

        // Build a lookup of nodes returned by /api/Information/nodes
        const nodesArr = Array.isArray(nodesJson) ? nodesJson : (nodesJson && nodesJson.nodes) || [];
        const nodesLookup = new Map<string, any>();
        for (const n of nodesArr) {
          if (!n || !n.id) continue;
          nodesLookup.set(n.id, n);
        }

        // network endpoint expected shape: { edges: [...] }
        const edges = (networkJson && networkJson.edges) || [];
        const mappedPaths: CauldronPath[] = edges.map((e: any, idx: number) => ({
          id: e.id || `edge-${idx}-${e.from}-${e.to}`,
          from: e.from,
          to: e.to,
          bandwidth: e.bandwidth != null ? Number(e.bandwidth) : undefined,
          latency: e.travel_time_minutes != null ? Number(e.travel_time_minutes) : undefined,
          // allow pulsing for short travel times as a heuristic, otherwise false
          shouldPulse: typeof e.travel_time_minutes === 'number' ? e.travel_time_minutes < 10 : false,
          metadata: e,
        }));

        if (!mounted) return;
        setCauldrons(mappedCauldrons);
        setPaths(mappedPaths);
        setNodesArray(nodesArr);
        
        //console.log("cauldrons",cauldrons);
        // Set cauldron levels - note that state updates are asynchronous
        // so we log the fetched data directly, not the state variable
        if (cauldronLevelsJson) {
          setCauldronLevels(cauldronLevelsJson);
          //console.log("cauldron levels loaded:", cauldronLevelsJson);
        }
      } catch (err) {
        // keep console error; UI will render gracefully with empty arrays
        // consumer can add user-visible error handling if desired
        // eslint-disable-next-line no-console
        console.error('Failed to load map data', err);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

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
      //console.log('✅ Map loaded successfully!');
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map when data changes (include nodesArray so edges render once
  // node coordinates are available).
  useEffect(() => {
    if (!map.current) return;

    map.current.on('load', () => {
      addPaths();
      addCauldrons();
      addOtherNodes();
      fitMapToNodes();
    });

    if (map.current.loaded()) {
      addPaths();
      addCauldrons();
      addOtherNodes();
      fitMapToNodes();
    }
  }, [cauldrons, paths, nodesArray]);

  // Separate effect to update cauldron markers when historical data loads
  useEffect(() => {
        //console.log("redrawing:", cauldronLevels);
      //console.log(!map.current );
      //console.log();
    if (!map.current ) return;
        //console.log("redrawing:", cauldronLevels);

    if (cauldrons.length === 0) return;
    
    // Only update markers if we have cauldronLevels data      
    //console.log("redrawing:", cauldronLevels);

    if (cauldronLevels.length > 0) {
        const closestData = findClosestTimestamp(cauldronLevels)?.cauldron_levels;
      console.log("before:",cauldrons);
      console.log(closestData)
      if (closestData) {
        console.log(cauldrons[0].id)
        console.log(closestData[cauldrons[0].id as keyof CauldronLevels])

        const newCauldrons = cauldrons.map((c) => ({
          ...c,
          currentFill: closestData[c.id as keyof CauldronLevels],
          fillPercent: closestData[c.id as keyof CauldronLevels]/c.capacity * 100,
        }));
                    console.log("after:",newCauldrons);
        setCauldrons(newCauldrons);
      }

      //console.log("redrawing");
      // addCauldrons();
    }
  }, [cauldronLevels]);

  useEffect(() => {
  if (!map.current) return;
  if (cauldrons.length === 0) return;
  
  console.log("add cauldrons", cauldrons);
  addCauldrons();
}, [cauldrons]);

  // Draw connection lines between cauldrons
  const addPaths = () => {
    if (!map.current) return;

    // Resolve coordinates for a node id by preferring cauldrons state and
    // falling back to the nodesArray fetched from /api/Information/nodes.
    const resolveCoords = (id: string) => {
      const fromC = cauldrons.find((c) => c.id === id);
      if (fromC && fromC.latitude != null && fromC.longitude != null)
        return { latitude: fromC.latitude, longitude: fromC.longitude };
      const n = nodesArray.find((x) => x.id === id);
      if (n && n.latitude != null && n.longitude != null)
        return { latitude: Number(n.latitude), longitude: Number(n.longitude) };
      return null;
    };

    // Debug: compute coordinate frequency to detect any common convergence point
    const coordCounts = new Map<string, number>();
    for (const path of paths) {
      const a = resolveCoords(path.from);
      const b = resolveCoords(path.to);
      if (a) {
        const key = `${a.latitude},${a.longitude}`;
        coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
      }
      if (b) {
        const key = `${b.latitude},${b.longitude}`;
        coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
      }
    }
    // eslint-disable-next-line no-console
    console.debug('[NetworkMap] coord frequency (top 5):', Array.from(coordCounts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5));

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

    // If the source already exists, just update its data. Otherwise create
    // the source and layers once.
    if (map.current.getSource('paths')) {
      try {
        const src: any = map.current.getSource('paths');
        src.setData({ type: 'FeatureCollection', features: pathFeatures as any[] });
      } catch (e) {
        // ignore setData errors
      }
      return;
    }

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

  // Fit the map view to include all nodes (cauldrons + other nodes). If
  // there is only one node, center on it with a reasonable zoom level.
  const fitMapToNodes = () => {
    if (!map.current) return;

    const coords: Array<{ latitude: number; longitude: number }> = [];

    for (const c of cauldrons) {
      if (c.latitude == null || c.longitude == null) continue;
      coords.push({ latitude: c.latitude, longitude: c.longitude });
    }

    for (const n of nodesArray) {
      if (!n) continue;
      const lat = n.latitude != null ? Number(n.latitude) : null;
      const lon = n.longitude != null ? Number(n.longitude) : null;
      if (lat == null || lon == null) continue;
      // skip if already represented by a cauldron (avoid duplicates)
      if (cauldrons.find((c) => c.id === n.id)) continue;
      coords.push({ latitude: lat, longitude: lon });
    }

    if (coords.length === 0) return;

    if (coords.length === 1) {
      const p = coords[0];
      try {
        map.current.flyTo({ center: [p.longitude, p.latitude], zoom: 12, speed: 0.8 });
      } catch (e) {
        // ignore
      }
      return;
    }

    let minLat = Infinity,
      minLon = Infinity,
      maxLat = -Infinity,
      maxLon = -Infinity;

    for (const p of coords) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    }

    // add a small padding to bounds
    const sw: [number, number] = [minLon, minLat];
    const ne: [number, number] = [maxLon, maxLat];

    try {
      map.current.fitBounds([sw, ne], { padding: 80, maxZoom: 14, duration: 800 });
    } catch (e) {
      // ignore
    }
  };

  // Create pill-shaped markers for cauldrons
  const addCauldrons = () => {
    if (!map.current) return;
  console.log("in add cauldrons", cauldrons);

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    cauldrons.forEach(cauldron => {
      // Skip markers for nodes without valid coordinates
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

      // const popupContent = `
      //   <div style="padding: 8px;">
      //     <strong>${cauldron.name}</strong><br/>
      //     <span style="color: #888;">ID: ${cauldron.id}</span><br/>
      //     Fill Level: <strong>${cauldron.fillPercent}%</strong><br/>
      //     Current: ${cauldron.currentFill} / ${cauldron.capacity}<br/>
      //     Available: ${cauldron.capacity - cauldron.currentFill}<br/>
      //     Location: [${cauldron.longitude.toFixed(4)}, ${cauldron.latitude.toFixed(4)}]
      //   </div>
      // `;

      const key: keyof CauldronLevels = cauldron.id as keyof CauldronLevels;
      // //console.log("cauldron id",cauldron.id);
      // //console.log(key);
      const levels = cauldronLevels.map((obj) => obj.cauldron_levels[key]);
      // //console.log(cauldronLevels.map((obj) => obj.cauldron_levels)[0][key]);
      //console.log(levels);
      //console.log(typeof levels)
      // //console.log(cauldronLevels);
      // const popupContent = <GraphPopup data={levels}></GraphPopup>

      // Create a container for the popup
      const popupNode = document.createElement("div");
      // popupNode.style.width = "800px";
      // popupNode.style.height = "400px";      // Mount the React component into it
      const root = ReactDOM.createRoot(popupNode);

      const width = 400;
      const height = 250;
      //console.log("cauldron", cauldron);
      root.render(<GraphPopup data={levels.slice(0, 1000)} maxFill={cauldron.capacity} name={cauldron.name} width={width} height={height}/>);

      // Use setDOMContent instead of setHTML
      const popup = new mapboxgl.Popup({ offset: 30,   maxWidth: '800px'  // Add this to prevent the popup from constraining the content
 }).setDOMContent(popupNode);

const styleTag = document.createElement('style');
styleTag.textContent = `
  .mapboxgl-popup-close-button {
    color: #ff0000;
  }
`;
      document.head.appendChild(styleTag);

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

  // Render small markers for other nodes (markets/placeholders) that are
  // present in nodesArray but not in the cauldrons list. This helps reveal
  // any node that edges are pointing to (so you can see the mysterious point).
  const addOtherNodes = () => {
    if (!map.current) return;

    // reuse markersRef for cleanup; we already cleared it in addCauldrons
    // so adding here will include both cauldrons and other nodes.
    const cauldronIds = new Set(cauldrons.map((c) => c.id));

    for (const n of nodesArray) {
      if (!n || !n.id) continue;
      if (cauldronIds.has(n.id)) continue; // already rendered as cauldron
      if (n.latitude == null || n.longitude == null) continue;

      const el = document.createElement('div');
      el.className = 'node-marker';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '6px';
      el.style.background = '#00bcd4';
      el.style.border = '2px solid white';
      el.title = String(n.id);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([Number(n.longitude), Number(n.latitude)])
        .addTo(map.current);

      markersRef.current.push(marker);
    }
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