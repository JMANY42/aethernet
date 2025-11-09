const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiProxyRoutes = require('./routes/apiProxyRoutes');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// Proxy routes for external data service (mirrors endpoints at https://hackutd2025.eog.systems)
app.use('/api', apiProxyRoutes);

// Simple health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

// Start listening first, then build the map in background so buildmap can call
// the local proxy endpoints without connection errors.
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  (async () => {
    try {
      const { buildmap } = require('./map/buildmap');
      console.log('Building map on startup...');
      const graph = await buildmap();
      app.locals.graph = graph;
      // also set shared graph store for routes to import directly
      try {
        const { setGraph } = require('./map/graphStore');
        setGraph(graph);
      } catch (e) {
        console.warn('graphStore not available:', e.message);
      }
      console.log(`Map built: ${graph.nodes.size} nodes, ${graph.adjacency.size} adjacency entries`);
    } catch (err) {
      console.error('Failed to build map on startup:', err);
    }
  })();
});
