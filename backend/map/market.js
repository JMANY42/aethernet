/**
 * Market model
 * Represents a market with location and descriptive metadata.
 *
 * Example JSON shape:
 * {
 *   "description": "Central trading hub for all potion commerce",
 *   "id": "market_001",
 *   "name": "The Enchanted Market",
 *   "latitude": 33.2148,
 *   "longitude": -97.13
 * }
 */

class Market {
  /**
   * @param {object} params
   * @param {string} params.id
   * @param {string} params.name
   * @param {string} params.description
   * @param {number} params.latitude
   * @param {number} params.longitude
   */
  constructor({ id, name, description, latitude, longitude } = {}) {
    this.id = id || null;
    this.name = name || null;
    this.description = description || null;
    this.latitude = typeof latitude === "string" ? Number(latitude) : latitude;
    this.longitude = typeof longitude === "string" ? Number(longitude) : longitude;
    // adjacency id lists
    this.fromNodeIds = [];
    this.toNodeIds = [];
  }

  /**
   * Create a Market from a plain object (e.g. parsed JSON)
   * @param {object} obj
   * @returns {Market}
   */
  static fromJSON(obj = {}) {
    return new Market(obj);
  }

  /**
   * Convert to the JSON shape expected by external APIs / consumers
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      latitude: this.latitude,
      longitude: this.longitude,
      from_node_ids: Array.isArray(this.fromNodeIds) ? this.fromNodeIds.slice() : [],
      to_node_ids: Array.isArray(this.toNodeIds) ? this.toNodeIds.slice() : [],
    };
  }

  /**
   * Simple distance (approx) using Haversine formula in kilometers
   * @param {number} lat
   * @param {number} lon
   * @returns {number} distance in kilometers
   */
  distanceTo(lat, lon) {
    if (this.latitude == null || this.longitude == null) return null;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat - this.latitude);
    const dLon = toRad(lon - this.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(this.latitude)) * Math.cos(toRad(lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Validate required fields exist and are of expected types
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];
    if (!this.id) errors.push("id is required");
    if (!this.name) errors.push("name is required");
    if (!this.description) errors.push("description is required");
    if (typeof this.latitude !== "number" || Number.isNaN(this.latitude))
      errors.push("latitude must be a number");
    if (typeof this.longitude !== "number" || Number.isNaN(this.longitude))
      errors.push("longitude must be a number");
    return { valid: errors.length === 0, errors };
  }

  // Getters
  getFromNodeIds() {
    return Array.isArray(this.fromNodeIds) ? this.fromNodeIds.slice() : [];
  }

  getToNodeIds() {
    return Array.isArray(this.toNodeIds) ? this.toNodeIds.slice() : [];
  }

  // Adders (deduplicate)
  addFromNodeId(nodeId) {
    if (!nodeId) return;
    if (!this.fromNodeIds) this.fromNodeIds = [];
    if (!this.fromNodeIds.includes(nodeId)) this.fromNodeIds.push(nodeId);
  }

  addToNodeId(nodeId) {
    if (!nodeId) return;
    if (!this.toNodeIds) this.toNodeIds = [];
    if (!this.toNodeIds.includes(nodeId)) this.toNodeIds.push(nodeId);
  }
}

module.exports = Market;
