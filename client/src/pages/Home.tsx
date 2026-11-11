import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import {
  AlertTriangle,
  ArrowUp,
  ArrowUpRight,
  Cake,
  CheckCircle2,
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
  Rows3,
  Search,
  Sparkles,
  UserRoundCheck,
  Users,
  X,
  ShieldCheck,
  Settings2,
  History,
  HelpCircle,
  LogOut,
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
type ExportPreviewData = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: unknown[][];
  dates?: (Date | null)[];
  filename?: string;
};

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
  isOnline?: boolean;
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
  { id: "responsibles", label: "Encargados", icon: Users },
  { id: "targetHistory", label: "Historial de metas", icon: Clock3 },
  { id: "profile", label: "Mi cuenta", icon: Users },
  { id: "administracion", label: "Cuentas y accesos", icon: Settings2 },
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
const scrollAppToTop = (behavior: ScrollBehavior = "smooth") => {
  const scroller = document.querySelector<HTMLElement>(".main-area");
  scroller?.scrollTo({ top: 0, behavior });
  document.documentElement.scrollTo({ top: 0, behavior });
  document.body.scrollTo({ top: 0, behavior });
  window.scrollTo({ top: 0, behavior });
};
const clean = (value: string) => value.trim().toLowerCase();
const normalizeText = (value: string) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const SCROLL_BY_PAGE_KEY = "coronel.scrollByPage.v1";

const readScrollByPage = (): Record<string, number> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCROLL_BY_PAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const getCurrentScrollTop = () =>
  Math.max(
    document.querySelector<HTMLElement>(".main-area")?.scrollTop ?? 0,
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop
  );

const setCurrentScrollTop = (top: number) => {
  const main = document.querySelector<HTMLElement>(".main-area");
  if (main) main.scrollTop = top;
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
  window.scrollTo({ top, behavior: "auto" });
};

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
const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const productGroupOf = (name: string) => {
  const n = normalizeText(name);
  if (/(pollo|broaster|brasa|pechuga|alita|cuarto|pierna|muslo|pollo a la)/.test(n)) return "Pollos";
  if (/(parrilla|carne|anticucho|chorizo|costilla|res|cerdo|bife)/.test(n)) return "Parrillas";
  if (/(papa|ensalada|arroz|choclo|guarnici|complemento)/.test(n)) return "Guarniciones";
  if (/(bebida|gaseosa|chicha|jugo|agua|cerveza|limonada|refresco)/.test(n)) return "Bebidas";
  if (/(postre|torta|helado|dulce)/.test(n)) return "Postres";
  return "Otros";
};

const segmentLabelFor = (value?: string) =>
  value === "En riesgo"
    ? "Por recuperar"
    : value === "Fiel"
      ? "Frecuente"
      : value === "Recurrente"
        ? "Repite"
        : value === "Nuevo"
          ? "Primera vez"
          : value || "Sin grupo";
const clientSignal = (profile: Pick<ClientProfile, "quality" | "comment">) => {
  const comment = profile.comment?.trim();
  if (comment) return comment;
  const quality = profile.quality?.trim();
  if (!quality || clean(quality) === "sin calificar") {
    return "Sin calificar · falta completar la encuesta";
  }
  return `Calificó ${quality} · no dejó comentario`;
};
const noCommentLabel = (profile: Pick<ClientProfile, "comment">) =>
  profile.comment?.trim() || "No dejó comentario";
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
      className={`stat-card stat-card-link accent-${accent}`}
      onClick={onClick}
      aria-label={`${label}: abrir detalle`}
    >
      {content}
    </button>
  ) : (
    <div className={`stat-card accent-${accent}`}>{content}</div>
  );
}
type AdminPinRequest = {
  resolve: (pin: string | null) => void;
  reason: string;
};

const AdminPinContext = createContext<
  ((reason?: string) => Promise<string | null>) | null
>(null);

function useAdminPin() {
  const ask = useContext(AdminPinContext);
  if (!ask) throw new Error("useAdminPin debe usarse dentro de AdminPinProvider");
  return ask;
}

function AdminPinProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<AdminPinRequest | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const close = useCallback((value: string | null) => {
    setRequest(current => {
      current?.resolve(value);
      return null;
    });
    setPin("");
    setError("");
  }, []);
  const dialogRef = useDialogFocus(Boolean(request), () => close(null));
  const ask = useCallback(
    (reason = "Confirma esta acción con la clave de administrador.") =>
      new Promise<string | null>(resolve => {
        setPin("");
        setError("");
        setRequest({ resolve, reason });
      }),
    []
  );
  const confirm = () => {
    if (pin.trim() !== "5956") {
      setError("Clave incorrecta. Intenta de nuevo.");
      return;
    }
    close(pin.trim());
  };
  return (
    <AdminPinContext.Provider value={ask}>
      {children}
      {request && (
        <div className="priority-pin-backdrop" onClick={() => close(null)}>
          <div
            className="priority-pin-modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Clave de administrador"
            onClick={event => event.stopPropagation()}
          >
            <p className="eyebrow">CLAVE DE ADMINISTRADOR</p>
            <h3>Confirma el cambio</h3>
            <p className="muted">{request.reason}</p>
            <small className="priority-pin-help">
              Escribe la clave de 4 dígitos. No la compartas con el equipo.
            </small>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={event => {
                setPin(event.target.value);
                setError("");
              }}
              onKeyDown={event => {
                if (event.key === "Enter") confirm();
                if (event.key === "Escape") close(null);
              }}
              placeholder="Clave"
              aria-label="Clave de administrador"
            />
            {error && <small className="priority-pin-error">{error}</small>}
            <div className="priority-pin-actions">
              <button className="btn-borde" onClick={() => close(null)}>
                Cancelar
              </button>
              <button className="btn-rojo" onClick={confirm}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPinContext.Provider>
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
function BusinessGuide({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <details className="business-guide">
      <summary>
        <HelpCircle size={15} /> ¿Cómo uso esta página?
      </summary>
      <div className="business-guide-body">
        <b>{title}</b>
        <ol>
          {steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

type InsightTone = "positive" | "warning" | "critical" | "neutral";

const emphasizeInsight = (text: string) => {
  const parts = text.split(/(“[^”]+”|Calificó (?:Bueno|Regular|Malo))/g);
  return parts.map((part, index) =>
    /^“|^Calificó /.test(part) ? (
      <strong key={`${part}-${index}`}>{part}</strong>
    ) : (
      part
    )
  );
};

function InsightCard({
  label,
  title,
  evidence,
  action,
  tone,
  icon: Icon,
  meta,
  onClick,
  className,
}: {
  label: string;
  title: string;
  evidence: string;
  action?: string;
  tone: InsightTone;
  icon: typeof Clock3;
  meta?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <span className="insight-card-top">
        <span className="insight-icon">
          <Icon size={17} />
        </span>
        <span className="insight-label">{label}</span>
        {meta && <span className="insight-meta">{meta}</span>}
      </span>
      <h3>{emphasizeInsight(title)}</h3>
      <p>{emphasizeInsight(evidence)}</p>
      {action && (
        <span className="insight-action">
          {action} <ChevronRight size={14} />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`insight-card insight-${tone} ${className || ""}`}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <article className={`insight-card insight-${tone} ${className || ""}`}>{content}</article>
  );
}


function PageHint({
  title,
  children,
  compact = true,
}: {
  title: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "page-hint page-hint-compact" : "page-hint"}>
      <HelpCircle size={15} />
      <span>
        <b>{title}</b>
        {children ? <small>{children}</small> : null}
      </span>
    </div>
  );
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
    refetchInterval: 15_000,
  });
  const [page, setPage] = useState<Page>(() => {
    const queryPage = new URLSearchParams(window.location.search).get("page") as Page | null;
    if (queryPage && tabs.some(tab => tab.id === queryPage)) return queryPage;
    const saved = localStorage.getItem("coronel.lastPage") as Page | null;
    return saved && tabs.some(tab => tab.id === saved) ? saved : "overview";
  });
  const pageRef = useRef(page);
  const previousPageRef = useRef(page);
  const scrollByPageRef = useRef<Record<string, number>>(readScrollByPage());
  const restoringScrollRef = useRef(false);
  const [quickCallOpen, setQuickCallOpen] = useState(false);
  const [quickCallQuery, setQuickCallQuery] = useState("");
  const [quickCallProfile, setQuickCallProfile] = useState<ClientProfile | null>(
    null
  );
  const [callSavedNotice, setCallSavedNotice] = useState("");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".search-box input")
          ?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [qualityFilter, setQualityFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactMode, setCompactMode] = useState(
    () => localStorage.getItem("coronel.compact") === "1"
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  useEffect(() => {
    localStorage.setItem("coronel.compact", compactMode ? "1" : "0");
  }, [compactMode]);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [accountMenuOpen]);
  const [overviewFocus, setOverviewFocus] = useState<OverviewFocus>(null);
  const [priorityClientKey, setPriorityClientKey] = useState<string | null>(
    null
  );
  const [clientDetailKey, setClientDetailKey] = useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem("coronel.lastPage", page);
    const url = new URL(window.location.href);
    if (page === "overview") url.searchParams.delete("page");
    else url.searchParams.set("page", page);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    let raf = 0;
    const saveScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        scrollByPageRef.current[pageRef.current] = getCurrentScrollTop();
        try {
          localStorage.setItem(
            SCROLL_BY_PAGE_KEY,
            JSON.stringify(scrollByPageRef.current)
          );
        } catch {
          // El almacenamiento local puede estar lleno o bloqueado.
        }
      });
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    const main = document.querySelector<HTMLElement>(".main-area");
    main?.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", saveScroll);
      main?.removeEventListener("scroll", saveScroll);
    };
  }, []);

  useEffect(() => {
    const previous = previousPageRef.current;
    if (previous !== page) {
      scrollByPageRef.current[previous] = getCurrentScrollTop();
      previousPageRef.current = page;
      try {
        localStorage.setItem(
          SCROLL_BY_PAGE_KEY,
          JSON.stringify(scrollByPageRef.current)
        );
      } catch {
        // Ignorar almacenamiento no disponible.
      }
    }
    const target = scrollByPageRef.current[page] ?? 0;
    const timers: number[] = [];
    const restore = (attempt: number) => {
      const timer = window.setTimeout(() => {
        // Si la persona ya movió la página, no le devolvemos el scroll.
        if (attempt > 0 && getCurrentScrollTop() > 4) return;
        setCurrentScrollTop(target);
        const maxScroll = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );
        if (attempt < 5 && target > 0 && maxScroll < target - 2) {
          restore(attempt + 1);
        }
      }, [0, 70, 180, 350, 700, 1200][attempt] ?? 0);
      timers.push(timer);
    };
    restore(0);
    return () => timers.forEach(timer => window.clearTimeout(timer));
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
  const reviewRecords = useMemo(
    () =>
      filtered.filter(
        r => clean(r.quality) === "regular" || clean(r.quality) === "malo"
      ),
    [filtered]
  );
  const reviewCount = reviewRecords.length;
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
  const detailProfile = clientDetailKey
    ? profiles.find(profile => profile.key === clientDetailKey) ?? null
    : null;
  const detailRecords = clientDetailKey
    ? records
        .filter(record => clientKeyOf(record) === clientDetailKey)
        .sort(
          (a, b) =>
            (parseDate(b.timestamp)?.getTime() || 0) -
            (parseDate(a.timestamp)?.getTime() || 0)
        )
    : [];
  const detailLogs = clientDetailKey
    ? ((callsQuery.data ?? []) as CallLog[])
        .filter(
          log =>
            clientKeyOf({ phone: log.phone || "", clientName: log.clientName }) ===
            clientDetailKey
        )
        .sort(
          (a, b) =>
            new Date(b.callDate).getTime() - new Date(a.callDate).getTime()
        )
    : [];
  const detailCampaign = clientDetailKey
    ? birthdayCampaignsQuery.data?.find(
        (campaign: BirthdayCampaign) => campaign.clientKey === clientDetailKey
      )
    : undefined;
  const displayDetailPhone = detailCampaign?.phone || detailProfile?.phone || "";
  const saveContact = trpc.birthdayCampaigns.save.useMutation({
    onSuccess: async () => {
      await birthdayCampaignsQuery.refetch();
      setContactEditOpen(false);
    },
  });
  useEffect(() => {
    if (!detailProfile) return;
    setContactEditOpen(false);
    setContactPhone(
      (detailCampaign?.phone || detailProfile.phone || "").toString()
    );
  }, [clientDetailKey]);
  const detailDialogRef = useDialogFocus(Boolean(detailProfile), () =>
    setClientDetailKey(null)
  );
  useEffect(() => {
    if (!detailProfile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [detailProfile]);
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
  const priorityCount = rawOverdueCount;
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
    if (!user) return;
    if (!visibleTabs.some(tab => tab.id === page)) setPage("overview");
  }, [
    user,
    page,
    isAdmin,
    canViewCustomers,
    canManageCalls,
    canManageTargets,
    canManageUsers,
    canViewAudit,
  ]);
  const navGroups: { label: string; ids: Page[] }[] = [
    {
      label: "OPERACIÓN",
      ids: ["overview", "birthdays", "clients", "priorities", "calls"],
    },
    { label: "ANÁLISIS", ids: ["voice", "team", "targetHistory"] },
    {
      label: "CONFIGURACIÓN",
      ids: ["promotions", "responsibles", "profile", "administracion"],
    },
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
  };
  const openPriorityClient = (key: string) => {
    setPriorityClientKey(null);
    setClientDetailKey(key);
    setOverviewFocus(null);
    setMobileMenuOpen(false);
  };
  const exportPageCsv = () => {
    if (page === "clients") {
      downloadGenericCsv(
        `clientes-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Cliente", "Teléfono", "Grupo", "Visitas", "Calidad", "Último comentario"],
        profiles.map(profile => [
          profile.name,
          profile.phone,
          segmentLabelFor(profile.segment),
          profile.count,
          profile.quality,
          profile.comment,
        ])
      );
      return;
    }
    if (page === "voice") {
      downloadGenericCsv(
        `voz-cliente-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Fecha", "Cliente", "Producto", "Calidad", "Comentario"],
        comments.map(record => [
          formatDateTime(record.timestamp),
          record.clientName,
          record.dish,
          record.quality,
          record.comment,
        ])
      );
      return;
    }
    if (page === "priorities") {
      downloadGenericCsv(
        `prioridades-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Prioridad", "Estado", "Responsable", "Vence", "Actualizado por"],
        persistedPriorities.map(priority => [
          priority.priorityKey,
          priority.status,
          priority.responsible,
          priority.dueDate,
          priority.updatedBy,
        ])
      );
      return;
    }
    if (page === "team") {
      const grouped = new Map<string, { count: number; good: number }>();
      filtered.forEach(record => {
        const server = displayServer(record.registeredBy);
        const item = grouped.get(server) ?? { count: 0, good: 0 };
        item.count += 1;
        if (clean(record.quality) === "bueno") item.good += 1;
        grouped.set(server, item);
      });
      downloadGenericCsv(
        `equipo-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Equipo / mesero", "Encuestas", "Bueno", "Calidad positiva"],
        Array.from(grouped.entries()).map(([server, value]) => [
          server,
          value.count,
          value.good,
          value.count ? `${Math.round((value.good / value.count) * 100)}%` : "—",
        ])
      );
      return;
    }
    downloadCsv(filtered);
  };
  const exportPagePdf = () => {
    const dateLabel = new Date().toLocaleDateString("es-PE");
    if (page === "clients") {
      setExportPreview({
        title: "Clientes Coronel",
        subtitle: `${profiles.length} clientes · ${dateLabel}`,
        columns: ["Cliente", "Teléfono", "Grupo", "Visitas", "Calidad", "Último comentario"],
        rows: profiles.map(profile => [
          profile.name,
          profile.phone,
          segmentLabelFor(profile.segment),
          profile.count,
          profile.quality,
          profile.comment,
        ]),
      });
      return;
    }
    if (page === "voice") {
      setExportPreview({
        title: "Voz del cliente",
        subtitle: `${comments.length} comentarios · ${dateLabel}`,
        columns: ["Fecha", "Cliente", "Producto", "Calidad", "Comentario"],
        rows: comments.map(record => [
          formatDateTime(record.timestamp),
          record.clientName,
          record.dish,
          record.quality,
          record.comment,
        ]),
        dates: comments.map(record => parseDate(record.timestamp)),
      });
      return;
    }
    if (page === "priorities") {
      setExportPreview({
        title: "Prioridades",
        subtitle: `${persistedPriorities.length} registros · ${dateLabel}`,
        columns: ["Prioridad", "Estado", "Responsable", "Vence", "Actualizado por"],
        rows: persistedPriorities.map(priority => [
          priority.priorityKey,
          priority.status,
          priority.responsible,
          priority.dueDate,
          priority.updatedBy,
        ]),
        dates: persistedPriorities.map(priority =>
          priority.dueDate ? parseDate(String(priority.dueDate)) : null
        ),
      });
      return;
    }
    if (page === "team") {
      const grouped = new Map<string, { count: number; good: number }>();
      filtered.forEach(record => {
        const server = displayServer(record.registeredBy);
        const item = grouped.get(server) ?? { count: 0, good: 0 };
        item.count += 1;
        if (clean(record.quality) === "bueno") item.good += 1;
        grouped.set(server, item);
      });
      setExportPreview({
        title: "Equipo y operación",
        subtitle: `${filtered.length} encuestas · ${dateLabel}`,
        columns: ["Equipo / mesero", "Encuestas", "Bueno", "Calidad positiva"],
        rows: Array.from(grouped.entries()).map(([server, value]) => [
          server,
          value.count,
          value.good,
          value.count ? `${Math.round((value.good / value.count) * 100)}%` : "—",
        ]),
      });
      return;
    }
    downloadTablePdf(
      "Encuestas Coronel",
      `${filtered.length} registros · ${dateLabel}`,
      ["Fecha", "Cliente", "Teléfono", "Producto", "Calidad", "Comentario"],
      filtered.map(record => [
        formatDateTime(record.timestamp),
        record.clientName,
        record.phone,
        record.dish,
        record.quality,
        record.comment,
      ])
    );
  };
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreviewData | null>(null);
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
          src="/manus-storage/logo-coronel.png"
          alt="Coronel"
        />
        <span className="loading-kicker">Pollos y Parrillas</span>
        <h2>Un momento…</h2>
        <p>Estamos verificando tu acceso con cuidado.</p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="auth-wall">
        <div className="auth-wall-card">
          <img
            className="loading-logo"
            src="/manus-storage/logo-coronel.png"
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
          src="/manus-storage/logo-coronel.png"
          alt="Coronel"
        />
        <span className="loading-kicker">Pollos y Parrillas</span>
        <h2>Tu día empieza aquí</h2>
        <p>Cada cliente cuenta. En un momento tendrás todo listo.</p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
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
    <AdminPinProvider>
    <div className={`app-shell ${compactMode ? "is-compact" : ""}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <button
          className="sidebar-collapse"
          onClick={() => setSidebarCollapsed(value => !value)}
          aria-label={sidebarCollapsed ? "Abrir menú" : "Ocultar menú"}
          title={sidebarCollapsed ? "Abrir menú" : "Ocultar menú"}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={18} strokeWidth={2} />
          ) : (
            <ChevronLeft size={18} strokeWidth={2} />
          )}
        </button>
        <div className="sidebar-logo-box">
          <img
            className="sidebar-logo"
            src="/manus-storage/logo-coronel.png"
            alt="Coronel · Pollos y Parrillas"
          />
          <span className="sidebar-monogram" aria-hidden="true">C</span>
        </div>
        <span className="brand-tagline">Sistema de gestión</span>
        <div className="side-label">REPORTE</div>
        <nav className="grouped-sidebar-nav">
          {navGroups.map(group => {
            const groupTabs = group.ids
              .map(id => visibleTabs.find(tab => tab.id === id))
              .filter(Boolean) as typeof visibleTabs;
            if (!groupTabs.length) return null;
            return (
              <div
                className={`nav-section ${collapsedGroups[group.label] ? "is-collapsed" : ""}`}
                key={group.label}
              >
                <button
                  className="nav-section-label"
                  onClick={() =>
                    setCollapsedGroups(current => ({
                      ...current,
                      [group.label]: !current[group.label],
                    }))
                  }
                  aria-expanded={!collapsedGroups[group.label]}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={13}
                    className={collapsedGroups[group.label] ? "group-chevron collapsed" : "group-chevron"}
                  />
                </button>
                {!collapsedGroups[group.label] &&
                  groupTabs.map(({ id, label, icon: Icon }) => (
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
                        title={`${priorityCount} acciones vencidas`}
                        aria-label={`${priorityCount} acciones vencidas`}
                      >
                        {priorityCount > 99 ? "99+" : priorityCount}
                      </span>
                    )}
                    {id === "birthdays" && birthdays.length > 0 && (
                      <span
                        className="nav-badge birthday-badge"
                        title={`${birthdays.length} cumpleaños en los próximos 7 días`}
                        aria-label={`${birthdays.length} cumpleaños en los próximos 7 días`}
                      >
                        {birthdays.length > 99 ? "99+" : birthdays.length}
                      </span>
                    )}
                    {id === "priorities" && pendingTaskCount > 0 && (
                      <span
                        className="nav-badge task-badge"
                        title={`${pendingTaskCount} prioridades abiertas`}
                        aria-label={`${pendingTaskCount} prioridades abiertas`}
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
            <span>Datos al día</span>
          </div>
        </div>
        <div className="sidebar-signature">
          Hecho con amor por Yennifer Abreu <span aria-hidden="true">❤️</span>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-copy">
            <img
              className="mobile-topbar-logo"
              src="/manus-storage/logo-coronel.png"
              alt="Coronel · Pollos y Parrillas"
            />
            <p className="breadcrumb">
              RESTAURANTE CORONEL
            </p>
            <h1>{title}</h1>
            <p className="muted topbar-data-line">
              {sourceTab === "limpia" ? "Datos reales" : "Datos de prueba"} ·{" "}
              <b>{records.length} encuestas</b> ·{" "}
              <b>{sourceTab === "limpia" ? "Encuestas_Limpias" : "Encuestas"}</b>
            </p>
          </div>
          <div className="top-actions">
            <button
              className="quick-call-button"
              onClick={() => {
                setQuickCallQuery("");
                setQuickCallOpen(true);
              }}
            >
              <Phone size={15} />
              <span>Registrar llamada</span>
            </button>
            <label className="source-selector">
              <span>Datos</span>
              <select
                value={sourceTab}
                onChange={e =>
                  setSourceTab(e.target.value as "original" | "limpia")
                }
              >
                <option value="original">Datos de prueba</option>
                <option value="limpia">Datos reales</option>
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
              ref={accountMenuRef}
              className={`account-menu ${user ? "account-signed-in" : "account-signed-out"}`}
            >
              {user ? (
                <>
                  <button
                    className="account-trigger"
                    onClick={() => setAccountMenuOpen(value => !value)}
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="account-avatar" aria-hidden="true">
                      {avatarSymbol(user.avatarPreset)}
                    </span>
                    <span className="account-name">
                      <b>{user.name || "Usuario"}</b>
                      <small>Mi cuenta</small>
                    </span>
                    <ChevronDown
                      size={14}
                      className={accountMenuOpen ? "rotate" : ""}
                    />
                  </button>
                  {accountMenuOpen && (
                    <div className="account-dropdown" role="menu">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          navigate("profile");
                        }}
                      >
                        <Users size={15} /> Mi perfil
                      </button>
                      <button
                        role="menuitem"
                        className="account-logout"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          logout();
                        }}
                      >
                        <LogOut size={15} /> Cerrar sesión
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button className="login-button" onClick={() => startLogin()}>
                  Iniciar sesión
                </button>
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
                prueba. Para usar datos reales, cambia los datos a{" "}
                <b>Datos reales</b>.
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
          <img src="/manus-storage/logo-coronel.png" alt="Coronel" />
          <div>
            <strong>CORONEL · REPORTE ANALÍTICO</strong>
            <span id="print-report-filters">
              Sin filtros de fecha adicionales
            </span>
          </div>
        </div>
        <div className="content" data-page={page}>
          {compactMode && (
            <div className="compact-mode-notice">
              <Rows3 size={16} />
              <span>
                <b>Vista compacta</b>
                <small>Ocultamos las secciones de detalle para acortar la página.</small>
              </span>
              <button
                onClick={() => {
                  setCompactMode(false);
                  scrollAppToTop("smooth");
                }}
              >
                Mostrar todo
              </button>
            </div>
          )}
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
              onCsv={exportPageCsv}
              onPdf={() => {
                if (page === "overview") setPdfPreviewOpen(true);
                else exportPagePdf();
              }}
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
                  userName={user?.name || user?.email || ""}
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
                    scrollAppToTop("smooth");
                  }}
                />
              )}
              {page === "voice" && (
                <Voice
                  comments={comments}
                  reviewRecords={reviewRecords}
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
                  onRegisterCall={(query?: string) => {
                    setQuickCallQuery(query || "");
                    setQuickCallOpen(true);
                  }}
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
            {records.length} encuestas cargadas desde{" "}
            {sourceTab === "limpia" ? "Encuestas_Limpias" : "Encuestas"}
            {search || qualityFilter !== "Todos"
              ? ` · ${filtered.length} visibles con el filtro`
              : ""}
          </span>
          <span>Datos personales: acceso restringido al equipo autorizado</span>
          <span className="footer-signature">
            Hecho con amor por Yennifer Abreu <span aria-hidden="true">❤️</span>
          </span>
        </footer>
      </main>
      <div className="floating-tools" aria-label="Controles de vista">
        <button
          className={compactMode ? "active" : ""}
          onClick={() => {
            const next = !compactMode;
            setCompactMode(next);
            scrollAppToTop("smooth");
          }}
          title={compactMode ? "Mostrar todas las secciones" : "Ocultar secciones de detalle"}
          aria-label={compactMode ? "Mostrar todas las secciones" : "Ocultar secciones de detalle"}
        >
          <Rows3 size={17} />
          <span>{compactMode ? "Ver todo" : "Compacto"}</span>
        </button>
        <button
          onClick={() => scrollAppToTop("smooth")}
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <ArrowUp size={18} />
          <span>Arriba</span>
        </button>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Navegación principal">
        {[
          { id: "overview" as Page, label: "Inicio", icon: LayoutDashboard },
          { id: "birthdays" as Page, label: "Cumpleaños", icon: Cake },
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
              {item.id === "overview" && priorityCount > 0 && (
                <span className="mobile-nav-badge" aria-label={`${priorityCount} acciones vencidas`}>
                  {priorityCount > 99 ? "99+" : priorityCount}
                </span>
              )}
              {item.id === "birthdays" && birthdays.length > 0 && (
                <span className="mobile-nav-badge" aria-label={`${birthdays.length} cumpleaños próximos`}>
                  {birthdays.length > 99 ? "99+" : birthdays.length}
                </span>
              )}
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
      {exportPreview && (
        <ExportPreviewModal
          data={exportPreview}
          onClose={() => setExportPreview(null)}
        />
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
      {quickCallOpen && (
        <QuickCallPicker
          profiles={profiles}
          initialQuery={quickCallQuery}
          onClose={() => setQuickCallOpen(false)}
          onSelect={profile => {
            setQuickCallOpen(false);
            setQuickCallProfile(profile);
          }}
        />
      )}
      {quickCallProfile && (
        <CallLogForm
          profile={quickCallProfile}
          logs={(callsQuery.data ?? []) as CallLog[]}
          onClose={() => setQuickCallProfile(null)}
          onSaved={(profile, meta) => {
            setCallSavedNotice(
              meta?.priorityResolved
                ? `Llamada de ${profile.name} guardada. La prioridad del cliente quedó resuelta.`
                : `Llamada de ${profile.name} guardada. Si programaste una próxima llamada, ya aparece en Prioridades.`
            );
            window.setTimeout(() => setCallSavedNotice(""), 5000);
          }}
        />
      )}
      {callSavedNotice && (
        <div className="app-toast" role="status">
          <CheckCircle2 size={17} /> {callSavedNotice}
        </div>
      )}
      {detailProfile && (
        <div
          className="client-sheet-backdrop"
          onClick={() => setClientDetailKey(null)}
        >
          <aside
            className="client-sheet"
            ref={detailDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Ficha de ${detailProfile.name}`}
            onClick={event => event.stopPropagation()}
          >
            <div className="client-sheet-head">
              <div>
                <p className="eyebrow">FICHA DEL CLIENTE</p>
                <h3>{detailProfile.name}</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setClientDetailKey(null)}
                aria-label="Cerrar ficha"
              >
                <X size={17} />
              </button>
            </div>
            <div className="client-sheet-info">
              <div>
                <small>TELÉFONO</small>
                <b>
                  {displayDetailPhone ? (
                    <a
                      className="client-contact-link"
                      href={`tel:${displayDetailPhone.replace(/[^\d+]/g, "")}`}
                    >
                      {displayDetailPhone}
                    </a>
                  ) : (
                    "Sin teléfono"
                  )}
                </b>
              </div>
              <div>
                <small>GRUPO</small>
                <b
                  className={
                    detailProfile.segment === "En riesgo"
                      ? "segment-risk"
                      : ""
                  }
                >
                  {segmentLabelFor(detailProfile.segment)}
                </b>
              </div>
              <div>
                <small>VISITAS</small>
                <b>{detailProfile.count}</b>
              </div>
              <div>
                <small>CUMPLEAÑOS</small>
                <b>{detailProfile.birthday || "Sin fecha"}</b>
              </div>
              <div>
                <small>PROMOCIÓN</small>
                <b>{detailLogs[0]?.promotion || detailCampaign?.promotion || "Sin promoción"}</b>
              </div>
              <div>
                <small>ÚLTIMA LLAMADA</small>
                <b>{detailLogs[0] ? formatDate(detailLogs[0].callDate) : "Sin llamadas"}</b>
              </div>
              <div>
                <small>ÚLTIMA ACTUALIZACIÓN</small>
                <b>
                  {detailCampaign?.updatedAt
                    ? formatDateTime(detailCampaign.updatedAt)
                    : detailRecords[0]
                      ? formatDateTime(detailRecords[0].timestamp)
                      : "Sin actualizar"}
                </b>
              </div>
            </div>
            <div className="client-sheet-head-actions">
              <button
                className="btn-borde client-edit-trigger"
                onClick={() => setContactEditOpen(value => !value)}
              >
                <Settings2 size={14} /> Editar datos
              </button>
            </div>
            {contactEditOpen && (
              <form
                className="client-edit-form"
                onSubmit={event => {
                  event.preventDefault();
                  if (!detailProfile) return;
                  saveContact.mutate({
                    clientKey: detailProfile.key,
                    clientName: detailProfile.name,
                    phone: contactPhone,
                    stage: detailCampaign?.stage ?? "week",
                    channel: detailCampaign?.channel ?? "whatsapp",
                    progressStatus:
                      detailCampaign?.progressStatus ?? "pending",
                    promotion: detailCampaign?.promotion ?? undefined,
                    responsible: detailCampaign?.responsible ?? undefined,
                    nextActionAt: detailCampaign?.nextActionAt
                      ? new Date(detailCampaign.nextActionAt).toISOString()
                      : null,
                    nextActionLabel:
                      detailCampaign?.nextActionLabel ?? undefined,
                    familyName: detailCampaign?.familyName ?? undefined,
                    familyBirthday:
                      detailCampaign?.familyBirthday ?? undefined,
                    noRedeemReason:
                      detailCampaign?.noRedeemReason ?? undefined,
                    notes: detailCampaign?.notes ?? undefined,
                  });
                }}
              >
                <label>
                  Teléfono
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={event => setContactPhone(event.target.value)}
                    placeholder="Número de contacto"
                  />
                </label>
                <div className="client-edit-form-actions">
                  <button className="btn-rojo" type="submit" disabled={saveContact.isPending}>
                    {saveContact.isPending ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    className="btn-borde"
                    onClick={() => setContactEditOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
                {saveContact.isError && (
                  <p className="form-error">
                    No se pudo guardar: {saveContact.error.message}
                  </p>
                )}
              </form>
            )}
            <div className="client-sheet-actions">
              {displayDetailPhone && (
                <a
                  className="btn-borde"
                  href={`tel:${displayDetailPhone.replace(/[^\d+]/g, "")}`}
                  aria-label={`Llamar a ${detailProfile.name}`}
                >
                  <Phone size={14} /> Llamar
                </a>
              )}
              {displayDetailPhone && (
                <a
                  className="btn-borde whatsapp-action"
                  href={`https://wa.me/${
                    displayDetailPhone.replace(/\D/g, "").length === 9 &&
                    displayDetailPhone.replace(/\D/g, "").startsWith("9")
                      ? `51${displayDetailPhone.replace(/\D/g, "")}`
                      : displayDetailPhone.replace(/\D/g, "")
                  }`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageSquareText size={14} /> WhatsApp
                </a>
              )}
              <button
                className="btn-rojo"
                onClick={() => {
                  setClientDetailKey(null);
                  setQuickCallProfile(detailProfile);
                }}
              >
                <Phone size={14} /> Registrar llamada
              </button>
            </div>
            <div className="client-sheet-signal">
              <span className="eyebrow">CÓMO LLEGÓ</span>
              <p>
                {clientSignal(detailProfile)}
              </p>
              {detailLogs[0] && (
                <small>
                  Último contacto: {formatDateTime(detailLogs[0].callDate)} ·{" "}
                  {detailLogs[0].outcome}
                </small>
              )}
            </div>
            <div className="client-sheet-history">
              <div className="client-sheet-section-head">
                <span className="eyebrow">ÚLTIMAS VISITAS</span>
                <Pill tone="neutral">{detailRecords.length}</Pill>
              </div>
              {detailRecords.length ? (
                detailRecords.slice(0, 6).map(record => (
                  <div
                    className="client-sheet-visit"
                    key={`${record.id}-${record.timestamp}`}
                  >
                    <span className={`visit-quality ${clean(record.quality)}`}>
                      {record.quality || "Sin calificar"}
                    </span>
                    <span>
                      <b>{record.dish || "Sin plato registrado"}</b>
                      <small>
                        {formatDate(record.timestamp)} ·{" "}
                        {record.registeredBy || "Sin mesero"}
                      </small>
                      {record.comment && <em>{record.comment}</em>}
                    </span>
                  </div>
                ))
              ) : (
                <Empty text="Todavía no hay visitas registradas para este cliente." />
              )}
            </div>
            {detailLogs.length > 0 && (
              <div className="client-sheet-history">
                <div className="client-sheet-section-head">
                  <span className="eyebrow">LLAMADAS Y PROMOCIONES</span>
                  <Pill tone="neutral">{detailLogs.length}</Pill>
                </div>
                {detailLogs.slice(0, 5).map(log => (
                  <div className="client-sheet-visit" key={log.id}>
                    <span className="visit-quality">
                      {formatDate(log.callDate)}
                    </span>
                    <span>
                      <b>{log.outcome}</b>
                      <small>
                        {log.promotion || "Sin promoción"} ·{" "}
                        {log.recoveryResult || log.notes || "Sin detalle"}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="client-sheet-footer">
              <small>La ficha se cierra sin salir de esta pantalla.</small>
              <button
                className="btn-borde"
                onClick={() => setClientDetailKey(null)}
              >
                Cerrar
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
    </AdminPinProvider>
  );
}

function Profile({
  user,
  onLogout,
}: {
  user: SystemUser | null;
  onLogout: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"account" | "sessions">(() => {
    const saved = localStorage.getItem("coronel.profileTab");
    return saved === "sessions" ? "sessions" : "account";
  });
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const utils = trpc.useUtils();
  const sessionsQuery = trpc.auth.sessions.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const updateName = trpc.profile.updateName.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setEditingName(false);
    },
  });
  const updateAvatar = trpc.profile.updateAvatar.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const changeOwnPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!user?.email) {
      setPasswordError(
        "Esta cuenta no tiene un correo visible; pide al administrador cambiar la contraseña."
      );
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (passwordForm.current === passwordForm.next) {
      setPasswordError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }
    setPasswordSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.current,
      });
      if (verifyError) {
        throw new Error("La contraseña actual no es correcta.");
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.next,
      });
      if (updateError) throw updateError;
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordSuccess("Contraseña actualizada correctamente.");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la contraseña."
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };
  useEffect(() => {
    if (user?.name) setNameDraft(user.name);
  }, [user?.name]);
  useEffect(() => {
    localStorage.setItem("coronel.profileTab", tab);
  }, [tab]);
  const sessions = (sessionsQuery.data ?? []) as SessionEvent[];
  return (
    <>
      <div className="page-intro profile-intro">
        <div>
          <Pill tone="blue">MI CUENTA</Pill>
          <h2>Mi cuenta</h2>
          <p>
            Tu nombre, tu imagen y la forma en que entras al sistema.
          </p>
        </div>
        <div className="intro-note">
          <Users size={17} />
          <span>
            <b>{user ? "Sesión autenticada" : "Sin sesión"}</b>
            <small>
              {user
                ? "Lo que hagas quedará registrado con tu nombre."
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
          Mis datos
        </button>
        <button
          className={tab === "sessions" ? "active" : ""}
          onClick={() => setTab("sessions")}
        >
          <History size={16} />
          Historial de entradas <Pill tone="neutral">{sessions.length}</Pill>
        </button>
      </div>
      {tab === "account" ? (
        <>
          <section className="panel profile-panel">
            <div className="profile-avatar profile-avatar-symbol">
              {avatarSymbol(user?.avatarPreset)}
            </div>
            <div className="profile-details">
              <p className="eyebrow">TUS DATOS</p>
              {editingName ? (
                <div className="profile-name-editor">
                  <input
                    autoFocus
                    value={nameDraft}
                    maxLength={80}
                    onChange={event => setNameDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        const name = nameDraft.trim();
                        if (name.length >= 2) updateName.mutate({ name });
                      }
                      if (event.key === "Escape") {
                        setEditingName(false);
                        setNameDraft(user?.name ?? "");
                      }
                    }}
                    aria-label="Tu nombre"
                  />
                  <button
                    className="small-action"
                    disabled={
                      updateName.isPending || nameDraft.trim().length < 2
                    }
                    onClick={() => updateName.mutate({ name: nameDraft.trim() })}
                  >
                    {updateName.isPending ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(user?.name ?? "");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="profile-name-line">
                  <h3>{user?.name || "Usuario no identificado"}</h3>
                  <button
                    className="small-action"
                    onClick={() => {
                      setNameDraft(user?.name ?? "");
                      setEditingName(true);
                    }}
                  >
                    Editar nombre
                  </button>
                </div>
              )}
              <p>
                {user?.email ||
                  "El proveedor de acceso no entregó correo visible."}
              </p>
              {updateName.error && (
                <p className="form-error">{updateName.error.message}</p>
              )}
              {updateName.isSuccess && !editingName && (
                <p className="success-inline">✓ Nombre actualizado.</p>
              )}
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
            <section className="panel profile-password-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">SEGURIDAD</p>
                  <h3>Cambiar mi contraseña</h3>
                  <small className="muted">
                    Valida tu contraseña actual antes de guardar la nueva.
                  </small>
                </div>
                <Pill tone="green">Tu cuenta</Pill>
              </div>
              <form onSubmit={changeOwnPassword}>
                <div className="profile-password-grid">
                  <label>
                    Contraseña actual
                    <PasswordInput
                      autoComplete="current-password"
                      required
                      value={passwordForm.current}
                      onChange={event =>
                        setPasswordForm(current => ({
                          ...current,
                          current: event.target.value,
                        }))
                      }
                      placeholder="Tu contraseña actual"
                    />
                  </label>
                  <label>
                    Nueva contraseña
                    <PasswordInput
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={passwordForm.next}
                      onChange={event =>
                        setPasswordForm(current => ({
                          ...current,
                          next: event.target.value,
                        }))
                      }
                      placeholder="Mínimo 8 caracteres"
                    />
                  </label>
                  <label>
                    Repetir nueva contraseña
                    <PasswordInput
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={passwordForm.confirm}
                      onChange={event =>
                        setPasswordForm(current => ({
                          ...current,
                          confirm: event.target.value,
                        }))
                      }
                      placeholder="Repite la nueva"
                    />
                  </label>
                </div>
                {passwordError && <p className="form-error">{passwordError}</p>}
                {passwordSuccess && (
                  <p className="success-inline">✓ {passwordSuccess}</p>
                )}
                <div className="profile-password-actions">
                  <button
                    type="submit"
                    className="small-action"
                    disabled={passwordSubmitting}
                  >
                    {passwordSubmitting
                      ? "Validando y guardando…"
                      : "Cambiar contraseña"}
                  </button>
                </div>
              </form>
            </section>
          )}
          {user && (
            <section className="panel avatar-picker-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">TU IMAGEN</p>
                  <h3>Cómo te ves</h3>
                  <small className="muted">
                    Elige un avatar para reconocerte dentro del sistema.
                  </small>
                </div>
                <Pill tone="blue">Acceso con correo</Pill>
              </div>
              <button
                className="avatar-open-button"
                onClick={() => setAvatarPickerOpen(true)}
              >
                <span>{avatarSymbol(user.avatarPreset)}</span>
                <span>
                  <b>Cambiar mi imagen</b>
                  <small>Elige un avatar</small>
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
                        <p className="eyebrow">TU IMAGEN</p>
                        <h3>Elige un avatar</h3>
                        <p className="muted">
                          Se guardará y la ventana se cerrará.
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
            <p className="eyebrow">CÓMO ENTRAS</p>
            <h3>Tu contraseña</h3>
            <p>
              Entras con tu correo y contraseña. Si olvidaste la contraseña, en
              la pantalla de inicio usa “¿Olvidaste tu contraseña?” y te
              enviaremos un enlace para cambiarla.
            </p>
            {user?.role === "admin" && (
              <p className="muted">
                Para dar acceso a otra persona, entra a{" "}
                <b>Cuentas y accesos</b>.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="panel session-history-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">HISTORIAL</p>
              <h3>Cuándo entraste y saliste</h3>
              <small className="muted">
                Guardamos la fecha, el navegador y el tipo de conexión.
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
  const searchExportColumns = [
    "Fecha",
    "Cliente",
    "Teléfono",
    "Producto",
    "Comentario",
    "Mesero",
    "Calidad",
  ];
  const searchExportRows = records.map(record => [
    record.timestamp,
    record.clientName,
    record.phone,
    record.dish,
    record.comment,
    record.registeredBy,
    record.quality,
  ]);
  const exportResults = () =>
    downloadGenericCsv(
      `busqueda-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      searchExportColumns,
      searchExportRows
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
                <button
                  onClick={() =>
                    downloadTablePdf(
                      "Resultados de búsqueda",
                      `${records.length} registros relacionados`,
                      searchExportColumns,
                      searchExportRows
                    )
                  }
                >
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

function ExportPreviewModal({
  data,
  onClose,
}: {
  data: ExportPreviewData;
  onClose: () => void;
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [orientation, setOrientation] = useState<
    "auto" | "portrait" | "landscape"
  >("auto");
  const [paperFont, setPaperFont] = useState<"compact" | "normal" | "large">(
    "normal"
  );
  const [includePattern, setIncludePattern] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<boolean[]>(
    data.columns.map(() => true)
  );
  useEffect(() => {
    setVisibleColumns(data.columns.map(() => true));
  }, [data]);
  const filteredRows = useMemo(() => {
    const search = normalizeText(query.trim());
    return data.rows.filter((row, index) => {
      if (search && !normalizeText(row.join(" ")).includes(search)) return false;
      const date = data.dates?.[index];
      if (fromDate || toDate) {
        if (!date || Number.isNaN(date.getTime())) return false;
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (fromDate && day < fromDate) return false;
        if (toDate && day > toDate) return false;
      }
      return true;
    });
  }, [data, fromDate, toDate, query]);
  const selectedIndexes = data.columns
    .map((_, index) => index)
    .filter(index => visibleColumns[index]);
  const selectedColumns = selectedIndexes.map(index => data.columns[index]);
  const selectedRows = filteredRows.map(row =>
    selectedIndexes.map(index => row[index])
  );
  const download = () => {
    downloadTablePdf(
      data.title,
      `${data.subtitle} · ${filteredRows.length} registros · ${pageSize.toUpperCase()} · ${
        orientation === "auto"
          ? selectedColumns.length > 6
            ? "horizontal"
            : "vertical"
          : orientation === "landscape"
            ? "horizontal"
            : "vertical"
      }`,
      selectedColumns,
      selectedRows,
      data.filename,
      {
        pageSize,
        orientation,
        fontSize: paperFont === "compact" ? 6.5 : paperFont === "large" ? 9 : 7.5,
        pattern: includePattern,
        logo: includeLogo,
      }
    );
    onClose();
  };
  const formatLabel = `${pageSize.toUpperCase()} · ${
    orientation === "auto"
      ? selectedColumns.length > 6
        ? "HORIZONTAL"
        : "VERTICAL"
      : orientation === "landscape"
        ? "HORIZONTAL"
        : "VERTICAL"
  }`;
  return createPortal(
    <div
      className="modal-backdrop pdf-preview-backdrop export-preview-backdrop"
      onClick={onClose}
    >
      <div
        className="pdf-preview-modal export-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Vista previa PDF: ${data.title}`}
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
            {data.dates && (
              <>
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
              </>
            )}
            <label className="pdf-date-field">
              <span>Buscar</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Cualquier dato…"
              />
            </label>
            <label className="pdf-date-field">
              <span>Tamaño</span>
              <select
                value={pageSize}
                onChange={event =>
                  setPageSize(event.target.value as "a4" | "letter")
                }
              >
                <option value="a4">A4</option>
                <option value="letter">Carta</option>
              </select>
            </label>
            <label className="pdf-date-field">
              <span>Orientación</span>
              <select
                value={orientation}
                onChange={event =>
                  setOrientation(event.target.value as typeof orientation)
                }
              >
                <option value="auto">Automática</option>
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </label>
            <label className="pdf-date-field">
              <span>Letra</span>
              <select
                value={paperFont}
                onChange={event =>
                  setPaperFont(event.target.value as typeof paperFont)
                }
              >
                <option value="compact">Compacta</option>
                <option value="normal">Normal</option>
                <option value="large">Grande</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includePattern}
                onChange={event => setIncludePattern(event.target.checked)}
              />
              <span>Incluir patrón</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={event => setIncludeLogo(event.target.checked)}
              />
              <span>Incluir logo</span>
            </label>
            <details className="pdf-column-picker">
              <summary>
                Columnas ({selectedColumns.length}/{data.columns.length})
              </summary>
              <div>
                {data.columns.map((column, index) => (
                  <label key={column}>
                    <input
                      type="checkbox"
                      checked={visibleColumns[index] ?? true}
                      onChange={() =>
                        setVisibleColumns(current =>
                          current.map((value, i) =>
                            i === index ? !value : value
                          )
                        )
                      }
                    />
                    {column}
                  </label>
                ))}
              </div>
            </details>
            <small>
              La vista previa y las métricas se actualizan al instante.
            </small>
          </aside>
          <div className="pdf-preview-sheet">
            <div className="pdf-preview-brand">
              <img
                src="/manus-storage/logo-coronel.png"
                alt="Coronel · Pollos y Parrillas"
              />
              <div>
                <b>CORONEL · REPORTE</b>
                <small>
                  {data.subtitle} · {filteredRows.length} registros visibles
                </small>
              </div>
            </div>
            <section className="pdf-preview-summary">
              <strong>Resumen del reporte</strong>
              <span>
                {data.title} · {fromDate || "inicio"} a {toDate || "hoy"} ·{" "}
                {selectedColumns.length} columnas · {formatLabel}.
              </span>
            </section>
            <section className="pdf-preview-section">
              <h4>Resumen ejecutivo</h4>
              <div className="pdf-preview-metrics">
                <span>
                  <b>{filteredRows.length}</b>
                  <small>Registros visibles</small>
                </span>
                <span>
                  <b>{data.rows.length}</b>
                  <small>Registros totales</small>
                </span>
                <span>
                  <b>{selectedColumns.length}</b>
                  <small>Columnas</small>
                </span>
                <span>
                  <b>{pageSize.toUpperCase()}</b>
                  <small>Formato</small>
                </span>
              </div>
            </section>
            <section className="pdf-preview-section">
              <h4>{data.title}</h4>
              <div className="export-preview-table">
                <table>
                  <thead>
                    <tr>
                      {selectedColumns.map(column => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRows.map((row, index) => (
                      <tr key={index}>
                        {row.map((value, cellIndex) => (
                          <td key={cellIndex}>{String(value ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredRows.length && (
                  <Empty text="No hay registros con esos filtros." />
                )}
              </div>
            </section>
          </div>
        </div>
        <div className="modal-actions pdf-preview-actions">
          <button className="secondary-action" onClick={onClose}>
            Cancelar
          </button>
          <button className="secondary-action" onClick={() => window.print()}>
            Imprimir vista
          </button>
          <button
            className="small-action"
            onClick={download}
            disabled={!filteredRows.length || !selectedColumns.length}
          >
            <FileText size={15} /> Descargar detalle PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [pageOrientation, setPageOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [includePattern, setIncludePattern] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const dialogRef = useDialogFocus(open, onClose);
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
  if (!open) return null;
  const dateLabel = `${fromDate || "inicio"} – ${toDate || "hoy"}`;
  const summary = `En ${dateLabel} se registraron ${scopedRecords.length} encuestas, con ${Math.round(scopedPositive * 100)}% de calidad positiva. ${trend}`;
  const toggle = (key: keyof typeof sections) =>
    setSections(current => ({ ...current, [key]: !current[key] }));
  return (
    <div className="modal-backdrop pdf-preview-backdrop" onClick={onClose}>
      <div
        className="pdf-preview-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del reporte"
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
            <label className="pdf-date-field">
              <span>Tamaño</span>
              <select value={pageSize} onChange={event => setPageSize(event.target.value as "a4" | "letter")}>
                <option value="a4">A4</option>
                <option value="letter">Carta</option>
              </select>
            </label>
            <label className="pdf-date-field">
              <span>Orientación</span>
              <select value={pageOrientation} onChange={event => setPageOrientation(event.target.value as typeof pageOrientation)}>
                <option value="auto">Automática</option>
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={includePattern} onChange={event => setIncludePattern(event.target.checked)} />
              <span>Incluir patrón</span>
            </label>
            <label>
              <input type="checkbox" checked={includeLogo} onChange={event => setIncludeLogo(event.target.checked)} />
              <span>Incluir logo</span>
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
              <img src="/manus-storage/logo-coronel.png" alt="Coronel" />
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
                          <td>{noCommentLabel(profile)}</td>
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
          <button className="secondary-action" onClick={() => window.print()}>
            Imprimir vista
          </button>
          <button
            className="small-action"
            onClick={() => {
              downloadTablePdf(
                `Reporte de encuestas · ${areaLabel}`,
                `Rango: ${dateLabel} · ${filterLabel}`,
                ["Fecha", "Cliente", "Teléfono", "Producto", "Calidad", "Comentario"],
                scopedRecords.map(record => [
                  formatDateTime(record.timestamp),
                  record.clientName,
                  record.phone,
                  record.dish,
                  record.quality,
                  record.comment,
                ]),
                undefined,
                {
                  pageSize,
                  orientation: pageOrientation,
                  pattern: includePattern,
                  logo: includeLogo,
                }
              );
              onClose();
            }}
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
          placeholder="Buscar cliente, teléfono o comentario…"
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
        <button title="Abrir vista previa del PDF" onClick={onPdf}>
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
  { key: "dia", label: "0–3 días", when: "Próximos 3 días", hint: "Confirmar y ofrecer la promo" },
  {
    key: "semana",
    label: "4–7 días",
    when: "Próxima semana",
    hint: "Recordar y reservar",
  },
  {
    key: "mes",
    label: "8–30 días",
    when: "Este mes",
    hint: "Revisar datos y planificar",
  },
  {
    key: "seguimiento",
    label: "Pasadas",
    when: "Ya pasó",
    hint: "Agradecer y registrar si vino",
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
  allMonths = false,
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
  allMonths?: boolean;
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
  const [historyEditOpen, setHistoryEditOpen] = useState(false);
  const [historyPhone, setHistoryPhone] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  useEffect(() => {
    if (!callKey && !historyKey && !templatesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCallKey(null);
        setHistoryKey(null);
        setTemplatesOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [callKey, historyKey, templatesOpen]);
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
  const [birthdayPdfPreview, setBirthdayPdfPreview] =
    useState<ExportPreviewData | null>(null);
  const birthdayExportColumns = [
    "Cliente",
    "Cumpleaños",
    "Teléfono",
    "Promoción",
    "Estado",
    "Responsable",
    "Próxima acción",
    "Días",
  ];
  const birthdayStatusLabel = (progress: string) =>
    ({
      pending: "Sin contactar",
      contacted: "Ya saludado",
      accepted: "Aceptó promo",
      redeemed: "Usó promo",
      rejected: "No vino",
      noanswer: "No contestó",
    })[progress] || progress;
  const birthdayExportRows = rows.map(row => [
    row.item.record.clientName || "Sin nombre",
    row.item.record.birthday || "",
    row.campaign?.phone || row.item.record.phone || "",
    promoteFor(row),
    birthdayStatusLabel(row.progress),
    row.campaign?.responsible || "Cajera",
    toDateInputValue(row.campaign?.nextActionAt) || "Sin fecha",
    daysLabel(row.item.days),
  ]);
  const exportBirthdays = () =>
    downloadGenericCsv(
      `cumpleanos-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      birthdayExportColumns,
      birthdayExportRows
    );
  const exportBirthdaysPdf = () =>
    setBirthdayPdfPreview({
      title: "Cumpleaños Coronel",
      subtitle: `${rows.length} clientes · ${monthName}`,
      columns: birthdayExportColumns,
      rows: birthdayExportRows,
      dates: rows.map(row => row.item.target),
      filename: `cumpleanos-coronel-${new Date().toISOString().slice(0, 10)}.pdf`,
    });

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

  function promoteFor(row: (typeof rows)[number]) {
    return row.campaign?.promotion || row.item.promotion;
  }

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

  const setStatus = (
    row: (typeof rows)[number],
    value:
      | "pending"
      | "contacted"
      | "accepted"
      | "redeemed"
      | "rejected"
      | "noanswer"
  ) => {
    if (value === "pending") {
      persist(row, { progressStatus: "pending" });
      return;
    }
    registerCall(row, value);
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
  const historyDisplayPhone =
    historyRow?.campaign?.phone || historyRow?.item.record.phone || "";
  const resetHistoryContact = () => {
    if (!historyRow) return;
    const confirmed = window.confirm(
      `¿Marcar a ${historyRow.item.record.clientName || "este cliente"} como “Sin contactar”? El historial de visitas y llamadas se conserva.`
    );
    if (!confirmed) return;
    const campaign = historyRow.campaign;
    saveCampaign.mutate({
      clientKey: historyRow.key,
      clientName: historyRow.item.record.clientName || "Cliente",
      phone: historyDisplayPhone,
      stage: campaign?.stage ?? "week",
      channel: campaign?.channel ?? "whatsapp",
      progressStatus: "pending",
      promotion: campaign?.promotion ?? undefined,
      responsible: campaign?.responsible ?? undefined,
      nextActionAt: null,
      nextActionLabel: campaign?.nextActionLabel ?? undefined,
      familyName: campaign?.familyName ?? undefined,
      familyBirthday: campaign?.familyBirthday ?? undefined,
      noRedeemReason: campaign?.noRedeemReason ?? undefined,
      notes: campaign?.notes ?? undefined,
    });
  };
  useEffect(() => {
    setHistoryEditOpen(false);
    setHistoryPhone(
      (historyRow?.campaign?.phone || historyRow?.item.record.phone || "").toString()
    );
  }, [historyKey]);

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
      <div className="birthday-command">
        <div className="birthday-command-copy">
          <p className="eyebrow">CUMPLEAÑOS DE {monthName.toUpperCase()}</p>
          <h3>
            {pendingCount
              ? `${pendingCount} clientes por saludar`
              : "Todos ya fueron saludados"}
          </h3>
          <p className="muted">
            {todayCount
              ? `Hoy hay ${plural(todayCount, "cumpleaños", "cumpleaños")}. Felicítalos y registra si vienen.`
              : weekCount
                ? `Hoy no hay cumpleaños. Tienes ${plural(weekCount, "cumpleaños", "cumpleaños")} esta semana.`
                : "No hay cumpleaños próximos en el mes seleccionado. Puedes revisar otro mes."}
          </p>
          <div className="birthday-command-actions">
            <button
              className="btn-rojo"
              onClick={() => {
                setFilter(todayCount ? "dia" : "semana");
                setOnlyPending(true);
              }}
            >
              <MessageSquareText size={15} />
              {todayCount
              ? `Saludar a ${todayCount} de hoy`
              : weekCount
                ? `Ver los ${weekCount} de esta semana`
                : "Ver todos los cumpleaños"}
            </button>
            <button className="btn-borde" onClick={openTemplates}>
              Mensajes para saludar
            </button>
            {overdueCount > 0 && (
              <button
                className="birthday-overdue-chip"
                onClick={() => setFilter("vencidas")}
              >
                ⚠ {plural(overdueCount, "acción vencida", "acciones vencidas")}
              </button>
            )}
          </div>
        </div>
        <div className="birthday-command-stats">
          <div>
            <small>HOY</small>
            <b>{todayCount}</b>
            <span>por felicitar</span>
          </div>
          <div>
            <small>ESTA SEMANA</small>
            <b>{weekCount}</b>
            <span>lunes a domingo</span>
          </div>
          <div>
            <small>SIN CONTACTAR</small>
            <b>{pendingCount}</b>
            <span>de {counts.todos} del mes</span>
          </div>
        </div>
      </div>

      <div className="birthday-progress-grid" aria-label="Avance de la campaña">
        {[
          { label: allMonths ? "Total de cumpleaños" : "Total del mes", value: counts.todos, tone: "total" },
          { label: "Ya saludados", value: contactedCount, tone: "contacted" },
          { label: "Aceptaron promo", value: acceptedCount, tone: "accepted" },
          { label: "Usaron promo", value: redeemedCount, tone: "redeemed" },
        ].map((stage, index) => {
          const pct = counts.todos
            ? Math.round((stage.value / counts.todos) * 100)
            : 0;
          return (
            <button
              type="button"
              className={`birthday-progress-item tone-${stage.tone}`}
              key={stage.label}
              title="Ver cumpleaños del mes"
              onClick={() =>
                document
                  .getElementById("bw-list")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <div className="birthday-progress-top">
                <span>{stage.label}</span>
                <b>{stage.value}</b>
              </div>
              <div className="birthday-progress-track">
                <i
                  style={{
                    width: index === 0 ? "100%" : `${Math.max(pct, 3)}%`,
                  }}
                />
              </div>
              <small>
                {index === 0
                  ? allMonths
                    ? "cumpleaños en total"
                    : "cumpleaños este mes"
                  : `${pct}% del total`}
              </small>
            </button>
          );
        })}
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
          Solo los que faltan
        </button>
        {selectedDate && (
          <button className="bw-clear-date" onClick={onClearDate}>
            Filtrando: {selectedDateText} · Ver todo ✕
          </button>
        )}
        <button className="bw-templates-button" onClick={openTemplates}>
          Cambiar mensaje
        </button>
        <div className="export-group birthday-export-group">
          <button onClick={exportBirthdays}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportBirthdaysPdf}>
            <FileText size={14} /> PDF
          </button>
        </div>
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
            <div className="bw-list" id="bw-list">
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
                    className={`bw-card bw-card-${row.horizon} ${item.days === 0 ? "is-birthday-today" : ""} ${expanded ? "is-expanded" : ""}`}
                    key={row.key}
                  >
                    {item.days === 0 && (
                      <svg
                        className="birthday-card-art"
                        viewBox="0 0 160 96"
                        aria-hidden="true"
                      >
                        <g opacity=".9">
                          <path d="M26 58c-8-10 0-22 8-22s16 12 8 22z" fill="#f2b544" />
                          <path d="M26 58v22" stroke="#d98f2b" strokeWidth="1.5" />
                          <path d="M47 48c-6-8 0-17 6-17s12 9 6 17z" fill="#e8795f" />
                          <path d="M47 48v28" stroke="#c95f47" strokeWidth="1.5" />
                          <circle cx="118" cy="28" r="3" fill="#77c996" />
                          <circle cx="137" cy="42" r="2.5" fill="#f2b544" />
                          <rect x="105" y="52" width="6" height="2.5" rx="1" fill="#e8795f" transform="rotate(22 108 53)" />
                          <rect x="128" y="18" width="7" height="2.5" rx="1" fill="#5aa9d6" transform="rotate(-18 131 19)" />
                          <path d="M70 22l3 6 6 .8-4.5 4.3 1 6-5.5-3-5.5 3 1-6-4.5-4.3 6-.8z" fill="#f0c45b" opacity=".8" />
                        </g>
                      </svg>
                    )}
                    <div className="bw-card-top">
                      <button
                        type="button"
                        className="bw-date"
                        onClick={() => {
                          setHistoryKey(row.key);
                          setHistorySection("summary");
                        }}
                        title="Abrir ficha del cliente"
                      >
                        <b>{date.split(" ")[0]}</b>
                        <small>{date.split(" ")[1]?.replace(".", "")}</small>
                      </button>
                      <div className="bw-main">
                        <div className="bw-title">
                          <button
                            type="button"
                            className="bw-name-link"
                            onClick={() => {
                              setHistoryKey(row.key);
                              setHistorySection("summary");
                            }}
                            title="Abrir ficha del cliente"
                          >
                            <b>
                              {item.record.clientName || "Cliente sin nombre"}
                            </b>
                          </button>
                          {item.profile?.segment && (
                            <Pill
                              tone={
                                item.profile.segment === "Fiel"
                                  ? "green"
                                  : "blue"
                              }
                            >
                              {segmentLabelFor(item.profile.segment)}
                            </Pill>
                          )}
                          <span
                            className={`bw-days ${
                              item.days === 0
                                ? "is-today"
                                : item.days > 0 && item.days <= 3
                                  ? "is-soon"
                                  : item.days < 0
                                    ? "is-overdue"
                                    : ""
                            }`}
                          >
                            {daysLabel(item.days)}
                          </span>
                        </div>
                        <div className="bw-meta">
                          {item.record.phone || "Sin teléfono"} ·{" "}
                          {promoteFor(row)}
                          {campaign?.responsible
                            ? ` · ${campaign.responsible}`
                            : ""}
                        </div>
                        <div className="bw-card-foot">
                          <select
                            className="bw-status-select"
                            value={row.progress}
                            disabled={createCall.isPending}
                            aria-label={`Estado de ${item.record.clientName || "cliente"}`}
                            onChange={event =>
                              setStatus(
                                row,
                                event.target.value as
                                  | "pending"
                                  | "contacted"
                                  | "accepted"
                                  | "redeemed"
                                  | "rejected"
                                  | "noanswer"
                              )
                            }
                          >
                            <option value="pending">Sin contactar</option>
                            <option value="contacted">Ya saludado</option>
                            <option value="accepted">Aceptó promo</option>
                            <option value="redeemed">Usó promo</option>
                            <option value="rejected">No vino</option>
                            <option value="noanswer">No contestó</option>
                          </select>
                          {campaign?.nextActionAt ? (
                            <button
                              className={`bw-next ${nextActionOverdue ? "overdue" : ""}`}
                              onClick={() => setExpandedKey(row.key)}
                              title="Editar próximo paso"
                            >
                              ⏰ {campaign.nextActionLabel || "Próximo paso"}:{" "}
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
                              + Próximo paso
                            </button>
                          )}
                          <span className="bw-attempts">
                            {row.callAttempts > 0
                              ? `☎ ${row.callAttempts} intento${row.callAttempts === 1 ? "" : "s"}`
                              : "Sin llamadas"}
                          </span>
                          <button
                            className="bw-history-link"
                            onClick={() => {
                              setHistoryKey(row.key);
                              setHistorySection("contacts");
                            }}
                          >
                            Historial
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
                          <Phone size={13} /> Registrar llamada
                        </button>
                        <details className="bw-more">
                          <summary className="bw-action">⋯ Más</summary>
                          <div className="bw-more-menu">
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
                              {copiedKey === row.key
                                ? "✓ Copiado"
                                : "Copiar"}
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
                        </details>
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

      {callRow && createPortal(
        <div className="bw-modal-backdrop" onClick={() => setCallKey(null)}>
          <div className="bw-modal" role="dialog" aria-modal="true" aria-label="Detalle de cumpleaños" onClick={event => event.stopPropagation()}>
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
                  <Phone size={13} /> Registrar llamada
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
        ,
        document.body
      )}

      {historyRow &&
        createPortal(
        <div className="client-sheet-backdrop" onClick={() => setHistoryKey(null)}>
          <aside
            className="client-sheet birthday-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Ficha de cumpleaños de ${historyRow.item.record.clientName || "cliente"}`}
            onClick={event => event.stopPropagation()}
          >
            <div className="client-sheet-head">
              <div>
                <p className="eyebrow">FICHA DEL CUMPLEAÑOS</p>
                <h3>{historyRow.item.record.clientName || "Cliente"}</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setHistoryKey(null)}
                aria-label="Cerrar ficha"
              >
                <X size={17} />
              </button>
            </div>

            <div className="client-sheet-info birthday-sheet-info">
              <div>
                <small>TELÉFONO</small>
                <b>
                  {historyDisplayPhone ? (
                    <a
                      className="client-contact-link"
                      href={`tel:${historyDisplayPhone.replace(/[^\d+]/g, "")}`}
                    >
                      {historyDisplayPhone}
                    </a>
                  ) : (
                    "Sin teléfono"
                  )}
                </b>
              </div>
              <div>
                <small>CUMPLEAÑOS</small>
                <b>{historyRow.item.record.birthday || "Sin fecha"}</b>
              </div>
              <div>
                <small>SEGMENTO</small>
                <b className={historyRow.item.profile?.segment === "En riesgo" ? "segment-risk" : ""}>
                  {historyRow.item.profile?.segment || "Sin grupo"}
                </b>
              </div>
              <div>
                <small>PLATO FAVORITO</small>
                <b>{historyRow.item.profile?.dish || "Sin dato"}</b>
              </div>
              <div>
                <small>PROMOCIÓN</small>
                <b>{promoteFor(historyRow)}</b>
              </div>
              <div>
                <small>RESPONSABLE</small>
                <b>{historyRow.campaign?.responsible || "Cajera"}</b>
              </div>
              <div>
                <small>PRÓXIMA ACCIÓN</small>
                <b>{toDateInputValue(historyRow.campaign?.nextActionAt) || "Sin fecha"}</b>
              </div>
              <div>
                <small>FAMILIARES</small>
                <b>
                  {historyRow.campaign?.familyName
                    ? `${historyRow.campaign.familyName}${historyRow.campaign.familyBirthday ? ` · ${historyRow.campaign.familyBirthday}` : ""}`
                    : "Sin dato"}
                </b>
              </div>
              <div>
                <small>ÚLTIMA ACTUALIZACIÓN</small>
                <b>
                  {historyRow.campaign?.updatedAt
                    ? formatDateTime(historyRow.campaign.updatedAt)
                    : "Sin actualizar"}
                </b>
              </div>
            </div>

            <div className="client-sheet-actions birthday-actions">
              {historyDisplayPhone && (
                <a
                  className="btn-borde"
                  href={`tel:${historyDisplayPhone.replace(/[^\d+]/g, "")}`}
                >
                  <Phone size={14} /> Llamar
                </a>
              )}
              {historyDisplayPhone && (
                <a
                  className="btn-borde whatsapp-action"
                  href={`https://wa.me/${
                    historyDisplayPhone.replace(/\D/g, "").length === 9 &&
                    historyDisplayPhone.replace(/\D/g, "").startsWith("9")
                      ? `51${historyDisplayPhone.replace(/\D/g, "")}`
                      : historyDisplayPhone.replace(/\D/g, "")
                  }`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageSquareText size={14} /> WhatsApp
                </a>
              )}
            </div>
            <div className="client-sheet-head-actions">
              {historyRow.campaign?.progressStatus &&
                historyRow.campaign.progressStatus !== "pending" && (
                  <button
                    className="btn-borde contact-reset-button"
                    onClick={resetHistoryContact}
                  >
                    Marcar sin contactar
                  </button>
                )}
              <button
                className="btn-borde client-edit-trigger"
                onClick={() => setHistoryEditOpen(value => !value)}
              >
                <Settings2 size={14} /> Editar datos
              </button>
            </div>

            {historyEditOpen && (
              <form
                className="client-edit-form"
                onSubmit={event => {
                  event.preventDefault();
                  if (!historyRow) return;
                  const campaign = historyRow.campaign;
                  saveCampaign.mutate({
                    clientKey: historyRow.key,
                    clientName: historyRow.item.record.clientName || "Cliente",
                    phone: historyPhone,
                    stage: campaign?.stage ?? "week",
                    channel: campaign?.channel ?? "whatsapp",
                    progressStatus: campaign?.progressStatus ?? "pending",
                    promotion: campaign?.promotion ?? undefined,
                    responsible: campaign?.responsible ?? undefined,
                    nextActionAt: campaign?.nextActionAt
                      ? new Date(campaign.nextActionAt).toISOString()
                      : null,
                    nextActionLabel: campaign?.nextActionLabel ?? undefined,
                    familyName: campaign?.familyName ?? undefined,
                    familyBirthday: campaign?.familyBirthday ?? undefined,
                    noRedeemReason: campaign?.noRedeemReason ?? undefined,
                    notes: campaign?.notes ?? undefined,
                  });
                  setHistoryEditOpen(false);
                }}
              >
                <label>
                  Teléfono
                  <input
                    type="tel"
                    value={historyPhone}
                    onChange={event => setHistoryPhone(event.target.value)}
                    placeholder="Número de contacto"
                  />
                </label>
                <div className="client-edit-form-actions">
                  <button className="btn-rojo" type="submit" disabled={saveCampaign.isPending}>
                    {saveCampaign.isPending ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    className="btn-borde"
                    onClick={() => setHistoryEditOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="client-sheet-signal">
              <span className="eyebrow">CÓMO LLEGÓ</span>
              <p>{clientSignal({ quality: historyRow.item.record.quality, comment: historyRow.item.record.comment })}</p>
            </div>

            <div className="client-sheet-history">
              <div className="client-sheet-section-head">
                <span className="eyebrow">ÚLTIMAS VISITAS</span>
                <Pill tone="neutral">{historyRecords.length}</Pill>
              </div>
              {historyRecords.length ? (
                historyRecords.slice(0, 6).map(record => (
                  <div className="client-sheet-visit" key={`${record.id}-${record.timestamp}`}>
                    <span className={`visit-quality ${clean(record.quality)}`}>
                      {record.quality || "Sin calificar"}
                    </span>
                    <span>
                      <b>{record.dish || "Sin plato registrado"}</b>
                      <small>{formatDate(record.timestamp)} · {record.registeredBy || "Sin mesero"}</small>
                      {record.comment && <em>{record.comment}</em>}
                    </span>
                  </div>
                ))
              ) : (
                <Empty text="Sin visitas registradas." />
              )}
            </div>

            <div className="client-sheet-history" id="bw-history-contacts">
              <div className="client-sheet-section-head">
                <span className="eyebrow">CONTACTOS</span>
                <Pill tone="neutral">{historyLogs.length}</Pill>
              </div>
              {historyLogs.length ? (
                historyLogs.slice(0, 6).map(log => (
                  <div className="client-sheet-visit" key={log.id}>
                    <span className="visit-quality">
                      {new Date(log.callDate).toLocaleDateString("es-PE")}
                    </span>
                    <span>
                      <b>{log.outcome}</b>
                      <small>{log.recoveryResult || log.notes || "Sin detalle"}</small>
                    </span>
                  </div>
                ))
              ) : (
                <Empty text="Sin contactos registrados." />
              )}
            </div>

            <div className="client-sheet-footer">
              <small>La ficha se cierra sin salir de esta pantalla.</small>
              <button className="btn-borde" onClick={() => setHistoryKey(null)}>
                Cerrar
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}

      {templatesOpen && createPortal(
        <div className="bw-modal-backdrop" onClick={() => setTemplatesOpen(false)}>
          <div className="bw-modal bw-modal-wide" role="dialog" aria-modal="true" aria-label="Detalle de cumpleaños" onClick={event => event.stopPropagation()}>
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
        ,
        document.body
      )}

      {birthdayPdfPreview && (
        <ExportPreviewModal
          data={birthdayPdfPreview}
          onClose={() => setBirthdayPdfPreview(null)}
        />
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
  monthCursor?: Date | null
) {
  const now = new Date();
  const includeAllMonths = monthCursor === null;
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
      let target = new Date(
        includeAllMonths ? now.getFullYear() : viewedMonth.getFullYear(),
        birthday.getMonth(),
        birthday.getDate()
      );
      if (includeAllMonths) {
        // En "Todos" mostramos siempre la próxima ocurrencia de cada cliente.
        if (target < todayStart) {
          target = new Date(
            now.getFullYear() + 1,
            birthday.getMonth(),
            birthday.getDate()
          );
        }
      } else if (target < monthStart || target > monthEnd) {
        return null;
      }
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
  const [showAllBirthdays, setShowAllBirthdays] = useState(true);
  const items = useMemo(
    () =>
      buildBirthdayMarketing(
        records,
        profiles,
        promotions,
        showAllBirthdays ? null : calendarMonth
      ),
    [records, profiles, promotions, calendarMonth, showAllBirthdays]
  );
  const monthName = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);
  const activeMonthName = showAllBirthdays ? "Todos los meses" : monthName;
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
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
    setShowAllBirthdays(false);
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
          <h2>Felicita a tus clientes <span aria-hidden="true">🎂</span></h2>
          <p>
            Mira quién cumple años, saluda por WhatsApp y registra si vino a
            usar su promoción. También puedes llamarlo si prefieres.
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
          <b className="birthday-toolbar-month">
            {showAllBirthdays ? "Todos los cumpleaños" : monthLabel}
          </b>
          <button
            className="birthday-toolbar-arrow"
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
          <button
            className={`birthday-toolbar-action ${showAllBirthdays ? "active" : ""}`}
            onClick={() => {
              setShowAllBirthdays(true);
              setSelectedDate(null);
            }}
            aria-pressed={showAllBirthdays}
          >
            Todos
          </button>
          <button
            className="birthday-toolbar-action"
            onClick={() => {
              setShowAllBirthdays(false);
              goToday();
            }}
          >
            Hoy
          </button>
          <button
            className={`birthday-toolbar-action ${showCalendar ? "active" : ""}`}
            onClick={() => {
              setShowCalendar(value => !value);
              if (!showCalendar) {
                setShowAllBirthdays(false);
              }
            }}
            aria-pressed={showCalendar}
          >
            {showCalendar ? "Ocultar calendario" : "Ver calendario"}
          </button>
        </div>
      </div>

      <PageHint title="Toca el nombre o la fecha de una tarjeta para abrir su ficha." />
      <BusinessGuide
        title="Cómo felicitar a tus clientes"
        steps={[
          "Mira los cumpleaños de hoy o de esta semana.",
          "Pulsa WhatsApp o Registrar llamada.",
          "Vuelve y marca si vino, si usó la promo o si no contestó.",
        ]}
      />

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
        monthName={activeMonthName}
        allMonths={showAllBirthdays}
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
  userName,
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
  userName?: string;
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
  const productGroups = useMemo(() => {
    const groups: Record<
      string,
      { count: number; good: number; answered: number }
    > = {};
    productStats.forEach(product => {
      const group = productGroupOf(product.name);
      groups[group] ??= { count: 0, good: 0, answered: 0 };
      groups[group].count += product.count;
      groups[group].good += product.good;
      groups[group].answered += product.answered;
    });
    return Object.entries(groups)
      .map(([name, value]) => ({
        name,
        ...value,
        score: value.answered ? value.good / value.answered : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [productStats]);
  const risks = profiles.filter(p => p.segment === "En riesgo");
  const risksWithContext = risks.filter(profile => profile.comment.trim());
  const starClients = useMemo(
    () => profiles.filter(p => p.count >= 2 && clean(p.quality) === "bueno").slice(0, 4),
    [profiles]
  );
  const topPhrases = useMemo(
    () =>
      buildTopicPhrases(records.filter(record => record.comment.trim())).slice(0, 6),
    [records]
  );
  const [showDetails, setShowDetails] = useState(false);
  const birthdayMarketing = useMemo(
    () => buildBirthdayMarketing(records, profiles, promotions),
    [records, profiles, promotions]
  );
  const birthdaysToday = birthdayMarketing.filter(item => item.days === 0);
  const answeredCount = good + regular + bad;
  const overallCi = answeredCount ? wilsonInterval(good, answeredCount) : null;
  const missingQuality = Math.max(0, records.length - answeredCount);
  const badClients = profiles.filter(p => clean(p.quality) === "malo").length;
  const todayBirthdayCount = birthdayMarketing.filter(item => item.days === 0).length;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdueFollowUps = logs.filter(log => {
    if (!log.nextCallDate) return false;
    const date = new Date(log.nextCallDate);
    return !Number.isNaN(date.getTime()) && date < startOfToday;
  }).length;
  const nextBirthdays = birthdayMarketing
    .filter(item => item.days >= 0 && item.days <= 7)
    .slice(0, 3);
  const topRisk = risks[0];
  const nextBirthday = nextBirthdays[0];
  const firstName = (userName || "equipo")
    .split(" ")[0]
    .split("@")[0];
  const todayLabel = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(new Date())
    .toUpperCase();
  const weeklyVolume = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - (6 - index)
      );
      const count = records.filter(record => {
        const parsed = parseDate(record.timestamp);
        return parsed?.toDateString() === date.toDateString();
      }).length;
      return {
        label: new Intl.DateTimeFormat("es-PE", { weekday: "narrow" })
          .format(date)
          .toUpperCase(),
        count,
      };
    });
  }, [records]);
  const maxWeeklyVolume = Math.max(...weeklyVolume.map(day => day.count), 1);
  return (
    <>
      <section className="command-center">
        <div className="command-copy">
          <p className="eyebrow">CENTRO DE ACCIÓN · {todayLabel}</p>
          <h2 className="command-greeting">
            Hola, {firstName} <span aria-hidden="true">👋</span>
          </h2>
          <div className="command-pills">
            <span>
              <b>{overdueCount}</b>{" "}
              {overdueCount === 1 ? "prioridad vencida" : "prioridades vencidas"}
            </span>
            <span>
              <b>{missingQuality}</b>{" "}
              {missingQuality === 1 ? "respuesta sin calificar" : "respuestas sin calificar"}
            </span>
          </div>
          {todayBirthdayCount > 0 ? (
            <div className="today-birthday-banner">
              <span className="today-birthday-emoji" aria-hidden="true">🎂</span>
              <div>
                <b>Hoy está de cumpleaños {birthdaysToday.map(item => item.record.clientName || "un cliente").join(", ")}</b>
                <small>Un saludo a tiempo se recuerda. Puedes escribirle ahora.</small>
              </div>
              <button onClick={() => onNavigate("birthdays")}>Saludar</button>
            </div>
          ) : null}
          <div className="command-actions">
            <button
              className="btn-rojo command-primary"
              onClick={() => onNavigate("priorities")}
            >
              <Flag size={16} />
              {overdueCount
                ? `Atender ${overdueCount} vencidas`
                : "Revisar prioridades"}
              <ArrowUpRight size={15} />
            </button>
            <button
              className="btn-borde"
              onClick={() => onNavigate("birthdays")}
            >
              <Cake size={16} /> Ver cumpleaños
            </button>
          </div>

        </div>
        <aside className="pulse-card" aria-label="Cómo se sienten tus clientes">
          <div className="pulse-top">
            <div>
              <p className="eyebrow">CÓMO SE SIENTEN TUS CLIENTES</p>
              <div className="quality-human-row">
                <span className="quality-human-face" aria-hidden="true">
                  {positive >= 0.85 ? "😊" : positive >= 0.7 ? "🙂" : positive >= 0.5 ? "😐" : "😟"}
                </span>
                <div className="pulse-percent">
                  {Math.round(positive * 100)}<small>%</small>
                </div>
              </div>
              <p className="quality-human-lead">
                {Math.round(positive * 10)} de cada 10 clientes salieron contentos.
              </p>
            </div>
            {overallCi && (
              <Pill tone="green">
                IC95 {Math.round(overallCi[0] * 100)}–{Math.round(overallCi[1] * 100)}%
              </Pill>
            )}
          </div>
          <p className="pulse-sample">
            {good} de {answeredCount} respuestas fueron buenas · {missingQuality} sin calificar
          </p>
          <div className="quality-bar pulse-bar">
            <span style={{ width: `${positive * 100}%` }} />
            <i
              style={{
                width: `${(regular / Math.max(answeredCount, 1)) * 100}%`,
              }}
            />
          </div>
          <div className="pulse-legend">
            <span><i className="dot green" />Bueno {good}</span>
            <span><i className="dot yellow" />Regular {regular}</span>
            <span><i className="dot red" />Malo {bad}</span>
          </div>
          <div className="weekly-caption">
            <span>ÚLTIMOS 7 DÍAS</span>
            <b>{plural(weeklyVolume.reduce((sum, day) => sum + day.count, 0), "encuesta", "encuestas")}</b>
          </div>
          {weeklyVolume.some(day => day.count > 0) ? (
            <div className="weekly-trend" aria-label="Encuestas de los últimos 7 días">
              {weeklyVolume.map((day, index) => (
                <div
                  className="weekly-day"
                  key={`${day.label}-${index}`}
                  title={`${day.count} encuestas`}
                >
                  <span className="weekly-bar-track">
                    <i
                      style={{
                        height: `${Math.max((day.count / maxWeeklyVolume) * 100, 6)}%`,
                      }}
                    />
                  </span>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="weekly-empty">Sin encuestas en los últimos 7 días.</p>
          )}
          <div className="pulse-foot">
            <span>{records.length} encuestas en el período</span>
            <button onClick={() => onNavigate("voice")}>
              Ver análisis <ChevronRight size={14} />
            </button>
          </div>
        </aside>
      </section>
      <section className="insights-section">
        <div className="insights-head">
          <div>
            <p className="eyebrow">INSIGHTS DE HOY</p>
            <h2>Tres cosas que importan</h2>
          </div>
          <p>Lo que dicen tus datos, sin vueltas.</p>
        </div>
        <div className="insights-grid">
          <InsightCard
            label="PRIORIDAD N°1"
            tone={overdueCount ? "critical" : "positive"}
            icon={Clock3}
            title={
              overdueCount
                ? `${overdueCount} prioridades atrasadas`
                : "No hay prioridades atrasadas"
            }
            evidence={
              overdueCount
                ? "Son las que ya pasaron de fecha. Empieza por ellas."
                : "La cola está al día. Revisa cumpleaños y seguimientos."
            }
            action="Abrir prioridades"
            onClick={() => onNavigate("priorities")}
          />
          <InsightCard
            label="CLIENTE EN RIESGO"
            tone={topRisk ? "warning" : "positive"}
            icon={Phone}
            title={topRisk?.name || "Sin clientes en riesgo"}
            evidence={
              topRisk
                ? `${topRisk.phone || "Sin teléfono"} · ${clientSignal(topRisk)}`
                : "No hay clientes con calidad Mala o Regular pendientes."
            }
            meta={topRisk?.quality || undefined}
            action={topRisk ? "Abrir ficha" : "Ver clientes"}
            onClick={() =>
              topRisk ? onOpenClient(topRisk.key) : onNavigate("clients")
            }
          />
          <InsightCard
            className={nextBirthday ? "birthday-insight-card" : undefined}
            label="CUMPLEAÑOS PRÓXIMO"
            tone={nextBirthday ? "neutral" : "positive"}
            icon={Cake}
            title={nextBirthday?.record.clientName || "Sin cumpleaños próximos"}
            evidence={
              nextBirthday
                ? `${nextBirthday.promotion || "Sin promoción"} · ${
                    nextBirthday.days === 0
                      ? "es hoy"
                      : nextBirthday.days === 1
                        ? "es mañana"
                        : `en ${nextBirthday.days} días`
                  }`
                : "No hay cumpleaños en los próximos 7 días."
            }
            meta={
              nextBirthday
                ? nextBirthday.days === 0
                  ? "HOY"
                  : nextBirthday.days === 1
                    ? "EN 1 DÍA"
                    : `EN ${nextBirthday.days} DÍAS`
                : undefined
            }
            action="Ver agenda"
            onClick={() => onNavigate("birthdays")}
          />
        </div>
      </section>
      <div className="command-grid command-single">
        <section className="panel today-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">TU PLAN DE HOY</p>
              <h3>Esto es lo que toca hoy</h3>
            </div>
            <span className="today-open-count">
              {overdueCount
                ? `${overdueCount} vencidas`
                : "Sin vencidas"}
            </span>
          </div>
          <div className="today-list">
            <TodayTask
              tone={overdueCount ? "critical" : "success"}
              icon={Clock3}
              title="Prioridades vencidas"
              detail="Compromisos que ya pasaron de fecha"
              count={overdueCount}
              action="Revisar"
              onClick={() => onNavigate("priorities")}
            />
            {overdueFollowUps > 0 && (
              <TodayTask
                tone="critical"
                icon={Phone}
                title="Llamadas atrasadas"
                detail="Seguimientos que ya pasaron de fecha"
                count={overdueFollowUps}
                action="Llamar"
                onClick={() => onNavigate("calls")}
              />
            )}
            <TodayTask
              tone={badClients ? "critical" : "success"}
              icon={AlertTriangle}
              title="Clientes con calidad Mala"
              detail="Llamar y preguntar qué pasó, haya o no comentario"
              count={badClients}
              action="Llamar"
              onClick={() => onNavigate("clients", "Malo", "bad")}
            />
            <TodayTask
              tone={birthdays.length ? "warning" : "success"}
              icon={Cake}
              title="Cumpleaños próximos"
              detail="Enviar WhatsApp y registrar la respuesta"
              count={birthdays.length}
              action="Contactar"
              onClick={() => onNavigate("birthdays")}
            />
            <TodayTask
              tone={missingQuality ? "info" : "success"}
              icon={MessageSquareText}
              title="Encuestas sin calificar"
              detail="Completar la calidad para no sesgar los indicadores"
              count={missingQuality}
              action="Completar"
              onClick={() => onNavigate("voice")}
            />
          </div>
          <button
            className="panel-link"
            onClick={() => onNavigate("priorities")}
          >
            Ver todas las prioridades <ChevronRight size={15} />
          </button>
        </section>
      </div>
      <div className="command-grid command-secondary">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CLIENTES A LLAMAR</p>
              <h3>Riesgo con contexto</h3>
            </div>
            <Pill tone="red">{plural(risksWithContext.length, "caso con contexto", "casos con contexto")}</Pill>
          </div>
          {risksWithContext.slice(0, 3).map(profile => (
            <button
              className="today-client"
              key={profile.key}
              onClick={() => onOpenClient(profile.key)}
            >
              <Face tone="bad" size="sm" />
              <span>
                <b>{profile.name}</b>
                <small>
                  {profile.phone || "Sin teléfono"} ·{" "}
                  {clientSignal(profile)}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!risksWithContext.length && (
            <Empty text="No hay clientes en riesgo con comentario para mostrar contexto." />
          )}
          <button className="panel-link" onClick={() => onNavigate("clients")}>
            Ver todos los clientes <ChevronRight size={15} />
          </button>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">AGENDA</p>
              <h3>Cumpleaños próximos</h3>
            </div>
            <Pill tone="orange">{birthdays.length} en 7 días</Pill>
          </div>
          {nextBirthdays.map(item => (
            <button
              className="agenda-row"
              key={item.record.id}
              onClick={() => onNavigate("birthdays")}
            >
              <span className="agenda-date">
                <b>{String(item.target.getDate()).padStart(2, "0")}</b>
                <small>
                  {new Intl.DateTimeFormat("es-PE", { month: "short" })
                    .format(item.target)
                    .replace(".", "")}
                </small>
              </span>
              <span>
                <b>{item.record.clientName || "Cliente sin nombre"}</b>
                <small>
                  {item.days === 0
                    ? "Hoy"
                    : item.days === 1
                      ? "Mañana"
                      : `En ${item.days} días`}{" "}
                  · {item.promotion || "Sin promoción"}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!nextBirthdays.length && (
            <Empty text="No hay cumpleaños próximos." />
          )}
          <button className="panel-link" onClick={() => onNavigate("birthdays")}>
            Abrir agenda de cumpleaños <ChevronRight size={15} />
          </button>
        </section>
      </div>
      <div className="command-grid command-secondary command-appreciation">
        <section className="panel center-stars">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CLIENTES ESTRELLA</p>
              <h3>Los que merecen un detalle</h3>
            </div>
            <Pill tone="orange">{starClients.length} destacados</Pill>
          </div>
          <p className="appreciation-lead">
            Vuelven, califican bien y son parte de la historia de Coronel.
          </p>
          {starClients.map(client => (
            <button
              className="star-row center-star-row"
              key={client.key}
              onClick={() => onOpenClient(client.key)}
            >
              <span className="star-badge" aria-hidden="true">★</span>
              <span>
                <b>{client.name}</b>
                <small>
                  {client.count} visitas · {client.quality} · {client.phone || "Sin teléfono"}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!starClients.length && <Empty text="Aún no hay clientes estrella." />}
          <button className="panel-link" onClick={() => onNavigate("clients")}>
            Ver clientes <ChevronRight size={15} />
          </button>
        </section>
        <section className="panel center-phrases">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LO QUE MÁS DICEN</p>
              <h3>Frases que se repiten</h3>
            </div>
            <Pill tone="orange">{topPhrases.length} frases</Pill>
          </div>
          <p className="appreciation-lead">
            Lo que más aparece en los comentarios, sin filtros ni adornos.
          </p>
          <div className="center-phrase-list">
            {topPhrases.map(([phrase, count], index) => (
              <button
                className={`center-phrase-chip phrase-tone-${index % 4}`}
                key={phrase}
                style={{
                  fontSize: `${14 + Math.min(count, 6) * 1.7 + (index % 3)}px`,
                }}
                onClick={() => onNavigate("voice")}
              >
                <span>{phrase}</span>
                <b>{count}</b>
              </button>
            ))}
          </div>
          {!topPhrases.length && <Empty text="Aún no hay frases repetidas." />}
          <button className="panel-link" onClick={() => onNavigate("voice")}>
            Abrir Voz del cliente <ChevronRight size={15} />
          </button>
        </section>
      </div>
      <button
        className="details-toggle-button"
        onClick={() => setShowDetails(value => !value)}
        aria-expanded={showDetails}
      >
        <span>
          {showDetails ? "Ocultar análisis completo" : "Ver análisis completo"}
        </span>
        <ChevronDown size={17} className={showDetails ? "rotate" : ""} />
      </button>
      {showDetails && (
        <div className="dashboard-details">
          <div className="dashboard-grid dashboard-details-single">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">PRODUCTO Y EVALUACIÓN</p>
                  <h3>Grupos de productos</h3>
                </div>
                <Pill tone="green">Categorías</Pill>
              </div>
              <div className="product-list">
                {productGroups.map((p, index) => (
                  <div className="product-row" key={p.name}>
                    <span className="product-rank">{index + 1}</span>
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.count} encuesta(s) ·{" "}
                        {records.length
                          ? `${Math.round((p.count / records.length) * 100)}% del total`
                          : "Sin total"}{" "}
                        ·{" "}
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
              <p className="micro-note">
                El formulario todavía no separa cada variante; agrupamos por
                categoría para no comparar nombres sueltos. “Otros” reúne lo que
                aún no está clasificado.
              </p>
            </section>
          </div>
          <div className="dashboard-grid overview-bottom-charts">
            <SurveyChart records={records} />
            <MonthlyComparison records={records} />
          </div>

        </div>
      )}
    </>
  );
}
function TodayTask({
  tone,
  icon: Icon,
  title,
  detail,
  count,
  action,
  onClick,
}: {
  tone: "critical" | "warning" | "info" | "success";
  icon: typeof Clock3;
  title: string;
  detail: string;
  count: number;
  action: string;
  onClick: () => void;
}) {
  return (
    <button className={`today-task today-task-${tone}`} onClick={onClick}>
      <span className="today-task-icon">
        <Icon size={17} />
      </span>
      <span className="today-task-copy">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      <span className="today-task-count">{count}</span>
      <span className="today-task-cta">
        {action} <ChevronRight size={14} />
      </span>
    </button>
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
    "Todos" | "Calidad" | "Calidad mala" | "Cumpleaños" | "Seguimiento"
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
  const priorityPageSize = 8;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [priorityQuery, setPriorityQuery] = useState("");
  const [pendingSave, setPendingSave] = useState<{
    item: (typeof items)[number];
    patch: {
      status: "pending" | "in_progress" | "done";
      responsible: string;
      dueDate: string;
    };
  } | null>(null);
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState("");
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
          label: isBad ? "CALIFICACIÓN MALA" : "CALIFICACIÓN REGULAR",
          title: profile.name,
          detail: `${profile.phone || "Sin teléfono"} · ${clientSignal(profile)}`,
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
        label: "CUMPLEAÑOS",
        title: profile?.name || record.clientName || "Cliente sin nombre",
        detail: `${record.phone || profile?.phone || "Sin teléfono"} · Cumpleaños ${formatBirthday(record.birthday)}`,
        defaultDueDate: toDateInput(deadline),
        defaultResponsible: "Equipo de fidelización",
        action: "Llamar y ofrecer promoción",
        clientKey: profile?.key,
      });
    });
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
          label: "LLAMADA PENDIENTE",
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
                : typeFilter === "Seguimiento"
                  ? item.type === "Seguimiento"
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
    const next = { ...stateFor(item), ...patch };
    setPendingSave({ item, patch: next });
    setPinDraft("");
    setPinError("");
  };
  const cancelSave = () => {
    if (pendingSave) {
      setDrafts(current => {
        const next = { ...current };
        delete next[pendingSave.item.key];
        return next;
      });
    }
    setPendingSave(null);
    setPinDraft("");
    setPinError("");
  };
  const confirmSave = () => {
    if (!pendingSave) return;
    if (pinDraft.trim() !== "5956") {
      setPinError("Clave incorrecta. Intenta de nuevo.");
      return;
    }
    const { item, patch } = pendingSave;
    setDrafts(current => ({ ...current, [item.key]: patch }));
    saveMutation.mutate({
      priorityKey: item.key,
      status: patch.status,
      responsible: patch.responsible || undefined,
      dueDate: patch.dueDate
        ? new Date(`${patch.dueDate}T12:00:00`).toISOString()
        : null,
      adminPin: pinDraft.trim(),
    });
    setPendingSave(null);
    setPinDraft("");
    setPinError("");
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
  }, [typeFilter, statusFilter, priorityQuery]);
  const searchedItems = filteredItems.filter(item => {
    const query = normalizeText(priorityQuery.trim());
    if (!query) return true;
    return normalizeText(`${item.title} ${item.detail} ${item.label}`).includes(
      query
    );
  });
  const visiblePriorityItems = searchedItems.slice(
    (priorityPage - 1) * priorityPageSize,
    priorityPage * priorityPageSize
  );
  const priorityPages = Math.max(
    1,
    Math.ceil(searchedItems.length / priorityPageSize)
  );
  const attendedCount = items.filter(
    item => stateFor(item).status === "done"
  ).length;
  const pendingOnlyCount = items.filter(item => {
    const state = stateFor(item);
    const due = state.dueDate
      ? new Date(`${state.dueDate}T23:59:59`).getTime()
      : 0;
    return state.status === "pending" && !(due && due < Date.now());
  }).length;
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
      <section className="priorities-command">
        <div className="priorities-command-copy">
          <p className="eyebrow">PENDIENTES DEL NEGOCIO</p>
          <h2>¿Qué hago primero hoy?</h2>
          <p>
            {overdueCount
              ? `Tienes ${plural(overdueCount, "pendiente atrasado", "pendientes atrasados")}. Primero atiende a los clientes con calificación Mala; después los cumpleaños y las llamadas.`
              : "No tienes pendientes atrasados. Revisa los cumpleaños y las llamadas de esta semana."}
          </p>
          <div className="priorities-command-actions">
            <button
              className="btn-rojo"
              onClick={() =>
                setStatusFilter(overdueCount ? "Vencidas" : "Pendientes")
              }
            >
              <Clock3 size={15} />{" "}
              {overdueCount
                ? `Resolver ${overdueCount} atrasadas`
                : "Ver pendientes"}
            </button>
            <button
              className="btn-borde"
              onClick={() => setStatusFilter("Todos")}
            >
              Ver todos
            </button>
          </div>
          <div className="priorities-command-kpis">
            <span className="priority-kpi-danger"><b>{overdueCount}</b> atrasadas</span>
            <span><b>{pendingOnlyCount}</b> para hoy</span>
            <span><b>{followupCount}</b> en proceso</span>
            <span><b>{attendedCount}</b> resueltas</span>
          </div>
        </div>
        <aside className="priorities-rule-card">
          <p className="eyebrow">ORDEN PARA ATENDER</p>
          <h3>Qué hacer primero</h3>
          <ol>
            <li><span>1</span> Calificación Mala: llama y pregunta qué pasó.</li>
            <li><span>2</span> Cumpleaños: saluda y ofrece la promo.</li>
            <li><span>3</span> Llamada pendiente: cumple el seguimiento.</li>
            <li><span>4</span> Cliente regular: busca mejorar su experiencia.</li>
          </ol>
          <small>La lista se actualiza con cada encuesta nueva.</small>
        </aside>
      </section>

      <BusinessGuide
        title="Cómo usar tus pendientes"
        steps={[
          "Empieza por las atrasadas: son las que ya pasaron de fecha.",
          "Abre al cliente para revisar qué dijo o para llamarlo.",
          "Cuando termines, marca En proceso o Resuelta. La clave la tiene el encargado.",
        ]}
      />

      <div className="priority-tabs" role="tablist" aria-label="Estado de prioridades">
        {[
          { key: "Vencidas" as const, label: "Atrasadas", count: overdueCount },
          { key: "Pendientes" as const, label: "Sin vencer", count: pendingOnlyCount },
          { key: "En seguimiento" as const, label: "En proceso", count: followupCount },
          { key: "Atendidas" as const, label: "Resueltas", count: attendedCount },
          { key: "Todos" as const, label: "Todas", count: items.length },
        ].map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={statusFilter === tab.key}
            className={statusFilter === tab.key ? "selected" : ""}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label} <span>{tab.count}</span>
          </button>
        ))}
      </div>

      <section className="panel priority-queue-panel">
        <div className="priority-toolbar">
          <div className="priority-type-chips">
            {(
              [
                "Todos",
                "Calidad",
                "Calidad mala",
                "Cumpleaños",
                "Seguimiento",
              ] as const
            ).map(filter => (
              <button
                key={filter}
                className={typeFilter === filter ? "selected" : ""}
                onClick={() => setTypeFilter(filter)}
              >
                {filter === "Calidad"
                  ? "Opinión"
                  : filter === "Calidad mala"
                    ? "Mala"
                    : filter === "Seguimiento"
                      ? "Llamadas"
                      : filter}
              </button>
            ))}
          </div>
          <label className="priority-search">
            <Search size={14} />
            <input
              value={priorityQuery}
              onChange={event => setPriorityQuery(event.target.value)}
              placeholder="Buscar cliente, encargado o detalle…"
            />
          </label>
          <span className="priority-result-count">
            {searchedItems.length} resultado{searchedItems.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="panel-head priority-queue-head">
          <div>
            <p className="eyebrow">PENDIENTES</p>
            <h3>
              {statusFilter === "Todos"
                ? "Todos los pendientes"
                : statusFilter === "Vencidas"
                  ? "Atrasadas: resolver primero"
                  : statusFilter === "Pendientes"
                    ? "Sin vencer"
                    : statusFilter === "En seguimiento"
                      ? "En proceso"
                      : statusFilter === "Atendidas"
                        ? "Resueltas"
                        : statusFilter}
            </h3>
          </div>
          <Pill tone={overdueCount ? "red" : "green"}>
            {overdueCount ? `${overdueCount} atrasadas` : "Sin atrasadas"}
          </Pill>
        </div>

        {searchedItems.length ? (
          <div className="priority-queue">
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
              const expanded = expandedKey === item.key;
              return (
                <article
                  className={`priority-queue-item ${item.tone === "bad" ? "is-critical" : ""} ${done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`}
                  key={item.key}
                >
                  <div className="priority-queue-row">
                    <span className="priority-queue-index">{globalIndex + 1}</span>
                    <span className="priority-queue-icon">{item.icon}</span>
                    <button
                      className="priority-queue-copy"
                      onClick={() =>
                        item.clientKey
                          ? onOpenClient(item.clientKey)
                          : onNavigate("birthdays")
                      }
                    >
                      <span className="priority-queue-title">
                        <span className="priority-type-label">{item.label}</span>
                        <b>{item.title}</b>
                        {overdue && <span className="priority-overdue-badge">ATRASADA</span>}
                        {dueSoon && <span className="priority-soon-badge">PRÓXIMA</span>}
                        {done && <span className="priority-done-badge">RESUELTA</span>}
                      </span>
                      <small>{item.detail}</small>
                      <span className="priority-queue-meta">
                        <span>Para: {formatDate(state.dueDate)}</span>
                        <span>Encargado: {state.responsible || "Sin encargado"}</span>
                        {isFollowup && <span>Llamada pendiente</span>}
                      </span>
                    </button>
                    <div className="priority-queue-actions">
                      <span className={`priority-state-chip ${done ? "done" : inProgress ? "in-progress" : ""}`}>
                        {done ? "Resuelta" : inProgress ? "En proceso" : "Sin empezar"}
                      </span>
                      <button
                        className={`priority-status ${done ? "done" : inProgress ? "in-progress" : ""}`}
                        disabled={saveMutation.isPending}
                        onClick={() =>
                          saveItem(item, {
                            status: nextPriorityStatus(state.status),
                          })
                        }
                        title="Avanzar el estado de este pendiente"
                      >
                        {done ? "Reabrir" : inProgress ? "Resolver" : "Empezar"}
                      </button>
                      <button
                        className="priority-edit-toggle"
                        onClick={() =>
                          setExpandedKey(expanded ? null : item.key)
                        }
                        aria-expanded={expanded}
                      >
                        {expanded ? "Cerrar" : "Editar"}
                      </button>
                      <button
                        className="priority-open"
                        onClick={() =>
                          item.clientKey
                            ? onOpenClient(item.clientKey)
                            : onNavigate("birthdays")
                        }
                        aria-label={`Abrir ${item.title}`}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="priority-expanded">
                      <div className="priority-edit-row">
                        <label>
                          Encargado
                          <select
                            value={state.responsible}
                            onChange={event =>
                              updateDraft(item, {
                                responsible: event.target.value,
                              })
                            }
                          >
                            <option value="">Sin encargado</option>
                            {systemUsers.map(user => (
                              <option
                                key={user.id}
                                value={
                                  user.name ||
                                  user.email ||
                                  `Usuario ${user.id}`
                                }
                              >
                                {user.name ||
                                  user.email ||
                                  `Usuario ${user.id}`}
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
                          Para cuándo
                          <input
                            type="date"
                            value={state.dueDate}
                            onChange={event =>
                              updateDraft(item, {
                                dueDate: event.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          className="priority-save"
                          disabled={saveMutation.isPending}
                          onClick={() => saveItem(item, {})}
                        >
                          {saveMutation.isPending ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                      <PriorityHistory priorityKey={item.key} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty text="No hay prioridades con este filtro." />
        )}

        {notice && (
          <div className="success-notice" role="status">
            ✓ {notice}
          </div>
        )}
        {searchedItems.length > priorityPageSize && (
          <div className="priority-pagination">
            <button
              disabled={priorityPage === 1}
              onClick={() => setPriorityPage(value => Math.max(1, value - 1))}
            >
              Anterior
            </button>
            <span>
              Página {priorityPage} de {priorityPages} · {searchedItems.length}{" "}
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

      {pendingSave && (
        <div
          className="priority-pin-backdrop"
          onClick={cancelSave}
        >
          <div
            className="priority-pin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar cambio de prioridad"
            onClick={event => event.stopPropagation()}
          >
            <p className="eyebrow">CONFIRMAR</p>
            <h3>Escribe la clave del administrador</h3>
            <p className="muted">
              Se guardará <b>{pendingSave.item.title}</b> como{" "}
              {pendingSave.patch.status === "done"
                ? "Atendida"
                : pendingSave.patch.status === "in_progress"
                  ? "En seguimiento"
                  : "Pendiente"}
              .
            </p>
            <small className="priority-pin-help">
              Es la clave de 4 dígitos que usa el encargado. Si no la tienes,
              pídesela.
            </small>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinDraft}
              onChange={event => {
                setPinDraft(event.target.value);
                setPinError("");
              }}
              onKeyDown={event => {
                if (event.key === "Enter") confirmSave();
                if (event.key === "Escape") cancelSave();
              }}
              placeholder="Clave"
              aria-label="Clave del administrador"
            />
            {pinError && <small className="priority-pin-error">{pinError}</small>}
            <div className="priority-pin-actions">
              <button
                className="btn-borde"
                onClick={cancelSave}
              >
                Cancelar
              </button>
              <button
                className="btn-rojo"
                disabled={saveMutation.isPending}
                onClick={confirmSave}
              >
                {saveMutation.isPending ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [segment, setSegment] = useState(() => {
    const saved = localStorage.getItem("coronel.clientsSegment");
    return ["Todos", "En riesgo", "Fiel", "Recurrente", "Nuevo"].includes(
      saved || ""
    )
      ? (saved as string)
      : "Todos";
  });
  useEffect(() => {
    localStorage.setItem("coronel.clientsSegment", segment);
  }, [segment]);
  const segmentLabel = (value: string) =>
    value === "En riesgo"
      ? "Por recuperar"
      : value === "Fiel"
        ? "Frecuentes"
        : value === "Recurrente"
          ? "Repiten"
          : value === "Nuevo"
            ? "Primera vez"
            : value;
  const [birthdayView, setBirthdayView] = useState<"week" | "month">("week");
  const [showAllClients, setShowAllClients] = useState(false);
  const [selected, setSelected] = useState<ClientProfile | null>(null);
  const repeated = profiles.filter(p => p.count > 1).length;
  const faithful = profiles.filter(p => p.segment === "Fiel");
  const recurrent = profiles.filter(p => p.segment === "Recurrente");
  const newClients = profiles.filter(p => p.segment === "Nuevo");
  const risk = profiles.filter(p => p.segment === "En riesgo");
  const visible = profiles
    .filter(p => segment === "Todos" || p.segment === segment)
    .filter(p => {
      const query = normalizeText(search.trim());
      if (!query) return true;
      return normalizeText(`${p.name} ${p.phone} ${p.comment}`).includes(query);
    })
    .sort((a, b) => {
      const segmentRank = (value: string) =>
        value === "En riesgo" ? 0 : value === "Fiel" ? 1 : value === "Recurrente" ? 2 : 3;
      const bySegment = segmentRank(a.segment) - segmentRank(b.segment);
      if (bySegment !== 0) return bySegment;
      return b.count - a.count;
    });
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
  const wasCalled = (record: RecordItem) =>
    logs.some(
      log =>
        clientKeyOf({ phone: log.phone || "", clientName: log.clientName }) ===
        clientKeyOf(record)
    );
  const lastCallFor = (profile: ClientProfile) =>
    logs
      .filter(
        log =>
          clientKeyOf({ phone: log.phone || "", clientName: log.clientName }) ===
          profile.key
      )
      .sort((a, b) => {
        const left = new Date(b.callDate).getTime();
        const right = new Date(a.callDate).getTime();
        return (Number.isNaN(left) ? 0 : left) - (Number.isNaN(right) ? 0 : right);
      })[0];
  if (focusedProfile)
    return (
      <>
        <div className="page-intro priority-detail-intro">
          <div>
            <Pill tone="red">DETALLE DE PRIORIDAD</Pill>
            <h2>{focusedProfile.name}</h2>
            <p>
              {focusedProfile.phone || "Sin teléfono"} ·{" "}
              {segmentLabelFor(focusedProfile.segment)} · {focusedProfile.count} encuesta(s).
              Aquí puedes revisar todo lo que el cliente comentó antes de
              llamar.
            </p>
          </div>
          <button className="back-priority-button" onClick={onBackToPriorities}>
            ← Volver a Prioridades
          </button>
        </div>
        <div className="client-sheet-info priority-detail-info">
          <div>
            <small>TELÉFONO</small>
            <b>
              {focusedProfile.phone ? (
                <a className="client-contact-link" href={`tel:${focusedProfile.phone.replace(/[^\d+]/g, "")}`}>
                  {focusedProfile.phone}
                </a>
              ) : (
                "Sin teléfono"
              )}
            </b>
          </div>
          <div>
            <small>GRUPO</small>
            <b className={focusedProfile.segment === "En riesgo" ? "segment-risk" : ""}>
              {segmentLabelFor(focusedProfile.segment)}
            </b>
          </div>
          <div>
            <small>ENCUESTAS</small>
            <b>{focusedProfile.count}</b>
          </div>
          <div>
            <small>ÚLTIMA ACTUALIZACIÓN</small>
            <b>
              {focusedHistory[0]
                ? formatDateTime(focusedHistory[0].timestamp)
                : "Sin visitas"}
            </b>
          </div>
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
                  <p>
              {record.comment ||
                (record.quality
                  ? `No dejó comentario. Calificó ${record.quality}.`
                  : "No dejó comentario.")}
            </p>
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
                    {noCommentLabel(p)}
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
              Esta vista muestra las respuestas con calidad Mala. Llama y pide
              contexto aunque el cliente no haya dejado comentario.
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
                    {clientSignal(p)}
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
      <section className="clients-command">
        <div className="clients-command-copy">
          <p className="eyebrow">TUS CLIENTES</p>
          <h2>¿A quién puedes llamar hoy?</h2>
          <p>
            Cada encuesta es una visita. Si volvió 3 veces o más es{" "}
            <b>frecuente</b>; si volvió 2, <b>repite</b>; si es su primera vez,{" "}
            <b>es nuevo</b>. “Por recuperar” significa que calificó Malo o
            Regular y conviene llamarlo.
          </p>
          <p className="client-comment-note">
            Un cliente sin comentario no es una queja: solo no dejó texto. La
            calificación es la que indica si hay que llamar.
          </p>
          <div className="clients-command-actions">
            <button
              className="btn-rojo"
              onClick={() => setSegment("En riesgo")}
            >
              <Phone size={15} />{" "}
              {risk.length
                ? `Ver ${risk.length} por recuperar`
                : "Ver todos los clientes"}
            </button>
            <button
              className="btn-borde"
              onClick={() => onNavigate("birthdays")}
            >
              <Cake size={15} /> Ver cumpleaños
            </button>
          </div>
          <div className="clients-command-kpis">
            <span><b>{profiles.length}</b> clientes</span>
            <span><b>{faithful.length}</b> frecuentes</span>
            <span><b>{recurrent.length}</b> repiten</span>
            <span><b>{risk.length}</b> por recuperar</span>
          </div>
        </div>
        <aside className="clients-priority-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LLAMA PRIMERO A</p>
              <h3>Clientes por recuperar</h3>
            </div>
            <span className="clients-priority-count">{risk.length}</span>
          </div>
          {risk.slice(0, 3).map(profile => (
            <button
              className="clients-priority-row"
              key={profile.key}
              onClick={() => setSelected(profile)}
            >
              <Face
                tone={clean(profile.quality) === "malo" ? "bad" : "neutral"}
                size="sm"
              />
              <span>
                <b>{profile.name}</b>
                <small>{clientSignal(profile)}</small>
              </span>
              <Phone size={14} />
            </button>
          ))}
          {!risk.length && (
            <Empty text="No hay clientes en riesgo ahora mismo." />
          )}
          <button
            className="panel-link"
            onClick={() => setSegment("En riesgo")}
          >
            Ver todos los clientes por recuperar <ChevronRight size={15} />
          </button>
        </aside>
      </section>

      <BusinessGuide
        title="Cómo usar tus clientes"
        steps={[
          "Elige un grupo: todos, por recuperar, frecuentes, repiten o primera vez.",
          "Busca al cliente o revisa la lista de prioridad.",
          "Pulsa Registrar para anotar la llamada y el resultado.",
        ]}
      />

      <div className="segment-tabs clients-segments">
        {["Todos", "En riesgo", "Fiel", "Recurrente", "Nuevo"].map(s => (
          <button
            key={s}
            className={segment === s ? "selected" : ""}
            onClick={() => {
              setSegment(s);
              setShowAllClients(false);
            }}
          >
            {segmentLabel(s)}
            <span>
              {s === "Todos"
                ? profiles.length
                : profiles.filter(p => p.segment === s).length}
            </span>
          </button>
        ))}
      </div>

      <div className="clients-workspace">
        <section className="panel clients-list-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CLIENTES · {segmentLabel(segment).toUpperCase()}</p>
              <h3>{visible.length} clientes</h3>
            </div>
            <span className="clients-list-note">
              {repeated} han venido más de una vez
            </span>
          </div>
          {visible.length ? (
            <>
              <div className="clients-list">
                {visible
                  .slice(0, showAllClients ? visible.length : 15)
                  .map(profile => {
                    const lastCall = lastCallFor(profile);
                    return (
                      <button
                        className={`clients-row ${profile.segment === "En riesgo" ? "is-risk" : ""}`}
                        key={profile.key}
                        onClick={() => setSelected(profile)}
                      >
                        <span className="clients-avatar">
                          {profile.name
                            .split(" ")
                            .slice(0, 2)
                            .map(part => part.charAt(0))
                            .join("")
                            .toUpperCase() || "?"}
                        </span>
                        <span className="clients-row-main">
                          <span className="clients-row-title">
                            <b>{profile.name}</b>
                            <Pill
                              tone={
                                profile.segment === "En riesgo"
                                  ? "red"
                                  : profile.segment === "Fiel"
                                    ? "green"
                                    : profile.segment === "Recurrente"
                                      ? "purple"
                                      : "blue"
                              }
                            >
                              {segmentLabelFor(profile.segment)}
                            </Pill>
                          </span>
                          <small>
                            {profile.phone || "Sin teléfono"} ·{" "}
                            {noCommentLabel(profile)}
                          </small>
                          <span className="clients-row-meta">
                            <span>{profile.count} visita{profile.count === 1 ? "" : "s"}</span>
                            <span>Última opinión: {profile.quality || "Sin dato"}</span>
                            <span>
                              {lastCall
                                ? `Última llamada ${formatDate(lastCall.callDate)}`
                                : "Sin llamadas"}
                            </span>
                          </span>
                          {profile.comment?.trim() ? (
                            <small className="clients-last-comment">
                              “{profile.comment}”
                            </small>
                          ) : (
                            <small className="clients-last-comment is-empty">
                              Sin comentario registrado.
                            </small>
                          )}
                        </span>
                        <span className="clients-row-action">
                          <Phone size={14} />
                          <span className="clients-row-action-label">Registrar</span>
                        </span>
                      </button>
                    );
                  })}
              </div>
              {visible.length > 15 && !showAllClients && (
                <button
                  className="clients-load-more"
                  onClick={() => setShowAllClients(true)}
                >
                  Ver los {visible.length - 15} restantes <ChevronDown size={15} />
                </button>
              )}
            </>
          ) : (
            <Empty text="No hay clientes en este segmento con la búsqueda actual." />
          )}
        </section>
        <aside className="clients-side">
          <section className="panel clients-birthday-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">AGENDA</p>
                <h3>Cumpleaños</h3>
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
              displayBirthdays.slice(0, 4).map(r => (
                <div className="birthday-row" key={r.id}>
                  <span className="birthday-date">{formatBirthday(r.birthday)}</span>
                  <span>
                    <b>{r.clientName || "Cliente sin nombre"}</b>
                    <small>{r.phone || "Sin teléfono"}</small>
                  </span>
                  {wasCalled(r) && <Pill tone="green">Llamado</Pill>}
                  <button
                    className="clients-mini-call"
                    onClick={() =>
                      setSelected(
                        profiles.find(p => p.key === clientKeyOf(r)) ?? null
                      )
                    }
                    aria-label={`Registrar llamada de ${r.clientName || "cliente"}`}
                  >
                    <Phone size={13} />
                  </button>
                </div>
              ))
            ) : (
              <Empty text="No hay cumpleaños próximos." />
            )}
            <button className="panel-link" onClick={() => onNavigate("birthdays")}>
              Abrir agenda de cumpleaños <ChevronRight size={15} />
            </button>
          </section>
          <section className="panel clients-calls-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">SEGUIMIENTO</p>
                <h3>Últimas llamadas</h3>
              </div>
              <Pill tone="blue">{logs.length}</Pill>
            </div>
            {logs.slice(0, 3).map(log => (
              <div className="call-history-row" key={log.id}>
                <Phone size={14} />
                <span>
                  <b>{log.clientName}</b>
                  <small>
                    {formatDateTime(log.callDate)} · {log.outcome}
                    {log.nextCallDate
                      ? ` · Próxima: ${formatDateTime(log.nextCallDate)}`
                      : ""}
                  </small>
                </span>
              </div>
            ))}
            {!logs.length && (
              <Empty text="Aún no hay llamadas registradas." />
            )}
          </section>
        </aside>
      </div>
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

function QuickCallPicker({
  profiles,
  onClose,
  onSelect,
  initialQuery = "",
}: {
  profiles: ClientProfile[];
  onClose: () => void;
  onSelect: (profile: ClientProfile) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const dialogRef = useDialogFocus(true, onClose);
  const search = normalizeText(query.trim());
  const results = profiles
    .filter(profile => {
      if (!search) return true;
      return normalizeText(
        `${profile.name} ${profile.phone || ""} ${profile.segment}`
      ).includes(search);
    })
    .sort((a, b) => {
      const rank = (value: string) => (value === "En riesgo" ? 0 : 1);
      return rank(a.segment) - rank(b.segment) || b.count - a.count;
    })
    .slice(0, 10);

  return createPortal(
    <div className="quick-call-backdrop" onClick={onClose}>
      <div
        className="quick-call-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Elegir cliente para registrar llamada"
        onClick={event => event.stopPropagation()}
      >
        <div className="quick-call-head">
          <div>
            <p className="eyebrow">REGISTRAR LLAMADA</p>
            <h3>¿A quién llamaste?</h3>
            <p className="muted">
              Busca por nombre o teléfono. Primero aparecen los clientes por
              recuperar.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <label className="quick-call-search">
          <Search size={15} />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Nombre o teléfono del cliente…"
          />
        </label>
        <div className="quick-call-results">
          {results.map(profile => (
            <button
              className="quick-call-result"
              key={profile.key}
              onClick={() => onSelect(profile)}
            >
              <span className="clients-avatar">
                {profile.name
                  .split(" ")
                  .slice(0, 2)
                  .map(part => part.charAt(0))
                  .join("")
                  .toUpperCase() || "?"}
              </span>
              <span>
                <b>{profile.name}</b>
                <small>
                  {profile.phone || "Sin teléfono"} ·{" "}
                  {segmentLabelFor(profile.segment)}
                </small>
              </span>
              <span className="quick-call-pick">Elegir</span>
            </button>
          ))}
          {!results.length && (
            <Empty text="No encontré un cliente con ese nombre o teléfono." />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function CallLogForm({
  profile,
  onClose,
  initialPromotion,
  campaignStage,
  campaignChannel,
  logs = [],
  onSaved,
}: {
  profile: ClientProfile;
  onClose: () => void;
  initialPromotion?: string;
  campaignStage?: CampaignStage;
  campaignChannel?: CampaignChannel;
  logs?: CallLog[];
  onSaved?: (
    profile: ClientProfile,
    meta?: { priorityResolved: boolean }
  ) => void;
}) {
  const utils = trpc.useUtils();
  const promotionsQuery = trpc.promotions.list.useQuery();
  const responsibleQuery = trpc.responsibleUsers.list.useQuery();
  const priorityKey =
    profile.segment === "En riesgo" ? `risk-${profile.key}` : undefined;
  const create = trpc.calls.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.calls.list.invalidate(),
        utils.birthdayCampaigns.list.invalidate(),
        utils.priorities.list.invalidate(),
      ]);
      onSaved?.(profile, {
        priorityResolved: Boolean(priorityKey) && resolvesPriority,
      });
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
  const resolvesPriority =
    Boolean(priorityKey) && !/no contest|inválid|invald/i.test(outcome);
  const dialogRef = useDialogFocus(true, onClose);
  const clientLogs = logs
    .filter(log => log.clientKey === profile.key)
    .sort(
      (a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime()
    );
  return createPortal(
    <div
      className="modal-backdrop call-modal-backdrop"
      onClick={event => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="call-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar llamada"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">SEGUIMIENTO DE CONTACTO</p>
            <h3>{profile.name}</h3>
            <p className="muted">
              {profile.phone ? (
                <a className="call-phone-link" href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>
                  ☎ {profile.phone}
                </a>
              ) : (
                "Sin teléfono"
              )}{" "}
              · {segmentLabelFor(profile.segment)} · {profile.count} encuesta(s)
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
              <span>{plural(clientLogs.length, "registro", "registros")}</span>
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
            <option value="">Sin encargado</option>
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
        {resolvesPriority && (
          <p className="call-priority-note">
            ✓ Al guardar, la prioridad de este cliente se marcará como resuelta.
          </p>
        )}
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
                resolvePriorityKey: resolvesPriority ? priorityKey : undefined,
              })
            }
          >
            {create.isPending ? "Guardando…" : "Guardar seguimiento"}
          </Button>
        </div>
        {create.error && <p className="form-error">{create.error.message}</p>}
      </div>
    </div>
    ,
    document.body
  );
}

function categoryLabel(category: PromotionItem["category"]) {
  return category === "recuperacion"
    ? "Para recuperar clientes"
    : category === "cumpleanos"
      ? "Para cumpleaños"
      : category === "fidelidad"
        ? "Para clientes fieles"
        : "Para cualquier cliente";
}
function PromotionsAdmin({
  promotions,
  audit,
}: {
  promotions: PromotionItem[];
  audit: AuditItem[];
}) {
  const utils = trpc.useUtils();
  const askPin = useAdminPin();
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
  const saveEdit = async (item: PromotionItem) => {
    const draft = drafts[item.id];
    if (!draft?.name.trim()) return;
    const pin = await askPin("Guardar el cambio de esta promoción.");
    if (!pin) return;
    update.mutate(
      {
        id: item.id,
        name: draft.name.trim(),
        category: draft.category,
        active: item.active,
        adminPin: pin,
      },
      { onSuccess: () => setEditing(null) }
    );
  };
  const toggle = async (item: PromotionItem) => {
    const pin = await askPin(
      item.active
        ? "Desactivar esta promoción: dejará de aparecer al registrar llamadas."
        : "Activar esta promoción para poder ofrecerla."
    );
    if (!pin) return;
    update.mutate({
      id: item.id,
      name: item.name,
      category: item.category,
      active: item.active ? 0 : 1,
      adminPin: pin,
    });
  };
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="purple">PROMOCIONES</Pill>
          <h2>Tus promociones.</h2>
          <p>
            Elige qué ofrecer cuando llamas o escribes a un cliente. Puedes
            cambiarlas en cualquier momento.
          </p>
        </div>
        <div className="intro-note">
          <Sparkles size={17} />
          <span>
            <b>Solo el administrador puede cambiarlas</b>
            <small>
              Al guardar te pediremos la clave. El cambio se ve en todos los
              dispositivos.
            </small>
          </span>
        </div>
      </div>
      <section className="panel admin-table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PROMOCIONES DISPONIBLES</p>
            <h3>Lo que puedes ofrecer</h3>
          </div>
          <div className="promotion-head-actions">
            <button
              className="secondary-action"
              onClick={() =>
                document
                  .getElementById("promotion-create")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              + Nueva promoción
            </button>
            <Pill tone="purple">
              {promotions.filter(item => item.active).length} activas de{" "}
              {promotions.length}
            </Pill>
          </div>
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
                    <option value="recuperacion">Para recuperar clientes</option>
                    <option value="cumpleanos">Para cumpleaños</option>
                    <option value="fidelidad">Para clientes fieles</option>
                    <option value="general">Para cualquier cliente</option>
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
                        {item.active ? "Desactivar" : "Activar"}
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
            ✓ Promoción guardada. Ya está disponible para ofrecer.
          </div>
        )}
      </section>
      <section className="panel admin-add-panel" id="promotion-create">
        <div className="panel-head">
          <div>
            <p className="eyebrow">NUEVA PROMOCIÓN</p>
            <h3>Crear una promoción</h3>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            ¿Qué ofreces?
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ej. 20% en la próxima visita"
            />
          </label>
          <label>
            ¿Para quién es?
            <select
              value={category}
              onChange={event =>
                setCategory(event.target.value as PromotionItem["category"])
              }
            >
              <option value="recuperacion">Para recuperar clientes</option>
              <option value="cumpleanos">Para cumpleaños</option>
              <option value="fidelidad">Para clientes fieles</option>
              <option value="general">Para cualquier cliente</option>
            </select>
          </label>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={async () => {
              const pin = await askPin("Crear esta promoción.");
              if (pin)
                save.mutate({ name: name.trim(), category, adminPin: pin });
            }}
          >
            {save.isPending ? "Guardando…" : "Crear promoción"}
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
  onRegisterCall,
}: {
  logs: CallLog[];
  search: string;
  promotions: PromotionItem[];
  isAdmin: boolean;
  onNavigate: (page: Page) => void;
  onRegisterCall: (query?: string) => void;
}) {
  const [outcome, setOutcome] = useState("Todos");
  const [redeemed, setRedeemed] = useState("Todos");
  const [promotion, setPromotion] = useState("Todas");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const utils = trpc.useUtils();
  const [editLog, setEditLog] = useState<CallLog | null>(null);
  const [pinAction, setPinAction] = useState<
    { type: "edit"; log: CallLog } | { type: "delete"; log: CallLog } | null
  >(null);
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState("");
  const pinDialogRef = useDialogFocus(Boolean(pinAction), () => {
    setPinAction(null);
    setPinDraft("");
    setPinError("");
  });
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
  const requestEditSave = () => {
    if (!editLog) return;
    setPinAction({ type: "edit", log: editLog });
    setPinDraft("");
    setPinError("");
  };
  const requestDelete = (log: CallLog) => {
    setPinAction({ type: "delete", log });
    setPinDraft("");
    setPinError("");
  };
  const confirmCallPin = () => {
    if (!pinAction) return;
    if (pinDraft.trim() !== "5956") {
      setPinError("Clave incorrecta. Intenta de nuevo.");
      return;
    }
    if (pinAction.type === "delete") {
      removeCall.mutate({ id: pinAction.log.id, adminPin: pinDraft.trim() });
    } else if (editLog) {
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
        adminPin: pinDraft.trim(),
      });
    }
    setPinAction(null);
    setPinDraft("");
    setPinError("");
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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const scheduledCalls = logs
    .flatMap(log => {
      if (!log.nextCallDate) return [];
      const date = new Date(log.nextCallDate);
      if (Number.isNaN(date.getTime())) return [];
      return [{ log, date }];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcomingCalls = scheduledCalls.filter(item => item.date >= todayStart);
  const overdueCalls = scheduledCalls.filter(item => item.date < todayStart);
  const callExportColumns = [
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
    "Asignado a",
    "Etapa campaña",
    "Canal campaña",
  ];
  const [callsPdfPreview, setCallsPdfPreview] = useState<ExportPreviewData | null>(null);
  const callExportRows = visible.map(log => [
    formatDateTime(log.callDate),
    log.clientName,
    log.phone,
    log.outcome,
    log.promotion,
    log.promotionRedeemed ? "Sí" : "No",
    log.recoveryResult,
    log.nextCallDate ? formatDate(log.nextCallDate) : "",
    log.notes,
    log.createdBy,
    log.assignedTo,
    log.campaignStage,
    log.campaignChannel,
  ]);
  const exportCalls = () =>
    downloadGenericCsv(
      `historial-llamadas-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      callExportColumns,
      callExportRows
    );
  const exportCallsPdf = () =>
    setCallsPdfPreview({
      title: "Historial de llamadas",
      subtitle: `${visible.length} llamadas · ${fromDate || "inicio"} a ${toDate || "hoy"}`,
      columns: callExportColumns,
      rows: callExportRows,
      dates: visible.map(log => parseDate(String(log.callDate))),
      filename: `historial-llamadas-coronel-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="blue">SEGUIMIENTO</Pill>
          <h2>Llamadas y seguimientos.</h2>
          <p>
            Aquí ves a quién llamaste, qué le ofreciste y cuándo volver a
            contactarlo. El buscador de arriba también filtra esta lista.
          </p>
        </div>
        <div className="calls-page-note">
          <small>
            {plural(visible.length, "registro visible", "registros visibles")} de{" "}
            {logs.length} guardados
          </small>
        </div>
      </div>
      <PageHint title="Toca las tarjetas para bajar al historial." />
      <section className="panel calls-agenda-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">AGENDA</p>
            <h3>Próximas llamadas</h3>
          </div>
          <Pill tone={overdueCalls.length ? "red" : "green"}>
            {overdueCalls.length
              ? plural(overdueCalls.length, "atrasada", "atrasadas")
              : plural(upcomingCalls.length, "programada", "programadas")}
          </Pill>
        </div>
        {overdueCalls.length > 0 && (
          <div className="calls-overdue-note">
            Tienes {plural(overdueCalls.length, "llamada atrasada", "llamadas atrasadas")}.
            Empieza por ellas.
          </div>
        )}
        {scheduledCalls.length ? (
          <div className="calls-agenda-list">
            {[...overdueCalls, ...upcomingCalls].slice(0, 4).map(({ log, date }) => (
              <div className={`calls-agenda-row ${date < todayStart ? "is-overdue" : ""}`} key={log.id}>
                <span className="calls-agenda-date">
                  <b>{String(date.getDate()).padStart(2, "0")}</b>
                  <small>
                    {new Intl.DateTimeFormat("es-PE", { month: "short" })
                      .format(date)
                      .replace(".", "")}
                  </small>
                </span>
                <span className="calls-agenda-copy">
                  <b>{log.clientName || "Cliente sin nombre"}</b>
                  <small>
                    {log.phone || "Sin teléfono"} ·{" "}
                    {log.nextCallDate
                      ? formatDateTime(log.nextCallDate)
                      : "Sin fecha"}
                  </small>
                </span>
                <button
                  className="calls-agenda-action"
                  onClick={() => onRegisterCall(log.clientName)}
                >
                  <Phone size={13} /> Registrar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No tienes llamadas programadas. Registra una cuando termines un contacto." />
        )}
        <button className="panel-link" onClick={() => onRegisterCall()}>
          Registrar una llamada <ChevronRight size={15} />
        </button>
      </section>
      <div className="stats-grid">
        <Stat
          label="LLAMADAS"
          value={visible.length}
          detail="en este período"
          icon={Phone}
          onClick={() =>
            document
              .getElementById("calls-history-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
        <Stat
          label="CONTACTADOS"
          value={contacted}
          detail="con contacto logrado"
          accent="green"
          icon={Users}
          onClick={() =>
            document
              .getElementById("calls-history-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
        <Stat
          label="RECUPERADOS"
          value={recovered}
          detail="con recuperación registrada"
          accent="purple"
          icon={Sparkles}
          onClick={() =>
            document
              .getElementById("calls-history-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      </div>
      <section className="panel calls-history-panel" id="calls-history-panel">
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
            <button onClick={exportCallsPdf}>
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>
        {visible.length ? (
          <div className="table-wrap calls-table-wrap">
            <table className="calls-table">
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
                    <td data-label="Fecha">{formatDateTime(log.callDate)}</td>
                    <td data-label="Cliente">
                      <b>{log.clientName}</b>
                      <small className="table-sub">
                        {log.phone || "Sin teléfono"}
                      </small>
                    </td>
                    <td data-label="Resultado">{log.outcome}</td>
                    <td data-label="Promoción">
                      {log.promotion || "—"}
                      <small className="table-sub">
                        {log.promotion
                          ? log.promotionRedeemed
                            ? "Redimida"
                            : "No redimida"
                          : ""}
                      </small>
                    </td>
                    <td data-label="Seguimiento">
                      {log.recoveryResult || "Pendiente"}
                      <small className="table-sub">
                        {log.nextCallDate
                          ? `Próxima: ${formatDateTime(log.nextCallDate)}`
                          : "Sin próxima fecha"}
                      </small>
                    </td>
                    <td data-label="Notas">{log.notes || "—"}</td>
                    <td data-label="Registró / Responsable">
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
                          onClick={() => requestDelete(log)}
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
          <Empty text="Todavía no hay llamadas registradas con estos filtros." />
        )}
      </section>
      {editLog && createPortal(
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
              El cambio queda guardado. Te pediremos la clave de administrador.
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
                onClick={requestEditSave}
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
        ,
        document.body
      )}
      {pinAction && (
        <div
          className="priority-pin-backdrop"
          onClick={() => {
            setPinAction(null);
            setPinDraft("");
            setPinError("");
          }}
        >
          <div
            className="priority-pin-modal"
            ref={pinDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar cambio de llamada"
            onClick={event => event.stopPropagation()}
          >
            <p className="eyebrow">CONFIRMAR</p>
            <h3>
              {pinAction.type === "delete"
                ? "Eliminar llamada"
                : "Guardar cambios de la llamada"}
            </h3>
            <p className="muted">
              {pinAction.type === "delete"
                ? `Se eliminará el registro de ${pinAction.log.clientName || "este cliente"} del ${formatDateTime(pinAction.log.callDate)}.`
                : `Se actualizará el registro de ${pinAction.log.clientName || "este cliente"}.`}
            </p>
            <small className="priority-pin-help">
              Escribe la clave de 4 dígitos del administrador.
            </small>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinDraft}
              onChange={event => {
                setPinDraft(event.target.value);
                setPinError("");
              }}
              onKeyDown={event => {
                if (event.key === "Enter") confirmCallPin();
                if (event.key === "Escape") {
                  setPinAction(null);
                  setPinDraft("");
                  setPinError("");
                }
              }}
              placeholder="Clave"
              aria-label="Clave del administrador"
            />
            {pinError && <small className="priority-pin-error">{pinError}</small>}
            <div className="priority-pin-actions">
              <button
                className="btn-borde"
                onClick={() => {
                  setPinAction(null);
                  setPinDraft("");
                  setPinError("");
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-rojo"
                disabled={updateCall.isPending || removeCall.isPending}
                onClick={confirmCallPin}
              >
                {updateCall.isPending || removeCall.isPending
                  ? "Guardando…"
                  : pinAction.type === "delete"
                    ? "Eliminar"
                    : "Confirmar"}
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
  const askPin = useAdminPin();
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
  const submit = async () => {
    if (!name.trim()) return;
    const pin = await askPin("Agregar este encargado a los seguimientos.");
    if (!pin) return;
    save.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      active: 1,
      adminPin: pin,
    });
  };
  const saveEdit = async (user: ResponsibleUser) => {
    if (!draft.name.trim()) return;
    const pin = await askPin("Guardar los datos de este encargado.");
    if (!pin) return;
    update.mutate({
      id: user.id,
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      active: user.active,
      adminPin: pin,
    });
  };
  const toggle = async (user: ResponsibleUser) => {
    const pin = await askPin(
      user.active
        ? "Marcar a esta persona como no disponible para nuevos seguimientos."
        : "Volver a marcar a esta persona como disponible."
    );
    if (!pin) return;
    update.mutate({
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active ? 0 : 1,
      adminPin: pin,
    });
  };
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="orange">EQUIPO</Pill>
          <h2>Encargados de seguimiento.</h2>
          <p>
            Elige quién aparece como responsable cuando asignas una llamada o un
            pendiente.
          </p>
        </div>
        <div className="intro-note">
          <Users size={17} />
          <span>
            <b>Solo el administrador puede cambiarlo</b>
            <small>
              Para agregar o editar un encargado te pediremos la clave.
            </small>
          </span>
        </div>
      </div>
      <section className="panel admin-add-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">NUEVO ENCARGADO</p>
            <h3>Agregar encargado</h3>
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
            Correo (opcional)
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="usuario@coronel.pe"
              type="email"
            />
          </label>
          <Button disabled={!name.trim() || save.isPending} onClick={submit}>
            Agregar encargado
          </Button>
        </div>
        {save.error && <p className="form-error">{save.error.message}</p>}
        {(save.isSuccess || update.isSuccess) && (
          <div className="success-notice">
            ✓ Encargado guardado. Ya está disponible para asignar.
          </div>
        )}
      </section>
      <section className="panel admin-table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ENCARGADOS</p>
            <h3>Quiénes pueden recibir seguimientos</h3>
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
                      {user.active ? "Disponible" : "No disponible"}
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
                      {user.active ? "No disponible" : "Disponible"}
                    </button>
                  </>
                )}
              </div>
            ))
          ) : (
            <Empty text="Aún no hay encargados. Agrega el primero arriba." />
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
  const monthStats = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; surveys: number; answered: number; good: number }
    >();
    records.forEach(record => {
      const date = parseDate(record.timestamp);
      if (!date) return;
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if ((fromDate && day < fromDate) || (toDate && day > toDate)) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = map.get(key) ?? {
        key,
        label: new Intl.DateTimeFormat("es-PE", {
          month: "long",
          year: "numeric",
        }).format(date),
        surveys: 0,
        answered: 0,
        good: 0,
      };
      current.surveys += 1;
      const quality = clean(record.quality);
      if (["bueno", "regular", "malo"].includes(quality)) {
        current.answered += 1;
        if (quality === "bueno") current.good += 1;
      }
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [records, fromDate, toDate]);
  const latestMonth = monthStats[monthStats.length - 1];
  const previousMonth = monthStats[monthStats.length - 2];
  const latestPct =
    latestMonth && latestMonth.answered
      ? Math.round((latestMonth.good / latestMonth.answered) * 100)
      : null;
  const previousPct =
    previousMonth && previousMonth.answered
      ? Math.round((previousMonth.good / previousMonth.answered) * 100)
      : null;
  const qualityDelta =
    latestPct !== null && previousPct !== null ? latestPct - previousPct : null;
  const latestTarget = [...history].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  )[0];
  const targetPct = latestTarget?.positiveQualityPercent ?? null;
  const serverTotals = rows.reduce<Record<string, { surveys: number; answered: number; good: number }>>(
    (acc, row) => {
      acc[row.server] ??= { surveys: 0, answered: 0, good: 0 };
      acc[row.server].surveys += row.surveys;
      acc[row.server].answered += row.answered;
      acc[row.server].good += row.good;
      return acc;
    },
    {}
  );
  const topServer = Object.entries(serverTotals).sort(
    (a, b) => b[1].surveys - a[1].surveys
  )[0];
  const historyExportColumns = [
    "Mes",
    "Equipo/Mesero",
    "Encuestas",
    "Calidad respondida",
    "Calidad positiva",
  ];
  const [historyPdfPreview, setHistoryPdfPreview] = useState<ExportPreviewData | null>(null);
  const historyExportRows = rows.map(row => [
    row.month,
    row.server,
    row.surveys,
    row.answered,
    row.positive === null ? "" : `${row.positive}%`,
  ]);
  const exportHistory = () =>
    downloadGenericCsv(
      `historial-metas-coronel-${new Date().toISOString().slice(0, 10)}.csv`,
      historyExportColumns,
      historyExportRows
    );
  const exportHistoryPdf = () =>
    setHistoryPdfPreview({
      title: "Historial de metas",
      subtitle: `${rows.length} registros · ${fromDate || "inicio"} a ${toDate || "hoy"}`,
      columns: historyExportColumns,
      rows: historyExportRows,
      filename: `historial-metas-coronel-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  return (
    <>
      <div className="page-intro admin-page-intro">
        <div>
          <Pill tone="green">METAS</Pill>
          <h2>Cómo han cambiado las metas.</h2>
          <p>
            Mira cómo cambió el desempeño por mes y por persona, y qué metas se
            ajustaron en el camino.
          </p>
        </div>
        <div className="intro-note">
          <Clock3 size={17} />
          <span>
            <b>Cómo leer los datos</b>
            <small>
              Solo contamos respuestas Bueno, Regular o Malo. Cada cambio de
              meta queda guardado con fecha y persona.
            </small>
          </span>
        </div>
      </div>
      <PageHint title="Toca una tarjeta o barra para ver los resultados." />
      <section className="insights-section">
        <div className="insights-head">
          <div>
            <p className="eyebrow">INSIGHTS DE HISTORIAL</p>
            <h2>Cómo va el negocio</h2>
          </div>
          <p>Sin tablas primero: conclusión, evidencia y contexto.</p>
        </div>
        <div className="insights-grid">
          <InsightCard
            label="CALIDAD VS META"
            tone={
              latestPct === null
                ? "neutral"
                : targetPct === null || latestPct >= targetPct
                  ? "positive"
                  : "warning"
            }
            icon={Sparkles}
            title={
              latestPct === null
                ? "Sin calidad en el período"
                : `${latestPct}% de clientes satisfechos`
            }
            evidence={
              latestMonth
                ? `${latestMonth.label} · ${
                    targetPct === null
                      ? "sin meta registrada"
                      : `meta ${targetPct}%`
                  } · ${latestMonth.answered} respuestas calificadas.`
                : "No hay respuestas calificadas en el rango seleccionado."
            }
            action="Ver resultados"
            onClick={() =>
              document
                .getElementById("history-results")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
          <InsightCard
            label="TENDENCIA"
            tone={
              qualityDelta === null
                ? "neutral"
                : qualityDelta >= 0
                  ? "positive"
                  : "critical"
            }
            icon={Clock3}
            title={
              qualityDelta === null
                ? "Sin mes anterior comparable"
                : `${qualityDelta >= 0 ? "+" : ""}${qualityDelta} puntos vs. mes anterior`
            }
            evidence={
              latestPct !== null && previousPct !== null
                ? `Pasó de ${previousPct}% a ${latestPct}% entre ${previousMonth?.label} y ${latestMonth?.label}.`
                : "Se necesitan al menos dos meses con respuestas para medir tendencia."
            }
          />
          <InsightCard
            label="QUIÉN ATIENDE MÁS"
            tone={topServer ? "neutral" : "warning"}
            icon={UserRoundCheck}
            title={topServer?.[0] || "Sin volumen por mesero"}
            evidence={
              topServer
                ? `${topServer[1].surveys} encuestas · ${
                    topServer[1].answered
                      ? Math.round((topServer[1].good / topServer[1].answered) * 100)
                      : 0
                  }% positivo.`
                : "No hay encuestas asociadas a meseros en el período."
            }
            action="Ver tabla"
            onClick={() =>
              document
                .getElementById("history-results")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
        </div>
      </section>
      <section className="panel team-date-filter target-history-filter">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PERÍODO</p>
            <h3>Elegir fechas</h3>
            <small className="muted">
              {plural(rows.length, "grupo equipo/mes visible", "grupos equipo/mes visibles")}.
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
      <section className="panel admin-table-panel" id="history-results">
        <div className="panel-head">
          <div>
            <p className="eyebrow">DESEMPEÑO POR EQUIPO / MESERO</p>
            <h3>Resultados observados</h3>
          </div>
          <div className="export-group">
            <button onClick={exportHistory}>
              <Download size={14} /> CSV
            </button>
            <button onClick={exportHistoryPdf}>
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
          <p className="eyebrow">CAMBIOS RECIENTES</p>
          <h3>Qué se cambió y quién lo hizo</h3>
        </div>
        <Pill tone="neutral">{plural(audit.length, "cambio", "cambios")}</Pill>
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
            Elige un mes para ver cuántas encuestas hizo cada persona.
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
            .map(row => {
              const good = row.positive === null ? 0 : Math.round((row.positive / 100) * row.surveys);
              const ci = row.positive === null ? null : wilsonInterval(good, row.surveys);
              return (
              <button
                className="target-bar-row"
                key={row.server}
                title={`${row.server}: ${row.surveys} encuestas · ${row.positive === null ? "sin calidad" : `${row.positive}% positivo · IC95 ${ci ? `${Math.round(ci[0] * 100)}–${Math.round(ci[1] * 100)}%` : "—"}`}`}
                onClick={() => {
                  const target =
                    document.getElementById("history-results") ||
                    document.getElementById("team-scorecard");
                  target?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
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
              );
            })}
        </div>
      ) : (
        <Empty text="No hay datos de meseros para graficar." />
      )}
    </section>
  );
}

function Voice({
  comments,
  reviewRecords,
  reviewCount,
  topicPhrases,
  positiveHighlights,
  negativeHighlights,
  positive,
  positiveCount,
}: {
  comments: RecordItem[];
  reviewRecords: RecordItem[];
  reviewCount: number;
  topicPhrases: [string, number][];
  positiveHighlights: SentimentHighlight[];
  negativeHighlights: SentimentHighlight[];
  positive: number;
  positiveCount: number;
}) {
  const [selected, setSelected] = useState<SentimentHighlight | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
  const [commentSheet, setCommentSheet] = useState<
    | {
        kind: "review" | "repeated" | "last";
        title: string;
        subtitle: string;
        items?: RecordItem[];
      }
    | null
  >(null);
  const phraseMatches = useMemo(() => {
    if (!selectedPhrase) return [];
    const tokens = normalizeText(selectedPhrase)
      .split(/\s+/)
      .filter(token => token.length > 2);
    return comments.filter(record => {
      const text = normalizeText(record.comment);
      return tokens.length
        ? tokens.every(token => text.includes(token))
        : text.includes(normalizeText(selectedPhrase));
    });
  }, [comments, selectedPhrase]);
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
  const topPositive = positiveHighlights[0];
  const topNegative = negativeHighlights[0];
  const topRequest = requestTags[0];
  const openPhrase = (phrase: string) => {
    setSelectedPhrase(phrase);
    window.setTimeout(() => {
      document
        .getElementById("voice-topics")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };
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
      <section className="insights-section">
        <div className="insights-head">
          <div>
            <p className="eyebrow">INSIGHTS DE VOZ</p>
            <h2>Lo que dicen los clientes</h2>
          </div>
          <p>Primero la conclusión; abajo el detalle.</p>
        </div>
        <div className="insights-grid">
          <InsightCard
            label="LO QUE FUNCIONA"
            tone="positive"
            icon={Sparkles}
            title={
              topPositive
                ? `“${topPositive.word}” es la señal más positiva`
                : "Aún sin muestra suficiente"
            }
            evidence={
              topPositive
                ? `${topPositive.count} menciones en ${comments.length} comentarios con texto.`
                : "Cuando haya más comentarios, aquí aparecerá lo que más valoran."
            }
            action={topPositive ? "Ver menciones" : undefined}
            onClick={topPositive ? () => setSelected(topPositive) : undefined}
          />
          <InsightCard
            label="LO QUE MEJORAR"
            tone="critical"
            icon={AlertTriangle}
            title={
              topNegative
                ? `“${topNegative.word}” es lo que más se repite`
                : "Sin señales negativas repetidas"
            }
            evidence={
              topNegative
                ? `${topNegative.count} menciones. Revisa esos comentarios antes de actuar.`
                : "No hay suficientes comentarios negativos para sacar una conclusión."
            }
            action={topNegative ? "Ver comentarios" : undefined}
            onClick={topNegative ? () => setSelected(topNegative) : undefined}
          />
          <InsightCard
            label="LO QUE PIDEN"
            tone="warning"
            icon={MessageSquareText}
            title={
              topRequest
                ? `“${topRequest[0]}” es el pedido más frecuente`
                : "Aún no hay pedidos detectados"
            }
            evidence={
              topRequest
                ? `${topRequest[1]} comentarios con esta petición.`
                : "Las sugerencias aparecerán aquí cuando se repitan."
            }
            action={topRequest ? "Ver pedidos" : undefined}
            onClick={
              topRequest
                ? () =>
                    document
                      .getElementById("voice-requests")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                : undefined
            }
          />
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          label="COMENTARIOS"
          value={comments.length}
          detail="con texto"
          icon={MessageSquareText}
          onClick={() =>
            document
              .getElementById("voice-repeated")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
        <Stat
          label="FRASES REPETIDAS"
          value={topicPhrases.length}
          detail="2+ apariciones"
          accent="purple"
          icon={Sparkles}
          onClick={() =>
            document
              .getElementById("voice-topics")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
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
          onClick={() =>
            setCommentSheet({
              kind: "last",
              title: "Último comentario",
              subtitle: comments.length ? "Comentario más reciente" : "Sin comentarios",
              items: comments.length ? [comments[comments.length - 1]] : [],
            })
          }
        />
        <Stat
          label="PARA REVISAR"
          value={reviewCount}
          detail="asociados a alerta"
          accent="red"
          icon={AlertTriangle}
          onClick={() =>
            setCommentSheet({
              kind: "review",
              title: "Para revisar",
              subtitle: `${reviewRecords.length} respuestas con calidad Regular o Mala`,
              items: reviewRecords,
            })
          }
        />
        <Stat
          label="COMENTARIOS REPETIDOS"
          value={repeatedComments.length}
          detail="frases que se repiten"
          accent="purple"
          icon={MessageSquareText}
          onClick={() =>
            setCommentSheet({
              kind: "repeated",
              title: "Comentarios repetidos",
              subtitle: `${repeatedComments.length} frases agrupadas`,
            })
          }
        />
        <Stat
          label="PEDIDOS"
          value={requestComments.length}
          detail="sugerencias detectadas"
          accent="orange"
          icon={Sparkles}
          onClick={() =>
            document
              .getElementById("voice-requests")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />      </div>
      <div className="dashboard-grid voice-grid">
        <section className="panel" id="voice-repeated">
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
                <button
                  type="button"
                  className="voice-list-item voice-list-button"
                  key={item.text}
                  onClick={() => openPhrase(item.text)}
                >
                  <span className="voice-count">×{item.count}</span>
                  <p>{item.text}</p>
                  <ChevronRight size={14} />
                </button>
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
        <section className="panel" id="voice-requests">
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
                <button
                  type="button"
                  className="voice-list-item voice-list-button"
                  key={`${record.id}-${record.timestamp}`}
                  onClick={() => openPhrase(record.comment)}
                >
                  <span className="voice-tag">
                    {requestTag(record.comment)}
                  </span>
                  <p>{record.comment}</p>
                  <ChevronRight size={14} />
                </button>
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
              <p className="eyebrow">LO QUE HAY QUE MEJORAR</p>
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
        <section className="panel topics-panel" id="voice-topics">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LECTURA RÁPIDA</p>
              <h3>Frases que se repiten</h3>
            </div>
            <Pill tone="blue">Contexto incluido</Pill>
          </div>
          <div className="word-cloud" aria-label="Frases que más se repiten">
            {topicPhrases.map(([phrase, count], i) => (
              <button
                type="button"
                key={phrase}
                className={`word word-${i % 5} ${selectedPhrase === phrase ? "is-active" : ""}`}
                style={{ fontSize: `${14 + Math.min(count, 5) * 3}px` }}
                onClick={() =>
                  setSelectedPhrase(current =>
                    current === phrase ? null : phrase
                  )
                }
                title={`Ver comentarios que mencionan “${phrase}”`}
              >
                {phrase}
                <sup>{count}</sup>
              </button>
            ))}
          </div>
          {!topicPhrases.length && (
            <Empty text="Aún no hay frases repetidas." />
          )}
          {selectedPhrase && (
            <div className="word-cloud-detail">
              <div className="word-cloud-detail-head">
                <div>
                  <span className="eyebrow">FRASE SELECCIONADA</span>
                  <b>“{selectedPhrase}”</b>
                  <small>
                    {plural(phraseMatches.length, "comentario", "comentarios")}
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setSelectedPhrase(null)}
                  aria-label="Cerrar frase"
                >
                  <X size={16} />
                </button>
              </div>
              {phraseMatches.length ? (
                <div className="word-cloud-comments">
                  {phraseMatches.slice(0, 6).map(record => (
                    <div
                      className="word-cloud-comment"
                      key={`${record.id}-${record.timestamp}`}
                    >
                      <span className={`visit-quality ${clean(record.quality)}`}>
                        {record.quality || "Sin calificar"}
                      </span>
                      <p>{record.comment}</p>
                      <small>
                        {formatDate(record.timestamp)} ·{" "}
                        {record.registeredBy || "Sin mesero"}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No encontramos comentarios con esa frase." />
              )}
            </div>
          )}
          <p className="micro-note">
            {selectedPhrase
              ? "Haz clic en la frase o en la X para volver al mapa."
              : "Haz clic en una frase para ver los comentarios que la mencionan."}
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
                <h3>
                  Comentarios con <strong>“{selected.word}”</strong>
                </h3>
                <p className="muted comment-modal-count">
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
      {commentSheet &&
        createPortal(
          <div className="client-sheet-backdrop" onClick={() => setCommentSheet(null)}>
            <aside
              className="client-sheet voice-comments-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={commentSheet.title}
              onClick={event => event.stopPropagation()}
            >
              <div className="client-sheet-head">
                <div>
                  <p className="eyebrow">VOZ DEL CLIENTE</p>
                  <h3>{commentSheet.title}</h3>
                  <small className="muted">{commentSheet.subtitle}</small>
                </div>
                <button className="icon-button" onClick={() => setCommentSheet(null)} aria-label="Cerrar ficha">
                  <X size={17} />
                </button>
              </div>
              <div className="voice-sheet-list">
                {commentSheet.kind === "repeated" ? (
                  repeatedComments.length ? (
                    repeatedComments.map(item => (
                      <article className="voice-sheet-comment" key={item.text}>
                        <div className="voice-sheet-top">
                          <span className="voice-count">×{item.count}</span>
                          <small>Comentario repetido</small>
                        </div>
                        <p>“{item.text}”</p>
                      </article>
                    ))
                  ) : (
                    <Empty text="No hay comentarios repetidos." />
                  )
                ) : commentSheet.items?.length ? (
                  commentSheet.items.map(item => (
                    <article className="voice-sheet-comment" key={`${item.id}-${item.timestamp}`}>
                      <div className="voice-sheet-top">
                        <b>{item.clientName || "Cliente sin nombre"}</b>
                        <Pill
                          tone={
                            clean(item.quality) === "malo"
                              ? "red"
                              : clean(item.quality) === "regular"
                                ? "orange"
                                : "green"
                          }
                        >
                          {item.quality || "Sin calidad"}
                        </Pill>
                      </div>
                      <p>{item.comment?.trim() ? `“${item.comment}”` : "No dejó comentario."}</p>
                      <small>{formatDateTime(item.timestamp)} · {item.dish || "Producto no indicado"}</small>
                    </article>
                  ))
                ) : (
                  <Empty text="No hay comentarios para mostrar." />
                )}
              </div>
              <div className="client-sheet-footer">
                <small>Se cierra sin salir de Voz del cliente.</small>
                <button className="btn-borde" onClick={() => setCommentSheet(null)}>Cerrar</button>
              </div>
            </aside>
          </div>,
          document.body
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
          <p className="eyebrow">COMPARAR</p>
          <h3>Elige fechas para comparar</h3>
          <small className="muted">
            Elige Desde y Hasta. Compararemos con el tramo anterior de la misma
            duración.
          </small>
        </div>
      </section>
    );
  return (
    <section className="panel period-comparison">
      <div className="panel-head">
        <div>
          <p className="eyebrow">COMPARAR</p>
          <h3>Contra el período anterior</h3>
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
  const askPin = useAdminPin();
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
  const [teamTab, setTeamTab] = useState<"resumen" | "personas" | "metas">(
    () => {
      const saved = localStorage.getItem("coronel.teamTab");
      return saved === "personas" || saved === "metas" ? saved : "resumen";
    }
  );
  useEffect(() => {
    localStorage.setItem("coronel.teamTab", teamTab);
  }, [teamTab]);
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
  const rankedServers = [...qualityByServer]
    .filter(server => server.answered > 0)
    .sort((a, b) => b.pct - a.pct);
  const bestServer =
    rankedServers.find(server => server.answered >= 20) ?? rankedServers[0];
  const salonRecords = periodRecords.filter(
    r => displayServer(r.registeredBy) !== "DELIVERY / WEB"
  );
  const deliveryCount = periodRecords.length - salonRecords.length;
  const deliveryGap = deliveryCount - deliveryGoal;
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
  const saveTargets = async () => {
    const surveys = Math.max(1, Number(targetSurveys) || 1);
    const delivery = Math.max(1, Number(targetDelivery) || 1);
    const quality = Math.min(100, Math.max(1, Number(targetQuality) || 1));
    const pin = await askPin(
      "Guardar las metas del equipo. El cambio quedará en el historial."
    );
    if (!pin) return;
    saveTargetsMutation.mutate(
      {
        surveysPerServer: surveys,
        surveysPerDelivery: delivery,
        positiveQualityPercent: quality,
        periodLabel,
        adminPin: pin,
      },
      {
        onSuccess: async () => {
          setTargetSurveys(String(surveys));
          setTargetDelivery(String(delivery));
          setTargetQuality(String(quality));
          localStorage.setItem("coronel.targetSurveys", String(surveys));
          localStorage.setItem("coronel.targetDelivery", String(delivery));
          localStorage.setItem("coronel.targetQuality", String(quality));
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
          <Pill tone="orange">EQUIPO</Pill>
          <h2>Cómo va el equipo.</h2>
          <p>
            Elige un período y mira cómo trabaja cada persona, con una muestra
            clara antes de comparar.
          </p>
        </div>
        <div className="intro-note">
          <UserRoundCheck size={17} />
          <span>
            <b>Lista del equipo cargada</b>
            <small>
              {catalog.length
                ? `${catalog.length} personas en la pestaña Meseros.`
                : "Sin lista disponible; se muestran los códigos."}
            </small>
          </span>
          <button
            className="secondary-action team-targets-btn"
            onClick={() => {
              setTeamTab("metas");
              setTargetsOpen(true);
              window.setTimeout(() => {
                document
                  .getElementById("team-targets")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 60);
            }}
          >
            Editar metas
          </button>
        </div>
      </div>
      <PageHint compact title="Muévete por: Resumen · Personas · Metas." />
      <div className="team-tabs" role="tablist" aria-label="Secciones de Equipo">
        {([
          ["resumen", "Resumen"],
          ["personas", "Personas"],
          ["metas", "Metas"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={teamTab === id}
            className={teamTab === id ? "selected" : ""}
            onClick={() => {
              setTeamTab(id);
              if (id === "metas") setTargetsOpen(true);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {teamTab === "resumen" && (
        <>
      <section className="panel team-date-filter">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PERÍODO</p>
            <h3>Elegir fechas</h3>
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
      <section className="insights-section">
        <div className="insights-head">
          <div>
            <p className="eyebrow">INSIGHTS DE EQUIPO</p>
            <h2>Quién destaca y qué falta</h2>
          </div>
          <p>El período se aplica a estas tarjetas.</p>
        </div>
        <div className="insights-grid">
          <InsightCard
            label="MEJOR PORCENTAJE"
            tone={bestServer ? "positive" : "neutral"}
            icon={UserRoundCheck}
            title={bestServer?.name || "Sin muestra suficiente"}
            evidence={
              bestServer
                ? `${Math.round(bestServer.pct)}% positivo · n=${bestServer.answered}${
                    bestServer.ci
                      ? ` · IC95 ${Math.round(bestServer.ci[0] * 100)}–${Math.round(bestServer.ci[1] * 100)}%`
                      : ""
                  }`
                : "Todavía no hay encuestas calificadas en el período."
            }
            meta={bestServer ? "DENTRO DEL PERÍODO" : undefined}
            action="Ver detalle"
            onClick={() =>
              document
                .getElementById("team-scorecard")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
          <InsightCard
            label="CONFIANZA DEL RANKING"
            tone={lowSampleServers.length ? "warning" : "positive"}
            icon={AlertTriangle}
            title={
              lowSampleServers.length
                ? `${lowSampleServers.length} mesero${lowSampleServers.length === 1 ? "" : "s"} con muestra baja`
                : "Muestra suficiente para comparar"
            }
            evidence={
              lowSampleServers.length
                ? `${lowSampleServers
                    .map(server => `${server.name} (n=${server.answered})`)
                    .join(", ")}. No los compares como definitivos.`
                : "Todos los meseros con datos tienen al menos 20 encuestas calificadas."
            }
            action="Ver detalle"
            onClick={() =>
              document
                .getElementById("team-scorecard")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
          <InsightCard
            label="DELIVERY WEB"
            tone={deliveryGap >= 0 ? "positive" : "warning"}
            icon={MessageSquareText}
            title={`${deliveryCount} encuestas`}
            evidence={
              deliveryGap >= 0
                ? `Meta: ${deliveryGoal} · va ${deliveryGap} encuesta${deliveryGap === 1 ? "" : "s"} por encima.`
                : `Meta: ${deliveryGoal} · faltan ${Math.abs(deliveryGap)} encuesta${Math.abs(deliveryGap) === 1 ? "" : "s"}.`
            }
            action="Ver delivery"
            onClick={() =>
              document
                .getElementById("delivery-scorecard")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
        </div>
      </section>

      {fromDate && toDate ? (
        <PeriodComparison records={records} fromDate={fromDate} toDate={toDate} />
      ) : null}

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
          onClick={() => {
            setTeamTab("metas");
            setTargetsOpen(true);
          }}
        />
      </div>
        </>
      )}
      {teamTab === "personas" && (
        <>
            <div className="team-section-heading">
        <p className="eyebrow">PERSONAS</p>
        <h2>Volumen y calidad por persona</h2>
      </div>
      <div className="dashboard-grid team-grid">
        <section
          id="delivery-scorecard"
          className="panel delivery-target-panel"
        >
          <div className="panel-head">
            <div>
              <p className="eyebrow">META DELIVERY / WEB</p>
              <h3>Encuestas de delivery / web</h3>
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
              <p className="eyebrow">RESULTADOS POR PERSONA</p>
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
      )}
      {teamTab === "metas" && (
        <>
            <div className="team-section-heading">
        <p className="eyebrow">METAS</p>
        <h2>Objetivos del equipo</h2>
      </div>
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
            <p className="eyebrow">METAS</p>
            <h3>Metas del equipo</h3>
            <small>
              Editar metas compartidas y registrar el cambio en el historial.
            </small>
          </span>
          <span className="targets-toggle-action">
            {targetsOpen ? "Ocultar edición" : "Editar metas"}{" "}
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
                Meta actual: <b>{surveyGoal} encuestas por mesero</b>,{" "}
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
        </>
      )}
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


let pdfAssetsPromise: Promise<{ logo: string | null; pattern: string | null }> | null = null;
function loadPdfAssets() {
  if (pdfAssetsPromise) return pdfAssetsPromise;
  const toDataUrl = async (src: string) => {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };
  pdfAssetsPromise = Promise.all([
    toDataUrl("/manus-storage/logo-coronel.png"),
    toDataUrl("/manus-storage/patron-pdf.png"),
  ]).then(([logo, pattern]) => ({ logo, pattern }));
  return pdfAssetsPromise;
}

type PdfDownloadOptions = {
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape" | "auto";
  fontSize?: number;
  pattern?: boolean;
  logo?: boolean;
  margin?: number;
};

function downloadTablePdf(
  title: string,
  subtitle: string,
  columns: string[],
  rows: unknown[][],
  filename?: string,
  options: PdfDownloadOptions = {}
) {
  void (async () => {
    const { logo, pattern } = await loadPdfAssets();
    const pageOrientation =
      options.orientation && options.orientation !== "auto"
        ? options.orientation
        : columns.length > 6
          ? "landscape"
          : "portrait";
    const doc = new jsPDF({
      orientation: pageOrientation,
      unit: "pt",
      format: options.pageSize ?? "a4",
    });
    doc.setProperties({
      title,
      subject: subtitle,
      author: "Restaurante Coronel",
      creator: "Coronel Dashboard",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = options.margin ?? 42;
    const forest = [20, 92, 54] as const;
    const sage = [158, 212, 174] as const;
    const coral = [224, 47, 27] as const;
    const ink = [12, 16, 13] as const;
    const muted = [95, 111, 101] as const;
    const line = [238, 242, 240] as const;
    const soft = [244, 247, 245] as const;

    const daysColumn = columns.findIndex(column => {
      const normalized = normalizeText(column);
      return normalized === "dias" || normalized.startsWith("dias ");
    });

    // Patrón de marca muy sutil, solo en el cuerpo.
    const paintPattern = () => {
      if (!pattern || options.pattern === false) return;
      // El asset patron-pdf.png ya está preatenuado: se incrusta sin GState.
      for (let x = 0; x < pageWidth; x += 250) {
        for (let y = 104; y < pageHeight - 34; y += 250) {
          doc.addImage(pattern, "PNG", x, y, 250, 250, undefined, "FAST");
        }
      }
    };
    paintPattern();

    // Cabecera editorial: blanca, logo verde a la izquierda y título a la derecha.
    if (logo && options.logo !== false) {
      doc.addImage(logo, "PNG", margin, 28, 78, 44, undefined, "FAST");
    }
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("REPORTE CORONEL", pageWidth - margin, 30, { align: "right" });
    doc.setTextColor(...forest);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(title, pageWidth - margin, 52, { align: "right" });
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitle, pageWidth - margin, 68, { align: "right" });
    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, 88, pageWidth - margin, 88);

    // Tarjetas de resumen independientes.
    const cards = [
      ["REGISTROS", String(rows.length)],
      ["GENERADO", new Date().toLocaleDateString("es-PE")],
      [
        "FORMATO",
        `${(options.pageSize ?? "a4").toUpperCase()} · ${
          pageOrientation === "landscape" ? "HORIZONTAL" : "VERTICAL"
        }`,
      ],
    ] as const;
    const cardGap = 10;
    const contentWidth = pageWidth - margin * 2;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    cards.forEach(([label, value], index) => {
      const x = margin + index * (cardWidth + cardGap);
      const y = 102;
      doc.setFillColor(...soft);
      doc.setDrawColor(...line);
      doc.setLineWidth(0.7);
      doc.roundedRect(x, y, cardWidth, 48, 12, 12, "FD");
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(label, x + 13, y + 16);
      doc.setTextColor(...forest);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(index === 2 ? 8 : 14);
      doc.text(value, x + 13, y + 35);
    });

    autoTable(doc, {
      head: [columns],
      body: rows.map(row =>
        row.map((value, columnIndex) => {
          if (columnIndex !== daysColumn) return String(value ?? "");
          const normalized = normalizeText(String(value ?? ""));
          if (normalized.includes("hoy") || /faltan\s+[1-3]\s+d/.test(normalized)) {
            return {
              content: String(value ?? ""),
              styles: { textColor: [...coral], fontStyle: "bold" as const },
            };
          }
          if (normalized.startsWith("hace")) {
            return { content: String(value ?? ""), styles: { textColor: [...muted] } };
          }
          return String(value ?? "");
        })
      ),
      startY: 166,
      margin: { left: margin, right: margin, bottom: 42 },
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: options.fontSize ?? 7.6,
        cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
        overflow: "linebreak",
        textColor: [...ink],
        fillColor: [255, 255, 255],
        lineWidth: 0,
      },
      headStyles: {
        fillColor: [...sage],
        textColor: [...forest],
        fontStyle: "bold",
        fontSize: 7.2,
        cellPadding: { top: 9, right: 8, bottom: 9, left: 8 },
      },
      alternateRowStyles: { fillColor: [248, 251, 249] },
      columnStyles:
        columns.length > 0
          ? { 0: { textColor: [...forest], fontStyle: "bold" } }
          : {},
      didParseCell: data => {
        const isDaysColumn =
          daysColumn >= 0 && data.column.index === daysColumn;
        if (isDaysColumn && data.section === "body") {
          const value = normalizeText(String(data.cell.raw ?? ""));
          if (value.includes("hoy") || /faltan\s+[1-3]\s+d/.test(value)) {
            data.cell.styles.textColor = [...coral];
            data.cell.styles.fontStyle = "bold";
          } else if (value.startsWith("hace")) {
            data.cell.styles.textColor = [...muted];
          }
        }
        if (data.section === "body" && data.column.index === daysColumn) {
          data.cell.styles.fillColor = [255, 255, 255];
        }
      },
      didDrawCell: data => {
        if (data.section === "body" || data.section === "head") {
          doc.setDrawColor(...line);
          doc.setLineWidth(0.45);
          doc.line(
            data.cell.x,
            data.cell.y + data.cell.height,
            data.cell.x + data.cell.width,
            data.cell.y + data.cell.height
          );
        }
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let index = 1; index <= pageCount; index += 1) {
      doc.setPage(index);
      if (index > 1) paintPattern();
      doc.setDrawColor(...line);
      doc.setLineWidth(0.7);
      doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
      doc.setFillColor(...forest);
      doc.circle(margin + 3, pageHeight - 20, 2, "F");
      doc.setFontSize(6.8);
      doc.setTextColor(...muted);
      doc.text("CORONEL · POLLOS Y PARRILLAS", margin + 11, pageHeight - 17);
      doc.text(
        `Generado ${new Date().toLocaleString("es-PE")} · Página ${index}/${pageCount}`,
        pageWidth - margin,
        pageHeight - 17,
        { align: "right" }
      );
    }
    doc.save(
      filename ||
        `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`
    );
  })();
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
  const askPin = useAdminPin();
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
        text: "Permisos guardados. El cambio quedó registrado.",
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
        text: `Acceso aprobado para ${data.email}. Comparte la clave temporal por un canal privado.`,
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
  const approveAccessRequest = async (request: AccessRequestRow) => {
    const pin = await askPin(
      `Aprobar el acceso de ${request.name} (${request.email}) y crear su cuenta.`
    );
    if (!pin) return;
    approveRequest.mutate({ id: request.id, adminPin: pin });
  };
  const rejectAccessRequest = async (request: AccessRequestRow) => {
    const pin = await askPin(
      `Rechazar la solicitud de ${request.name} (${request.email}).`
    );
    if (!pin) return;
    rejectRequest.mutate({ id: request.id, adminPin: pin });
  };
  const resetAccountPassword = async (account: AccessUser) => {
    if (!account.openId) {
      setNotice({
        tone: "error",
        text: "Esta cuenta no está vinculada a Supabase Auth; no se puede restablecer la clave desde aquí.",
      });
      return;
    }
    const pin = await askPin(
      `Crear una clave temporal para ${account.name || account.email || "esta cuenta"}.`
    );
    if (!pin) return;
    resetPassword.mutate({ openId: account.openId, adminPin: pin });
  };
  const copyTempCredential = async () => {
    if (!tempCredential) return;
    const text = [
      "Acceso Coronel Dashboard",
      `Correo: ${tempCredential.email ?? ""}`,
      `Clave temporal: ${tempCredential.password}`,
      `Ingresa en: ${window.location.origin}/login`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice({
        tone: "success",
        text: "Acceso copiado. Compártelo por un canal privado.",
      });
    } catch {
      setNotice({
        tone: "error",
        text: "No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.",
      });
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
  const save = async (account: AccessUser) => {
    const draft = drafts[account.id];
    if (!draft) return;
    const pin = await askPin(
      `Guardar los permisos de ${account.name || account.email || "esta persona"}.`
    );
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
  const toggleAccount = async (account: AccessUser) => {
    const pin = await askPin(
      account.active
        ? `Quitar el acceso de ${account.name || account.email || "esta persona"}. No podrá entrar al sistema.`
        : `Devolver el acceso a ${account.name || account.email || "esta persona"}.`
    );
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
    ["canManageCalls", "Llamar y registrar"],
    ["canManageTargets", "Editar metas"],
    ["canManageUsers", "Administrar accesos"],
    ["canViewAudit", "Ver historial de cambios"],
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
          <Pill tone="purple">CUENTAS</Pill>
          <h2>Quién puede entrar.</h2>
          <p>
            Decide qué personas usan el sistema y qué puede ver o hacer cada una.
          </p>
        </div>
        <div className="intro-note">
          <ShieldCheck size={17} />
          <span>
            <b>Solo para administradores</b>
            <small>
              Para aprobar o cambiar permisos te pediremos la clave.
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
            <b>Clave temporal generada</b>
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
              Copiar acceso
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
      <section className="panel online-users-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PRESENCIA EN TIEMPO REAL</p>
            <h3>Usuarios en línea</h3>
            <small className="muted">
              Se actualiza automáticamente cada 15 segundos.
            </small>
          </div>
          <Pill tone={users.some(account => account.isOnline) ? "green" : "neutral"}>
            {users.filter(account => account.isOnline && account.active).length} en línea
          </Pill>
        </div>
        {users.filter(account => account.isOnline && account.active).length ? (
          <div className="online-users-list">
            {users
              .filter(account => account.isOnline && account.active)
              .map(account => (
                <div className="online-user-card" key={account.id}>
                  <span className="online-user-avatar">
                    {avatarSymbol(account.avatarPreset)}
                  </span>
                  <span>
                    <b>{account.name || account.email || "Usuario"}</b>
                    <small>
                      {account.role === "admin" ? "Administrador" : "Equipo"}
                    </small>
                  </span>
                  <span className="online-dot" aria-label="En línea" />
                </div>
              ))}
          </div>
        ) : (
          <Empty text="Nadie tiene una sesión activa en este momento." />
        )}
      </section>
      <section className="panel access-requests-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">SOLICITUDES</p>
            <h3>Personas que piden entrar</h3>
            <small className="muted">
              Revisa la solicitud. Si la apruebas, se crea su acceso y te damos
              una clave temporal para compartirle.
            </small>
          </div>
          <Pill tone={pendingRequests.length ? "orange" : "green"}>
            {plural(pendingRequests.length, "pendiente", "pendientes")}
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
          <p className="eyebrow">RESUMEN</p>
          <h3>{plural(users.length, "persona con cuenta", "personas con cuenta")}</h3>
          <p className="muted">
            Quien no tenga acceso no puede entrar. Puedes devolverle el acceso
            cuando quieras.
          </p>
        </div>
        <div className="access-summary-stats">
          <span>
            <b>{users.filter(item => item.active).length}</b> con acceso
          </span>
          <span>
            <b>{users.filter(item => !item.active).length}</b> sin acceso
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
            <p className="eyebrow">PERMISOS</p>
            <h3>Qué puede hacer cada persona</h3>
          </div>
          <Pill tone="purple">Clave al guardar</Pill>
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
                        <option value="user">Equipo</option>
                        <option value="admin">Administrador</option>
                      </select>
                    ) : (
                      <div className="account-status-tags">
                        <Pill
                          tone={account.role === "admin" ? "green" : "blue"}
                        >
                          {account.role === "admin"
                            ? "Administrador"
                            : "Equipo"}
                        </Pill>
                        <Pill tone={account.isOnline ? "green" : "neutral"}>
                          {account.isOnline ? "En línea" : "Desconectado"}
                        </Pill>
                        <Pill tone={account.active ? "green" : "red"}>
                          {account.active ? "Con acceso" : "Sin acceso"}
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
                                ? "Nombres, teléfonos y cumpleaños"
                                : field === "canManageCalls"
                                  ? "Registrar llamadas y seguimientos"
                                  : field === "canManageTargets"
                                    ? "Cambiar las metas del equipo"
                                    : field === "canManageUsers"
                                      ? "Crear y quitar accesos"
                                      : "Ver quién cambió qué"}
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
                          <Settings2 size={14} /> Cambiar permisos
                        </button>
                        <button
                          className={`account-action ${account.active ? "disable" : "recover"}`}
                          onClick={() => toggleAccount(account)}
                        >
                          {account.active
                            ? "Quitar acceso"
                            : "Devolver acceso"}
                        </button>
                        <button
                          className="secondary-action"
                          onClick={() => resetAccountPassword(account)}
                        >
                          Nueva clave temporal
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="Todavía no hay personas con cuenta." />
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
