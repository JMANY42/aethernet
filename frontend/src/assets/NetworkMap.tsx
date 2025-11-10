import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import TimelineControl from "./TimelineControl";
import "../styles/TimelineControl.css";
import GraphPopup from "./GraphPopup.tsx";
import ReactDOM from "react-dom/client";

/**
 * Cauldron node in the network
 * API should return data in this format
 */
interface Cauldron {
  id: string;
  name: string;
  longitude: number | null; // Geographic coordinates
  latitude: number | null;
  capacity: number;
  currentFill: number;
  fillPercent: number; // 0-100 for visualization
  metadata?: {
    [key: string]: any;
  };
}

/** Market node shape */
interface Market {
  id: string;
  name?: string;
  longitude: number | null;
  latitude: number | null;
  metadata?: { [key: string]: any };
}

/**
 * Connection between two cauldrons
 * API should return data in this format
 */
interface CauldronPath {
  id: string;
  from: string; // Source cauldron ID
  to: string; // Destination cauldron ID
  bandwidth?: number;
  latency?: number;
  shouldPulse?: boolean; // Enable pulsing animation
  metadata?: {
    [key: string]: any;
  };
}

interface CauldronLevels {
  cauldron_001: number;
  cauldron_002: number;
  cauldron_003: number;
  cauldron_004: number;
  cauldron_005: number;
  cauldron_006: number;
  cauldron_007: number;
  cauldron_008: number;
  cauldron_009: number;
  cauldron_010: number;
  cauldron_011: number;
  cauldron_012: number;
}

interface HistoricalData {
  timestamp: string;
  cauldron_levels: CauldronLevels;
}

