const express = require("express");
const router = express.Router();
const { forwardGet } = require("../middleware/apiProxy");

// The routes below mirror the external service and proxy responses.

// GET /api/Data
// Accepts optional query parameters (e.g. start_date, end_date) and forwards them
router.get("/Data", (req, res) => {
  // Rebuild query string from incoming request so we forward parameters like start_date/end_date
  const qs = new URLSearchParams(req.query).toString();
  const path = `/api/Data${qs ? `/?${qs}` : ""}`;
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

// GET /api/Tickets
router.get("/Tickets", (req, res) => {
  return forwardGet(`/api/Tickets`, res);
});

module.exports = router;
