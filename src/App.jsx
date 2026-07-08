import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, PhoneCall, Trash2, Plus, Lock, Unlock, History, Eye, ShieldCheck, X, Users } from "lucide-react";
import { storage } from "./storage.js";

const STORAGE_KEY = "fila-clube-data";
const ADMIN_PASSWORD = "secretaria123";

const MODALIDADES = [
  { id: "tenis", label: "Tênis" },
  { id: "squash", label: "Squash" },
  { id: "golfe", label: "Golfe" },
  { id: "natacao", label: "Natação" },
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
    squash: [
      { id: "s1", full: "Bianca Ramos", matricula: "1145", phone: "(19) 99111-2222", joinedAt: "2026-01-18" },
      { id: "s2", full: "Diego Lima", matricula: "4488", phone: "(19) 99222-3333", joinedAt: "2026-02-27" },
      { id: "s3", full: "Fernanda Klein", matricula: "3390", phone: "(19) 99333-4444", joinedAt: "2026-04-09" },
    ],
    golfe: [
      { id: "g1", full: "Roberto Villela", matricula: "2001", phone: "(19) 99444-5555", joinedAt: "2025-11-30" },
      { id: "g2", full: "Simone Prado", matricula: "5540", phone: "(19) 99555-6666", joinedAt: "2026-01-22" },
      { id: "g3", full: "André Castro", matricula: "1980", phone: "(19) 99666-7777", joinedAt: "2026-03-15" },
      { id: "g4", full: "Helena Gaspar", matricula: "6602", phone: "(19) 99777-8888", joinedAt: "2026-05-01" },
    ],
    natacao: [],
  },
  logs: [
    { id: "l1", ts: Date.now() - 86400000 * 2, modality: "tenis", text: "Renata Souza saiu da posição 8 para a posição 2", by: "Secretaria" },
    { id: "l2", ts: Date.now() - 86400000 * 3, modality: "squash", text: "Diego Lima foi chamado para vaga disponível", by: "Secretaria" },
    { id: "l3", ts: Date.now() - 86400000 * 5, modality: "golfe", text: "André Castro entrou na fila na posição 4", by: "Secretaria" },
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ full: "", matricula: "", phone: "" });
  const [confirmRemove, setConfirmRemove] = useState(null);
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

  function addLog(text) {
    const next = {
      ...dataRef.current,
      logs: [
        { id: "l" + Date.now(), ts: Date.now(), modality, text, by: adminName || "Secretaria" },
        ...dataRef.current.logs,
      ].slice(0, 40),
    };
    return next;
  }

  function move(index, dir) {
    const arr = [...dataRef.current.queues[modality]];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    const person = arr[index];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
    next = {
      ...next,
      logs: [
        {
          id: "l" + Date.now(),
          ts: Date.now(),
          modality,
          text: `${person.full} saiu da posição ${index + 1} para a posição ${target + 1}`,
          by: adminName || "Secretaria",
        },
        ...next.logs,
      ].slice(0, 40),
    };
    persist(next);
  }

  function callMember(index) {
    const person = dataRef.current.queues[modality][index];
    let next = { ...dataRef.current };
    next = { ...next, logs: [{ id: "l" + Date.now(), ts: Date.now(), modality, text: `${person.full} foi chamado para vaga disponível`, by: adminName || "Secretaria" }, ...next.logs].slice(0, 40) };
    persist(next);
  }

  function removeMember(index) {
    const arr = [...dataRef.current.queues[modality]];
    const person = arr[index];
    arr.splice(index, 1);
    let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
    next = { ...next, logs: [{ id: "l" + Date.now(), ts: Date.now(), modality, text: `${person.full} foi removido da fila (posição ${index + 1})`, by: adminName || "Secretaria" }, ...next.logs].slice(0, 40) };
    persist(next);
    setConfirmRemove(null);
  }

  function addMember() {
    if (!newMember.full.trim() || !newMember.matricula.trim()) return;
    const arr = [...dataRef.current.queues[modality], { id: "m" + Date.now(), full: newMember.full.trim(), matricula: newMember.matricula.trim(), phone: newMember.phone.trim(), joinedAt: new Date().toISOString().slice(0, 10) }];
    let next = { ...dataRef.current, queues: { ...dataRef.current.queues, [modality]: arr } };
    next = { ...next, logs: [{ id: "l" + Date.now(), ts: Date.now(), modality, text: `${newMember.full.trim()} entrou na fila na posição ${arr.length}`, by: adminName || "Secretaria" }, ...next.logs].slice(0, 40) };
    persist(next);
    setNewMember({ full: "", matricula: "", phone: "" });
    setShowAddForm(false);
  }

  function tryLogin() {
    if (pwInput === ADMIN_PASSWORD && nameInput.trim()) {
      setIsAdmin(true);
      setAdminName(nameInput.trim());
      setShowLoginModal(false);
      setPwInput("");
      setPwError("");
    } else if (!nameInput.trim()) {
      setPwError("Informe seu nome para identificação no log.");
    } else {
      setPwError("Senha incorreta.");
    }
  }

  function logout() {
    setIsAdmin(false);
    setAdminName("");
  }

  if (loading || !data) {
    return (
      <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#6b6b63", fontFamily: "system-ui, sans-serif" }}>
        Carregando fila...
      </div>
    );
  }

  const queue = data.queues[modality] || [];
  const modalityLogs = data.logs.filter((l) => l.modality === modality).slice(0, 8);
  const currentModLabel = MODALIDADES.find((m) => m.id === modality)?.label;

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#F7F5EF", minHeight: "600px", borderRadius: "16px", overflow: "hidden", border: "1px solid #E2DFD3" }}>
      <style>{`
        .fc-btn { font-family: system-ui, sans-serif; border: 1px solid #C9C4B2; background: #fff; border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background .15s; color: #2B3D2F; }
        .fc-btn:hover { background: #F0EEE4; }
        .fc-btn:active { transform: scale(0.98); }
        .fc-btn-primary { background: #2B3D2F; color: #F7F5EF; border-color: #2B3D2F; }
        .fc-btn-primary:hover { background: #1F2E22; }
        .fc-btn-danger { color: #8A2E22; border-color: #D9B9AF; }
        .fc-btn-danger:hover { background: #F7EAE6; }
        .fc-input { font-family: system-ui, sans-serif; border: 1px solid #C9C4B2; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%; box-sizing: border-box; }
        .fc-input:focus { outline: 2px solid #B08A3C; outline-offset: 1px; }
        .fc-tab { font-family: system-ui, sans-serif; font-size: 13px; padding: 8px 16px; border-radius: 999px; border: 1px solid transparent; cursor: pointer; color: #6b6b63; background: transparent; }
        .fc-tab-active { background: #2B3D2F; color: #F7F5EF; }
        @media (max-width: 480px) { .fc-hide-mobile { display: none; } }
      `}</style>

      <div style={{ background: "#2B3D2F", color: "#F7F5EF", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#B08A3C", margin: "0 0 4px", fontFamily: "system-ui, sans-serif" }}>
              Country Clube
            </p>
            <h1 style={{ fontSize: "24px", fontWeight: "500", margin: 0 }}>Fila de espera — atividades esportivas</h1>
          </div>
          <div style={{ fontFamily: "system-ui, sans-serif" }}>
            {isAdmin ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "#D8CFA8", display: "flex", alignItems: "center", gap: "5px" }}>
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
        <p style={{ fontSize: "13px", color: "#6b6b63", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
          {isAdmin ? <Unlock size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {isAdmin ? "Modo administração — você pode reordenar, chamar e remover sócios" : "Modo consulta — visível a qualquer sócio"}
        </p>
        <p style={{ fontSize: "13px", color: "#6b6b63", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
          <Users size={14} aria-hidden="true" /> {queue.length} na fila de {currentModLabel}
        </p>
      </div>

      {saveError && (
        <div style={{ margin: "0 24px 12px", padding: "8px 12px", background: "#F7EAE6", color: "#8A2E22", borderRadius: "6px", fontSize: "12px", fontFamily: "system-ui, sans-serif" }}>
          Não foi possível salvar a última alteração. Verifique a conexão e tente novamente.
        </div>
      )}

      <div style={{ margin: "0 24px", background: "#fff", border: "1px solid #E2DFD3", borderRadius: "12px", overflow: "hidden" }}>
        {queue.length === 0 && (
          <p style={{ padding: "24px", textAlign: "center", color: "#9b9789", fontSize: "14px", fontFamily: "system-ui, sans-serif" }}>
            Nenhum sócio na fila de {currentModLabel} no momento.
          </p>
        )}
        {queue.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "12px 16px",
              borderBottom: i < queue.length - 1 ? "1px solid #EDEAE0" : "none",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#EFE7CE", color: "#8A6D1F", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#2B2B26" }}>
                {isAdmin ? p.full : maskName(p.full)}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#9b9789" }}>
                {isAdmin ? `Matrícula ${p.matricula} · desde ${formatDate(p.joinedAt)}` : `Na fila desde ${formatDate(p.joinedAt)}`}
              </p>
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir posição">
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => move(i, 1)} disabled={i === queue.length - 1} aria-label="Descer posição">
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
        ))}
      </div>

      {isAdmin && (
        <div style={{ margin: "12px 24px 0" }}>
          {!showAddForm ? (
            <button className="fc-btn" onClick={() => setShowAddForm(true)}>
              <Plus size={14} aria-hidden="true" /> Adicionar sócio à fila de {currentModLabel}
            </button>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E2DFD3", borderRadius: "12px", padding: "14px 16px", fontFamily: "system-ui, sans-serif" }}>
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
        <p style={{ fontSize: "12px", color: "#9b9789", margin: "0 0 8px", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
          <History size={14} aria-hidden="true" /> Log de alterações — {currentModLabel}
        </p>
        <div style={{ background: "#fff", border: "1px solid #E2DFD3", borderRadius: "12px", padding: "4px 16px" }}>
          {modalityLogs.length === 0 && (
            <p style={{ padding: "14px 0", fontSize: "13px", color: "#9b9789", fontFamily: "system-ui, sans-serif" }}>Nenhuma alteração registrada ainda.</p>
          )}
          {modalityLogs.map((l, i) => (
            <div key={l.id} style={{ padding: "10px 0", borderBottom: i < modalityLogs.length - 1 ? "1px solid #EDEAE0" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px" }}>
              <span style={{ color: "#2B2B26" }}>{l.text}</span>
              <span style={{ color: "#9b9789" }}> · {formatLogTime(l.ts)} · {l.by}</span>
            </div>
          ))}
        </div>
      </div>

      {showLoginModal && (
        <div style={{ position: "static", minHeight: "420px", background: "rgba(43,61,47,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(340px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "500" }}>Acesso da administração</p>
              <button className="fc-btn" style={{ padding: "4px 6px" }} onClick={() => { setShowLoginModal(false); setPwError(""); }} aria-label="Fechar">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <label style={{ fontSize: "12px", color: "#6b6b63", display: "block", marginBottom: "4px" }}>Seu nome (aparece no log)</label>
            <input className="fc-input" style={{ marginBottom: "10px" }} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nome da secretaria" />
            <label style={{ fontSize: "12px", color: "#6b6b63", display: "block", marginBottom: "4px" }}>Senha</label>
            <input className="fc-input" style={{ marginBottom: "6px" }} type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="Senha de administração" />
            {pwError && <p style={{ fontSize: "12px", color: "#8A2E22", margin: "0 0 10px" }}>{pwError}</p>}
            <button className="fc-btn fc-btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} onClick={tryLogin}>Entrar</button>
          </div>
        </div>
      )}

      {confirmRemove !== null && (
        <div style={{ position: "static", minHeight: "420px", background: "rgba(43,61,47,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(360px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "500" }}>Remover da fila?</p>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b6b63" }}>
              {queue[confirmRemove]?.full} sairá da fila de {currentModLabel}. Essa ação fica registrada no log.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="fc-btn fc-btn-danger" onClick={() => removeMember(confirmRemove)}>Remover</button>
              <button className="fc-btn" onClick={() => setConfirmRemove(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
