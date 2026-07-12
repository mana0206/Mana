import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icone: Icone,
  titulo,
  descricao,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
      <Icone className="size-8 text-muted-foreground/50" />
      <p className="font-medium text-muted-foreground">{titulo}</p>
      {descricao && (
        <p className="max-w-xs text-sm text-muted-foreground/70">{descricao}</p>
      )}
    </div>
  );
}
