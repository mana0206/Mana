# 🌾 Maná · Pães & Mais

App PWA mobile-first para gerenciar a Maná (cozinha artesanal — pães, bolos, doces e mais): ficha técnica de receitas, precificação por margem, pedidos, agenda de entregas, orçamentos por WhatsApp, clientes, estoque, lista de compras, financeiro e relatórios.

**Stack**: Next.js (App Router) · Tailwind + shadcn/ui · Supabase (banco, auth e fotos) · Vercel

**Identidade visual** (do projeto [Maná brand identity design](https://claude.ai/design/p/b5e71dfc-0e9e-4d65-afe6-46726af865d2)): paleta oliva escuro `#3A4720` / oliva `#586B32` / sálvia `#8C9A5D` / dourado trigo `#B3A268` / creme `#EFE9DA`; títulos em DM Serif Display, corpo em Archivo, assinaturas em Petit Formal Script. Slogan: *"Nutre o corpo, alimenta a alma."*

## Como colocar no ar (primeira vez)

### 1. Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região `sa-east-1`, São Paulo).
2. No painel do projeto, abra **SQL Editor** → cole e execute todo o conteúdo de [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql).
3. Em **Authentication → Users → Add user**, crie os 2 usuários (e-mail + senha) — um para cada pessoa. Marque "Auto Confirm User".
4. Em **Authentication → Sign In / Up**, desative "Allow new users to sign up" (só vocês dois entram).
5. Em **Project Settings → API Keys**, copie a **URL** e a **publishable key**.

### 2. Rodar localmente

1. Copie `.env.example` para `.env.local` e preencha com a URL e a chave do passo anterior.
2. `npm install` e `npm run dev` → abra http://localhost:3000 e faça login.

### 3. Vercel (para usar no celular)

1. Crie uma conta em [vercel.com](https://vercel.com).
2. Suba este projeto para um repositório GitHub e importe na Vercel, **ou** use o CLI:
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```
3. Em **Settings → Environment Variables** do projeto na Vercel, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local` e faça redeploy.
4. No celular, abra a URL do deploy e use **"Adicionar à tela inicial"** — o app instala como PWA.

## Como o cálculo de preço funciona

1. **Ingredientes**: cadastre com o preço pago e o conteúdo da embalagem (ex: farinha R$ 6,00 / 1000 g) → o app calcula o custo por grama.
2. **Receitas**: monte a ficha técnica (ingredientes + quantidades) e informe o rendimento (ex: 20 brigadeiros) → custo por unidade.
3. **Custos fixos** (menu Mais → Custos fixos): gás, embalagem, mão de obra — entram em toda receita, como valor fixo (R$) ou % sobre os ingredientes.
4. **Produtos**: ligue à receita, defina a margem desejada (%) → o app mostra o **preço sugerido**; você decide o preço praticado.

## Compras por QR code (NFC-e)

Em **Compras & Estoque → Nota**, escaneie o QR code do cupom fiscal (ou cole o link). O app consulta a nota na Sefaz-GO e:

1. Lista todos os itens com quantidade e preço, sugerindo o vínculo com ingredientes já cadastrados (por similaridade de nome);
2. Para cada item você escolhe: **criar** ingrediente novo, **vincular** a um existente ou **não importar**;
3. Ao confirmar: o estoque entra convertido (kg → g, L → ml), o custo do ingrediente é atualizado pela compra mais recente e o **total da nota vira despesa** no financeiro;
4. A chave da nota fica registrada — a mesma nota não importa duas vezes.

## Produção

Na tela da **Receita → "Produzir esta receita"**: informe quantas vezes a receita foi feita. O app **baixa os ingredientes** da ficha técnica (mostrando antes o que falta) e **credita o produto acabado** no estoque. Na **entrega do pedido**, o estoque do produto acabado é baixado automaticamente.

## Fluxo do pedido

`Orçamento` → (enviar pelo WhatsApp) → `Confirmado` (sinal entra no financeiro) → `Em produção` → `Pronto` → `Entregue` (baixa o estoque de produto acabado) → registrar pagamento (saldo entra no financeiro).

A **lista de compras** é gerada sozinha: ingredientes abaixo do estoque mínimo + o que os pedidos confirmados vão consumir.
