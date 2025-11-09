const axios = require("axios");
const { Graph } = require("./map");
const Cauldron = require("./cauldron");
const Market = require("./market");

// Use 127.0.0.1 to avoid potential IPv6 localhost (::1) resolution issues on some platforms
const BASE_URL = 'http://127.0.0.1:' + (process.env.PORT || '5000');

async function fetchCauldrons(api) {
  const res = await api.get("/api/Information/cauldrons");
  return res.data;
}

async function fetchMarket(api) {
  const res = await api.get("/api/Information/market");
  return res.data;
}

async function fetchNetwork(api) {
  const res = await api.get("/api/Information/network");
  return res.data;
}

/**
 * Build and return a Graph instance populated with nodes and edges fetched
 * from the proxy (or provided baseUrl).
 *
 * @param {string} [baseUrl] optional proxy base URL (defaults to BASE_URL or http://localhost:5000)
 * @returns {Promise<Graph>} Graph instance
 */
async function buildmap(baseUrl) {
  const base = baseUrl || BASE_URL;
  const api = axios.create({ baseURL: base, timeout: 15000 });

  // Fetch remote data in parallel
  const [cauldronsData, marketData, networkData] = await Promise.all([
    fetchCauldrons(api),
    fetchMarket(api),
    fetchNetwork(api),
  ]);

  // Normalize nodes into instances
  const cauldrons = Array.isArray(cauldronsData) ? cauldronsData.map((c) => Cauldron.fromJSON(c)) : [];

  let marketInstance = null;
  if (Array.isArray(marketData)) marketInstance = Market.fromJSON(marketData[0] || {});
  else if (marketData && typeof marketData === "object") marketInstance = Market.fromJSON(marketData);

  // Build graph
  const graph = Graph.fromJSON(networkData || {}, [...cauldrons, marketInstance].filter(Boolean));

  return graph;
}

// Export buildmap function. Do not start building automatically here —
// let the server control when the graph is constructed to avoid double-builds
module.exports = {
  buildmap,
};



// function assert(cond, msg) {
//   if (!cond) {
//     throw new Error(`Assertion failed: ${msg}`);
//   }
// }

// async function run() {
//   console.log("Demo: fetching cauldrons, market and network...");
//   const [cauldronsData, marketData, networkData] = await Promise.all([
//     fetchCauldrons(),
//     fetchMarket(),
//     fetchNetwork(),
//   ]);

//   console.log("Fetched:", {
//     cauldrons: Array.isArray(cauldronsData) ? cauldronsData.length : typeof cauldronsData,
//     market: Array.isArray(marketData) ? marketData.length : typeof marketData,
//     edges: networkData && networkData.edges ? networkData.edges.length : 0,
//   });

//   // Build node instances
//   const cauldrons = Array.isArray(cauldronsData)
//     ? cauldronsData.map((c) => Cauldron.fromJSON(c))
//     : [];

//   // market endpoint might return object or array; normalize
//   let marketInstance = null;
//   if (Array.isArray(marketData)) {
//     marketInstance = Market.fromJSON(marketData[0] || {});
//   } else if (marketData && typeof marketData === "object") {
//     marketInstance = Market.fromJSON(marketData);
//   }

//   assert(marketInstance, "market data must be present");

//   // Build graph
//   const graph = Graph.fromJSON(networkData || {}, [...cauldrons, marketInstance]);

//   console.log(`Graph nodes: ${graph.nodes.size}, adjacency entries: ${graph.adjacency.size}`);

//   // Basic tests
//   console.log("Running tests...");

//   // 1) validate nodes
//   for (const c of cauldrons) {
//     const v = c.validate();
//     assert(v.valid, `Cauldron ${c.id} validation failed: ${v.errors.join(", ")}`);
//   }
//   const mv = marketInstance.validate();
//   assert(mv.valid, `Market validation failed: ${mv.errors.join(", ")}`);

//   console.log("Node validations passed");

//   // 2) neighbors tests
//   if (cauldrons.length > 0) {
//     const first = cauldrons[0].id;
//     const out = graph.getNeighbors(first);
//     console.log(`Outgoing neighbors for ${first}:`, out.map((n) => ({ id: n.node && n.node.id, t: n.travel_time_minutes })));
//     // just ensure no crash and returned array
//     assert(Array.isArray(out), "getNeighbors should return an array");

//     const inc = graph.getIncomingNeighbors(first);
//     console.log(`Incoming neighbors for ${first}:`, inc.map((n) => ({ id: n.node && n.node.id, t: n.travel_time_minutes })));
//     assert(Array.isArray(inc), "getIncomingNeighbors should return an array");

//     const all = graph.getAllNeighbors(first);
//     console.log(`All neighbors for ${first}:`, all.map((n) => ({ id: n.node && n.node.id, t: n.travel_time_minutes, d: n.direction })));
//     assert(Array.isArray(all), "getAllNeighbors should return an array");
//   }

//   // 3) shortest path tests: pick a cauldron and the market
//   const anyCauldron = cauldrons.find((c) => c && c.id) || null;
//   if (anyCauldron && marketInstance) {
//     const sp = graph.shortestPath(anyCauldron.id, marketInstance.id);
//     console.log(`Shortest path from ${anyCauldron.id} to ${marketInstance.id}:`, sp);
//     assert(sp && Array.isArray(sp.path), "shortestPath should return a path");
//   }

//   // 4) distance helpers
//   if (cauldrons.length > 0) {
//     const c = cauldrons[0];
//     const d = c.distanceTo(marketInstance.latitude, marketInstance.longitude);
//     console.log(`Distance (km) from ${c.id} to market:`, d);
//     assert(typeof d === "number" || d === null, "distanceTo should return number or null");
//   }

//   console.log("All demo tests passed.");
// }

// if (require.main === module) {
//   run().catch((err) => {
//     console.error("Demo failed:", err);
//     process.exit(1);
//   });
// }
