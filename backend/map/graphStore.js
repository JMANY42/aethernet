// Simple in-memory graph holder. Server sets the graph on startup and routes can read it.
let _graph = null;

function setGraph(g) {
  _graph = g;
}

function getGraph() {
  return _graph;
}

module.exports = { setGraph, getGraph };
