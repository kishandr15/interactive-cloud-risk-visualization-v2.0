import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { ReactFlowInstance } from "react-flow-renderer";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
} from "react-flow-renderer";
import { graphData } from "../data/graphData";
import { Cloud, Server, Database, Layers, AlertTriangle, ChevronDown, SlidersVertical } from "lucide-react";
import * as dagre from "dagre";

const typeIcons = {
  cloud: <Cloud className="w-6 h-6 text-blue-500" />,
  aws: <Server className="w-6 h-6 text-yellow-500" />,
  gcp: <Layers className="w-6 h-6 text-green-500" />,
  saas: <Layers className="w-6 h-6 text-indigo-500" />,
  service: <Database className="w-6 h-6 text-orange-500" />,
};

const Chevron = ({ collapsed }) => (
  <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${collapsed ? "rotate-180" : ""}`} />
);

const Badge = ({ icon, count, color }) => (
  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold shadow bg-white ${color}`}
        style={{ minWidth: 22, minHeight: 16, border: 'none' }}>
    {icon}
    {count}
  </span>
);

const getSeverityColor = (alerts) => {
  if (alerts > 100) return "bg-red-500";
  if (alerts > 50) return "bg-orange-400";
  if (alerts > 0) return "bg-yellow-300";
  return "bg-green-300";
};

const CustomNode = ({ data, nodeSize, filter }) => {
  const isCollapsible = !!data.children;
  return (
    <div
      className={`flex flex-col items-center group ${isCollapsible ? "cursor-pointer" : ""}`}
      style={{ width: nodeSize?.width || 90, height: nodeSize?.height || 90, justifyContent: 'center' }}
      onClick={isCollapsible ? data.onToggle : undefined}
      tabIndex={isCollapsible ? 0 : undefined}
      role={isCollapsible ? "button" : undefined}
      aria-pressed={isCollapsible ? data.collapsed : undefined}
    >
      {/* Badges above node */}
      <div className="flex gap-1 mb-1 z-10">
        {(filter === 'All' || filter === 'Alerts') && (
          <Badge icon={<AlertTriangle className="w-4 h-4 text-red-600" />} count={data.alerts} color="border-red-200" />
        )}
        {(filter === 'All' || filter === 'Misconfigurations') && (
          <Badge icon={<SlidersVertical className="w-4 h-4 text-blue-700" />} count={data.misconfigs} color="border-blue-200" />
        )}
      </div>
      {/* Small round icon centered in larger node container */}
      <div className={`flex items-center justify-center w-full transition-all duration-500 ${data.collapsed ? 'opacity-60 scale-95' : 'opacity-100 scale-100'}`} style={{ minHeight: 36 }}>
        <div
          className={`relative flex items-center justify-center rounded-full shadow-lg border-2 border-white transition-all duration-500 ${getSeverityColor(
            data.alerts
          )} ${data.collapsed ? "opacity-60 scale-95" : "opacity-100 scale-100"}`}
          style={{ width: 36, height: 36 }}
        >
          <span className="flex items-center justify-center w-full h-full">
            {typeIcons[data.type] || <Server className="w-4 h-4" />}
          </span>
          {/* Handles for edge connections */}
          <Handle type="target" position={Position.Left} />
          <Handle type="source" position={Position.Right} />
        </div>
      </div>
      {/* Label below node */}
      <span className="mt-1 text-xs font-semibold text-gray-700 text-center w-full" style={{ minHeight: 18, whiteSpace: 'normal' }}>{data.label}</span>
    </div>
  );
};

const RootNode = ({ data, nodeSize, filter }) => (
  <div
    className="flex flex-col items-center cursor-pointer"
    style={{ width: nodeSize?.width || 90, height: nodeSize?.height || 90, justifyContent: 'center' }}
    onClick={data.onToggle}
    tabIndex={0}
    role="button"
    aria-pressed={data.collapsed}
  >
    {/* Badges above node */}
    <div className="flex gap-1 mb-1 z-10">
      {(filter === 'All' || filter === 'Alerts') && (
        <Badge icon={<AlertTriangle className="w-4 h-4 text-red-600" />} count={data.alerts} color="border-red-200" />
      )}
      {(filter === 'All' || filter === 'Misconfigurations') && (
        <Badge icon={<SlidersVertical className="w-4 h-4 text-blue-700" />} count={data.misconfigs} color="border-blue-200" />
      )}
    </div>
    {/* Small round icon centered in larger node container */}
    <div className={`flex items-center justify-center w-full transition-all duration-500 ${data.collapsed ? 'opacity-60 scale-95' : 'opacity-100 scale-100'}`} style={{ minHeight: 44 }}>
      <div
        className={`relative rounded-full bg-white shadow-2xl border-4 border-red-200 flex items-center justify-center transition-all duration-500 ${data.collapsed ? "opacity-60 scale-95" : "opacity-100 scale-100"}`}
        style={{ width: 44, height: 44 }}
      >
        <span className="flex items-center justify-center w-full h-full">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </span>
        {/* Handles for edge connections */}
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
    {/* Label below node */}
    <span className="mt-1 text-xs font-bold text-gray-700 text-center w-full" style={{ minHeight: 18, whiteSpace: 'normal' }}>Total</span>
  </div>
);

