import { useState, useEffect, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  Megaphone,
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
  UserCheck,
  UserX,
  Clock,
  Settings,
  MessageCircle,
  Sunrise,
  Sun,
  Moon,
  CalendarDays,
  Filter,
  Pencil,
  LayoutDashboard,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { supabase, db } from "./storage.js";

const PAGE_SIZE = 30;
const LOG_PAGE_SIZE = 30;
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos sem atividade
const ALERT_THRESHOLD_HOURS = 48;
const SEARCH_DEBOUNCE_MS = 350;

const NIVEIS = [
  { id: "iniciante", label: "Iniciante", bg: "#E3F3EA", fg: "#1F7A45" },
  { id: "intermediario", label: "Intermediário", bg: "#E3EEF7", fg: "#0F3D63" },
  { id: "avancado", label: "Avançado", bg: "#F1E9F7", fg: "#6B3FA0" },
];

const HORARIOS = [
  { id: "manha", label: "Manhã", Icon: Sunrise },
  { id: "tarde", label: "Tarde", Icon: Sun },
  { id: "noite", label: "Noite", Icon: Moon },
  { id: "fds", label: "Fim de semana", Icon: CalendarDays },
];

const FAIXAS_ETARIAS = [
  { id: "crianca", label: "Criança", bg: "#FDE8E8", fg: "#B03A3A" },
  { id: "adulto", label: "Adulto", bg: "#E7F0EA", fg: "#2E6B47" },
  { id: "idoso", label: "Idoso", bg: "#EEE7F7", fg: "#5B3F8C" },
];

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatDate(iso) {
  if (!iso) return "—";
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

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function whatsappLink(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

export default function FilaClube() {
  // ---------------------------------------------------------------------
  // Autenticação
  // ---------------------------------------------------------------------
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [idleLogoutMessage, setIdleLogoutMessage] = useState(false);
  const idleTimerRef = useRef(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const isAdmin = !!session;
  const adminName = session?.user?.email || "";

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
    if (!session) return;
    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
        setIdleLogoutMessage(true);
      }, IDLE_TIMEOUT_MS);
    }
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [session]);

  async function tryLogin() {
    setPwError("");
    if (!emailInput.trim() || !pwInput) {
      setPwError("Informe e-mail e senha.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput.trim(), password: pwInput });
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

  // ---------------------------------------------------------------------
  // Modalidades
  // ---------------------------------------------------------------------
  const [modalidades, setModalidades] = useState([]);
  const [modality, setModality] = useState("");
  const [loading, setLoading] = useState(true);

  async function reloadModalidades(preferId) {
    const mods = await db.getModalidades();
    setModalidades(mods);
    setModality((prev) => {
      if (preferId) return preferId;
      if (prev && mods.some((m) => m.id === prev)) return prev;
      const firstActive = mods.find((m) => !m.archived);
      return firstActive ? firstActive.id : mods[0]?.id || "";
    });
    return mods;
  }

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      try {
        await reloadModalidades();
      } catch (e) {
        console.error("Erro ao carregar modalidades:", e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  const activeModalidades = modalidades.filter((m) => !m.archived);
  const currentModLabel = modalidades.find((m) => m.id === modality)?.label || "";

  // ---------------------------------------------------------------------
  // Fila — filtros, busca e paginação (feitos pelo banco)
  // ---------------------------------------------------------------------
  const [queueSearchInput, setQueueSearchInput] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterHorarios, setFilterHorarios] = useState([]);
  const [filterFaixaEtaria, setFilterFaixaEtaria] = useState("");
  const [showVagaFilters, setShowVagaFilters] = useState(false);

  const [queueRows, setQueueRows] = useState([]);
  const [queueTotalCount, setQueueTotalCount] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueLoadingMore, setQueueLoadingMore] = useState(false);
  const [nextCallableId, setNextCallableId] = useState(null);
  const [queueError, setQueueError] = useState(false);

  const isFilteringForVaga = !!filterLevel || filterHorarios.length > 0 || !!filterFaixaEtaria;
  const hasAnyFilterActive = isFilteringForVaga || !!queueSearchInput.trim();

  function clearAllFilters() {
    setQueueSearchInput("");
    setFilterLevel("");
    setFilterHorarios([]);
    setFilterFaixaEtaria("");
  }
  const vagaFilters = { level: filterLevel, horarios: filterHorarios, faixaEtaria: filterFaixaEtaria };

  useEffect(() => {
    const t = setTimeout(() => setQueueSearch(queueSearchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [queueSearchInput]);

  useEffect(() => {
    setQueueSearchInput("");
    setQueueSearch("");
    setFilterLevel("");
    setFilterHorarios([]);
    setFilterFaixaEtaria("");
    setShowVagaFilters(false);
  }, [modality]);

  async function loadFirstPage() {
    if (!modality) return;
    setQueueLoading(true);
    setQueueError(false);
    try {
      const { rows, count } = await db.getQueuePage({
        modalidadeId: modality,
        isAdmin,
        offset: 0,
        limit: PAGE_SIZE,
        search: queueSearch,
        filters: vagaFilters,
      });
      setQueueRows(rows);
      setQueueTotalCount(count);
      if (isAdmin) {
        const nextId = await db.getNextCallableId(modality, vagaFilters).catch(() => null);
        setNextCallableId(nextId);
      } else {
        setNextCallableId(null);
      }
    } catch (e) {
      console.error("Erro ao carregar fila:", e);
      setQueueRows([]);
      setQueueTotalCount(0);
      setQueueError(true);
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    if (!authChecked || !modality) return;
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, modality, isAdmin, filterLevel, filterHorarios, filterFaixaEtaria, queueSearch]);

  async function loadMoreQueue() {
    setQueueLoadingMore(true);
    try {
      const { rows } = await db.getQueuePage({
        modalidadeId: modality,
        isAdmin,
        offset: queueRows.length,
        limit: PAGE_SIZE,
        search: queueSearch,
        filters: vagaFilters,
      });
      setQueueRows((prev) => [...prev, ...rows]);
    } catch (e) {
      console.error("Erro ao carregar mais sócios:", e);
    } finally {
      setQueueLoadingMore(false);
    }
  }

  async function refreshQueue() {
    const currentLen = Math.max(queueRows.length, PAGE_SIZE);
    try {
      const { rows, count } = await db.getQueuePage({
        modalidadeId: modality,
        isAdmin,
        offset: 0,
        limit: currentLen,
        search: queueSearch,
        filters: vagaFilters,
      });
      setQueueRows(rows);
      setQueueTotalCount(count);
      if (isAdmin) {
        const nextId = await db.getNextCallableId(modality, vagaFilters).catch(() => null);
        setNextCallableId(nextId);
      }
    } catch (e) {
      console.error("Erro ao atualizar fila:", e);
    }
  }

  // ---------------------------------------------------------------------
  // Log — resumo (preview) e tela completa
  // ---------------------------------------------------------------------
  const [modalityLogsPreview, setModalityLogsPreview] = useState([]);
  const [showLogsView, setShowLogsView] = useState(false);
  const [logModalityFilter, setLogModalityFilter] = useState("todas");
  const [logSearchInput, setLogSearchInput] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logRows, setLogRows] = useState([]);
  const [logTotalCount, setLogTotalCount] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logLoadingMore, setLogLoadingMore] = useState(false);
  const [expandedLogDetails, setExpandedLogDetails] = useState({});

  async function refreshRecentLogs() {
    if (!isAdmin || !modality) return;
    try {
      const rows = await db.getRecentLogs(modality, 5);
      setModalityLogsPreview(rows);
    } catch (e) {
      console.error("Erro ao carregar histórico recente:", e);
    }
  }

  useEffect(() => {
    refreshRecentLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modality, isAdmin]);

  useEffect(() => {
    const t = setTimeout(() => setLogSearch(logSearchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [logSearchInput]);

  async function loadFirstLogPage() {
    setLogLoading(true);
    try {
      const { rows, count } = await db.getLogsPage({
        modalidadeId: logModalityFilter,
        search: logSearch,
        offset: 0,
        limit: LOG_PAGE_SIZE,
      });
      setLogRows(rows);
      setLogTotalCount(count);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
      setLogRows([]);
      setLogTotalCount(0);
    } finally {
      setLogLoading(false);
    }
  }

  useEffect(() => {
    if (!showLogsView) return;
    loadFirstLogPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLogsView, logModalityFilter, logSearch]);

  async function loadMoreLogs() {
    setLogLoadingMore(true);
    try {
      const { rows } = await db.getLogsPage({
        modalidadeId: logModalityFilter,
        search: logSearch,
        offset: logRows.length,
        limit: LOG_PAGE_SIZE,
      });
      setLogRows((prev) => [...prev, ...rows]);
    } catch (e) {
      console.error("Erro ao carregar mais registros:", e);
    } finally {
      setLogLoadingMore(false);
    }
  }

  function openLogsView() {
    setShowLogsView(true);
    setLogModalityFilter(modality);
    setLogSearchInput("");
    setLogSearch("");
  }

  // ---------------------------------------------------------------------
  // Estimativa de tempo de espera (beta, admin)
  // ---------------------------------------------------------------------
  const [waitEstimate, setWaitEstimate] = useState(null);

  useEffect(() => {
    if (!isAdmin || !modality) {
      setWaitEstimate(null);
      return;
    }
    (async () => {
      try {
        const events = await db.getVagaFillEvents(modality);
        if (events.length < 3) {
          setWaitEstimate(null);
          return;
        }
        const spanMs = events[events.length - 1] - events[0];
        const spanMonths = Math.max(spanMs / (1000 * 60 * 60 * 24 * 30), 1);
        const ratePerMonth = events.length / spanMonths;
        if (!ratePerMonth || !isFinite(ratePerMonth)) {
          setWaitEstimate(null);
          return;
        }
        setWaitEstimate({ count: events.length, spanMonths, ratePerMonth });
      } catch (e) {
        console.error("Erro ao calcular estimativa:", e);
        setWaitEstimate(null);
      }
    })();
  }, [isAdmin, modality]);

  function estimateRangeForPosition(pos) {
    if (!waitEstimate) return null;
    const months = pos / waitEstimate.ratePerMonth;
    const low = Math.max(1, Math.round(months * 0.7));
    const high = Math.max(low + 1, Math.round(months * 1.4));
    return { low, high };
  }

  // ---------------------------------------------------------------------
  // Painel geral
  // ---------------------------------------------------------------------
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    if (!showDashboard) return;
    (async () => {
      setDashboardLoading(true);
      try {
        const stats = await db.getDashboardStats(activeModalidades);
        setDashboardStats(stats);
      } catch (e) {
        console.error("Erro ao carregar painel:", e);
      } finally {
        setDashboardLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDashboard]);

  // ---------------------------------------------------------------------
  // Menu de ferramentas / gestão de modalidades
  // ---------------------------------------------------------------------
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [showManageModalidades, setShowManageModalidades] = useState(false);
  const [newModalidadeLabel, setNewModalidadeLabel] = useState("");
  const [manageError, setManageError] = useState("");
  const [confirmRemoveModalidade, setConfirmRemoveModalidade] = useState(null);
  const [confirmClearQueue, setConfirmClearQueue] = useState(null);
  const [clearReason, setClearReason] = useState("");
  const [clearError, setClearError] = useState("");
  const [modalidadeQueueCounts, setModalidadeQueueCounts] = useState({});

  useEffect(() => {
    if (!showManageModalidades) return;
    (async () => {
      const counts = {};
      for (const m of modalidades) {
        try {
          const { count } = await supabase.from("queue_entries").select("id", { count: "exact", head: true }).eq("modalidade_id", m.id);
          counts[m.id] = count || 0;
        } catch (e) {
          counts[m.id] = 0;
        }
      }
      setModalidadeQueueCounts(counts);
    })();
  }, [showManageModalidades, modalidades]);

  async function addModalidade() {
    const label = newModalidadeLabel.trim();
    if (!label) {
      setManageError("Informe o nome da modalidade.");
      return;
    }
    const id = slugify(label);
    if (!id) {
      setManageError("Nome inválido, tente usar letras e números.");
      return;
    }
    if (modalidades.some((m) => m.id === id)) {
      setManageError("Já existe uma modalidade com esse nome (ativa ou arquivada).");
      return;
    }
    try {
      await db.addModalidade(id, label);
      await db.addLog({ modalidadeId: id, text: `Modalidade "${label}" foi criada`, reason: "Nova modalidade adicionada pela administração", by: adminName });
      setNewModalidadeLabel("");
      setManageError("");
      await reloadModalidades(id);
    } catch (e) {
      console.error(e);
      setManageError("Erro ao criar a modalidade. Tente novamente.");
    }
  }

  async function removeModalidade(id) {
    const item = modalidades.find((m) => m.id === id);
    const label = item?.label || id;
    try {
      const count = modalidadeQueueCounts[id] || 0;
      if (count > 0) {
        setManageError(`Não é possível remover "${label}" com sócios na fila (${count}). Esvazie a fila primeiro.`);
        return;
      }
      await db.setModalidadeArchived(id, true);
      await db.addLog({
        modalidadeId: id,
        text: `Modalidade "${label}" foi arquivada (some das abas, mas continua filtrável no histórico)`,
        reason: "Modalidade arquivada pela administração",
        by: adminName,
      });
      const mods = await reloadModalidades(modality === id ? null : modality);
      if (modality === id) setModality(mods.find((m) => !m.archived)?.id || "");
      setConfirmRemoveModalidade(null);
      setManageError("");
    } catch (e) {
      console.error(e);
      setManageError("Erro ao arquivar. Tente novamente.");
    }
  }

  async function restoreModalidade(id) {
    const item = modalidades.find((m) => m.id === id);
    const label = item?.label || id;
    try {
      await db.setModalidadeArchived(id, false);
      await db.addLog({ modalidadeId: id, text: `Modalidade "${label}" foi restaurada`, reason: "Modalidade restaurada pela administração", by: adminName });
      await reloadModalidades();
      setManageError("");
    } catch (e) {
      console.error(e);
      setManageError("Erro ao restaurar. Tente novamente.");
    }
  }

  async function clearQueueAction() {
    if (!clearReason.trim()) {
      setClearError("Informe o motivo do esvaziamento da fila.");
      return;
    }
    const targetId = confirmClearQueue;
    try {
      const removed = await db.clearQueue(targetId);
      if (removed.length > 0) {
        await db.addLog({
          modalidadeId: targetId,
          text: `${removed.length} ${removed.length === 1 ? "sócio foi removido" : "sócios foram removidos"} da fila em massa`,
          reason: clearReason.trim(),
          by: adminName,
          removedMembers: removed.map((p) => ({ full: p.full_name, matricula: p.matricula })),
        });
      }
      setConfirmClearQueue(null);
      setClearReason("");
      setClearError("");
      setModalidadeQueueCounts((prev) => ({ ...prev, [targetId]: 0 }));
      if (targetId === modality) await refreshQueue();
    } catch (e) {
      console.error(e);
      setClearError("Erro ao esvaziar. Tente novamente.");
    }
  }

  // ---------------------------------------------------------------------
  // Sócios — adicionar, editar, mover, chamar, responder, remover
  // ---------------------------------------------------------------------
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");
  const [newMember, setNewMember] = useState({ full: "", matricula: "", phone: "", level: "", availability: [], faixaEtaria: "" });

  async function addMember() {
    const missing = [];
    if (!newMember.full.trim()) missing.push("nome completo");
    if (!newMember.matricula.trim()) missing.push("matrícula");
    if (!newMember.level) missing.push("nível");
    if (!newMember.availability || newMember.availability.length === 0) missing.push("ao menos um horário disponível");
    if (missing.length > 0) {
      setAddMemberError(`Preencha: ${missing.join(", ")}.`);
      return;
    }
    try {
      const position = await db.addQueueEntry(modality, newMember);
      await db.addLog({
        modalidadeId: modality,
        text: `${newMember.full.trim()} entrou na fila na posição ${position}`,
        reason: "Nova inscrição na fila",
        by: adminName,
      });
      setNewMember({ full: "", matricula: "", phone: "", level: "", availability: [], faixaEtaria: "" });
      setAddMemberError("");
      setShowAddForm(false);
      await refreshQueue();
      await refreshRecentLogs();
    } catch (e) {
      console.error(e);
      setAddMemberError("Erro ao salvar. Tente novamente.");
    }
  }

  const [editingEntry, setEditingEntry] = useState(null);
  const [editDraft, setEditDraft] = useState({ full: "", matricula: "", phone: "", level: "", availability: [], faixaEtaria: "" });
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");

  function openEditModal(entry) {
    setEditingEntry(entry);
    setEditDraft({
      full: entry.full_name,
      matricula: entry.matricula,
      phone: entry.phone || "",
      level: entry.level || "",
      availability: entry.availability || [],
      faixaEtaria: entry.faixa_etaria || "",
    });
    setEditReason("");
    setEditError("");
  }

  async function saveEditMember() {
    const missing = [];
    if (!editDraft.full.trim()) missing.push("nome completo");
    if (!editDraft.matricula.trim()) missing.push("matrícula");
    if (!editDraft.level) missing.push("nível");
    if (!editDraft.availability || editDraft.availability.length === 0) missing.push("ao menos um horário disponível");
    if (missing.length > 0) {
      setEditError(`Preencha: ${missing.join(", ")}.`);
      return;
    }
    if (!editReason.trim()) {
      setEditError("Informe o motivo da alteração.");
      return;
    }

    const old = editingEntry;
    const updated = {
      full_name: editDraft.full.trim(),
      matricula: editDraft.matricula.trim(),
      phone: formatPhone(editDraft.phone || "") || null,
      level: editDraft.level || null,
      availability: editDraft.availability || [],
      faixa_etaria: editDraft.faixaEtaria || null,
    };

    const changes = [];
    if (old.full_name !== updated.full_name) changes.push(`nome alterado de "${old.full_name}" para "${updated.full_name}"`);
    if (old.matricula !== updated.matricula) changes.push(`matrícula alterada de "${old.matricula}" para "${updated.matricula}"`);
    if ((old.phone || "") !== (updated.phone || "")) {
      changes.push(`telefone alterado de "${old.phone || "não informado"}" para "${updated.phone || "não informado"}"`);
    }
    if ((old.level || "") !== (updated.level || "")) {
      const oldLabel = NIVEIS.find((n) => n.id === old.level)?.label || "não informado";
      const newLabel = NIVEIS.find((n) => n.id === updated.level)?.label || "não informado";
      changes.push(`nível alterado de "${oldLabel}" para "${newLabel}"`);
    }
    if ((old.faixa_etaria || "") !== (updated.faixa_etaria || "")) {
      const oldLabel = FAIXAS_ETARIAS.find((f) => f.id === old.faixa_etaria)?.label || "não informado";
      const newLabel = FAIXAS_ETARIAS.find((f) => f.id === updated.faixa_etaria)?.label || "não informado";
      changes.push(`faixa etária alterada de "${oldLabel}" para "${newLabel}"`);
    }
    const oldAvail = (old.availability || []).slice().sort().join(",");
    const newAvail = (updated.availability || []).slice().sort().join(",");
    if (oldAvail !== newAvail) {
      const oldLabels = (old.availability || []).map((a) => HORARIOS.find((h) => h.id === a)?.label).filter(Boolean).join(", ") || "nenhum";
      const newLabels = (updated.availability || []).map((a) => HORARIOS.find((h) => h.id === a)?.label).filter(Boolean).join(", ") || "nenhum";
      changes.push(`horários disponíveis alterados de "${oldLabels}" para "${newLabels}"`);
    }

    if (changes.length === 0) {
      setEditError("Nenhuma alteração detectada nos campos.");
      return;
    }

    try {
      await db.updateQueueEntry(old.id, updated);
      await db.addLog({
        modalidadeId: modality,
        text: `Dados de ${updated.full_name} foram atualizados: ${changes.join("; ")}`,
        reason: editReason.trim(),
        by: adminName,
      });
      setEditingEntry(null);
      setEditReason("");
      setEditError("");
      await refreshQueue();
      await refreshRecentLogs();
    } catch (e) {
      console.error(e);
      setEditError("Erro ao salvar. Tente novamente.");
    }
  }

  const [pendingAction, setPendingAction] = useState(null); // { type: 'up'|'down', entry }
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState("");

  function openReasonModal(type, entry) {
    setPendingAction({ type, entry });
    setReasonInput("");
    setReasonError("");
  }

  async function confirmPendingAction() {
    if (!reasonInput.trim()) {
      setReasonError("Informe o motivo da alteração.");
      return;
    }
    const { type, entry } = pendingAction;
    try {
      await db.moveQueueEntry(entry.id, type);
      const { data: freshRow } = await supabase.from("queue_entries").select("position").eq("id", entry.id).maybeSingle();
      if (freshRow && freshRow.position !== entry.position) {
        await db.addLog({
          modalidadeId: modality,
          text: `${entry.full_name} saiu da posição ${entry.position} para a posição ${freshRow.position}`,
          reason: reasonInput.trim(),
          by: adminName,
        });
      }
      setPendingAction(null);
      setReasonInput("");
      await refreshQueue();
      await refreshRecentLogs();
    } catch (e) {
      console.error(e);
      setReasonError("Erro ao salvar. Tente novamente.");
    }
  }

  async function handleCallMember(entry) {
    try {
      await db.callMember(entry.id);
      const filterParts = [];
      if (filterLevel) filterParts.push(NIVEIS.find((n) => n.id === filterLevel)?.label);
      if (filterHorarios.length > 0) filterParts.push(filterHorarios.map((h) => HORARIOS.find((x) => x.id === h)?.label).join(", "));
      if (filterFaixaEtaria) filterParts.push(FAIXAS_ETARIAS.find((f) => f.id === filterFaixaEtaria)?.label);
      const filterNote = filterParts.length > 0 ? ` (chamado dentro do filtro: ${filterParts.join(" · ")})` : "";
      await db.addLog({
        modalidadeId: modality,
        text: `${entry.full_name} foi chamado para vaga disponível${filterNote}`,
        reason: "Chamada de vaga disponível — aguardando resposta",
        by: adminName,
      });
      await refreshQueue();
      await refreshRecentLogs();
    } catch (e) {
      console.error(e);
    }
  }

  const [pendingResponse, setPendingResponse] = useState(null); // entry
  const [responseChoice, setResponseChoice] = useState(null);
  const [responseReason, setResponseReason] = useState("");
  const [responseError, setResponseError] = useState("");

  function openResponseModal(entry) {
    setPendingResponse(entry);
    setResponseChoice(null);
    setResponseReason("");
    setResponseError("");
  }

  async function confirmResponse() {
    if (!responseChoice) {
      setResponseError("Selecione o que aconteceu.");
      return;
    }
    if (!responseReason.trim()) {
      setResponseError("Informe uma observação sobre a resposta.");
      return;
    }
    const entry = pendingResponse;
    try {
      if (responseChoice === "aceitou") {
        await db.deleteQueueEntry(entry.id);
        await db.addLog({ modalidadeId: modality, text: `${entry.full_name} aceitou a vaga e foi matriculado`, reason: responseReason.trim(), by: adminName });
      } else if (responseChoice === "recusou_fica") {
        await db.resolveResponseStay(entry.id);
        const { data: freshRow } = await supabase.from("queue_entries").select("position").eq("id", entry.id).maybeSingle();
        const newPos = freshRow?.position ?? entry.position + 1;
        await db.addLog({
          modalidadeId: modality,
          text: `${entry.full_name} recusou a vaga e permanece na fila (saiu da posição ${entry.position} para a posição ${newPos})`,
          reason: responseReason.trim(),
          by: adminName,
        });
      } else if (responseChoice === "recusou_sai") {
        await db.deleteQueueEntry(entry.id);
        await db.addLog({ modalidadeId: modality, text: `${entry.full_name} recusou a vaga e foi removido da fila`, reason: responseReason.trim(), by: adminName });
      }
      setPendingResponse(null);
      setResponseChoice(null);
      setResponseReason("");
      await refreshQueue();
      await refreshRecentLogs();
    } catch (e) {
      console.error(e);
      setResponseError("Erro ao salvar. Tente novamente.");
    }
  }

  const [confirmRemove, setConfirmRemove] = useState(null); // entry

  async function confirmRemoveEntry() {
    if (!reasonInput.trim()) {
      setReasonError("Informe o motivo da remoção.");
      return;
    }
    const entry = confirmRemove;
    try {
      await db.deleteQueueEntry(entry.id);
      await db.addLog({
        modalidadeId: modality,
        text: `${entry.full_name} foi removido da fila (posição ${entry.position})`,
        reason: reasonInput.trim(),
        by: adminName,
      });
      setConfirmRemove(null);
      setReasonInput("");
      setReasonError("");
      await refreshQueue();
      await refreshRecentLogs();
    } catch (e) {
      console.error(e);
      setReasonError("Erro ao salvar. Tente novamente.");
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#5B6B7A", fontFamily: "system-ui, sans-serif" }}>
        Carregando fila...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#FAF7F0", minHeight: "600px", borderRadius: "16px", overflow: "hidden", border: "1px solid #E7DFC8", boxShadow: "0 1px 3px rgba(15,61,99,0.06), 0 20px 48px -24px rgba(15,61,99,0.28)" }}>
      <style>{`
        .fc-btn { font-family: system-ui, sans-serif; border: 1px solid #DAD2B8; background: #fff; border-radius: 8px; padding: clamp(6px, 0.6vw, 10px) clamp(12px, 1.1vw, 18px); font-size: clamp(13px, 0.85vw + 6px, 15px); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .15s ease; color: #10314F; }
        .fc-btn:hover { background: #F3EFE2; border-color: #C9BD98; }
        .fc-btn:active { transform: scale(0.97); }
        .fc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .fc-btn-primary { background: #0F3D63; color: #fff; border-color: #0F3D63; box-shadow: 0 1px 2px rgba(15,61,99,0.3); }
        .fc-btn-primary:hover { background: #0B2E4C; border-color: #0B2E4C; }
        .fc-btn-danger { color: #A32D2D; border-color: #E3B9B9; }
        .fc-btn-danger:hover { background: #FBEAEA; border-color: #D99; }
        .fc-input { font-family: system-ui, sans-serif; border: 1px solid #DAD2B8; border-radius: 8px; padding: clamp(8px, 0.6vw, 12px) clamp(10px, 0.8vw, 14px); font-size: clamp(13px, 0.85vw + 6px, 15px); width: 100%; box-sizing: border-box; transition: border-color .15s ease, box-shadow .15s ease; }
        .fc-input:focus { outline: none; border-color: #B08A3C; box-shadow: 0 0 0 3px rgba(176,138,60,0.18); }
        .fc-tab { font-family: system-ui, sans-serif; font-size: clamp(13px, 0.85vw + 6px, 15px); font-weight: 500; padding: clamp(8px, 0.6vw, 11px) clamp(16px, 1.2vw, 22px); border-radius: 999px; border: 1px solid transparent; cursor: pointer; color: #5B6B7A; background: transparent; transition: all .15s ease; }
        .fc-tab:hover { background: #F3EFE2; color: #10314F; }
        .fc-tab-active { background: #0F3D63; color: #fff; box-shadow: 0 2px 6px rgba(15,61,99,0.35); }
        .fc-tab-active:hover { background: #0B2E4C; color: #fff; }
        .fc-select { font-family: system-ui, sans-serif; border: 1px solid #DAD2B8; border-radius: 8px; padding: clamp(7px, 0.6vw, 10px); font-size: clamp(13px, 0.85vw + 6px, 15px); background: #fff; color: #10314F; }
        .fc-queue-row { display: flex; align-items: flex-start; gap: clamp(14px, 1.2vw, 20px); padding: clamp(14px, 1.4vw, 22px) clamp(16px, 1.8vw, 28px); border-bottom: 1px solid #F0EBDD; font-family: system-ui, sans-serif; flex-wrap: wrap; transition: background .15s ease; }
        .fc-queue-row:hover { background: #FCFAF4; }
        .fc-queue-actions { display: flex; gap: 6px; flex-shrink: 0; margin-left: auto; }
        .fc-form-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; }
        .fc-dropdown-item { width: 100%; text-align: left; padding: 10px 14px; border: none; background: #fff; cursor: pointer; font-family: system-ui, sans-serif; font-size: 13px; color: #10314F; display: flex; align-items: center; gap: 8px; transition: background .15s ease; }
        .fc-dropdown-item:hover { background: #F5F0E2; }
        .fc-dropdown-item:not(:last-child) { border-bottom: 1px solid #F0EBDD; }
        @media (max-width: 560px) {
          .fc-queue-row { align-items: center; }
          .fc-queue-actions { width: 100%; margin-left: 0; margin-top: 8px; flex-wrap: wrap; }
          .fc-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ background: "linear-gradient(155deg, #123E63 0%, #0B2E4C 100%)", color: "#fff", padding: "22px 24px 20px", borderBottom: "2px solid #B08A3C" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#D9BD82", margin: "0 0 6px", fontFamily: "system-ui, sans-serif", fontWeight: "600" }}>
              Country Clube
            </p>
            <h1 style={{ fontSize: "clamp(24px, 1.6vw + 18px, 34px)", fontWeight: "500", margin: 0, letterSpacing: "0.2px" }}>
              {showLogsView ? "Histórico de alterações" : showManageModalidades ? "Gerenciar modalidades" : showDashboard ? "Painel geral" : "Fila de espera — atividades esportivas"}
            </h1>
          </div>
          <div style={{ fontFamily: "system-ui, sans-serif" }}>
            {isAdmin ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "#D9BD82", display: "flex", alignItems: "center", gap: "5px", fontWeight: "500" }}>
                  <ShieldCheck size={14} aria-hidden="true" /> {adminName} (administração)
                </span>
                <button className="fc-btn" onClick={logout}>Sair</button>
              </div>
            ) : (
              <button className="fc-btn" onClick={() => { setShowLoginModal(true); setIdleLogoutMessage(false); }}>
                <Lock size={14} aria-hidden="true" /> Entrar como administração
              </button>
            )}
          </div>
        </div>
      </div>

      {idleLogoutMessage && (
        <div style={{ margin: "12px 24px 0", padding: "10px 14px", background: "#FBF3D9", border: "1px solid #E8D6A0", borderRadius: "10px", fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#8A6D1F", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
          <span>Sua sessão de administração foi encerrada automaticamente por inatividade (20 minutos sem uso), por segurança.</span>
          <button className="fc-btn" style={{ padding: "3px 8px", fontSize: "12px", flexShrink: 0 }} onClick={() => setIdleLogoutMessage(false)}>
            Entendi
          </button>
        </div>
      )}

      {showLogsView ? (
        <div style={{ padding: "20px 24px 24px" }}>
          <button className="fc-btn" style={{ marginBottom: "16px" }} onClick={() => setShowLogsView(false)}>
            <ArrowLeft size={14} aria-hidden="true" /> Voltar para a fila
          </button>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            <select className="fc-select" value={logModalityFilter} onChange={(e) => setLogModalityFilter(e.target.value)}>
              <option value="todas">Todas as modalidades</option>
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>{m.label}{m.archived ? " (arquivada)" : ""}</option>
              ))}
            </select>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search size={14} aria-hidden="true" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8FA1B0" }} />
              <input
                className="fc-input"
                style={{ paddingLeft: "30px" }}
                placeholder="Buscar por nome, motivo ou responsável"
                value={logSearchInput}
                onChange={(e) => setLogSearchInput(e.target.value)}
              />
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#5B6B7A", margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>
            {logLoading ? "Carregando..." : `${logTotalCount} ${logTotalCount === 1 ? "registro encontrado" : "registros encontrados"}`}
          </p>

          <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "4px 16px" }}>
            {!logLoading && logRows.length === 0 && (
              <p style={{ padding: "20px 0", fontSize: "13px", color: "#8FA1B0", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
                Nenhum registro encontrado para esse filtro.
              </p>
            )}
            {logRows.map((l, i) => (
              <div key={l.id} style={{ padding: "12px 0", borderBottom: i < logRows.length - 1 ? "1px solid #EAF0F5" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ color: "#10314F", fontWeight: "500" }}>{l.text}</span>
                  <span style={{ color: "#8FA1B0", fontSize: "12px" }}>{modalidades.find((m) => m.id === l.modalidade_id)?.label}</span>
                </div>
                {l.reason && <p style={{ margin: "4px 0 0", color: "#5B6B7A" }}>Motivo: {l.reason}</p>}
                {l.removed_members && l.removed_members.length > 0 && (
                  <div style={{ margin: "4px 0 0" }}>
                    <button
                      className="fc-btn"
                      style={{ padding: "2px 8px", fontSize: "11px" }}
                      onClick={() => setExpandedLogDetails((s) => ({ ...s, [l.id]: !s[l.id] }))}
                    >
                      {expandedLogDetails[l.id] ? "Ocultar lista" : `Ver lista (${l.removed_members.length})`}
                    </button>
                    {expandedLogDetails[l.id] && (
                      <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "#5B6B7A" }}>
                        {l.removed_members.map((m, idx) => (
                          <li key={idx}>{m.full} — matrícula {m.matricula}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <p style={{ margin: "4px 0 0", color: "#8FA1B0", fontSize: "12px" }}>{formatLogTime(new Date(l.ts).getTime())} · {l.by}</p>
              </div>
            ))}
          </div>

          {logRows.length < logTotalCount && (
            <button className="fc-btn" style={{ marginTop: "12px" }} onClick={loadMoreLogs} disabled={logLoadingMore}>
              {logLoadingMore ? "Carregando..." : `Carregar mais ${Math.min(LOG_PAGE_SIZE, logTotalCount - logRows.length)}`}
            </button>
          )}
        </div>
      ) : showManageModalidades ? (
        <div style={{ padding: "20px 24px 24px" }}>
          <button className="fc-btn" style={{ marginBottom: "16px" }} onClick={() => setShowManageModalidades(false)}>
            <ArrowLeft size={14} aria-hidden="true" /> Voltar para a fila
          </button>

          <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "500", color: "#10314F" }}>Modalidades cadastradas</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
              {activeModalidades.map((m) => {
                const count = modalidadeQueueCounts[m.id] ?? "…";
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#F5F0E2", borderRadius: "6px" }}>
                    <span style={{ fontSize: "13px", color: "#10314F" }}>
                      {m.label} <span style={{ color: "#8FA1B0" }}>· {count} na fila</span>
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {count > 0 && (
                        <button
                          className="fc-btn"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => { setConfirmClearQueue(m.id); setClearReason(""); setClearError(""); }}
                        >
                          Esvaziar fila
                        </button>
                      )}
                      <button
                        className="fc-btn fc-btn-danger"
                        style={{ padding: "4px 8px" }}
                        onClick={() => { setConfirmRemoveModalidade(m.id); setManageError(""); }}
                        disabled={count > 0}
                        title={count > 0 ? "Esvazie a fila antes de remover" : "Remover modalidade"}
                        aria-label={`Remover ${m.label}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {modalidades.some((m) => m.archived) && (
              <>
                <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "500", color: "#10314F" }}>Modalidades arquivadas</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                  {modalidades.filter((m) => m.archived).map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#F5F0E2", borderRadius: "6px", opacity: 0.75 }}>
                      <span style={{ fontSize: "13px", color: "#10314F" }}>{m.label}</span>
                      <button className="fc-btn" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={() => restoreModalidade(m.id)}>
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "12px", color: "#8FA1B0", margin: "0 0 18px" }}>
                  Modalidades arquivadas não aparecem nas abas, mas seus registros continuam disponíveis no filtro do histórico.
                </p>
              </>
            )}

            <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: "500", color: "#10314F" }}>Adicionar nova modalidade</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                className="fc-input"
                style={{ flex: 1, minWidth: "180px" }}
                placeholder="Ex: Squash, Beach tênis..."
                value={newModalidadeLabel}
                onChange={(e) => { setNewModalidadeLabel(e.target.value); setManageError(""); }}
                onKeyDown={(e) => e.key === "Enter" && addModalidade()}
              />
              <button className="fc-btn fc-btn-primary" onClick={addModalidade}>
                <Plus size={14} aria-hidden="true" /> Adicionar
              </button>
            </div>
            {manageError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "8px 0 0" }}>{manageError}</p>}
          </div>
        </div>
      ) : showDashboard ? (
        <div style={{ padding: "20px 24px 24px" }}>
          <button className="fc-btn" style={{ marginBottom: "16px" }} onClick={() => setShowDashboard(false)}>
            <ArrowLeft size={14} aria-hidden="true" /> Voltar para a fila
          </button>

          {dashboardLoading || !dashboardStats ? (
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#5B6B7A" }}>Carregando painel...</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#5B6B7A" }}>Sócios esperando (clube todo)</p>
                  <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#0F3D63", fontFamily: "Georgia, serif" }}>{dashboardStats.totalWaiting}</p>
                </div>
                <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#5B6B7A" }}>Vagas preenchidas este mês</p>
                  <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#1F7A45", fontFamily: "Georgia, serif" }}>{dashboardStats.vagasPreenchidasMes}</p>
                </div>
                <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#5B6B7A" }}>Aguardando resposta agora</p>
                  <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#8A6D1F", fontFamily: "Georgia, serif" }}>{dashboardStats.aguardandoRespostaAgora}</p>
                </div>
              </div>

              {dashboardStats.alerts.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "500", color: "#A32D2D", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={14} aria-hidden="true" /> Aguardando resposta há mais de {ALERT_THRESHOLD_HOURS}h, sem retorno registrado
                  </p>
                  <div style={{ background: "#FBEAEA", border: "1px solid #E3B9B9", borderRadius: "12px", padding: "4px 14px" }}>
                    {dashboardStats.alerts.map((a, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < dashboardStats.alerts.length - 1 ? "1px solid #F0D3D3" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{ color: "#7A2323" }}>
                          <strong>{a.name}</strong> · {a.modalityLabel}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ color: "#A32D2D" }}>{Math.round(a.hoursWaiting)}h esperando resposta</span>
                          <button className="fc-btn" style={{ padding: "3px 8px", fontSize: "12px" }} onClick={() => { setModality(a.modalityId); setShowDashboard(false); }}>
                            Ver na fila
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "500", color: "#10314F", fontFamily: "system-ui, sans-serif" }}>Por modalidade</p>
                <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "4px 16px" }}>
                  {dashboardStats.perModalidade.map((m, i) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < dashboardStats.perModalidade.length - 1 ? "1px solid #F0EBDD" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px" }}>
                      <span style={{ color: "#10314F", fontWeight: "500" }}>{m.label}</span>
                      <span style={{ color: "#5B6B7A" }}>
                        {m.queueLength} na fila
                        {m.aguardando > 0 && <span style={{ color: "#8A6D1F" }}> · {m.aguardando} aguardando resposta</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div style={{ padding: "20px 24px 4px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            {activeModalidades.map((m) => (
              <button key={m.id} className={`fc-tab ${modality === m.id ? "fc-tab-active" : ""}`} onClick={() => setModality(m.id)}>
                {m.label}
              </button>
            ))}
            {isAdmin && (
              <div style={{ position: "relative", marginLeft: "auto" }}>
                <button className="fc-btn" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => setToolsMenuOpen((v) => !v)}>
                  <Settings size={13} aria-hidden="true" /> Ferramentas <ChevronDown size={12} aria-hidden="true" />
                </button>
                {toolsMenuOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setToolsMenuOpen(false)} />
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1px solid #EAE2CC", borderRadius: "10px", boxShadow: "0 12px 28px -10px rgba(15,61,99,0.35)", zIndex: 41, minWidth: "210px", overflow: "hidden" }}>
                      <button className="fc-dropdown-item" onClick={() => { setShowDashboard(true); setToolsMenuOpen(false); }}>
                        <LayoutDashboard size={14} aria-hidden="true" /> Painel geral
                      </button>
                      <button className="fc-dropdown-item" onClick={() => { setShowManageModalidades(true); setManageError(""); setToolsMenuOpen(false); }}>
                        <Layers size={14} aria-hidden="true" /> Gerenciar modalidades
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <p style={{ fontSize: "clamp(13px, 0.5vw + 10px, 15px)", color: "#5B6B7A", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
              {isAdmin ? <Unlock size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              {isAdmin ? "Modo administração — você pode reordenar, chamar e remover sócios" : "Modo consulta — visível a qualquer sócio"}
            </p>
            <p style={{ fontSize: "clamp(13px, 0.5vw + 10px, 15px)", color: "#5B6B7A", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={14} aria-hidden="true" /> {queueTotalCount} na fila de {currentModLabel}
            </p>
          </div>

          {queueError && (
            <div style={{ margin: "0 24px 12px", padding: "8px 12px", background: "#FBEAEA", color: "#A32D2D", borderRadius: "6px", fontSize: "12px", fontFamily: "system-ui, sans-serif" }}>
              Não foi possível carregar a fila. Verifique a conexão e tente novamente.
            </div>
          )}

          {isAdmin && (
            <div style={{ margin: "0 24px 12px", background: "#FBF3D9", border: "1px solid #E8D6A0", borderRadius: "12px", padding: "10px 14px", fontFamily: "system-ui, sans-serif" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#8A6D1F", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <Clock size={13} aria-hidden="true" style={{ marginTop: "1px", flexShrink: 0 }} />
                <span>
                  <strong>Estimativa de tempo de espera — visível só para administração (em teste).</strong>{" "}
                  {waitEstimate
                    ? `Baseada em ${waitEstimate.count} vagas preenchidas nessa modalidade nos últimos ${Math.round(waitEstimate.spanMonths)} meses. Ainda não é exibida para os sócios até validarmos a precisão.`
                    : "Ainda não há histórico suficiente nessa modalidade (mínimo de 3 vagas preenchidas) para calcular uma estimativa confiável."}
                </span>
              </p>
            </div>
          )}

          <div style={{ margin: "0 24px 12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search size={14} aria-hidden="true" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8FA1B0" }} />
              <input
                className="fc-input"
                style={{ paddingLeft: "30px" }}
                placeholder="Buscar por nome ou matrícula"
                value={queueSearchInput}
                onChange={(e) => setQueueSearchInput(e.target.value)}
              />
            </div>
            {hasAnyFilterActive && (
              <button className="fc-btn" style={{ fontSize: "12px", padding: "8px 12px", flexShrink: 0 }} onClick={clearAllFilters}>
                <X size={12} aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>

          <div style={{ margin: "0 24px 12px", background: "#fff", border: "1px solid #EAE2CC", borderRadius: "12px", overflow: "hidden" }}>
              <button
                onClick={() => setShowVagaFilters((v) => !v)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif", textAlign: "left" }}
              >
                <span style={{ fontSize: "12px", color: "#5B6B7A", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                  <Filter size={12} aria-hidden="true" /> {isAdmin ? "Filtrar para uma vaga específica" : "Filtrar por nível e horário"}
                  {isFilteringForVaga && !showVagaFilters && (
                    <span style={{ color: "#0F3D63", fontWeight: "500" }}>
                      · {[filterLevel && NIVEIS.find((n) => n.id === filterLevel)?.label, filterHorarios.length > 0 && filterHorarios.map((h) => HORARIOS.find((x) => x.id === h)?.label).join(", "), filterFaixaEtaria && FAIXAS_ETARIAS.find((f) => f.id === filterFaixaEtaria)?.label].filter(Boolean).join(" · ")} ativo
                    </span>
                  )}
                </span>
                {showVagaFilters ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>

              {showVagaFilters && (
                <div style={{ padding: "0 14px 12px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#5B6B7A", fontFamily: "system-ui, sans-serif" }}>{isAdmin ? "Define quem pode ser chamado, dentro dos que se encaixam." : "Veja só quem se encaixa em um nível, horário ou faixa etária específica."}</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <button
                      className="fc-btn"
                      style={{ padding: "4px 10px", fontSize: "12px", background: !filterLevel ? "#F5F0E2" : "#fff", borderColor: !filterLevel ? "#8FA1B0" : "#DAD2B8" }}
                      onClick={() => setFilterLevel("")}
                    >
                      Todos os níveis
                    </button>
                    {NIVEIS.map((n) => (
                      <button
                        key={n.id}
                        className="fc-btn"
                        style={{ padding: "4px 10px", fontSize: "12px", background: filterLevel === n.id ? n.bg : "#fff", color: filterLevel === n.id ? n.fg : "#10314F", borderColor: filterLevel === n.id ? n.fg : "#DAD2B8" }}
                        onClick={() => setFilterLevel(filterLevel === n.id ? "" : n.id)}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {HORARIOS.map((h) => {
                      const active = filterHorarios.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          className="fc-btn"
                          style={{ padding: "4px 10px", fontSize: "12px", background: active ? "#EAF1F8" : "#fff", borderColor: active ? "#0F3D63" : "#DAD2B8" }}
                          onClick={() => setFilterHorarios((prev) => (active ? prev.filter((x) => x !== h.id) : [...prev, h.id]))}
                        >
                          <h.Icon size={12} aria-hidden="true" style={{ marginRight: "3px", verticalAlign: "-2px" }} />
                          {h.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      className="fc-btn"
                      style={{ padding: "4px 10px", fontSize: "12px", background: !filterFaixaEtaria ? "#F5F0E2" : "#fff", borderColor: !filterFaixaEtaria ? "#8FA1B0" : "#DAD2B8" }}
                      onClick={() => setFilterFaixaEtaria("")}
                    >
                      Todas as faixas etárias
                    </button>
                    {FAIXAS_ETARIAS.map((f) => (
                      <button
                        key={f.id}
                        className="fc-btn"
                        style={{ padding: "4px 10px", fontSize: "12px", background: filterFaixaEtaria === f.id ? f.bg : "#fff", color: filterFaixaEtaria === f.id ? f.fg : "#10314F", borderColor: filterFaixaEtaria === f.id ? f.fg : "#DAD2B8" }}
                        onClick={() => setFilterFaixaEtaria(filterFaixaEtaria === f.id ? "" : f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {isFilteringForVaga && (
                    <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#0F3D63" }}>
                      {isAdmin
                        ? "Mostrando só quem se encaixa nesse filtro — a ordem de chamada respeita a posição deles entre si, não a fila inteira."
                        : "Mostrando só quem se encaixa nesse filtro."}
                    </p>
                  )}
                </div>
              )}
            </div>

          <div style={{ margin: "0 24px", background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", overflow: "hidden" }}>
            {queueLoading && (
              <p style={{ padding: "24px", textAlign: "center", color: "#8FA1B0", fontSize: "14px", fontFamily: "system-ui, sans-serif" }}>Carregando...</p>
            )}
            {!queueLoading && queueRows.length === 0 && (
              <p style={{ padding: "24px", textAlign: "center", color: "#8FA1B0", fontSize: "14px", fontFamily: "system-ui, sans-serif" }}>
                {queueSearch || isFilteringForVaga ? "Nenhum resultado para essa busca/filtro." : `Nenhum sócio na fila de ${currentModLabel} no momento.`}
              </p>
            )}
            {!queueLoading && queueRows.map((entry) => {
              const displayName = isAdmin ? entry.full_name : entry.masked_name;
              const canCall = isAdmin && nextCallableId === entry.id;
              const isFirst = entry.position === 1;
              return (
                <div key={entry.id} className="fc-queue-row">
                  <div
                    style={{
                      width: "clamp(32px, 2.4vw, 44px)",
                      height: "clamp(32px, 2.4vw, 44px)",
                      borderRadius: "50%",
                      background: isFirst ? "#0F3D63" : "#E3EEF7",
                      color: isFirst ? "#fff" : "#0F3D63",
                      fontSize: "clamp(13px, 0.9vw + 6px, 17px)",
                      fontWeight: "700",
                      fontFamily: "Georgia, serif",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: "1.5px solid #B08A3C",
                      boxShadow: isFirst ? "0 0 0 3px rgba(176,138,60,0.2)" : "none",
                    }}
                  >
                    {entry.position}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "clamp(14px, 0.9vw + 8px, 18px)", fontWeight: "500", color: "#10314F", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {displayName}
                      {entry.status === "chamado" && (
                        <span style={{ fontSize: "clamp(11px, 0.5vw + 8px, 13px)", fontWeight: "500", color: "#8A6D1F", background: "#FBF3D9", padding: "2px 8px", borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={11} aria-hidden="true" /> Aguardando resposta{isAdmin && entry.called_at ? ` · ${formatLogTime(new Date(entry.called_at).getTime())}` : ""}
                        </span>
                      )}
                      {entry.level && NIVEIS.find((n) => n.id === entry.level) && (
                        <span style={{ fontSize: "clamp(11px, 0.5vw + 8px, 13px)", fontWeight: "500", color: NIVEIS.find((n) => n.id === entry.level).fg, background: NIVEIS.find((n) => n.id === entry.level).bg, padding: "2px 8px", borderRadius: "999px" }}>
                          {NIVEIS.find((n) => n.id === entry.level).label}
                        </span>
                      )}
                      {entry.faixa_etaria && FAIXAS_ETARIAS.find((f) => f.id === entry.faixa_etaria) && (
                        <span style={{ fontSize: "clamp(11px, 0.5vw + 8px, 13px)", fontWeight: "500", color: FAIXAS_ETARIAS.find((f) => f.id === entry.faixa_etaria).fg, background: FAIXAS_ETARIAS.find((f) => f.id === entry.faixa_etaria).bg, padding: "2px 8px", borderRadius: "999px" }}>
                          {FAIXAS_ETARIAS.find((f) => f.id === entry.faixa_etaria).label}
                        </span>
                      )}
                      {(entry.availability || []).map((a) => {
                        const h = HORARIOS.find((x) => x.id === a);
                        if (!h) return null;
                        return (
                          <span key={a} style={{ fontSize: "clamp(11px, 0.5vw + 8px, 13px)", color: "#5B6B7A", background: "#F5F0E2", padding: "2px 8px", borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <h.Icon size={11} aria-hidden="true" /> {h.label}
                          </span>
                        );
                      })}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "clamp(12px, 0.5vw + 9px, 14px)", color: "#8FA1B0" }}>
                      {`Matrícula ${entry.matricula} · desde ${formatDate(entry.joined_at)}`}
                    </p>
                    {isAdmin && entry.status !== "chamado" && (!canCall || waitEstimate) && (
                      <p style={{ margin: "4px 0 0", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {!canCall && (
                          <span style={{ fontSize: "11px", color: "#5B6B7A", background: "#F5F0E2", padding: "2px 8px", borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <Lock size={10} aria-hidden="true" /> Aguardando ordem
                          </span>
                        )}
                        {waitEstimate && (() => {
                          const range = estimateRangeForPosition(entry.position);
                          return range ? (
                            <span style={{ fontSize: "11px", color: "#8A6D1F", background: "#FBF3D9", padding: "2px 8px", borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Clock size={10} aria-hidden="true" /> {range.low}–{range.high} meses (beta)
                            </span>
                          ) : null;
                        })()}
                      </p>
                    )}
                    {isAdmin && entry.phone && (
                      <p style={{ margin: "2px 0 0", fontSize: "12px" }}>
                        <a href={whatsappLink(entry.phone)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#1F8A5C", textDecoration: "none", fontWeight: "500" }}>
                          <MessageCircle size={12} aria-hidden="true" /> {entry.phone}
                        </a>
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="fc-queue-actions">
                      <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => openEditModal(entry)} aria-label="Editar dados do sócio">
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => openReasonModal("up", entry)} aria-label="Subir posição">
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>
                      <button className="fc-btn" style={{ padding: "6px 8px" }} onClick={() => openReasonModal("down", entry)} aria-label="Descer posição">
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                      {entry.status === "chamado" ? (
                        <button className="fc-btn fc-btn-primary" onClick={() => openResponseModal(entry)}>
                          <UserCheck size={14} aria-hidden="true" /> Registrar resposta
                        </button>
                      ) : (
                        <button className="fc-btn" onClick={() => handleCallMember(entry)} disabled={!canCall} title={canCall ? "" : "Chame primeiro os sócios à frente na fila"}>
                          <Megaphone size={14} aria-hidden="true" /> Chamar
                        </button>
                      )}
                      <button className="fc-btn fc-btn-danger" style={{ padding: "6px 8px" }} onClick={() => { setConfirmRemove(entry); setReasonInput(""); setReasonError(""); }} aria-label="Remover da fila">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {queueRows.length < queueTotalCount && (
            <div style={{ margin: "12px 24px 0" }}>
              <button className="fc-btn" onClick={loadMoreQueue} disabled={queueLoadingMore}>
                {queueLoadingMore ? "Carregando..." : `Mostrar mais ${Math.min(PAGE_SIZE, queueTotalCount - queueRows.length)}`}
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
                <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "14px 16px", fontFamily: "system-ui, sans-serif" }}>
                  <div className="fc-form-grid" style={{ marginBottom: "10px" }}>
                    <input className="fc-input" placeholder="Nome completo" value={newMember.full} onChange={(e) => { setNewMember({ ...newMember, full: e.target.value }); setAddMemberError(""); }} />
                    <input className="fc-input" placeholder="Matrícula" value={newMember.matricula} onChange={(e) => { setNewMember({ ...newMember, matricula: e.target.value }); setAddMemberError(""); }} />
                    <input className="fc-input" placeholder="Telefone (opcional)" maxLength={15} value={newMember.phone} onChange={(e) => { setNewMember({ ...newMember, phone: formatPhone(e.target.value) }); setAddMemberError(""); }} />
                  </div>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#5B6B7A" }}>Nível (obrigatório)</p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {NIVEIS.map((n) => (
                          <button
                            key={n.id}
                            className="fc-btn"
                            style={{ padding: "4px 10px", fontSize: "12px", background: newMember.level === n.id ? n.bg : "#fff", color: newMember.level === n.id ? n.fg : "#10314F", borderColor: newMember.level === n.id ? n.fg : "#DAD2B8" }}
                            onClick={() => setNewMember({ ...newMember, level: newMember.level === n.id ? "" : n.id })}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#5B6B7A" }}>Horários disponíveis (obrigatório, escolha ao menos 1)</p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {HORARIOS.map((h) => {
                          const active = newMember.availability.includes(h.id);
                          return (
                            <button
                              key={h.id}
                              className="fc-btn"
                              style={{ padding: "4px 10px", fontSize: "12px", background: active ? "#EAF1F8" : "#fff", borderColor: active ? "#0F3D63" : "#DAD2B8" }}
                              onClick={() => setNewMember({ ...newMember, availability: active ? newMember.availability.filter((a) => a !== h.id) : [...newMember.availability, h.id] })}
                            >
                              <h.Icon size={12} aria-hidden="true" style={{ marginRight: "3px", verticalAlign: "-2px" }} />
                              {h.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#5B6B7A" }}>Faixa etária (opcional)</p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {FAIXAS_ETARIAS.map((f) => (
                          <button
                            key={f.id}
                            className="fc-btn"
                            style={{ padding: "4px 10px", fontSize: "12px", background: newMember.faixaEtaria === f.id ? f.bg : "#fff", color: newMember.faixaEtaria === f.id ? f.fg : "#10314F", borderColor: newMember.faixaEtaria === f.id ? f.fg : "#DAD2B8" }}
                            onClick={() => setNewMember({ ...newMember, faixaEtaria: newMember.faixaEtaria === f.id ? "" : f.id })}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {addMemberError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{addMemberError}</p>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="fc-btn fc-btn-primary" onClick={addMember}>Adicionar ao fim da fila</button>
                    <button className="fc-btn" onClick={() => { setShowAddForm(false); setAddMemberError(""); }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <div style={{ margin: "20px 24px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <p style={{ fontSize: "12px", color: "#5B6B7A", margin: 0, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
                  <History size={14} aria-hidden="true" /> Últimas alterações — {currentModLabel}
                </p>
                <button className="fc-btn" style={{ padding: "4px 10px", fontSize: "12px" }} onClick={openLogsView}>
                  Ver histórico completo
                </button>
              </div>
              <div style={{ background: "#fff", border: "1px solid #EAE2CC", borderRadius: "14px", boxShadow: "0 1px 2px rgba(15,61,99,0.04), 0 10px 24px -14px rgba(15,61,99,0.22)", padding: "4px 16px" }}>
                {modalityLogsPreview.length === 0 && (
                  <p style={{ padding: "14px 0", fontSize: "13px", color: "#8FA1B0", fontFamily: "system-ui, sans-serif" }}>Nenhuma alteração registrada ainda.</p>
                )}
                {modalityLogsPreview.map((l, i) => (
                  <div key={l.id} style={{ padding: "10px 0", borderBottom: i < modalityLogsPreview.length - 1 ? "1px solid #EAF0F5" : "none", fontFamily: "system-ui, sans-serif", fontSize: "13px" }}>
                    <span style={{ color: "#10314F" }}>{l.text}</span>
                    <span style={{ color: "#8FA1B0" }}> · {formatLogTime(new Date(l.ts).getTime())} · {l.by}</span>
                    {l.reason && <p style={{ margin: "2px 0 0", color: "#8FA1B0", fontSize: "12px" }}>Motivo: {l.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {editingEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(480px, 100%)", fontFamily: "system-ui, sans-serif", margin: "24px 0" }}>
            <p style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "500" }}>Editar dados de {editingEntry.full_name}</p>

            <div className="fc-form-grid" style={{ marginBottom: "10px" }}>
              <input className="fc-input" placeholder="Nome completo" value={editDraft.full} onChange={(e) => { setEditDraft({ ...editDraft, full: e.target.value }); setEditError(""); }} />
              <input className="fc-input" placeholder="Matrícula" value={editDraft.matricula} onChange={(e) => { setEditDraft({ ...editDraft, matricula: e.target.value }); setEditError(""); }} />
              <input className="fc-input" placeholder="Telefone (opcional)" maxLength={15} value={editDraft.phone} onChange={(e) => { setEditDraft({ ...editDraft, phone: formatPhone(e.target.value) }); setEditError(""); }} />
            </div>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#5B6B7A" }}>Nível (obrigatório)</p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {NIVEIS.map((n) => (
                    <button
                      key={n.id}
                      className="fc-btn"
                      style={{ padding: "4px 10px", fontSize: "12px", background: editDraft.level === n.id ? n.bg : "#fff", color: editDraft.level === n.id ? n.fg : "#10314F", borderColor: editDraft.level === n.id ? n.fg : "#DAD2B8" }}
                      onClick={() => setEditDraft({ ...editDraft, level: editDraft.level === n.id ? "" : n.id })}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#5B6B7A" }}>Horários disponíveis (obrigatório, escolha ao menos 1)</p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {HORARIOS.map((h) => {
                    const active = editDraft.availability.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        className="fc-btn"
                        style={{ padding: "4px 10px", fontSize: "12px", background: active ? "#EAF1F8" : "#fff", borderColor: active ? "#0F3D63" : "#DAD2B8" }}
                        onClick={() => setEditDraft({ ...editDraft, availability: active ? editDraft.availability.filter((a) => a !== h.id) : [...editDraft.availability, h.id] })}
                      >
                        <h.Icon size={12} aria-hidden="true" style={{ marginRight: "3px", verticalAlign: "-2px" }} />
                        {h.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#5B6B7A" }}>Faixa etária (opcional)</p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {FAIXAS_ETARIAS.map((f) => (
                    <button
                      key={f.id}
                      className="fc-btn"
                      style={{ padding: "4px 10px", fontSize: "12px", background: editDraft.faixaEtaria === f.id ? f.bg : "#fff", color: editDraft.faixaEtaria === f.id ? f.fg : "#10314F", borderColor: editDraft.faixaEtaria === f.id ? f.fg : "#DAD2B8" }}
                      onClick={() => setEditDraft({ ...editDraft, faixaEtaria: editDraft.faixaEtaria === f.id ? "" : f.id })}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label style={{ fontSize: "12px", color: "#5B6B7A", display: "block", marginBottom: "4px" }}>Motivo da alteração (obrigatório)</label>
            <textarea
              className="fc-input"
              rows={2}
              style={{ resize: "vertical", marginBottom: "6px" }}
              placeholder="Ex: sócio passou a poder frequentar à noite"
              value={editReason}
              onChange={(e) => { setEditReason(e.target.value); setEditError(""); }}
            />
            {editError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{editError}</p>}

            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button className="fc-btn fc-btn-primary" onClick={saveEditMember}>Salvar alterações</button>
              <button className="fc-btn" onClick={() => { setEditingEntry(null); setEditError(""); }}>Cancelar</button>
            </div>
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
              {pendingAction.entry.full_name} — informe o motivo dessa alteração para ficar registrado no log.
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

      {pendingResponse && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(420px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "500" }}>Registrar resposta</p>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#5B6B7A" }}>
              {pendingResponse.full_name} — o que aconteceu com essa chamada?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              <button
                className="fc-btn"
                style={{ justifyContent: "flex-start", padding: "10px 12px", borderColor: responseChoice === "aceitou" ? "#0F3D63" : "#DAD2B8", background: responseChoice === "aceitou" ? "#EAF1F8" : "#fff" }}
                onClick={() => { setResponseChoice("aceitou"); setResponseReason("Aceitou a vaga"); setResponseError(""); }}
              >
                <UserCheck size={16} aria-hidden="true" /> Aceitou a vaga — foi matriculado
              </button>
              <button
                className="fc-btn"
                style={{ justifyContent: "flex-start", padding: "10px 12px", borderColor: responseChoice === "recusou_fica" ? "#0F3D63" : "#DAD2B8", background: responseChoice === "recusou_fica" ? "#EAF1F8" : "#fff" }}
                onClick={() => { setResponseChoice("recusou_fica"); setResponseReason(""); setResponseError(""); }}
              >
                <Clock size={16} aria-hidden="true" /> Recusou — continua na fila (desce 1 posição)
              </button>
              <button
                className="fc-btn"
                style={{ justifyContent: "flex-start", padding: "10px 12px", borderColor: responseChoice === "recusou_sai" ? "#0F3D63" : "#DAD2B8", background: responseChoice === "recusou_sai" ? "#EAF1F8" : "#fff" }}
                onClick={() => { setResponseChoice("recusou_sai"); setResponseReason(""); setResponseError(""); }}
              >
                <UserX size={16} aria-hidden="true" /> Recusou — remover da fila
              </button>
            </div>

            <label style={{ fontSize: "12px", color: "#5B6B7A", display: "block", marginBottom: "4px" }}>Observação (obrigatório)</label>
            <textarea
              className="fc-input"
              rows={3}
              style={{ resize: "vertical", marginBottom: "6px" }}
              placeholder="Ex: falamos por telefone dia 20/07, confirmou matrícula na secretaria"
              value={responseReason}
              onChange={(e) => { setResponseReason(e.target.value); setResponseError(""); }}
            />
            {responseError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{responseError}</p>}

            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button className="fc-btn fc-btn-primary" onClick={confirmResponse}>Confirmar</button>
              <button className="fc-btn" onClick={() => setPendingResponse(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {confirmClearQueue && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(400px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "500" }}>
              Esvaziar fila de {modalidades.find((m) => m.id === confirmClearQueue)?.label}?
            </p>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#5B6B7A" }}>
              Isso remove os {modalidadeQueueCounts[confirmClearQueue] ?? "…"} sócios atualmente na fila de {modalidades.find((m) => m.id === confirmClearQueue)?.label}. Uma entrada única fica registrada no histórico com a lista completa de quem foi removido, para consulta futura. Essa ação não pode ser desfeita.
            </p>
            <textarea
              className="fc-input"
              rows={3}
              style={{ resize: "vertical", marginBottom: "6px" }}
              placeholder="Ex: reformulação da modalidade, todos foram contatados e reinscritos manualmente"
              value={clearReason}
              onChange={(e) => { setClearReason(e.target.value); setClearError(""); }}
            />
            {clearError && <p style={{ fontSize: "12px", color: "#A32D2D", margin: "0 0 10px" }}>{clearError}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button className="fc-btn fc-btn-danger" onClick={clearQueueAction}>Esvaziar fila</button>
              <button className="fc-btn" onClick={() => { setConfirmClearQueue(null); setClearReason(""); setClearError(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveModalidade && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(380px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "500" }}>Arquivar modalidade?</p>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#5B6B7A" }}>
              "{modalidades.find((m) => m.id === confirmRemoveModalidade)?.label}" deixará de aparecer nas abas. O histórico continua acessível pelo filtro, e você pode restaurar a modalidade a qualquer momento.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="fc-btn fc-btn-danger" onClick={() => removeModalidade(confirmRemoveModalidade)}>Arquivar</button>
              <button className="fc-btn" onClick={() => setConfirmRemoveModalidade(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,61,99,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "min(380px, 100%)", fontFamily: "system-ui, sans-serif" }}>
            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: "500" }}>Remover da fila?</p>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#5B6B7A" }}>
              {confirmRemove.full_name} sairá da fila de {currentModLabel}. Informe o motivo — essa ação fica registrada no log.
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
              <button className="fc-btn fc-btn-danger" onClick={confirmRemoveEntry}>Remover</button>
              <button className="fc-btn" onClick={() => { setConfirmRemove(null); setReasonInput(""); setReasonError(""); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
