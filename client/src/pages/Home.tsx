import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowUpRight,
  Cake,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Flag,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  UserRoundCheck,
  Users,
  X,
  ShieldCheck,
  Settings2,
  History,
} from "lucide-react";
import { isBirthdayInNextDays } from "@shared/customerUtils";
import { hasScoredQuality, wilsonInterval } from "@shared/metricsUtils";
import { isWithinDateRange } from "@shared/teamUtils";
import { getPreviousPeriod } from "@shared/periodUtils";
import {
  getBirthdayCampaignMetrics,
  getBirthdayCampaignMonthlyMetrics,
} from "@shared/birthdayCampaignUtils";
import { nextPriorityStatus } from "@shared/priorityUtils";

type OverviewFocus = "birthdays" | "bad" | "recover" | null;
type CampaignChannel = "llamada" | "whatsapp" | "correo" | "sms";

type Page =
  | "overview"
  | "birthdays"
  | "priorities"
  | "clients"
  | "voice"
  | "team"
  | "promotions"
  | "calls"
  | "responsibles"
  | "targetHistory"
  | "profile"
  | "administracion";
type SearchScope = "all" | "clients" | "comments" | "servers";
type RecordItem = {
  id: string;
  timestamp: string;
  clientName: string;
  phone: string;
  birthday: string;
  dish: string;
  comment: string;
  registeredBy: string;
  quality: string;
};
type CallLog = {
  id: number;
  clientKey: string;
  clientName: string;
  phone: string | null;
  callDate: Date | string;
  outcome: string;
  promotion: string | null;
  promotionRedeemed: number;
  nextCallDate: Date | string | null;
  recoveryResult: string | null;
  notes: string | null;
  createdBy: string | null;
  campaignStage: CampaignStage | null;
  assignedTo: string | null;
  campaignChannel: CampaignChannel | null;
  createdAt?: Date | string;
};
type CampaignStage = "week" | "soon" | "tomorrow" | "today" | "past";
type BirthdayCampaign = {
  id: number;
  clientKey: string;
  clientName: string;
  phone: string | null;
  stage: "week" | "soon" | "tomorrow" | "today" | "past";
  channel: CampaignChannel;
  progressStatus: "pending" | "contacted" | "accepted" | "redeemed" | "rejected" | "noanswer";
  promotion: string | null;
  responsible: string | null;
  nextActionAt: Date | string | null;
  nextActionLabel: string | null;
  familyName: string | null;
  familyBirthday: string | null;
  noRedeemReason: string | null;
  notes: string | null;
  updatedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};
type ClientProfile = {
  key: string;
  name: string;
  phone: string;
  count: number;
  quality: string;
  comment: string;
  dish: string;
  segment: "Nuevo" | "Recurrente" | "Fiel" | "En riesgo";
  source: string;
  birthday: string;
};
type ServerCatalogItem = { id: string; name: string; active: boolean };
type PriorityPersisted = {
  id: number;
  priorityKey: string;
  status: "pending" | "in_progress" | "done";
  responsible: string | null;
  dueDate: Date | string | null;
  updatedBy: string | null;
};
type SystemUser = {
  id: number;
  openId?: string;
  name: string | null;
  email: string | null;
  role?: "user" | "admin";
  canViewCustomers?: number;
  canManageCalls?: number;
  canManageTargets?: number;
  canManageUsers?: number;
  canViewAudit?: number;
  active?: number;
  avatarPreset?: string | null;
  lastSignedIn?: Date | string | null;
};
type AccessUser = SystemUser & {
  id: number;
  role: "user" | "admin";
  canViewCustomers: number;
  canManageCalls: number;
  canManageTargets: number;
  canManageUsers: number;
  canViewAudit: number;
  active: number;
  avatarPreset: string | null;
};
type SessionEvent = {
  id: number;
  openId: string;
  action: "login" | "logout";
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date | string;
};
type AdminSessionEvent = SessionEvent & {
  userName: string | null;
  userEmail: string | null;
};
const avatarChoices = [
  "coronel",
  "chef",
  "flame",
  "leaf",
  "star",
  "shield",
] as const;
function avatarSymbol(preset?: string | null) {
  return (
    (
      {
        coronel: "🦁",
        chef: "👨‍🍳",
        flame: "🔥",
        leaf: "🌿",
        star: "⭐",
        shield: "🛡️",
      } as Record<string, string>
    )[preset || "coronel"] || "🦁"
  );
}
type PromotionItem = {
  id: number;
  name: string;
  category: "recuperacion" | "cumpleanos" | "fidelidad" | "general";
  active: number;
};
type ResponsibleUser = {
  id: number;
  name: string;
  email: string | null;
  active: number;
};
type TargetHistoryItem = {
  id: number;
  surveysPerServer: number;
  surveysPerDelivery?: number;
  positiveQualityPercent: number;
  periodLabel: string;
  changedBy: string | null;
  changedAt: Date | string;
};
type AuditItem = {
  id: number;
  entity: string;
  action: string;
  entityId: string | null;
  details: string | null;
  changedBy: string;
  changedAt: Date | string;
};

const tabs: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Centro de acción", icon: LayoutDashboard },
  { id: "birthdays", label: "Cumpleaños", icon: Cake },
  { id: "priorities", label: "Prioridades", icon: Flag },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "voice", label: "Voz del cliente", icon: MessageSquareText },
  { id: "team", label: "Equipo", icon: UserRoundCheck },
  { id: "promotions", label: "Promociones", icon: Sparkles },
  { id: "calls", label: "Llamadas", icon: Phone },
  { id: "responsibles", label: "Responsables", icon: Users },
  { id: "targetHistory", label: "Historial de metas", icon: Clock3 },
  { id: "profile", label: "Mi perfil", icon: Users },
  { id: "administracion", label: "Administración", icon: Settings2 },
];
const promotionCatalog = [
  "15% de descuento + bebida",
  "Postre gratis en próxima visita",
  "Bebida gratis con plato principal",
  "Combo familiar especial",
  "Envío gratis en próximo delivery",
  "Premio de cumpleaños",
  "Premio cliente fiel",
  "Ninguna",
];
const clean = (value: string) => value.trim().toLowerCase();
const normalizeText = (value: string) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const phoneDigits = (value: string) => value.replace(/\D/g, "");
const clientKeyOf = (record: Pick<RecordItem, "phone" | "clientName">) =>
  phoneDigits(record.phone) || normalizeText(record.clientName) || "sin-nombre";
const displayServer = (value: string) => {
  const v = clean(value);
  if (
    !v ||
    v.includes("formulario") ||
    v.includes("web") ||
    v.includes("delivery") ||
    v.includes("cliente (")
  )
    return "DELIVERY / WEB";
  return value.trim().toUpperCase();
};
const channelOf = (record: RecordItem) =>
  displayServer(record.registeredBy) === "DELIVERY / WEB"
    ? "Delivery / web"
    : "Salón";
const parseDate = (value: string) => {
  const local = value
    .trim()
    .match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
  if (local) {
    const [, d, m, y, h = "0", min = "0", s = "0"] = local;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      Number(s)
    );
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
/* Para cumpleaños sin año ("05/11") se usa el año actual solo para ubicar
   la próxima fecha; la edad no se calcula con este dato. */
const parseBirthdayDate = (value: string) => {
  const text = String(value || "").trim();
  // Acepta dd/mm, dd/mm/yy y dd/mm/yyyy. El año de 2 dígitos se interpreta
  // como 2000+ si es <= 26; si no, 1900+. Un "dd/mm/yy" NO debe caer en el
  // parser de Date nativo porque lo lee como mes/día (08/11/83 → agosto).
  const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : new Date().getFullYear();
    if (match[3] && year < 100) year += year <= 26 ? 2000 : 1900;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
  return parseDate(text);
};
function birthdayRecordsWithin(
  records: RecordItem[],
  fromOffset: number,
  toOffset: number
) {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + fromOffset
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + toOffset
  );
  const rows = records
    .map(record => {
      const birthday = parseBirthdayDate(record.birthday);
      if (!birthday) return null;
      const candidates = [
        now.getFullYear() - 1,
        now.getFullYear(),
        now.getFullYear() + 1,
      ].map(year => new Date(year, birthday.getMonth(), birthday.getDate()));
      const target = candidates.find(date => date >= start && date <= end);
      return target ? { record, target } : null;
    })
    .filter(Boolean) as { record: RecordItem; target: Date }[];
  const seen = new Set<string>();
  return rows
    .sort((a, b) => a.target.getTime() - b.target.getTime())
    .map(item => item.record)
    .filter(record => {
      const key = clientKeyOf(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : parseDate(String(value));
  return date
    ? new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
      }).format(date)
    : "—";
};
const formatBirthday = (value: string) => {
  const date = parseBirthdayDate(value);
  return date
    ? new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
      }).format(date)
    : "—";
};
const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? formatDate(String(value))
    : new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
};
function formatCountChange(
  current: number,
  previous: number,
  percentage: number | null
) {
  const difference = current - previous;
  if (!previous) return "Sin datos previos";
  const verb = difference >= 0 ? "Aumentó" : "Disminuyó";
  const amount = Math.abs(difference);
  const pct =
    percentage === null ? "" : ` (${percentage >= 0 ? "+" : ""}${percentage}%)`;
  return `${verb} ${amount} encuesta${amount === 1 ? "" : "s"}${pct}`;
}
function printReport(extraFilters = "") {
  const header = document.getElementById("print-report-filters");
  const area = document.querySelector(".topbar h1")?.textContent?.trim();
  const context = [
    area && `Área: ${area}`,
    extraFilters || "Sin filtros de fecha adicionales",
  ]
    .filter(Boolean)
    .join(" · ");
  if (header) header.textContent = context;
  window.print();
}

function Face({
  tone,
  size = "md",
}: {
  tone: "great" | "good" | "neutral" | "bad";
  size?: "sm" | "md" | "lg";
}) {
  const faces = { great: "😄", good: "🙂", neutral: "😐", bad: "😞" };
  return (
    <span className={`face face-${tone} face-${size}`} aria-label={tone}>
      {faces[tone]}
    </span>
  );
}
function QualityFace({ percent, count }: { percent: number; count: number }) {
  const minimum = 30;
  const insufficient = count < minimum;
  const tone = insufficient
    ? "neutral"
    : percent >= 0.85
      ? "great"
      : percent >= 0.7
        ? "good"
        : percent >= 0.5
          ? "neutral"
          : "bad";
  const label = insufficient
    ? "Muestra insuficiente"
    : percent >= 0.85
      ? "Muy positiva"
      : percent >= 0.7
        ? "Positiva"
        : percent >= 0.5
          ? "Mejorable"
          : "Negativa";
  return (
    <div className="quality-face">
      <Face tone={tone} size="lg" />
      <div>
        <p className="eyebrow">SENTIMIENTO DE CALIDAD</p>
        <h2>{label}</h2>
        <p className="muted">
          <b>{Math.round(percent * 100)}% positivo</b> · {count} respuesta
          {count === 1 ? "" : "s"}
        </p>
        {insufficient && (
          <small className="quality-explanation">
            Lectura orientativa: faltan {minimum - count} respuesta
            {minimum - count === 1 ? "" : "s"} para la referencia mínima de{" "}
            {minimum}.
          </small>
        )}
      </div>
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  accent = "blue",
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  accent?: string;
  icon?: typeof Cake;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className={`stat-icon ${accent}`}>{Icon && <Icon size={18} />}</div>
      <div>
        <p className="eyebrow">{label}</p>
        <strong>{value}</strong>
        <p className="muted">{detail}</p>
      </div>
      {onClick && <ChevronRight className="stat-arrow" size={16} />}
    </>
  );
  return onClick ? (
    <button
      className="stat-card stat-card-link"
      onClick={onClick}
      aria-label={`${label}: abrir detalle`}
    >
      {content}
    </button>
  ) : (
    <div className="stat-card">{content}</div>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Sparkles size={18} />
      <span>{text}</span>
    </div>
  );
}

