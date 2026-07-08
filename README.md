# Fila do Country Clube

App web para gerenciar a fila de espera das atividades esportivas do clube,
com modo consulta (aberto) e modo administração (protegido por senha), além
de log de todas as alterações.

Este projeto já foi testado e builda sem erros. Falta apenas você conectar
ao seu próprio banco de dados (gratuito) e rodar.

## Passo 1 — Criar o banco de dados (Supabase, grátis)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Clique em **New project**, dê um nome (ex: `fila-clube`) e uma senha de
   banco (guarde essa senha, mas ela não será usada neste app).
3. Aguarde o projeto ser criado (leva cerca de 1-2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase-setup.sql` (está nesta pasta), copie todo o
   conteúdo, cole no editor e clique em **Run**. Isso cria a tabela que
   guarda a fila e o log.
6. No menu lateral, vá em **Settings** → **API**. Você vai precisar de dois
   valores dessa página:
   - **Project URL**
   - **anon public key**

## Passo 2 — Configurar o projeto

1. Nesta pasta, duplique o arquivo `.env.example` e renomeie a cópia para
   `.env`.
2. Abra o `.env` e preencha com os valores que você pegou no passo anterior:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
   ```

## Passo 3 — Instalar e rodar localmente

Você precisa ter o [Node.js](https://nodejs.org) instalado (versão 18 ou
mais recente). Depois, no terminal, dentro desta pasta:

```bash
npm install
npm run dev
```

Isso vai abrir o app em `http://localhost:5173`. A senha de administração
padrão é `secretaria123` — troque isso antes de usar de verdade (veja
"Trocar a senha" abaixo).

## Passo 4 — Colocar no ar (para o clube acessar por um link)

A forma mais simples e gratuita é a **Vercel**:

1. Suba esta pasta para um repositório no GitHub (crie um repositório vazio
   e siga as instruções do próprio GitHub para enviar os arquivos).
2. Acesse [vercel.com](https://vercel.com), crie uma conta e clique em
   **Add New Project**, conectando o repositório do GitHub.
3. Na tela de configuração, adicione as mesmas variáveis do `.env` em
   **Environment Variables** (`VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`).
4. Clique em **Deploy**. Em cerca de 1 minuto você recebe um link público
   (algo como `fila-clube.vercel.app`) que pode ser compartilhado com todos
   os sócios.

(Netlify funciona de forma equivalente, se preferir.)

## Trocar a senha de administração

Abra `src/App.jsx` e altere esta linha perto do topo do arquivo:

```js
const ADMIN_PASSWORD = "secretaria123";
```

**Importante sobre segurança:** essa senha fica visível para qualquer pessoa
que inspecione o código do site (é uma limitação de qualquer verificação
feita só no navegador, sem um servidor por trás). Para uso interno,
baseado em confiança, isso costuma ser aceitável como primeira versão. Se
mais adiante vocês quiserem uma segurança mais forte (ex: login individual
por sócio da secretaria, com possibilidade de revogar acesso), o caminho é
usar o [Supabase Auth](https://supabase.com/docs/guides/auth) — é um passo
a mais de configuração, mas o resto do app já está pronto para receber essa
mudança.

## Estrutura do projeto

```
src/
  App.jsx        -> toda a interface e lógica da fila
  storage.js      -> camada que conversa com o Supabase (ler/salvar dados)
  main.jsx        -> ponto de entrada do React
supabase-setup.sql -> script para criar a tabela no Supabase
.env.example       -> modelo das variáveis de ambiente
```

## Modalidades esportivas

Para adicionar ou remover uma modalidade (hoje: Tênis, Squash, Golfe,
Natação), edite a lista `MODALIDADES` no início do `src/App.jsx`.
