const express = require("express");
const router = express.Router();
const { forwardGet } = require("../middleware/apiProxy");

// The routes below mirror the external service and proxy responses.

// GET /api/Data
// Accepts optional query parameters (e.g. start_date, end_date, date) and forwards them
router.get("/Data", (req, res) => {
  // Support two behaviors:
  // 1) Existing: forward any incoming query params (start_date/end_date etc.)
  // 2) Convenience: if caller provides a single `date` (unix seconds) param and
  //    does not provide start_date/end_date, compute start_date=(date-59) and end_date=date
  //    and forward those as query params to the upstream.
  const incoming = { ...req.query };

  if (incoming.date && !incoming.start_date && !incoming.end_date) {
    const numeric = Number(incoming.date);
    if (!Number.isFinite(numeric)) return res.status(400).json({ error: 'query parameter `date` must be a number (unix seconds)' });
    const end = Math.floor(numeric);
    const start = end - 59; // keep a 60-second window (inclusive)
    incoming.start_date = start;
    incoming.end_date = end;
    delete incoming.date;
  }

  // Rebuild query string from incoming/normalized request
  const qs = new URLSearchParams(incoming).toString();
  const path = `/api/Data${qs ? `/?${qs}` : ""}`;
  return forwardGet(path, res);
});

// GET /api/Data/current
// Calls the upstream /api/Data/:start_date/:end_date with end_date = now (unix seconds)
// and start_date = now - 60 (last 60 seconds).
router.get('/Data/current', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 59;
  const path = `/api/Data/?start_date=${start}&end_date=${now}`;
  return forwardGet(path, res);
});

// GET /api/Data/metadata
router.get("/Data/metadata", (req, res) => {
  return forwardGet(`/api/Data/metadata`, res);
});

// GET /api/Information/network
router.get("/Information/network", (req, res) => {
  return forwardGet(`/api/Information/network`, res);
});

// GET /api/Information/market
router.get("/Information/market", (req, res) => {
  return forwardGet(`/api/Information/market`, res);
});

// GET /api/Information/couriers
router.get("/Information/couriers", (req, res) => {
  return forwardGet(`/api/Information/couriers`, res);
});

// GET /api/Information/cauldrons
router.get("/Information/cauldrons", (req, res) => {
  return forwardGet(`/api/Information/cauldrons`, res);
});

// GET /api/Information/graph/neighbors/{nodeId}
router.get("/Information/graph/neighbors/:nodeId", (req, res) => {
  const { nodeId } = req.params;
  return forwardGet(`/api/Information/graph/neighbors/${encodeURIComponent(nodeId)}`, res);
});

// GET /api/Information/graph/neighbors/directed/{nodeId}
router.get("/Information/graph/neighbors/directed/:nodeId", (req, res) => {
  const { nodeId } = req.params;
  return forwardGet(`/api/Information/graph/neighbors/directed/${encodeURIComponent(nodeId)}`, res);
});

// GET /api/Information/graph/shortestPath/{fromId}/{toId}
// Uses the in-memory graph built on server startup and returns the shortestPath output.
router.get('/Information/graph/shortestPath/:fromId/:toId', (req, res) => {
  const { fromId, toId } = req.params;

  // Retrieve graph from shared graphStore first, fallback to app.locals.graph
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

// GET /api/Tickets
router.get("/Tickets", (req, res) => {
  return forwardGet(`/api/Tickets`, res);
});

// GET /api/Information/nodes
// Return all nodes from the in-memory graph built at server startup.
router.get('/Information/nodes', (req, res) => {
  // Prefer graph from shared graphStore; fall back to req.app.locals.graph
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
    if (node && typeof node.toJSON === 'function') out.push(node.toJSON());
    else out.push({ id });
  }

  return res.json({ nodes: out });
});

module.exports = router;
