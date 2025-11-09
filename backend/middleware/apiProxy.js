const axios = require("axios");

const BASE_URL = "https://hackutd2025.eog.systems";

// Create an axios instance with the base URL
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

async function forwardGet(path, res) {
  try {
    const response = await apiClient.get(path);
    // Forward status and data
    return res.status(response.status).json(response.data);
  } catch (err) {
    // If axios error, try to forward meaningful message
    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data || err.response.statusText,
      });
    }
    // network or other error
    return res.status(502).json({ error: err.message || "Bad Gateway" });
  }
}

module.exports = {
  forwardGet,
};