const nodeTypes = { custom: CustomNode, root: RootNode };

const FILTERS = ["All", "Alerts", "Misconfigurations"];

const MIN_NODE_WIDTH = 90;
const MAX_NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 60;
const MAX_NODE_HEIGHT = 90;

// Add a mapping from node type to color for edge coloring
const nodeTypeColors = {
  cloud: '#3b82f6', // blue-500
  aws: '#facc15',   // yellow-400
  gcp: '#22c55e',   // green-500
  saas: '#6366f1',  // indigo-500
  service: '#fb923c', // orange-400
  root: '#ef4444',  // red-500 (if needed)
};

// Helper to get all descendant ids of a node recursively
function getDescendantIds(nodeId: string, nodesMap: { [key: string]: any }) {
  const node = nodesMap[nodeId];
  if (!node || !node.children) return [];
  let ids: string[] = [];
  for (const childId of node.children) {
    ids.push(childId);
    ids = ids.concat(getDescendantIds(childId, nodesMap));
  }
  return ids;
}

function getVisibleNodeIds(collapsedMap: { [key: string]: boolean }, nodes: any[]) {
  // Build a map for quick lookup
  const nodesMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  let visible = new Set(["root"]); // Start from 'root' now
  function traverse(id: string) {
    if (collapsedMap[id]) return;
    const node = nodesMap[id];
    if (node && node.children) {
      for (const childId of node.children) {
        visible.add(childId);
        traverse(childId);
      }
    }
  }
  traverse("root"); // Start traversal from 'root'
  return visible;
}

function buildGraphNodes({ nodes, collapsedMap, filter, onToggle, visibleNodeIds, rootTotals }) {
  // Inject the root node with both 'cloud' and 'saas' as children
  const allNodes = [
    {
      id: "root",
      label: "",
      type: "root",
      alerts: rootTotals.alerts,
      misconfigs: rootTotals.misconfigs,
      children: ["cloud", "saas"],
    },
    ...nodes,
  ];
  return allNodes
    .filter((node) => visibleNodeIds.has(node.id))
    .filter((node) => {
      if (filter === "Alerts") return node.alerts > 0;
      if (filter === "Misconfigurations") return node.misconfigs > 0;
      return true;
    })
    .map((node) => ({
      id: node.id,
      type: node.type === "root" ? "root" : "custom",
      data: {
        ...node,
        collapsed: collapsedMap[node.id],
        onToggle: () => onToggle(node.id),
      },
      draggable: false,
    }));
}

function buildGraphEdges({ edges, visibleNodeIds }) {
  // Build a map of nodeId to node for color lookup
  const nodeMap = Object.fromEntries([
    { id: 'root', type: 'root' },
    ...graphData.nodes,
  ].map(n => [n.id, n]));
  // Always add the root->cloud and root->saas edges
  const allEdges = [
    { source: "root", target: "cloud" },
    { source: "root", target: "saas" },
    ...edges,
  ];
  // Only include edges where both source and target are visible
  return allEdges
    .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
    .map((edge) => {
      const targetNode = nodeMap[edge.target];
      const color = nodeTypeColors[targetNode?.type] || '#2563eb';
      return {
        ...edge,
        type: 'bezier', // Use curvy bezier lines
        style: { stroke: color, strokeWidth: 1 },
      };
    });
}

// Dagre layout helper
function getLayoutedElements(nodes, edges, nodeWidth, nodeHeight, direction = "LR") { // Change default direction to 'LR' for horizontal layout
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  dagre.layout(dagreGraph);
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: "right",
      targetPosition: "left",
      style: {
        width: nodeWidth,
        height: nodeHeight,
      },
    };
  });
}

