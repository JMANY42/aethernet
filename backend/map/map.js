const Cauldron = require("./cauldron");
const Market = require("./market");

/**
 * Directed graph where nodes represent Markets or Cauldrons and edges
 * carry a travel_time_minutes weight.
 */
class Graph {
  constructor() {
    // nodes: id -> node instance (Market/Cauldron or placeholder)
    this.nodes = new Map();
    // adjacency: id -> array of { to: id, travel_time_minutes }
    this.adjacency = new Map();
  }

  addNode(node) {
    if (!node || !node.id) throw new Error("node must have an id");
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) this.adjacency.set(node.id, []);
  }

  addEdge(fromId, toId, travel_time_minutes) {
    if (!this.adjacency.has(fromId)) this.adjacency.set(fromId, []);
    this.adjacency.get(fromId).push({ to: toId, travel_time_minutes: Number(travel_time_minutes) });
    // Ensure 'to' node has adjacency list (even if empty) so iteration is easier
    if (!this.adjacency.has(toId)) this.adjacency.set(toId, []);

    // Update node adjacency id lists if node instances provide the helper methods.
    // Source node: add the `toId` to its toNodeIds
    const fromNode = this.getNode(fromId);
    if (fromNode && typeof fromNode.addToNodeId === "function") {
      try {
        fromNode.addToNodeId(toId);
      } catch (e) {
        // ignore errors from node mutation to keep graph build resilient
      }
    }

    // Target node: add the `fromId` to its fromNodeIds
    const toNode = this.getNode(toId);
    if (toNode && typeof toNode.addFromNodeId === "function") {
      try {
        toNode.addFromNodeId(fromId);
      } catch (e) {
        // ignore errors from node mutation
      }
    }
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  /**
   * Get outgoing neighbors for a node id — nodes that `id` points to.
   *
   * Returns an array of objects: { node, travel_time_minutes }
   * - node: the resolved node instance (Market or Cauldron) or null if the
   *   target node exists only as a placeholder.
   * - travel_time_minutes: numeric weight of the directed edge.
   *
   * Complexity: O(outdegree(id))
   */
  getNeighbors(id) {
    const list = this.adjacency.get(id) || [];
    return list.map(({ to, travel_time_minutes }) => ({ node: this.getNode(to), travel_time_minutes }));
  }

  /**
   * Get incoming neighbors: nodes that have edges pointing to `id`.
   * This scans all adjacency lists and is O(E). For frequent use consider
   * maintaining a reverse-adjacency map when building the graph.
   *
   * Returns array of { node, travel_time_minutes }
   */
  getIncomingNeighbors(id) {
    const incoming = [];
    for (const [fromId, edges] of this.adjacency.entries()) {
      for (const { to, travel_time_minutes } of edges) {
        if (to === id) {
          incoming.push({ node: this.getNode(fromId), travel_time_minutes });
        }
      }
    }
    return incoming;
  }

  /**
   * Get all neighbors (both outgoing and incoming) de-duplicated by node id.
   * If a node is both outgoing and incoming, its `direction` will be 'both'.
   * Preference: when a node is both directions, the outgoing travel_time_minutes
   * (from `id` -> neighbor) is retained.
   *
   * Returns array of { node, travel_time_minutes, direction }
   */
  getAllNeighbors(id) {
    const map = new Map();

    // Outgoing
    const outList = this.adjacency.get(id) || [];
    for (const { to, travel_time_minutes } of outList) {
      map.set(to, { node: this.getNode(to), travel_time_minutes, direction: "outgoing" });
    }

    // Incoming
    for (const [fromId, edges] of this.adjacency.entries()) {
      for (const { to, travel_time_minutes } of edges) {
        if (to === id) {
          if (map.has(fromId)) {
            // mark as both; keep existing outgoing travel_time
            const existing = map.get(fromId);
            existing.direction = "both";
            map.set(fromId, existing);
          } else {
            map.set(fromId, { node: this.getNode(fromId), travel_time_minutes, direction: "incoming" });
          }
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Build nodes from an array of Market/Cauldron-like plain objects or instances.
   * If objects are plain, it will convert them using Market.fromJSON or Cauldron.fromJSON
   * based on a simple id prefix heuristic (market_ / cauldron_). If a referenced node
   * in edges is missing from the provided nodesArray, a lightweight placeholder is created.
   *
   * @param {object} jsonEdges - the JSON containing `edges` array and optional description
   * @param {Array<object|Market|Cauldron>} nodesArray - array of node instances or plain objects
   */
  static fromJSON(jsonEdges, nodesArray = []) {
    const g = new Graph();

    // Build lookup from provided nodesArray
    const lookup = new Map();
    for (const n of nodesArray) {
      if (!n) continue;
      // If plain object (no toJSON function and an id), convert by heuristic
      if (!n.id) continue;
      let instance = n;
      if (!(n instanceof Market) && !(n instanceof Cauldron)) {
        // Decide by id prefix
        if (String(n.id).startsWith("market_")) instance = Market.fromJSON(n);
        else if (String(n.id).startsWith("cauldron_")) instance = Cauldron.fromJSON(n);
        else instance = n; // keep as-is
      }
      lookup.set(instance.id, instance);
      g.addNode(instance);
    }

    // Add edges
    const edges = (jsonEdges && jsonEdges.edges) || [];
    for (const e of edges) {
      const from = e.from;
      const to = e.to;
      const t = e.travel_time_minutes;

      // Ensure nodes exist (create placeholders if necessary)
      if (!g.getNode(from)) {
        const placeholder = { id: from, name: null, latitude: null, longitude: null };
        if (String(from).startsWith("market_")) g.addNode(Market.fromJSON(placeholder));
        else if (String(from).startsWith("cauldron_")) g.addNode(Cauldron.fromJSON(placeholder));
        else g.addNode(placeholder);
      }
      if (!g.getNode(to)) {
        const placeholder = { id: to, name: null, latitude: null, longitude: null };
        if (String(to).startsWith("market_")) g.addNode(Market.fromJSON(placeholder));
        else if (String(to).startsWith("cauldron_")) g.addNode(Cauldron.fromJSON(placeholder));
        else g.addNode(placeholder);
      }

      g.addEdge(from, to, t);
    }

    return g;
  }

  /**
   * Simple Dijkstra shortest-path by travel_time_minutes (returns path of node ids and total cost)
   * Returns null if no path.
   */
  shortestPath(startId, endId) {
    // allow shortest path traversal in both directions: follow outgoing edges and incoming edges
    if (!this.adjacency.has(startId) || !this.adjacency.has(endId)) return null;

    const dist = new Map();
    const prev = new Map();
    const Q = new Set();

    for (const id of this.adjacency.keys()) {
      dist.set(id, Infinity);
      Q.add(id);
    }
    dist.set(startId, 0);

    while (Q.size > 0) {
      // extract min
      let u = null;
      let best = Infinity;
      for (const id of Q) {
        const d = dist.get(id);
        if (d < best) {
          best = d;
          u = id;
        }
      }
      if (u === null) break;
      Q.delete(u);

      if (u === endId) break;

      // Build neighbor list including outgoing edges (u -> v) and incoming edges (w -> u)
      const neighbors = [];

      // outgoing
      const outList = this.adjacency.get(u) || [];
      for (const { to, travel_time_minutes } of outList) {
        neighbors.push({ to, travel_time_minutes: Number(travel_time_minutes) });
      }

      // incoming: edges where some node -> u, we can traverse from u to that node as well
      for (const [fromId, edges] of this.adjacency.entries()) {
        for (const { to, travel_time_minutes } of edges) {
          if (to === u) {
            // allow reverse traversal from u to fromId with same weight
            neighbors.push({ to: fromId, travel_time_minutes: Number(travel_time_minutes) });
          }
        }
      }

      for (const { to, travel_time_minutes } of neighbors) {
        const alt = dist.get(u) + Number(travel_time_minutes);
        if (alt < dist.get(to)) {
          dist.set(to, alt);
          prev.set(to, u);
        }
      }
    }

    if (!prev.has(endId) && startId !== endId) return null;

    const path = [];
    let u = endId;
    while (u) {
      path.unshift(u);
      if (u === startId) break;
      u = prev.get(u);
    }
    return { path, cost: dist.get(endId) };
  }
}

module.exports = { Graph };
