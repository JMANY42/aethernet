const express = require("express");
const router = express.Router();
const axios = require("axios");
const { forwardGet } = require("../middleware/apiProxy");

// Create axios instance for local API calls
const localApiClient = axios.create({
  baseURL: 'https://hackutd2025.eog.systems/',
  timeout: 5000
});

// Store historical data with timestamps
const historicalData = new Map();

// Helper to get data for a specific timestamp
const getDataForTimestamp = (timestamp) => {
  if (!timestamp) return null;
  const targetTime = new Date(timestamp);
  if (isNaN(targetTime.getTime())) return null;
  return historicalData.get(timestamp) || null;
};

// GET /api/Information/timeRange - Get available time range
router.get('/Information/timeRange', (req, res) => {
  try {
    // Get earliest and latest timestamps from historical data
    const timestamps = Array.from(historicalData.keys()).map(ts => new Date(ts).getTime());
    const start = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();
    
    res.json({
      start: start.toISOString(),
      end: end.toISOString(),
      hasHistoricalData: timestamps.length > 0
    });
  } catch (err) {
    console.error('Error fetching time range:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/Information/cauldrons - with timestamp support
router.get("/Information/cauldrons", async (req, res) => {
  try {
    const { timestamp } = req.query;

    // If timestamp is provided, use historical data
    if (timestamp) {
      const historicalData = getDataForTimestamp(timestamp);
      if (historicalData?.cauldrons) {
        return res.json(historicalData.cauldrons);
      }
    }
    // No timestamp -> forward directly to the upstream cauldrons endpoint
    return forwardGet(`/api/Information/cauldrons`, res);
  } catch (err) {
    console.error('Error fetching cauldrons:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/Information/network - with timestamp support
router.get("/Information/network", async (req, res) => {
  try {
    const { timestamp } = req.query;
    const historicalData = getDataForTimestamp(timestamp);

    if (historicalData?.network) {
      return res.json(historicalData.network);
    }

    // Forward to original endpoint if no historical data
    return forwardGet(`/api/Information/network`, res);
  } catch (err) {
    console.error('Error fetching network:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// The routes below are unchanged from the original implementation
router.get("/Data", (req, res) => {
  const incoming = { ...req.query };

  if (incoming.date && !incoming.start_date && !incoming.end_date) {
    const numeric = Number(incoming.date);
    if (!Number.isFinite(numeric)) return res.status(400).json({ error: 'query parameter `date` must be a number (unix seconds)' });
    const end = Math.floor(numeric);
    const start = end - 59;
    incoming.start_date = start;
    incoming.end_date = end;
    delete incoming.date;
  }

  const qs = new URLSearchParams(incoming).toString();
  const path = `/api/Data${qs ? `/?${qs}` : ""}`;
  return forwardGet(path, res);
});

router.get('/Data/current', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 59;
  const path = `/api/Data/?start_date=${start}&end_date=${now}`;
  return forwardGet(path, res);
});

router.get("/Data/metadata", (req, res) => {
  return forwardGet(`/api/Data/metadata`, res);
});

router.get("/Information/market", (req, res) => {
  return forwardGet(`/api/Information/market`, res);
});

router.get("/Information/couriers", (req, res) => {
  return forwardGet(`/api/Information/couriers`, res);
});

router.get("/Information/graph/neighbors/:nodeId", (req, res) => {
  const { nodeId } = req.params;
  return forwardGet(`/api/Information/graph/neighbors/${encodeURIComponent(nodeId)}`, res);
});

router.get("/Information/graph/neighbors/directed/:nodeId", (req, res) => {
  const { nodeId } = req.params;
  return forwardGet(`/api/Information/graph/neighbors/directed/${encodeURIComponent(nodeId)}`, res);
});

router.get('/Information/graph/shortestPath/:fromId/:toId', (req, res) => {
  const { fromId, toId } = req.params;

  let graph = null;
  try {
    const { getGraph } = require('../map/graphStore');
    graph = getGraph();
  } catch (e) {
    // ignore and fallback
  }
  if (!graph && req.app && req.app.locals) graph = req.app.locals.graph;

  if (!graph) return res.status(503).json({ error: 'Graph not available' });

  try {
    const result = graph.shortestPath(fromId, toId);
    if (!result) return res.status(404).json({ error: 'No path found' });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Error computing shortest path', details: String(err) });
  }
});

router.get("/Tickets", (req, res) => {
  return forwardGet(`/api/Tickets`, res);
});

router.get('/Information/nodes', (req, res) => {
  let graph = null;
  try {
    const { getGraph } = require('../map/graphStore');
    graph = getGraph();
  } catch (e) {
    // ignore and fallback
  }
  if (!graph && req.app && req.app.locals) graph = req.app.locals.graph;
  if (!graph) return res.status(503).json({ error: 'Graph not available' });

  const out = [];
  for (const [id, node] of graph.nodes.entries()) {
    if (node && typeof node.toJSON === 'function') {
      const nodeData = node.toJSON();
      // Add required fields for cauldrons
      if (String(node.id).startsWith('cauldron_')) {
        nodeData.max_volume = 1000;
        // Include location if not already set
        if (nodeData.latitude == null || nodeData.longitude == null) {
          nodeData.latitude = 40.7128 + (Math.random() - 0.5) * 0.1;
          nodeData.longitude = -74.006 + (Math.random() - 0.5) * 0.1;
        }
      }
      out.push(nodeData);
    } else {
      out.push({ id });
    }
  }

  console.log('Returning nodes:', JSON.stringify({ nodes: out }, null, 2));
  return res.json({ nodes: out });
});

// Function to generate historical data (for development)
const generateHistoricalData = (graph) => {
  if (!graph) return;

  // Generate data for the last 24 hours in 15-minute intervals
  const endTime = Date.now();
  const startTime = endTime - 24 * 60 * 60 * 1000;
  const interval = 15 * 60 * 1000; // 15 minutes

  for (let time = startTime; time <= endTime; time += interval) {
    const timestamp = new Date(time).toISOString();
    
    // Generate random fill levels for cauldrons between 0 and 1000
    const cauldronNodes = Array.from(graph.nodes.values())
      .filter(node => node && typeof node.toJSON === 'function' && String(node.id).startsWith('cauldron_'));

    const cauldronLevels = {};
    cauldronNodes.forEach(cauldron => {
      const maxLevel = 1000; // max level appears to be 1000 based on the API data
      cauldronLevels[cauldron.id] = Math.random() * maxLevel;
    });

    const cauldrons = [{
      timestamp: new Date(time).toISOString(),
      cauldron_levels: cauldronLevels
    }];

    // Vary edge properties but keep structure
    const edges = Array.from(graph.adjacency.entries()).flatMap(([from, neighbors]) =>
      Array.from(neighbors.entries()).map(([to, info]) => ({
        from,
        to,
        travel_time_minutes: info.travel_time_minutes * (0.8 + Math.random() * 0.4), // ±20%
        bandwidth: info.bandwidth * (0.8 + Math.random() * 0.4), // ±20%
      }))
    );

    historicalData.set(timestamp, {
      cauldrons,
      network: { edges },
    });
  }

  console.log(`Generated historical data for ${historicalData.size} timestamps`);
};

// Generate mock historical data when in development
if (process.env.NODE_ENV !== 'production') {
  try {
    // Clear any existing historical data
    historicalData.clear();
    
    const { getGraph } = require('../map/graphStore');
    const graph = getGraph();
    if (graph) {
      generateHistoricalData(graph);
      console.log(`Successfully generated historical data with ${historicalData.size} timestamps`);
    } else {
      console.warn('No graph available for generating historical data');
    }
  } catch (err) {
    console.error('Error generating historical data:', err);
  }
}

module.exports = router;