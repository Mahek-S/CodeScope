import type { Edge, Node } from "@xyflow/react";
import type { FileNodeData } from "./types";

const COLUMN_GAP = 300;
const HUB_OFFSET = 150;
const ROW_HEIGHT = 84;
const MAX_PER_COLUMN = 10;

export type BuildGraphArgs = {
    changedFiles: string[];
    directlyAffected: string[];
    transitivelyAffected: string[];
    selected: string | null;
    onSelect: (filepath: string) => void;
};

type FileNode = Node<FileNodeData, "file">;
type HubNode = Node<Record<string, never>, "hub">;

/**
 * Lays out three columns (changed -> directly affected -> transitively
 * affected) with a small "hub" node between each pair of columns so edges
 * fan out cleanly instead of drawing a dense N*M mesh.
 *
 * NOTE on fidelity: the backend's /affected-files and analysis endpoints
 * return three *flat* lists, not per-edge attribution (which specific
 * changed file caused which affected file) -- see
 * backend/services/graph_service.py::find_affected_files. So every node in
 * a column fans through the same hub to every node in the next column;
 * this is an honest visualization of "these files are impacted", not a
 * claim about which import caused which impact. Exact edges would need a
 * new endpoint exposing the `dependencies` table directly.
 */
export function buildDependencyGraph({
    changedFiles,
    directlyAffected,
    transitivelyAffected,
    selected,
    onSelect,
}: BuildGraphArgs): { nodes: (FileNode | HubNode)[]; edges: Edge[] } {
    const nodes: (FileNode | HubNode)[] = [];
    const edges: Edge[] = [];

    const changedCol = capColumn(changedFiles);
    const directCol = capColumn(directlyAffected);
    const transitiveCol = capColumn(transitivelyAffected);

    const columnX = { changed: 0, hub1: COLUMN_GAP - HUB_OFFSET, direct: COLUMN_GAP, hub2: COLUMN_GAP * 2 - HUB_OFFSET, transitive: COLUMN_GAP * 2 };

    placeColumn(nodes, changedCol, "changed", columnX.changed, selected, onSelect);
    placeColumn(nodes, directCol, "direct", columnX.direct, selected, onSelect);
    placeColumn(nodes, transitiveCol, "transitive", columnX.transitive, selected, onSelect);

    const hub1Id = "hub-1";
    const hub2Id = "hub-2";

    if (changedCol.items.length > 0 && directCol.items.length > 0) {
        nodes.push(hubNode(hub1Id, columnX.hub1, 0));
        for (const item of changedCol.items) {
            edges.push(fanEdge(`e-${item.id}-${hub1Id}`, item.id, hub1Id));
        }
        for (const item of directCol.items) {
            edges.push(fanEdge(`e-${hub1Id}-${item.id}`, hub1Id, item.id));
        }
    }

    if (directCol.items.length > 0 && transitiveCol.items.length > 0) {
        nodes.push(hubNode(hub2Id, columnX.hub2, 0));
        for (const item of directCol.items) {
            edges.push(fanEdge(`e-${item.id}-${hub2Id}`, item.id, hub2Id));
        }
        for (const item of transitiveCol.items) {
            edges.push(fanEdge(`e-${hub2Id}-${item.id}`, hub2Id, item.id));
        }
    }

    return { nodes, edges };
}

function capColumn(files: string[]): { items: { id: string; filepath: string }[]; overflow: number } {
    const items = files.slice(0, MAX_PER_COLUMN).map((filepath) => ({ id: filepath, filepath }));
    const overflow = Math.max(0, files.length - MAX_PER_COLUMN);
    return { items, overflow };
}

function placeColumn(
    nodes: (FileNode | HubNode)[],
    column: { items: { id: string; filepath: string }[]; overflow: number },
    kind: "changed" | "direct" | "transitive",
    x: number,
    selected: string | null,
    onSelect: (filepath: string) => void,
) {
    const total = column.items.length + (column.overflow > 0 ? 1 : 0);
    const startY = -((total - 1) * ROW_HEIGHT) / 2;

    column.items.forEach((item, i) => {
        nodes.push({
            id: item.id,
            type: "file",
            position: { x, y: startY + i * ROW_HEIGHT },
            data: {
                kind,
                filepath: item.filepath,
                selected: selected === item.filepath,
                onSelect,
            },
            draggable: false,
        });
    });

    if (column.overflow > 0) {
        const overflowId = `${kind}-overflow`;
        nodes.push({
            id: overflowId,
            type: "file",
            position: { x, y: startY + column.items.length * ROW_HEIGHT },
            data: {
                kind: "overflow",
                filepath: "",
                overflowCount: column.overflow,
                selected: false,
                onSelect: () => { },
            },
            draggable: false,
        });
    }
}

function hubNode(id: string, x: number, y: number): HubNode {
    return { id, type: "hub", position: { x, y }, data: {}, draggable: false, selectable: false };
}

function fanEdge(id: string, source: string, target: string): Edge {
    return {
        id,
        source,
        target,
        type: "smoothstep",
        style: { stroke: "var(--hairline-strong)", strokeWidth: 1.1, opacity: 0.55 },
    };
}