function findClosestTimestamp(data: HistoricalData[]): HistoricalData | null {
  if (data.length === 0) return null;

  const now = new Date();

  return data.reduce((closest, current) => {
    const currentDiff = Math.abs(
      new Date(current.timestamp).getTime() - now.getTime()
    );
    const closestDiff = Math.abs(
      new Date(closest.timestamp).getTime() - now.getTime()
    );

    return currentDiff < closestDiff ? current : closest;
  });
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
  const [markets, setMarkets] = useState<Market[]>([]);
  // selectedTime previously used for timeline; we only pass timeline changes to fetchHistoricalData
  const [cauldronLevels, setCauldronLevels] = useState<HistoricalData[]>([]);

  // Process API responses and update state
  const handleData = useCallback(
    (sourceJson: any, networkJson: any, metaJson?: any) => {
      // sourceJson: either /api/Data result (array with cauldron_levels) or cauldron metadata array
      // metaJson: optional cauldron metadata array (when sourceJson is data)
      let cauldronLevels: { [key: string]: number } = {};
      let cauldronMetaFromApi: any[] | null = null;

      if (
        Array.isArray(sourceJson) &&
        sourceJson.length > 0 &&
        sourceJson[0].cauldron_levels
      ) {
        cauldronLevels = sourceJson[0].cauldron_levels || {};
        if (Array.isArray(metaJson)) cauldronMetaFromApi = metaJson;
      } else if (
        Array.isArray(sourceJson) &&
        sourceJson.length > 0 &&
        sourceJson[0].id
      ) {
        // sourceJson itself contains metadata
        cauldronMetaFromApi = sourceJson;
        sourceJson.forEach((c: any) => {
          if (c.currentFill != null)
            cauldronLevels[c.id] = Number(c.currentFill);
          else if (c.current_fill != null)
            cauldronLevels[c.id] = Number(c.current_fill);
          else if (c.fillPercent != null && c.max_volume != null)
            cauldronLevels[c.id] =
              (Number(c.fillPercent) / 100) * Number(c.max_volume);
        });
      }

      const cauldronsArr = cauldronMetaFromApi || [];

      const mappedCauldrons: Cauldron[] = cauldronsArr.map((c: any) => {
        const currentFill = cauldronLevels[c.id] || 0;
        const maxVolume = c.max_volume != null ? Number(c.max_volume) : 1000;
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
        console.log("Mapped cauldron:", cauldron);
        return cauldron;
      });

      // Map network paths
      const edges = networkJson?.edges || [];
      const mappedPaths: CauldronPath[] = edges.map((e: any, idx: number) => ({
        id: e.id || `edge-${idx}-${e.from}-${e.to}`,
        from: e.from,
        to: e.to,
        bandwidth: e.bandwidth != null ? Number(e.bandwidth) : undefined,
        latency:
          e.travel_time_minutes != null
            ? Number(e.travel_time_minutes)
            : undefined,
        shouldPulse:
          typeof e.travel_time_minutes === "number"
            ? e.travel_time_minutes < 10
            : false,
        metadata: e,
      }));

      setCauldrons(mappedCauldrons);
      setPaths(mappedPaths);
    },
    []
  );

  // Fetch historical data
  const fetchHistoricalData = useCallback(
    async (timestamp: string) => {
      try {
        // convert timestamp (ISO) to unix seconds for the /api/Data endpoint
        const date = Math.floor(new Date(timestamp).getTime() / 1000);
        console.log(
          "Fetching historical data for date (unix):",
          date,
          "iso:",
          timestamp
        );

        const [dataRes, networkRes, cauldronsRes] = await Promise.all([
          fetch(`/api/Data/?date=${date}`),
          // network may not vary by timestamp in this proxy; still request current network
          fetch("/api/Information/network"),
          // fetch cauldron metadata (locations, capacity)
          fetch("/api/Information/cauldrons"),
        ]);

        if (!dataRes.ok || !networkRes.ok || !cauldronsRes.ok) {
          throw new Error("Failed to fetch historical data");
        }

        const [dataJson, networkJson, cauldronsMetaJson] = await Promise.all([
          dataRes.json(),
          networkRes.json(),
          cauldronsRes.json(),
        ]);

        // dataJson expected as array with first element containing cauldron_levels
        const cauldronsJson = Array.isArray(dataJson)
          ? dataJson
          : dataJson
          ? [dataJson]
          : [];

        // cauldronsMetaJson may be an array of objects; pass as metaJson so handleData can merge locations
        handleData(
          cauldronsJson,
          networkJson,
          Array.isArray(cauldronsMetaJson) ? cauldronsMetaJson : null
        );
      } catch (err) {
        console.error("Failed to load historical data:", err);
      }
    },
    [handleData]
  );

  // Handle timeline time changes
  const handleTimeChange = useCallback(
    (timestamp: string) => {
      fetchHistoricalData(timestamp);
    },
    [fetchHistoricalData]
  );

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cRes, nRes, nodesRes, hData] = await Promise.all([
          fetch("/api/Information/cauldrons"),
          fetch("/api/Information/network"),
          fetch("/api/Information/nodes"),
          fetch("/api/Data"),
        ]);

        if (!cRes.ok || !nRes.ok || !nodesRes.ok || !hData.ok) {
          throw new Error("Failed to fetch initial data");
        }

        const cauldronsJson = cRes.ok ? await cRes.json() : null;
        const networkJson = nRes.ok ? await nRes.json() : null;
        const nodesJson = nodesRes.ok ? await nodesRes.json() : null;
        const cauldronLevelsJson = hData.ok ? await hData.json() : null;

        handleData(
          cauldronsJson,
          networkJson,
          Array.isArray(cauldronsJson) ? cauldronsJson : null
        );

        // cauldrons endpoint is expected to return an array
        const cauldronsArr = Array.isArray(cauldronsJson)
          ? cauldronsJson
          : (cauldronsJson && cauldronsJson.nodes) || [];

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
        const nodesArr = Array.isArray(nodesJson)
          ? nodesJson
          : (nodesJson && nodesJson.nodes) || [];
        const nodesLookup = new Map<string, any>();
        for (const n of nodesArr) {
          if (!n || !n.id) continue;
          nodesLookup.set(n.id, n);
        }

        // Extract market nodes so we can render them separately
        const marketNodes = nodesArr.filter(
          (n: any) => n && n.id && String(n.id).startsWith("market_")
        );
        const mappedMarkets: Market[] = marketNodes.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          longitude: m.longitude != null ? Number(m.longitude) : null,
          latitude: m.latitude != null ? Number(m.latitude) : null,
          metadata: m,
        }));
        setMarkets(mappedMarkets);

        // network endpoint expected shape: { edges: [...] }
        const edges = (networkJson && networkJson.edges) || [];
        const mappedPaths: CauldronPath[] = edges.map(
          (e: any, idx: number) => ({
            id: e.id || `edge-${idx}-${e.from}-${e.to}`,
            from: e.from,
            to: e.to,
            bandwidth: e.bandwidth != null ? Number(e.bandwidth) : undefined,
            latency:
              e.travel_time_minutes != null
                ? Number(e.travel_time_minutes)
                : undefined,
            // allow pulsing for short travel times as a heuristic, otherwise false
            shouldPulse:
              typeof e.travel_time_minutes === "number"
                ? e.travel_time_minutes < 10
                : false,
            metadata: e,
          })
        );

        // if (!mounted) return;
        setCauldrons(mappedCauldrons);
        setPaths(mappedPaths);

        //console.log("cauldrons",cauldrons);
        // Set cauldron levels - note that state updates are asynchronous
        // so we log the fetched data directly, not the state variable
        if (cauldronLevelsJson) {
          setCauldronLevels(cauldronLevelsJson);
          //console.log("cauldron levels loaded:", cauldronLevelsJson);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };

    loadInitialData();
  }, [handleData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

    if (!mapboxgl.accessToken) {
      console.error("Mapbox token is missing!");
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/llinii/cmhqyfdby001k01s2e9ot3avh",
      center: [-74.006, 40.7128],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.current.on("load", () => {
      //console.log('✅ Map loaded successfully!');
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map when data changes
  useEffect(() => {
    if (!map.current) return;

    console.log("Map update triggered with:", {
      cauldronCount: cauldrons.length,
      pathCount: paths.length,
    });

    const updateMap = () => {
      console.log("Updating map...");
      addPaths();
      addCauldrons();
      // Only perform fit on initial data load. Prevents timeline scrubbing
      // from re-centering or zooming the map when only fill levels change.
      if (!initialFitDone.current) {
        try {
          fitMapToNodes();
        } catch (e) {
          console.warn("fitMapToNodes error:", e);
        }
        initialFitDone.current = true;
      }
      console.log("Map update complete");
    };

    // Make sure we only add the load handler once
    const loadHandler = () => {
      console.log("Map loaded event triggered");
      updateMap();
    };

    if (!map.current.loaded()) {
      console.log("Map not yet loaded, adding load handler");
      map.current.on("load", loadHandler);
    } else {
      console.log("Map already loaded, updating immediately");
      updateMap();
    }

    return () => {
      if (map.current) {
        map.current.off("load", loadHandler);
      }
    };
  }, [cauldrons, paths]);

  // Add paths between nodes
  // Separate effect to update cauldron markers when historical data loads
  useEffect(() => {
    //console.log("redrawing:", cauldronLevels);
    //console.log(!map.current );
    //console.log();
    if (!map.current) return;
    //console.log("redrawing:", cauldronLevels);

    if (cauldrons.length === 0) return;

    // Only update markers if we have cauldronLevels data
    //console.log("redrawing:", cauldronLevels);

    if (cauldronLevels.length > 0) {
      const closestData = findClosestTimestamp(cauldronLevels)?.cauldron_levels;
      console.log("before:", cauldrons);
      console.log(closestData);
      if (closestData) {
        console.log(cauldrons[0].id);
        console.log(closestData[cauldrons[0].id as keyof CauldronLevels]);

        const newCauldrons = cauldrons.map((c) => ({
          ...c,
          currentFill: closestData[c.id as keyof CauldronLevels],
          fillPercent:
            (closestData[c.id as keyof CauldronLevels] / c.capacity) * 100,
        }));
        console.log("after:", newCauldrons);
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

    const resolveCoords = (id: string) => {
      const fromC = cauldrons.find((c) => c.id === id);
      if (fromC?.latitude != null && fromC?.longitude != null)
        return { latitude: fromC.latitude, longitude: fromC.longitude };
      return null;
    };

    const pathFeatures = paths
      .map((path) => {
        const fromCoords = resolveCoords(path.from);
        const toCoords = resolveCoords(path.to);
        if (!fromCoords || !toCoords) return null;

        return {
          type: "Feature" as const,
          properties: {
            id: path.id,
            bandwidth: path.bandwidth,
            shouldPulse: path.shouldPulse || false,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [fromCoords.longitude, fromCoords.latitude],
              [toCoords.longitude, toCoords.latitude],
            ],
          },
        };
      })
      .filter(Boolean);

    // Add links between cauldrons and markets (each cauldron -> each market)
    const marketFeatures = markets
      .flatMap((market) => {
        if (market.latitude == null || market.longitude == null) return [];
        return cauldrons
          .filter((c) => c.latitude != null && c.longitude != null)
          .map((c) => ({
            type: "Feature" as const,
            properties: {
              id: `marketlink-${c.id}-${market.id}`,
              linkType: "market",
              cauldronId: c.id,
              marketId: market.id,
            },
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [c.longitude as number, c.latitude as number],
                [market.longitude as number, market.latitude as number],
              ],
            },
          }));
      })
      .filter(Boolean);

    const combinedFeatures = [...pathFeatures, ...marketFeatures];

    if (map.current.getSource("paths")) {
      try {
        const src = map.current.getSource("paths") as mapboxgl.GeoJSONSource;
        src.setData({
          type: "FeatureCollection",
          features: combinedFeatures as any[],
        });
      } catch (e) {
        console.error("Failed to update paths source:", e);
      }
      return;
    }

    map.current.addSource("paths", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: combinedFeatures as any[],
      },
    });

    // Add path layers
    map.current.addLayer({
      id: "paths-glow",
      type: "line",
      source: "paths",
      paint: {
        "line-color": "#e0aaff",
        "line-width": 16,
        "line-opacity": 0.4,
        "line-blur": 8,
      },
    });

    map.current.addLayer({
      id: "paths-layer",
      type: "line",
      source: "paths",
      filter: ["!=", ["get", "shouldPulse"], true],
      paint: {
        "line-color": "#c77dff",
        "line-width": 8,
        "line-opacity": 0.95,
        "line-blur": 1,
      },
    });

    map.current.addLayer({
      id: "paths-layer-pulse",
      type: "line",
      source: "paths",
      filter: ["==", ["get", "shouldPulse"], true],
      paint: {
        "line-color": "#c77dff",
        "line-width": 8,
        "line-opacity": 0.95,
        "line-blur": 1,
      },
    });

    map.current.addLayer({
      id: "paths-core",
      type: "line",
      source: "paths",
      paint: {
        "line-color": "#ffffff",
        "line-width": 3,
        "line-opacity": 0.6,
        "line-blur": 0.5,
      },
    });

    // Market links layer (thin dashed lines)
    map.current.addLayer({
      id: "market-links",
      type: "line",
      source: "paths",
      filter: ["==", ["get", "linkType"], "market"],
      paint: {
        "line-color": "#6bc1ff",
        "line-width": 2,
        "line-opacity": 0.85,
        "line-dasharray": [2, 2],
      },
    });

    // Animation for pulsing paths
    let pulseOpacity = 0.5;
    let pulseDirection = 1;

    const interval = setInterval(() => {
      if (!map.current?.getLayer("paths-layer-pulse")) {
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
        "paths-layer-pulse",
        "line-opacity",
        pulseOpacity
      );
    }, 30);

    return () => clearInterval(interval);
  };

  // Fit map view to include all nodes
  const fitMapToNodes = useCallback(() => {
    if (!map.current) return;

    const coords = cauldrons
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({ latitude: c.latitude!, longitude: c.longitude! }));

    if (coords.length === 0) return;

    if (coords.length === 1) {
      const p = coords[0];
      try {
        map.current.flyTo({
          center: [p.longitude, p.latitude],
          zoom: 12,
          speed: 0.8,
        });
      } catch (e) {
        console.error("Failed to fly to point:", e);
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
      console.error("Failed to fit bounds:", e);
    }
  }, [cauldrons]);

  // Add cauldron markers
  const addCauldrons = useCallback(() => {
    if (!map.current) return;
    console.log("in add cauldrons", cauldrons);

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    cauldrons.forEach((cauldron) => {
      if (cauldron.latitude == null || cauldron.longitude == null) return;

      const el = document.createElement("div");
      el.className = "cauldron-marker";
      el.style.width = "40px";
      el.style.height = "60px";
      el.style.cursor = "pointer";

      const pillContainer = document.createElement("div");
      pillContainer.style.width = "100%";
      pillContainer.style.height = "100%";
      pillContainer.style.borderRadius = "20px";
      pillContainer.style.border = "3px solid white";
      pillContainer.style.overflow = "hidden";
      pillContainer.style.position = "relative";
      pillContainer.style.backgroundColor = "#2a2a2a";
      pillContainer.style.boxShadow = "0 0 15px rgba(0,0,0,0.7)";

      const fillIndicator = document.createElement("div");
      fillIndicator.style.position = "absolute";
      fillIndicator.style.bottom = "0";
      fillIndicator.style.left = "0";
      fillIndicator.style.width = "100%";
      fillIndicator.style.height = `${cauldron.fillPercent}%`;
      fillIndicator.style.transition = "height 0.5s ease";

      const fillColor =
        cauldron.fillPercent >= 80
          ? "#f5c9f3ff"
          : cauldron.fillPercent >= 60
          ? "#c18fbfff"
          : cauldron.fillPercent >= 40
          ? "#936691ff"
          : cauldron.fillPercent >= 20
          ? "#7e4f7cff"
          : "#4d304cff";

      fillIndicator.style.backgroundColor = fillColor;
      fillIndicator.style.boxShadow = `0 0 10px ${fillColor}`;

      if (cauldron.fillPercent >= 80) {
        pillContainer.style.animation = "pulse-warning 1.5s infinite";
      }

      const percentText = document.createElement("div");
      percentText.textContent = `${Math.round(cauldron.fillPercent)}%`;
      percentText.style.position = "absolute";
      percentText.style.top = "50%";
      percentText.style.left = "50%";
      percentText.style.transform = "translate(-50%, -50%)";
      percentText.style.color = "white";
      percentText.style.fontSize = "10px";
      percentText.style.fontWeight = "bold";
      percentText.style.textShadow = "0 0 3px black, 0 0 3px black";
      percentText.style.zIndex = "10";
      percentText.style.pointerEvents = "none";

      pillContainer.appendChild(fillIndicator);
      pillContainer.appendChild(percentText);
      el.appendChild(pillContainer);

      // Pulse animation for critically full cauldrons
      if (cauldron.fillPercent >= 80) {
        pillContainer.style.animation = "pulse-warning 1.5s infinite";
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
      root.render(
        <GraphPopup
          data={levels.slice(11000)}
          maxFill={cauldron.capacity}
          name={cauldron.name}
          width={width}
          height={height}
        />
      );

      // Use setDOMContent instead of setHTML
      const popup = new mapboxgl.Popup({
        offset: 30,
        maxWidth: "800px", // Add this to prevent the popup from constraining the content
      }).setDOMContent(popupNode);

      const styleTag = document.createElement("style");
      styleTag.textContent = `
  .mapboxgl-popup-close-button {
    color: #ff0000;
  }
`;
      document.head.appendChild(styleTag);

      if (map.current) {
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([cauldron.longitude, cauldron.latitude])
          .setPopup(popup)
          .addTo(map.current);

        markersRef.current.push(marker);
      }
    });

    // Render markets as large triangular markers with centered name and description popup
    markets.forEach((market) => {
      if (market.latitude == null || market.longitude == null) return;

      // container for triangle + label
      const mEl = document.createElement("div");
      mEl.className = "market-marker";
      mEl.style.width = "120px";
      mEl.style.height = "100px";
      mEl.style.position = "relative";
      mEl.style.display = "flex";
      mEl.style.alignItems = "center";
      mEl.style.justifyContent = "center";
      mEl.style.cursor = "pointer";

      // render a cartoon shop booth as the market marker
      const booth = document.createElement("div");
      booth.style.width = "96px";
      booth.style.height = "86px";
      booth.style.position = "absolute";
      booth.style.left = "50%";
      booth.style.top = "50%";
      // center the booth SVG within the marker element so the marker's center
      // aligns with the map coordinate when using anchor: 'center'
      booth.style.transform = "translate(-50%, -50%)";
      booth.style.pointerEvents = "auto";
      booth.innerHTML = `
        <svg width="96" height="86" viewBox="0 0 96 86" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="wd-bg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#5b2c82" />
              <stop offset="100%" stop-color="#2b0f3a" />
            </linearGradient>
            <linearGradient id="wd-roof" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#a04cff" />
              <stop offset="100%" stop-color="#6b2fb3" />
            </linearGradient>
          </defs>
          <!-- den backdrop -->
          <rect x="6" y="22" width="84" height="54" rx="8" fill="url(#wd-bg)" stroke="#1a0520" stroke-width="1" />
          <!-- crooked roof -->
          <path d="M10 24 C28 8, 68 8, 86 24 L86 36 L10 36 Z" fill="url(#wd-roof)" stroke="#3a0e55" stroke-width="1.5"/>
          <!-- moon accent -->
          <circle cx="76" cy="12" r="6" fill="#ffeaa7" opacity="0.95" />
          <!-- crooked chimney -->
          <rect x="60" y="6" width="8" height="10" rx="2" fill="#3a0e55" />
          <!-- door -->
          <rect x="36" y="42" width="24" height="32" rx="6" fill="#2b1b2b" stroke="#0f0a0f" />
          <circle cx="56" cy="58" r="2" fill="#ffd36b" />
          <!-- window with glow -->
          <rect x="20" y="40" width="10" height="10" rx="2" fill="#ffd36b" opacity="0.95" />
          <!-- bubbling cauldron in front -->
          <ellipse cx="48" cy="70" rx="10" ry="5" fill="#111" />
          <rect x="40" y="62" width="16" height="10" rx="4" fill="#2b2b2b" />
          <circle cx="46" cy="62" r="1.8" fill="#9bf6e4" />
          <circle cx="52" cy="60" r="1.6" fill="#9bf6e4" />
          <!-- broom leaning -->
          <path d="M74 58 L84 70" stroke="#b27b39" stroke-width="3" stroke-linecap="round" />
          <path d="M82 68 L86 66 L82 64" stroke="#f6d29a" stroke-width="3" stroke-linecap="round" />
          <!-- sign plaque -->
          <rect x="14" y="8" width="68" height="12" rx="6" fill="#2b1033" opacity="0.9" />
          <text x="48" y="16" text-anchor="middle" font-size="8" font-weight="700" fill="#ffd36b">${market.name}</text>market.name}</text>
        </svg>
      `;

      mEl.appendChild(booth);

      // popup content shows description when clicked
      const popupNode = document.createElement("div");
      const desc =
        market.metadata && market.metadata.description
          ? market.metadata.description
          : "(no description)";
      popupNode.innerHTML = `<div style="padding:10px; max-width:320px;"><strong>${
        market.name
      }</strong><div style="margin-top:6px; color:#222;">${String(
        desc
      )}</div><div style="margin-top:8px; font-size:11px; color:#666;">ID: ${
        market.id
      }</div></div>`;

      if (map.current) {
        const marker = new mapboxgl.Marker({ element: mEl, anchor: "center" })
          .setLngLat([market.longitude, market.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setDOMContent(popupNode))
          .addTo(map.current);
        markersRef.current.push(marker);
      }
    });
  }, [cauldrons, markets]);

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
