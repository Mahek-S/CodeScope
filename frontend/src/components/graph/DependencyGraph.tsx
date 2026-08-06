import { useMemo } from "react";
import { ReactFlow, Background, Controls, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildDependencyGraph } from "./layout";
import { FileFlowNode, HubFlowNode } from "./FileFlowNode";

// Left untyped (no explicit `NodeTypes` annotation): our custom nodes use
// specific typed data (NodeProps<Node<FileNodeData, "file">>), and
// @xyflow/react's NodeTypes map is invariant enough that annotating this
// with the generic NodeTypes type fights the per-node data typing for no
// real benefit -- ReactFlow only needs this shape at runtime.
const nodeTypes = {
    file: FileFlowNode,
    hub: HubFlowNode,
};

export function DependencyGraph({
    changedFiles,
    directlyAffected,
    transitivelyAffected,
    selected,
    onSelectFile,
}: {
    changedFiles: string[];
    directlyAffected: string[];
    transitivelyAffected: string[];
    selected: string | null;
    onSelectFile: (filepath: string) => void;
}) {
    const { nodes, edges } = useMemo(
        () =>
            buildDependencyGraph({
                changedFiles,
                directlyAffected,
                transitivelyAffected,
                selected,
                onSelect: onSelectFile,
            }),
        [changedFiles, directlyAffected, transitivelyAffected, selected, onSelectFile],
    );

    const isEmpty = nodes.length === 0;

    return (
        <div className="relative h-full w-full bg-background">

            {isEmpty ? (
                <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[11px] text-muted-foreground">
                    No dependency data for this analysis yet.
                </div>
            ) : (
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    colorMode="dark"
                    fitView
                    fitViewOptions={{ padding: 0.25 }}
                    minZoom={0.3}
                    maxZoom={1.5}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--hairline)" />
                    <Controls showInteractive={false} className="!border !border-hairline !bg-panel !shadow-none [&_button]:!border-hairline [&_button]:!bg-panel [&_button]:!fill-foreground [&_button]:hover:!bg-panel-raised" />
                </ReactFlow>
            )}

            {!isEmpty && (
                <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 rounded border border-hairline bg-panel/90 px-3 py-2.5 backdrop-blur-sm">
                    <LegendRow swatch={<span className="size-2.5 rounded-sm border border-signal bg-panel-raised" />} label="Changed" />
                    <LegendRow swatch={<span className="size-2.5 rounded-sm border border-[var(--risk-med)] bg-panel-raised" />} label="Directly affected" />
                    <LegendRow swatch={<span className="size-2.5 rounded-sm border border-hairline-strong bg-panel-raised" />} label="Transitively affected" />
                </div>
            )}
        </div>
    );
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="flex size-3 items-center justify-center">{swatch}</span>
            {label}
        </div>
    );
}