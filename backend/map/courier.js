/**
 * Courier model
 * Represents a courier (witch) that can traverse the Graph along available paths.
 *
 * JSON shape example:
 * {
 *   "courier_id": "courier_witch_01",
 *   "name": "Witch A",
 *   "max_carrying_capacity": 100
 * }
 */

class Courier {
  constructor({ courier_id, name, max_carrying_capacity, currentNodeId = null } = {}) {
    this.courierId = courier_id || null;
    // expose `id` to integrate with Graph node collections (Graph expects `.id`)
    this.id = this.courierId;
    this.name = name || null;
    this.maxCarryingCapacity = typeof max_carrying_capacity === 'undefined' ? null : Number(max_carrying_capacity);

    // runtime state
    this.currentNodeId = currentNodeId || null;
    this.cargo = 0; // simple numeric cargo placeholder
    this.history = this.currentNodeId ? [this.currentNodeId] : [];
  }

  static fromJSON(obj = {}) {
    return new Courier({
      courier_id: obj.courier_id || obj.courierId,
      name: obj.name,
      max_carrying_capacity: obj.max_carrying_capacity || obj.maxCarryingCapacity,
    });
  }

  toJSON() {
    return {
      courier_id: this.courierId,
      name: this.name,
      max_carrying_capacity: this.maxCarryingCapacity,
      currentNodeId: this.currentNodeId,
      cargo: this.cargo,
    };
  }

  validate() {
    const errors = [];
    if (!this.courierId) errors.push('courier_id is required');
    if (!this.name) errors.push('name is required');
    if (typeof this.maxCarryingCapacity !== 'number' || Number.isNaN(this.maxCarryingCapacity))
      errors.push('max_carrying_capacity must be a number');
    return { valid: errors.length === 0, errors };
  }

  /**
   * Returns true if courier can move from its current node to targetId in one step
   * (i.e. there is a directed edge or reversed edge between nodes).
   * Requires a Graph-like object with getNeighbors/getIncomingNeighbors/getAllNeighbors/getNode.
   */
  canMoveTo(targetId, graph) {
    if (!graph) throw new Error('graph is required');
    if (!this.currentNodeId) return false;

    // outgoing neighbors
    const out = graph.getNeighbors(this.currentNodeId) || [];
    if (out.some(({ node }) => node && node.id === targetId)) return true;

    // incoming neighbors
    const incoming = graph.getIncomingNeighbors(this.currentNodeId) || [];
    if (incoming.some(({ node }) => node && node.id === targetId)) return true;

    return false;
  }

  /**
   * Move the courier to targetId if it's reachable in one step from currentNodeId.
   * If currentNodeId is null, will set to targetId if the node exists in graph.
   * Returns true on success, false otherwise.
   */
  moveTo(targetId, graph) {
    if (!graph) throw new Error('graph is required');

    // If courier has no position, allow placing at any existing node
    if (!this.currentNodeId) {
      const node = graph.getNode(targetId);
      if (!node) return false;
      this.currentNodeId = targetId;
      this.history.push(targetId);
      return true;
    }

    if (this.currentNodeId === targetId) {
      // already there
      return true;
    }

    if (!this.canMoveTo(targetId, graph)) return false;

    this.currentNodeId = targetId;
    this.history.push(targetId);
    return true;
  }

  /**
   * Travel along an array of node ids (path). Verifies each step is valid via moveTo.
   * Returns { success: boolean, failedAtIndex?: number }
   */
  travelPath(path = [], graph) {
    if (!Array.isArray(path) || path.length === 0) return { success: false, reason: 'empty path' };
    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const ok = this.moveTo(nodeId, graph);
      if (!ok) return { success: false, failedAtIndex: i };
    }
    return { success: true };
  }

  /**
   * Compute shortest path using graph.shortestPath (if available) from current position
   * and travel along it. Returns same shape as travelPath or error if no current position.
   */
  async findAndTravelTo(targetId, graph) {
    if (!graph) throw new Error('graph is required');
    if (!this.currentNodeId) return { success: false, reason: 'courier has no current position' };
    if (typeof graph.shortestPath !== 'function') return { success: false, reason: 'graph.shortestPath not available' };

    const result = graph.shortestPath(this.currentNodeId, targetId);
    if (!result || !Array.isArray(result.path)) return { success: false, reason: 'no path found' };

    // result.path includes start and end; skip first element since we're already there
    const pathToFollow = result.path.slice(1);
    return this.travelPath(pathToFollow, graph);
  }
}

module.exports = Courier;
