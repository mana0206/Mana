"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const supabaseConfigurado =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("https://") &&
  !(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("SEU-PROJETO");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    setCarregando(false);
    if (error) {
      toast.error("E-mail ou senha incorretos");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(120% 90% at 80% 10%, rgba(140,154,93,0.22), transparent 60%), #28311a",
      }}
    >
      <div className="mb-10 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#b3a268]">
          Pães &amp; Mais
        </p>
        <h1 className="mt-3 font-serif text-6xl tracking-wide text-[#f3eedf]">
          MANÁ
        </h1>
        <div className="mt-4 flex items-center gap-4">
          <span className="h-px w-10 bg-[#8c9a5d]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.34em] text-[#cdd3b4]">
            Cozinha Artesanal
          </span>
          <span className="h-px w-10 bg-[#8c9a5d]" />
        </div>
        <p className="mt-6 font-script text-xl text-[#b3a268]">
          Nutre o corpo, alimenta a alma.
        </p>
      </div>

      <Card className="w-full max-w-sm border-[#ddd6c2] bg-[#efe9da] text-[#2a2a20]">
        <CardContent className="pt-6">
          {!supabaseConfigurado ? (
            <div className="space-y-2 text-sm text-[#75705c]">
              <p className="font-medium text-[#2a2a20]">
                Supabase ainda não configurado.
              </p>
              <p>
                Preencha{" "}
                <code className="rounded bg-[#e0d9c4] px-1">.env.local</code>{" "}
                com a URL e a chave do projeto Supabase e reinicie o servidor.
              </p>
            </div>
          ) : (
            <form onSubmit={entrar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#3a4720] text-[#efe9da] hover:bg-[#586b32]"
                disabled={carregando}
              >
                {carregando ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-8 text-[10px] uppercase tracking-[0.3em] text-[#5e6b40]">
        Simples · Saudável · Acolhedor · Real
      </p>
    </main>
  );
}
