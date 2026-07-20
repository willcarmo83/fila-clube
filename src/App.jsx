import { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  PhoneCall,
  Trash2,
  Plus,
  Lock,
  Unlock,
  History,
  Eye,
  ShieldCheck,
  X,
  Users,
  Search,
  ArrowLeft,
} from "lucide-react";
import { storage, supabase } from "./storage.js";

const STORAGE_KEY = "fila-clube-data";
const PAGE_SIZE = 30;
const LOG_PAGE_SIZE = 30;

const MODALIDADES = [
  { id: "tenis", label: "Tênis" },
  { id: "natacao", label: "Natação" },
  { id: "pilates", label: "Pilates" },
  { id: "ginastica_artistica", label: "Ginástica artística" },
];

const SEED = {
  queues: {
    tenis: [
      { id: "t1", full: "Marcelo Andrade", matricula: "4021", phone: "(19) 99101-2233", joinedAt: "2026-02-11" },
      { id: "t2", full: "Renata Souza", matricula: "3187", phone: "(19) 99202-4455", joinedAt: "2026-03-02" },
      { id: "t3", full: "Carlos Torres", matricula: "5502", phone: "(19) 99303-6677", joinedAt: "2026-03-20" },
      { id: "t4", full: "Juliana Ferraz", matricula: "2290", phone: "(19) 99404-8899", joinedAt: "2026-04-05" },
      { id: "t5", full: "Paulo Mendes", matricula: "6110", phone: "(19) 99505-1122", joinedAt: "2026-05-14" },
    ],
    pilates: [
      { id: "p1", full: "Bianca Ramos", matricula: "1145", phone: "(19) 99111-2222", joinedAt: "2026-01-18" },
      { id: "p2", full: "Diego Lima", matricula: "4488", phone: "(19) 99222-3333", joinedAt: "2026-02-27" },
      { id: "p3", full: "Fernanda Klein", matricula: "3390", phone: "(19) 99333-4444", joinedAt: "2026-04-09" },
    ],
    ginastica_artistica: [
      { id: "ga1", full: "Roberto Villela", matricula: "2001", phone: "(19) 99444-5555", joinedAt: "2025-11-30" },
      { id: "ga2", full: "Simone Prado", matricula: "5540", phone: "(19) 99555-6666", joinedAt: "2026-01-22" },
      { id: "ga3", full: "André Castro", matricula: "1980", phone: "(19) 99666-7777", joinedAt: "2026-03-15" },
      { id: "ga4", full: "Helena Gaspar", matricula: "6602", phone: "(19) 99777-8888", joinedAt: "2026-05-01" },
    ],
  },
  logs: [
    { id: "l1", ts: Date.now() - 86400000 * 2, modality: "tenis", text: "Renata Souza saiu da posição 8 para a posição 2", reason: "Vaga liberada por desistência de outro sócio", by: "Secretaria" },
    { id: "l2", ts: Date.now() - 86400000 * 3, modality: "pilates", text: "Diego Lima foi chamado para vaga disponível", reason: "Horário de terça 18h ficou livre", by: "Secretaria" },
    { id: "l3", ts: Date.now() - 86400000 * 5, modality: "ginastica_artistica", text: "André Castro entrou na fila na posição 4", reason: "Solicitação feita na secretaria", by: "Secretaria" },
  ],
};

