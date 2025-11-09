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
      // Periodically refresh cauldron levels by calling the local proxy /api/Data/current
      try {
        const axios = require('axios');

        const updateCauldronLevels = async () => {
          try {
            const url = `http://127.0.0.1:${PORT}/api/Data/current`;
            const resp = await axios.get(url, { timeout: 10000 });
            const body = resp && resp.data ? resp.data : null;
            if (!body) {
              console.warn('No body in /api/Data/current response');
              return;
            }

            // Expected format: an array where first element contains cauldron_levels map
            // or an object with cauldron_levels directly. Be permissive.
            let levelsMap = null;
            if (Array.isArray(body) && body.length > 0 && body[0].cauldron_levels) {
              levelsMap = body[0].cauldron_levels;
            } else if (body.cauldron_levels) {
              levelsMap = body.cauldron_levels;
            } else if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'object') {
              // try to find cauldron_levels in any element
              for (const el of body) {
                if (el && el.cauldron_levels) {
                  levelsMap = el.cauldron_levels;
                  break;
                }
              }
            }

            if (!levelsMap) {
              console.warn('Could not find cauldron_levels in /api/Data/current response');
              return;
            }

            // Update nodes in the in-memory graph
            let updated = 0;
            for (const [nodeId, value] of Object.entries(levelsMap)) {
              const node = graph.getNode(nodeId);
              if (!node) continue;
              const numeric = typeof value === 'string' ? Number(value) : value;
              if (typeof node.setCauldronLevel === 'function') {
                node.setCauldronLevel(numeric);
                updated++;
              } else {
                // fallback: set property directly
                node.cauldronLevel = numeric;
                updated++;
              }
            }

            // publish updated graph to shared store / locals (so routes read fresh values)
            try {
              const { setGraph } = require('./map/graphStore');
              setGraph(graph);
            } catch (e) {
              // ignore
            }
            app.locals.graph = graph;
            console.log(`Cauldron levels updated: ${updated} nodes at ${new Date().toISOString()}`);
          } catch (err) {
            console.warn('Failed to update cauldron levels:', err && err.message ? err.message : err);
          }
        };

        // Initial update and then align future updates to the top of each minute
        updateCauldronLevels();

        // Compute milliseconds until the next minute tick (when seconds === 0)
        const now = new Date();
        let msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
        if (msUntilNextMinute <= 0) msUntilNextMinute = 0;

        // Schedule first aligned update at the next minute boundary, then run every minute on the dot
        setTimeout(() => {
          try {
            updateCauldronLevels();
          } catch (e) {
            console.warn('Aligned update failed:', e && e.message ? e.message : e);
          }
          setInterval(updateCauldronLevels, 60 * 1000);
        }, msUntilNextMinute);
      } catch (e) {
        console.warn('Could not start cauldron level updater:', e && e.message ? e.message : e);
      }
    } catch (err) {
      console.error('Failed to build map on startup:', err);
    }
  })();
});
