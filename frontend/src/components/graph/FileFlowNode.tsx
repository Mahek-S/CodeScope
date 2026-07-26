import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { FileCode2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FileNodeData } from "./types";

type FileNode = Node<FileNodeData, "file">;

const kindStyles: Record<string, { border: string; label: string; labelColor: string }> = {
    changed: { border: "border-signal", label: "Changed", labelColor: "text-signal" },
    direct: { border: "border-[var(--risk-med)]", label: "Direct", labelColor: "text-[var(--risk-med)]" },
    transitive: { border: "border-hairline-strong", label: "Transitive", labelColor: "text-muted-foreground" },
};

export function FileFlowNode({ data }: NodeProps<FileNode>) {
    if (data.kind === "overflow") {
        return (
            <div className="flex w-52 items-center gap-2 rounded-md border border-dashed border-hairline bg-panel/90 px-3 py-2.5 text-muted-foreground backdrop-blur-sm">
                <Handle type="target" position={Position.Left} className="!opacity-0" />
                <MoreHorizontal className="size-3.5 shrink-0" />
                <span className="font-mono text-[11px]">+{data.overflowCount} more files</span>
                <Handle type="source" position={Position.Right} className="!opacity-0" />
            </div>
        );
    }

    const style = kindStyles[data.kind] ?? kindStyles.transitive;
    const segments = data.filepath.split("/");
    const filename = segments.pop() ?? data.filepath;
    const dir = segments.join("/");

    return (
        <div
            onClick={() => data.onSelect(data.filepath)}
            className={cn(
                "w-52 cursor-pointer rounded-md border bg-panel/95 px-3 py-2 backdrop-blur-sm transition-all",
                style.border,
                data.selected ? "ring-2 ring-signal ring-offset-1 ring-offset-background" : "hover:border-hairline-strong",
            )}
            title={data.filepath}
        >
            <Handle type="target" position={Position.Left} className="!opacity-0" />
            <div className="flex items-center gap-1.5">
                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-[11px] text-foreground">{filename}</span>
            </div>
            {dir && <p className="mt-0.5 truncate pl-5 font-mono text-[10px] text-muted-foreground">{dir}/</p>}
            <span className={cn("mt-1.5 ml-5 inline-block font-mono text-[9px] uppercase tracking-wide", style.labelColor)}>
                {style.label}
            </span>
            <Handle type="source" position={Position.Right} className="!opacity-0" />
        </div>
    );
}

export function HubFlowNode() {
    return (
        <div className="size-1.5 rounded-full bg-hairline-strong">
            <Handle type="target" position={Position.Left} className="!opacity-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0" />
        </div>
    );
}