function maskName(full) {
  const parts = full.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatLogTime(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diffH = Math.round((now - ts) / 3600000);
  if (diffH < 1) return "agora há pouco";
  if (diffH < 24) return `há ${diffH}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function FilaClube() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [modality, setModality] = useState("tenis");
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ full: "", matricula: "", phone: "" });
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'up'|'down'|'remove', index }
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showLogsView, setShowLogsView] = useState(false);
  const [logModalityFilter, setLogModalityFilter] = useState("todas");
  const [logSearch, setLogSearch] = useState("");
  const [logVisibleCount, setLogVisibleCount] = useState(LOG_PAGE_SIZE);
  const dataRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await storage.get(STORAGE_KEY);
        const parsed = result ? JSON.parse(result.value) : SEED;
        setData(parsed);
        dataRef.current = parsed;
        if (!result) {
          await storage.set(STORAGE_KEY, JSON.stringify(SEED));
        }
      } catch (e) {
        console.error("Erro ao carregar dados do Supabase:", e);
        setData(SEED);
        dataRef.current = SEED;
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setQueueSearch("");
  }, [modality]);

  async function persist(next) {
    setData(next);
    dataRef.current = next;
    try {
      const result = await storage.set(STORAGE_KEY, JSON.stringify(next));
      if (!result) setSaveError(true);
      else setSaveError(false);
    } catch (e) {
      console.error("Erro ao salvar no Supabase:", e);
      setSaveError(true);
    }
  }

  function pushLog(next, text, reason) {
    return {
      ...next,
      logs: [
        { id: "l" + Date.now() + Math.random().toString(16).slice(2), ts: Date.now(), modality, text, reason, by: adminName || "Secretaria" },
        ...next.logs,
      ],
    };
  }

  function openReasonModal(type, index) {
    setPendingAction({ type, index });
    setReasonInput("");
    setReasonError("");
  }

  function confirmPendingAction() {
    if (!reasonInput.trim()) {
      setReasonError("Informe o motivo da alteração.");
      return;
    }
    const { type, index } = pendingAction;
    const arr = [...dataRef.current.queues[modality]];
    const person = arr[index];

    if (type === "up" || type === "down") {
      const target = type === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
      next = pushLog(
        next,
        `${person.full} saiu da posição ${index + 1} para a posição ${target + 1}`,
        reasonInput.trim()
      );
      persist(next);
    } else if (type === "remove") {
      arr.splice(index, 1);
      let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
      next = pushLog(next, `${person.full} foi removido da fila (posição ${index + 1})`, reasonInput.trim());
      persist(next);
    }

    setPendingAction(null);
    setReasonInput("");
  }

  function callMember(index) {
    const person = dataRef.current.queues[modality][index];
    let next = pushLog(dataRef.current, `${person.full} foi chamado para vaga disponível`, "Chamada de vaga disponível");
    persist(next);
  }

  function addMember() {
    if (!newMember.full.trim() || !newMember.matricula.trim()) return;
    const arr = [
      ...dataRef.current.queues[modality],
      { id: "m" + Date.now(), full: newMember.full.trim(), matricula: newMember.matricula.trim(), phone: newMember.phone.trim(), joinedAt: new Date().toISOString().slice(0, 10) },
    ];
    let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
    next = pushLog(next, `${newMember.full.trim()} entrou na fila na posição ${arr.length}`, "Nova inscrição na fila");
    persist(next);
    setNewMember({ full: "", matricula: "", phone: "" });
    setShowAddForm(false);
  }

  async function tryLogin() {
    setPwError("");
    if (!emailInput.trim() || !pwInput) {
      setPwError("Informe e-mail e senha.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: pwInput,
    });
    setAuthLoading(false);
    if (error) {
      setPwError("E-mail ou senha incorretos.");
      return;
    }
    setShowLoginModal(false);
    setEmailInput("");
    setPwInput("");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const queue = data?.queues?.[modality] || [];
  const currentModLabel = MODALIDADES.find((m) => m.id === modality)?.label;
  const isAdmin = !!session;
  const adminName = session?.user?.email || "";

  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((p) => p.full.toLowerCase().includes(q) || p.matricula.includes(q));
  }, [queue, queueSearch]);

  const visibleQueue = filteredQueue.slice(0, visibleCount);

  const allLogs = data?.logs || [];
  const filteredLogs = useMemo(() => {
    let list = allLogs;
    if (logModalityFilter !== "todas") list = list.filter((l) => l.modality === logModalityFilter);
    const q = logSearch.trim().toLowerCase();
    if (q) list = list.filter((l) => l.text.toLowerCase().includes(q) || (l.reason || "").toLowerCase().includes(q) || l.by.toLowerCase().includes(q));
    return list;
  }, [allLogs, logModalityFilter, logSearch]);

  const modalityLogsPreview = allLogs.filter((l) => l.modality === modality).slice(0, 5);
  const visibleLogs = filteredLogs.slice(0, logVisibleCount);

  if (loading || !data) {
    return (
      <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#5B6B7A", fontFamily: "system-ui, sans-serif" }}>
        Carregando fila...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#F4F7FA", minHeight: "600px", borderRadius: "16px", overflow: "hidden", border: "1px solid #D7E2EC" }}>
      <style>{`
        .fc-btn { font-family: system-ui, sans-serif; border: 1px solid #C3D3E0; background: #fff; border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background .15s; color: #10314F; }
        .fc-btn:hover { background: #EAF1F8; }
        .fc-btn:active { transform: scale(0.98); }
        .fc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .fc-btn-primary { background: #0F3D63; color: #fff; border-color: #0F3D63; }
        .fc-btn-primary:hover { background: #0B2E4C; }
        .fc-btn-danger { color: #A32D2D; border-color: #E3B9B9; }
        .fc-btn-danger:hover { background: #FBEAEA; }
        .fc-input { font-family: system-ui, sans-serif; border: 1px solid #C3D3E0; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%; box-sizing: border-box; }
        .fc-input:focus { outline: 2px solid #3C7FB1; outline-offset: 1px; }
        .fc-tab { font-family: system-ui, sans-serif; font-size: 13px; padding: 8px 16px; border-radius: 999px; border: 1px solid transparent; cursor: pointer; color: #5B6B7A; background: transparent; }
        .fc-tab-active { background: #0F3D63; color: #fff; }
        .fc-select { font-family: system-ui, sans-serif; border: 1px solid #C3D3E0; border-radius: 6px; padding: 7px 10px; font-size: 13px; background: #fff; color: #10314F; }
        @media (max-width: 480px) { .fc-hide-mobile { display: none; } }
      `}</style>

      <div style={{ background: "#0F3D63", color: "#fff", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#9FC6E8", margin: "0 0 4px", fontFamily: "system-ui, sans-serif" }}>
              Country Clube
            </p>
            <h1 style={{ fontSize: "24px", fontWeight: "500", margin: 0 }}>
              {showLogsView ? "Histórico de alterações" : "Fila de espera — atividades esportivas"}
            </h1>
          </div>
          <div style={{ fontFamily: "system-ui, sans-serif" }}>
            {isAdmin ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "#CFE3F2", display: "flex", alignItems: "center", gap: "5px" }}>
                  <ShieldCheck size={14} aria-hidden="true" /> {adminName} (administração)
                </span>
                <button className="fc-btn" onClick={logout}>Sair</button>
              </div>
            ) : (
              <button className="fc-btn" onClick={() => setShowLoginModal(true)}>
                <Lock size={14} aria-hidden="true" /> Entrar como administração
              </button>
            )}
          </div>
        </div>
      </div>

      {showLogsView ? (
        <div style={{ padding: "20px 24px 24px" }}>
          <button className="fc-btn" style={{ marginBottom: "16px" }} onClick={() => setShowLogsView(false)}>
            <ArrowLeft size={14} aria-hidden="true" /> Voltar para a fila
          </button>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            <select className="fc-select" value={logModalityFilter} onChange={(e) => { setLogModalityFilter(e.target.value); setLogVisibleCount(LOG_PAGE_SIZE); }}>
              <option value="todas">Todas as modalidades</option>
              {MODALIDADES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search size={14} aria-hidden="true" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8FA1B0" }} />
              <input
                className="fc-input"
                style={{ paddingLeft: "30px" }}
                placeholder="Buscar por nome, motivo ou responsável"
                value={logSearch}
                onChange={(e) => { setLogSearch(e.target.value); setLogVisibleCount(LOG_PAGE_SIZE); }}
              />
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#5B6B7A", margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>
            {filteredLogs.length} {filteredLogs.length === 1 ? "registro encontrado" : "registros encontrados"}
          </p>

          <div style={{ background: "#fff", border: "1px solid #D7E2EC", borderRadius: "12px", padding: "4px 16px" }}>
            {visibleLogs.length === 0 && (
              <p style={{ padding: "20px 0", fontSize: "13px", color: "#8FA1B0", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
                Nenhum registro encontrado para esse filtro.
              </p>
            )}
            {visibleLogs.map((l, i) => (
              <div key={l.id} style={{ padding: "12px 0", borderBottom: i < visibleLogs.length - 1 ? "1px solid #EAF0F5" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ color: "#10314F", fontWeight: "500" }}>{l.text}</span>
                  <span style={{ color: "#8FA1B0", fontSize: "12px" }}>{MODALIDADES.find((m) => m.id === l.modality)?.label}</span>
                </div>
                {l.reason && <p style={{ margin: "4px 0 0", color: "#5B6B7A" }}>Motivo: {l.reason}</p>}
                <p style={{ margin: "4px 0 0", color: "#8FA1B0", fontSize: "12px" }}>{formatLogTime(l.ts)} · {l.by}</p>
              </div>
            ))}
          </div>

          {visibleLogs.length < filteredLogs.length && (
            <button className="fc-btn" style={{ marginTop: "12px" }} onClick={() => setLogVisibleCount((c) => c + LOG_PAGE_SIZE)}>
              Carregar mais {Math.min(LOG_PAGE_SIZE, filteredLogs.length - visibleLogs.length)}
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ padding: "20px 24px 4px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {MODALIDADES.map((m) => (
              <button
                key={m.id}
                className={`fc-tab ${modality === m.id ? "fc-tab-active" : ""}`}
                onClick={() => setModality(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <p style={{ fontSize: "13px", color: "#5B6B7A", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
              {isAdmin ? <Unlock size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              {isAdmin ? "Modo administração — você pode reordenar, chamar e remover sócios" : "Modo consulta — visível a qualquer sócio"}
            </p>
            <p style={{ fontSize: "13px", color: "#5B6B7A", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={14} aria-hidden="true" /> {queue.length} na fila de {currentModLabel}
            </p>
          </div>

          {saveError && (
            <div style={{ margin: "0 24px 12px", padding: "8px 12px", background: "#FBEAEA", color: "#A32D2D", borderRadius: "6px", fontSize: "12px", fontFamily: "system-ui, sans-serif" }}>
              Não foi possível salvar a última alteração. Verifique a conexão e tente novamente.
            </div>
          )}

          <div style={{ margin: "0 24px 12px", position: "relative" }}>
            <Search size={14} aria-hidden="true" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8FA1B0" }} />
            <input
              className="fc-input"
              style={{ paddingLeft: "30px" }}
              placeholder="Buscar por nome ou matrícula"
              value={queueSearch}
              onChange={(e) => { setQueueSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            />
          </div>

          <div style={{ margin: "0 24px", background: "#fff", border: "1px solid #D7E2EC", borderRadius: "12px", overflow: "hidden" }}>
            {filteredQueue.length === 0 && (
              <p style={{ padding: "24px", textAlign: "center", color: "#8FA1B0", fontSize: "14px", fontFamily: "system-ui, sans-serif" }}>
                {queueSearch ? "Nenhum resultado para essa busca." : `Nenhum sócio na fila de ${currentModLabel} no momento.`}
              </p>
            )}
            {visibleQueue.map((p) => {
              const i = queue.findIndex((x) => x.id === p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 16px",
                    borderBottom: "1px solid #EAF0F5",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#E3EEF7", color: "#0F3D63", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#10314F" }}>
                      {isAdmin ? p.full : maskName(p.full)}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#8FA1B0" }}>
                      {isAdmin ? `Matrícula ${p.matricula} · desde ${formatDate(p.joinedAt)}` : `Na fila desde ${formatDate(p.joinedAt)}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => openReasonModal("up", i)} disabled={i === 0} aria-label="Subir posição">
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => openReasonModal("down", i)} disabled={i === queue.length - 1} aria-label="Descer posição">
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      <button className="fc-btn fc-hide-mobile" onClick={() => callMember(i)}>
                        <PhoneCall size={14} aria-hidden="true" /> Chamar
                      </button>
                      <button className="fc-btn fc-btn-danger" style={{ padding: "6px 8px" }} onClick={() => setConfirmRemove(i)} aria-label="Remover da fila">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {visibleQueue.length < filteredQueue.length && (
            <div style={{ margin: "12px 24px 0" }}>
              <button className="fc-btn" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Mostrar mais {Math.min(PAGE_SIZE, filteredQueue.length - visibleQueue.length)}
              </button>
            </div>
          )}

          {isAdmin && (
            <div style={{ margin: "12px 24px 0" }}>
              {!showAddForm ? (
                <button className="fc-btn" onClick={() => setShowAddForm(true)}>
                  <Plus size={14} aria-hidden="true" /> Adicionar sócio à fila de {currentModLabel}
                </button>
              ) : (
                <div style={{ background: "#fff", border: "1px solid #D7E2EC", borderRadius: "12px", padding: "14px 16px", fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                    <input className="fc-input" placeholder="Nome completo" value={newMember.full} onChange={(e) => setNewMember({ ...newMember, full: e.target.value })} />
                    <input className="fc-input" placeholder="Matrícula" value={newMember.matricula} onChange={(e) => setNewMember({ ...newMember, matricula: e.target.value })} />
                    <input className="fc-input" placeholder="Telefone" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="fc-btn fc-btn-primary" onClick={addMember}>Adicionar ao fim da fila</button>
                    <button className="fc-btn" onClick={() => setShowAddForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ margin: "20px 24px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <p style={{ fontSize: "12px", color: "#5B6B7A", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
                <History size={14} aria-hidden="true" /> Últimas alterações — {currentModLabel}
              </p>
              <button
                className="fc-btn"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={() => { setShowLogsView(true); setLogModalityFilter(modality); setLogSearch(""); setLogVisibleCount(LOG_PAGE_SIZE); }}
              >
                Ver histórico completo
              </button>
            </div>
            <div style={{ background: "#fff", border: "1px solid #D7E2EC", borderRadius: "12px", padding: "4px 16px" }}>
              {modalityLogsPreview.length === 0 && (
                <p style={{ padding: "14px 0", fontSize: "13px", color: "#8FA1B0", fontFamily: "system-ui, sans-serif" }}>Nenhuma alteração registrada ainda.</p>
              )}
              {modalityLogsPreview.map((l, i) => (
                <div key={l.id} style={{ padding: "10px 0", borderBottom: i < modalityLogsPreview.length - 1 ? "1px solid #EAF0F5" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px" }}>
                  <span style={{ color: "#10314F" }}>{l.text}</span>
                  <span style={{ color: "#8FA1B0" }}> · {formatLogTime(l.ts)} · {l.by}</span>
                  {l.reason && <p style={{ margin: "2px 0 0", color: "#8FA1B0", fontSize: "12px" }}>Motivo: {l.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showLoginModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(340px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "500" }}>Acesso da administração</p>
              <button className="fc-btn" style={{ padding: "4px 6px" }} onClick={() => { setShowLoginModal(false); setPwError(""); }} aria-label="Fechar">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <label style={{ fontSize: "12px", color: "#5B6B7A", display: "block", marginBottom: "4px" }}>E-mail</label>
            <input className="fc-input" style={{ marginBottom: "10px" }} type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="secretaria@countryclube.com.br" />
            <label style={{ fontSize: "12px", color: "#5B6B7A", display: "block", marginBottom: "4px" }}>Senha</label>
            <input className="fc-input" style={{ marginBottom: "6px" }} type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="Sua senha" />
            {pwError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{pwError}</p>}
            <button className="fc-btn fc-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} onClick={tryLogin} disabled={authLoading}>
              {authLoading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </div>
      )}

      {pendingAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(380px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "500" }}>
              {pendingAction.type === "up" && "Subir posição"}
              {pendingAction.type === "down" && "Descer posição"}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#5B6B7A" }}>
              {queue[pendingAction.index]?.full} — informe o motivo dessa alteração para ficar registrado no log.
            </p>
            <textarea
              className="fc-input"
              rows={3}
              style={{ resize: "vertical", marginBottom: "6px" }}
              placeholder="Ex: vaga liberada por desistência de outro sócio"
              value={reasonInput}
              onChange={(e) => { setReasonInput(e.target.value); setReasonError(""); }}
            />
            {reasonError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{reasonError}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button className="fc-btn fc-btn-primary" onClick={confirmPendingAction}>Confirmar</button>
              <button className="fc-btn" onClick={() => setPendingAction(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(380px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "500" }}>Remover da fila?</p>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#5B6B7A" }}>
              {queue[confirmRemove]?.full} sairá da fila de {currentModLabel}. Informe o motivo — essa ação fica registrada no log.
            </p>
            <textarea
              className="fc-input"
              rows={3}
              style={{ resize: "vertical", marginBottom: "6px" }}
              placeholder="Ex: sócio desistiu da atividade"
              value={reasonInput}
              onChange={(e) => { setReasonInput(e.target.value); setReasonError(""); }}
            />
            {reasonError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{reasonError}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button
                className="fc-btn fc-btn-danger"
                onClick={() => {
                  if (!reasonInput.trim()) {
                    setReasonError("Informe o motivo da remoção.");
                    return;
                  }
                  const index = confirmRemove;
                  const arr = [...dataRef.current.queues[modality]];
                  const person = arr[index];
                  arr.splice(index, 1);
                  let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
                  next = pushLog(next, `${person.full} foi removido da fila (posição ${index + 1})`, reasonInput.trim());
                  persist(next);
                  setConfirmRemove(null);
                  setReasonInput("");
                }}
              >
                Remover
              </button>
              <button className="fc-btn" onClick={() => { setConfirmRemove(null); setReasonInput(""); setReasonError(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