const Graph = () => {
  const [collapsedMap, setCollapsedMap] = useState({});
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<any>(null);
  const reactFlowInstance = useRef<ReactFlowInstance<any, any> | null>(null);
  // Track previous visible node count
  const prevVisibleNodeCount = useRef(0);

  // Auto-hide tooltip after 5 seconds
  useEffect(() => {
    if (selected) {
      const timer = setTimeout(() => setSelected(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [selected]);

  // Compute total alerts/misconfigs for the root node
  const rootTotals = useMemo(() => {
    let alerts = 0;
    let misconfigs = 0;
    for (const node of graphData.nodes) {
      alerts += node.alerts;
      misconfigs += node.misconfigs;
    }
    return { alerts, misconfigs };
  }, []);

  // Compute visible node ids based on collapsed state
  const visibleNodeIds = useMemo(
    () => getVisibleNodeIds(collapsedMap, [
      {
        id: "root",
        children: ["cloud", "saas"],
      },
      ...graphData.nodes,
    ]),
    [collapsedMap]
  );

  const nodesRaw = useMemo(
    () =>
      buildGraphNodes({
        nodes: graphData.nodes,
        collapsedMap,
        filter,
        onToggle: (id) => setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] })),
        visibleNodeIds,
        rootTotals,
      }),
    [collapsedMap, filter, visibleNodeIds, rootTotals]
  );

  const edges = useMemo(
    () =>
      buildGraphEdges({
        edges: graphData.edges,
        visibleNodeIds,
      }),
    [collapsedMap, visibleNodeIds]
  );

  // Compute dynamic node size based on visible nodes
  const nodeSize = useMemo(() => {
    const count = visibleNodeIds.size;
    // Fewer nodes = bigger nodes
    const width = Math.max(
      MIN_NODE_WIDTH,
      Math.min(MAX_NODE_WIDTH, 600 / Math.max(1, Math.sqrt(count)))
    );
    const height = Math.max(
      MIN_NODE_HEIGHT,
      Math.min(MAX_NODE_HEIGHT, 200 / Math.max(1, Math.sqrt(count)))
    );
    return { width, height };
  }, [visibleNodeIds]);

  // Layout nodes using dagre with dynamic size
  const nodes = useMemo(() => getLayoutedElements(nodesRaw, edges, nodeSize.width, nodeSize.height), [nodesRaw, edges, nodeSize]);

  // Imperatively call fitView when nodes or edges change
  useEffect(() => {
    const prevCount = prevVisibleNodeCount.current;
    const currCount = visibleNodeIds.size;
    // If expanding (more nodes visible), call fitView after a short delay
    if (currCount > prevCount) {
      setTimeout(() => {
        if (reactFlowInstance.current && typeof reactFlowInstance.current.fitView === 'function') {
          reactFlowInstance.current.fitView();
        }
      }, 50); // 50ms delay to allow DOM/layout update
    } else if (currCount < prevCount) {
      // On collapse, call fitView immediately
      if (reactFlowInstance.current && typeof reactFlowInstance.current.fitView === 'function') {
        reactFlowInstance.current.fitView();
      }
    }
    prevVisibleNodeCount.current = currCount;
  }, [nodes, edges, visibleNodeIds.size]);

  // Pass filter prop to nodeTypes
  const nodeTypes = useMemo(() => {
    return {
      custom: (props) => <CustomNode {...props} nodeSize={nodeSize} filter={filter} />,
      root: (props) => <RootNode {...props} nodeSize={nodeSize} filter={filter} />,
    };
  }, [nodeSize, filter]);

  return (
    <div className="w-full max-w-full h-[75vh] min-h-[300px] max-h-[90vh] bg-white rounded-xl shadow p-4 relative overflow-auto">
      <style>{`.react-flow__attribution { display: none !important; }`}</style>
      {/* Filter Bar */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`px-3 py-1 rounded border flex items-center gap-1 ${filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setFilter(f)}
          >
            {f === 'Alerts' && <AlertTriangle className="w-4 h-4 text-red-600" />}
            {f === 'Misconfigurations' && <SlidersVertical className="w-4 h-4 text-blue-700" />}
            {f}
          </button>
        ))}
      </div>
      <div className="w-full h-full min-h-[300px]" style={{ position: 'relative' }}>
        <ReactFlow
          onInit={instance => { reactFlowInstance.current = instance; }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, node) => setSelected(node)}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          minZoom={0.5}
          maxZoom={2}
          style={{ width: '100%', height: '100%' }}
        >
          <Background />
          {/* <MiniMap /> removed */}
          <Controls style={{ bottom: 48 }} />
        </ReactFlow>
      </div>
      {/* Tooltip/Side Panel */}
      {selected && (
        <div className="absolute top-20 sm:top-4 right-4 bg-white border rounded-lg shadow-lg p-3 z-20 min-w-[160px] max-w-[220px] text-sm">
          <div className="flex items-center gap-2 mb-2">
            {typeIcons[selected.data.type]}
            <span className="font-bold text-base">{selected.data.label || 'Total'}</span>
          </div>
          <div className="mb-1">Alerts: <span className="font-semibold text-red-600">{selected.data.alerts}</span></div>
          <div className="mb-1">Misconfigurations: <span className="font-semibold text-gray-700">{selected.data.misconfigs}</span></div>
        </div>
      )}
    </div>
  );
};

export default Graph;