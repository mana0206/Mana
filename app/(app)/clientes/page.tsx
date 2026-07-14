"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { telefoneParaWhatsApp } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, MessageCircle } from "lucide-react";

type Formulario = {
  nome: string;
  telefone: string;
  endereco: string;
  observacoes: string;
};

const formVazio: Formulario = {
  nome: "",
  telefone: "",
  endereco: "",
  observacoes: "",
};

export default function ClientesPage() {
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Formulario>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setClientes((data as Cliente[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio);
    setDialogAberto(true);
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c);
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? "",
      endereco: c.endereco ?? "",
      observacoes: c.observacoes ?? "",
    });
    setDialogAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const supabase = createClient();
    const dados = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      observacoes: form.observacoes.trim() || null,
    };
    const { error } = editando
      ? await supabase.from("clientes").update(dados).eq("id", editando.id)
      : await supabase.from("clientes").insert(dados);
    setSalvando(false);
    if (error) {
      toast.error("Erro ao salvar cliente");
      return;
    }
    toast.success(editando ? "Cliente atualizado" : "Cliente criado");
    setDialogAberto(false);
    carregar();
  }

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", excluindo.id);
    if (error) {
      toast.error("Erro ao excluir cliente");
    } else {
      toast.success("Cliente excluído");
      carregar();
    }
    setExcluindo(null);
  }

  const filtrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        acao={
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo
          </Button>
        }
      />

      <Input
        placeholder="Buscar cliente..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4"
      />

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo="Nenhum cliente"
          descricao="Cadastre seus clientes com telefone para mandar orçamentos no WhatsApp."
        />
      ) : (
        <div className="space-y-2">
          {filtrados.map((c) => (
            <Card key={c.id} className="transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <Link
                  href={`/clientes/${c.id}`}
                  className="min-w-0 flex-1 outline-none"
                >
                  <p className="font-medium">{c.nome}</p>
                  {c.telefone && (
                    <p className="text-sm text-muted-foreground">
                      {c.telefone}
                    </p>
                  )}
                  {c.endereco && (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.endereco}
                    </p>
                  )}
                </Link>
                <div className="flex shrink-0 gap-1">
                  {c.telefone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Chamar ${c.nome} no WhatsApp`}
                      asChild
                    >
                      <a
                        href={`https://wa.me/${telefoneParaWhatsApp(c.telefone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="size-4 text-green-600" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Editar ${c.nome}`}
                    onClick={() => abrirEdicao(c)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Excluir ${c.nome}`}
                    onClick={() => setExcluindo(c)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnome">Nome</Label>
              <Input
                id="cnome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctel">Telefone / WhatsApp</Label>
              <Input
                id="ctel"
                inputMode="tel"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cend">Endereço</Label>
              <Input
                id="cend"
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cobs">Observações</Label>
              <Textarea
                id="cobs"
                rows={2}
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="Alergias, preferências..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!excluindo}
        onOpenChange={(aberto) => !aberto && setExcluindo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{excluindo?.nome}&quot; será removido. Os pedidos dele são
              mantidos, sem cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
