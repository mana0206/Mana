"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";

export function FotoUpload({
  url,
  onChange,
  pasta,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
  pasta: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    const supabase = createClient();
    const ext = arquivo.name.split(".").pop() ?? "jpg";
    const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("fotos")
      .upload(caminho, arquivo, { upsert: true });
    setEnviando(false);
    if (error) {
      toast.error("Erro ao enviar a foto");
      return;
    }
    const { data } = supabase.storage.from("fotos").getPublicUrl(caminho);
    onChange(data.publicUrl);
  }

  return (
    <div className="flex items-center gap-3">
      {url ? (
        <div className="relative">
          <Image
            src={url}
            alt="Foto"
            width={80}
            height={80}
            className="size-20 rounded-xl object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" />
          {enviando ? "Enviando..." : "Adicionar foto"}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={enviar}
      />
    </div>
  );
}
