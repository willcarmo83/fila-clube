import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não configurados. Copie .env.example para .env e preencha com os dados do seu projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

const TABLE = "app_storage";

// Mesma interface usada no protótipo original (window.storage), agora
// gravando de verdade no Supabase, para que os dados sejam compartilhados
// entre todos que acessarem o site, e persistam de verdade.
export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    const parsedValue = typeof value === "string" ? JSON.parse(value) : value;
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value: parsedValue, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      console.error("Erro ao salvar no Supabase:", error);
      return null;
    }
    return { key, value };
  },

  async delete(key) {
    const { error } = await supabase.from(TABLE).delete().eq("key", key);
    if (error) return null;
    return { key, deleted: true };
  },
};
