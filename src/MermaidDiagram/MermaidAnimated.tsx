import { useEffect, useState } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import mermaid from "mermaid";

export const mermaidAnimatedSchema = z.object({
  diagram: z.string(),
  backgroundColor: z.string().optional(),
  framesPerElement: z.number().optional(),
});

type MermaidAnimatedProps = z.infer<typeof mermaidAnimatedSchema>;

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

// 図のタイプを検出
function detectDiagramType(diagram: string): "flowchart" | "sequence" | "pie" | "state" | "mindmap" | "unknown" {
  const trimmed = diagram.trim().toLowerCase();
  if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) return "flowchart";
  if (trimmed.startsWith("sequencediagram")) return "sequence";
  if (trimmed.startsWith("pie")) return "pie";
  if (trimmed.startsWith("statediagram")) return "state";
  if (trimmed.startsWith("mindmap")) return "mindmap";
  return "unknown";
}

// ========== データ型 ==========

interface NodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "diamond" | "circle" | "rounded";
}

interface EdgeData {
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
}

interface PieSegment {
  label: string;
  value: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

interface SequenceActor {
  name: string;
  x: number;
}

interface SequenceMessage {
  from: number;
  to: number;
  text: string;
  y: number;
  type: "solid" | "dashed";
}

interface StateNode {
  id: string;
  label: string;
  x: number;
  y: number;
  isStart?: boolean;
  isEnd?: boolean;
}

interface StateTransition {
  from: string;
  to: string;
  label?: string;
}

interface MindmapNode {
  id: string;
  label: string;
  level: number;
  x: number;
  y: number;
  parentId?: string;
  isRoot?: boolean;
}

// ========== メインコンポーネント ==========

export const MermaidAnimated: React.FC<MermaidAnimatedProps> = ({
  diagram,
  backgroundColor = "#1a1a2e",
  framesPerElement = 20,
}) => {
  const frame = useCurrentFrame();
  const diagramType = detectDiagramType(diagram);

  // Flowchart用
  const [flowData, setFlowData] = useState<{ nodes: NodeData[]; edges: EdgeData[]; viewBox: { width: number; height: number } } | null>(null);

  // Pie用
  const [pieData, setPieData] = useState<{ segments: PieSegment[]; title: string } | null>(null);

  // Sequence用
  const [seqData, setSeqData] = useState<{ actors: SequenceActor[]; messages: SequenceMessage[]; height: number } | null>(null);

  // State用
  const [stateData, setStateData] = useState<{ nodes: StateNode[]; transitions: StateTransition[] } | null>(null);

  // Mindmap用
  const [mindmapData, setMindmapData] = useState<{ nodes: MindmapNode[]; connections: { from: string; to: string }[] } | null>(null);

  // SVG生成してパース
  useEffect(() => {
    const parseDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram);
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        if (!svgEl) return;

        if (diagramType === "flowchart") {
          parseFlowchart(doc, svgEl);
        } else if (diagramType === "pie") {
          parsePieChart();
        } else if (diagramType === "sequence") {
          parseSequence();
        } else if (diagramType === "state") {
          parseStateDiagram();
        } else if (diagramType === "mindmap") {
          parseMindmap();
        }
      } catch (error) {
        console.error("Parse error:", error);
      }
    };

