export type FileNodeKind = "changed" | "direct" | "transitive" | "overflow";

export type FileNodeData = {
    kind: FileNodeKind;
    filepath: string;
    /** For "overflow" nodes only -- how many files are collapsed into this node. */
    overflowCount?: number;
    selected: boolean;
    onSelect: (filepath: string) => void;
};

export type HubNodeData = Record<string, never>;