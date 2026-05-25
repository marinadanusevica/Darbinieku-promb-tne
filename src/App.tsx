import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import {
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  TrendingUp,
  Brain,
  Download,
  PlusCircle,
  BarChart3,
  Activity,
  Heart,
  UserCheck,
  Briefcase,
  AlertOctagon,
  Clock,
  ArrowRight,
  Shield,
  Lock,
  Copy,
  Check,
  Globe,
  Home,
  ExternalLink
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

// TypeScript declarations
interface Absence {
  id: number;
  employee_name: string;
  date_from: string;
  date_to: string;
  document_type: string;
  reason: string;
  created_at: string;
}

interface TrendData {
  date: string;
  count: number;
  percentage: number;
}

interface DocTypeData {
  type: string;
  count: number;
}

interface WeekdayData {
  weekday: string;
  count: number;
}

interface RedFlagUser {
  employee_name: string;
  episodes: number;
}

interface RedFlags {
  burnout: RedFlagUser[];
  fridaySyndrome: RedFlagUser[];
}

interface StatsPayload {
  trend: TrendData[];
  documentTypes: DocTypeData[];
  weekdayDistribution: WeekdayData[];
  redFlags: RedFlags;
}

export default function App() {
  // Path-based routing setup & synchronization
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Link copy toast/pill state
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const navigateTo = (newPath: string) => {
    window.history.pushState({}, "", newPath);
    setCurrentPath(newPath);
  };

  const handleCopyLink = (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    }).catch(() => {});
  };

  // Filter States
  const [fromDate, setFromDate] = useState("2026-05-01");
  const [toDate, setToDate] = useState("2026-05-31");

  // Public Absence Data States (confidential employee view)
  const [publicAbsences, setPublicAbsences] = useState<Array<{ id: number; employee_name: string; date_from: string; date_to: string }>>([]);
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  // API Data States (full management view)
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [stats, setStats] = useState<StatsPayload>({
    trend: [],
    documentTypes: [],
    weekdayDistribution: [],
    redFlags: { burnout: [], fridaySyndrome: [] }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Absence Submission Form States
  const [formName, setFormName] = useState("");
  const [formDateFrom, setFormDateFrom] = useState("2026-05-18");
  const [formDateTo, setFormDateTo] = useState("2026-05-18");
  const [formDocType, setFormDocType] = useState("Veselība");
  const [formReason, setFormReason] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [formErrorMsg, setFormErrorMsg] = useState("");

  // Gemini State
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>("");
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Fetch Dashboard metrics and record sets
  const fetchDashboardData = async (start: string, end: string) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/absences?from=${start}&to=${end}`);
      if (!res.ok) throw new Error("Neizdevās saņemt vadības datus no servera.");
      const payload = await res.json();
      setAbsences(payload.absences);
      setStats(payload.stats);
    } catch (err: any) {
      setApiError(err.message || "Notika neparedzēta kļūda.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch restricted privacy list for employees
  const fetchPublicData = async (start: string, end: string) => {
    setIsPublicLoading(true);
    setPublicError(null);
    try {
      const res = await fetch(`/api/absences/public?from=${start}&to=${end}`);
      if (!res.ok) throw new Error("Neizdevās saņemt darbinieku datus.");
      const payload = await res.json();
      setPublicAbsences(payload.absences || []);
    } catch (err: any) {
      setPublicError(err.message || "Sistēmas kļūda datu ielādē.");
    } finally {
      setIsPublicLoading(false);
    }
  };

  // Run on mount and parameter/path shifts
  useEffect(() => {
    if (currentPath === "/darbiniekiem") {
      fetchPublicData(fromDate, toDate);
    } else if (currentPath === "/vadiba") {
      fetchDashboardData(fromDate, toDate);
    }
  }, [currentPath, fromDate, toDate]);

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus("submitting");
    setFormErrorMsg("");

    if (!formName.trim()) {
      setFormStatus("error");
      setFormErrorMsg("Darbinieka vārds un uzvārds ir obligāts lauks.");
      return;
    }
    if (!formDateFrom || !formDateTo) {
      setFormStatus("error");
      setFormErrorMsg("Sākuma un beigu datumi ir obligāti.");
      return;
    }
    if (new Date(formDateFrom) > new Date(formDateTo)) {
      setFormStatus("error");
      setFormErrorMsg("No datuma nevar būt vēlāks par Līdz datumam.");
      return;
    }
    if (!formReason.trim()) {
      setFormStatus("error");
      setFormErrorMsg("Prombūtnes pamatojums ir obligāts lauks.");
      return;
    }

    try {
      const response = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_name: formName.trim(),
          date_from: formDateFrom,
          date_to: formDateTo,
          document_type: formDocType,
          reason: formReason.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Sūtīšana neizdevās.");
      }

      setFormStatus("success");
      // Reset inputs
      setFormName("");
      setFormReason("");
      // Refresh respective datasets
      if (currentPath === "/darbiniekiem") {
        fetchPublicData(fromDate, toDate);
      } else {
        fetchDashboardData(fromDate, toDate);
      }
    } catch (err: any) {
      setFormStatus("error");
      setFormErrorMsg(err.message || "Notika kļūda saglabāšanas laikā.");
    }
  };

  // Run Gemini AI Strategic Compliance Report
  const runAIAnalysis = async () => {
    setIsGeminiLoading(true);
    setGeminiError(null);
    setGeminiAnalysis("");
    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromDate, to: toDate })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI serviss šobrīd ir aizņemts.");
      }
      setGeminiAnalysis(data.analysis);
    } catch (err: any) {
      setGeminiError(err.message || "Neizdevās pabeigt analīzi ar Gemini AI.");
    } finally {
      setIsGeminiLoading(false);
    }
  };

  // Double check quick ranges
  const applyQuickRange = (start: string, end: string) => {
    setFromDate(start);
    setToDate(end);
  };

  // Helper to obtain today as YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Spreadsheet export trigger
  const triggerExcelExport = () => {
    window.open(`/api/absences/export?from=${fromDate}&to=${toDate}`, "_blank");
  };

  // Calculate high-level KPIs inside SPA for additional beauty
  const totalLogs = absences.length;
  const uniqueAbsentEmployees = Array.from(new Set(absences.map((a) => a.employee_name))).length;
  
  // Calculate avg length of logged absence
  const totalDays = absences.reduce((sum, abs) => {
    const diffTime = Math.abs(new Date(abs.date_to).getTime() - new Date(abs.date_from).getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
    return sum + days;
  }, 0);
  const avgDuration = totalLogs > 0 ? (totalDays / totalLogs).toFixed(1) : "0";

  // Document types standard colors for charts
  const COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#64748b"];

  // Helper Badge Colors for Latvian Categories
  const getBadgeClass = (type: string) => {
    switch (type) {
      case "Veselība":
        return "bg-rose-100 text-rose-700 border border-rose-200";
      case "Bērns":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "Atvaļinājums":
        return "bg-emerald-100 text-emerald-700 border border-emerald-250";
      case "Strādāju no mājām":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      case "Neplānotā":
        return "bg-rose-100 text-rose-800 border border-rose-300";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc] text-slate-900 font-sans overflow-hidden border-8 border-slate-200">
      <AnimatePresence mode="wait">
        {/* GATEWAY LANDING PAGE (DEFAULT /) */}
        {currentPath !== "/darbiniekiem" && currentPath !== "/vadiba" && (
          <motion.div
            key="gateway"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="max-w-4xl w-full space-y-8">
              <div className="space-y-3">
                <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">
                  Prombūtnes kontroles vadības centrs
                </h1>
                <p className="text-slate-500 max-w-lg mx-auto text-sm">
                  Sistēma nodrošina divas pilnībā neatkarīgas un drošas vides publicēšanai. Izvēlieties nepieciešamo piekļuves saiti vai kopējiet to:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {/* 1. EMPLOYEE CARD */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono tracking-wider">
                        TIKAI DARBINIEKIEM
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">1. Darbinieku portāls</h3>
                      <p className="text-xs text-slate-400 mt-1 font-mono hover:underline truncate">
                        {window.location.host}/darbiniekiem
                      </p>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Droša un viegla savas medicīniskās vai citas prombūtnes pieteikšana.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Vispārējs promesošo saraksts (redz tikai **vārdu**, **uzvārdu** un **datumus**).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span className="text-rose-750 font-semibold bg-rose-50/50 px-1 rounded">
                          Konfidencialitāte: iemesli, kategorijas un AI analītika ir paslēpti.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-3">
                    <button
                      onClick={() => navigateTo("/darbiniekiem")}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      Pāriet uz darbinieku skatu
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopyLink("/darbiniekiem")}
                      className="py-2 px-3 border border-slate-250 bg-slate-50 text-slate-700 font-bold text-xs rounded hover:bg-slate-100 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      {copiedPath === "/darbiniekiem" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Nokopēts!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopēt saiti</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. MANAGER BUSINESS CARD */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md hover:shadow-lg transition-all flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-indigo-900/40 text-indigo-400 rounded-lg flex items-center justify-center border border-indigo-800/50">
                        <Shield className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono tracking-wider">
                        TIKAI MENEDŽMENTAM
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">2. Vadības panelis (HR analītika)</h3>
                      <p className="text-xs text-slate-400 mt-1 font-mono hover:underline truncate">
                        {window.location.host}/vadiba
                      </p>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>Pilns pārskats par visu analītiku, tendencēm un kalendāra noslodzi.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>Recharts interaktīvās diagrammas (tendenču līnijas, darba dienu sadalījums).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>Algoritmiskie flags ("Piektdienas sindroms" un hroniska izdegšanas riski).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>Full database reģistrs ar iemesliem, Excel lejupielādi un Gemini AI.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-3">
                    <button
                      onClick={() => navigateTo("/vadiba")}
                      className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(129,140,248,0.3)]"
                    >
                      Pāriet uz vadības skatu
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopyLink("/vadiba")}
                      className="py-2 px-3 border border-slate-700 bg-slate-800 text-slate-200 font-bold text-xs rounded hover:bg-slate-700 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      {copiedPath === "/vadiba" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Nokopēts!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopēt saiti</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
              
              <div className="text-[11px] text-slate-400 font-mono tracking-normal border-t border-dashed border-slate-200 pt-6">
                DB STATUSS: <span className="text-emerald-650 font-bold">SQLite WAL REŽĪMS</span> | DZINĒJS: REACT + NODE.JS + VITE | DROŠĪBA: ON-PREM SECURE
              </div>
            </div>
          </motion.div>
        )}

        {/* 1. EMPLOYEE PORTAL VIEW (/darbiniekiem) */}
        {currentPath === "/darbiniekiem" && (
          <motion.div
            key="employee-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Employee Specific Compact Header */}
            <header className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateTo("/")}
                  className="px-2.5 py-1 text-slate-500 border border-slate-200 hover:bg-slate-50 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 font-sans"
                >
                  <Home className="w-3.5 h-3.5" />
                  Sākums
                </button>
                <div className="h-4 w-px bg-slate-200 sm:block hidden"></div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-50 text-emerald-700 rounded flex items-center justify-center">
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <h1 className="text-xs font-black tracking-tight text-slate-800 font-display uppercase">
                    Darbinieku prombūtnes reģistrs
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Datu koplietošana</span>
                  <span className="text-[10px] font-extrabold text-slate-700 flex items-center gap-1 font-mono">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    EIROPAS VDAR ATBILSTOŠS
                  </span>
                </div>
              </div>
            </header>

            {/* Split Grid Body */}
            <div className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden min-h-0">
              
              {/* Left Form Panel */}
              <div className="col-span-12 lg:col-span-5 flex items-center justify-center overflow-y-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="w-full max-w-sm">
                  <div className="mb-4 pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Reģistrēt jaunu prombūtni</h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">Lūdzu, aizpildiet visus informācijas laukus, lai pieteiktu prombūtni.</p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-3.5">
                    {formStatus === "success" && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                        <span className="font-bold">Veiksmīgi reģistrēts!</span> Pieteikums veiksmīgi nodots datubāzē. Saraksts ir atjaunināts.
                      </div>
                    )}
                    {formStatus === "error" && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-850 text-xs">
                        <span className="font-bold">Reģistrācijas kļūda:</span> {formErrorMsg}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Darbinieka vārds un uzvārds
                      </label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Vārds Uzvārds (piem. Jānis Bērziņš)"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          No datuma
                        </label>
                        <input
                          type="date"
                          required
                          value={formDateFrom}
                          onChange={(e) => setFormDateFrom(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Līdz datumam
                        </label>
                        <input
                          type="date"
                          required
                          value={formDateTo}
                          onChange={(e) => setFormDateTo(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Ieraksta klasifikācija
                      </label>
                      <select
                        value={formDocType}
                        onChange={(e) => setFormDocType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Neplānotā">Neplānotā</option>
                        <option value="Veselība">Veselība</option>
                        <option value="Bērns">Bērns</option>
                        <option value="Atvaļinājums">Atvaļinājums</option>
                        <option value="Strādāju no mājām">Strādāju no mājām</option>
                        <option value="Cits">Cits</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Kavējuma iemesls, paskaidrojums vadītājam
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formReason}
                        onChange={(e) => setFormReason(e.target.value)}
                        placeholder="Aprakstiet konkrētus simptomus vai radušos situāciju. (Šī informācija būs redzama tikai vadībai!)"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={formStatus === "submitting"}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded shadow-xs transition-colors cursor-pointer"
                      >
                        {formStatus === "submitting" ? "REĢISTRĒ..." : "IESNIEGT PROMBŪTNI"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right List Panel (Hides reason and analytics entirely) */}
              <div className="col-span-12 lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden h-full min-h-0">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                  <div className="text-left">
                    <h3 className="text-xs font-black text-slate-850 uppercase tracking-wide">
                      Aktīvās prombūtnes periods
                    </h3>
                    <p className="text-[10px] text-slate-450 mt-0.5">Tikai vārdi, uzvārdi un datumi (bez iemesliem vai analītikas)</p>
                  </div>

                  {/* Date pickers inside employee portal for easy filtering */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="bg-white border border-slate-205 px-2 py-0.5 text-[10.5px] font-semibold rounded text-slate-700 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400">&rarr;</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="bg-white border border-slate-205 px-2 py-0.5 text-[10.5px] font-semibold rounded text-slate-700 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Secure Data Protection Banner */}
                <div className="bg-indigo-50/60 p-3 flex items-start gap-2 text-indigo-950 text-[10.5px] leading-relaxed shrink-0 border-b border-indigo-100">
                  <Lock className="w-4 h-4 text-indigo-600 shrink-0 select-none mt-0.5" />
                  <div>
                    <span className="font-extrabold">Konfidencialitātes nodrošinājums (GDPR):</span> Šis skats ir publiski pieejams darbiniekiem. Tā kā slimības lapas un prombūtnes iemesli satur sensitīvus veselības datus, iemesli, kategorijas un AI analītika šeit ir pilnībā atslēgta.
                  </div>
                </div>

                {/* Restricted Absence Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {isPublicLoading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-2 py-20 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                      <p className="text-[10px] text-indigo-650 font-mono animate-pulse">Ielādē publiskos datus...</p>
                    </div>
                  ) : publicError ? (
                    <div className="p-4 text-center text-xs text-rose-700 font-medium">
                      Datu ielādes kļūda: {publicError}
                    </div>
                  ) : publicAbsences.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#fcfdfe] text-slate-500 font-bold border-b border-slate-200 sticky top-0 font-mono text-[9px] uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-2.5">DARBINIEKS (VĀRDS, UZVĀRDS)</th>
                          <th className="px-5 py-2.5 text-right">PROMBŪTNES PERIODS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {publicAbsences.map((abs) => {
                          const isSingleDay = abs.date_from === abs.date_to;
                          return (
                            <tr key={abs.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3 font-bold text-slate-800 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-550"></div>
                                {abs.employee_name}
                              </td>
                              <td className="px-5 py-3 text-right font-mono text-[11px] text-slate-500">
                                {isSingleDay ? (
                                  <span className="bg-slate-100 px-2.5 py-0.5 rounded font-bold text-slate-700">
                                    {abs.date_from}
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 px-2.5 py-0.5 rounded font-bold text-slate-700">
                                    {abs.date_from} &rarr; {abs.date_to}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-2">
                      <Users className="h-8 w-8 text-slate-300" />
                      <span className="text-[11px] font-semibold text-slate-500">Izvēlētajā laika posmā nav aktīvu prombūtņu.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* 2. MANAGEMENT PORTAL VIEW (/vadiba) */}
        {currentPath === "/vadiba" && (
          <motion.div
            key="management-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Header with Enterprise Analytics Control */}
            <header className="flex items-center justify-between px-6 py-2 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateTo("/")}
                  className="px-2.5 py-1 text-slate-500 border border-slate-200 hover:bg-slate-50 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 font-sans"
                >
                  <Home className="w-3.5 h-3.5" />
                  Sākums
                </button>
                <div className="h-4 w-px bg-slate-200"></div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-xs">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-1.5 font-display uppercase leading-tight">
                      Menedžmenta analīzes panelis
                    </h1>
                  </div>
                </div>
              </div>

              {/* Action buttons list on far right */}
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Database status</span>
                  <span className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1 font-mono uppercase">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    PILNA PIEKĻUVE AKTĪVA
                  </span>
                </div>
                <button
                  onClick={triggerExcelExport}
                  disabled={absences.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white px-3.5 py-1.5 rounded text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  EKSPORTĒT (XLSX)
                </button>
              </div>
            </header>

            {/* Main analytical dashboard layout */}
            <div className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden min-h-0 bg-[#f8fafc]">
              
              {/* Left Column (Core charts, filters, metrics) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 overflow-hidden h-full min-h-0">
                
                {/* 1. Date filter controls toolbar inside manager layout */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">Periods:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold rounded text-slate-755 focus:border-indigo-400 focus:outline-none"
                      />
                      <span className="text-xs text-slate-400 font-bold">&rarr;</span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold rounded text-slate-755 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => applyQuickRange("2026-05-01", "2026-05-15")}
                      className="px-2.5 py-1 border border-slate-250 rounded text-[10px] font-bold bg-white hover:bg-slate-50 cursor-pointer text-slate-700"
                    >
                      1. - 15. maijs
                    </button>
                    <button
                      onClick={() => applyQuickRange("2026-05-16", "2026-05-31")}
                      className="px-2.5 py-1 border border-slate-250 rounded text-[10px] font-bold bg-white hover:bg-slate-50 cursor-pointer text-slate-700"
                    >
                      16. - 31. maijs
                    </button>
                    <button
                      onClick={() => applyQuickRange("2026-05-01", "2026-05-31")}
                      className="px-2.5 py-1 border border-slate-250 rounded text-[10px] font-bold bg-white hover:bg-slate-50 cursor-pointer text-slate-700"
                    >
                      Pilns mēnesis
                    </button>
                    <button
                      onClick={() => {
                        const today = getTodayString();
                        applyQuickRange(today, today);
                      }}
                      className="px-2.5 py-1 border border-indigo-250 rounded text-[10px] font-extrabold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 cursor-pointer"
                    >
                      Šodien
                    </button>
                  </div>
                </div>

                {/* 2. Business KPIs */}
                <div className="grid grid-cols-3 gap-4 shrink-0">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 font-mono">Vidējā prombūtne dienā</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-800">
                        {totalLogs > 0 ? `${((totalLogs / 50) * 100).toFixed(1)}%` : "0.0%"}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 font-mono">↓ Dinamisks</span>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 font-mono">Kopā pieteikumu periods</p>
                    <div className="flex items-baseline gap-1.5 font-sans">
                      <span className="text-2xl font-black text-slate-800">{totalLogs}</span>
                      <span className="text-[10px] font-medium text-slate-400">ieraksts(-i)</span>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm font-sans">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 font-mono">Biežākais iemesls</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-800">
                        {stats.documentTypes.reduce((max, cur) => (cur.count > max.count ? cur : max), { type: "N/A", count: 0 }).type.split(" ")[0]}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-450 font-mono">
                        {totalLogs > 0 ? `${Math.round(((stats.documentTypes.reduce((max, cur) => (cur.count > max.count ? cur : max), { type: "N/A", count: 0 }).count) / totalLogs) * 100)}%` : "0%"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Recharts graphs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
                  {/* CHART 1: Trend line */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">Tendence: Dienas prombūtne %</h3>
                    <div className="flex-1 min-h-0 w-full mt-1.5">
                      {stats.trend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="95%">
                          <LineChart data={stats.trend} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(str) => {
                                const parts = str.split("-");
                                return parts.length === 3 ? `${parts[1]}/${parts[2]}` : str;
                              }}
                              tick={{ fontSize: 8, fill: "#64748b" }}
                              stroke="#cbd5e1"
                            />
                            <YAxis
                              tickFormatter={(v) => `${v}%`}
                              tick={{ fontSize: 8, fill: "#64748b" }}
                              stroke="#cbd5e1"
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px", border: "0", color: "#fff" }}
                              itemStyle={{ color: "#34d399", fontSize: "9px" }}
                            />
                            <Line type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={1.5} dot={{ r: 1 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-[10px] font-mono text-slate-400">Nav datu punktu par šo periodu</div>
                      )}
                    </div>
                  </div>

                  {/* CHART 2: Doughnut type counts */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">Sadalījums pēc pieteikuma tipa</h3>
                    <div className="flex-1 min-h-0 w-full relative flex items-center justify-center mt-1.5">
                      {totalLogs > 0 ? (
                        <ResponsiveContainer width="100%" height="95%">
                           <PieChart>
                            <Pie
                              data={stats.documentTypes.filter((d) => d.count > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={28}
                              outerRadius={44}
                              paddingAngle={2}
                              dataKey="count"
                            >
                              {stats.documentTypes.filter((d) => d.count > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-[10px] font-mono text-slate-400">Nav reģistrētu pieteikumu</div>
                      )}
                      {totalLogs > 0 && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center pt-2">
                          <span className="text-sm font-black text-slate-800">{totalLogs}</span>
                          <span className="text-[7px] text-slate-400 uppercase tracking-widest font-bold font-sans">Kopā</span>
                        </div>
                      )}
                    </div>
                    {/* Compact layout indicators */}
                    <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1 text-[8px] font-mono font-semibold text-slate-600">
                      {stats.documentTypes.map((item, idx) => (
                        <div key={item.type} className="flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                          <span>{item.type.split(" ")[0]} ({item.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CHART 3: Weekday bar chart */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">Sadalījums pa nedēļas dienām</h3>
                    <div className="flex-1 min-h-0 w-full mt-1.5">
                      {totalLogs > 0 ? (
                        <ResponsiveContainer width="100%" height="95%">
                          <BarChart data={stats.weekdayDistribution} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="weekday"
                              tickFormatter={(str) => str.substring(0, 3).toUpperCase()}
                              tick={{ fontSize: 8, fill: "#64748b" }}
                              stroke="#cbd5e1"
                            />
                            <YAxis tick={{ fontSize: 8, fill: "#64748b" }} stroke="#cbd5e1" />
                            <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-[10px] font-mono text-slate-400">Nav nedēļas dienu sadalījuma</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. High-Density Raw Ledger Table Wrapper */}
                <div className="bg-white rounded-xl border border-slate-205 shadow-xs overflow-hidden flex flex-col shrink-0 h-[240px] min-h-0">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Pilnais vadības reģistrs</span>
                    <span className="text-[9px] font-bold font-mono text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                      SQLite tiešsaiste aktīva (Menedžments)
                    </span>
                  </div>
                  <div className="overflow-y-auto overflow-x-auto flex-1 max-h-[196px]">
                    {absences.length > 0 ? (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#fcfdfe] text-slate-550 font-bold border-b border-slate-200 sticky top-0 font-mono text-[9px] uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2">DARBINIEKS</th>
                            <th className="px-4 py-2">PERIODS</th>
                            <th className="px-4 py-2">KLASIFIKĀCIJA</th>
                            <th className="px-4 py-2">IEMESLS / APRAKSTS</th>
                            <th className="px-4 py-2 text-right">REĢISTRĒTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans text-slate-705">
                          {absences.map((abs) => {
                            const dateSpan = abs.date_from === abs.date_to
                              ? abs.date_from.substring(5)
                              : `${abs.date_from.substring(5)} - ${abs.date_to.substring(5)}`;
                            return (
                              <tr key={abs.id} className="hover:bg-slate-50 font-medium transition-colors">
                                <td className="px-4 py-2 font-bold text-slate-800">{abs.employee_name}</td>
                                <td className="px-4 py-2 text-slate-550 font-mono text-[10.5px]">{dateSpan}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getBadgeClass(abs.document_type)}`}>
                                    {abs.document_type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 truncate max-w-[220px] text-slate-600 font-medium" title={abs.reason}>
                                  {abs.reason}
                                </td>
                                <td className="px-4 py-2 text-right text-[10px] text-slate-400 font-mono">
                                  {abs.created_at.replace(" 00:00:00", "").substring(5)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2">
                        <Users className="h-8 w-8 text-slate-350" />
                        <span className="text-[11px] font-semibold text-slate-605">Nav pārskata doto datu šim laika posmam.</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT 4-COLUMNS PANEL */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-hidden h-full min-h-0">
                
                {/* 1. Gemini AI Analysis Block */}
                <div className="bg-slate-900 text-white p-5 rounded-xl flex-1 flex flex-col shadow-lg border border-slate-800 overflow-hidden h-full">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </div>
                    <h2 className="text-[11px] font-bold tracking-widest uppercase text-indigo-400 font-mono">Gemini AI analītika</h2>
                  </div>

                  {/* Scrollable markdown analyst diagnostic output */}
                  <div className="flex-1 overflow-y-auto text-xs leading-relaxed space-y-4 font-light text-slate-300 pr-1 select-text scrollbar-thin">
                    {isGeminiLoading ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-2 py-16 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent shadow-md"></div>
                        <p className="text-[10px] text-indigo-400 font-mono animate-pulse">Sagatavo operatīvo ziņojumu...</p>
                      </div>
                    ) : geminiError ? (
                      <div className="p-3.5 bg-rose-950/40 border border-rose-900 text-rose-300 rounded font-normal text-xs leading-normal">
                        <p className="font-bold mb-1">AI savienojuma kļūda:</p>
                        <p>{geminiError}</p>
                      </div>
                    ) : geminiAnalysis ? (
                      <div className="markdown-body prose prose-invert prose-xs max-w-none text-slate-350 leading-relaxed max-h-full">
                        <Markdown>{geminiAnalysis}</Markdown>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-2 text-slate-400 select-none">
                        <Brain className="h-8 w-8 text-indigo-500 fill-indigo-500/10 stroke-1" />
                        <p className="font-bold text-xs text-white">Stratēģiskā analīze gatava</p>
                        <p className="text-[10.5px] text-slate-400 leading-normal max-w-[210px]">
                          Gatavs sagrupēt paskaidrojumus un anomālijas, noteikt izdegšanas riska slieksni un sniegt tūlītējus vadības ieteikumus.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={runAIAnalysis}
                    disabled={isGeminiLoading || absences.length === 0}
                    className="mt-3.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-35 text-white rounded font-bold transition-all text-xs border border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.4)] cursor-pointer tracking-wider font-mono uppercase"
                  >
                    {isGeminiLoading ? "GATAVO HR ZIŅOJUMU..." : "VEIKT JAUNU ANALĪZI"}
                  </button>
                </div>

                {/* 2. Algorithmic Red Flags Matcher */}
                <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm shrink-0">
                  <h3 className="text-xs font-bold text-slate-550 uppercase mb-4 flex items-center justify-between">
                    <span>Sistēmas algoritmu brīdinājumi</span>
                    <span className="text-[9px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-rose-101 font-mono">
                      Augsta prioritāte
                    </span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    {/* Burnout block */}
                    <div className="flex gap-3">
                      <div className={`w-1 h-10 rounded-full shrink-0 ${stats.redFlags.burnout.length > 0 ? "bg-rose-500" : "bg-emerald-500"}`}></div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Izdegšanas riska skenēšana</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium leading-relaxed">
                          {stats.redFlags.burnout.length > 0
                            ? `${stats.redFlags.burnout.length} darbinieks(-i) ar vismaz 3 prombūtņu reizēm izvēlētajā periodā.`
                            : "0 aktīvu risku. Darbinieku slodze un resursi ir sabalansēti."}
                        </p>
                        {stats.redFlags.burnout.slice(0, 2).map((b) => (
                          <span key={b.employee_name} className="inline-block mt-1 mr-1 font-mono text-[9px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-101">
                            {b.employee_name} ({b.episodes} kavējumi)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Weekend extensions scanner */}
                    <div className="flex gap-3">
                      <div className={`w-1 h-10 rounded-full shrink-0 ${stats.redFlags.fridaySyndrome.length > 0 ? "bg-amber-500" : "bg-emerald-500"}`}></div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Piektdienas sindroma modelis</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium leading-relaxed">
                          {stats.redFlags.fridaySyndrome.length > 0
                            ? `${stats.redFlags.fridaySyndrome.length} darbinieks(-i) ar izteiktu tendenci uzsākt vai pabeigt prombūtni pie brīvdienām.`
                            : "Noviržu nav. Pagarināto brīvdienu un nedēļas nogales anomālijas nav konstatētas."}
                        </p>
                        {stats.redFlags.fridaySyndrome.slice(0, 2).map((f) => (
                          <span key={f.employee_name} className="inline-block mt-1 mr-1 font-mono text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-100">
                            {f.employee_name} ({f.episodes} uzsākumi piektdienā)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Area with System diagnostics */}
      <footer className="px-6 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0 select-none">
        <div className="text-[10px] text-slate-400 font-mono">
          DB STATUSS: <span className="text-emerald-500 font-bold">WAL REŽĪMS AKTĪVS</span> | DROŠĪBAS KLASS: ON-PREM DROŠS
        </div>
        <div className="text-[10px] text-slate-400 uppercase font-bold font-mono">
          Darbību nodrošina Node.js + SQLite + Gemini 3.5 AI
        </div>
      </footer>
    </div>
  );
}
