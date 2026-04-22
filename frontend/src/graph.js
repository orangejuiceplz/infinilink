import * as d3 from 'd3';

let svg, simulation;
let nodes = [];
let links = [];
let nodeGroup, linkGroup, labelGroup, edgeLabelGroup;
let width, height;

export function initGraph(containerId) {
  const container = document.getElementById(containerId);
  svg = d3.select('#graph-svg');

  const rect = container.getBoundingClientRect();
  width = rect.width;
  height = rect.height;

  svg.attr('viewBox', `0 0 ${width} ${height}`);

  svg.selectAll('*').remove();

  const defs = svg.append('defs');

  linkGroup = svg.append('g').attr('class', 'links');
  edgeLabelGroup = svg.append('g').attr('class', 'edge-labels');
  nodeGroup = svg.append('g').attr('class', 'nodes');
  labelGroup = svg.append('g').attr('class', 'labels');

  simulation = d3.forceSimulation()
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(45))
    .force('link', d3.forceLink().id(d => d.id).distance(d => {
      const sim = d.similarity || 40;
      return Math.max(80, 250 - sim * 2);
    }))
    .on('tick', ticked);

  simulation.alpha(0).stop();

  window.addEventListener('resize', () => {
    const r = container.getBoundingClientRect();
    width = r.width;
    height = r.height;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  });
}

export function setInitialNodes(startWord, targetWord) {
  nodes = [
    { id: startWord, type: 'start', x: width * 0.3, y: height / 2 },
    { id: targetWord, type: 'target', x: width * 0.7, y: height / 2 },
  ];
  links = [];
  render();
  simulation.nodes(nodes);
  simulation.force('link').links(links);
  simulation.alpha(0.5).restart();
}

export function addNode(word, newConnections) {
  if (nodes.find(n => n.id === word)) return;

  nodes.push({
    id: word,
    type: 'user',
    x: width / 2 + (Math.random() - 0.5) * 100,
    y: height / 2 + (Math.random() - 0.5) * 100,
  });

  for (const conn of newConnections) {
    links.push({
      source: conn.source,
      target: conn.target,
      similarity: conn.similarity,
    });
  }

  render();
  simulation.nodes(nodes);
  simulation.force('link').links(links);
  simulation.alpha(0.6).restart();
}

export function highlightWinPath(path) {
  const pathEdges = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    pathEdges.add(`${path[i]}-${path[i + 1]}`);
    pathEdges.add(`${path[i + 1]}-${path[i]}`);
  }

  linkGroup.selectAll('.edge-line')
    .classed('win-path', d => {
      const sId = typeof d.source === 'object' ? d.source.id : d.source;
      const tId = typeof d.target === 'object' ? d.target.id : d.target;
      return pathEdges.has(`${sId}-${tId}`);
    });

  const pathNodes = new Set(path);
  nodeGroup.selectAll('.node-circle')
    .filter(d => pathNodes.has(d.id))
    .classed('win-node', true);
}

function render() {
  // Links
  const linkSel = linkGroup.selectAll('.edge-line')
    .data(links, d => {
      const sId = typeof d.source === 'object' ? d.source.id : d.source;
      const tId = typeof d.target === 'object' ? d.target.id : d.target;
      return `${sId}-${tId}`;
    });

  linkSel.exit().remove();

  linkSel.enter()
    .append('line')
    .attr('class', 'edge-line')
    .attr('stroke-opacity', d => Math.min(1, (d.similarity || 40) / 80))
    .style('opacity', 0)
    .transition()
    .duration(400)
    .style('opacity', 1);

  // Edge labels
  const edgeLabelSel = edgeLabelGroup.selectAll('.edge-label')
    .data(links, d => {
      const sId = typeof d.source === 'object' ? d.source.id : d.source;
      const tId = typeof d.target === 'object' ? d.target.id : d.target;
      return `${sId}-${tId}`;
    });

  edgeLabelSel.exit().remove();

  edgeLabelSel.enter()
    .append('text')
    .attr('class', 'edge-label')
    .text(d => `${d.similarity}%`)
    .style('opacity', 0)
    .transition()
    .duration(400)
    .style('opacity', 1);

  // Nodes
  const nodeSel = nodeGroup.selectAll('.node-circle')
    .data(nodes, d => d.id);

  nodeSel.exit().remove();

  nodeSel.enter()
    .append('circle')
    .attr('class', d => `node-circle ${d.type}`)
    .attr('r', d => d.type === 'user' ? 18 : 22)
    .call(drag(simulation))
    .style('opacity', 0)
    .transition()
    .duration(300)
    .style('opacity', 1);

  // Labels
  const labelSel = labelGroup.selectAll('.node-label')
    .data(nodes, d => d.id);

  labelSel.exit().remove();

  labelSel.enter()
    .append('text')
    .attr('class', d => `node-label ${d.type}`)
    .text(d => d.id)
    .style('opacity', 0)
    .transition()
    .duration(300)
    .style('opacity', 1);
}

function ticked() {
  linkGroup.selectAll('.edge-line')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  edgeLabelGroup.selectAll('.edge-label')
    .attr('x', d => (d.source.x + d.target.x) / 2)
    .attr('y', d => (d.source.y + d.target.y) / 2 - 6);

  nodeGroup.selectAll('.node-circle')
    .attr('cx', d => d.x = Math.max(25, Math.min(width - 25, d.x)))
    .attr('cy', d => d.y = Math.max(25, Math.min(height - 25, d.y)));

  labelGroup.selectAll('.node-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y + 32);
}

function drag(sim) {
  return d3.drag()
    .on('start', (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

export function resetGraph() {
  nodes = [];
  links = [];
  if (simulation) simulation.stop();
  if (svg) svg.selectAll('g *').remove();
}