export default function Home() {
  const { user, logout, loading: authLoading } = useAuth();
  const [sourceTab, setSourceTab] = useState<"original" | "limpia">("limpia");
  const { data, isLoading, isFetching, refetch, error } =
    trpc.survey.latest.useQuery(
      { tab: sourceTab },
      { refetchInterval: 300000, staleTime: 120000 }
    );
  const callsQuery = trpc.calls.list.useQuery();
  const birthdayCampaignsQuery = trpc.birthdayCampaigns.list.useQuery(
    undefined,
    { enabled: Boolean(user), staleTime: 0, refetchOnMount: "always" }
  );
  const messageTemplatesQuery = trpc.messageTemplates.list.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const prioritiesQuery = trpc.priorities.list.useQuery(undefined, {
    refetchInterval: 300000,
    staleTime: 120000,
  });
  const usersQuery = trpc.systemUsers.list.useQuery();
  const promotionsQuery = trpc.promotions.list.useQuery();
  const promotionsAdminQuery = trpc.promotions.adminList.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const responsibleUsersQuery = trpc.responsibleUsers.list.useQuery();
  const responsibleAdminQuery = trpc.responsibleUsers.adminList.useQuery(
    undefined,
    { staleTime: 0, refetchOnMount: "always" }
  );
  const targetHistoryQuery = trpc.targets.history.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const auditQuery = trpc.adminAudit.list.useQuery();
  const accessUsersQuery = trpc.accessUsers.list.useQuery(undefined, {
    enabled: user?.role === "admin",
    staleTime: 0,
    refetchOnMount: "always",
  });
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem("coronel.lastPage") as Page | null;
    return saved && tabs.some(tab => tab.id === saved) ? saved : "overview";
  });
  const [qualityFilter, setQualityFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overviewFocus, setOverviewFocus] = useState<OverviewFocus>(null);
  const [priorityClientKey, setPriorityClientKey] = useState<string | null>(
    null
  );
  useEffect(() => {
    localStorage.setItem("coronel.lastPage", page);
  }, [page]);
  const records = (data?.records ?? []) as RecordItem[];
  const serverCatalog = (data?.serverCatalog ?? []) as ServerCatalogItem[];
  const filtered = useMemo(() => {
    const query = normalizeText(search);
    return records.filter(r => {
      const qualityMatch =
        qualityFilter === "Todos" || clean(r.quality) === clean(qualityFilter);
      if (!qualityMatch) return false;
      if (!query) return true;
      const clientText = normalizeText(`${r.clientName} ${r.phone}`);
      const commentText = normalizeText(`${r.comment} ${r.dish}`);
      const catalogName =
        serverCatalog.find(
          item => normalizeText(item.id) === normalizeText(r.registeredBy)
        )?.name || "";
      const serverText = normalizeText(`${r.registeredBy} ${catalogName}`);
      return searchScope === "clients"
        ? clientText.includes(query)
        : searchScope === "comments"
          ? commentText.includes(query)
          : searchScope === "servers"
            ? serverText.includes(query)
            : `${clientText} ${commentText} ${serverText}`.includes(query);
    });
  }, [records, qualityFilter, search, searchScope, serverCatalog]);
  const answered = filtered.filter(r => hasScoredQuality(r.quality));
  const good = answered.filter(r => clean(r.quality) === "bueno").length;
  const regular = answered.filter(r => clean(r.quality) === "regular").length;
  const bad = answered.filter(r => clean(r.quality) === "malo").length;
  const positive = answered.length ? good / answered.length : 0;
  const comments = filtered.filter(r => r.comment.trim());
  const reviewCount = filtered.filter(
    r => clean(r.quality) === "regular" || clean(r.quality) === "malo"
  ).length;
  const clientCount = new Set(filtered.map(clientKeyOf)).size;
  const birthdays = useMemo(
    () =>
      records
        .filter(r => isBirthdayInNextDays(r.birthday))
        .filter(
          (r, i, a) => a.findIndex(x => clientKeyOf(x) === clientKeyOf(r)) === i
        ),
    [records]
  );
  const servers = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, number>>((acc, r) => {
          const name = displayServer(r.registeredBy);
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {})
      )
        .filter(([name]) => name !== "DELIVERY / WEB")
        .sort((a, b) => b[1] - a[1]),
    [filtered]
  );
  const profiles = useMemo(() => buildProfiles(filtered), [filtered]);
  const riskCount = profiles.filter(
    profile => profile.segment === "En riesgo"
  ).length;
  const topicPhrases = useMemo(() => buildTopicPhrases(comments), [comments]);
  const positiveHighlights = useMemo(
    () => buildPositiveHighlights(comments),
    [comments]
  );
  const negativeHighlights = useMemo(
    () => buildNegativeHighlights(comments),
    [comments]
  );
  const persistedPriorities = (prioritiesQuery.data ??
    []) as PriorityPersisted[];
  const rawOverdueCount = useMemo(
    () =>
      countOverduePriorities(records, birthdays, profiles, persistedPriorities),
    [birthdays, persistedPriorities, profiles, records]
  );
  const priorityCount = Math.min(5, riskCount + birthdays.length);
  const overdueCount = rawOverdueCount;
  const pendingTaskCount = persistedPriorities.filter(
    priority => priority.status !== "done"
  ).length;
  const isAdmin = user?.role === "admin";
  const canViewCustomers = isAdmin || Boolean(user?.canViewCustomers);
  const canManageCalls = isAdmin || Boolean(user?.canManageCalls);
  const canManageTargets = isAdmin || Boolean(user?.canManageTargets);
  const canManageUsers = isAdmin || Boolean(user?.canManageUsers);
  const canViewAudit = isAdmin || Boolean(user?.canViewAudit);
  const visibleTabs = tabs.filter(tab => {
    if (tab.id === "administracion") return isAdmin;
    if (tab.id === "clients") return canViewCustomers;
    if (tab.id === "calls") return canManageCalls;
    if (tab.id === "responsibles") return canManageUsers;
    if (tab.id === "targetHistory") return canViewAudit || canManageTargets;
    return true;
  });
  useEffect(() => {
    if (!visibleTabs.some(tab => tab.id === page)) setPage("overview");
  }, [
    page,
    isAdmin,
    canViewCustomers,
    canManageCalls,
    canManageTargets,
    canManageUsers,
    canViewAudit,
  ]);
  const navGroups: { label: string; ids: Page[] }[] = [
    { label: "ANÁLISIS", ids: ["overview", "voice", "team"] },
    { label: "CLIENTES Y CRM", ids: ["birthdays", "clients", "priorities"] },
    {
      label: "OPERACIÓN",
      ids: ["promotions", "calls", "responsibles", "targetHistory"],
    },
    { label: "CUENTA", ids: ["profile", "administracion"] },
  ];
  const title = tabs.find(t => t.id === page)?.label;
  const navigate = (
    next: Page,
    filter?: string,
    focus: OverviewFocus = null
  ) => {
    setPage(next);
    setPriorityClientKey(null);
    setOverviewFocus(focus);
    if (next === "overview" || focus === "birthdays" || focus === "recover") {
      setSearch("");
      setSearchScope("all");
      setQualityFilter("Todos");
    } else if (filter) setQualityFilter(filter);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openPriorityClient = (key: string) => {
    setPage("clients");
    setPriorityClientKey(key);
    setOverviewFocus(null);
    setSearch("");
    setQualityFilter("Todos");
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const exportCsv = () => downloadCsv(filtered);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const isSearching = Boolean(search.trim());
  const showGlobalFilters = [
    "overview",
    "priorities",
    "clients",
    "voice",
    "team",
  ].includes(page);
  if (authLoading)
    return (
      <div className="loading-screen">
        <img
          className="loading-logo"
          src="/manus-storage/logo1_5c69b281.png"
          alt="Coronel"
        />
        <p>Verificando sesión segura…</p>
      </div>
    );
  if (!user)
    return (
      <div className="auth-wall">
        <div className="auth-wall-card">
          <img
            className="loading-logo"
            src="/manus-storage/logo1_5c69b281.png"
            alt="Coronel"
          />
          <Pill tone="blue">ACCESO RESTRINGIDO</Pill>
          <h1>Inicia sesión para continuar</h1>
          <p>
            El reporte contiene información de clientes, llamadas y desempeño
            interno. Necesitas una cuenta autorizada para consultar el
            dashboard.
          </p>
          <button
            className="login-button auth-wall-button"
            onClick={() => startLogin()}
          >
            Iniciar sesión seguro
          </button>
        </div>
      </div>
    );
  if (isLoading)
    return (
      <div className="loading-screen">
        <img
          className="loading-logo"
          src="/manus-storage/logo1_5c69b281.png"
          alt="Coronel"
        />
        <p>Cargando datos desde Google Sheets…</p>
      </div>
    );
  if (error)
    return (
      <div className="loading-screen">
        <div className="brand-mark">!</div>
        <h2>No se pudo leer la hoja</h2>
        <p>{error.message}</p>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/manus-storage/logo1_5c69b281.png"
            alt="Coronel · Pollos y Parrillas"
          />
          <span className="brand-tagline">Sistema de gestión</span>
        </div>
        <div className="side-label">REPORTE</div>
        <nav className="grouped-sidebar-nav">
          {navGroups.map(group => {
            const groupTabs = group.ids
              .map(id => visibleTabs.find(tab => tab.id === id))
              .filter(Boolean) as typeof visibleTabs;
            if (!groupTabs.length) return null;
            return (
              <div className="nav-section" key={group.label}>
                <div className="nav-section-label">{group.label}</div>
                {groupTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={`nav-item ${page === id ? "active" : ""}`}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {id === "overview" && priorityCount > 0 && (
                      <span
                        className="nav-badge alert-badge"
                        aria-label={`${priorityCount} alertas`}
                      >
                        {priorityCount > 99 ? "99+" : priorityCount}
                      </span>
                    )}
                    {id === "birthdays" && birthdays.length > 0 && (
                      <span
                        className="nav-badge birthday-badge"
                        aria-label={`${birthdays.length} cumpleaños próximos`}
                      >
                        {birthdays.length > 99 ? "99+" : birthdays.length}
                      </span>
                    )}
                    {id === "priorities" && pendingTaskCount > 0 && (
                      <span
                        className="nav-badge task-badge"
                        aria-label={`${pendingTaskCount} tareas pendientes`}
                      >
                        {pendingTaskCount > 99 ? "99+" : pendingTaskCount}
                      </span>
                    )}
                    {page === id && (
                      <ChevronRight size={15} className="nav-arrow" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="live-dot" />
          <div>
            <b>Conectado</b>
            <span>Google Sheets</span>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="breadcrumb">
              RESTAURANTE CORONEL <span>/</span> REPORTE ANALÍTICO
            </p>
            <h1>{title}</h1>
            <p className="muted">
              Actualización automática cada 5 minutos · {data?.source}
            </p>
          </div>
          <div className="top-actions">
            <label className="source-selector">
              <span>Fuente</span>
              <select
                value={sourceTab}
                onChange={e =>
                  setSourceTab(e.target.value as "original" | "limpia")
                }
              >
                <option value="original">Encuestas (pruebas)</option>
                <option value="limpia">Encuestas_Limpias</option>
              </select>
            </label>
            <span className="sync-status">
              <span className="live-dot" />
              {isFetching
                ? "Actualizando…"
                : `Actualizado ${new Date(data?.fetchedAt ?? Date.now()).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
            <Button
              variant="outline"
              className="refresh-button"
              onClick={() => refetch()}
            >
              <RefreshCw size={16} className={isFetching ? "spin" : ""} />{" "}
              Actualizar
            </Button>
            <div
              className={`account-control ${user ? "account-signed-in" : "account-signed-out"}`}
            >
              {user ? (
                <>
                  <span className="account-status">
                    <span className="account-dot" />
                    Sesión iniciada
                    <strong>{user.name || user.email || "Usuario"}</strong>
                  </span>
                  <button className="logout-button" onClick={() => logout()}>
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <span className="account-status">
                    <span className="account-dot offline" />
                    Sin sesión
                  </span>
                  <button className="login-button" onClick={() => startLogin()}>
                    Iniciar sesión
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
        {sourceTab === "original" && (
          <div className="test-data-warning" role="status" aria-live="polite">
            <div className="test-data-warning-icon">
              <AlertTriangle size={22} />
            </div>
            <div>
              <strong>ESTÁS VIENDO DATOS DE PRUEBA</strong>
              <p>
                La pestaña <b>Encuestas</b> contiene los registros originales de
                prueba. Para usar datos reales o limpios, cambia la fuente a{" "}
                <b>Encuestas_Limpias</b>.
              </p>
            </div>
            <button
              className="test-data-warning-action"
              onClick={() => setSourceTab("limpia")}
            >
              Cambiar a datos reales
            </button>
          </div>
        )}
        <div className="mobile-nav-wrap">
          <div className="mobile-nav-label">
            <LayoutDashboard size={14} /> NAVEGACIÓN DEL REPORTE
          </div>
          <button
            className="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-expanded={mobileMenuOpen}
          >
            <span>{tabs.find(t => t.id === page)?.label}</span>
            <ChevronDown size={16} className={mobileMenuOpen ? "rotate" : ""} />
          </button>
          {mobileMenuOpen && (
            <div className="mobile-nav-menu">
              {navGroups.flatMap(group => {
                const groupTabs = group.ids
                  .map(id => visibleTabs.find(tab => tab.id === id))
                  .filter(Boolean) as typeof visibleTabs;
                return groupTabs.length
                  ? [
                      <div
                        className="mobile-nav-section-label"
                        key={`${group.label}-label`}
                      >
                        {group.label}
                      </div>,
                      ...groupTabs.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => navigate(id)}
                          className={page === id ? "selected" : ""}
                        >
                          <Icon size={16} />
                          {label}
                          {id === "overview" && priorityCount > 0 && (
                            <span className="nav-badge alert-badge">
                              {priorityCount > 99 ? "99+" : priorityCount}
                            </span>
                          )}
                          {id === "birthdays" && birthdays.length > 0 && (
                            <span className="nav-badge birthday-badge">
                              {birthdays.length > 99 ? "99+" : birthdays.length}
                            </span>
                          )}
                          {id === "priorities" && pendingTaskCount > 0 && (
                            <span className="nav-badge task-badge">
                              {pendingTaskCount > 99 ? "99+" : pendingTaskCount}
                            </span>
                          )}
                        </button>
                      )),
                    ]
                  : [];
              })}
            </div>
          )}
        </div>
        <div className="print-report-header">
          <img src="/manus-storage/logo1_5c69b281.png" alt="Coronel" />
          <div>
            <strong>CORONEL · REPORTE ANALÍTICO</strong>
            <span id="print-report-filters">
              Sin filtros de fecha adicionales
            </span>
          </div>
        </div>
        <div className="content">
          {showGlobalFilters && (
            <FilterBar
              search={search}
              setSearch={setSearch}
              searchScope={searchScope}
              setSearchScope={setSearchScope}
              qualityFilter={qualityFilter}
              setQualityFilter={setQualityFilter}
              resultCount={filtered.length}
              onReset={() => {
                setSearch("");
                setSearchScope("all");
                setQualityFilter("Todos");
              }}
              onCsv={exportCsv}
              onPdf={() => setPdfPreviewOpen(true)}
            />
          )}
          {isSearching ? (
            <SearchResults
              records={filtered}
              query={search}
              scope={searchScope}
            />
          ) : (
            <>
              {page === "overview" && (
                <Overview
                  records={filtered}
                  positive={positive}
                  good={good}
                  regular={regular}
                  bad={bad}
                  comments={comments.length}
                  clients={clientCount}
                  birthdays={birthdays}
                  profiles={profiles}
                  logs={(callsQuery.data ?? []) as CallLog[]}
                  promotions={(promotionsQuery.data ?? []) as PromotionItem[]}
                  campaigns={
                    (birthdayCampaignsQuery.data ?? []) as BirthdayCampaign[]
                  }
                  riskCount={riskCount}
                  priorityCount={priorityCount}
                  overdueCount={overdueCount}
                  onNavigate={navigate}
                  onOpenClient={openPriorityClient}
                />
              )}
              {page === "birthdays" && (
                <BirthdayPage
                  records={records}
                  profiles={profiles}
                  logs={(callsQuery.data ?? []) as CallLog[]}
                  promotions={(promotionsQuery.data ?? []) as PromotionItem[]}
                  campaigns={
                    (birthdayCampaignsQuery.data ?? []) as BirthdayCampaign[]
                  }
                  templates={
                    (messageTemplatesQuery.data ?? []) as MessageTemplateItem[]
                  }
                  onNavigate={navigate}
                />
              )}
              {page === "priorities" && (
                <Priorities
                  logs={(callsQuery.data ?? []) as CallLog[]}
                  records={filtered}
                  birthdays={birthdays.filter(
                    r =>
                      !search ||
                      normalizeText(
                        `${r.clientName} ${r.phone} ${r.birthday}`
                      ).includes(normalizeText(search))
                  )}
                  profiles={profiles}
                  persisted={persistedPriorities}
                  systemUsers={
                    (responsibleUsersQuery.data ?? []) as ResponsibleUser[]
                  }
                  audit={(auditQuery.data ?? []) as AuditItem[]}
                  onNavigate={navigate}
                  onOpenClient={openPriorityClient}
                />
              )}
              {page === "clients" && (
                <Clients
                  onNavigate={navigate}
                  records={filtered}
                  allRecords={records}
                  birthdays={birthdays}
                  profiles={profiles}
                  logs={(callsQuery.data ?? []) as CallLog[]}
                  promotions={(promotionsQuery.data ?? []) as PromotionItem[]}
                  focus={overviewFocus}
                  focusClientKey={priorityClientKey}
                  search={search}
                  setSearch={setSearch}
                  qualityFilter={qualityFilter}
                  setQualityFilter={setQualityFilter}
                  onReset={() => {
                    setSearch("");
                    setSearchScope("all");
                    setQualityFilter("Todos");
                  }}
                  onBackToPriorities={() => {
                    setPriorityClientKey(null);
                    setPage("priorities");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {page === "voice" && (
                <Voice
                  comments={comments}
                  reviewCount={reviewCount}
                  topicPhrases={topicPhrases}
                  positiveHighlights={positiveHighlights}
                  negativeHighlights={negativeHighlights}
                  positive={positive}
                  positiveCount={answered.length}
                />
              )}
              {page === "team" && (
                <Team
                  onNavigate={navigate}
                  records={filtered}
                  catalog={serverCatalog}
                />
              )}
              {page === "promotions" && (
                <PromotionsAdmin
                  promotions={
                    (promotionsAdminQuery.data ?? []) as PromotionItem[]
                  }
                  audit={(auditQuery.data ?? []) as AuditItem[]}
                />
              )}
              {page === "calls" && (
                <CallsHistory
                  logs={(callsQuery.data ?? []) as CallLog[]}
                  search={search}
                  isAdmin={isAdmin}
                  onNavigate={navigate}
                  promotions={
                    (promotionsAdminQuery.data ?? []) as PromotionItem[]
                  }
                />
              )}
              {page === "responsibles" && (
                <ResponsibleAdmin
                  users={
                    (responsibleAdminQuery.data ?? []) as ResponsibleUser[]
                  }
                  audit={(auditQuery.data ?? []) as AuditItem[]}
                />
              )}
              {page === "targetHistory" &&
                (canViewAudit || canManageTargets) && (
                  <TargetHistory
                    history={
                      (targetHistoryQuery.data ?? []) as TargetHistoryItem[]
                    }
                    records={records}
                    catalog={serverCatalog}
                    audit={(auditQuery.data ?? []) as AuditItem[]}
                  />
                )}
              {page === "profile" && <Profile user={user} onLogout={logout} />}
              {page === "administracion" && isAdmin && (
                <AccessAdmin
                  users={(accessUsersQuery.data ?? []) as AccessUser[]}
                  audit={(auditQuery.data ?? []) as AuditItem[]}
                />
              )}
            </>
          )}
        </div>
        <footer className="footer">
          <span>
            Fuente: hoja Encuestas de Google Sheets · {filtered.length}{" "}
            registros filtrados
          </span>
          <span>Datos personales: acceso restringido al equipo autorizado</span>
        </footer>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegación principal">
        {[
          { id: "overview" as Page, label: "Hoy", icon: LayoutDashboard },
          { id: "birthdays" as Page, label: "Cumples", icon: Cake },
          { id: "clients" as Page, label: "Clientes", icon: Users },
          { id: "calls" as Page, label: "Llamadas", icon: Phone },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          className={
            !["overview", "birthdays", "clients", "calls"].includes(page) ||
            mobileMenuOpen
              ? "active"
              : ""
          }
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Más opciones"
        >
          <Menu size={19} />
          <span>Más</span>
        </button>
      </nav>
      {mobileMenuOpen && (
        <div
          className="mobile-more-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="mobile-more-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Más opciones"
            onClick={event => event.stopPropagation()}
          >
            <div className="mobile-more-head">
              <b>Más opciones</b>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mobile-more-grid">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={page === id ? "selected" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <PdfPreviewModal
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        records={filtered}
        positive={positive}
        good={good}
        regular={regular}
        bad={bad}
        profiles={profiles}
        areaLabel={title || "Centro de acción"}
        filterLabel={`Calidad: ${qualityFilter} · Búsqueda: ${search || "sin búsqueda"}`}
      />
    </div>
  );
}

function Profile({
  user,
  onLogout,
}: {
  user: SystemUser | null;
  onLogout: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"account" | "sessions">("account");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const utils = trpc.useUtils();
  const sessionsQuery = trpc.auth.sessions.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const updateAvatar = trpc.profile.updateAvatar.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
  const sessions = (sessionsQuery.data ?? []) as SessionEvent[];
  return (
    <>
      <div className="page-intro profile-intro">
        <div>
          <Pill tone="blue">CUENTA</Pill>
          <h2>Mi perfil</h2>
          <p>
            Consulta tu identidad, imagen, permisos y actividad reciente en
            Coronel.
          </p>
        </div>
        <div className="intro-note">
          <Users size={17} />
          <span>
            <b>{user ? "Sesión autenticada" : "Sin sesión"}</b>
            <small>
              {user
                ? "Los cambios administrativos quedarán asociados a tu usuario."
                : "Inicia sesión para registrar cambios con tu nombre."}
            </small>
          </span>
        </div>
      </div>
      <div className="profile-tabs" role="tablist">
        <button
          className={tab === "account" ? "active" : ""}
          onClick={() => setTab("account")}
        >
          <ShieldCheck size={16} />
          Cuenta y acceso
        </button>
        <button
          className={tab === "sessions" ? "active" : ""}
          onClick={() => setTab("sessions")}
        >
          <History size={16} />
          Historial de sesiones <Pill tone="neutral">{sessions.length}</Pill>
        </button>
      </div>
      {tab === "account" ? (
        <>
          <section className="panel profile-panel">
            <div className="profile-avatar profile-avatar-symbol">
              {avatarSymbol(user?.avatarPreset)}
            </div>
            <div className="profile-details">
              <p className="eyebrow">DATOS DE LA CUENTA</p>
              <h3>{user?.name || "Usuario no identificado"}</h3>
              <p>
                {user?.email ||
                  "El proveedor de acceso no entregó correo visible."}
              </p>
              <div className="profile-badges">
                <Pill tone={user?.role === "admin" ? "green" : "blue"}>
                  {user?.role === "admin" ? "Administrador" : "Usuario"}
                </Pill>
                <Pill tone={user ? "green" : "orange"}>
                  {user ? "Sesión activa" : "Sesión no iniciada"}
                </Pill>
              </div>
            </div>
            {user ? (
              <button
                className="logout-button profile-logout"
                onClick={() => onLogout()}
              >
                Cerrar sesión
              </button>
            ) : (
              <button
                className="login-button profile-login"
                onClick={() => startLogin()}
              >
                Iniciar sesión
              </button>
            )}
          </section>
          {user && (
            <section className="panel avatar-picker-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">IDENTIDAD VISUAL</p>
                  <h3>Elige tu imagen de perfil</h3>
                  <small className="muted">
                    Selecciona una imagen prediseñada para identificarte en el
                    dashboard.
                  </small>
                </div>
                <Pill tone="blue">Sin contraseña local</Pill>
              </div>
              <button
                className="avatar-open-button"
                onClick={() => setAvatarPickerOpen(true)}
              >
                <span>{avatarSymbol(user.avatarPreset)}</span>
                <span>
                  <b>Cambiar imagen de perfil</b>
                  <small>Selecciona una identidad prediseñada</small>
                </span>
                <ChevronRight size={16} />
              </button>
              {updateAvatar.isSuccess && (
                <div className="success-notice">
                  ✓ Imagen de perfil actualizada.
                </div>
              )}
              {updateAvatar.error && (
                <div className="admin-feedback error">
                  No se pudo guardar la imagen: {updateAvatar.error.message}
                </div>
              )}
              {avatarPickerOpen && (
                <div
                  className="modal-backdrop"
                  onClick={() => setAvatarPickerOpen(false)}
                >
                  <div
                    className="avatar-picker-modal"
                    onClick={event => event.stopPropagation()}
                  >
                    <div className="modal-head">
                      <div>
                        <p className="eyebrow">IDENTIDAD VISUAL</p>
                        <h3>Elige tu imagen</h3>
                        <p className="muted">
                          La ventana se cerrará al guardar tu selección.
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => setAvatarPickerOpen(false)}
                        aria-label="Cerrar selector"
                      >
                        ×
                      </button>
                    </div>
                    <div className="avatar-choice-grid">
                      {avatarChoices.map(choice => (
                        <button
                          key={choice}
                          className={`avatar-choice ${user.avatarPreset === choice ? "selected" : ""}`}
                          onClick={() => {
                            updateAvatar.mutate({ avatarPreset: choice });
                            setAvatarPickerOpen(false);
                          }}
                          disabled={updateAvatar.isPending}
                        >
                          <span>{avatarSymbol(choice)}</span>
                          <small>
                            {choice === "coronel"
                              ? "Coronel"
                              : choice === "chef"
                                ? "Chef"
                                : choice === "flame"
                                  ? "Energía"
                                  : choice === "leaf"
                                    ? "Calidad"
                                    : choice === "star"
                                      ? "Estrella"
                                      : "Protección"}
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          <section className="panel profile-security">
            <p className="eyebrow">SEGURIDAD Y ACCESO</p>
            <h3>Contraseña y recuperación</h3>
            <p>
              El dashboard utiliza el inicio de sesión seguro de OAuth. No
              guarda contraseñas locales ni puede verlas; la activación,
              recuperación y cambio de contraseña se gestionan en el proveedor
              de tu cuenta.
            </p>
            {user?.role === "admin" && (
              <p className="muted">
                Puedes gestionar roles, permisos y estado de las cuentas desde{" "}
                <b>Administración</b>.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="panel session-history-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">TRAZABILIDAD DE ACCESO</p>
              <h3>Últimos inicios y cierres de sesión</h3>
              <small className="muted">
                Se registra la fecha, acción, navegador y dirección técnica
                disponible.
              </small>
            </div>
            <Pill tone="blue">{sessions.length} eventos</Pill>
          </div>
          {user ? (
            sessions.length ? (
              <div className="session-list">
                {sessions.map(event => (
                  <div className="session-row" key={event.id}>
                    <span className={`session-event-icon ${event.action}`}>
                      <History size={15} />
                    </span>
                    <span>
                      <b>
                        {event.action === "login"
                          ? "Inicio de sesión"
                          : "Cierre de sesión"}
                      </b>
                      <small>
                        {formatDateTime(event.createdAt)} ·{" "}
                        {event.userAgent || "Navegador no informado"}
                      </small>
                    </span>
                    <Pill tone={event.action === "login" ? "green" : "neutral"}>
                      {event.action === "login" ? "Entró" : "Salió"}
                    </Pill>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Aún no hay eventos de sesión registrados." />
            )
          ) : (
            <div className="session-empty">
              <History size={23} />
              <b>Inicia sesión para consultar tu historial.</b>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function QualityResult({
  tone,
  label,
  count,
  total,
}: {
  tone: "great" | "neutral" | "bad";
  label: string;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="quality-result">
      <Face tone={tone} size="lg" />
      <b>{label}</b>
      <strong>{pct}%</strong>
      <span>
        {count} respuesta{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}
function SurveyChart({ records }: { records: RecordItem[] }) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const grouped = useMemo(() => {
    const map: Record<
      string,
      { label: string; salon: number; delivery: number; date: Date }
    > = {};
    records.forEach(r => {
      const d = parseDate(r.timestamp);
      if (!d) return;
      const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      let key = "",
        label = "";
      if (period === "day") {
        key = date.toISOString().slice(0, 10);
        label = new Intl.DateTimeFormat("es-PE", {
          day: "2-digit",
          month: "short",
        }).format(date);
      } else if (period === "week") {
        const monday = new Date(date);
        monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        key = monday.toISOString().slice(0, 10);
        label = `Sem. ${new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(monday)}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        label = new Intl.DateTimeFormat("es-PE", {
          month: "short",
          year: "2-digit",
        }).format(date);
      }
      map[key] ??= { label, salon: 0, delivery: 0, date };
      if (channelOf(r) === "Salón") map[key].salon += 1;
      else map[key].delivery += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, total: v.salon + v.delivery }));
  }, [records, period]);
  const rows = grouped.slice(
    period === "day" ? -14 : period === "week" ? -8 : -6
  );
  const max = Math.max(...rows.map(r => r.total), 1);
  const current = rows.slice(-1)[0]?.total ?? 0;
  const previous = rows.slice(-2, -1)[0]?.total ?? 0;
  const delta =
    period === "day"
      ? null
      : previous
        ? Math.round(((current - previous) / previous) * 100)
        : null;
  return (
    <section className="panel survey-chart-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">VOLUMEN DE ENCUESTAS</p>
          <h3>Respuestas por periodo y canal</h3>
          <small className="muted">
            Comparativa vs. periodo anterior:{" "}
            {delta === null
              ? "aún no hay base comparable"
              : `${delta >= 0 ? "+" : ""}${delta}%`}
          </small>
        </div>
        <div className="period-controls">
          {[
            ["day", "Día"],
            ["week", "Semana"],
            ["month", "Mes"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={period === value ? "selected" : ""}
              onClick={() => setPeriod(value as "day" | "week" | "month")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-dot salon" />
          Salón
        </span>
        <span>
          <i className="legend-dot delivery" />
          Delivery / web
        </span>
      </div>
      {rows.length ? (
        <div
          className="survey-chart"
          role="img"
          aria-label="Encuestas por periodo y canal"
        >
          {rows.map(r => (
            <div className="chart-column" key={r.label}>
              <div className="chart-bars">
                <span
                  className="bar-salon"
                  style={{
                    height: `${Math.max((r.salon / max) * 100, r.salon ? 6 : 0)}%`,
                  }}
                />
                <span
                  className="bar-delivery"
                  style={{
                    height: `${Math.max((r.delivery / max) * 100, r.delivery ? 6 : 0)}%`,
                  }}
                />
              </div>
              <b>{r.total}</b>
              <small>{r.label}</small>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No hay fechas válidas para graficar." />
      )}
    </section>
  );
}
function SearchResults({
  records,
  query,
  scope,
}: {
  records: RecordItem[];
  query: string;
  scope: SearchScope;
}) {
  const scopeLabel =
    scope === "clients"
      ? "clientes"
      : scope === "comments"
        ? "comentarios"
        : scope === "servers"
          ? "meseros"
          : "todos los campos";
  const groupedClients = Array.from(
    new Map(records.map(record => [clientKeyOf(record), record])).values()
  );
  const exportResults = () =>
    downloadGenericCsv(
      `busqueda-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Fecha",
        "Cliente",
        "Teléfono",
        "Producto",
        "Comentario",
        "Mesero",
        "Calidad",
      ],
      records.map(record => [
        record.timestamp,
        record.clientName,
        record.phone,
        record.dish,
        record.comment,
        record.registeredBy,
        record.quality,
      ])
    );
  return (
    <>
      <div className="page-intro search-only-intro">
        <div>
          <Pill tone="blue">BÚSQUEDA ACTIVA</Pill>
          <h2>Resultados para “{query}”</h2>
          <p>
            El resto del dashboard está oculto mientras buscas. Elimina la
            búsqueda para volver a la vista anterior.
          </p>
        </div>
        <div className="intro-note">
          <Search size={17} />
          <span>
            <b>{records.length} resultado(s)</b>
            <small>Filtro aplicado: {scopeLabel}.</small>
          </span>
        </div>
      </div>
      {records.length ? (
        <>
          <div className="stats-grid">
            <Stat
              label="RESULTADOS"
              value={records.length}
              detail="encuestas coincidentes"
              icon={Search}
            />
            <Stat
              label="CLIENTES"
              value={groupedClients.length}
              detail="contactos encontrados"
              accent="purple"
              icon={Users}
            />
            <Stat
              label="COMENTARIOS"
              value={records.filter(record => record.comment.trim()).length}
              detail="con texto coincidente"
              accent="orange"
              icon={MessageSquareText}
            />
          </div>
          <section className="panel search-results-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">DETALLE DE RESULTADOS</p>
                <h3>Solo información relacionada con tu búsqueda</h3>
              </div>
              <div className="export-group">
                <button onClick={exportResults}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={() => printReport()}>
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Producto</th>
                    <th>Comentario</th>
                    <th>Mesero / canal</th>
                    <th>Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td>{formatDateTime(record.timestamp)}</td>
                      <td>
                        <b>{record.clientName || "Sin nombre"}</b>
                      </td>
                      <td>{record.phone || "—"}</td>
                      <td>{record.dish || "—"}</td>
                      <td>{record.comment || "—"}</td>
                      <td>{displayServer(record.registeredBy)}</td>
                      <td>{record.quality || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="panel search-empty-panel">
          <Search size={26} />
          <h3>No encontramos resultados</h3>
          <p>
            Prueba con otro nombre, teléfono, comentario, producto o mesero.
          </p>
        </section>
      )}
    </>
  );
}
function PdfPreviewModal({
  open,
  onClose,
  records,
  positive,
  good,
  regular,
  bad,
  profiles,
  areaLabel,
  filterLabel,
}: {
  open: boolean;
  onClose: () => void;
  records: RecordItem[];
  positive: number;
  good: number;
  regular: number;
  bad: number;
  profiles: ClientProfile[];
  areaLabel: string;
  filterLabel: string;
}) {
  const [sections, setSections] = useState({
    metrics: true,
    comparison: true,
    products: true,
    clients: true,
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  if (!open) return null;
  const scopedRecords = records.filter(record => {
    const date = parseDate(record.timestamp);
    if (!date) return !fromDate && !toDate;
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  const scopedAnswered = scopedRecords.filter(record => clean(record.quality));
  const scopedGood = scopedAnswered.filter(
    record => clean(record.quality) === "bueno"
  ).length;
  const scopedRegular = scopedAnswered.filter(
    record => clean(record.quality) === "regular"
  ).length;
  const scopedBad = scopedAnswered.filter(
    record => clean(record.quality) === "malo"
  ).length;
  const scopedPositive = scopedAnswered.length
    ? scopedGood / scopedAnswered.length
    : 0;
  const scopedProfiles = buildProfiles(scopedRecords);
  const productMap: Record<
    string,
    { count: number; good: number; answered: number }
  > = {};
  scopedRecords.forEach(record => {
    const name = record.dish.trim() || "Sin producto";
    productMap[name] ??= { count: 0, good: 0, answered: 0 };
    productMap[name].count += 1;
    if (["bueno", "regular", "malo"].includes(clean(record.quality))) {
      productMap[name].answered += 1;
      if (clean(record.quality) === "bueno") productMap[name].good += 1;
    }
  });
  const products = Object.entries(productMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);
  const risky = scopedProfiles
    .filter(profile => profile.segment === "En riesgo")
    .slice(0, 8);
  const trend =
    scopedGood >= scopedBad
      ? "Predomina la percepción positiva frente a las clasificaciones malas."
      : "Las clasificaciones malas superan a las positivas y requieren seguimiento.";
  const dateLabel = `${fromDate || "inicio"} – ${toDate || "hoy"}`;
  const summary = `En ${dateLabel} se registraron ${scopedRecords.length} encuestas, con ${Math.round(scopedPositive * 100)}% de calidad positiva. ${trend}`;
  const toggle = (key: keyof typeof sections) =>
    setSections(current => ({ ...current, [key]: !current[key] }));
  return (
    <div className="modal-backdrop pdf-preview-backdrop" onClick={onClose}>
      <div
        className="pdf-preview-modal"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">EXPORTACIÓN PDF</p>
            <h3>Vista previa del reporte</h3>
            <p className="muted">
              Selecciona contenido y rango antes de descargarlo.
            </p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            ×
          </button>
        </div>
        <div className="pdf-preview-layout">
          <aside className="pdf-section-picker">
            <b>Contenido del PDF</b>
            <label className="pdf-date-field">
              <span>Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={event => setFromDate(event.target.value)}
              />
            </label>
            <label className="pdf-date-field">
              <span>Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={event => setToDate(event.target.value)}
              />
            </label>
            {(
              [
                ["metrics", "Métricas ejecutivas"],
                ["comparison", "Comparación mensual"],
                ["products", "Productos y calidad"],
                ["clients", "Clientes a recuperar"],
              ] as [keyof typeof sections, string][]
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={sections[key]}
                  onChange={() => toggle(key)}
                />
                <span>{label}</span>
              </label>
            ))}
            <small>
              La vista previa y las métricas se actualizan al instante.
            </small>
          </aside>
          <div className="pdf-preview-sheet">
            <div className="pdf-preview-brand">
              <img src="/manus-storage/logo1_5c69b281.png" alt="Coronel" />
              <div>
                <b>CORONEL · REPORTE DE SATISFACCIÓN</b>
                <small>
                  Área: {areaLabel} · Rango: {dateLabel} · {filterLabel}
                </small>
              </div>
            </div>
            <section className="pdf-preview-summary">
              <strong>Lectura ejecutiva</strong>
              <span>{summary}</span>
            </section>
            {sections.metrics && (
              <section className="pdf-preview-section">
                <h4>Resumen ejecutivo</h4>
                <div className="pdf-preview-metrics">
                  <span>
                    <b>{scopedRecords.length}</b>
                    <small>Encuestas</small>
                  </span>
                  <span>
                    <b>{Math.round(scopedPositive * 100)}%</b>
                    <small>Calidad positiva</small>
                  </span>
                  <span>
                    <b>{scopedBad}</b>
                    <small>Clasificaciones malas</small>
                  </span>
                  <span>
                    <b>
                      {
                        scopedProfiles.filter(
                          profile => profile.segment === "Fiel"
                        ).length
                      }
                    </b>
                    <small>Clientes fieles</small>
                  </span>
                </div>
              </section>
            )}
            {sections.comparison && (
              <section className="pdf-preview-section">
                <h4>Comparación mensual acumulada</h4>
                <p>
                  Encuestas con calidad:{" "}
                  {scopedGood + scopedRegular + scopedBad} · Bueno: {scopedGood}{" "}
                  · Regular: {scopedRegular} · Malo: {scopedBad}
                </p>
              </section>
            )}
            {sections.products && (
              <section className="pdf-preview-section">
                <h4>Productos más consumidos y mejor valorados</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Encuestas</th>
                      <th>Bueno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(([name, value]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{value.count}</td>
                        <td>
                          {value.answered
                            ? `${Math.round((value.good / value.answered) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {sections.clients && (
              <section className="pdf-preview-section">
                <h4>Clientes a recuperar</h4>
                {risky.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Calidad</th>
                        <th>Último comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risky.map(profile => (
                        <tr key={profile.key}>
                          <td>{profile.name}</td>
                          <td>{profile.quality || "—"}</td>
                          <td>{profile.comment || "Sin comentario"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No hay clientes a recuperar con los filtros actuales.</p>
                )}
              </section>
            )}
          </div>
        </div>
        <div className="modal-actions pdf-preview-actions">
          <button className="secondary-action" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="small-action"
            onClick={() =>
              printReport(
                `Área: ${areaLabel} · Rango: ${dateLabel} · ${filterLabel}`
              )
            }
          >
            <FileText size={15} /> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
function FilterBar({
  search,
  setSearch,
  searchScope,
  setSearchScope,
  qualityFilter,
  setQualityFilter,
  resultCount,
  onReset,
  onCsv,
  onPdf,
}: {
  search: string;
  setSearch: (v: string) => void;
  searchScope: SearchScope;
  setSearchScope: (v: SearchScope) => void;
  qualityFilter: string;
  setQualityFilter: (v: string) => void;
  resultCount: number;
  onReset: () => void;
  onCsv: () => void;
  onPdf: () => void;
}) {
  const scopes: [SearchScope, string][] = [
    ["all", "Todo"],
    ["clients", "Clientes"],
    ["comments", "Comentarios"],
    ["servers", "Meseros"],
  ];
  return (
    <div className="filter-bar global-filter-bar">
      <div className="search-box">
        <Search size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente, comentario, producto, mesero o teléfono…"
        />
      </div>
      {search && (
        <div className="search-result-scopes">
          <label>
            Buscar en
            <select
              value={searchScope}
              onChange={e => setSearchScope(e.target.value as SearchScope)}
            >
              {scopes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <b>
              {resultCount} resultado{resultCount === 1 ? "" : "s"}
            </b>
          </label>
        </div>
      )}
      <label className="filter-select-wrap">
        <span>Calidad</span>
        <select
          value={qualityFilter}
          onChange={e => setQualityFilter(e.target.value)}
        >
          {["Todos", "Bueno", "Regular", "Malo", "Sin calificar"].map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button className="reset-button" onClick={onReset}>
        Limpiar
      </button>
      <div className="export-group">
        <button title="Descargar CSV" onClick={onCsv}>
          <Download size={14} /> CSV
        </button>
        <button title="Imprimir o guardar como PDF" onClick={onPdf}>
          <FileText size={14} /> PDF
        </button>
      </div>
    </div>
  );
}
function countOverduePriorities(
  records: RecordItem[],
  birthdays: RecordItem[],
  profiles: ClientProfile[],
  persisted: PriorityPersisted[]
) {
  const now = Date.now();
  const saved = (key: string) =>
    persisted.find(item => item.priorityKey === key);
  const dueForRisk = (profile: ClientProfile) => {
    const latest = records
      .filter(record => clientKeyOf(record) === profile.key)
      .sort(
        (a, b) =>
          (parseDate(b.timestamp)?.getTime() || 0) -
          (parseDate(a.timestamp)?.getTime() || 0)
      )[0];
    const date = latest ? parseDate(latest.timestamp) : null;
    return date
      ? date.getTime() + (clean(profile.quality) === "malo" ? 2 : 4) * 86400000
      : now;
  };
  const riskOverdue = profiles
    .filter(profile => profile.segment === "En riesgo")
    .filter(profile => {
      const item = saved(`risk-${profile.key}`);
      return (
        item?.status !== "done" &&
        new Date(item?.dueDate ?? dueForRisk(profile)).getTime() < now
      );
    }).length;
  const birthdayOverdue = birthdays.filter(record => {
    const key = `birthday-${clientKeyOf(record)}`;
    const birthday = parseBirthdayDate(record.birthday);
    const defaultDate = birthday
      ? new Date(
          new Date().getFullYear(),
          birthday.getMonth(),
          birthday.getDate()
        )
      : new Date();
    const item = saved(key);
    return (
      item?.status !== "done" &&
      new Date(item?.dueDate ?? defaultDate).getTime() < now
    );
  }).length;
  return riskOverdue + birthdayOverdue;
}

type BirthdayHorizonKey = "mes" | "semana" | "dia" | "seguimiento";
type BirthdayFilter = "todos" | BirthdayHorizonKey | "vencidas" | "reintentar";
type BirthdayMarketingItem = {
  record: RecordItem;
  target: Date;
  days: number;
  plan: { label: string; text: string; tone: string };
  profile?: ClientProfile;
  promotion: string;
  template: string;
};
type MessageTemplateItem = { key: string; name: string; body: string };

const BIRTHDAY_HORIZONS: {
  key: BirthdayHorizonKey;
  label: string;
  when: string;
  hint: string;
}[] = [
  { key: "dia", label: "0–3 días", when: "Próximos 3 días", hint: "Confirmar y activar" },
  {
    key: "semana",
    label: "4–7 días",
    when: "Próxima semana",
    hint: "Sembrar expectativa y reservar",
  },
  {
    key: "mes",
    label: "8–30 días",
    when: "Este mes",
    hint: "Validar datos y planificar",
  },
  {
    key: "seguimiento",
    label: "Pasadas",
    when: "Ya pasó",
    hint: "Agradecer, recuperar y medir",
  },
];

const BIRTHDAY_TEMPLATE_KEYS: Record<BirthdayHorizonKey, string> = {
  mes: "mes",
  semana: "semana",
  dia: "dia",
  seguimiento: "seguimiento",
};

const FALLBACK_TEMPLATES: Record<string, string> = {
  mes: "Hola {nombre} 👋 En Coronel estamos preparando algo especial por tu cumpleaños del {fecha}. ¿Te gustaría que te reservemos un detalle? Beneficio: {beneficio}.",
  semana:
    "Hola {nombre}, falta menos de una semana para tu cumpleaños. Tenemos una sorpresa preparada para ti: {beneficio}. ¿Te la reservamos para el salón o para delivery?",
  dia: "¡Feliz cumpleaños, {nombre}! 🎉 Hoy te espera tu {beneficio} en Coronel. ¿Te reservamos mesa para celebrar?",
  seguimiento:
    "Gracias por celebrar con nosotros, {nombre} 🎂 ¿Nos cuentas cómo fue tu experiencia? Nos ayuda a atenderte mejor la próxima vez.",
};

function birthdayHorizonOf(days: number): BirthdayHorizonKey {
  if (days < 0) return "seguimiento";
  if (days <= 3) return "dia";
  if (days <= 7) return "semana";
  return "mes";
}

function daysLabel(days: number) {
  if (days === 0) return "¡Hoy!";
  if (days === 1) return "Mañana";
  if (days > 1) return `Faltan ${days} días`;
  return `Hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
}

function stageForDays(days: number): CampaignStage {
  return days < 0
    ? "past"
    : days === 0
      ? "today"
      : days === 1
        ? "tomorrow"
        : days <= 3
          ? "soon"
          : "week";
}

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateInputToIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function offsetDateInput(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function renderBirthdayTemplate(
  body: string,
  context: {
    name: string;
    date: string;
    promotion: string;
    dish: string;
  }
) {
  return body
    .replaceAll("{nombre}", context.name)
    .replaceAll("{fecha}", context.date)
    .replaceAll("{beneficio}", context.promotion)
    .replaceAll("{plato}", context.dish)
    .replaceAll("{negocio}", "Coronel");
}

function BirthdayWorkspace({
  items,
  records,
  profiles,
  logs,
  promotions,
  campaigns,
  templates,
  monthName,
  selectedDate,
  onClearDate,
}: {
  items: BirthdayMarketingItem[];
  records: RecordItem[];
  profiles: ClientProfile[];
  logs: CallLog[];
  promotions: PromotionItem[];
  campaigns: BirthdayCampaign[];
  templates: MessageTemplateItem[];
  monthName: string;
  selectedDate: string | null;
  onClearDate: () => void;
}) {
  const utils = trpc.useUtils();
  const createCall = trpc.calls.create.useMutation({
    onSuccess: async () => {
      await utils.calls.list.invalidate();
    },
  });
  const saveCampaign = trpc.birthdayCampaigns.save.useMutation({
    onSuccess: async () => {
      await utils.birthdayCampaigns.list.invalidate();
    },
  });
  const saveTemplate = trpc.messageTemplates.save.useMutation({
    onSuccess: async () => {
      await utils.messageTemplates.list.invalidate();
      setTemplateSaved(true);
      window.setTimeout(() => setTemplateSaved(false), 2200);
    },
  });
  const [filter, setFilter] = useState<BirthdayFilter>("todos");
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [callKey, setCallKey] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [historySection, setHistorySection] = useState<"summary" | "contacts">("summary");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState("mes");
  const [templateDraft, setTemplateDraft] = useState("");
  const [templateSaved, setTemplateSaved] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const campaignByKey = useMemo(
    () => new Map(campaigns.map(campaign => [campaign.clientKey, campaign])),
    [campaigns]
  );
  const templateByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const template of templates) map.set(template.key, template.body);
    for (const [key, body] of Object.entries(FALLBACK_TEMPLATES)) {
      if (!map.has(key)) map.set(key, body);
    }
    return map;
  }, [templates]);

  const todayStart = useMemo(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, []);

  const rows = useMemo(
    () =>
      items.map(item => {
        const key = clientKeyOf(item.record);
        const campaign = campaignByKey.get(key);
        const clientLogs = logs.filter(log => log.clientKey === key);
        const progress = campaign?.progressStatus ?? "pending";
        const contacted =
          progress === "contacted" || progress === "accepted" || progress === "redeemed";
        const accepted = progress === "accepted" || progress === "redeemed";
        const redeemed = progress === "redeemed";
        const noanswer = progress === "noanswer";
        const attempts = clientLogs.filter(log =>
          normalizeText(log.outcome).includes("no contest")
        ).length;
        const callAttempts = clientLogs.length;
        const lastAttemptAt = clientLogs.reduce<Date | null>((latest, log) => {
          const date = new Date(log.callDate);
          if (Number.isNaN(date.getTime())) return latest;
          return !latest || date > latest ? date : latest;
        }, null);
        return {
          item,
          key,
          campaign,
          progress,
          horizon: birthdayHorizonOf(item.days),
          contacted,
          accepted,
          redeemed,
          noanswer,
          attempts,
          callAttempts,
          lastAttemptAt,
        };
      }),
    [items, logs, campaignByKey]
  );

  const rowsByKey = useMemo(
    () => new Map(rows.map(row => [row.key, row])),
    [rows]
  );

  const nextActionDateOf = (campaign?: BirthdayCampaign) =>
    campaign?.nextActionAt ? new Date(campaign.nextActionAt) : null;
  const isOverdueRow = (row: (typeof rows)[number]) => {
    const next = nextActionDateOf(row.campaign);
    return Boolean(next && next < todayStart && !row.redeemed && row.item.days >= 0);
  };
  const isRetryRow = (row: (typeof rows)[number]) =>
    row.attempts > 0 && !row.redeemed;

  const counts = useMemo(
    () => ({
      todos: rows.length,
      dia: rows.filter(row => row.horizon === "dia").length,
      semana: rows.filter(row => row.horizon === "semana").length,
      mes: rows.filter(row => row.horizon === "mes").length,
      seguimiento: rows.filter(row => row.horizon === "seguimiento").length,
      vencidas: rows.filter(isOverdueRow).length,
      reintentar: rows.filter(isRetryRow).length,
    }),
    [rows]
  );

  const todayCount = rows.filter(row => row.item.days === 0).length;
  const contactedCount = rows.filter(row => row.contacted).length;
  const acceptedCount = rows.filter(row => row.accepted).length;
  const redeemedCount = rows.filter(row => row.redeemed).length;
  const pendingCount = rows.filter(row => !row.contacted).length;

  const weekDays = useMemo(() => {
    const day = todayStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart);
      date.setDate(date.getDate() + mondayOffset + index);
      const iso = toDateInputValue(date);
      const count = rows.filter(
        row => toDateInputValue(row.item.target) === iso
      ).length;
      return {
        iso,
        label: date.toLocaleDateString("es-PE", { weekday: "short" }),
        day: date.getDate(),
        isToday: iso === toDateInputValue(todayStart),
        count,
      };
    });
  }, [rows, todayStart]);
  const weekCount = weekDays.reduce((total, day) => total + day.count, 0);

  const overdueCount = counts.vencidas;

  const filteredRows = rows.filter(row => {
    if (filter === "vencidas") {
      if (!isOverdueRow(row)) return false;
    } else if (filter === "reintentar") {
      if (!isRetryRow(row)) return false;
    } else if (filter !== "todos" && row.horizon !== filter) {
      return false;
    }
    if (onlyPending && row.contacted) return false;
    if (selectedDate) {
      if (toDateInputValue(row.item.target) !== selectedDate) return false;
    }
    const search = normalizeText(query.trim());
    if (search) {
      const haystack = normalizeText(
        `${row.item.record.clientName} ${row.item.record.phone} ${
          row.campaign?.promotion || row.item.promotion
        }`
      );
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const groups = BIRTHDAY_HORIZONS.map(horizon => ({
    ...horizon,
    rows: filteredRows
      .filter(row => row.horizon === horizon.key)
      .sort((a, b) => a.item.days - b.item.days),
  })).filter(group => group.rows.length > 0);

  const selectedDateText = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-PE", {
        day: "numeric",
        month: "long",
      })
    : "";

  const promoteFor = (row: (typeof rows)[number]) =>
    row.campaign?.promotion || row.item.promotion;

  const templateFor = (row: (typeof rows)[number]) =>
    templateByKey.get(BIRTHDAY_TEMPLATE_KEYS[row.horizon]) ??
    FALLBACK_TEMPLATES[row.horizon];

  const messageFor = (row: (typeof rows)[number]) => {
    const item = row.item;
    const name = (item.record.clientName || "").trim().split(/\s+/)[0] || "amigo";
    const date = item.target.toLocaleDateString("es-PE", {
      day: "numeric",
      month: "long",
    });
    return renderBirthdayTemplate(templateFor(row), {
      name,
      date,
      promotion: promoteFor(row),
      dish: item.profile?.dish || "tu plato favorito",
    });
  };

  const persist = (
    row: (typeof rows)[number],
    patch: Partial<{
      promotion: string;
      responsible: string;
      nextActionAt: string | null;
      nextActionLabel: string;
      familyName: string;
      familyBirthday: string;
      noRedeemReason: string;
      channel: CampaignChannel;
      progressStatus: "pending" | "contacted" | "accepted" | "redeemed" | "rejected" | "noanswer";
    }>
  ) => {
    const campaign = row.campaign;
    saveCampaign.mutate(
      {
        clientKey: row.key,
        clientName:
          row.item.record.clientName ||
          row.item.profile?.name ||
          "Cliente sin nombre",
        phone: row.item.record.phone || row.item.profile?.phone || undefined,
        stage: campaign?.stage ?? stageForDays(row.item.days),
        channel: patch.channel ?? campaign?.channel ?? "whatsapp",
        progressStatus: patch.progressStatus ?? campaign?.progressStatus ?? "pending",
        promotion: patch.promotion ?? campaign?.promotion ?? row.item.promotion,
        responsible: patch.responsible ?? campaign?.responsible ?? "Cajera",
        nextActionAt:
          patch.nextActionAt !== undefined
            ? patch.nextActionAt
            : campaign?.nextActionAt
              ? new Date(campaign.nextActionAt).toISOString()
              : null,
        nextActionLabel:
          patch.nextActionLabel ?? campaign?.nextActionLabel ?? undefined,
        familyName: patch.familyName ?? campaign?.familyName ?? undefined,
        familyBirthday:
          patch.familyBirthday ?? campaign?.familyBirthday ?? undefined,
        noRedeemReason:
          patch.noRedeemReason ?? campaign?.noRedeemReason ?? undefined,
      },
      {
        onSuccess: () => {
          setSavedKey(row.key);
          window.setTimeout(() => setSavedKey(null), 1800);
        },
      }
    );
  };

  const registerCall = (
    row: (typeof rows)[number],
    status: "contacted" | "accepted" | "redeemed" | "rejected" | "noanswer"
  ) => {
    const item = row.item;
    // Volver a pulsar el estado activo lo desmarca y regresa a "pendiente".
    if (row.progress === status) {
      persist(row, {
        progressStatus: "pending",
        ...(status === "noanswer"
          ? { nextActionAt: null, nextActionLabel: "" }
          : {}),
        ...(status === "rejected" ? { noRedeemReason: "" } : {}),
      });
      return;
    }
    const clearingRetry =
      status !== "noanswer" && row.campaign?.nextActionLabel === "Reintentar llamada";
    const reason =
      status === "rejected"
        ? window.prompt(
            "Motivo (precio, distancia, no vino, otro):",
            "No vino"
          ) || "No especificado"
        : undefined;
    createCall.mutate({
      clientKey: row.key,
      clientName:
        item.record.clientName || item.profile?.name || "Cliente sin nombre",
      phone: item.record.phone || item.profile?.phone || undefined,
      outcome:
        status === "contacted"
          ? "Contactado"
          : status === "accepted"
            ? "Promoción aceptada"
            : status === "redeemed"
              ? "Promoción redimida"
              : status === "rejected"
                ? "No redimido"
                : "No contestó",
      promotion: promoteFor(row),
      promotionRedeemed: status === "redeemed",
      campaignStage: stageForDays(item.days),
      campaignChannel: "whatsapp",
      recoveryResult:
        status === "redeemed"
          ? "Promoción redimida"
          : status === "accepted"
            ? "Promoción aceptada"
            : status === "rejected"
              ? `No redimido: ${reason}`
              : status === "noanswer"
                ? "No contestó"
                : "Por cumpleaños",
      notes:
        status === "noanswer"
          ? "No contestó · reintentar seguimiento"
          : reason
            ? `Motivo: ${reason}`
            : `Mensaje: ${messageFor(row)}`,
    });
    if (status === "rejected" && reason) {
      persist(row, {
        noRedeemReason: reason,
        progressStatus: "rejected",
        ...(clearingRetry
          ? { nextActionAt: null, nextActionLabel: "" }
          : {}),
      });
    } else if (status === "noanswer") {
      persist(row, {
        progressStatus: "noanswer",
        nextActionAt: dateInputToIso(offsetDateInput(1)),
        nextActionLabel: "Reintentar llamada",
      });
    } else {
      persist(row, {
        progressStatus: status,
        ...(clearingRetry
          ? { nextActionAt: null, nextActionLabel: "" }
          : {}),
      });
    }
    setSavedKey(row.key);
    window.setTimeout(() => setSavedKey(null), 1800);
  };

  const copyMessage = async (row: (typeof rows)[number]) => {
    try {
      await navigator.clipboard.writeText(messageFor(row));
      setCopiedKey(row.key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      window.prompt("Copia el mensaje:", messageFor(row));
    }
  };

  const openTemplates = () => {
    const first = templates.find(item => item.key === "mes");
    setActiveTemplate("mes");
    setTemplateDraft(first?.body ?? FALLBACK_TEMPLATES.mes);
    setTemplatesOpen(true);
  };

  const switchTemplate = (key: string) => {
    setActiveTemplate(key);
    const found = templates.find(item => item.key === key);
    setTemplateDraft(found?.body ?? FALLBACK_TEMPLATES[key] ?? "");
  };

  const callRow = callKey ? rowsByKey.get(callKey) : undefined;
  const historyRow = historyKey ? rowsByKey.get(historyKey) : undefined;

  useEffect(() => {
    if (!historyKey || historySection !== "contacts") return;
    const target = document.getElementById("bw-history-contacts");
    if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [historyKey, historySection]);
  const historyRecords = historyRow
    ? records.filter(item => clientKeyOf(item) === historyRow.key)
    : [];
  const historyLogs = historyRow
    ? logs.filter(log => log.clientKey === historyRow.key)
    : [];

  const chipButton = (key: BirthdayFilter, label: string) => (
    <button
      key={key}
      className={`bw-chip ${filter === key ? "active" : ""} bw-chip-${key}`}
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
    >
      {label} <b>{counts[key]}</b>
    </button>
  );

  return (
    <section className="panel bw-panel">
      <div className="bw-metrics">
        <div className="bw-metric bw-metric-total">
          <small>Cumpleaños en {monthName}</small>
          <b>{counts.todos}</b>
          <span>{pendingCount} sin contactar</span>
        </div>
        <div className="bw-metric bw-metric-week">
          <small>Esta semana</small>
          <b>{weekCount}</b>
          <span>lunes a domingo</span>
        </div>
        <div className="bw-metric bw-metric-today">
          <small>Hoy</small>
          <b>{todayCount}</b>
          <span>felicitar y activar</span>
        </div>
        <div className="bw-metric bw-metric-contact">
          <small>Contactados</small>
          <b>{contactedCount}</b>
          <span>de {counts.todos} del mes</span>
        </div>
        <div className="bw-metric bw-metric-redeem">
          <small>Redimidos</small>
          <b>{redeemedCount}</b>
          <span>beneficio usado</span>
        </div>
      </div>

      <div className="bw-funnel">
        <div className="bw-funnel-step">
          <small>Base del mes</small>
          <b>{counts.todos}</b>
          <span className="bw-bar"><i style={{ width: "100%" }} /></span>
        </div>
        <div className="bw-funnel-step">
          <small>Contactados</small>
          <b>{contactedCount}</b>
          <span className="bw-bar"><i style={{ width: `${counts.todos ? Math.round((contactedCount / counts.todos) * 100) : 0}%` }} /></span>
        </div>
        <div className="bw-funnel-step">
          <small>Aceptaron</small>
          <b>{acceptedCount}</b>
          <span className="bw-bar"><i style={{ width: `${counts.todos ? Math.round((acceptedCount / counts.todos) * 100) : 0}%` }} /></span>
        </div>
        <div className="bw-funnel-step">
          <small>Redimieron</small>
          <b>{redeemedCount}</b>
          <span className="bw-bar"><i style={{ width: `${counts.todos ? Math.round((redeemedCount / counts.todos) * 100) : 0}%` }} /></span>
        </div>
        {overdueCount > 0 && (
          <button
            className="bw-funnel-alert"
            onClick={() => setFilter("vencidas")}
          >
            ⚠ {overdueCount} próxima(s) acción(es) vencida(s) · ver cuáles
          </button>
        )}
      </div>

      <div className="bw-filters">
        <div className="bw-chips">
          {chipButton("todos", "Todos")}
          {chipButton("dia", "0–3 d")}
          {chipButton("semana", "4–7 d")}
          {chipButton("mes", "8–30 d")}
          {chipButton("seguimiento", "Pasadas")}
          {counts.vencidas > 0 && chipButton("vencidas", "Vencidas")}
          {counts.reintentar > 0 &&
            chipButton("reintentar", "Reintentar")}
        </div>
        <label className="bw-search">
          <Search size={14} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar cliente, teléfono o promoción…"
          />
        </label>
        <button
          className={`bw-pending-toggle ${onlyPending ? "active" : ""}`}
          onClick={() => setOnlyPending(value => !value)}
          aria-pressed={onlyPending}
        >
          Solo sin contactar
        </button>
        {selectedDate && (
          <button className="bw-clear-date" onClick={onClearDate}>
            Filtrando: {selectedDateText} · Ver todo ✕
          </button>
        )}
        <button className="bw-templates-button" onClick={openTemplates}>
          Editar mensajes de WhatsApp
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bw-empty">
          <Cake size={22} />
          <b>No hay cumpleaños para este filtro</b>
          <small>
            Cambia de etapa, limpia la búsqueda o revisa otro mes del
            calendario.
          </small>
        </div>
      ) : (
        groups.map(group => (
          <div className={`bw-group bw-group-${group.key}`} key={group.key}>
            <div className="bw-group-head">
              <span className={`bw-dot bw-dot-${group.key}`} />
              <b>{group.label}</b>
              <small>
                {group.when} · {group.hint}
              </small>
              <span className="bw-group-count">{group.rows.length}</span>
            </div>
            <div className="bw-list">
              {group.rows.map(row => {
                const item = row.item;
                const campaign = row.campaign;
                const phone = (
                  item.record.phone ||
                  item.profile?.phone ||
                  ""
                ).replace(/\D/g, "");
                const whatsappNumber =
                  phone.length === 9 && phone.startsWith("9")
                    ? `51${phone}`
                    : phone;
                const whatsappHref = whatsappNumber
                  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageFor(row))}`
                  : "";
                const date = item.target.toLocaleDateString("es-PE", {
                  day: "2-digit",
                  month: "short",
                });
                const expanded = expandedKey === row.key;
                const nextActionValue = toDateInputValue(campaign?.nextActionAt);
                const nextActionOverdue =
                  campaign?.nextActionAt &&
                  new Date(campaign.nextActionAt) < todayStart &&
                  row.item.days >= 0;
                return (
                  <article
                    className={`bw-card bw-card-${row.horizon} ${expanded ? "is-expanded" : ""}`}
                    key={row.key}
                  >
                    <div className="bw-card-top">
                      <div className="bw-date">
                        <b>{date.split(" ")[0]}</b>
                        <small>{date.split(" ")[1]?.replace(".", "")}</small>
                      </div>
                      <div className="bw-main">
                        <div className="bw-title">
                          <b>
                            {item.record.clientName || "Cliente sin nombre"}
                          </b>
                          {item.profile?.segment && (
                            <Pill
                              tone={
                                item.profile.segment === "Fiel"
                                  ? "green"
                                  : "blue"
                              }
                            >
                              {item.profile.segment}
                            </Pill>
                          )}
                          <span className="bw-days">
                            {daysLabel(item.days)}
                          </span>
                          {campaign?.nextActionAt ? (
                            <button
                              className={`bw-next ${nextActionOverdue ? "overdue" : ""}`}
                              onClick={() => setExpandedKey(row.key)}
                              title="Editar próxima acción"
                            >
                              ⏰{" "}
                              {campaign.nextActionLabel ||
                                "Próxima acción"}
                              :{" "}
                              {new Date(campaign.nextActionAt).toLocaleDateString(
                                "es-PE",
                                { day: "2-digit", month: "short" }
                              )}
                              {nextActionOverdue ? " · vencida" : ""}
                            </button>
                          ) : (
                            <button
                              className="bw-next empty"
                              onClick={() => setExpandedKey(row.key)}
                            >
                              + Programar próxima acción
                            </button>
                          )}
                          <span className="bw-attempts">
                            {row.callAttempts > 0
                              ? `☎ ${row.callAttempts} intento${row.callAttempts === 1 ? "" : "s"}${
                                  row.lastAttemptAt
                                    ? ` · último ${row.lastAttemptAt.toLocaleDateString(
                                        "es-PE",
                                        { day: "2-digit", month: "short" }
                                      )}`
                                    : ""
                                }`
                              : "Sin llamadas registradas"}
                          </span>
                          <button
                            className="bw-history-link"
                            onClick={() => {
                              setHistoryKey(row.key);
                              setHistorySection("contacts");
                            }}
                          >
                            Ver historial
                          </button>
                        </div>
                        <div className="bw-meta">
                          {item.record.phone || "Sin teléfono"} ·{" "}
                          {promoteFor(row)}
                          {campaign?.responsible
                            ? ` · ${campaign.responsible}`
                            : ""}
                        </div>
                        <div className="bw-status">
                          <button
                            className={row.contacted ? "active" : ""}
                            disabled={createCall.isPending}
                            onClick={() => registerCall(row, "contacted")}
                          >
                            ✓ Contactado
                          </button>
                          <button
                            className={row.accepted ? "active" : ""}
                            disabled={createCall.isPending}
                            onClick={() => registerCall(row, "accepted")}
                          >
                            ★ Aceptó
                          </button>
                          <button
                            className={row.redeemed ? "active" : ""}
                            disabled={createCall.isPending}
                            onClick={() => registerCall(row, "redeemed")}
                          >
                            ● Redimió
                          </button>
                          <button
                            className={campaign?.noRedeemReason ? "warn" : ""}
                            disabled={createCall.isPending}
                            onClick={() => registerCall(row, "rejected")}
                          >
                            ✕ No redimió
                          </button>
                          <button
                            className={row.noanswer ? "warn active" : ""}
                            disabled={createCall.isPending}
                            onClick={() => registerCall(row, "noanswer")}
                          >
                            ☎ No contestó
                          </button>
                        </div>
                        {campaign?.noRedeemReason && (
                          <div className="bw-reason">
                            Motivo: {campaign.noRedeemReason}
                          </div>
                        )}
                        {savedKey === row.key && (
                          <div className="bw-saved">✓ Cambios guardados</div>
                        )}
                      </div>
                      <div className="bw-actions">
                        {whatsappHref ? (
                          <a
                            className="bw-action bw-action-whatsapp"
                            href={whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageSquareText size={13} /> WhatsApp
                          </a>
                        ) : (
                          <span className="bw-action is-disabled">
                            Sin teléfono
                          </span>
                        )}
                        <button
                          className="bw-action"
                          onClick={() => setCallKey(row.key)}
                        >
                          <Phone size={13} /> Llamar
                        </button>
                        <button
                          className="bw-action"
                          onClick={() => {
                            setHistoryKey(row.key);
                            setHistorySection("summary");
                          }}
                        >
                          Ver ficha
                        </button>
                        <button
                          className="bw-action bw-action-copy"
                          onClick={() => copyMessage(row)}
                        >
                          {copiedKey === row.key ? "✓ Copiado" : "Copiar"}
                        </button>
                        <button
                          className="bw-action bw-action-edit"
                          onClick={() =>
                            setExpandedKey(expanded ? null : row.key)
                          }
                          aria-expanded={expanded}
                        >
                          {expanded ? "Cerrar" : "Ajustar"}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="bw-edit">
                        <label>
                          <span>Promoción ofrecida</span>
                          <select
                            value={promoteFor(row)}
                            onChange={event =>
                              persist(row, { promotion: event.target.value })
                            }
                          >
                            {promotions.map(promotion => (
                              <option
                                key={promotion.id}
                                value={promotion.name}
                              >
                                {promotion.name}
                              </option>
                            ))}
                            {!promotions.some(
                              promotion =>
                                promotion.name === promoteFor(row)
                            ) && (
                              <option value={promoteFor(row)}>
                                {promoteFor(row)}
                              </option>
                            )}
                          </select>
                        </label>
                        <label>
                          <span>Responsable</span>
                          <input
                            defaultValue={campaign?.responsible ?? "Cajera"}
                            key={`resp-${row.key}-${campaign?.responsible ?? ""}`}
                            onBlur={event =>
                              persist(row, {
                                responsible: event.target.value.trim(),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Próxima acción</span>
                          <input
                            type="date"
                            value={nextActionValue}
                            onChange={event =>
                              persist(row, {
                                nextActionAt: dateInputToIso(
                                  event.target.value
                                ),
                              })
                            }
                          />
                          <span className="bw-quick-dates">
                            {[1, 3, 7, 14].map(days => (
                              <button
                                key={days}
                                type="button"
                                onClick={() =>
                                  persist(row, {
                                    nextActionAt: dateInputToIso(
                                      offsetDateInput(days)
                                    ),
                                  })
                                }
                              >
                                +{days}d
                              </button>
                            ))}
                          </span>
                        </label>
                        <label>
                          <span>Familiar (nombre)</span>
                          <input
                            defaultValue={campaign?.familyName ?? ""}
                            key={`fam-${row.key}-${campaign?.familyName ?? ""}`}
                            placeholder="Si está en la nota"
                            onBlur={event =>
                              persist(row, {
                                familyName: event.target.value.trim(),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Cumpleaños familiar</span>
                          <input
                            type="date"
                            defaultValue={campaign?.familyBirthday ?? ""}
                            key={`famb-${row.key}-${campaign?.familyBirthday ?? ""}`}
                            onChange={event =>
                              persist(row, {
                                familyBirthday: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Canal</span>
                          <select
                            value={campaign?.channel ?? "whatsapp"}
                            onChange={event =>
                              persist(row, {
                                channel: event.target.value as CampaignChannel,
                              })
                            }
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="llamada">Llamada</option>
                            <option value="correo">Correo</option>
                            <option value="sms">SMS</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))
      )}

      {callRow && (
        <div className="bw-modal-backdrop" onClick={() => setCallKey(null)}>
          <div className="bw-modal" onClick={event => event.stopPropagation()}>
            <div className="bw-modal-head">
              <h3>Llamar a {callRow.item.record.clientName || "cliente"}</h3>
              <button onClick={() => setCallKey(null)}>×</button>
            </div>
            <p className="bw-modal-phone">
              {callRow.item.record.phone || "Sin teléfono registrado"}
            </p>
            {callRow.item.record.phone && (
              <div className="bw-modal-actions">
                <a
                  className="bw-action bw-action-whatsapp"
                  href={`tel:+${callRow.item.record.phone.replace(/\D/g, "").length === 9 ? "51" : ""}${callRow.item.record.phone.replace(/\D/g, "")}`}
                >
                  <Phone size={13} /> Llamar ahora
                </a>
                <button
                  className="bw-action"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        callRow.item.record.phone || ""
                      );
                    } catch {
                      window.prompt("Número:", callRow.item.record.phone || "");
                    }
                  }}
                >
                  Copiar número
                </button>
              </div>
            )}
            <p className="bw-modal-hint">
              En computadora el enlace de llamada puede no abrir nada: copia el
              número y márcalo desde el teléfono del restaurante.
            </p>
            <div className="bw-modal-register">
              <b>Registrar resultado</b>
              <div className="bw-status">
                <button onClick={() => { registerCall(callRow, "contacted"); setCallKey(null); }}>
                  ✓ Contactado
                </button>
                <button onClick={() => { registerCall(callRow, "accepted"); setCallKey(null); }}>
                  ★ Aceptó
                </button>
                <button onClick={() => { registerCall(callRow, "redeemed"); setCallKey(null); }}>
                  ● Redimió
                </button>
                <button onClick={() => { registerCall(callRow, "rejected"); setCallKey(null); }}>
                  ✕ No redimió
                </button>
                <button onClick={() => { registerCall(callRow, "noanswer"); setCallKey(null); }}>
                  ☎ No contestó · reintentar mañana
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {historyRow && (
        <div className="bw-modal-backdrop" onClick={() => setHistoryKey(null)}>
          <div className="bw-modal bw-modal-wide" onClick={event => event.stopPropagation()}>
            <div className="bw-modal-head">
              <h3>
                Ficha de {historyRow.item.record.clientName || "cliente"}
              </h3>
              <button onClick={() => setHistoryKey(null)}>×</button>
            </div>
            <div className="bw-history-grid">
              <div>
                <small>Teléfono</small>
                <b>{historyRow.item.record.phone || "—"}</b>
              </div>
              <div>
                <small>Cumpleaños</small>
                <b>{historyRow.item.record.birthday || "—"}</b>
              </div>
              <div>
                <small>Segmento</small>
                <b>{historyRow.item.profile?.segment || "—"}</b>
              </div>
              <div>
                <small>Plato favorito</small>
                <b>{historyRow.item.profile?.dish || "—"}</b>
              </div>
              <div>
                <small>Promoción</small>
                <b>{promoteFor(historyRow)}</b>
              </div>
              <div>
                <small>Responsable</small>
                <b>{historyRow.campaign?.responsible || "Cajera"}</b>
              </div>
              <div>
                <small>Próxima acción</small>
                <b>{toDateInputValue(historyRow.campaign?.nextActionAt) || "Sin fecha"}</b>
              </div>
              <div>
                <small>Familiares</small>
                <b>
                  {historyRow.campaign?.familyName
                    ? `${historyRow.campaign.familyName}${historyRow.campaign.familyBirthday ? ` · ${historyRow.campaign.familyBirthday}` : ""}`
                    : "—"}
                </b>
              </div>
            </div>
            <div className="bw-history-columns">
              <div>
                <b>Visitas y encuestas ({historyRecords.length})</b>
                <ul>
                  {historyRecords.slice(-8).reverse().map(record => (
                    <li key={`${record.id}-${record.timestamp}`}>
                      <span>{record.timestamp}</span>
                      <span>{record.quality || "Sin calidad"}</span>
                      <em>{record.comment || record.dish || "Sin comentario"}</em>
                    </li>
                  ))}
                  {!historyRecords.length && <li>Sin visitas registradas.</li>}
                </ul>
              </div>
              <div id="bw-history-contacts">
                <b>Contactos ({historyLogs.length})</b>
                <ul>
                  {historyLogs.slice(-8).reverse().map(log => (
                    <li key={log.id}>
                      <span>
                        {new Date(log.callDate).toLocaleDateString("es-PE")}
                      </span>
                      <span>{log.outcome}</span>
                      <em>{log.recoveryResult || log.notes || ""}</em>
                    </li>
                  ))}
                  {!historyLogs.length && <li>Sin contactos registrados.</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {templatesOpen && (
        <div className="bw-modal-backdrop" onClick={() => setTemplatesOpen(false)}>
          <div className="bw-modal bw-modal-wide" onClick={event => event.stopPropagation()}>
            <div className="bw-modal-head">
              <h3>Mensajes de WhatsApp por etapa</h3>
              <button onClick={() => setTemplatesOpen(false)}>×</button>
            </div>
            <p className="bw-modal-hint">
              Variables: {"{nombre}"}, {"{fecha}"}, {"{beneficio}"},{" "}
              {"{plato}"}. Se reemplazan solas al abrir WhatsApp o copiar.
            </p>
            <div className="bw-playbook-tabs">
              {(["mes", "semana", "dia", "seguimiento"] as const).map(key => (
                <button
                  key={key}
                  className={activeTemplate === key ? "active" : ""}
                  onClick={() => switchTemplate(key)}
                >
                  {key === "dia" ? "Día" : key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
            <textarea
              className="bw-template-textarea"
              value={templateDraft}
              onChange={event => setTemplateDraft(event.target.value)}
              rows={7}
            />
            <div className="bw-modal-actions">
              <button
                className="bw-action bw-action-whatsapp"
                onClick={() =>
                  saveTemplate.mutate({
                    key: activeTemplate as "mes" | "semana" | "dia" | "seguimiento",
                    body: templateDraft,
                  })
                }
                disabled={saveTemplate.isPending}
              >
                {saveTemplate.isPending ? "Guardando…" : "Guardar plantilla"}
              </button>
              {templateSaved && <span className="bw-saved">✓ Guardado</span>}
            </div>
          </div>
        </div>
      )}

      <div className="bw-footer">
        <small>
          Responsable sugerido: <b>cajera</b> en horario de baja demanda.
          WhatsApp ya lleva el mensaje con nombre, fecha, beneficio y plato
          favorito.
        </small>
      </div>
    </section>
  );
}

function buildBirthdayMarketing(
  records: RecordItem[],
  profiles: ClientProfile[],
  promotions: PromotionItem[],
  monthCursor?: Date
) {
  const now = new Date();
  const viewedMonth = monthCursor ?? now;
  const monthStart = new Date(
    viewedMonth.getFullYear(),
    viewedMonth.getMonth(),
    1
  );
  const monthEnd = new Date(
    viewedMonth.getFullYear(),
    viewedMonth.getMonth() + 1,
    0
  );
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seen = new Set<string>();
  return records
    .map(record => {
      const birthday = parseBirthdayDate(record.birthday);
      if (!birthday) return null;
      const target = new Date(
        viewedMonth.getFullYear(),
        birthday.getMonth(),
        birthday.getDate()
      );
      if (target < monthStart || target > monthEnd) return null;
      const key = clientKeyOf(record);
      if (seen.has(key)) return null;
      seen.add(key);
      const profile = profiles.find(item => item.key === key);
      const days = Math.round(
        (target.getTime() - todayStart.getTime()) / 86400000
      );
      const history = records.filter(item => clientKeyOf(item) === key);
      const favoriteDish = history.reduce<Record<string, number>>(
        (acc, item) => {
          const dish = item.dish.trim();
          if (dish) acc[dish] = (acc[dish] || 0) + 1;
          return acc;
        },
        {}
      );
      const topDish = Object.entries(favoriteDish).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];
      const birthdayPromotion = promotions.find(
        item => item.active && item.category === "cumpleanos"
      )?.name;
      const loyaltyPromotion = promotions.find(
        item => item.active && item.category === "fidelidad"
      )?.name;
      const generalPromotion = promotions.find(
        item => item.active && item.category === "general"
      )?.name;
      const promotion =
        profile?.segment === "Fiel"
          ? loyaltyPromotion ||
            birthdayPromotion ||
            generalPromotion ||
            "Premio cliente fiel"
          : birthdayPromotion || generalPromotion || "Premio de cumpleaños";
      const productHint = topDish
        ? ` Enfocar el beneficio en su preferencia: ${topDish}.`
        : "";
      const firstName =
        (record.clientName || "").trim().split(/\s+/)[0] || "amigo";
      const loyaltyPhrase =
        profile?.segment === "Fiel"
          ? " Como cliente fiel, queremos darte un detalle especial."
          : "";
      const template =
        days < 0
          ? `Hola ${firstName}, esperamos que hayas disfrutado tu cumpleaños. Aún podemos reservarte ${promotion} para tu próxima visita.${productHint}`
          : days === 0
            ? `¡Feliz cumpleaños, ${firstName}! En Restaurante Coronel queremos celebrarte con ${promotion}.${loyaltyPhrase}${productHint}`
            : days === 1
              ? `Hola ${firstName}, mañana es tu cumpleaños. Te hemos reservado ${promotion}. ¿Te gustaría usarlo en el salón o en tu próximo pedido?${productHint}`
              : days <= 3
                ? `Hola ${firstName}, tu cumpleaños se acerca. Queremos prepararte ${promotion}. Confírmanos si prefieres visitarnos o pedir por delivery.${loyaltyPhrase}${productHint}`
                : days <= 7
                  ? `Hola ${firstName}, falta menos de una semana para tu cumpleaños. Tenemos una sorpresa preparada para ti: ${promotion}. ¿Te la reservamos?${productHint}`
                  : `Registrar la oportunidad y programar el primer contacto para ofrecer ${promotion}.`;
      const plan =
        days < 0
          ? {
              label: "Seguimiento",
              text: "Agradecer y extender una segunda oportunidad.",
              tone: "past",
            }
          : days === 0
            ? {
                label: "Hoy",
                text: "Felicitar y activar la promoción con vigencia clara.",
                tone: "today",
              }
            : days <= 3
              ? {
                  label: "Preparar contacto",
                  text: "Enviar recordatorio breve y confirmar canal preferido.",
                  tone: "soon",
                }
              : days <= 7
                ? {
                    label: "Primera activación",
                    text: "Enviar felicitación anticipada sin saturar.",
                    tone: "week",
                  }
                : {
                    label: "Planificar",
                    text: "Reservar beneficio y programar comunicación.",
                    tone: "plan",
                  };
      return { record, target, days, plan, profile, promotion, template };
    })
    .filter(Boolean)
    .sort((a, b) => a!.target.getTime() - b!.target.getTime()) as {
    record: RecordItem;
    target: Date;
    days: number;
    plan: { label: string; text: string; tone: string };
    profile?: ClientProfile;
    promotion: string;
    template: string;
  }[];
}

/**
 * Guía operativa del protocolo de cumpleaños, organizada por horizonte:
 * mes (preparación), semana (expectativa y plan), día (confirmación y
 * activación) y seguimiento (agradecimiento, recuperación y medición).
 */
type BirthdayPlaybookStage = {
  key: string;
  label: string;
  when: string;
  goal: string;
  channel: string;
  steps: string[];
  example: string;
  avoid: string;
};

const BIRTHDAY_PLAYBOOK: BirthdayPlaybookStage[] = [
  {
    key: "mes",
    label: "Mes",
    when: "T-30 a T-21",
    goal: "Preparar el mes y validar que los datos de contacto sean correctos antes de escribir.",
    channel: "Interno (revisión en equipo) · sin contacto al cliente todavía",
    steps: [
      "Revisar la agenda del mes y detectar cumpleaños con teléfono o fecha incompleta.",
      "Definir la vigencia del beneficio: día, semana o mes (puede variar por campaña).",
      "Asignar un responsable para la campaña (la cajera en horario de baja demanda).",
      "Confirmar qué promoción de cumpleaños está activa y su mensaje.",
    ],
    example:
      "Planilla de marzo lista: 14 cumpleaños. Beneficio: postre de cumpleaños, válido la semana del cumpleaños. Responsable: cajera (turno tarde).",
    avoid: "No contactar al cliente en esta etapa: primero valida datos y evita ofrecer algo que no está disponible.",
  },
  {
    key: "semana",
    label: "Semana",
    when: "T-14 y T-7",
    goal: "Sembrar la expectativa y confirmar si celebrará en salón o pedirá delivery.",
    channel: "WhatsApp Business (preferido) o WhatsApp personal · llamada si no responde",
    steps: [
      "T-14: enviar un primer mensaje breve, sin pedir nada más que permiso.",
      "T-7: preguntar salón o delivery, número de personas y horario.",
      "Registrar la respuesta en el seguimiento (contactado / aceptó / no interesado).",
      "Si no responde en 48 h, intentar una llamada corta en horario de atención.",
    ],
    example:
      "Hola {nombre} 👋 En Coronel estamos preparando algo especial para tu cumpleaños del {fecha}. ¿Te gustaría que te reservemos un detalle?",
    avoid: "No enviar más de un mensaje por semana ni repetir promociones que ya enviaron.",
  },
  {
    key: "dia",
    label: "Día",
    when: "T-3, T-1 y el día del cumpleaños",
    goal: "Confirmar la logística y activar la promoción el mismo día.",
    channel: "WhatsApp + llamada de confirmación",
    steps: [
      "T-3: recordar el beneficio y su vigencia; confirmar mesa o pedido.",
      "T-1: confirmar hora, número de personas y preferencia de plato o torta.",
      "Día: felicitar, entregar el detalle y registrar si vino o redimió.",
    ],
    example:
      "¡Feliz cumpleaños, {nombre}! 🎉 Hoy te espera tu {beneficio} en Coronel. ¿Te reservamos mesa para celebrar?",
    avoid: "No olvides decir la vigencia: el cliente debe saber hasta cuándo puede usar el beneficio.",
  },
  {
    key: "seguimiento",
    label: "Seguimiento",
    when: "T+1, T+3 y T+7",
    goal: "Agradecer, recuperar a quien no vino y medir el resultado real.",
    channel: "WhatsApp y llamada",
    steps: [
      "T+1: agradecer la visita y pedir la encuesta (1 minuto).",
      "T+3: si no vino, ofrecer una segunda oportunidad antes de que venza su beneficio.",
      "T+7: registrar el resultado (redimido / no redimido) y el motivo.",
      "Anotar en el comentario del cliente menciones de cumpleaños de familiares (nombre y fecha).",
    ],
    example:
      "Gracias por celebrar con nosotros, {nombre} 🎂 ¿Nos cuentas cómo fue tu experiencia? Nos ayuda a atenderte mejor la próxima vez.",
    avoid: "No cerrar la campaña sin registrar el motivo cuando no se redimió: es el dato que permite mejorar.",
  },
];

function BirthdayPlaybook() {
  const [activeStage, setActiveStage] = useState(BIRTHDAY_PLAYBOOK[0].key);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const stage =
    BIRTHDAY_PLAYBOOK.find(item => item.key === activeStage) ?? BIRTHDAY_PLAYBOOK[0];
  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(stage.example);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el mensaje:", stage.example);
    }
  };
  return (
    <section className={`panel birthday-playbook ${open ? "is-open" : "is-collapsed"}`}>
      <div className="panel-head birthday-playbook-head">
        <div>
          <p className="eyebrow">PROTOCOLO DE CUMPLEAÑOS</p>
          <h3>Qué hacer en cada momento: mes, semana y día</h3>
          <small className="muted">
            Guía para el equipo: cuándo contactar, por qué canal, qué decir y qué
            evitar. Responsable: cajera en horario de baja demanda.
          </small>
        </div>
        <button
          className="secondary-action"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
        >
          {open ? "Ocultar protocolo" : "Ver protocolo del equipo"}
        </button>
      </div>
      {open && (
        <>
          <div className="birthday-playbook-tabs" role="tablist">
            {BIRTHDAY_PLAYBOOK.map(item => (
              <button
                key={item.key}
                role="tab"
                aria-selected={activeStage === item.key}
                className={activeStage === item.key ? "active" : ""}
                onClick={() => setActiveStage(item.key)}
              >
                <b>{item.label}</b>
                <small>{item.when}</small>
              </button>
            ))}
          </div>
          <div className="birthday-playbook-body">
            <div className="birthday-playbook-col">
              <p className="eyebrow">OBJETIVO</p>
              <p>{stage.goal}</p>
              <p className="eyebrow">CANAL</p>
              <p>{stage.channel}</p>
              <p className="eyebrow">NO HACER</p>
              <p className="birthday-playbook-avoid">{stage.avoid}</p>
            </div>
            <div className="birthday-playbook-col">
              <p className="eyebrow">PASOS</p>
              <ul className="birthday-playbook-steps">
                {stage.steps.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
            <div className="birthday-playbook-col example">
              <p className="eyebrow">EJEMPLO DE MENSAJE</p>
              <blockquote>{stage.example}</blockquote>
              <button className="secondary-action" onClick={copyExample}>
                {copied ? "✓ Copiado" : "Copiar mensaje"}
              </button>
            </div>
          </div>
          <p className="birthday-playbook-note">
            Canales disponibles: WhatsApp Business, WhatsApp personal, llamada y
            correo. No hay API de WhatsApp: el mensaje se copia o se abre en
            wa.me. La vigencia del beneficio puede ser día, semana o mes según la
            campaña. Aún no hay meta fija: mide cobertura y redención para
            definirla con datos reales.
          </p>
        </>
      )}
    </section>
  );
}

function BirthdayPage({
  records,
  profiles,
  logs,
  promotions,
  campaigns,
  templates,
  onNavigate,
}: {
  records: RecordItem[];
  profiles: ClientProfile[];
  logs: CallLog[];
  promotions: PromotionItem[];
  campaigns: BirthdayCampaign[];
  templates: MessageTemplateItem[];
  onNavigate: (page: Page, filter?: string, focus?: OverviewFocus) => void;
}) {
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const items = useMemo(
    () => buildBirthdayMarketing(records, profiles, promotions, calendarMonth),
    [records, profiles, promotions, calendarMonth]
  );
  const monthName = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);
  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0
  ).getDate();
  const firstWeekday = (calendarMonth.getDay() + 6) % 7;
  const dateKey = (day: number) =>
    `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const itemDateKey = (item: BirthdayMarketingItem) =>
    `${item.target.getFullYear()}-${String(item.target.getMonth() + 1).padStart(2, "0")}-${String(item.target.getDate()).padStart(2, "0")}`;
  const itemsByDate = useMemo(
    () =>
      items.reduce<Record<string, BirthdayMarketingItem[]>>((acc, item) => {
        const key = itemDateKey(item);
        (acc[key] ??= []).push(item);
        return acc;
      }, {}),
    [items]
  );
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const selectedItems = selectedDate ? (itemsByDate[selectedDate] ?? []) : [];
  const calendarCells = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) => (index < firstWeekday ? null : index - firstWeekday + 1)
  );
  const changeMonth = (offset: number) => {
    setCalendarMonth(
      current => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
    setSelectedDate(null);
  };
  const goToday = () => {
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(null);
  };
  return (
    <>
      <div className="page-intro birthday-page-intro">
        <div>
          <Pill tone="orange">🎂 CUMPLEAÑOS</Pill>
          <h2>Agenda y seguimiento</h2>
          <p>
            Prioriza por día, semana y mes: abre WhatsApp o llama, registra la
            promoción, la próxima acción y el avance de cada cliente.
          </p>
        </div>
        <div className="birthday-toolbar">
          <button
            className="birthday-toolbar-arrow"
            onClick={() => changeMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <b className="birthday-toolbar-month">{monthName}</b>
          <button
            className="birthday-toolbar-arrow"
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
          <button className="birthday-toolbar-action" onClick={goToday}>
            Hoy
          </button>
          <button
            className={`birthday-toolbar-action ${showCalendar ? "active" : ""}`}
            onClick={() => setShowCalendar(value => !value)}
            aria-pressed={showCalendar}
          >
            {showCalendar ? "Ocultar calendario" : "Ver calendario"}
          </button>
        </div>
      </div>

      {showCalendar && (
        <section className="panel birthday-calendar-panel birthday-calendar-compact">
          <div className="panel-head birthday-calendar-head">
            <div>
              <p className="eyebrow">CALENDARIO DEL MES</p>
              <h3>{monthName}</h3>
              <small className="muted">
                Selecciona un día para filtrar el listado de abajo.
              </small>
            </div>
            <div className="birthday-calendar-legend">
              <span className="legend-today">Hoy</span>
              <span className="legend-birthday">Con cumpleaños</span>
              <span className="legend-selected">Seleccionado</span>
              {selectedDate && (
                <button
                  className="birthday-clear-date"
                  onClick={() => setSelectedDate(null)}
                >
                  Ver todo el mes
                </button>
              )}
            </div>
          </div>
          <div className="birthday-calendar-weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="birthday-calendar-grid">
            {calendarCells.map((day, index) => {
              if (!day)
                return (
                  <span
                    className="birthday-calendar-empty"
                    key={`empty-${index}`}
                  />
                );
              const key = dateKey(day);
              const dayItems = itemsByDate[key] ?? [];
              const isToday = key === todayKey;
              const isSelected = selectedDate === key;
              return (
                <button
                  key={key}
                  className={`birthday-calendar-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${dayItems.length ? "has-birthdays" : ""}`}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  aria-label={`${day} de ${monthName}${dayItems.length ? `, ${dayItems.length} cumpleaños` : ""}`}
                  aria-pressed={isSelected}
                >
                  <strong>{day}</strong>
                  {dayItems.length > 0 && (
                    <span className="birthday-calendar-dot" />
                  )}
                  {dayItems.length > 0 && (
                    <small>
                      {dayItems.length}{" "}
                      {dayItems.length === 1 ? "cumple" : "cumples"}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
          {selectedDate && (
            <div className="birthday-selected-day">
              <Cake size={16} />
              <span>
                <b>
                  {selectedItems.length
                    ? `${selectedItems.length} cumpleaños el ${Number(selectedDate.slice(-2))} de ${monthName}`
                    : `Sin cumpleaños el ${Number(selectedDate.slice(-2))} de ${monthName}`}
                </b>
                <small>
                  {selectedItems.length
                    ? selectedItems
                        .map(
                          item =>
                            item.record.clientName || "Cliente sin nombre"
                        )
                        .join(" · ")
                    : "Selecciona otra fecha para revisar la agenda."}
                </small>
              </span>
            </div>
          )}
        </section>
      )}

      <BirthdayWorkspace
        items={items}
        records={records}
        profiles={profiles}
        logs={logs}
        promotions={promotions}
        campaigns={campaigns}
        templates={templates}
        monthName={monthName}
        selectedDate={selectedDate}
        onClearDate={() => setSelectedDate(null)}
      />

      <BirthdayPlaybook />
    </>
  );
}

function Overview({
  records,
  positive,
  good,
  regular,
  bad,
  comments,
  clients,
  birthdays,
  profiles,
  logs,
  promotions,
  campaigns,
  riskCount,
  priorityCount,
  overdueCount,
  onNavigate,
  onOpenClient,
}: {
  records: RecordItem[];
  positive: number;
  good: number;
  regular: number;
  bad: number;
  comments: number;
  clients: number;
  birthdays: RecordItem[];
  profiles: ClientProfile[];
  logs: CallLog[];
  promotions: PromotionItem[];
  campaigns: BirthdayCampaign[];
  riskCount: number;
  priorityCount: number;
  overdueCount: number;
  onNavigate: (page: Page, filter?: string, focus?: OverviewFocus) => void;
  onOpenClient: (key: string) => void;
}) {
  const productStats = useMemo(() => {
    const map: Record<
      string,
      { count: number; good: number; answered: number }
    > = {};
    records.forEach(r => {
      const key = r.dish.trim() || "Sin producto";
      map[key] ??= { count: 0, good: 0, answered: 0 };
      map[key].count += 1;
      if (hasScoredQuality(r.quality)) {
        map[key].answered += 1;
        if (clean(r.quality) === "bueno") map[key].good += 1;
      }
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        ...v,
        score: v.answered ? v.good / v.answered : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [records]);
  const risks = profiles.filter(p => p.segment === "En riesgo");
  const [showDetails, setShowDetails] = useState(false);
  const birthdayMarketing = useMemo(
    () => buildBirthdayMarketing(records, profiles, promotions),
    [records, profiles, promotions]
  );
  const birthdaysToday = birthdayMarketing.filter(item => item.days === 0);
  const answeredCount = good + regular + bad;
  const overallCi = answeredCount ? wilsonInterval(good, answeredCount) : null;
  return (
    <>
      <section className="alert-banner">
        <div className="alert-banner-title">
          <AlertTriangle size={18} />
          <div>
            <p className="eyebrow">ALERTAS QUE REQUIEREN ACCIÓN</p>
            <b>{priorityCount} asunto(s) prioritario(s) detectado(s)</b>
          </div>
        </div>
        <div className="alert-actions">
          <button
            className={
              overdueCount
                ? "alert-card overdue-alert"
                : "alert-card muted-alert"
            }
            onClick={() => onNavigate("priorities")}
          >
            <span>⏰</span>
            <div>
              <b>{overdueCount} prioridad(es) vencida(s)</b>
              <small>Atender ahora</small>
            </div>
            <ChevronRight size={15} />
          </button>
          <button
            className={bad ? "alert-card danger" : "alert-card muted-alert"}
            onClick={() => onNavigate("clients", "Malo", "bad")}
          >
            <span>😞</span>
            <div>
              <b>
                {
                  profiles.filter(profile => clean(profile.quality) === "malo")
                    .length
                }{" "}
                cliente(s) con calidad Mala
              </b>
              <small>Revisar comentario y llamar</small>
            </div>
            <ChevronRight size={15} />
          </button>
          <button
            className={
              birthdays.length
                ? "alert-card birthday-alert"
                : "alert-card muted-alert"
            }
            onClick={() => onNavigate("birthdays")}
          >
            <span>🎂</span>
            <div>
              <b>{birthdays.length} cumpleaños próximo(s)</b>
              <small>Ofrecer promoción esta semana</small>
            </div>
            <ChevronRight size={15} />
          </button>
        </div>
      </section>
      <section className="hero-strip">
        <div>
          <Pill tone="orange">RESUMEN EJECUTIVO</Pill>
          <h2>Decisiones claras, en una sola mirada.</h2>
          <p>
            La experiencia se ve positiva, con oportunidades concretas en
            tiempos, producto y seguimiento de clientes.
          </p>
        </div>
        <QualityFace percent={positive} count={good + regular + bad} />
      </section>
      <div className="stats-grid">
        <Stat
          label="ENCUESTAS"
          value={records.length}
          detail="respuestas recibidas"
          icon={MessageSquareText}
          onClick={() => onNavigate("voice")}
        />
        <Stat
          label="CALIDAD POSITIVA"
          value={`${Math.round(positive * 100)}%`}
          detail={`${good} de ${answeredCount} con respuesta · ${Math.max(0, records.length - answeredCount)} sin calificar${
            overallCi
              ? ` · IC95 ${Math.round(overallCi[0] * 100)}–${Math.round(overallCi[1] * 100)}%`
              : ""
          }`}
          accent="green"
          icon={Sparkles}
          onClick={() => onNavigate("voice")}
        />
        <Stat
          label="CUMPLEAÑOS"
          value={birthdays.length}
          detail="próximos 7 días"
          accent="orange"
          icon={Cake}
          onClick={() => onNavigate("birthdays")}
        />
        <Stat
          label="CLIENTES"
          value={clients}
          detail="contactos identificados"
          accent="purple"
          icon={Users}
          onClick={() => onNavigate("clients")}
        />
      </div>
      <button
        className="details-toggle-button"
        onClick={() => setShowDetails(value => !value)}
        aria-expanded={showDetails}
      >
        <span>
          {showDetails
            ? "Ocultar análisis detallado"
            : "Ver análisis detallado"}
        </span>
        <ChevronDown size={17} className={showDetails ? "rotate" : ""} />
      </button>
      {showDetails && (
        <div className="dashboard-details">
          <div className="dashboard-grid overview-grid">
            <section className="panel quality-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">CALIDAD DEL PRODUCTO</p>
                  <h3>¿Cómo se sienten los clientes?</h3>
                </div>
                <Pill tone="blue">{good + regular + bad} respuestas</Pill>
              </div>
              <div className="faces-row">
                <QualityResult
                  tone="great"
                  label="Bueno"
                  count={good}
                  total={good + regular + bad}
                />
                <QualityResult
                  tone="neutral"
                  label="Regular"
                  count={regular}
                  total={good + regular + bad}
                />
                <QualityResult
                  tone="bad"
                  label="Malo"
                  count={bad}
                  total={good + regular + bad}
                />
              </div>
              <div className="quality-bar">
                <span style={{ width: `${positive * 100}%` }} />
                <i
                  style={{
                    width: `${(regular / Math.max(good + regular + bad, 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="bar-legend">
                <span>
                  <i className="dot green" />
                  Bueno {good}
                </span>
                <span>
                  <i className="dot yellow" />
                  Regular {regular}
                </span>
                <span>
                  <i className="dot red" />
                  Malo {bad}
                </span>
              </div>
            </section>
            <section className="panel action-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">COLA DE ACCIÓN</p>
                  <h3>Qué hacer hoy</h3>
                </div>
                <AlertTriangle size={19} color="#ef8354" />
              </div>
              <div className="action-list">
                <ActionRow
                  tone="red"
                  label="URGENTE"
                  text={`${bad} cliente(s) con calidad “Malo”`}
                  action="Revisar comentarios"
                  onClick={() => onNavigate("clients", "Malo", "bad")}
                />
                <ActionRow
                  tone="orange"
                  label="MEJORAR"
                  text={`${regular} respuesta(s) “Regular”`}
                  action="Abrir clientes a recuperar"
                  onClick={() => onNavigate("clients", undefined, "recover")}
                />
                <ActionRow
                  tone="purple"
                  label="CONTACTAR"
                  text={`${birthdays.length} cumpleaños próximos`}
                  action="Llamar y ofrecer promoción"
                  onClick={() => onNavigate("birthdays")}
                />
                <ActionRow
                  tone="blue"
                  label="EXPLORAR"
                  text={`${comments} comentarios disponibles`}
                  action="Ver voz del cliente"
                  onClick={() => onNavigate("voice")}
                />
              </div>
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">PRODUCTO Y EVALUACIÓN</p>
                  <h3>Más consumidos y mejor valorados</h3>
                </div>
                <Pill tone="green">Top categorías</Pill>
              </div>
              <div className="product-list">
                {productStats.slice(0, 5).map(p => (
                  <div className="product-row" key={p.name}>
                    <span className="product-rank">
                      {productStats.indexOf(p) + 1}
                    </span>
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.count} encuesta(s) ·{" "}
                        <b className="product-quality-percent">
                          {p.answered
                            ? `${Math.round(p.score * 100)}% Bueno`
                            : "Sin calificación"}
                        </b>
                      </small>
                    </span>
                    <div className="mini-track">
                      <i style={{ width: `${p.score * 100}%` }} />
                    </div>
                    <strong>{p.count}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">CLIENTES A RECUPERAR</p>
                  <h3>Riesgo con contexto</h3>
                </div>
                <Pill tone="red">{risks.length} prioridad(es)</Pill>
              </div>
              {risks.slice(0, 4).map(p => (
                <button
                  className="risk-row"
                  key={p.key}
                  onClick={() => onNavigate("clients", p.quality)}
                >
                  <Face tone="bad" size="sm" />
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.phone || "Sin teléfono"} ·{" "}
                      {p.comment || "Sin comentario"}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!risks.length && (
                <Empty text="No hay clientes en riesgo con el filtro actual." />
              )}
            </section>
            <section className="panel star-customer-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">CLIENTES ESTRELLA</p>
                  <h3>Los que vuelven y valoran</h3>
                </div>
                <Pill tone="green">
                  {
                    profiles.filter(
                      p => p.count >= 2 && clean(p.quality) === "bueno"
                    ).length
                  }{" "}
                  destacados
                </Pill>
              </div>
              {profiles
                .filter(p => p.count >= 2 && clean(p.quality) === "bueno")
                .slice(0, 4)
                .map(p => (
                  <button
                    className="star-row featured-star-row"
                    key={p.key}
                    onClick={() => onOpenClient(p.key)}
                    title="Abrir ficha del cliente"
                  >
                    <span className="star-badge">★</span>
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.count} encuestas · {p.quality} ·{" "}
                        {p.phone || "Sin teléfono"}
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              {!profiles.some(
                p => p.count >= 2 && clean(p.quality) === "bueno"
              ) && (
                <Empty text="Aún no hay clientes recurrentes con calidad Bueno." />
              )}
            </section>
          </div>
          <div className="dashboard-grid overview-bottom-charts">
            <SurveyChart records={records} />
            <MonthlyComparison records={records} />
          </div>
          <div className="quick-nav">
            <button onClick={() => onNavigate("clients")}>
              <Users size={18} />
              <span>
                <b>Clientes y fidelización</b>
                <small>Nuevos, recurrentes, fieles y en riesgo</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => onNavigate("voice")}>
              <MessageSquareText size={18} />
              <span>
                <b>Voz del cliente</b>
                <small>Frases accionables de comentarios</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => onNavigate("team")}>
              <UserRoundCheck size={18} />
              <span>
                <b>Equipo y operación</b>
                <small>Meseros vs. delivery web</small>
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function ActionRow({
  tone,
  label,
  text,
  action,
  onClick,
}: {
  tone: string;
  label: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button className="action-row" onClick={onClick}>
      <Pill tone={tone}>{label}</Pill>
      <span>
        <b>{text}</b>
        <small>{action}</small>
      </span>
      <ChevronRight size={15} />
    </button>
  );
}

function PriorityHistory({ priorityKey }: { priorityKey: string }) {
  const [open, setOpen] = useState(false);
  const historyQuery = trpc.priorities.history.useQuery(
    { priorityKey },
    { enabled: open }
  );
  return (
    <div
      className="priority-history"
      onClick={event => event.stopPropagation()}
    >
      <button
        className="history-toggle"
        onClick={() => setOpen(value => !value)}
      >
        {open ? "Ocultar historial" : "Ver historial"}
      </button>
      {open && (
        <div className="history-list">
          {historyQuery.isLoading ? (
            <small>Cargando historial…</small>
          ) : historyQuery.data?.length ? (
            historyQuery.data.map(item => (
              <div className="history-entry" key={item.id}>
                <b>{item.status === "done" ? "Atendido" : "Pendiente"}</b>
                <span>
                  {item.responsible || "Sin responsable"} ·{" "}
                  {formatDate(item.dueDate)} · {item.changedBy || "Dashboard"}
                </span>
                <small>{formatDateTime(item.changedAt)}</small>
              </div>
            ))
          ) : (
            <small>Sin cambios registrados todavía.</small>
          )}
        </div>
      )}
    </div>
  );
}

function Priorities({
  records,
  birthdays,
  profiles,
  persisted,
  systemUsers,
  audit,
  logs,
  onNavigate,
  onOpenClient,
}: {
  records: RecordItem[];
  birthdays: RecordItem[];
  profiles: ClientProfile[];
  persisted: PriorityPersisted[];
  systemUsers: ResponsibleUser[];
  audit: AuditItem[];
  logs: CallLog[];
  onNavigate: (page: Page, filter?: string, focus?: OverviewFocus) => void;
  onOpenClient: (key: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<
    "Todos" | "Calidad" | "Calidad mala" | "Cumpleaños"
  >("Todos");
  const [statusFilter, setStatusFilter] = useState<
    "Todos" | "Pendientes" | "En seguimiento" | "Atendidas" | "Vencidas"
  >("Todos");
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        status: "pending" | "in_progress" | "done";
        responsible: string;
        dueDate: string;
      }
    >
  >({});
  const [priorityPage, setPriorityPage] = useState(1);
  const priorityPageSize = 5;
  const [notice, setNotice] = useState("");
  const utils = trpc.useUtils();
  const saveMutation = trpc.priorities.save.useMutation({
    onSuccess: () => {
      utils.priorities.list.invalidate();
      setNotice("Cambio registrado correctamente.");
      window.setTimeout(() => setNotice(""), 3500);
    },
  });
  const toDateInput = (value: Date | string | null | undefined) => {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime())
      ? String(value).slice(0, 10)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const items = useMemo(() => {
    const profileByKey = new Map(
      profiles.map(profile => [profile.key, profile])
    );
    const priorities: {
      key: string;
      score: number;
      type: "Calidad" | "Cumpleaños" | "Seguimiento";
      tone: "bad" | "orange";
      icon: string;
      label: string;
      title: string;
      detail: string;
      defaultDueDate: string;
      defaultResponsible: string;
      action: string;
      clientKey?: string;
    }[] = [];
    profiles
      .filter(profile => profile.segment === "En riesgo")
      .forEach(profile => {
        const isBad = clean(profile.quality) === "malo";
        const latest = records
          .filter(record => clientKeyOf(record) === profile.key)
          .sort(
            (a, b) =>
              (parseDate(b.timestamp)?.getTime() || 0) -
              (parseDate(a.timestamp)?.getTime() || 0)
          )[0];
        const latestDate = latest ? parseDate(latest.timestamp) : null;
        const deadline = latestDate
          ? new Date(latestDate.getTime() + (isBad ? 2 : 4) * 86400000)
          : new Date();
        priorities.push({
          key: `risk-${profile.key}`,
          score: isBad ? 100 : 70,
          type: "Calidad",
          tone: isBad ? "bad" : "orange",
          icon: isBad ? "😞" : "😐",
          label: isBad ? "URGENTE" : "MEJORAR",
          title: profile.name,
          detail: `${profile.phone || "Sin teléfono"} · ${profile.quality} · ${profile.comment || "Sin comentario"}`,
          defaultDueDate: toDateInput(deadline),
          defaultResponsible:
            latest && channelOf(latest) === "Salón"
              ? displayServer(latest.registeredBy)
              : "Equipo de fidelización",
          action: "Ver todas sus encuestas",
          clientKey: profile.key,
        });
      });
    birthdays.forEach(record => {
      const profile = profileByKey.get(clientKeyOf(record));
      const birthday = parseBirthdayDate(record.birthday);
      const deadline = birthday
        ? new Date(
            new Date().getFullYear(),
            birthday.getMonth(),
            birthday.getDate()
          )
        : new Date();
      priorities.push({
        key: `birthday-${clientKeyOf(record)}`,
        score: 85,
        type: "Cumpleaños",
        tone: "orange",
        icon: "🎂",
        label: "CONTACTAR",
        title: profile?.name || record.clientName || "Cliente sin nombre",
        detail: `${record.phone || profile?.phone || "Sin teléfono"} · Cumpleaños ${formatBirthday(record.birthday)}`,
        defaultDueDate: toDateInput(deadline),
        defaultResponsible: "Equipo de fidelización",
        action: "Llamar y ofrecer promoción",
        clientKey: profile?.key,
      });
    });
    return priorities
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"))
      .filter(
        item =>
          typeFilter === "Todos" ||
          (typeFilter === "Calidad mala"
            ? item.type === "Calidad" && item.tone === "bad"
            : item.type === typeFilter)
      );
    logs
      .filter(log => log.nextCallDate)
      .forEach(log => {
        const due = toDateInput(log.nextCallDate);
        priorities.push({
          key: `followup-${log.id}`,
          score: 92,
          type: "Seguimiento",
          tone: "orange",
          icon: "📞",
          label: "SEGUIMIENTO",
          title: log.clientName || "Cliente sin nombre",
          detail: `${log.phone || "Sin teléfono"} · ${log.promotion || "Sin promoción"} · próxima llamada ${formatDate(due)}`,
          defaultDueDate: due,
          defaultResponsible:
            log.assignedTo || log.createdBy || "Equipo de fidelización",
          action: "Realizar la próxima llamada programada",
          clientKey: log.clientKey,
        });
      });
    return priorities
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"))
      .filter(
        item =>
          typeFilter === "Todos" ||
          (typeFilter === "Calidad mala"
            ? item.type === "Calidad" && item.tone === "bad"
            : typeFilter === "Cumpleaños"
              ? item.type === "Cumpleaños"
              : typeFilter === "Calidad"
                ? item.type === "Calidad"
                : item.type === typeFilter)
      );
  }, [birthdays, profiles, records, typeFilter, logs]);
  const stateFor = (item: (typeof items)[number]) => {
    const saved = persisted.find(priority => priority.priorityKey === item.key);
    const draft = drafts[item.key];
    return (
      draft ?? {
        status: saved?.status ?? "pending",
        responsible: saved?.responsible ?? item.defaultResponsible,
        dueDate: toDateInput(saved?.dueDate) || item.defaultDueDate,
      }
    );
  };
  const updateDraft = (
    item: (typeof items)[number],
    patch: Partial<{
      status: "pending" | "in_progress" | "done";
      responsible: string;
      dueDate: string;
    }>
  ) =>
    setDrafts(current => ({
      ...current,
      [item.key]: { ...stateFor(item), ...patch },
    }));
  const saveItem = (
    item: (typeof items)[number],
    patch: Partial<{
      status: "pending" | "in_progress" | "done";
      responsible: string;
      dueDate: string;
    }>
  ) => {
    const pin = window.prompt(
      "Ingresa el PIN de administrador para guardar cambios:"
    );
    if (pin !== "5956") return;
    const next = { ...stateFor(item), ...patch };
    setDrafts(current => ({ ...current, [item.key]: next }));
    saveMutation.mutate({
      priorityKey: item.key,
      status: next.status,
      responsible: next.responsible || undefined,
      dueDate: next.dueDate
        ? new Date(`${next.dueDate}T12:00:00`).toISOString()
        : null,
      adminPin: pin,
    });
  };
  const filteredItems = items.filter(item => {
    const state = stateFor(item);
    const done = state.status === "done";
    const inProgress = state.status === "in_progress";
    const due = state.dueDate
      ? new Date(`${state.dueDate}T23:59:59`).getTime()
      : 0;
    const overdue = Boolean(due) && due < Date.now() && !done;
    return (
      statusFilter === "Todos" ||
      (statusFilter === "Pendientes" &&
        state.status === "pending" &&
        !overdue) ||
      (statusFilter === "En seguimiento" && inProgress) ||
      (statusFilter === "Atendidas" && done) ||
      (statusFilter === "Vencidas" && overdue)
    );
  });
  useEffect(() => {
    setPriorityPage(1);
  }, [typeFilter, statusFilter]);
  const visiblePriorityItems = filteredItems.slice(
    (priorityPage - 1) * priorityPageSize,
    priorityPage * priorityPageSize
  );
  const priorityPages = Math.max(
    1,
    Math.ceil(filteredItems.length / priorityPageSize)
  );
  const attendedCount = items.filter(
    item => stateFor(item).status === "done"
  ).length;
  const followupCount = items.filter(
    item => stateFor(item).status === "in_progress"
  ).length;
  const overdueCount = items.filter(item => {
    const state = stateFor(item);
    return (
      state.status !== "done" &&
      Boolean(state.dueDate) &&
      new Date(`${state.dueDate}T23:59:59`).getTime() < Date.now()
    );
  }).length;
  const riskCount = profiles.filter(
    profile => profile.segment === "En riesgo"
  ).length;
  return (
    <>
      <section className="page-intro priority-intro">
        <div>
          <Pill tone="red">CENTRO DE PRIORIDADES</Pill>
          <h2>Lo que requiere atención primero.</h2>
          <p>
            Filtra por tipo y estado, marca cada asunto y ajusta manualmente la
            próxima acción.
          </p>
        </div>
        <div className="intro-note priority-rule">
          <Flag size={18} />
          <span>
            <b>Cómo se ordena</b>
            <small>
              Malo, cumpleaños próximos, seguimientos programados y luego
              Regular. Cada fila conserva sus cambios entre dispositivos.
            </small>
          </span>
        </div>
      </section>
      <div className="stats-grid priority-stats">
        <Stat
          label="PRIORIDADES"
          value={filteredItems.length}
          detail="asuntos filtrados"
          accent="red"
          icon={Flag}
          onClick={() => {
            setTypeFilter("Todos");
            setStatusFilter("Todos");
          }}
        />
        <Stat
          label="CALIDAD MALA"
          value={
            profiles.filter(profile => clean(profile.quality) === "malo").length
          }
          detail="solo prioridades malas"
          accent="red"
          icon={AlertTriangle}
          onClick={() => {
            setTypeFilter("Calidad mala");
            setStatusFilter("Todos");
          }}
        />
        <Stat
          label="CUMPLEAÑOS"
          value={birthdays.length}
          detail="próximos 7 días"
          accent="orange"
          icon={Cake}
          onClick={() => setTypeFilter("Cumpleaños")}
        />
        <Stat
          label="EN SEGUIMIENTO"
          value={followupCount}
          detail="próximas acciones"
          accent="orange"
          icon={Phone}
          onClick={() => setStatusFilter("En seguimiento")}
        />
        <Stat
          label="ATENDIDOS"
          value={attendedCount}
          detail="sincronizados"
          accent="green"
          icon={MessageSquareText}
          onClick={() => setStatusFilter("Atendidas")}
        />
        <Stat
          label="VENCIDAS"
          value={overdueCount}
          detail="requieren atención"
          accent="red"
          icon={Clock3}
          onClick={() => setStatusFilter("Vencidas")}
        />
      </div>
      <section className="panel priority-panel">
        <div className="priority-filters">
          <span>Tipo</span>
          {(["Todos", "Calidad", "Calidad mala", "Cumpleaños"] as const).map(
            filter => (
              <button
                key={filter}
                className={typeFilter === filter ? "selected" : ""}
                onClick={() => setTypeFilter(filter)}
              >
                {filter}
              </button>
            )
          )}
          <span className="priority-filter-divider">Estado</span>
          {(
            [
              "Todos",
              "Pendientes",
              "En seguimiento",
              "Atendidas",
              "Vencidas",
            ] as const
          ).map(filter => (
            <button
              key={filter}
              className={`status-filter status-${filter.toLowerCase().replace(" ", "-")} ${statusFilter === filter ? "selected" : ""}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter}
            </button>
          ))}
          <small className="priority-status-help">
            El botón avanza: Pendiente → En seguimiento → Atendido.
          </small>
        </div>
        <div className="panel-head">
          <div>
            <p className="eyebrow">TOP 5 + RESTO DE PRIORIDADES</p>
            <h3>Atender primero lo urgente y luego revisar todo</h3>
            <small className="muted">
              Las primeras 5 son el foco ejecutivo; debajo se muestran todas las
              demás prioridades. El orden se recalcula con cada actualización de
              Google Sheets.
            </small>
          </div>
          <Pill tone={filteredItems.length ? "red" : "green"}>
            {filteredItems.length
              ? `${filteredItems.length} totales · ${Math.min(5, filteredItems.length)} top`
              : "Sin resultados"}
          </Pill>
        </div>
        {filteredItems.length ? (
          <div className="priority-list">
            {visiblePriorityItems.map((item, index) => {
              const globalIndex = (priorityPage - 1) * priorityPageSize + index;
              const state = stateFor(item);
              const done = state.status === "done";
              const inProgress = state.status === "in_progress";
              const isFollowup = item.type === "Seguimiento";
              const due = state.dueDate
                ? new Date(`${state.dueDate}T23:59:59`).getTime()
                : 0;
              const overdue = Boolean(due) && due < Date.now() && !done;
              const dueSoon =
                !done &&
                Boolean(due) &&
                due >= Date.now() &&
                due - Date.now() <= 86400000;
              return (
                <div
                  className={`priority-item ${globalIndex < 5 ? "priority-top" : "priority-additional"} priority-${item.tone} ${done ? "is-done" : ""} ${inProgress ? "is-followup" : ""} ${overdue ? "is-overdue" : ""}`}
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    item.clientKey
                      ? onOpenClient(item.clientKey)
                      : onNavigate("birthdays")
                  }
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      item.clientKey
                        ? onOpenClient(item.clientKey)
                        : onNavigate("birthdays");
                    }
                  }}
                >
                  <span className="priority-rank">{globalIndex + 1}</span>
                  <span className="priority-icon">{item.icon}</span>
                  <span className="priority-copy">
                    <b>
                      {isFollowup && (
                        <span
                          className={`followup-reminder ${overdue ? "overdue" : dueSoon ? "soon" : "upcoming"}`}
                          title={
                            overdue
                              ? "Seguimiento vencido"
                              : dueSoon
                                ? "Seguimiento en menos de 24 horas"
                                : "Seguimiento programado"
                          }
                        >
                          {overdue ? "🔴" : dueSoon ? "🟡" : "⏰"}
                        </span>
                      )}
                      {dueSoon && !isFollowup && (
                        <span
                          className="due-soon"
                          title="Vence en menos de 24 horas"
                        >
                          ⚠
                        </span>
                      )}{" "}
                      {item.label} · {item.title}
                    </b>
                    <small>{item.detail}</small>
                    <small className="priority-meta">
                      {overdue
                        ? isFollowup
                          ? "SEGUIMIENTO VENCIDO · "
                          : "VENCIDA · "
                        : dueSoon
                          ? isFollowup
                            ? "SEGUIMIENTO EN MENOS DE 24 H · "
                            : "VENCE EN MENOS DE 24 H · "
                          : isFollowup
                            ? "SEGUIMIENTO PROGRAMADO · "
                            : ""}
                      Límite: {formatDate(state.dueDate)} · Responsable:{" "}
                      {state.responsible || "Sin asignar"}
                    </small>
                    <em>{item.action}</em>
                    <span className="priority-edit-row">
                      <label>
                        Responsable
                        <select
                          value={state.responsible}
                          onClick={event => event.stopPropagation()}
                          onChange={event =>
                            updateDraft(item, {
                              responsible: event.target.value,
                            })
                          }
                        >
                          <option value="">Sin asignar</option>
                          {systemUsers.map(user => (
                            <option
                              key={user.id}
                              value={
                                user.name || user.email || `Usuario ${user.id}`
                              }
                            >
                              {user.name || user.email || `Usuario ${user.id}`}
                            </option>
                          ))}
                          {!systemUsers.some(
                            user =>
                              (user.name || user.email) === state.responsible
                          ) &&
                            state.responsible && (
                              <option value={state.responsible}>
                                {state.responsible}
                              </option>
                            )}
                        </select>
                      </label>
                      <label>
                        Fecha límite
                        <input
                          type="date"
                          value={state.dueDate}
                          onClick={event => event.stopPropagation()}
                          onChange={event =>
                            updateDraft(item, { dueDate: event.target.value })
                          }
                        />
                      </label>
                      <button
                        className="priority-save"
                        disabled={saveMutation.isPending}
                        onClick={event => {
                          event.stopPropagation();
                          saveItem(item, {});
                        }}
                      >
                        {saveMutation.isPending ? "Guardando…" : "Guardar"}
                      </button>
                    </span>
                    <PriorityHistory priorityKey={item.key} />
                  </span>
                  <button
                    className={`priority-status ${done ? "done" : inProgress ? "in-progress" : ""}`}
                    onClick={event => {
                      event.stopPropagation();
                      saveItem(item, {
                        status: nextPriorityStatus(state.status),
                      });
                    }}
                  >
                    {done
                      ? "Atendido"
                      : inProgress
                        ? "En seguimiento"
                        : "Pendiente"}
                  </button>
                  <ArrowUpRight size={18} />
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="No hay prioridades en este filtro." />
        )}
        {notice && (
          <div className="success-notice" role="status">
            ✓ {notice}
          </div>
        )}
        {filteredItems.length > priorityPageSize && (
          <div className="priority-pagination">
            <button
              disabled={priorityPage === 1}
              onClick={() => setPriorityPage(value => Math.max(1, value - 1))}
            >
              Anterior
            </button>
            <span>
              Página {priorityPage} de {priorityPages} · {filteredItems.length}{" "}
              prioridades
            </span>
            <button
              disabled={priorityPage === priorityPages}
              onClick={() =>
                setPriorityPage(value => Math.min(priorityPages, value + 1))
              }
            >
              Siguiente
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function Clients({
  onNavigate,
  records,
  allRecords,
  birthdays,
  profiles,
  logs,
  promotions,
  focus,
  focusClientKey,
  search,
  setSearch,
  qualityFilter,
  setQualityFilter,
  onReset,
  onBackToPriorities,
}: {
  records: RecordItem[];
  allRecords: RecordItem[];
  birthdays: RecordItem[];
  profiles: ClientProfile[];
  onNavigate: (page: Page, filter?: string, focus?: OverviewFocus) => void;
  logs: CallLog[];
  promotions: PromotionItem[];
  focus: OverviewFocus;
  focusClientKey: string | null;
  search: string;
  setSearch: (v: string) => void;
  qualityFilter: string;
  setQualityFilter: (v: string) => void;
  onReset: () => void;
  onBackToPriorities: () => void;
}) {
  const [segment, setSegment] = useState("Todos");
  const [birthdayView, setBirthdayView] = useState<"week" | "month">("week");
  const [selected, setSelected] = useState<ClientProfile | null>(null);
  const repeated = profiles.filter(p => p.count > 1).length;
  const faithful = profiles.filter(p => p.segment === "Fiel");
  const recurrent = profiles.filter(p => p.segment === "Recurrente");
  const newClients = profiles.filter(p => p.segment === "Nuevo");
  const risk = profiles.filter(p => p.segment === "En riesgo");
  const visible =
    segment === "Todos"
      ? profiles
      : profiles.filter(p => p.segment === segment);
  const focusedProfile = focusClientKey
    ? profiles.find(profile => profile.key === focusClientKey)
    : null;
  const focusedHistory = focusClientKey
    ? allRecords
        .filter(record => clientKeyOf(record) === focusClientKey)
        .sort(
          (a, b) =>
            (parseDate(b.timestamp)?.getTime() || 0) -
            (parseDate(a.timestamp)?.getTime() || 0)
        )
    : [];
  const displayBirthdays =
    birthdayView === "month"
      ? birthdayRecordsWithin(allRecords, 0, 30)
      : birthdayRecordsWithin(allRecords, 0, 7);
  const lastWeekBirthdays = birthdayRecordsWithin(allRecords, -7, -1);
  const wasCalled = (record: RecordItem) =>
    logs.some(
      log =>
        clientKeyOf({ phone: log.phone || "", clientName: log.clientName }) ===
        clientKeyOf(record)
    );
  if (focusedProfile)
    return (
      <>
        <div className="page-intro priority-detail-intro">
          <div>
            <Pill tone="red">DETALLE DE PRIORIDAD</Pill>
            <h2>{focusedProfile.name}</h2>
            <p>
              {focusedProfile.phone || "Sin teléfono"} ·{" "}
              {focusedProfile.segment} · {focusedProfile.count} encuesta(s).
              Aquí puedes revisar todo lo que el cliente comentó antes de
              llamar.
            </p>
          </div>
          <button className="back-priority-button" onClick={onBackToPriorities}>
            ← Volver a Prioridades
          </button>
        </div>
        <section className="panel priority-detail-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">HISTORIAL COMPLETO DEL CONTACTO</p>
              <h3>Qué dijo en cada encuesta</h3>
            </div>
            <Pill
              tone={focusedProfile.segment === "En riesgo" ? "red" : "blue"}
            >
              {focusedHistory.length} registros
            </Pill>
          </div>
          {focusedHistory.length ? (
            <div className="contact-history">
              {focusedHistory.map(record => (
                <article className="contact-history-item" key={record.id}>
                  <div className="contact-history-head">
                    <b>{formatDateTime(record.timestamp)}</b>
                    <Pill
                      tone={
                        clean(record.quality) === "malo"
                          ? "red"
                          : clean(record.quality) === "regular"
                            ? "orange"
                            : "green"
                      }
                    >
                      {record.quality || "Sin calidad"}
                    </Pill>
                  </div>
                  <p>{record.comment || "Sin comentario registrado."}</p>
                  <small>
                    Producto o categoría: {record.dish || "No indicado"} ·
                    Registrado por: {displayServer(record.registeredBy)}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <Empty text="No hay otras encuestas asociadas a este contacto." />
          )}
        </section>
        <section className="panel priority-detail-next">
          <div>
            <p className="eyebrow">SIGUIENTE PASO</p>
            <h3>Registrar la llamada con contexto</h3>
            <p className="muted">
              Usa el historial anterior para explicar qué ocurrió y ofrecer una
              recuperación concreta.
            </p>
          </div>
          <button
            className="small-action"
            onClick={() => setSelected(focusedProfile)}
          >
            <Phone size={14} /> Registrar llamada
          </button>
        </section>
        {selected && (
          <CallLogForm
            profile={selected}
            logs={logs}
            onClose={() => setSelected(null)}
          />
        )}
      </>
    );
  if (focus === "birthdays")
    return (
      <>
        <div className="page-intro">
          <div>
            <Pill tone="orange">ACCIÓN: CUMPLEAÑOS</Pill>
            <h2>Próximos cumpleaños</h2>
            <p>
              Esta vista muestra únicamente los clientes que cumplen años hoy o
              dentro de los próximos siete días.
            </p>
          </div>
        </div>
        <section className="panel focused-action-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LLAMAR ESTA SEMANA</p>
              <h3>Lista exacta de cumpleaños</h3>
            </div>
            <Cake size={23} color="#ef8354" />
          </div>
          {displayBirthdays.length ? (
            displayBirthdays.map(r => (
              <div className="birthday-row" key={r.id}>
                <span className="birthday-date">{formatBirthday(r.birthday)}</span>
                <span>
                  <b>{r.clientName || "Cliente sin nombre"}</b>
                  <small>{r.phone || "Sin teléfono"}</small>
                </span>
                {wasCalled(r) && <Pill tone="green">Llamado</Pill>}
                <button
                  className="small-action"
                  onClick={() =>
                    setSelected(
                      profiles.find(p => p.key === clientKeyOf(r)) ?? null
                    )
                  }
                >
                  <Phone size={12} /> Registrar llamada
                </button>
              </div>
            ))
          ) : (
            <Empty text="No hay cumpleaños próximos." />
          )}
        </section>
        {selected && (
          <CallLogForm
            profile={selected}
            logs={logs}
            onClose={() => setSelected(null)}
          />
        )}
      </>
    );
  if (focus === "recover")
    return (
      <>
        <div className="page-intro">
          <div>
            <Pill tone="orange">ACCIÓN: MEJORAR</Pill>
            <h2>Clientes a recuperar</h2>
            <p>
              Lista exacta de clientes con calidad Mala o Regular, con su
              comentario y opción de llamada.
            </p>
          </div>
        </div>
        <section className="panel focused-action-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">REVISAR Y RECUPERAR</p>
              <h3>Clientes que requieren seguimiento</h3>
            </div>
            <AlertTriangle size={23} color="#ef8354" />
          </div>
          {risk.length ? (
            risk.map(p => (
              <div className="risk-row" key={p.key}>
                <Face
                  tone={clean(p.quality) === "malo" ? "bad" : "neutral"}
                  size="sm"
                />
                <span>
                  <b>{p.name}</b>
                  <small>
                    {p.phone || "Sin teléfono"} · {p.quality} ·{" "}
                    {p.comment || "Sin comentario"}
                  </small>
                </span>
                <button className="small-action" onClick={() => setSelected(p)}>
                  <Phone size={12} /> Llamar
                </button>
              </div>
            ))
          ) : (
            <Empty text="No hay clientes a recuperar." />
          )}
        </section>
        {selected && (
          <CallLogForm
            profile={selected}
            logs={logs}
            onClose={() => setSelected(null)}
          />
        )}
      </>
    );
  if (focus === "bad")
    return (
      <>
        <div className="page-intro">
          <div>
            <Pill tone="red">ACCIÓN: CALIDAD MALA</Pill>
            <h2>Clasificaciones Mala</h2>
            <p>
              Esta vista muestra únicamente las respuestas con calidad Mala para
              revisar el comentario y contactar al cliente.
            </p>
          </div>
        </div>
        <section className="panel focused-action-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">REVISAR Y RECUPERAR</p>
              <h3>Lista exacta de clasificación Mala</h3>
            </div>
            <Face tone="bad" size="md" />
          </div>
          {visible.length ? (
            visible.map(p => (
              <div className="risk-row" key={p.key}>
                <Face tone="bad" size="sm" />
                <span>
                  <b>{p.name}</b>
                  <small>
                    {p.phone || "Sin teléfono"} ·{" "}
                    {p.comment || "Sin comentario"}
                  </small>
                </span>
                <button className="small-action" onClick={() => setSelected(p)}>
                  <Phone size={12} /> Llamar
                </button>
              </div>
            ))
          ) : (
            <Empty text="No hay clasificaciones Mala." />
          )}
        </section>
        {selected && (
          <CallLogForm
            profile={selected}
            logs={logs}
            onClose={() => setSelected(null)}
          />
        )}
      </>
    );
  return (
    <>
      <div className="page-intro">
        <div>
          <Pill tone="purple">FIDELIZACIÓN POR ENCUESTAS</Pill>
          <h2>Clientes que merecen una llamada.</h2>
          <p>
            La recurrencia se calcula por encuestas repetidas: <b>Fiel</b> = 3 o
            más, <b>Recurrente</b> = 2, <b>Nuevo</b> = 1. “En riesgo” combina
            una calidad Mala o Regular con un contacto identificable.
          </p>
        </div>
        <div className="intro-note">
          <Clock3 size={17} />
          <span>
            <b>Modelo actual</b>
            <small>
              No mezcla visitas ni tickets: cada respuesta repetida identifica
              una nueva encuesta del cliente.
            </small>
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="CONTACTOS"
          value={profiles.length}
          detail="nombre o teléfono"
          icon={Users}
          onClick={() => setSegment("Todos")}
        />
        <Stat
          label="FIELES"
          value={faithful.length}
          detail="3+ encuestas"
          accent="green"
          icon={Sparkles}
          onClick={() => setSegment("Fiel")}
        />
        <Stat
          label="RECURRENTES"
          value={recurrent.length}
          detail="2 encuestas"
          accent="purple"
          icon={RefreshCw}
          onClick={() => setSegment("Recurrente")}
        />
        <Stat
          label="NUEVOS"
          value={newClients.length}
          detail="1 encuesta"
          accent="blue"
          icon={Users}
          onClick={() => setSegment("Nuevo")}
        />
        <Stat
          label="EN RIESGO"
          value={risk.length}
          detail="malo o regular"
          accent="red"
          icon={AlertTriangle}
          onClick={() => setSegment("En riesgo")}
        />
      </div>
      <div className="segment-tabs">
        {["Todos", "Fiel", "Recurrente", "Nuevo", "En riesgo"].map(s => (
          <button
            key={s}
            className={segment === s ? "selected" : ""}
            onClick={() => setSegment(s)}
          >
            {s}
            <span>
              {s === "Todos"
                ? profiles.length
                : profiles.filter(p => p.segment === s).length}
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-grid clients-grid">
        <section className="panel birthday-current-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LLAMAR ESTA SEMANA</p>
              <h3>
                <Cake size={20} color="#ffbf51" /> Próximos cumpleaños
              </h3>
            </div>
            <div className="birthday-range-controls">
              <button
                className={birthdayView === "week" ? "selected" : ""}
                onClick={() => setBirthdayView("week")}
              >
                Semana
              </button>
              <button
                className={birthdayView === "month" ? "selected" : ""}
                onClick={() => setBirthdayView("month")}
              >
                Mes
              </button>
            </div>
          </div>
          {displayBirthdays.length ? (
            displayBirthdays.map(r => (
              <div className="birthday-row" key={r.id}>
                <span className="birthday-date">{formatBirthday(r.birthday)}</span>
                <span>
                  <b>{r.clientName || "Cliente sin nombre"}</b>
                  <small>{r.phone || "Sin teléfono"}</small>
                </span>
                {wasCalled(r) && <Pill tone="green">Llamado</Pill>}
                <button
                  className="small-action"
                  onClick={() =>
                    setSelected(
                      profiles.find(p => p.key === clientKeyOf(r)) ?? null
                    )
                  }
                >
                  <Phone size={12} /> Registrar llamada
                </button>
              </div>
            ))
          ) : (
            <Empty text="No hay cumpleaños próximos con el filtro actual." />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SEGUIMIENTO</p>
              <h3>Últimas llamadas</h3>
            </div>
            <Pill tone="blue">{logs.length} guardadas</Pill>
          </div>
          {logs.slice(0, 4).map(log => (
            <div className="call-history-row" key={log.id}>
              <Phone size={14} />
              <span>
                <b>{log.clientName}</b>
                <small>
                  {formatDateTime(log.callDate)} · {log.outcome}
                  {log.promotion ? ` · ${log.promotion}` : ""} ·{" "}
                  {log.promotionRedeemed ? "Redimida" : "No redimida"}
                  {log.nextCallDate
                    ? ` · Próxima: ${formatDateTime(log.nextCallDate)}`
                    : ""}{" "}
                  · {log.recoveryResult || "Sin resultado"}
                </small>
              </span>
            </div>
          ))}
          {!logs.length && (
            <Empty text="Registra la primera llamada desde cualquier cliente." />
          )}
        </section>
      </div>
      <section className="panel birthday-history-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CONTROL DE SEGUIMIENTO</p>
            <h3>🎂 Cumpleaños de la semana pasada</h3>
            <small className="muted">
              Verifica rápidamente quién fue contactado.
            </small>
          </div>
          <Pill tone="neutral">{lastWeekBirthdays.length} clientes</Pill>
        </div>
        {lastWeekBirthdays.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {lastWeekBirthdays.map(r => (
                  <tr key={`past-${r.id}`}>
                    <td>{formatBirthday(r.birthday)}</td>
                    <td>
                      <b>{r.clientName || "Cliente sin nombre"}</b>
                    </td>
                    <td>{r.phone || "—"}</td>
                    <td>
                      {wasCalled(r) ? (
                        <Pill tone="green">Llamado</Pill>
                      ) : (
                        <Pill tone="orange">Pendiente</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No hay cumpleaños registrados en la semana pasada." />
        )}
      </section>
      <section className="panel loyalty-call-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">FIDELIZACIÓN POR ENCUESTAS</p>
            <h3>Clientes que merecen una llamada</h3>
          </div>
          <Pill tone="green">
            {
              profiles.filter(p => p.count >= 2 && clean(p.quality) === "bueno")
                .length
            }{" "}
            oportunidades
          </Pill>
        </div>
        {profiles
          .filter(p => p.count >= 2 && clean(p.quality) === "bueno")
          .slice(0, 4)
          .map(p => (
            <div className="star-row featured-star-row" key={p.key}>
              <span className="star-badge">★</span>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.count} encuestas · {p.phone || "Sin teléfono"}
                </small>
              </span>
              <button className="small-action" onClick={() => setSelected(p)}>
                <Phone size={12} /> Llamar
              </button>
            </div>
          ))}
        {!profiles.some(p => p.count >= 2 && clean(p.quality) === "bueno") && (
          <Empty text="Aún no hay clientes recurrentes con calidad Bueno." />
        )}
      </section>
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">BASE DE CLIENTES</p>
            <h3>Segmentación accionable</h3>
          </div>
          <span className="muted">{repeated} con más de una encuesta</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Segmento</th>
                <th>Encuestas</th>
                <th>Última calidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 30).map(p => (
                <tr key={p.key}>
                  <td>
                    <b>{p.name}</b>
                    <small className="table-sub">
                      {p.comment || "Sin comentario"}
                    </small>
                  </td>
                  <td>{p.phone || "—"}</td>
                  <td>
                    <Pill
                      tone={
                        p.segment === "En riesgo"
                          ? "red"
                          : p.segment === "Fiel"
                            ? "green"
                            : p.segment === "Recurrente"
                              ? "purple"
                              : "blue"
                      }
                    >
                      {p.segment}
                    </Pill>
                  </td>
                  <td>{p.count}</td>
                  <td>{p.quality || "Sin respuesta"}</td>
                  <td>
                    <button
                      className="table-call"
                      onClick={() => setSelected(p)}
                    >
                      <Phone size={13} /> Llamar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <Empty text="No hay clientes en este segmento con el filtro actual." />
        )}
      </section>
      {selected && (
        <CallLogForm
          profile={selected}
          logs={logs}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function ClientFilterBar({
  search,
  setSearch,
  qualityFilter,
  setQualityFilter,
  onReset,
}: {
  search: string;
  setSearch: (v: string) => void;
  qualityFilter: string;
  setQualityFilter: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="client-filter-wrap">
      <div className="client-filter-title">
        <Users size={16} />
        <b>Filtrar base de clientes</b>
      </div>
      <div className="search-box">
        <Search size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar solo en la base de clientes…"
        />
      </div>
      <div className="filter-group">
        <span>Calidad</span>
        {["Todos", "Bueno", "Regular", "Malo", "Sin calificar"].map(value => (
          <button
            key={value}
            className={qualityFilter === value ? "selected" : ""}
            onClick={() => setQualityFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <button className="reset-button" onClick={onReset}>
        Limpiar
      </button>
    </div>
  );
}

function PromotionManager({ promotions }: { promotions: PromotionItem[] }) {
  const utils = trpc.useUtils();
  const save = trpc.promotions.save.useMutation({
    onSuccess: () => utils.promotions.list.invalidate(),
  });
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<PromotionItem["category"]>("general");
  const add = () => {
    const pin = window.prompt(
      "PIN de administrador para agregar una promoción:"
    );
    if (pin !== "5956" || !name.trim()) return;
    save.mutate(
      { name: name.trim(), category, adminPin: pin },
      { onSuccess: () => setName("") }
    );
  };
  return (
    <section className="panel promotion-manager">
      <div className="panel-head">
        <div>
          <p className="eyebrow">CATÁLOGO MAESTRO</p>
          <h3>Promociones programables</h3>
          <small className="muted">
            Se guardan en la base de datos y aparecen en el formulario de
            llamada.
          </small>
        </div>
        <Pill tone="purple">{promotions.length} activas</Pill>
      </div>
      <div className="promotion-list">
        {promotions.map(item => (
          <span key={item.id} className="promotion-chip">
            {item.name}
            <small>{item.category}</small>
          </span>
        ))}
      </div>
      <div className="promotion-add">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nueva promoción…"
        />
        <select
          value={category}
          onChange={e =>
            setCategory(e.target.value as PromotionItem["category"])
          }
        >
          <option value="recuperacion">Recuperación</option>
          <option value="cumpleanos">Cumpleaños</option>
          <option value="fidelidad">Cliente fiel</option>
          <option value="general">General</option>
        </select>
        <Button disabled={save.isPending || !name.trim()} onClick={add}>
          Agregar
        </Button>
      </div>
      {save.error && <p className="form-error">{save.error.message}</p>}
    </section>
  );
}

function CallLogForm({
  profile,
  onClose,
  initialPromotion,
  campaignStage,
  campaignChannel,
  logs = [],
}: {
  profile: ClientProfile;
  onClose: () => void;
  initialPromotion?: string;
  campaignStage?: CampaignStage;
  campaignChannel?: CampaignChannel;
  logs?: CallLog[];
}) {
  const utils = trpc.useUtils();
  const promotionsQuery = trpc.promotions.list.useQuery();
  const responsibleQuery = trpc.responsibleUsers.list.useQuery();
  const create = trpc.calls.create.useMutation({
    onSuccess: async () => {
      await utils.calls.list.invalidate();
      onClose();
    },
  });
  const options =
    (promotionsQuery.data as PromotionItem[] | undefined)?.map(
      item => item.name
    ) ?? promotionCatalog;
  const [outcome, setOutcome] = useState("Contactado");
  const [promotion, setPromotion] = useState(initialPromotion || options[0]);
  useEffect(() => {
    if (initialPromotion) setPromotion(initialPromotion);
    else if (!promotion && options[0]) setPromotion(options[0]);
  }, [initialPromotion, options]);
  const [promotionRedeemed, setPromotionRedeemed] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState("Pendiente");
  const [nextCallDate, setNextCallDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [callDate, setCallDate] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const clientLogs = logs
    .filter(log => log.clientKey === profile.key)
    .sort(
      (a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime()
    );
  return (
    <div
      className="modal-backdrop"
      onClick={event => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="call-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">SEGUIMIENTO DE CONTACTO</p>
            <h3>{profile.name}</h3>
            <p className="muted">
              {profile.phone || "Sin teléfono"} · {profile.segment} ·{" "}
              {profile.count} encuesta(s)
            </p>
            {campaignStage && (
              <small className="campaign-context-note">
                Campaña: {campaignStage} · Canal: {campaignChannel || "llamada"}
              </small>
            )}
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        {clientLogs.length > 0 && (
          <section className="call-history-in-modal">
            <div className="call-history-modal-head">
              <b>Historial de llamadas</b>
              <span>{clientLogs.length} registro(s)</span>
            </div>
            {clientLogs.slice(0, 5).map(log => (
              <article key={log.id}>
                <div>
                  <strong>{formatDateTime(log.callDate)}</strong>
                  <span>{log.outcome}</span>
                </div>
                <p>
                  {log.promotion || "Sin promoción"} ·{" "}
                  {log.recoveryResult || "Sin resultado"}
                </p>
                <small>
                  {log.nextCallDate
                    ? `Próxima: ${formatDateTime(log.nextCallDate)}`
                    : "Sin próxima llamada"}{" "}
                  · Responsable: {log.assignedTo || "Sin asignar"}
                </small>
              </article>
            ))}
          </section>
        )}
        <label>
          Fecha y hora
          <input
            type="datetime-local"
            value={callDate}
            onChange={e => setCallDate(e.target.value)}
          />
        </label>
        <label>
          Resultado de la llamada
          <select value={outcome} onChange={e => setOutcome(e.target.value)}>
            <option>Contactado</option>
            <option>No contestó</option>
            <option>Pidió devolución de llamada</option>
            <option>Número inválido</option>
            <option>Promoción aceptada</option>
          </select>
        </label>
        <label>
          Promoción ofrecida
          <select
            value={promotion}
            onChange={e => setPromotion(e.target.value)}
          >
            {options.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={promotionRedeemed}
            onChange={e => setPromotionRedeemed(e.target.checked)}
          />
          <span>Promoción redimida</span>
        </label>
        <label>
          Motivo / resultado del seguimiento
          <select
            value={recoveryResult}
            onChange={e => setRecoveryResult(e.target.value)}
          >
            <option>Pendiente</option>
            <option>Cliente recuperado</option>
            <option>Cliente no recuperado</option>
            <option>Promoción aceptada</option>
            <option>Por cumpleaños</option>
            <option>Premio por cliente fiel</option>
            <option>No aplica</option>
          </select>
        </label>
        <label>
          Fecha de próxima llamada
          <input
            type="datetime-local"
            value={nextCallDate}
            onChange={e => setNextCallDate(e.target.value)}
          />
          <small className="field-hint">
            Al elegir una fecha se creará una tarea de seguimiento
            automáticamente.
          </small>
        </label>
        <label>
          Responsable de la próxima acción
          <select
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {(responsibleQuery.data ?? [])
              .filter(user => user.active)
              .map(user => (
                <option key={user.id} value={user.name}>
                  {user.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Notas
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Qué comentó el cliente y próximo paso…"
          />
        </label>
        <div className="modal-actions">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                clientKey: profile.key,
                clientName: profile.name,
                phone: profile.phone,
                callDate,
                outcome,
                promotion,
                promotionRedeemed,
                campaignStage,
                campaignChannel,
                nextCallDate: nextCallDate || undefined,
                recoveryResult,
                assignedTo: assignedTo || undefined,
                notes,
              })
            }
          >
            {create.isPending ? "Guardando…" : "Guardar seguimiento"}
          </Button>
        </div>
        {create.error && <p className="form-error">{create.error.message}</p>}
      </div>
    </div>
  );
}

function adminPin() {
  return window.prompt("PIN de administrador:") === "5956";
}
function categoryLabel(category: PromotionItem["category"]) {
  return category === "recuperacion"
    ? "Recuperación"
    : category === "cumpleanos"
      ? "Cumpleaños"
      : category === "fidelidad"
        ? "Cliente fiel"
        : "General";
}
function PromotionsAdmin({
  promotions,
  audit,
}: {
  promotions: PromotionItem[];
  audit: AuditItem[];
}) {
  const utils = trpc.useUtils();
  const update = trpc.promotions.update.useMutation({
    onSuccess: () => {
      utils.promotions.list.invalidate();
      utils.promotions.adminList.invalidate();
    },
  });
  const save = trpc.promotions.save.useMutation({
    onSuccess: () => {
      utils.promotions.list.invalidate();
      utils.promotions.adminList.invalidate();
      setName("");
    },
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<
    Record<number, { name: string; category: PromotionItem["category"] }>
  >({});
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<PromotionItem["category"]>("general");
  const startEdit = (item: PromotionItem) =>
    setDrafts(current => ({
      ...current,
      [item.id]: { name: item.name, category: item.category },
    }));
  const saveEdit = (item: PromotionItem) => {
    if (!adminPin()) return;
    const draft = drafts[item.id];
    if (!draft?.name.trim()) return;
    update.mutate(
      {
        id: item.id,
        name: draft.name.trim(),
        category: draft.category,
        active: item.active,
        adminPin: "5956",
      },
      { onSuccess: () => setEditing(null) }
    );
  };
  const toggle = (item: PromotionItem) => {
    if (!adminPin()) return;
    update.mutate({
      id: item.id,
      name: item.name,
      category: item.category,
      active: item.active ? 0 : 1,
      adminPin: "5956",
    });
  };
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="purple">ADMINISTRACIÓN</Pill>
          <h2>Catálogo persistente de promociones.</h2>
          <p>
            Edita el texto, clasifica el motivo y activa o pausa opciones que
            aparecerán en el seguimiento de llamadas.
          </p>
        </div>
        <div className="intro-note">
          <Sparkles size={17} />
          <span>
            <b>Protegido por PIN</b>
            <small>
              Las modificaciones se guardan en la base de datos y se reflejan en
              todos los dispositivos.
            </small>
          </span>
        </div>
      </div>
      <section className="panel admin-table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PROMOCIONES PROGRAMABLES</p>
            <h3>Editar catálogo</h3>
          </div>
          <Pill tone="purple">
            {promotions.filter(item => item.active).length} activas ·{" "}
            {promotions.length} totales
          </Pill>
        </div>
        <div className="admin-promotion-list">
          {promotions.map(item => {
            const draft = drafts[item.id] ?? {
              name: item.name,
              category: item.category,
            };
            return (
              <div
                className={`admin-promotion-row ${item.active ? "" : "inactive-row"}`}
                key={item.id}
              >
                <span className="admin-promotion-main">
                  {editing === item.id ? (
                    <input
                      value={draft.name}
                      onChange={event =>
                        setDrafts(current => ({
                          ...current,
                          [item.id]: { ...draft, name: event.target.value },
                        }))
                      }
                    />
                  ) : (
                    <b>{item.name}</b>
                  )}
                  <small>
                    {editing === item.id
                      ? "Edición pendiente"
                      : categoryLabel(item.category)}
                  </small>
                </span>
                {editing === item.id ? (
                  <select
                    value={draft.category}
                    onChange={event =>
                      setDrafts(current => ({
                        ...current,
                        [item.id]: {
                          ...draft,
                          category: event.target
                            .value as PromotionItem["category"],
                        },
                      }))
                    }
                  >
                    <option value="recuperacion">Recuperación</option>
                    <option value="cumpleanos">Cumpleaños</option>
                    <option value="fidelidad">Cliente fiel</option>
                    <option value="general">General</option>
                  </select>
                ) : (
                  <Pill tone={item.active ? "green" : "neutral"}>
                    {item.active ? "Activa" : "Pausada"}
                  </Pill>
                )}
                <div className="admin-row-actions">
                  {editing === item.id ? (
                    <>
                      <button onClick={() => saveEdit(item)}>Guardar</button>
                      <button onClick={() => setEditing(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          startEdit(item);
                          setEditing(item.id);
                        }}
                      >
                        Editar
                      </button>
                      <button onClick={() => toggle(item)}>
                        {item.active ? "Pausar" : "Activar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {(save.isSuccess || update.isSuccess) && (
          <div className="success-notice">
            ✓ Promoción guardada correctamente. El catálogo ya está
            sincronizado.
          </div>
        )}
      </section>
      <section className="panel admin-add-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">NUEVA PROMOCIÓN</p>
            <h3>Agregar al catálogo</h3>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            Nombre
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ej. 20% en la próxima visita"
            />
          </label>
          <label>
            Categoría
            <select
              value={category}
              onChange={event =>
                setCategory(event.target.value as PromotionItem["category"])
              }
            >
              <option value="recuperacion">Recuperación</option>
              <option value="cumpleanos">Cumpleaños</option>
              <option value="fidelidad">Cliente fiel</option>
              <option value="general">General</option>
            </select>
          </label>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() => {
              if (adminPin())
                save.mutate({ name: name.trim(), category, adminPin: "5956" });
            }}
          >
            {save.isPending ? "Guardando…" : "Agregar promoción"}
          </Button>
        </div>
        {(save.error || update.error) && (
          <p className="form-error">
            {save.error?.message || update.error?.message}
          </p>
        )}
      </section>
      <AuditPanel audit={audit.filter(item => item.entity === "promoción")} />
    </>
  );
}
function CallsHistory({
  logs,
  search,
  promotions,
  isAdmin,
  onNavigate,
}: {
  logs: CallLog[];
  search: string;
  promotions: PromotionItem[];
  isAdmin: boolean;
  onNavigate: (page: Page) => void;
}) {
  const [outcome, setOutcome] = useState("Todos");
  const [redeemed, setRedeemed] = useState("Todos");
  const [promotion, setPromotion] = useState("Todas");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const utils = trpc.useUtils();
  const [editLog, setEditLog] = useState<CallLog | null>(null);
  const [draft, setDraft] = useState({
    outcome: "",
    promotion: "",
    promotionRedeemed: false,
    recoveryResult: "",
    notes: "",
    callDate: "",
    nextCallDate: "",
    assignedTo: "",
  });
  const updateCall = trpc.calls.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.calls.list.invalidate(),
        utils.adminAudit.list.invalidate(),
        utils.birthdayCampaigns.list.invalidate(),
      ]);
      setEditLog(null);
    },
  });
  const removeCall = trpc.calls.remove.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.calls.list.invalidate(),
        utils.adminAudit.list.invalidate(),
        utils.birthdayCampaigns.list.invalidate(),
      ]);
    },
  });
  const startEdit = (log: CallLog) => {
    setEditLog(log);
    setDraft({
      outcome: log.outcome,
      promotion: log.promotion ?? "",
      promotionRedeemed: Boolean(log.promotionRedeemed),
      recoveryResult: log.recoveryResult ?? "",
      notes: log.notes ?? "",
      callDate: toDateInputValue(log.callDate),
      nextCallDate: toDateInputValue(log.nextCallDate),
      assignedTo: log.assignedTo ?? "",
    });
  };
  const saveEdit = () => {
    if (!editLog) return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    updateCall.mutate({
      id: editLog.id,
      outcome: draft.outcome.trim(),
      promotion: draft.promotion || undefined,
      promotionRedeemed: draft.promotionRedeemed ? 1 : 0,
      recoveryResult: draft.recoveryResult || undefined,
      notes: draft.notes || undefined,
      callDate: draft.callDate
        ? new Date(`${draft.callDate}T12:00:00`).toISOString()
        : undefined,
      nextCallDate: draft.nextCallDate
        ? new Date(`${draft.nextCallDate}T12:00:00`).toISOString()
        : null,
      assignedTo: draft.assignedTo || undefined,
      adminPin: pin,
    });
  };
  const deleteLog = (log: CallLog) => {
    if (
      !window.confirm(
        `¿Eliminar el registro de ${log.clientName || "cliente"} del ${formatDateTime(log.callDate)}?`
      )
    )
      return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    removeCall.mutate({ id: log.id, adminPin: pin });
  };
  const query = normalizeText(search);
  const dateMatch = (value: Date | string, from: string, to: string) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return (!from || day >= from) && (!to || day <= to);
  };
  const visible = logs.filter(
    log =>
      (!query ||
        normalizeText(
          `${log.clientName} ${log.phone || ""} ${log.promotion || ""} ${log.notes || ""}`
        ).includes(query)) &&
      (outcome === "Todos" || log.outcome === outcome) &&
      (redeemed === "Todos" ||
        (redeemed === "Sí"
          ? Boolean(log.promotionRedeemed)
          : !log.promotionRedeemed)) &&
      (promotion === "Todas" ||
        (log.promotion || "Sin promoción") === promotion) &&
      dateMatch(log.callDate, fromDate, toDate)
  );
  const contacted = visible.filter(log => log.outcome === "Contactado").length;
  const recovered = visible.filter(
    log =>
      normalizeText(log.recoveryResult || "").includes("recuperado") &&
      !normalizeText(log.recoveryResult || "").includes("no recuperado")
  ).length;
  const exportCalls = () =>
    downloadGenericCsv(
      `historial-llamadas-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Fecha",
        "Cliente",
        "Teléfono",
        "Resultado",
        "Promoción",
        "Redimida",
        "Seguimiento",
        "Próxima llamada",
        "Notas",
        "Usuario",
        "Etapa campaña",
        "Canal campaña",
      ],
      visible.map(log => [
        log.callDate,
        log.clientName,
        log.phone,
        log.outcome,
        log.promotion,
        log.promotionRedeemed ? "Sí" : "No",
        log.recoveryResult,
        log.nextCallDate,
        log.notes,
        log.createdBy,
        log.assignedTo,
        log.campaignStage,
        log.campaignChannel,
      ])
    );
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="blue">CRM</Pill>
          <h2>Historial de llamadas realizadas.</h2>
          <p>
            Consulta cada contacto, promoción ofrecida, redención, resultado y
            próxima acción. El buscador superior también filtra esta vista.
          </p>
        </div>
        <div className="intro-note">
          <Phone size={17} />
          <span>
            <b>Seguimiento trazable</b>
            <small>
              {visible.length} registro(s) visibles de {logs.length} guardados.
            </small>
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="LLAMADAS"
          value={visible.length}
          detail="según filtros"
          icon={Phone}
        />
        <Stat
          label="CONTACTADOS"
          value={contacted}
          detail="resultado Contactado"
          accent="green"
          icon={Users}
        />
        <Stat
          label="RECUPERADOS"
          value={recovered}
          detail="resultado registrado"
          accent="purple"
          icon={Sparkles}
        />
      </div>
      <section className="panel calls-history-panel">
        <div className="calls-filter-row">
          <label>
            Desde
            <input
              type="date"
              value={fromDate}
              onChange={event => setFromDate(event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={toDate}
              onChange={event => setToDate(event.target.value)}
            />
          </label>
          <label>
            Resultado
            <select
              value={outcome}
              onChange={event => setOutcome(event.target.value)}
            >
              <option>Todos</option>
              {Array.from(new Set(logs.map(log => log.outcome)))
                .filter(Boolean)
                .map(value => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
          <label>
            Promoción
            <select
              value={promotion}
              onChange={event => setPromotion(event.target.value)}
            >
              <option>Todas</option>
              {Array.from(
                new Set([
                  ...promotions.map(item => item.name),
                  ...logs.map(log => log.promotion || "Sin promoción"),
                ])
              )
                .filter(Boolean)
                .map(value => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
          <label>
            Redimida
            <select
              value={redeemed}
              onChange={event => setRedeemed(event.target.value)}
            >
              <option>Todos</option>
              <option>Sí</option>
              <option>No</option>
            </select>
          </label>
          <div className="export-group">
            <button onClick={exportCalls}>
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() =>
                printReport(
                  `Desde: ${fromDate || "inicio"} · Hasta: ${toDate || "hoy"} · Resultado: ${outcome} · Promoción: ${promotion}`
                )
              }
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>
        {visible.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Resultado</th>
                  <th>Promoción</th>
                  <th>Seguimiento</th>
                  <th>Notas</th>
                  <th>Registró / Responsable</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(log => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.callDate)}</td>
                    <td>
                      <b>{log.clientName}</b>
                      <small className="table-sub">
                        {log.phone || "Sin teléfono"}
                      </small>
                    </td>
                    <td>{log.outcome}</td>
                    <td>
                      {log.promotion || "—"}
                      <small className="table-sub">
                        {log.promotion
                          ? log.promotionRedeemed
                            ? "Redimida"
                            : "No redimida"
                          : ""}
                      </small>
                    </td>
                    <td>
                      {log.recoveryResult || "Pendiente"}
                      <small className="table-sub">
                        {log.nextCallDate
                          ? `Próxima: ${formatDateTime(log.nextCallDate)}`
                          : "Sin próxima fecha"}
                      </small>
                    </td>
                    <td>{log.notes || "—"}</td>
                    <td>
                      {log.createdBy || "Dashboard"}
                      <small className="table-sub">
                        Responsable: {log.assignedTo || "Sin asignar"}
                      </small>
                      <small className="table-sub">
                        {log.campaignStage
                          ? `Campaña: ${log.campaignStage} · ${log.campaignChannel || "llamada"}`
                          : ""}
                      </small>
                    </td>
                    {isAdmin && (
                      <td className="calls-actions">
                        <button
                          className="small-action"
                          onClick={() => startEdit(log)}
                        >
                          Editar
                        </button>
                        <button
                          className="small-action danger"
                          onClick={() => deleteLog(log)}
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state-block">
            <Empty text="Todavía no hay llamadas registradas con estos filtros." />
            <button className="btn-borde" onClick={() => onNavigate("clients")}>
              Ir a Clientes para registrar una llamada
            </button>
          </div>
        )}
      </section>
      {editLog && (
        <div className="bw-modal-backdrop" onClick={() => setEditLog(null)}>
          <div
            className="bw-modal bw-modal-wide"
            onClick={event => event.stopPropagation()}
          >
            <div className="bw-modal-head">
              <h3>Editar registro de llamada</h3>
              <button onClick={() => setEditLog(null)}>×</button>
            </div>
            <p className="bw-modal-hint">
              El cambio queda registrado en auditoría. Se pedirá la credencial
              administrativa al guardar.
            </p>
            <div className="calls-edit-grid">
              <label>
                Fecha
                <input
                  type="date"
                  value={draft.callDate}
                  onChange={event =>
                    setDraft(current => ({ ...current, callDate: event.target.value }))
                  }
                />
              </label>
              <label>
                Resultado
                <input
                  value={draft.outcome}
                  onChange={event =>
                    setDraft(current => ({ ...current, outcome: event.target.value }))
                  }
                />
              </label>
              <label>
                Promoción
                <select
                  value={draft.promotion}
                  onChange={event =>
                    setDraft(current => ({ ...current, promotion: event.target.value }))
                  }
                >
                  <option value="">Sin promoción</option>
                  {promotions.map(item => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                  {draft.promotion &&
                    !promotions.some(item => item.name === draft.promotion) && (
                      <option value={draft.promotion}>{draft.promotion}</option>
                    )}
                </select>
              </label>
              <label>
                ¿Redimida?
                <select
                  value={draft.promotionRedeemed ? "si" : "no"}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      promotionRedeemed: event.target.value === "si",
                    }))
                  }
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </label>
              <label>
                Próxima llamada
                <input
                  type="date"
                  value={draft.nextCallDate}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      nextCallDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Responsable
                <input
                  value={draft.assignedTo}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      assignedTo: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="calls-edit-full">
              Seguimiento
              <input
                value={draft.recoveryResult}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    recoveryResult: event.target.value,
                  }))
                }
              />
            </label>
            <label className="calls-edit-full">
              Notas
              <textarea
                rows={3}
                value={draft.notes}
                onChange={event =>
                  setDraft(current => ({ ...current, notes: event.target.value }))
                }
              />
            </label>
            <div className="bw-modal-actions">
              <button
                className="bw-action bw-action-whatsapp"
                onClick={saveEdit}
                disabled={updateCall.isPending}
              >
                {updateCall.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
              <button className="bw-action" onClick={() => setEditLog(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function ResponsibleAdmin({
  users,
  audit,
}: {
  users: ResponsibleUser[];
  audit: AuditItem[];
}) {
  const utils = trpc.useUtils();
  const save = trpc.responsibleUsers.save.useMutation({
    onSuccess: () => {
      utils.responsibleUsers.list.invalidate();
      utils.responsibleUsers.adminList.invalidate();
      setName("");
      setEmail("");
    },
  });
  const update = trpc.responsibleUsers.update.useMutation({
    onSuccess: () => {
      utils.responsibleUsers.list.invalidate();
      utils.responsibleUsers.adminList.invalidate();
      setEditing(null);
    },
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "" });
  const submit = () => {
    if (!adminPin() || !name.trim()) return;
    save.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      active: 1,
      adminPin: "5956",
    });
  };
  const saveEdit = (user: ResponsibleUser) => {
    if (!adminPin() || !draft.name.trim()) return;
    update.mutate({
      id: user.id,
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      active: user.active,
      adminPin: "5956",
    });
  };
  const toggle = (user: ResponsibleUser) => {
    if (!adminPin()) return;
    update.mutate({
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active ? 0 : 1,
      adminPin: "5956",
    });
  };
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="orange">CONFIGURACIÓN</Pill>
          <h2>Usuarios responsables del sistema.</h2>
          <p>
            Administra quién puede aparecer como responsable de prioridades y
            próximos seguimientos.
          </p>
        </div>
        <div className="intro-note">
          <Users size={17} />
          <span>
            <b>Acceso protegido</b>
            <small>
              Agregar, editar o pausar usuarios requiere el PIN de
              administrador.
            </small>
          </span>
        </div>
      </div>
      <section className="panel admin-add-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">NUEVO RESPONSABLE</p>
            <h3>Agregar usuario operativo</h3>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            Nombre
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Nombre y apellido"
            />
          </label>
          <label>
            Correo opcional
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="usuario@coronel.pe"
              type="email"
            />
          </label>
          <Button disabled={!name.trim() || save.isPending} onClick={submit}>
            Agregar usuario
          </Button>
        </div>
        {save.error && <p className="form-error">{save.error.message}</p>}
        {(save.isSuccess || update.isSuccess) && (
          <div className="success-notice">
            ✓ Responsable guardado correctamente. La lista ya está sincronizada.
          </div>
        )}
      </section>
      <section className="panel admin-table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">LISTA DE RESPONSABLES</p>
            <h3>Usuarios disponibles</h3>
          </div>
          <Pill tone="orange">
            {users.filter(user => user.active).length} activos
          </Pill>
        </div>
        <div className="admin-user-list">
          {users.length ? (
            users.map(user => (
              <div
                className={`admin-user-row ${user.active ? "" : "inactive-row"}`}
                key={user.id}
              >
                {editing === user.id ? (
                  <>
                    <input
                      value={draft.name}
                      onChange={event =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                    <input
                      value={draft.email}
                      onChange={event =>
                        setDraft({ ...draft, email: event.target.value })
                      }
                      type="email"
                    />
                    <button onClick={() => saveEdit(user)}>Guardar</button>
                    <button onClick={() => setEditing(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <span>
                      <b>{user.name}</b>
                      <small>{user.email || "Sin correo"}</small>
                    </span>
                    <Pill tone={user.active ? "green" : "neutral"}>
                      {user.active ? "Activo" : "Pausado"}
                    </Pill>
                    <button
                      onClick={() => {
                        setEditing(user.id);
                        setDraft({ name: user.name, email: user.email || "" });
                      }}
                    >
                      Editar
                    </button>
                    <button onClick={() => toggle(user)}>
                      {user.active ? "Pausar" : "Activar"}
                    </button>
                  </>
                )}
              </div>
            ))
          ) : (
            <Empty text="Aún no hay responsables configurados." />
          )}
        </div>
      </section>
      <AuditPanel audit={audit.filter(item => item.entity === "responsable")} />
    </>
  );
}
function TargetHistory({
  history,
  records,
  catalog,
  audit,
}: {
  history: TargetHistoryItem[];
  records: RecordItem[];
  catalog: ServerCatalogItem[];
  audit: AuditItem[];
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const catalogKey = (value: string) =>
    normalizeText(value).replace(/[^a-z0-9]/g, "");
  const catalogMap = useMemo(
    () =>
      new Map(
        catalog.flatMap(item => [
          [catalogKey(item.id), item.name],
          [catalogKey(item.name), item.name],
        ])
      ),
    [catalog]
  );
  const displayName = (value: string) =>
    catalogMap.get(catalogKey(value)) || displayServer(value);
  const rows = useMemo(() => {
    const map: Record<
      string,
      {
        month: string;
        server: string;
        surveys: number;
        answered: number;
        good: number;
      }
    > = {};
    records.forEach(record => {
      const date = parseDate(record.timestamp);
      if (!date) return;
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if ((fromDate && day < fromDate) || (toDate && day > toDate)) return;
      const server = displayName(record.registeredBy);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}\u0000${server}`;
      map[key] ??= {
        month: new Intl.DateTimeFormat("es-PE", {
          month: "long",
          year: "numeric",
        }).format(date),
        server,
        surveys: 0,
        answered: 0,
        good: 0,
      };
      map[key].surveys += 1;
      const quality = clean(record.quality);
      if (["bueno", "regular", "malo"].includes(quality)) {
        map[key].answered += 1;
        if (quality === "bueno") map[key].good += 1;
      }
    });
    return Object.values(map)
      .sort((a, b) =>
        `${b.month}${b.server}`.localeCompare(`${a.month}${a.server}`)
      )
      .map(row => ({
        ...row,
        positive: row.answered
          ? Math.round((row.good / row.answered) * 100)
          : null,
      }));
  }, [records, catalogMap, fromDate, toDate]);
  const setHistoryRange = (range: "month" | "previous" | "30d" | "clear") => {
    const now = new Date();
    const input = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (range === "clear") {
      setFromDate("");
      setToDate("");
      return;
    }
    if (range === "month") {
      setFromDate(input(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(input(now));
      return;
    }
    if (range === "previous") {
      setFromDate(input(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setToDate(input(new Date(now.getFullYear(), now.getMonth(), 0)));
      return;
    }
    setFromDate(
      input(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))
    );
    setToDate(input(now));
  };
  const exportHistory = () =>
    downloadGenericCsv(
      `historial-metas-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Mes",
        "Equipo/Mesero",
        "Encuestas",
        "Calidad respondida",
        "Calidad positiva",
      ],
      rows.map(row => [
        row.month,
        row.server,
        row.surveys,
        row.answered,
        row.positive === null ? "" : `${row.positive}%`,
      ])
    );
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="green">CONTROL DE GESTIÓN</Pill>
          <h2>Historial de metas del equipo.</h2>
          <p>
            Consulta el desempeño por período, equipo y mesero, y compara los
            cambios de metas registrados.
          </p>
        </div>
        <div className="intro-note">
          <Clock3 size={17} />
          <span>
            <b>Lectura histórica</b>
            <small>
              “Calidad respondida” cuenta únicamente Bueno, Regular o Malo. Los
              cambios de meta quedan auditados con fecha y usuario.
            </small>
          </span>
        </div>
      </div>
      <section className="panel team-date-filter target-history-filter">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PERÍODO DEL HISTORIAL</p>
            <h3>Filtrar desempeño por fechas</h3>
            <small className="muted">
              {rows.length} combinación(es) equipo/mes visibles.
            </small>
          </div>
        </div>
        <div className="date-filter-controls">
          <label>
            Desde
            <input
              type="date"
              value={fromDate}
              onChange={event => setFromDate(event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={toDate}
              onChange={event => setToDate(event.target.value)}
            />
          </label>
          <button onClick={() => setHistoryRange("month")}>Este mes</button>
          <button onClick={() => setHistoryRange("previous")}>
            Mes anterior
          </button>
          <button onClick={() => setHistoryRange("30d")}>
            Últimos 30 días
          </button>
          <button
            className="reset-button"
            onClick={() => setHistoryRange("clear")}
          >
            Limpiar
          </button>
        </div>
      </section>
      <TargetPerformanceChart rows={rows} />
      <section className="panel admin-table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">DESEMPEÑO POR EQUIPO / MESERO</p>
            <h3>Resultados observados</h3>
          </div>
          <div className="export-group">
            <button onClick={exportHistory}>
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() =>
                printReport(
                  `Desde: ${fromDate || "inicio"} · Hasta: ${toDate || "hoy"} · Vista: equipo y mesero`
                )
              }
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Equipo / mesero</th>
                  <th>Encuestas</th>
                  <th>Calidad respondida</th>
                  <th>Calidad positiva</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.month}-${row.server}-${index}`}>
                    <td>{row.month}</td>
                    <td>
                      <b>{row.server}</b>
                    </td>
                    <td>{row.surveys}</td>
                    <td>{row.answered}</td>
                    <td>{row.positive === null ? "—" : `${row.positive}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No hay desempeño en el rango seleccionado." />
        )}
      </section>
      <section className="panel admin-table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CAMBIOS DE CONFIGURACIÓN</p>
            <h3>Metas guardadas</h3>
          </div>
          <Pill tone="blue">{history.length} cambios</Pill>
        </div>
        {history.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Período</th>
                  <th>Encuestas por mesero</th>
                  <th>Encuestas delivery/web</th>
                  <th>Calidad positiva</th>
                  <th>Guardó</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.changedAt)}</td>
                    <td>{item.periodLabel}</td>
                    <td>{item.surveysPerServer}</td>
                    <td>{item.surveysPerDelivery ?? 10}</td>
                    <td>{item.positiveQualityPercent}%</td>
                    <td>{item.changedBy || "Dashboard"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Todavía no hay cambios de metas registrados." />
        )}
      </section>
      <AuditPanel audit={audit.filter(item => item.entity === "metas")} />
    </>
  );
}
function AuditPanel({ audit }: { audit: AuditItem[] }) {
  return (
    <section className="panel audit-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">AUDITORÍA</p>
          <h3>Últimos cambios registrados</h3>
        </div>
        <Pill tone="neutral">{audit.length} registros</Pill>
      </div>
      {audit.length ? (
        <div className="audit-list">
          {audit.slice(0, 12).map(item => (
            <div className="audit-row" key={item.id}>
              <span>
                <b>{item.action}</b>
                <small>{item.details || "Sin detalle"}</small>
              </span>
              <span>
                <b>{item.changedBy}</b>
                <small>{formatDateTime(item.changedAt)}</small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Todavía no hay cambios registrados en este módulo." />
      )}
    </section>
  );
}
function buildProfiles(records: RecordItem[]): ClientProfile[] {
  const groups: Record<string, RecordItem[]> = {};
  records
    .filter(r => phoneDigits(r.phone) || normalizeText(r.clientName))
    .forEach(r => {
      const key = clientKeyOf(r);
      groups[key] ??= [];
      groups[key].push(r);
    });
  return Object.entries(groups).map(([key, rows]) => {
    const sorted = [...rows].reverse();
    const last = sorted[0] ?? rows[rows.length - 1];
    const quality = last.quality || "";
    const segment =
      clean(quality) === "malo" || clean(quality) === "regular"
        ? "En riesgo"
        : rows.length >= 3
          ? "Fiel"
          : rows.length === 2
            ? "Recurrente"
            : "Nuevo";
    return {
      key,
      name: last.clientName || "Cliente sin nombre",
      phone: last.phone || "",
      count: rows.length,
      quality,
      comment: last.comment || "",
      dish: last.dish || "",
      segment,
      source: displayServer(last.registeredBy),
      birthday: last.birthday || "",
    };
  });
}

function TargetPerformanceChart({
  rows,
}: {
  rows: {
    month: string;
    server: string;
    surveys: number;
    answered: number;
    good: number;
    positive: number | null;
  }[];
}) {
  const months = Array.from(new Set(rows.map(row => row.month)));
  const [selectedMonth, setSelectedMonth] = useState(months[0] || "");
  const visible = rows.filter(row => row.month === selectedMonth);
  const max = Math.max(...visible.map(row => row.surveys), 1);
  return (
    <section className="panel target-chart-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">COMPARATIVA VISUAL</p>
          <h3>Encuestas por mesero y mes</h3>
          <small className="muted">
            Selecciona un mes para comparar el volumen entre meseros.
          </small>
        </div>
        <select
          className="chart-month-select"
          value={selectedMonth}
          onChange={event => setSelectedMonth(event.target.value)}
        >
          {months.map(month => (
            <option key={month}>{month}</option>
          ))}
        </select>
      </div>
      {visible.length ? (
        <div className="target-bar-chart">
          {visible
            .sort((a, b) => b.surveys - a.surveys)
            .map(row => (
              <button
                className="target-bar-row"
                key={row.server}
                title={`${row.server}: ${row.surveys} encuestas · ${row.positive === null ? "sin calidad" : `${row.positive}% positivo`}`}
              >
                <span className="target-bar-name">{row.server}</span>
                <span className="target-bar-track">
                  <i
                    style={{
                      width: `${Math.max((row.surveys / max) * 100, 5)}%`,
                    }}
                  />
                </span>
                <b>{row.surveys}</b>
                <small>
                  {row.positive === null ? "—" : `${row.positive}%`}
                </small>
              </button>
            ))}
        </div>
      ) : (
        <Empty text="No hay datos de meseros para graficar." />
      )}
    </section>
  );
}

function Voice({
  comments,
  reviewCount,
  topicPhrases,
  positiveHighlights,
  negativeHighlights,
  positive,
  positiveCount,
}: {
  comments: RecordItem[];
  reviewCount: number;
  topicPhrases: [string, number][];
  positiveHighlights: SentimentHighlight[];
  negativeHighlights: SentimentHighlight[];
  positive: number;
  positiveCount: number;
}) {
  const [selected, setSelected] = useState<SentimentHighlight | null>(null);
  const repeatedComments = useMemo(() => buildRepeatedComments(comments), [comments]);
  const requestComments = useMemo(() => buildRequestComments(comments), [comments]);
  const visibleRequests = requestComments.slice(0, 10);
  const requestTags = useMemo(() => {
    const counts: Record<string, number> = {};
    requestComments.forEach(record => {
      const tag = requestTag(record.comment);
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [requestComments]);
  const wordCard = (
    item: SentimentHighlight,
    tone: "positive" | "negative"
  ) => (
    <button
      className={`sentiment-word sentiment-${tone}`}
      key={item.word}
      onClick={() => setSelected(item)}
    >
      <span>{tone === "positive" ? "✦" : "⚠"}</span>
      <b>{item.word}</b>
      <strong>{item.count}</strong>
      <small>menciones · ver comentarios</small>
    </button>
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <Pill tone="blue">VOZ DEL CLIENTE</Pill>
          <h2>Lo que dicen, convertido en mejora.</h2>
          <p>
            Las palabras positivas como “excelente” o “rico” muestran lo que
            funciona. Las señales negativas ayudan a detectar qué se repite y
            llevan al comentario completo.
          </p>
        </div>
        <QualityFace percent={positive} count={positiveCount} />
      </div>
      <div className="stats-grid">
        <Stat
          label="COMENTARIOS"
          value={comments.length}
          detail="con texto"
          icon={MessageSquareText}
        />
        <Stat
          label="FRASES DETECTADAS"
          value={topicPhrases.length}
          detail="2+ apariciones"
          accent="purple"
          icon={Sparkles}
        />
        <Stat
          label="ÚLTIMO COMENTARIO"
          value={
            comments.length
              ? formatDate(comments[comments.length - 1].timestamp)
              : "—"
          }
          detail="fecha de captura"
          accent="orange"
          icon={Clock3}
        />
        <Stat
          label="REVISAR"
          value={reviewCount}
          detail="asociados a alerta"
          accent="red"
          icon={AlertTriangle}
        />
        <Stat
          label="REPETIDOS"
          value={repeatedComments.length}
          detail="frases que se repiten"
          accent="purple"
          icon={MessageSquareText}
        />
        <Stat
          label="PEDIDOS"
          value={requestComments.length}
          detail="sugerencias detectadas"
          accent="orange"
          icon={Sparkles}
        />      </div>
      <div className="dashboard-grid voice-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LO QUE MÁS SE REPITE</p>
              <h3>Comentarios frecuentes</h3>
            </div>
            <Pill tone="blue">{repeatedComments.length}</Pill>
          </div>
          <div className="voice-list">
            {repeatedComments.length ? (
              repeatedComments.slice(0, 10).map(item => (
                <div className="voice-list-item" key={item.text}>
                  <span className="voice-count">×{item.count}</span>
                  <p>{item.text}</p>
                </div>
              ))
            ) : (
              <Empty text="Aún no hay comentarios repetidos." />
            )}
          </div>
          <p className="micro-note">
            Agrupado por texto equivalente; el número indica cuántas veces
            aparece.
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LO QUE PIDEN</p>
              <h3>Pedidos y sugerencias</h3>
            </div>
            <Pill tone="orange">{requestComments.length}</Pill>
          </div>
          {requestTags.length ? (
            <div className="voice-tag-row">
              {requestTags.map(([tag, count]) => (
                <span className="voice-tag" key={tag}>
                  {tag} · {count}
                </span>
              ))}
            </div>
          ) : null}
          <div className="voice-list">
            {requestComments.length ? (
              visibleRequests.map(record => (
                <div
                  className="voice-list-item"
                  key={`${record.id}-${record.timestamp}`}
                >
                  <span className="voice-tag">
                    {requestTag(record.comment)}
                  </span>
                  <p>{record.comment}</p>
                </div>
              ))
            ) : (
              <Empty text="No se detectaron pedidos en los comentarios." />
            )}
          </div>
          <p className="micro-note">
            Detectado por palabras clave: tiempo, papas, salsa, variedad,
            promos, bebidas, ambiente.
          </p>
        </section>
      </div>
      <div className="dashboard-grid voice-grid">
        <section className="panel voice-highlight-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SEÑALES POSITIVAS</p>
              <h3>Lo que más elogian</h3>
            </div>
            <Pill tone="green">Interactivo</Pill>
          </div>
          <div className="positive-word-list">
            {positiveHighlights.length ? (
              positiveHighlights.map(item => wordCard(item, "positive"))
            ) : (
              <Empty text="Aún no hay elogios repetidos." />
            )}
          </div>
          <p className="micro-note">
            Haz clic en una palabra para ver el comentario completo del cliente.
          </p>
        </section>
        <section className="panel voice-negative-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SEÑALES DE MEJORA</p>
              <h3>Lo malo que más se repite</h3>
            </div>
            <Pill tone="red">Contexto completo</Pill>
          </div>
          <div className="negative-word-list">
            {negativeHighlights.length ? (
              negativeHighlights.map(item => wordCard(item, "negative"))
            ) : (
              <Empty text="No hay señales negativas repetidas." />
            )}
          </div>
          <p className="micro-note">
            Las señales negativas se muestran con acceso directo a los
            comentarios originales.
          </p>
        </section>
        <section className="panel topics-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LECTURA RÁPIDA</p>
              <h3>Frases que se repiten</h3>
            </div>
            <Pill tone="blue">Contexto incluido</Pill>
          </div>
          <div className="word-cloud">
            {topicPhrases.map(([phrase, count], i) => (
              <span
                key={phrase}
                className={`word word-${i % 5}`}
                style={{ fontSize: `${14 + Math.min(count, 5) * 4}px` }}
              >
                {phrase}
                <sup>{count}</sup>
              </span>
            ))}
          </div>
          {!topicPhrases.length && (
            <Empty text="Aún no hay frases repetidas 4 o más veces." />
          )}
          <p className="micro-note">
            Ejemplos: “buena atención”, “mala atención”, “falta consideración” o
            “sabor excelente”.
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">COMENTARIOS RECIENTES</p>
              <h3>Contexto original</h3>
            </div>
          </div>
          <div className="comment-list">
            {comments
              .slice(-7)
              .reverse()
              .map(r => (
                <div className="comment-row" key={r.id}>
                  <div className="comment-meta">
                    <span>{formatDate(r.timestamp)}</span>
                    <Pill
                      tone={
                        clean(r.quality) === "malo"
                          ? "red"
                          : clean(r.quality) === "regular"
                            ? "orange"
                            : "green"
                      }
                    >
                      {r.quality || "Sin calidad"}
                    </Pill>
                  </div>
                  <p>“{r.comment}”</p>
                  <small>{r.dish || "Producto no indicado"}</small>
                </div>
              ))}
          </div>
        </section>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="comment-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">CONTEXTO DE LA SEÑAL</p>
                <h3>Comentarios con “{selected.word}”</h3>
                <p className="muted">
                  {selected.count} mención(es) encontrada(s).
                </p>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)}>
                <X size={17} />
              </button>
            </div>
            <div className="highlight-comments">
              {selected.comments.map(comment => (
                <article key={comment.id}>
                  <div>
                    <b>{formatDateTime(comment.timestamp)}</b>
                    <Pill
                      tone={
                        clean(comment.quality) === "malo"
                          ? "red"
                          : clean(comment.quality) === "regular"
                            ? "orange"
                            : "green"
                      }
                    >
                      {comment.quality || "Sin calidad"}
                    </Pill>
                  </div>
                  <p>“{comment.comment}”</p>
                  <small>
                    {comment.clientName || "Cliente sin nombre"} ·{" "}
                    {comment.dish || "Producto no indicado"}
                  </small>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function MonthlyComparison({ records }: { records: RecordItem[] }) {
  const comparison = useMemo(() => {
    const dated = records
      .map(r => ({ r, d: parseDate(r.timestamp) }))
      .filter((x): x is { r: RecordItem; d: Date } => Boolean(x.d));
    if (!dated.length) return null;
    const latest = new Date(Math.max(...dated.map(x => x.d.getTime())));
    const year = latest.getFullYear();
    const month = latest.getMonth();
    const currentRows = dated.filter(
      x => x.d.getFullYear() === year && x.d.getMonth() === month
    );
    const prevDate = new Date(year, month - 1, 1);
    const prevRowsAll = dated.filter(
      x =>
        x.d.getFullYear() === prevDate.getFullYear() &&
        x.d.getMonth() === prevDate.getMonth()
    );
    const cutoff = latest.getDate();
    const prevRows = prevRowsAll.filter(x => x.d.getDate() <= cutoff);
    const positive = (rows: typeof currentRows) => {
      const answered = rows.filter(x => hasScoredQuality(x.r.quality));
      return answered.length
        ? Math.round(
            (answered.filter(x => clean(x.r.quality) === "bueno").length /
              answered.length) *
              100
          )
        : 0;
    };
    const delta = (a: number, b: number) =>
      b ? Math.round(((a - b) / b) * 100) : null;
    return {
      current: currentRows.length,
      previous: prevRows.length,
      currentPositive: positive(currentRows),
      previousPositive: positive(prevRows),
      surveyDelta: delta(currentRows.length, prevRows.length),
      qualityDelta: delta(positive(currentRows), positive(prevRows)),
      label: new Intl.DateTimeFormat("es-PE", {
        month: "long",
        year: "numeric",
      }).format(latest),
      prevLabel: new Intl.DateTimeFormat("es-PE", {
        month: "long",
        year: "numeric",
      }).format(prevDate),
      cutoff,
    };
  }, [records]);
  if (!comparison) return null;
  return (
    <section className="panel monthly-comparison">
      <div className="panel-head">
        <div>
          <p className="eyebrow">COMPARACIÓN MENSUAL ACUMULADA</p>
          <h3>
            {comparison.label} vs. {comparison.prevLabel}
          </h3>
          <small className="muted">
            Acumulado hasta el día {comparison.cutoff} del mes, para comparar el
            mismo tramo.
          </small>
        </div>
        <Pill
          tone={
            comparison.surveyDelta !== null && comparison.surveyDelta >= 0
              ? "green"
              : "red"
          }
        >
          {comparison.surveyDelta === null
            ? "Sin base"
            : `${comparison.surveyDelta >= 0 ? "+" : ""}${comparison.surveyDelta}% encuestas`}
        </Pill>
      </div>
      <div className="monthly-grid">
        <div>
          <span>Encuestas actuales</span>
          <strong>{comparison.current}</strong>
          <small>
            {comparison.previous
              ? `Anterior: ${comparison.previous}`
              : "Sin datos previos"}
          </small>
        </div>
        <div>
          <span>Calidad positiva actual</span>
          <strong>{comparison.currentPositive}%</strong>
          <small>
            {comparison.previous
              ? `Anterior: ${comparison.previousPositive}%`
              : "Sin datos previos"}
            {comparison.qualityDelta === null
              ? ""
              : ` · ${comparison.qualityDelta >= 0 ? "+" : ""}${comparison.qualityDelta} pp`}
          </small>
        </div>
        <div>
          <span>Lectura</span>
          <strong>
            {comparison.surveyDelta === null
              ? "Primera base"
              : comparison.surveyDelta >= 0
                ? "Más participación"
                : "Menor participación"}
          </strong>
          <small>Se compara el mismo número de días</small>
        </div>
      </div>
    </section>
  );
}

function ComparisonBar({
  label,
  current,
  previous,
  suffix = "",
}: {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
}) {
  const max = Math.max(current, previous, 1);
  return (
    <div className="comparison-bar-group">
      <div className="comparison-bar-label">
        <b>{label}</b>
        <span>
          Actual {current}
          {suffix} · Anterior {previous}
          {suffix}
        </span>
      </div>
      <div className="comparison-bar-line">
        <i
          className="comparison-bar-current"
          style={{
            width: `${Math.max((current / max) * 100, current ? 4 : 0)}%`,
          }}
        />
        <em
          style={{
            width: `${Math.max((previous / max) * 100, previous ? 4 : 0)}%`,
          }}
        />
      </div>
      <div className="comparison-bar-legend">
        <span>
          <i className="legend-current" />
          Actual
        </span>
        <span>
          <i className="legend-previous" />
          Anterior
        </span>
      </div>
    </div>
  );
}

function PeriodComparison({
  records,
  fromDate,
  toDate,
}: {
  records: RecordItem[];
  fromDate: string;
  toDate: string;
}) {
  const comparison = useMemo(() => {
    if (!fromDate || !toDate || fromDate > toDate) return null;
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59`);
    const previousPeriod = getPreviousPeriod(fromDate, toDate);
    if (!previousPeriod) return null;
    const previousFrom = previousPeriod.from;
    const previousTo = previousPeriod.to;
    const inRange = (value: string, start: Date, end: Date) => {
      const date = parseDate(value);
      return Boolean(date && date >= start && date <= end);
    };
    const current = records.filter(r => inRange(r.timestamp, from, to));
    const previous = records.filter(r =>
      inRange(r.timestamp, previousFrom, previousTo)
    );
    const metrics = (rows: RecordItem[]) => {
      const answered = rows.filter(r => hasScoredQuality(r.quality));
      const good = answered.filter(r => clean(r.quality) === "bueno").length;
      const salon = rows.filter(
        r => displayServer(r.registeredBy) !== "DELIVERY / WEB"
      ).length;
      return {
        surveys: rows.length,
        salon,
        positive: answered.length
          ? Math.round((good / answered.length) * 100)
          : null,
      };
    };
    const currentMetrics = metrics(current);
    const previousMetrics = metrics(previous);
    const delta = (now: number, old: number) =>
      old ? Math.round(((now - old) / old) * 100) : null;
    const dateLabel = (date: Date) =>
      new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    return {
      current: currentMetrics,
      previous: previousMetrics,
      surveyDelta: delta(currentMetrics.surveys, previousMetrics.surveys),
      salonDelta: delta(currentMetrics.salon, previousMetrics.salon),
      qualityPoints:
        currentMetrics.positive !== null && previousMetrics.positive !== null
          ? currentMetrics.positive - previousMetrics.positive
          : null,
      currentLabel: `${dateLabel(from)} – ${dateLabel(to)}`,
      previousLabel: `${dateLabel(previousFrom)} – ${dateLabel(previousTo)}`,
    };
  }, [records, fromDate, toDate]);
  if (!comparison)
    return (
      <section className="panel period-comparison">
        <div>
          <p className="eyebrow">COMPARACIÓN AUTOMÁTICA</p>
          <h3>Selecciona un período completo</h3>
          <small className="muted">
            Elige las fechas Desde y Hasta para comparar contra el tramo
            inmediatamente anterior con la misma duración.
          </small>
        </div>
      </section>
    );
  return (
    <section className="panel period-comparison">
      <div className="panel-head">
        <div>
          <p className="eyebrow">COMPARACIÓN AUTOMÁTICA</p>
          <h3>Período seleccionado vs. período anterior</h3>
          <small className="muted">
            {comparison.currentLabel} vs. {comparison.previousLabel} · misma
            duración
          </small>
        </div>
        <Pill
          tone={
            comparison.surveyDelta === null || comparison.surveyDelta >= 0
              ? "green"
              : "red"
          }
        >
          {comparison.surveyDelta === null
            ? "Sin base anterior"
            : `${comparison.surveyDelta >= 0 ? "+" : ""}${comparison.surveyDelta}% encuestas`}
        </Pill>
      </div>
      <div className="monthly-grid">
        <div>
          <span>Encuestas actuales</span>
          <strong>{comparison.current.surveys}</strong>
          <small>
            {comparison.previous.surveys
              ? formatCountChange(
                  comparison.current.surveys,
                  comparison.previous.surveys,
                  comparison.surveyDelta
                )
              : "Sin datos previos"}
          </small>
        </div>
        <div>
          <span>Encuestas de salón</span>
          <strong>{comparison.current.salon}</strong>
          <small>
            {comparison.previous.salon
              ? formatCountChange(
                  comparison.current.salon,
                  comparison.previous.salon,
                  comparison.salonDelta
                )
              : "Sin datos previos"}
          </small>
        </div>
        <div>
          <span>Calidad positiva</span>
          <strong>
            {comparison.current.positive === null
              ? "—"
              : `${comparison.current.positive}%`}
          </strong>
          <small>
            {comparison.previous.positive === null
              ? "Sin datos previos"
              : `Anterior: ${comparison.previous.positive}% · diferencia ${comparison.qualityPoints === null ? "—" : `${comparison.qualityPoints >= 0 ? "+" : ""}${comparison.qualityPoints} puntos`}`}
          </small>
        </div>
      </div>
      <div className="comparison-visual">
        <ComparisonBar
          label="Encuestas"
          current={comparison.current.surveys}
          previous={comparison.previous.surveys}
        />
        <ComparisonBar
          label="Salón"
          current={comparison.current.salon}
          previous={comparison.previous.salon}
        />
        <ComparisonBar
          label="Calidad positiva"
          current={comparison.current.positive ?? 0}
          previous={comparison.previous.positive ?? 0}
          suffix="%"
        />
      </div>
      <p className="comparison-explanation">
        <b>Cómo leerlo:</b> la variación porcentual compara el tamaño actual
        contra el anterior. Los <b>puntos</b> de calidad son una resta directa:
        79% − 100% = −21 puntos; no son −21%.
      </p>
    </section>
  );
}

function ServerAvatar({ name }: { name: string }) {
  const hue =
    Math.abs(name.split("").reduce((n, char) => n + char.charCodeAt(0), 0)) %
    360;
  return (
    <svg
      className="server-avatar-image"
      viewBox="0 0 48 48"
      role="img"
      aria-label={`Avatar de ${name}`}
    >
      <circle cx="24" cy="24" r="23" fill={`hsl(${hue} 55% 92%)`} />
      <circle cx="24" cy="18" r="8" fill={`hsl(${hue} 45% 42%)`} />
      <path
        d="M10 42c1.5-9 7-13 14-13s12.5 4 14 13"
        fill={`hsl(${hue} 45% 42%)`}
      />
      <path d="M16 17c1-7 15-10 17 1-4-3-10-3-17-1Z" fill="#17324d" />
    </svg>
  );
}

function Team({
  onNavigate,
  records,
  catalog,
}: {
  onNavigate: (page: Page, filter?: string, focus?: OverviewFocus) => void;
  records: RecordItem[];
  catalog: ServerCatalogItem[];
}) {
  const targetsQuery = trpc.targets.get.useQuery();
  const saveTargetsMutation = trpc.targets.save.useMutation();
  const [targetSurveys, setTargetSurveys] = useState(
    () => localStorage.getItem("coronel.targetSurveys") || "10"
  );
  const [targetDelivery, setTargetDelivery] = useState(
    () => localStorage.getItem("coronel.targetDelivery") || "10"
  );
  const [targetQuality, setTargetQuality] = useState(
    () => localStorage.getItem("coronel.targetQuality") || "80"
  );
  const [saved, setSaved] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const utils = trpc.useUtils();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const surveyGoal = Math.max(1, Number(targetSurveys) || 1);
  const qualityGoal = Math.min(100, Math.max(1, Number(targetQuality) || 1));
  const deliveryGoal = Math.max(1, Number(targetDelivery) || 1);
  const catalogMap = useMemo(() => {
    const key = (value: string) =>
      normalizeText(value).replace(/[^a-z0-9]/g, "");
    return new Map(
      catalog.flatMap(item => [
        [key(item.id), item.name],
        [key(item.name), item.name],
      ])
    );
  }, [catalog]);
  const displayTeamName = (value: string) => {
    const key = normalizeText(value).replace(/[^a-z0-9]/g, "");
    return (
      catalogMap.get(key) ||
      value
        .trim()
        .toUpperCase()
        .replace(/[.\s]+/g, " ")
    );
  };
  useEffect(() => {
    if (targetsQuery.data) {
      setTargetSurveys(String(targetsQuery.data.surveysPerServer));
      setTargetDelivery(String(targetsQuery.data.surveysPerDelivery ?? 10));
      setTargetQuality(String(targetsQuery.data.positiveQualityPercent));
      localStorage.setItem(
        "coronel.targetSurveys",
        String(targetsQuery.data.surveysPerServer)
      );
      localStorage.setItem(
        "coronel.targetDelivery",
        String(targetsQuery.data.surveysPerDelivery ?? 10)
      );
      localStorage.setItem(
        "coronel.targetQuality",
        String(targetsQuery.data.positiveQualityPercent)
      );
    }
  }, [targetsQuery.data]);
  const periodRecords = useMemo(
    () => records.filter(r => isWithinDateRange(r.timestamp, fromDate, toDate)),
    [records, fromDate, toDate]
  );
  const servers = useMemo(
    () =>
      Object.entries(
        periodRecords.reduce<Record<string, number>>((acc, r) => {
          const name = displayServer(r.registeredBy);
          if (name !== "DELIVERY / WEB") {
            const canonical = displayTeamName(name);
            acc[canonical] = (acc[canonical] || 0) + 1;
          }
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1]),
    [periodRecords, catalogMap]
  );
  const qualityByServer = servers.map(([name, count]) => {
    const rows = periodRecords.filter(
      r =>
        displayServer(r.registeredBy) !== "DELIVERY / WEB" &&
        displayTeamName(displayServer(r.registeredBy)) === name
    );
    const answered = rows.filter(r => hasScoredQuality(r.quality));
    const good = answered.filter(r => clean(r.quality) === "bueno").length;
    return {
      name,
      count,
      good,
      answered: answered.length,
      pct: answered.length ? (good / answered.length) * 100 : 0,
      ci: wilsonInterval(good, answered.length),
    };
  });
  const lowSampleServers = qualityByServer.filter(server => server.answered < 20);
  const salonRecords = periodRecords.filter(
    r => displayServer(r.registeredBy) !== "DELIVERY / WEB"
  );
  const setQuickPeriod = (period: "7d" | "month" | "clear") => {
    const now = new Date();
    if (period === "clear") {
      setFromDate("");
      setToDate("");
      return;
    }
    const start =
      period === "7d"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const toInput = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setFromDate(toInput(start));
    setToDate(toInput(now));
  };
  const saveTargets = () => {
    const surveys = Math.max(1, Number(targetSurveys) || 1);
    const delivery = Math.max(1, Number(targetDelivery) || 1);
    const quality = Math.min(100, Math.max(1, Number(targetQuality) || 1));
    setTargetSurveys(String(surveys));
    setTargetDelivery(String(delivery));
    setTargetQuality(String(quality));
    localStorage.setItem("coronel.targetSurveys", String(surveys));
    localStorage.setItem("coronel.targetDelivery", String(delivery));
    localStorage.setItem("coronel.targetQuality", String(quality));
    const pin = window.prompt("PIN de administrador para guardar metas:");
    if (pin !== "5956") return;
    saveTargetsMutation.mutate(
      {
        surveysPerServer: surveys,
        surveysPerDelivery: delivery,
        positiveQualityPercent: quality,
        periodLabel,
      },
      {
        onSuccess: async () => {
          setSaved(true);
          await Promise.all([
            utils.targets.history.refetch(),
            utils.targets.get.refetch(),
          ]);
        },
      }
    );
  };
  const periodLabel =
    fromDate || toDate
      ? `${fromDate || "inicio"} → ${toDate || "hoy"}`
      : "Todos los datos";
  return (
    <>
      <div className="page-intro">
        <div>
          <Pill tone="orange">EQUIPO Y OPERACIÓN</Pill>
          <h2>Meseros vs. delivery web.</h2>
          <p>
            El ranking y los indicadores se calculan únicamente con el período
            elegido.
          </p>
        </div>
        <div className="intro-note">
          <UserRoundCheck size={17} />
          <span>
            <b>Catálogo maestro conectado</b>
            <small>
              {catalog.length
                ? `${catalog.length} meseros en la pestaña Meseros.`
                : "Sin catálogo disponible; se muestran los IDs."}
            </small>
          </span>
        </div>
      </div>
      <section className="panel team-date-filter">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PERÍODO DE EVALUACIÓN</p>
            <h3>Filtrar rendimiento por fechas</h3>
            <small className="muted">
              Período aplicado: {periodLabel} · {periodRecords.length}{" "}
              encuesta(s)
            </small>
          </div>
          <div className="period-shortcuts">
            <button onClick={() => setQuickPeriod("7d")}>Últimos 7 días</button>
            <button onClick={() => setQuickPeriod("month")}>Este mes</button>
            <button onClick={() => setQuickPeriod("clear")}>Todo</button>
          </div>
        </div>
        <div className="date-filter-controls">
          <label>
            Desde
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </label>
          {fromDate && toDate && fromDate > toDate && (
            <span className="form-error">
              La fecha inicial debe ser anterior a la final.
            </span>
          )}
        </div>
      </section>
      <PeriodComparison records={records} fromDate={fromDate} toDate={toDate} />
      <section
        id="team-targets"
        className={`panel targets-panel ${targetsOpen ? "is-open" : "is-collapsed"}`}
      >
        <button
          className="targets-toggle"
          onClick={() => setTargetsOpen(value => !value)}
          aria-expanded={targetsOpen}
        >
          <span>
            <p className="eyebrow">OBJETIVOS DEL EQUIPO</p>
            <h3>Objetivos del equipo</h3>
            <small>
              Editar metas compartidas y registrar el cambio en el historial.
            </small>
          </span>
          <span className="targets-toggle-action">
            {targetsOpen ? "Ocultar edición" : "Editar objetivos"}{" "}
            <ChevronDown size={18} className={targetsOpen ? "rotate" : ""} />
          </span>
        </button>
        {targetsOpen && (
          <div className="targets-editor">
            <div className="targets-editor-note">
              Se guardan en la base de datos y se comparten entre dispositivos.
              Cada guardado crea una fila en Historial de metas.
            </div>
            <div className="target-save-status">
              {saved
                ? `✓ Guardadas: ${surveyGoal} encuestas · ${qualityGoal}% calidad`
                : saveTargetsMutation.isPending
                  ? "Guardando…"
                  : ""}
              <Button
                disabled={saveTargetsMutation.isPending}
                onClick={saveTargets}
              >
                {saveTargetsMutation.isPending ? "Guardando…" : "Guardar metas"}
              </Button>
            </div>
            <div className="target-controls">
              <label>
                Encuestas por mesero
                <input
                  type="number"
                  min="1"
                  value={targetSurveys}
                  onChange={e => setTargetSurveys(e.target.value)}
                />
              </label>
              <label>
                Encuestas delivery / web
                <input
                  type="number"
                  min="1"
                  value={targetDelivery}
                  onChange={e => setTargetDelivery(e.target.value)}
                />
              </label>
              <label>
                Calidad positiva mínima (%)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={targetQuality}
                  onChange={e => setTargetQuality(e.target.value)}
                />
              </label>
              <span className="muted target-summary">
                Objetivo activo: <b>{surveyGoal} encuestas por mesero</b>,{" "}
                <b>{deliveryGoal} delivery/web</b> y{" "}
                <b>{qualityGoal}% de calidad positiva</b>.
              </span>
            </div>
            {saveTargetsMutation.error && (
              <p className="form-error">
                No se pudieron guardar las metas:{" "}
                {saveTargetsMutation.error.message}
              </p>
            )}
          </div>
        )}
      </section>
      <div className="stats-grid">
        <Stat
          label="ENCUESTAS DE SALÓN"
          value={salonRecords.length}
          detail="en el período"
          icon={UserRoundCheck}
          onClick={() =>
            document
              .getElementById("team-volume")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
        <Stat
          label="DELIVERY / WEB"
          value={periodRecords.length - salonRecords.length}
          detail={`meta ${deliveryGoal} · en el período`}
          accent="purple"
          icon={MessageSquareText}
          onClick={() =>
            document
              .getElementById("team-volume")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
        <Stat
          label="MESEROS"
          value={servers.length}
          detail="con respuestas"
          accent="blue"
          icon={Users}
          onClick={() =>
            document
              .getElementById("team-scorecard")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
        <Stat
          label="META CALIDAD"
          value={`${qualityGoal}%`}
          detail="objetivo positivo"
          accent="green"
          icon={Sparkles}
          onClick={() =>
            document
              .getElementById("team-targets")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
      </div>
      <div className="dashboard-grid team-grid">
        <section
          id="delivery-scorecard"
          className="panel delivery-target-panel"
        >
          <div className="panel-head">
            <div>
              <p className="eyebrow">META DELIVERY / WEB</p>
              <h3>Ventas web y delivery</h3>
            </div>
            <Pill
              tone={
                periodRecords.length - salonRecords.length >= deliveryGoal
                  ? "green"
                  : "orange"
              }
            >
              Meta: {deliveryGoal}
            </Pill>
          </div>
          <div className="delivery-target-number">
            {periodRecords.length - salonRecords.length}
            <small>
              encuestas recibidas ·{" "}
              {Math.round(
                ((periodRecords.length - salonRecords.length) /
                  Math.max(deliveryGoal, 1)) *
                  100
              )}
              % del objetivo
            </small>
          </div>
          <div className="bar-track">
            <span
              style={{
                width: `${Math.min(((periodRecords.length - salonRecords.length) / Math.max(deliveryGoal, 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </section>
        <section id="team-volume" className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">VOLUMEN</p>
              <h3>Encuestas por mesero</h3>
            </div>
            <Pill tone="blue">Meta: {surveyGoal}</Pill>
          </div>
          <div className="server-bars">
            {servers.length ? (
              servers.map(([name, count]) => (
                <div className="server-bar" key={name}>
                  <div className="server-label">
                    <span className="server-person">
                      <ServerAvatar name={name} />
                      <b>{name}</b>
                    </span>
                    <span>
                      {count} / {surveyGoal} ·{" "}
                      {Math.round((count / Math.max(surveyGoal, 1)) * 100)}%
                    </span>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${Math.min((count / Math.max(surveyGoal, 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <Empty text="No hay meseros identificados en este período." />
            )}
          </div>
        </section>
        <section id="team-scorecard" className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SCORECARD</p>
              <h3>Desempeño por mesero</h3>
            </div>
            <Pill tone="green">Meta: {qualityGoal}%</Pill>
          </div>
          {lowSampleServers.length ? (
            <div className="sample-warning" role="status">
              <AlertTriangle size={16} />
              <div>
                <b>Muestra insuficiente para comparar</b>
                <span>
                  {lowSampleServers
                    .map(server => `${server.name} (n=${server.answered})`)
                    .join(" · ")}
                  : menos de 20 encuestas calificadas. El porcentaje es una señal,
                  no una conclusión; acumula más respuestas o compara varios
                  meses.
                </span>
              </div>
            </div>
          ) : null}
          {qualityByServer.length ? (
            qualityByServer.map((s, i) => {
              const meets = s.count >= surveyGoal && s.pct >= qualityGoal;
              const lowSample = s.answered < 20;
              return (
                <div
                  className={`score-row ${meets ? "team-target-met" : ""}`}
                  key={s.name}
                >
                  <span className="rank-badge">#{i + 1}</span>
                  <ServerAvatar name={s.name} />
                  <span>
                    <b>{s.name}</b>
                    <small>
                      {s.count} encuestas ·{" "}
                      {s.pct ? `${Math.round(s.pct)}% positivo` : "sin calidad"}
                      {s.answered ? ` · n=${s.answered}` : ""}
                      {s.ci
                        ? ` · IC95 ${Math.round(s.ci[0] * 100)}–${Math.round(s.ci[1] * 100)}%`
                        : ""}
                    </small>
                  </span>
                  <Pill tone={lowSample ? "orange" : meets ? "green" : "orange"}>
                    {lowSample
                      ? "MUESTRA BAJA"
                      : meets
                        ? "META"
                        : s.pct < qualityGoal
                          ? "MEJORAR CALIDAD"
                          : "FALTA VOLUMEN"}
                  </Pill>
                  <Face
                    tone={
                      s.pct >= 85
                        ? "great"
                        : s.pct >= 70
                          ? "good"
                          : s.pct >= 50
                            ? "neutral"
                            : "bad"
                    }
                    size="sm"
                  />
                </div>
              );
            })
          ) : (
            <Empty text="No hay datos de meseros para comparar." />
          )}
        </section>
      </div>
    </>
  );
}

function buildTopicPhrases(comments: RecordItem[]): [string, number][] {
  const stop = new Set(
    "todo bien muy para con una este esta como del los las que por pero nada gracias estuvo fue son tener más mucho comida el la de y un una en al se no me mi nos sus hoy cliente clientes favor poco algo".split(
      " "
    )
  );
  const counts: Record<string, number> = {};
  comments.forEach(comment => {
    const tokens = normalizeText(comment.comment)
      .replace(/[^a-z0-9ñ ]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const content = tokens.filter(t => t.length > 2 && !stop.has(t));
    for (let i = 0; i < content.length - 1; i += 1) {
      const phrase = `${content[i]} ${content[i + 1]}`;
      counts[phrase] = (counts[phrase] || 0) + 1;
      if (i < content.length - 2) {
        const triple = `${content[i]} ${content[i + 1]} ${content[i + 2]}`;
        counts[triple] = (counts[triple] || 0) + 1;
      }
    }
  });
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}
type SentimentHighlight = {
  word: string;
  count: number;
  comments: RecordItem[];
};
function buildSentimentHighlights(
  comments: RecordItem[],
  words: string[],
  minCount = 2
): SentimentHighlight[] {
  const wanted = new Set(words.map(normalizeText));
  const grouped: Record<string, RecordItem[]> = {};
  comments.forEach(comment => {
    const tokens = new Set(
      normalizeText(comment.comment)
        .replace(/[^a-z0-9ñ ]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    );
    wanted.forEach(word => {
      if (tokens.has(word)) (grouped[word] ??= []).push(comment);
    });
  });
  return Object.entries(grouped)
    .filter(([, rows]) => rows.length >= minCount)
    .map(([word, rows]) => ({ word, count: rows.length, comments: rows }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
function buildPositiveHighlights(comments: RecordItem[]) {
  return buildSentimentHighlights(
    comments,
    "excelente rico rica delicioso deliciosa buen bueno buena genial amable rapido rápido recomendado recomendable sabroso sabrosa encantado encantada feliz perfecto perfecta agradable".split(
      " "
    )
  );
}
function buildNegativeHighlights(comments: RecordItem[]) {
  return buildSentimentHighlights(
    comments,
    "malo mala mal falta falto faltó demora demora frio fría frio salado salada feo fea lento lenta desagradable problema problemas insuficiente".split(
      " "
    )
  );
}

/* Agrupa comentarios equivalentes (sin mayúsculas/tildes) para mostrar
   los más repetidos. */
function buildRepeatedComments(comments: RecordItem[]) {
  const groups = new Map<string, { text: string; count: number }>();
  comments.forEach(record => {
    const text = String(record.comment || "").trim();
    if (!text || normalizeText(text).includes("error de lectura")) return;
    const key = normalizeText(text)
      .replace(/[^a-z0-9ñ ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!key) return;
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { text, count: 1 });
  });
  return Array.from(groups.values())
    .filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count);
}

const REQUEST_PATTERN =
  /(quisiera|quiero|deberian|deberia|falta|faltan|falto|mejorar|mejoren|agregar|incluir|poner|sugiero|sugerencia|recomiendo|recomendaria|seria bueno|estaria bueno|podrian|tener mas|consideracion|papit?as?|mas (sabor|variedad|platos|papas|papitas|ofertas|promociones|bebidas|postres|crocantes|rapidez)|promo|promocion|oferta|descuento|bebida|postre|ventilador|musica|aire|rapidez|tiempo de entrega|demoren|demora|tarda|salsa|huancaina|chimichurri|no tiene (gusto|sabor))/;

function requestTag(comment: string) {
  const text = normalizeText(comment);
  if (/tiempo|demora|demoren|rapidez|puntual|entrega/.test(text)) return "Tiempo";
  if (/papit?as?/.test(text)) return "Papas";
  if (/salsa|huancaina|chimichurri|sabor|no tiene gusto/.test(text)) return "Sabor";
  if (/variacion|platos|chifa|criollos|opciones/.test(text)) return "Variedad";
  if (/promo|promocion|oferta|descuento|bebida|alcohol|degustacion/.test(text)) return "Promos";
  if (/musica|ambiente|ventilador|aire/.test(text)) return "Ambiente";
  if (/sugiero|sugerencia|recomiendo|consideracion/.test(text)) return "Sugerencia";
  if (/atencion|amable/.test(text)) return "Atención";
  return "Sugerencia";
}

function buildRequestComments(comments: RecordItem[]) {
  return comments.filter(record =>
    REQUEST_PATTERN.test(normalizeText(record.comment))
  );
}

function downloadGenericCsv(
  filename: string,
  headers: string[],
  rows: unknown[][]
) {
  const csv = [headers, ...rows]
    .map(row =>
      row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function downloadCsv(records: RecordItem[]) {
  const headers = [
    "ID",
    "Fecha",
    "Cliente",
    "Teléfono",
    "Cumpleaños",
    "Producto",
    "Comentario",
    "Registrado por",
    "Calidad",
  ];
  const rows = records.map(r => [
    r.id,
    r.timestamp,
    r.clientName,
    r.phone,
    r.birthday,
    r.dish,
    r.comment,
    r.registeredBy,
    r.quality,
  ]);
  const csv = [headers, ...rows]
    .map(row =>
      row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-coronel-filtrado-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function AccessAdmin({
  users,
  audit,
}: {
  users: AccessUser[];
  audit: AuditItem[];
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, AccessUser>>({});
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [sessionFrom, setSessionFrom] = useState("");
  const [sessionTo, setSessionTo] = useState("");
  const [sessionUserQuery, setSessionUserQuery] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const pageSize = 20;
  const sessionInput = useMemo(
    () => ({
      from: sessionFrom || undefined,
      to: sessionTo || undefined,
      userQuery: sessionUserQuery || undefined,
      page: sessionPage,
      pageSize,
    }),
    [sessionFrom, sessionTo, sessionUserQuery, sessionPage]
  );
  const sessionsQuery = trpc.auth.adminSessions.useQuery(sessionInput, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const update = trpc.accessUsers.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.accessUsers.list.invalidate(),
        utils.auth.adminSessions.invalidate(),
      ]);
      setEditing(null);
      setNotice({
        tone: "success",
        text: "Cuenta y permisos guardados correctamente; el cambio quedó registrado en auditoría.",
      });
    },
    onError: error => setNotice({ tone: "error", text: error.message }),
  });
  const [tempCredential, setTempCredential] = useState<{
    name: string | null;
    email: string | null;
    password: string;
  } | null>(null);
  const requestsQuery = trpc.accessRequests.list.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  type AccessRequestRow = NonNullable<typeof requestsQuery.data>[number];
  const accessRequests = (requestsQuery.data ?? []) as AccessRequestRow[];
  const pendingRequests = accessRequests.filter(
    item => item.status === "pending"
  );
  const approveRequest = trpc.accessRequests.approve.useMutation({
    onSuccess: async data => {
      setTempCredential({
        name: data.name,
        email: data.email,
        password: data.tempPassword,
      });
      setNotice({
        tone: "success",
        text: `Acceso aprobado para ${data.email}. Comparte la contraseña temporal por un canal privado.`,
      });
      await Promise.all([
        utils.accessRequests.list.invalidate(),
        utils.accessUsers.list.invalidate(),
        utils.adminAudit.list.invalidate(),
      ]);
    },
    onError: error => setNotice({ tone: "error", text: error.message }),
  });
  const rejectRequest = trpc.accessRequests.reject.useMutation({
    onSuccess: async () => {
      setNotice({ tone: "success", text: "Solicitud rechazada." });
      await Promise.all([
        utils.accessRequests.list.invalidate(),
        utils.adminAudit.list.invalidate(),
      ]);
    },
    onError: error => setNotice({ tone: "error", text: error.message }),
  });
  const resetPassword = trpc.adminAuth.resetPassword.useMutation({
    onSuccess: async data => {
      setTempCredential({
        name: data.name,
        email: data.email,
        password: data.tempPassword,
      });
      setNotice({
        tone: "success",
        text: `Contraseña restablecida para ${data.name || data.email || "la cuenta"}.`,
      });
      await utils.adminAudit.list.invalidate();
    },
    onError: error => setNotice({ tone: "error", text: error.message }),
  });
  const approveAccessRequest = (request: AccessRequestRow) => {
    if (
      !window.confirm(
        `¿Aprobar el acceso de ${request.name} (${request.email}) y crear su cuenta?`
      )
    )
      return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    approveRequest.mutate({ id: request.id, adminPin: pin });
  };
  const rejectAccessRequest = (request: AccessRequestRow) => {
    if (
      !window.confirm(
        `¿Rechazar la solicitud de ${request.name} (${request.email})?`
      )
    )
      return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    rejectRequest.mutate({ id: request.id, adminPin: pin });
  };
  const resetAccountPassword = (account: AccessUser) => {
    if (!account.openId) {
      setNotice({
        tone: "error",
        text: "Esta cuenta no está vinculada a Supabase Auth; no se puede restablecer la contraseña desde aquí.",
      });
      return;
    }
    const openId = account.openId;
    if (
      !window.confirm(
        `¿Generar una contraseña temporal para ${account.name || account.email || "esta cuenta"}?`
      )
    )
      return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    resetPassword.mutate({ openId, adminPin: pin });
  };
  const copyTempCredential = async () => {
    if (!tempCredential) return;
    const text = [
      "Acceso Coronel Dashboard",
      `Correo: ${tempCredential.email ?? ""}`,
      `Contraseña temporal: ${tempCredential.password}`,
      `Ingresa en: ${window.location.origin}/login`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice({
        tone: "success",
        text: "Credencial copiada al portapapeles. Compártela por un canal privado.",
      });
    } catch {
      window.prompt("Copia la credencial temporal:", text);
    }
  };
  const startEdit = (account: AccessUser) => {
    setNotice(null);
    setEditing(account.id);
    setDrafts(current => ({ ...current, [account.id]: { ...account } }));
  };
  const setPermission = (
    id: number,
    field: keyof Pick<
      AccessUser,
      | "canViewCustomers"
      | "canManageCalls"
      | "canManageTargets"
      | "canManageUsers"
      | "canViewAudit"
    >,
    checked: boolean
  ) =>
    setDrafts(current => ({
      ...current,
      [id]: { ...current[id], [field]: checked ? 1 : 0 },
    }));
  const save = (account: AccessUser) => {
    const draft = drafts[account.id];
    if (!draft) return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    update.mutate({
      id: account.id,
      role: draft.role,
      canViewCustomers: draft.canViewCustomers,
      canManageCalls: draft.canManageCalls,
      canManageTargets: draft.canManageTargets,
      canManageUsers: draft.canManageUsers,
      canViewAudit: draft.canViewAudit,
      active: draft.active,
      adminPin: pin,
    });
  };
  const toggleAccount = (account: AccessUser) => {
    const action = account.active ? "desactivar" : "recuperar";
    if (
      account.active &&
      !window.confirm(
        `¿Confirmas que deseas desactivar la cuenta de ${account.name || account.email || "este usuario"}?`
      )
    )
      return;
    if (
      account.active &&
      !window.confirm(
        "Segunda confirmación: la cuenta perderá el acceso inmediatamente. ¿Continuar?"
      )
    )
      return;
    if (
      !account.active &&
      !window.confirm(
        `¿Recuperar la cuenta de ${account.name || account.email || "este usuario"}?`
      )
    )
      return;
    const pin = window.prompt("Credencial administrativa:");
    if (!pin) return;
    update.mutate({
      id: account.id,
      role: account.role,
      canViewCustomers: account.canViewCustomers,
      canManageCalls: account.canManageCalls,
      canManageTargets: account.canManageTargets,
      canManageUsers: account.canManageUsers,
      canViewAudit: account.canViewAudit,
      active: account.active ? 0 : 1,
      adminPin: pin,
    });
  };
  const permissionFields: [
    keyof Pick<
      AccessUser,
      | "canViewCustomers"
      | "canManageCalls"
      | "canManageTargets"
      | "canManageUsers"
      | "canViewAudit"
    >,
    string,
  ][] = [
    ["canViewCustomers", "Ver clientes"],
    ["canManageCalls", "Gestionar llamadas"],
    ["canManageTargets", "Gestionar metas"],
    ["canManageUsers", "Gestionar usuarios"],
    ["canViewAudit", "Ver auditoría"],
  ];
  const sessionRows = (sessionsQuery.data?.rows ?? []) as AdminSessionEvent[];
  const sessionTotal = sessionsQuery.data?.total ?? 0;
  const sessionPages = Math.max(1, Math.ceil(sessionTotal / pageSize));
  const clearSessionFilters = () => {
    setSessionFrom("");
    setSessionTo("");
    setSessionUserQuery("");
    setSessionPage(1);
  };
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="purple">ADMINISTRACIÓN</Pill>
          <h2>Roles, cuentas y actividad.</h2>
          <p>
            Gestiona accesos, desactiva o recupera cuentas y revisa las sesiones
            de todo el equipo desde un mismo lugar.
          </p>
        </div>
        <div className="intro-note">
          <ShieldCheck size={17} />
          <span>
            <b>Panel protegido</b>
            <small>
              Los cambios requieren tu credencial administrativa y una sesión de
              administrador.
            </small>
          </span>
        </div>
      </div>
      {notice && (
        <div className={`admin-feedback ${notice.tone}`} role="status">
          <ShieldCheck size={16} />
          <b>{notice.text}</b>
          <button onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
      {tempCredential && (
        <div className="temp-credential" role="status">
          <div className="temp-credential-info">
            <b>Contraseña temporal generada</b>
            <small>
              {tempCredential.name ? `${tempCredential.name} · ` : ""}
              {tempCredential.email}
            </small>
            <code>{tempCredential.password}</code>
            <small className="muted">
              Compártela por un canal privado. El usuario puede cambiarla con
              “¿Olvidaste tu contraseña?”.
            </small>
          </div>
          <div className="temp-credential-actions">
            <button className="secondary-action" onClick={copyTempCredential}>
              Copiar credencial
            </button>
            <button
              className="text-button"
              onClick={() => setTempCredential(null)}
            >
              Ocultar
            </button>
          </div>
        </div>
      )}
      <section className="panel access-requests-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">SOLICITUDES DE ACCESO</p>
            <h3>Altas pendientes de aprobación</h3>
            <small className="muted">
              Las cuentas nuevas no pueden entrar hasta que apruebes su
              solicitud. Al aprobar se crea el usuario en Supabase Auth y se
              genera una contraseña temporal.
            </small>
          </div>
          <Pill tone={pendingRequests.length ? "orange" : "green"}>
            {pendingRequests.length} pendiente(s)
          </Pill>
        </div>
        {pendingRequests.length ? (
          <div className="access-request-list">
            {pendingRequests.map(request => (
              <div className="access-request-row" key={request.id}>
                <div className="access-request-info">
                  <b>{request.name}</b>
                  <small>
                    {request.email} · {formatDateTime(request.requestedAt)}
                  </small>
                  {request.message && (
                    <em className="access-request-message">
                      {request.message}
                    </em>
                  )}
                </div>
                <div className="access-request-actions">
                  <button
                    className="secondary-action approve-request"
                    disabled={approveRequest.isPending}
                    onClick={() => approveAccessRequest(request)}
                  >
                    {approveRequest.isPending ? "Aprobando…" : "Aprobar y crear cuenta"}
                  </button>
                  <button
                    className="account-action disable"
                    disabled={rejectRequest.isPending}
                    onClick={() => rejectAccessRequest(request)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No hay solicitudes pendientes de aprobación." />
        )}
      </section>
      <section className="panel access-summary">
        <div>
          <p className="eyebrow">CONTROL DE CUENTAS</p>
          <h3>{users.length} usuario(s) registrados</h3>
          <p className="muted">
            Las cuentas desactivadas no pueden iniciar una nueva sesión ni
            consultar el dashboard. Recuperarlas las vuelve a habilitar.
          </p>
        </div>
        <div className="access-summary-stats">
          <span>
            <b>{users.filter(item => item.active).length}</b> activas
          </span>
          <span>
            <b>{users.filter(item => !item.active).length}</b> desactivadas
          </span>
          <span>
            <b>{users.filter(item => item.role === "admin").length}</b>{" "}
            administradores
          </span>
        </div>
      </section>
      <section className="panel access-users-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">USUARIOS Y PERMISOS</p>
            <h3>Asignar rol y capacidades</h3>
          </div>
          <Pill tone="purple">Credencial al guardar</Pill>
        </div>
        {users.length ? (
          <div className="access-user-list">
            {users.map(account => {
              const draft = drafts[account.id] ?? account;
              const isEditing = editing === account.id;
              return (
                <div
                  className={`access-user-card ${isEditing ? "editing" : ""} ${!account.active ? "account-disabled" : ""}`}
                  key={account.id}
                >
                  <div className="access-user-heading">
                    <div className="profile-avatar small-avatar profile-avatar-symbol">
                      {avatarSymbol(account.avatarPreset)}
                    </div>
                    <div>
                      <b>{account.name || "Usuario sin nombre"}</b>
                      <small>
                        {account.email ||
                          account.openId ||
                          "Sin correo visible"}
                      </small>
                      <small>
                        Último acceso:{" "}
                        {account.lastSignedIn
                          ? formatDateTime(account.lastSignedIn)
                          : "Sin registro"}
                      </small>
                    </div>
                    {isEditing ? (
                      <select
                        value={draft.role}
                        onChange={event =>
                          setDrafts(current => ({
                            ...current,
                            [account.id]: {
                              ...draft,
                              role: event.target.value as "user" | "admin",
                            },
                          }))
                        }
                      >
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    ) : (
                      <div className="account-status-tags">
                        <Pill
                          tone={account.role === "admin" ? "green" : "blue"}
                        >
                          {account.role === "admin"
                            ? "Administrador"
                            : "Usuario"}
                        </Pill>
                        <Pill tone={account.active ? "green" : "red"}>
                          {account.active ? "Activa" : "Desactivada"}
                        </Pill>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="permission-grid">
                      {permissionFields.map(([field, label]) => (
                        <label className="permission-toggle" key={field}>
                          <input
                            type="checkbox"
                            checked={Boolean(draft[field])}
                            onChange={event =>
                              setPermission(
                                account.id,
                                field,
                                event.target.checked
                              )
                            }
                          />
                          <span>
                            <b>{label}</b>
                            <small>
                              {field === "canViewCustomers"
                                ? "Clientes y datos de contacto"
                                : field === "canManageCalls"
                                  ? "Registrar y consultar CRM"
                                  : field === "canManageTargets"
                                    ? "Editar objetivos del equipo"
                                    : field === "canManageUsers"
                                      ? "Responsables y accesos"
                                      : "Cambios y trazabilidad"}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="permission-chips">
                      {permissionFields.map(([field, label]) => (
                        <span
                          className={account[field] ? "enabled" : "disabled"}
                          key={field}
                        >
                          {account[field] ? "✓" : "—"} {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="access-user-actions">
                    {isEditing ? (
                      <>
                        <Button
                          disabled={update.isPending}
                          onClick={() => save(account)}
                        >
                          {update.isPending ? "Guardando…" : "Guardar cambios"}
                        </Button>
                        <button
                          className="text-button"
                          onClick={() => setEditing(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="secondary-action"
                          onClick={() => startEdit(account)}
                        >
                          <Settings2 size={14} /> Editar acceso
                        </button>
                        <button
                          className={`account-action ${account.active ? "disable" : "recover"}`}
                          onClick={() => toggleAccount(account)}
                        >
                          {account.active
                            ? "Desactivar cuenta"
                            : "Recuperar cuenta"}
                        </button>
                        <button
                          className="secondary-action"
                          onClick={() => resetAccountPassword(account)}
                        >
                          Contraseña temporal
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="No hay usuarios del sistema registrados todavía." />
        )}
      </section>
      <section className="panel admin-session-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ACTIVIDAD DE TODAS LAS CUENTAS</p>
            <h3>Últimos inicios y cierres de sesión</h3>
            <small className="muted">
              {sessionTotal} evento(s) encontrados. Filtra por fecha para
              revisar una jornada o periodo específico.
            </small>
          </div>
          <Pill tone="blue">
            Página {sessionPage} de {sessionPages}
          </Pill>
        </div>
        <div className="session-admin-filters">
          <label>
            Usuario
            <input
              value={sessionUserQuery}
              onChange={event => {
                setSessionUserQuery(event.target.value);
                setSessionPage(1);
              }}
              placeholder="Nombre o correo…"
            />
          </label>
          <label>
            Desde
            <input
              type="date"
              value={sessionFrom}
              onChange={event => {
                setSessionFrom(event.target.value);
                setSessionPage(1);
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={sessionTo}
              onChange={event => {
                setSessionTo(event.target.value);
                setSessionPage(1);
              }}
            />
          </label>
          <button className="secondary-action" onClick={clearSessionFilters}>
            Limpiar fechas
          </button>
        </div>
        {sessionRows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Dirección</th>
                  <th>Navegador</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map(event => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>
                      <b>{event.userName || "Usuario no identificado"}</b>
                      <small className="table-sub">
                        {event.userEmail || event.openId}
                      </small>
                    </td>
                    <td>
                      <Pill
                        tone={event.action === "login" ? "green" : "neutral"}
                      >
                        {event.action === "login" ? "Inicio" : "Cierre"}
                      </Pill>
                    </td>
                    <td>{event.ipAddress || "No disponible"}</td>
                    <td>{event.userAgent || "No informado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No hay sesiones en el rango seleccionado." />
        )}
        <div className="priority-pagination">
          <button
            disabled={sessionPage <= 1}
            onClick={() => setSessionPage(page => Math.max(1, page - 1))}
          >
            Anterior
          </button>
          <span>
            Página {sessionPage} de {sessionPages}
          </span>
          <button
            disabled={sessionPage >= sessionPages}
            onClick={() =>
              setSessionPage(page => Math.min(sessionPages, page + 1))
            }
          >
            Siguiente
          </button>
        </div>
      </section>
      <AuditPanel audit={audit.filter(item => item.entity === "acceso")} />
    </>
  );
}
