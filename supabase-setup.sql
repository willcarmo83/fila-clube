-- Rode este script no SQL Editor do seu projeto Supabase
-- (Menu lateral -> SQL Editor -> New query -> colar e rodar)

create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table app_storage enable row level security;

-- ATENÇÃO: esta política libera leitura e escrita para qualquer pessoa
-- que tenha a chave "anon" do projeto (a mesma usada no .env do app).
-- Isso é aceitável para uma primeira versão de uso interno, mas significa
-- que, tecnicamente, qualquer pessoa que inspecione o código do site
-- consegue ler e alterar a fila diretamente, sem passar pela senha de
-- administração do app. Veja o README para como restringir isso depois
-- (ex: mover as escritas para uma Supabase Edge Function ou usar Supabase
-- Auth de verdade).
create policy "leitura e escrita publica (uso interno)"
  on app_storage
  for all
  using (true)
  with check (true);
