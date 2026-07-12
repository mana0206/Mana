"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  ClipboardList,
  CalendarDays,
  Croissant,
  Menu,
  Wheat,
  BookOpen,
  Users,
  ShoppingCart,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

const abas = [
  { href: "/", label: "Início", icone: Home },
  { href: "/pedidos", label: "Pedidos", icone: ClipboardList },
  { href: "/agenda", label: "Agenda", icone: CalendarDays },
  { href: "/produtos", label: "Produtos", icone: Croissant },
];

const menuMais = [
  { href: "/ingredientes", label: "Ingredientes", icone: Wheat },
  { href: "/receitas", label: "Receitas", icone: BookOpen },
  { href: "/clientes", label: "Clientes", icone: Users },
  { href: "/compras", label: "Compras & Estoque", icone: ShoppingCart },
  { href: "/financeiro", label: "Financeiro", icone: Wallet },
  { href: "/relatorios", label: "Relatórios", icone: BarChart3 },
  { href: "/config", label: "Custos fixos", icone: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  const noMenuMais = menuMais.some((i) => pathname.startsWith(i.href));

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div
          className="mx-auto flex max-w-2xl items-stretch justify-around"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {abas.map((aba) => {
            const ativa =
              aba.href === "/"
                ? pathname === "/"
                : pathname.startsWith(aba.href);
            const Icone = aba.icone;
            return (
              <Link
                key={aba.href}
                href={aba.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  ativa ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icone className="size-5" />
                {aba.label}
              </Link>
            );
          })}

          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                noMenuMais ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Menu className="size-5" />
              Mais
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8">
              <SheetHeader>
                <SheetTitle className="font-serif text-2xl tracking-wide text-primary">
                  MANÁ
                  <span className="mt-0.5 block font-sans text-[10px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
                    Pães &amp; Mais
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-1 gap-1 px-2">
                {menuMais.map((item) => {
                  const Icone = item.icone;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuAberto(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-accent",
                        pathname.startsWith(item.href) && "bg-accent text-primary"
                      )}
                    >
                      <Icone className="size-5 text-muted-foreground" />
                      {item.label}
                    </Link>
                  );
                })}
                <Separator className="my-1" />
                <button
                  onClick={sair}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-5" />
                  Sair
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
