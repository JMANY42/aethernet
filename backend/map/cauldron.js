/**
 * Cauldron model
 * Represents a cauldron with location and capacity metadata.
 *
 * Example JSON shape:
 * {
 *   "max_volume": 1000,
 *   "id": "cauldron_001",
 *   "name": "Crimson Brew Cauldron",
 *   "latitude": 33.2148,
 *   "longitude": -97.1331
 * }
 */

class Cauldron {
	/**
	 * @param {object} params
	 * @param {string} params.id
	 * @param {string} params.name
	 * @param {number} params.latitude
	 * @param {number} params.longitude
	 * @param {number} params.max_volume
	 * @param {number} params.cauldron_level
	 */
  constructor({ id, name, latitude, longitude, max_volume, cauldron_level, current_fill }) {
    this.id = id || null;
    this.name = name || null;
    this.latitude = typeof latitude === "string" ? Number(latitude) : latitude;
    this.longitude = typeof longitude === "string" ? Number(longitude) : longitude;
    // store as number under camelCase property for code clarity
    this.maxVolume = typeof max_volume === "undefined" ? 1000 : Number(max_volume);
    // current fill level (optional)
    this.currentFill = typeof current_fill === "undefined" ? 0 : Number(current_fill);
    // current cauldron level (optional)
    this.cauldronLevel = typeof cauldron_level === "undefined" ? null : Number(cauldron_level);		// adjacency lists (store node ids)
		this.fromNodeIds = [];
		this.toNodeIds = [];
	}

	/**
	 * Create a Cauldron from a plain object (e.g. parsed JSON)
	 * @param {object} obj
	 * @returns {Cauldron}
	 */
	static fromJSON(obj = {}) {
		return new Cauldron(obj);
	}

	/**
	 * Convert to the JSON shape expected by external APIs / consumers
	 */
	toJSON() {
		return {
			id: this.id,
			name: this.name,
			latitude: this.latitude,
			longitude: this.longitude,
			max_volume: this.maxVolume,
			current_fill: this.currentFill,
			fillPercent: (this.currentFill / this.maxVolume) * 100,
			cauldron_level: this.cauldronLevel,
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
		if (typeof this.latitude !== "number" || Number.isNaN(this.latitude))
			errors.push("latitude must be a number");
		if (typeof this.longitude !== "number" || Number.isNaN(this.longitude))
			errors.push("longitude must be a number");
		if (typeof this.maxVolume !== "number" || Number.isNaN(this.maxVolume))
			errors.push("max_volume must be a number");
		return { valid: errors.length === 0, errors };
	}

	/**
	 * Getters for adjacency id lists
	 */
	getFromNodeIds() {
		return Array.isArray(this.fromNodeIds) ? this.fromNodeIds.slice() : [];
	}

	getToNodeIds() {
		return Array.isArray(this.toNodeIds) ? this.toNodeIds.slice() : [];
	}

	/**
	 * Adders for adjacency id lists (id deduplicated)
	 */
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

	/**
	 * Get current cauldron level (may be null if unknown)
	 */
	getCauldronLevel() {
		return this.cauldronLevel;
	}

	/**
	 * Set current cauldron level (numeric). Accepts string or number.
	 */
	setCauldronLevel(level) {
		if (typeof level === "string") level = Number(level);
		this.cauldronLevel = typeof level === "undefined" ? null : level;
	}
}

module.exports = Cauldron;

