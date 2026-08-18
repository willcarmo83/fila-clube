import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não configurados. Copie .env.example para .env e preencha com os dados do seu projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

function applyVagaFilters(query, { level, horarios, faixaEtaria } = {}) {
  let q = query;
  if (level) q = q.eq("level", level);
  if (horarios && horarios.length > 0) q = q.overlaps("availability", horarios);
  if (faixaEtaria) q = q.eq("faixa_etaria", faixaEtaria);
  return q;
}

export const db = {
  // ---------------------------------------------------------------------
  // Modalidades
  // ---------------------------------------------------------------------
  async getModalidades() {
    const { data, error } = await supabase.from("modalidades").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addModalidade(id, label) {
    const { error } = await supabase.from("modalidades").insert({ id, label });
    if (error) throw error;
  },

  async setModalidadeArchived(id, archived) {
    const { error } = await supabase.from("modalidades").update({ archived }).eq("id", id);
    if (error) throw error;
  },

  // ---------------------------------------------------------------------
  // Fila — leitura (admin: dados completos; público: via view mascarada)
  // ---------------------------------------------------------------------
  async getQueuePage({ modalidadeId, isAdmin, offset, limit, search, filters }) {
    const table = isAdmin ? "queue_entries" : "public_queue_view";
    let q = supabase.from(table).select("*", { count: "exact" }).eq("modalidade_id", modalidadeId);
    q = applyVagaFilters(q, filters);
    if (search && search.trim()) {
      const s = search.trim();
      if (isAdmin) {
        q = q.or(`full_name.ilike.%${s}%,matricula.ilike.%${s}%`);
      } else {
        q = q.or(`masked_name.ilike.%${s}%,matricula.ilike.%${s}%`);
      }
    }
    q = q.order("position", { ascending: true }).range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data || [], count: count || 0 };
  },

  async getNextCallableId(modalidadeId, filters) {
    let q = supabase
      .from("queue_entries")
      .select("id")
      .eq("modalidade_id", modalidadeId)
      .or("status.is.null,status.neq.chamado");
    q = applyVagaFilters(q, filters);
    q = q.order("position", { ascending: true }).limit(1);
    const { data, error } = await q;
    if (error) throw error;
    return data?.[0]?.id || null;
  },

  // ---------------------------------------------------------------------
  // Fila — escrita
  // ---------------------------------------------------------------------
  async addQueueEntry(modalidadeId, entry) {
    const { data: maxRow, error: maxErr } = await supabase
      .from("queue_entries")
      .select("position")
      .eq("modalidade_id", modalidadeId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) throw maxErr;
    const nextPosition = (maxRow?.position || 0) + 1;
    const { error } = await supabase.from("queue_entries").insert({
      id: "m" + Date.now(),
      modalidade_id: modalidadeId,
      position: nextPosition,
      full_name: entry.full,
      matricula: entry.matricula,
      phone: entry.phone || null,
      level: entry.level || null,
      availability: entry.availability || [],
      faixa_etaria: entry.faixaEtaria || null,
      joined_at: new Date().toISOString().slice(0, 10),
      status: null,
    });
    if (error) throw error;
    return nextPosition;
  },

  async updateQueueEntry(id, fields) {
    const { error } = await supabase.from("queue_entries").update(fields).eq("id", id);
    if (error) throw error;
  },

  async deleteQueueEntry(id) {
    const { error } = await supabase.from("queue_entries").delete().eq("id", id);
    if (error) throw error;
  },

  async clearQueue(modalidadeId) {
    const { data, error } = await supabase
      .from("queue_entries")
      .select("id, full_name, matricula")
      .eq("modalidade_id", modalidadeId)
      .order("position", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return [];
    const { error: delErr } = await supabase.from("queue_entries").delete().eq("modalidade_id", modalidadeId);
    if (delErr) throw delErr;
    return data;
  },

  async moveQueueEntry(id, direction) {
    const { error } = await supabase.rpc("move_queue_entry", { p_entry_id: id, p_direction: direction });
    if (error) throw error;
  },

  async callMember(id) {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "chamado", called_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async resolveResponseStay(id) {
    const { error: moveErr } = await supabase.rpc("move_queue_entry", { p_entry_id: id, p_direction: "down" });
    if (moveErr) throw moveErr;
    const { error } = await supabase.from("queue_entries").update({ status: null, called_at: null }).eq("id", id);
    if (error) throw error;
  },

  // ---------------------------------------------------------------------
  // Logs
  // ---------------------------------------------------------------------
  async addLog({ modalidadeId, text, reason, by, removedMembers }) {
    const { error } = await supabase.from("logs").insert({
      id: "l" + Date.now() + Math.random().toString(16).slice(2),
      modalidade_id: modalidadeId,
      ts: new Date().toISOString(),
      text,
      reason: reason || null,
      by: by || "Secretaria",
      removed_members: removedMembers || null,
    });
    if (error) throw error;
  },

  async getRecentLogs(modalidadeId, limit = 5) {
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .eq("modalidade_id", modalidadeId)
      .order("ts", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getLogsPage({ modalidadeId, search, offset, limit }) {
    let q = supabase.from("logs").select("*", { count: "exact" });
    if (modalidadeId && modalidadeId !== "todas") q = q.eq("modalidade_id", modalidadeId);
    if (search && search.trim()) {
      const s = search.trim();
      q = q.or(`text.ilike.%${s}%,reason.ilike.%${s}%,by.ilike.%${s}%`);
    }
    q = q.order("ts", { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data || [], count: count || 0 };
  },

  async getVagaFillEvents(modalidadeId) {
    const { data, error } = await supabase
      .from("logs")
      .select("ts")
      .eq("modalidade_id", modalidadeId)
      .ilike("text", "%aceitou a vaga e foi matriculado%")
      .order("ts", { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => new Date(r.ts).getTime());
  },

  // ---------------------------------------------------------------------
  // Painel geral
  // ---------------------------------------------------------------------
  async getDashboardStats(modalidades) {
    const now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const perModalidade = [];
    let totalWaiting = 0;
    let aguardandoRespostaAgora = 0;
    const alerts = [];

    for (const m of modalidades) {
      const { count: queueLength, error: e1 } = await supabase
        .from("queue_entries")
        .select("id", { count: "exact", head: true })
        .eq("modalidade_id", m.id);
      if (e1) throw e1;

      const { data: aguardandoRows, error: e2 } = await supabase
        .from("queue_entries")
        .select("id, full_name, called_at")
        .eq("modalidade_id", m.id)
        .eq("status", "chamado");
      if (e2) throw e2;

      const aguardando = aguardandoRows?.length || 0;
      totalWaiting += queueLength || 0;
      aguardandoRespostaAgora += aguardando;
      perModalidade.push({ id: m.id, label: m.label, queueLength: queueLength || 0, aguardando });

      (aguardandoRows || []).forEach((r) => {
        if (r.called_at) {
          const hours = (now - new Date(r.called_at).getTime()) / 3600000;
          if (hours >= 48) {
            alerts.push({ modalityLabel: m.label, modalityId: m.id, name: r.full_name, hoursWaiting: hours });
          }
        }
      });
    }

    const { count: vagasPreenchidasMes, error: e3 } = await supabase
      .from("logs")
      .select("id", { count: "exact", head: true })
      .ilike("text", "%aceitou a vaga e foi matriculado%")
      .gte("ts", startOfMonth.toISOString());
    if (e3) throw e3;

    alerts.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
    return { totalWaiting, aguardandoRespostaAgora, vagasPreenchidasMes: vagasPreenchidasMes || 0, perModalidade, alerts };
  },
};