    const parseFlowchart = (doc: Document, svgEl: SVGSVGElement) => {
      const viewBox = svgEl.getAttribute("viewBox")?.split(" ").map(Number) || [0, 0, 800, 600];

      // Step 1: SVGからノード情報を取得（座標・サイズ・形状）
      const nodeMap = new Map<string, NodeData>();
      doc.querySelectorAll(".node").forEach((node) => {
        const nodeId = node.getAttribute("id") || "";
        const transform = node.getAttribute("transform") || "";
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (!match) return;

        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const labelEl = node.querySelector(".nodeLabel");
        const label = labelEl?.textContent || "";

        const rect = node.querySelector("rect");
        const polygon = node.querySelector("polygon");
        let width = 100, height = 40;
        let shape: "rect" | "diamond" | "circle" | "rounded" = "rect";

        if (rect) {
          width = parseFloat(rect.getAttribute("width") || "100");
          height = parseFloat(rect.getAttribute("height") || "40");
          shape = rect.getAttribute("rx") ? "rounded" : "rect";
        } else if (polygon) {
          const points = polygon.getAttribute("points") || "";
          const coords = points.split(" ").filter(p => p).map(p => p.split(",").map(Number));
          if (coords.length >= 4) {
            const xs = coords.map(c => c[0]);
            const ys = coords.map(c => c[1]);
            width = Math.max(...xs) - Math.min(...xs);
            height = Math.max(...ys) - Math.min(...ys);
          }
          shape = "diamond";
        }

        // ノードIDからプレフィックスを除去（flowchart-A-123 → A）
        const cleanId = nodeId.replace(/^flowchart-/, "").replace(/-\d+$/, "");
        nodeMap.set(cleanId, { id: cleanId, label, x, y, width, height, shape });
      });

      // Step 2: Mermaid定義から直接エッジ情報をパース
      const edges: EdgeData[] = [];
      const lines = diagram.split("\n");

      lines.forEach(line => {
        // パターン: A[Label] -->|label| B[Label], A --> B, A --> B --> C など
        // チェーンパターンにも対応（1行に複数のエッジがある場合）

        // ノードとエッジを順番に抽出
        const parts = line.split(/(-->|---|-\.-|==>)(?:\|[^|]*\|)?/);

        // 各エッジを処理
        const lineEdges: { from: string; to: string; label?: string }[] = [];
        let currentFrom: string | null = null;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]?.trim();
          if (!part) continue;

          // エッジ記号かどうかをチェック
          if (/^(-->|---|-\.-|==>)$/.test(part)) {
            continue;
          }

          // ノードIDを抽出
          const nodeMatch = part.match(/^(\w+)/);
          if (nodeMatch) {
            const nodeId = nodeMatch[1];
            if (currentFrom !== null) {
              // エッジラベルを探す
              const labelMatch = line.match(new RegExp(`${currentFrom}[^>]*-->\\|([^|]*)\\|[^${nodeId}]*${nodeId}`));
              const edgeLabel = labelMatch?.[1]?.trim();
              lineEdges.push({ from: currentFrom, to: nodeId, label: edgeLabel });
            }
            currentFrom = nodeId;
          }
        }

        // エッジを追加
        lineEdges.forEach(({ from: fromId, to: toId, label: edgeLabel }) => {
          const fromNode = nodeMap.get(fromId);
          const toNode = nodeMap.get(toId);

          if (fromNode && toNode) {
            const points = calculateEdgePoints(fromNode, toNode);
            edges.push({
              from: fromId,
              to: toId,
              label: edgeLabel,
              points,
            });
          }
        });
      });

      // Step 3: トポロジカルソートでアニメーション順序を決定
      const nodes = topologicalSort(nodeMap, edges);

      // Step 4: エッジの順序を決定（ソース→ターゲットの順）
      const sortedEdges = sortEdgesByNodeOrder(edges, nodes);

      console.log("Flowchart nodes:", nodes);
      console.log("Flowchart edges:", sortedEdges);

      setFlowData({ nodes, edges: sortedEdges, viewBox: { width: viewBox[2], height: viewBox[3] } });
    };

    // エッジのポイントを計算
    const calculateEdgePoints = (from: NodeData, to: NodeData): { x: number; y: number }[] => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      // 縦方向が主な場合
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          // 下向き
          return [
            { x: from.x, y: from.y + from.height / 2 },
            { x: to.x, y: to.y - to.height / 2 },
          ];
        } else {
          // 上向き（ループバック）
          return [
            { x: from.x + from.width / 2, y: from.y },
            { x: from.x + from.width / 2 + 50, y: from.y - 30 },
            { x: to.x + to.width / 2 + 50, y: to.y + to.height / 2 + 30 },
            { x: to.x + to.width / 2, y: to.y + to.height / 2 },
          ];
        }
      } else {
        // 横方向が主な場合
        if (dx > 0) {
          return [
            { x: from.x + from.width / 2, y: from.y },
            { x: to.x - to.width / 2, y: to.y },
          ];
        } else {
          return [
            { x: from.x - from.width / 2, y: from.y },
            { x: to.x + to.width / 2, y: to.y },
          ];
        }
      }
    };

    // トポロジカルソート（Kahn's algorithm）
    const topologicalSort = (nodeMap: Map<string, NodeData>, edges: EdgeData[]): NodeData[] => {
      const inDegree = new Map<string, number>();
      const adjacency = new Map<string, string[]>();

      // 初期化
      nodeMap.forEach((_, id) => {
        inDegree.set(id, 0);
        adjacency.set(id, []);
      });

      // 入次数と隣接リストを構築
      edges.forEach(edge => {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
        adjacency.get(edge.from)?.push(edge.to);
      });

      // 入次数0のノードをキューに追加（y座標でソート）
      const queue: string[] = [];
      inDegree.forEach((degree, id) => {
        if (degree === 0) queue.push(id);
      });
      queue.sort((a, b) => (nodeMap.get(a)?.y || 0) - (nodeMap.get(b)?.y || 0));

      const result: NodeData[] = [];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const node = nodeMap.get(current);
        if (node) result.push(node);

        // 隣接ノードの入次数を減らす
        const neighbors = adjacency.get(current) || [];
        const nextNodes: string[] = [];
        neighbors.forEach(neighbor => {
          const newDegree = (inDegree.get(neighbor) || 1) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0 && !visited.has(neighbor)) {
            nextNodes.push(neighbor);
          }
        });
        // y座標でソートして追加
        nextNodes.sort((a, b) => (nodeMap.get(a)?.y || 0) - (nodeMap.get(b)?.y || 0));
        queue.push(...nextNodes);
      }

      // 循環参照で残ったノードを追加（y座標順）
      nodeMap.forEach((node, id) => {
        if (!visited.has(id)) {
          result.push(node);
        }
      });

      return result;
    };

    // エッジをノード順序に基づいてソート
    const sortEdgesByNodeOrder = (edges: EdgeData[], nodes: NodeData[]): EdgeData[] => {
      const nodeIndex = new Map<string, number>();
      nodes.forEach((node, i) => nodeIndex.set(node.id, i));

      return [...edges].sort((a, b) => {
        const aFromIdx = nodeIndex.get(a.from) || 0;
        const bFromIdx = nodeIndex.get(b.from) || 0;
        if (aFromIdx !== bFromIdx) return aFromIdx - bFromIdx;
        const aToIdx = nodeIndex.get(a.to) || 0;
        const bToIdx = nodeIndex.get(b.to) || 0;
        return aToIdx - bToIdx;
      });
    };

    const parsePieChart = () => {
      // 色のリスト（Tableau 10）
      const colors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"];

      // タイトルを取得
      const titleMatch = diagram.match(/pie\s+title\s+(.+)/i);
      const title = titleMatch ? titleMatch[1].trim() : "Pie Chart";

      // 図定義から直接パース（最も確実な方法）
      const segments: PieSegment[] = [];
      const lines = diagram.split("\n");
      let totalValue = 0;
      const rawSegments: { label: string; value: number }[] = [];

      lines.forEach(line => {
        const match = line.match(/"([^"]+)"\s*:\s*(\d+)/);
        if (match) {
          const value = parseFloat(match[2]);
          rawSegments.push({ label: match[1], value });
          totalValue += value;
        }
      });

      let currentAngle = -Math.PI / 2; // 12時から開始
      rawSegments.forEach((seg, i) => {
        const angle = (seg.value / totalValue) * Math.PI * 2;
        segments.push({
          label: seg.label,
          value: seg.value,
          color: colors[i % colors.length],
          startAngle: currentAngle,
          endAngle: currentAngle + angle,
        });
        currentAngle += angle;
      });

      console.log("Pie segments:", segments); // デバッグ用
      setPieData({ segments, title });
    };

    const parseSequence = () => {
      const actors: SequenceActor[] = [];
      const messages: SequenceMessage[] = [];
      const actorMap = new Map<string, number>(); // ID -> index

      const lines = diagram.split("\n");

      // Step 1: アクターを取得
      let xPos = 120;
      lines.forEach(line => {
        const match = line.match(/participant\s+(\w+)(?:\s+as\s+(.+))?/i);
        if (match) {
          const id = match[1];
          const displayName = match[2]?.trim() || id;
          actorMap.set(id, actors.length);
          actors.push({ name: displayName, x: xPos });
          xPos += 180;
        }
      });

      // Step 2: メッセージを取得
      let yPos = 100;
      lines.forEach(line => {
        // パターン: U->>F: テキスト or D-->>A: テキスト
        const match = line.match(/(\w+)\s*(--?>>?)\s*(\w+)\s*:\s*(.+)/);
        if (match) {
          const fromId = match[1];
          const arrow = match[2];
          const toId = match[3];
          const text = match[4].trim();
          const isDashed = arrow.includes("--");

          const fromIdx = actorMap.get(fromId);
          const toIdx = actorMap.get(toId);

          if (fromIdx !== undefined && toIdx !== undefined) {
            messages.push({
              from: fromIdx,
              to: toIdx,
              text,
              y: yPos,
              type: isDashed ? "dashed" : "solid",
            });
            yPos += 60;
          }
        }
      });

      console.log("Sequence actors:", actors);
      console.log("Sequence messages:", messages);
      setSeqData({ actors, messages, height: yPos + 80 });
    };

    const parseStateDiagram = () => {
      const nodes: StateNode[] = [];
      const transitions: StateTransition[] = [];
      const stateSet = new Set<string>();

      const lines = diagram.split("\n");

      // Step 1: 全ての状態と遷移を収集
      lines.forEach(line => {
        const trimmed = line.trim();

        // [*] --> State (開始状態)
        const startMatch = trimmed.match(/\[\*\]\s*-->\s*(\w+)/);
        if (startMatch) {
          stateSet.add("[*]start");
          stateSet.add(startMatch[1]);
          transitions.push({ from: "[*]start", to: startMatch[1] });
          return;
        }

        // State --> [*] (終了状態) - 今回のサンプルにはない
        const endMatch = trimmed.match(/(\w+)\s*-->\s*\[\*\]$/);
        if (endMatch) {
          stateSet.add(endMatch[1]);
          stateSet.add("[*]end");
          transitions.push({ from: endMatch[1], to: "[*]end" });
          return;
        }

        // State --> OtherState : label
        const transMatch = trimmed.match(/(\w+)\s*-->\s*(\w+)(?:\s*:\s*(.+))?/);
        if (transMatch) {
          stateSet.add(transMatch[1]);
          stateSet.add(transMatch[2]);
          transitions.push({ from: transMatch[1], to: transMatch[2], label: transMatch[3]?.trim() });
        }
      });

      // Step 2: 動的レイアウト（トポロジカルソートベース）
      // 各状態の階層レベルを計算（開始状態からの距離）
      const levels = new Map<string, number>();
      const inDegree = new Map<string, number>();
      const adjacency = new Map<string, string[]>();

      // 初期化
      stateSet.forEach(state => {
        inDegree.set(state, 0);
        adjacency.set(state, []);
      });

      // 入次数と隣接リストを構築
      transitions.forEach(t => {
        inDegree.set(t.to, (inDegree.get(t.to) || 0) + 1);
        adjacency.get(t.from)?.push(t.to);
      });

      // BFSで階層レベルを計算
      const queue: string[] = [];
      stateSet.forEach(state => {
        if (inDegree.get(state) === 0 || state === "[*]start") {
          queue.push(state);
          levels.set(state, 0);
        }
      });

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLevel = levels.get(current) || 0;
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach(neighbor => {
          if (!levels.has(neighbor)) {
            levels.set(neighbor, currentLevel + 1);
            queue.push(neighbor);
          }
        });
      }

      // 循環参照で残った状態にもレベルを設定
      stateSet.forEach(state => {
        if (!levels.has(state)) {
          levels.set(state, 3); // デフォルトレベル
        }
      });

      // 階層ごとに状態をグループ化
      const levelGroups = new Map<number, string[]>();
      levels.forEach((level, state) => {
        if (!levelGroups.has(level)) levelGroups.set(level, []);
        levelGroups.get(level)!.push(state);
      });

      // 位置を計算
      const xSpacing = 180;
      const ySpacing = 120;
      const startX = 100;
      const centerY = 300;

      stateSet.forEach(state => {
        const level = levels.get(state) || 0;
        const group = levelGroups.get(level) || [state];
        const indexInGroup = group.indexOf(state);
        const groupSize = group.length;

        const x = startX + level * xSpacing;
        const y = centerY + (indexInGroup - (groupSize - 1) / 2) * ySpacing;

        nodes.push({
          id: state,
          label: state.startsWith("[*]") ? "" : state,
          x,
          y,
          isStart: state === "[*]start",
          isEnd: state === "[*]end",
        });
      });

      console.log("State nodes:", nodes);
      console.log("State transitions:", transitions);
      setStateData({ nodes, transitions });
    };

    const parseMindmap = () => {
      const nodes: MindmapNode[] = [];
      const connections: { from: string; to: string }[] = [];

      const lines = diagram.split("\n");
      let nodeId = 0;
      const levelStack: { id: string; level: number; branchAngle?: number }[] = [];

      // レイアウト設定
      const centerX = 400;
      const centerY = 300;

      // Step 1: 最初にブランチ（レベル1）の数を数える
      let branchCount = 0;
      lines.forEach(line => {
        if (!line.trim() || line.trim().toLowerCase().startsWith("mindmap")) return;
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const level = Math.floor(indent / 4);
        if (level === 1) branchCount++;
      });

      // Step 2: ノードを処理
      let currentBranchIndex = 0;
      const childCountPerParent: { [parentId: string]: number } = {};

      lines.forEach(line => {
        if (!line.trim() || line.trim().toLowerCase().startsWith("mindmap")) return;

        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const level = Math.floor(indent / 4);

        let label = line.trim();
        const rootMatch = label.match(/root\(\((.+)\)\)/);
        if (rootMatch) {
          label = rootMatch[1];
        }

        if (!label) return;

        const id = `node-${nodeId++}`;
        let x = centerX;
        let y = centerY;
        let branchAngle = 0;

        if (level === 0) {
          // ルートノード（中央）
          nodes.push({ id, label, level, x, y, isRoot: true });
          levelStack.length = 0;
          levelStack.push({ id, level: 0 });
        } else {
          // 親を探す
          while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= level) {
            levelStack.pop();
          }
          const parent = levelStack[levelStack.length - 1];

          if (parent) {
            if (level === 1) {
              // レベル1: メインブランチ（4方向に均等配置）
              branchAngle = (currentBranchIndex / branchCount) * Math.PI * 2 - Math.PI / 2;
              const radius = 160;
              x = centerX + radius * Math.cos(branchAngle);
              y = centerY + radius * Math.sin(branchAngle);
              currentBranchIndex++;
            } else {
              // レベル2+: 親のブランチ角度を基準に配置
              const parentBranchAngle = parent.branchAngle || 0;

              // 親の子の数を追跡
              if (!childCountPerParent[parent.id]) {
                childCountPerParent[parent.id] = 0;
              }
              const childIndex = childCountPerParent[parent.id];
              childCountPerParent[parent.id]++;

              // 子ノードを親の周りに扇形に配置
              const spreadAngle = Math.PI / 6; // 30度の広がり
              const childAngle = parentBranchAngle + (childIndex - 1) * spreadAngle;
              const radius = 160 + (level - 1) * 120;

              x = centerX + radius * Math.cos(childAngle);
              y = centerY + radius * Math.sin(childAngle);
              branchAngle = childAngle;
            }

            connections.push({ from: parent.id, to: id });
          }

          nodes.push({ id, label, level, x, y, parentId: parent?.id });
          levelStack.push({ id, level, branchAngle });
        }
      });

      console.log("Mindmap nodes:", nodes);
      console.log("Mindmap connections:", connections);
      setMindmapData({ nodes, connections });
    };

    parseDiagram();
  }, [diagram, diagramType]);

  // ========== レンダリング ==========

  const getOpacity = (index: number) => {
    const startFrame = index * framesPerElement;
    if (frame < startFrame) return 0;
    return Math.min((frame - startFrame) / (framesPerElement * 0.5), 1);
  };

  // Flowchart
  if (diagramType === "flowchart" && flowData) {
    const sequence: Array<{ type: "node" | "edge"; index: number }> = [];
    const maxLen = Math.max(flowData.nodes.length, flowData.edges.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < flowData.nodes.length) sequence.push({ type: "node", index: i });
      if (i < flowData.edges.length) sequence.push({ type: "edge", index: i });
    }

    const visibleCount = sequence.filter((_, i) => frame >= i * framesPerElement).length;

    return (
      <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
        <svg viewBox={`0 0 ${flowData.viewBox.width} ${flowData.viewBox.height}`} style={{ width: "80%", height: "80%" }}>
          {flowData.edges.map((edge, edgeIndex) => {
            const seqIndex = sequence.findIndex(s => s.type === "edge" && s.index === edgeIndex);
            const opacity = getOpacity(seqIndex);
            if (edge.points.length < 2) return null;
            const pathD = edge.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
            const last = edge.points[edge.points.length - 1];
            const prev = edge.points[edge.points.length - 2] || last;
            const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
            const arrowSize = 8;

            return (
              <g key={`edge-${edgeIndex}`} opacity={opacity}>
                <path d={pathD} fill="none" stroke="#888" strokeWidth={2} />
                <polygon
                  points={`${last.x},${last.y} ${last.x - arrowSize * Math.cos(angle - Math.PI / 6)},${last.y - arrowSize * Math.sin(angle - Math.PI / 6)} ${last.x - arrowSize * Math.cos(angle + Math.PI / 6)},${last.y - arrowSize * Math.sin(angle + Math.PI / 6)}`}
                  fill="#888"
                />
                {edge.label && (
                  <text x={(edge.points[0].x + last.x) / 2} y={(edge.points[0].y + last.y) / 2 - 5} fill="#ccc" fontSize={12} textAnchor="middle">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {flowData.nodes.map((node, nodeIndex) => {
            const seqIndex = sequence.findIndex(s => s.type === "node" && s.index === nodeIndex);
            const opacity = getOpacity(seqIndex);

            return (
              <g key={node.id} opacity={opacity}>
                {(node.shape === "rect" || node.shape === "rounded") && (
                  <rect
                    x={node.x - node.width / 2} y={node.y - node.height / 2}
                    width={node.width} height={node.height}
                    fill="#2d2d44" stroke="#5a5a8a" strokeWidth={2}
                    rx={node.shape === "rounded" ? 8 : 4}
                  />
                )}
                {node.shape === "diamond" && (
                  <polygon
                    points={`${node.x},${node.y - node.height / 2} ${node.x + node.width / 2},${node.y} ${node.x},${node.y + node.height / 2} ${node.x - node.width / 2},${node.y}`}
                    fill="#2d2d44" stroke="#5a5a8a" strokeWidth={2}
                  />
                )}
                <text x={node.x} y={node.y + 4} fill="#fff" fontSize={14} textAnchor="middle">{node.label}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", color: "#888", fontSize: 16, fontFamily: "monospace" }}>
          {visibleCount} / {sequence.length} elements
        </div>
      </AbsoluteFill>
    );
  }

  // Pie Chart
  if (diagramType === "pie" && pieData) {
    const centerX = 400;
    const centerY = 380; // 下に移動
    const radius = 180;  // 少し小さく

    const visibleCount = pieData.segments.filter((_, i) => frame >= i * framesPerElement).length;

    return (
      <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
        <svg viewBox="0 0 800 700" style={{ width: "80%", height: "80%" }}>
          {/* Title */}
          <text x={centerX} y={60} fill="#fff" fontSize={28} textAnchor="middle" fontWeight="bold" opacity={getOpacity(0)}>
            {pieData.title}
          </text>

          {/* Segments */}
          {pieData.segments.map((seg, i) => {
            const opacity = getOpacity(i + 1); // +1 for title
            const largeArc = seg.endAngle - seg.startAngle > Math.PI ? 1 : 0;

            const x1 = centerX + radius * Math.cos(seg.startAngle);
            const y1 = centerY + radius * Math.sin(seg.startAngle);
            const x2 = centerX + radius * Math.cos(seg.endAngle);
            const y2 = centerY + radius * Math.sin(seg.endAngle);

            const pathD = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            // ラベルの位置
            const midAngle = (seg.startAngle + seg.endAngle) / 2;
            const labelRadius = radius * 1.3;
            const labelX = centerX + labelRadius * Math.cos(midAngle);
            const labelY = centerY + labelRadius * Math.sin(midAngle);

            return (
              <g key={i} opacity={opacity}>
                <path d={pathD} fill={seg.color} stroke="#1a1a2e" strokeWidth={2} />
                <text x={labelX} y={labelY} fill="#fff" fontSize={14} textAnchor="middle">
                  {seg.label} ({seg.value}%)
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", color: "#888", fontSize: 16, fontFamily: "monospace" }}>
          {visibleCount} / {pieData.segments.length + 1} elements
        </div>
      </AbsoluteFill>
    );
  }

  // Sequence Diagram
  if (diagramType === "sequence" && seqData) {
    const totalElements = seqData.actors.length + seqData.messages.length;
    const visibleCount = Array.from({ length: totalElements }, (_, i) => i).filter(i => frame >= i * framesPerElement).length;

    return (
      <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
        <svg viewBox={`0 0 ${seqData.actors.length * 200 + 100} ${seqData.height + 100}`} style={{ width: "80%", height: "80%" }}>
          {/* Actors */}
          {seqData.actors.map((actor, i) => {
            const opacity = getOpacity(i);
            return (
              <g key={`actor-${i}`} opacity={opacity}>
                <rect x={actor.x - 50} y={20} width={100} height={40} fill="#2d2d44" stroke="#5a5a8a" strokeWidth={2} rx={4} />
                <text x={actor.x} y={45} fill="#fff" fontSize={14} textAnchor="middle">{actor.name}</text>
                <line x1={actor.x} y1={60} x2={actor.x} y2={seqData.height} stroke="#5a5a8a" strokeWidth={1} strokeDasharray="5,5" />
              </g>
            );
          })}

          {/* Messages */}
          {seqData.messages.map((msg, i) => {
            const opacity = getOpacity(seqData.actors.length + i);
            const fromX = seqData.actors[msg.from]?.x || 0;
            const toX = seqData.actors[msg.to]?.x || 0;
            const direction = toX > fromX ? 1 : -1;
            const arrowSize = 8;

            return (
              <g key={`msg-${i}`} opacity={opacity}>
                <line
                  x1={fromX} y1={msg.y} x2={toX} y2={msg.y}
                  stroke="#888" strokeWidth={2}
                  strokeDasharray={msg.type === "dashed" ? "5,5" : "none"}
                />
                <polygon
                  points={`${toX},${msg.y} ${toX - direction * arrowSize},${msg.y - arrowSize / 2} ${toX - direction * arrowSize},${msg.y + arrowSize / 2}`}
                  fill="#888"
                />
                <text x={(fromX + toX) / 2} y={msg.y - 8} fill="#ccc" fontSize={12} textAnchor="middle">{msg.text}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", color: "#888", fontSize: 16, fontFamily: "monospace" }}>
          {visibleCount} / {totalElements} elements
        </div>
      </AbsoluteFill>
    );
  }

  // State Diagram
  if (diagramType === "state" && stateData) {
    const totalElements = stateData.nodes.length + stateData.transitions.length;
    const visibleCount = Array.from({ length: totalElements }, (_, i) => i).filter(i => frame >= i * framesPerElement).length;

    // ノードの位置を取得するヘルパー
    const getNodePos = (id: string) => {
      const node = stateData.nodes.find(n => n.id === id);
      return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
    };

    const nodeWidth = 120;
    const nodeHeight = 50;

    return (
      <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
        <svg viewBox="0 0 900 600" style={{ width: "90%", height: "80%" }}>
          {/* Transitions (behind nodes) */}
          {stateData.transitions.map((trans, i) => {
            const opacity = getOpacity(stateData.nodes.length + i);
            const fromPos = getNodePos(trans.from);
            const toPos = getNodePos(trans.to);

            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const angle = Math.atan2(dy, dx);
            const arrowSize = 10;

            // 矢印の終点を調整（ノードの中心から少し手前）
            const nodeRadius = 60;
            const endX = toPos.x - nodeRadius * Math.cos(angle);
            const endY = toPos.y - nodeRadius * Math.sin(angle);
            const startX = fromPos.x + (fromPos.x === 100 ? 15 : nodeRadius) * Math.cos(angle);
            const startY = fromPos.y + (fromPos.x === 100 ? 15 : nodeRadius) * Math.sin(angle);

            // ラベル位置（線の中点から少しオフセット）
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const labelOffsetX = -dy * 0.15;
            const labelOffsetY = dx * 0.15;

            return (
              <g key={`trans-${i}`} opacity={opacity}>
                <path
                  d={`M ${startX} ${startY} L ${endX} ${endY}`}
                  fill="none"
                  stroke="#888"
                  strokeWidth={2}
                />
                <polygon
                  points={`${endX},${endY} ${endX - arrowSize * Math.cos(angle - Math.PI / 6)},${endY - arrowSize * Math.sin(angle - Math.PI / 6)} ${endX - arrowSize * Math.cos(angle + Math.PI / 6)},${endY - arrowSize * Math.sin(angle + Math.PI / 6)}`}
                  fill="#888"
                />
                {trans.label && (
                  <text
                    x={midX + labelOffsetX}
                    y={midY + labelOffsetY}
                    fill="#fff"
                    fontSize={14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {trans.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {stateData.nodes.map((node, i) => {
            const opacity = getOpacity(i);

            if (node.isStart) {
              // 開始ノード（黒丸）
              return (
                <g key={node.id} opacity={opacity}>
                  <circle cx={node.x} cy={node.y} r={15} fill="#5a5a8a" />
                </g>
              );
            }

            if (node.isEnd) {
              // 終了ノード（二重丸）
              return (
                <g key={node.id} opacity={opacity}>
                  <circle cx={node.x} cy={node.y} r={18} fill="none" stroke="#5a5a8a" strokeWidth={2} />
                  <circle cx={node.x} cy={node.y} r={10} fill="#5a5a8a" />
                </g>
              );
            }

            // 通常の状態ノード（角丸四角形）
            return (
              <g key={node.id} opacity={opacity}>
                <rect
                  x={node.x - nodeWidth / 2}
                  y={node.y - nodeHeight / 2}
                  width={nodeWidth}
                  height={nodeHeight}
                  fill="#2d2d44"
                  stroke="#5a5a8a"
                  strokeWidth={2}
                  rx={10}
                />
                <text x={node.x} y={node.y + 6} fill="#fff" fontSize={18} textAnchor="middle">
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", color: "#888", fontSize: 16, fontFamily: "monospace" }}>
          {visibleCount} / {totalElements} elements
        </div>
      </AbsoluteFill>
    );
  }

  // Mindmap
  if (diagramType === "mindmap" && mindmapData) {
    const totalElements = mindmapData.nodes.length + mindmapData.connections.length;
    const visibleCount = Array.from({ length: totalElements }, (_, i) => i).filter(i => frame >= i * framesPerElement).length;

    // ノードの位置を取得するヘルパー
    const getNodePos = (id: string) => {
      const node = mindmapData.nodes.find(n => n.id === id);
      return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
    };

    // ノードのインデックスを取得
    const getNodeIndex = (id: string) => {
      return mindmapData.nodes.findIndex(n => n.id === id);
    };

    // レベルごとの色
    const levelColors = [
      "#4e79a7", // Level 0 (root) - blue
      "#e15759", // Level 1 - red
      "#59a14f", // Level 2 - green
      "#f28e2b", // Level 3 - orange
    ];

    return (
      <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
        <svg viewBox="0 0 900 700" style={{ width: "90%", height: "85%" }}>
          {/* Connections (behind nodes) */}
          {mindmapData.connections.map((conn, i) => {
            const fromIdx = getNodeIndex(conn.from);
            const toIdx = getNodeIndex(conn.to);
            const opacity = getOpacity(Math.max(fromIdx, toIdx));

            const fromPos = getNodePos(conn.from);
            const toPos = getNodePos(conn.to);

            return (
              <line
                key={`conn-${i}`}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#6a6a9a"
                strokeWidth={3}
                opacity={opacity}
              />
            );
          })}

          {/* Nodes */}
          {mindmapData.nodes.map((node, i) => {
            const opacity = getOpacity(i);
            const color = levelColors[node.level % levelColors.length];

            if (node.isRoot) {
              // ルートノード（大きめの円）
              return (
                <g key={node.id} opacity={opacity}>
                  <circle cx={node.x} cy={node.y} r={70} fill={color} />
                  <text x={node.x} y={node.y + 8} fill="#fff" fontSize={22} textAnchor="middle" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            // レベル1は大きめ、レベル2+は小さめ
            const isMainBranch = node.level === 1;
            const textWidth = Math.max(node.label.length * (isMainBranch ? 14 : 12) + 30, isMainBranch ? 120 : 80);
            const textHeight = isMainBranch ? 45 : 35;
            const fontSize = isMainBranch ? 18 : 14;

            return (
              <g key={node.id} opacity={opacity}>
                <rect
                  x={node.x - textWidth / 2}
                  y={node.y - textHeight / 2}
                  width={textWidth}
                  height={textHeight}
                  fill={color}
                  rx={10}
                />
                <text x={node.x} y={node.y + fontSize / 3} fill="#fff" fontSize={fontSize} textAnchor="middle" fontWeight={isMainBranch ? "bold" : "normal"}>
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", color: "#888", fontSize: 16, fontFamily: "monospace" }}>
          {visibleCount} / {totalElements} elements
        </div>
      </AbsoluteFill>
    );
  }

  // Unknown/Loading
  return (
    <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
      <text style={{ color: "#888", fontSize: 24 }}>Loading or unsupported diagram type: {diagramType}</text>
    </AbsoluteFill>
  );
};
