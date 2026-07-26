import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useCreateOrg } from "@/hooks/useOrgs";

export function CreateOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const createOrg = useCreateOrg();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createOrg.mutate(name.trim(), {
      onSuccess: () => {
        setName("");
        onClose();
      },
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create organization">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="org-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Organization name
          </label>
          <input
            id="org-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="northwind"
            className="h-9 w-full rounded border border-hairline bg-background px-3 text-sm text-foreground outline-none focus:border-signal"
          />
        </div>
        {createOrg.isError && (
          <p className="text-xs text-[var(--risk-high)]">Couldn't create organization. Try again.</p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || createOrg.isPending}>
            {createOrg.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
