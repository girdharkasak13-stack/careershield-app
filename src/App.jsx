import React, { useState, useMemo } from "react";
import {
  Search,
  BarChart3,
  ClipboardList,
  Target,
  KeyRound,
  ShieldAlert,
  GraduationCap,
  Check,
  Upload,
  Camera,
  Star,
  Puzzle,
  Link2,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  Flame,
  MessageSquareText,
  ArrowRight,
  CheckCircle2,
  Database,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ---------------- theme tokens ---------------- */
const BG = "#0A0917";
const BG_SOFT = "#100D22";
const CARD = "#161331";
const CARD_2 = "#1C1840";
const BORDER = "rgba(139,110,255,0.16)";
const TEXT = "#EEECFB";
const MUTED = "rgba(238,236,251,0.6)";
const MUTED2 = "rgba(238,236,251,0.38)";
const SAFE = "#2DD4A7";
const WARN = "#F5A524";
const RISK = "#F0475C";
const GRAD_TEXT = "linear-gradient(90deg,#38BDF8 0%,#8B5CF6 55%,#EC4899 100%)";
const GRAD_BTN = "linear-gradient(90deg,#7C6CFB,#3B82F6)";

// Backend URL: set VITE_API_URL at deploy time (e.g. https://careershield-api.onrender.com). Falls back to local.
const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`;

/* ---------------- vocab / keyword tags ---------------- */
const TAG_LABELS = {
  fee: "processing fee",
  cert: "guaranteed placement",
  whatsapp: "whatsapp only",
  freemail: "gmail/yahoo id",
  urgency: "no interview needed",
  salary: "unrealistic salary",
  vague: "vague description",
  website: "no website",
  source: "unverified source",
};

const SOURCES = ["LinkedIn", "Naukri.com", "Internshala", "Campus Placement Cell", "PrepInsta", "WhatsApp / Telegram Group", "Other / Unknown"];
const COMMS = ["Official Email", "Phone Call", "Company Portal", "WhatsApp Only", "Telegram Only"];
const CERT_OPTS = ["Not mentioned", "Yes — 100% guaranteed", "No, performance based"];
const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "icloud.com"];

function bandOf(score) {
  if (score <= 30) return { label: "Safe", color: SAFE };
  if (score <= 70) return { label: "Suspicious", color: WARN };
  return { label: "High Risk", color: RISK };
}

/* ---- Text-based detectors: work on the offer-letter / OCR text itself ---- */
const FEE_RE = /(registration fee|processing fee|security deposit|training fee|refundable fee|kit charge|activation fee|(internship|enrol+ment|joining|onboarding|certification|certificate|verification|application|admission|course|program(me)?)\s+(fee|charges?)|\bfee of\s*(₹|rs\.?|inr)?\s?[\d,]+|(₹|rs\.?|inr)\s?[\d,]+\s*\/?-?\s*(as|towards|for)\s+(a\s+)?(registration|internship|training|processing)|pay.{0,25}(join|start|confirm|seat|register|registration)|fee\s+(is|will be)?\s*(applicable|payable|required|mandatory|non-?refundable))/;

// Pull a likely fee amount out of free text, e.g. "internship fee of 995/-"
function extractFeeFromText(text) {
  const t = text.replace(/\s+/g, " ");
  const m =
    t.match(/\bfee\s*(?:of|:|is|-)?\s*(?:rs\.?|inr|₹)?\s*([\d,]{2,7})/i) ||
    t.match(/(?:rs\.?|inr|₹)\s*([\d,]{2,7})\s*\/?-?\s*(?:as|towards|for)\s+(?:a\s+)?(?:registration|internship|training|processing)/i);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

// Best-effort auto-fill of the form from offer-letter text (only fills EMPTY fields)
function extractFieldsFromText(text) {
  const t = text.replace(/[ \t]+/g, " ");
  const out = {};
  const company = t.match(/(?:join|offer you .{0,60}?join|welcome to|greetings from)\s+([A-Z][\w&.\- ]{2,40}?)(?=\s+(?:as|for|!|\.|,)|[!.,]|$)/);
  if (company) out.company = company[1].trim();
  const role = t.match(/subject\s*:\s*([^\n]{3,60})/i);
  if (role) out.role = role[1].replace(/internship.*$/i, "").trim() || role[1].trim();
  const emails = (t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).filter((e) => !new RegExp("dear\\s+" + e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(t));
  if (emails[0]) out.email = emails[0];
  const web = t.match(/(?:https?:\/\/)?(www\.[\w-]+\.[\w.\/-]+)/i);
  if (web) out.website = "https://" + web[1];
  const fee = extractFeeFromText(t);
  if (fee > 0) out.fee = String(fee);
  const sal = t.match(/stipend[^\d₹]{0,40}(?:₹|rs\.?|inr)?\s*([\d,]{3,7})/i);
  if (sal) out.salary = String(Number(sal[1].replace(/,/g, "")));
  return out;
}

function analyze(f) {
  const raw = `${f.role} ${f.description}`;
  const text = raw.toLowerCase().replace(/\s+/g, " ");
  let score = 6;
  const risky = [], suspicious = [], missing = [], positive = [], tags = [];

  // Fee: from the form field OR detected inside the letter text
  const fee = Number(f.fee) || extractFeeFromText(raw);
  const feeInText = FEE_RE.test(text);
  if (fee > 0 || feeInText) { score += 46; risky.push(fee > 0 ? `Charges a fee of ₹${fee} — legitimate employers never bill candidates` : "Mentions a registration/internship/training fee — legitimate employers never bill candidates"); tags.push(TAG_LABELS.fee); }
  else positive.push("No upfront payment requested");

  if (/(after|upon|on)\s+(successful\s+)?(completion of\s+(the\s+)?)?(payment|paying).{0,60}(login|credentials|access|offer|joining|certificate)|(login|credentials|access).{0,50}(after|upon)\s+(the\s+)?(successful\s+)?payment/.test(text)) {
    score += 15; risky.push("Login/access is given only after payment"); tags.push("pay to get access");
  }

  if (f.certGuaranteed === CERT_OPTS[1] || /(100% (job |placement )?guarantee|guaranteed placement|guaranteed job)/.test(text)) { score += 14; risky.push("Promises a 100% guaranteed placement/certificate, which no ethical program can back"); tags.push(TAG_LABELS.cert); }

  if (f.comm === "WhatsApp Only" || f.comm === "Telegram Only" || /(whatsapp only|contact on whatsapp|telegram only)/.test(text)) { score += 10; suspicious.push("Communicates only through WhatsApp/Telegram instead of an official channel"); tags.push(TAG_LABELS.whatsapp); }
  else if (f.comm === "Official Email") positive.push("Uses an official email channel for communication");

  if (f.email) {
    const domain = f.email.split("@")[1]?.toLowerCase().trim();
    if (domain && FREE_MAIL.includes(domain)) { score += 15; risky.push(`Recruiter contact uses a free webmail domain (${domain})`); tags.push(TAG_LABELS.freemail); }
    else if (domain) positive.push("Recruiter contact uses a company email domain");
  } else missing.push("No recruiter contact email provided");

  if (f.website && f.website.trim()) positive.push("Company website was provided for verification");
  else { score += 6; missing.push("No company website provided"); tags.push(TAG_LABELS.website); }

  if (/(no interview|without interview|immediate joining|limited (seats|slots?)|hurry|act fast|instant certificate|as soon as possible|confirm your seat|reserve your seat|register now)/.test(text)) { score += 10; suspicious.push('Uses urgency / "confirm your seat" / limited-slots pressure'); tags.push(TAG_LABELS.urgency); }

  if (/dear\s+[^\s@]+@\S+/.test(text)) { score += 6; suspicious.push("Letter is addressed to an email ID instead of your name (mass-mailed)"); tags.push("generic greeting"); }
  if (/(offer letter|delighted to offer|offer you|you are being selected)/.test(text) && !/(interview|assessment|aptitude|hr round|technical round)/.test(text)) { score += 6; suspicious.push("Offer made without any interview or selection process"); tags.push("no interview"); }

  if (/(dummy project|training modules?|partner platform|\blms\b|learning management system)/.test(text) && /stipend/.test(text)) { score += 10; suspicious.push("Stipend depends on training modules / a dummy project (paid-course funnel)"); tags.push("conditional stipend"); }
  if (/stipend.{0,80}(only after|will be provided only|not during)/.test(text)) { score += 6; suspicious.push("Stipend is not guaranteed during the internship"); tags.push("no guaranteed pay"); }

  const salary = Number(f.salary) || 0;
  if (salary > 0) {
    if (salary >= 45000) { score += 14; suspicious.push("Monthly salary looks unrealistic for an entry-level internship"); tags.push(TAG_LABELS.salary); }
    else positive.push("Salary figure is within a plausible range");
  } else missing.push("No stipend/salary figure given");

  const wc = f.description.trim().split(/\s+/).filter(Boolean).length;
  if (wc > 0 && wc < 30) { score += 8; missing.push("Description is short and lacks role specifics"); tags.push(TAG_LABELS.vague); }
  else if (wc >= 30) positive.push("Description gives enough detail to evaluate the role");

  if (f.source === "WhatsApp / Telegram Group" || f.source === "Other / Unknown") { score += 10; suspicious.push("Sourced from an unverified channel rather than an official job platform"); tags.push(TAG_LABELS.source); }
  else if (f.source) positive.push(`Sourced from a recognized platform (${f.source})`);

  score = Math.max(2, Math.min(100, Math.round(score)));
  return { score, band: bandOf(score), risky, suspicious, missing, positive, tags };
}

/* No seed/demo data — everything below starts empty and fills up as the
   project is actually used, since this is being built from scratch. */
const SEED_SUBMISSIONS = [];
const SEED_FEEDBACK = [];

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-IN", { weekday: "short" }) });
  }
  return days;
}

/* ---------------- small ui helpers ---------------- */
const SHIELD_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 4 L88 18 V46 C88 72 68 90 50 98 C32 90 12 72 12 46 V18 Z'/%3E%3C/svg%3E")`;

function Logo({ size = 20 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, #38BDF8, #8B5CF6)",
          WebkitMaskImage: SHIELD_MASK, maskImage: SHIELD_MASK,
          WebkitMaskSize: "contain", maskSize: "contain",
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          WebkitMaskPosition: "center", maskPosition: "center",
        }}
      />
      <GraduationCap
        size={size * 0.46}
        color="#fff"
        strokeWidth={2.2}
        style={{ position: "absolute", top: "44%", left: "50%", transform: "translate(-50%,-50%)" }}
      />
      <div
        style={{
          position: "absolute", right: -size * 0.06, bottom: size * 0.04,
          width: size * 0.42, height: size * 0.42, borderRadius: "50%",
          background: "#22C55E", border: `${Math.max(1, size * 0.045)}px solid #0A0917`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Check size={size * 0.26} color="#fff" strokeWidth={4} />
      </div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12.5px]"
      style={{ background: "rgba(139,110,255,0.12)", border: `1px solid ${BORDER}`, color: "#C4B5FD" }}
    >
      {children}
    </span>
  );
}

function GradText({ children, as: As = "span", style }) {
  return (
    <As style={{ backgroundImage: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", ...style }}>
      {children}
    </As>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-[13px]" style={{ color: "#B9AEF9" }}>{label}{required && " *"}</span>
      {children}
    </label>
  );
}

const inputCls = "mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none";
const inputStyle = { background: BG_SOFT, border: `1px solid ${BORDER}`, color: TEXT };

function Stars({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange && onChange(n)}>
          <Star size={18} fill={n <= value ? "#F5A524" : "none"} color={n <= value ? "#F5A524" : MUTED2} />
        </button>
      ))}
    </div>
  );
}

function loadSaved(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/* ---------------- main ---------------- */
export default function CareerShield() {
  const [tab, setTab] = useState("home");
  const [submissions, setSubmissions] = useState(() => loadSaved("cs_submissions", SEED_SUBMISSIONS));
  const [feedback, setFeedback] = useState(() => loadSaved("cs_feedback", SEED_FEEDBACK));
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    localStorage.setItem("cs_submissions", JSON.stringify(submissions));
  }, [submissions]);

  React.useEffect(() => {
    localStorage.setItem("cs_feedback", JSON.stringify(feedback));
  }, [feedback]);

  const [form, setForm] = useState({
    company: "", role: "", email: "", website: "", fee: "", salary: "",
    comm: "", certGuaranteed: "", source: "", description: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [ocrText, setOcrText] = useState("");

  const resetForm = () => {
    setForm({ company: "", role: "", email: "", website: "", fee: "", salary: "", comm: "", certGuaranteed: "", source: "", description: "" });
    setOcrText("");
    setResult(null);
  };

  const goToNewAnalysis = () => {
    resetForm();
    setTab("check");
  };

  const mergedForm = useMemo(
    () => ({ ...form, description: ocrText.trim() ? `${form.description}\n${ocrText}`.trim() : form.description }),
    [form, ocrText]
  );

  const computeBlendedRisk = async (formData) => {
    const res = analyze(formData);
    let finalScore = res.score;
    let mlStatus = "offline";
    let mlProb = null;
    try {
      const resp = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${formData.role} ${formData.description}` }),
        signal: AbortSignal.timeout(2500),
      });
      if (resp.ok) {
        const data = await resp.json();
        mlProb = data.fraud_probability;
        finalScore = Math.round(Math.max(res.score, mlProb) * 0.65 + Math.min(res.score, mlProb) * 0.35);
        // a hard rule-based "High Risk" (e.g. fee asked) must never be pulled down by a low ML score
        if (res.score > 70) finalScore = Math.max(finalScore, res.score);
        mlStatus = "connected";
      }
    } catch (e) {
      // backend not running — silently keep the rule-based score
    }
    return { ...res, score: finalScore, band: bandOf(finalScore), mlStatus, mlProb };
  };

  const [livePreview, setLivePreview] = useState({ score: 0, band: bandOf(0), mlStatus: "offline", loading: false });

  React.useEffect(() => {
    if (!mergedForm.description.trim() && !mergedForm.company.trim()) {
      setLivePreview({ score: 0, band: bandOf(0), mlStatus: "offline", loading: false });
      return;
    }
    let cancelled = false;
    setLivePreview((p) => ({ ...p, loading: true }));
    const t = setTimeout(async () => {
      const r = await computeBlendedRisk(mergedForm);
      if (!cancelled) setLivePreview({ score: r.score, band: r.band, mlStatus: r.mlStatus, loading: false });
    }, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mergedForm]);

  const [analyzing, setAnalyzing] = useState(false);

  const runAnalysis = async () => {
    setAnalyzing(true);
    const r = await computeBlendedRisk(mergedForm);
    const entry = { id: Date.now(), company: form.company || "Unnamed employer", role: form.role || "Role not specified", score: r.score, fee: Number(form.fee) || 0, salary: Number(form.salary) || 0, date: new Date().toISOString().slice(0, 10), source: form.source || "Other / Unknown", tags: r.tags };
    setSubmissions((s) => [entry, ...s]);
    setResult({ ...r, company: entry.company, role: entry.role });
    setAnalyzing(false);
    setTab("check");
  };

  const stats = useMemo(() => {
    const total = submissions.length;
    const fake = submissions.filter((s) => s.score > 70).length;
    const genuine = submissions.filter((s) => s.score <= 30).length;
    const avg = Math.round(submissions.reduce((a, s) => a + s.score, 0) / (total || 1));
    return { total, fakeRate: Math.round((fake / (total || 1)) * 100), genuineRate: Math.round((genuine / (total || 1)) * 100), avg };
  }, [submissions]);

  return (
    <div style={{ background: BG, minHeight: "100%", fontFamily: "'Inter', sans-serif", color: TEXT }}>
      <style>{FONT}</style>
      <NavBar tab={tab} setTab={setTab} />
      {tab === "home" && <Home setTab={setTab} feedback={feedback} />}
      {tab === "check" && (
        <CheckTab form={form} set={set} setForm={setForm} livePreview={livePreview} runAnalysis={runAnalysis} result={result} ocrText={ocrText} setOcrText={setOcrText} analyzing={analyzing} resetForm={resetForm} />
      )}
      {tab === "dashboard" && <Dashboard submissions={submissions} stats={stats} setTab={setTab} goToNewAnalysis={goToNewAnalysis} />}
      {tab === "feedback" && <FeedbackTab feedback={feedback} setFeedback={setFeedback} />}
      {tab === "extension" && <ExtensionInfoTab />}
      <Footer />
    </div>
  );
}

/* ---------------- nav ---------------- */
function NavBar({ tab, setTab }) {
  const items = [
    ["home", "Home"],
    ["check", "Check Internship"],
    ["dashboard", "Dashboard"],
    ["feedback", "Reviews"],
    ["extension", "Extension"],
  ];
  return (
    <div className="border-b sticky top-0 z-10" style={{ borderColor: BORDER, background: "rgba(10,9,23,0.9)", backdropFilter: "blur(8px)" }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => setTab("home")} className="flex items-center gap-2">
          <Logo size={26} />
          <GradText as="span" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "18px" }}>CareerShield</GradText>
        </button>
        <nav className="flex items-center gap-1 flex-wrap">
          {items.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="px-3 py-1.5 text-[13.5px] rounded-lg"
              style={{ color: tab === k ? TEXT : MUTED, fontWeight: tab === k ? 600 : 500, background: tab === k ? "rgba(139,110,255,0.12)" : "transparent" }}
            >
              {l}
            </button>
          ))}
          <button
            onClick={() => setTab("check")}
            className="ml-2 px-4 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1.5"
            style={{ background: GRAD_BTN, color: "#fff" }}
          >
            Analyze Now <ArrowRight size={14} />
          </button>
        </nav>
      </div>
    </div>
  );
}

/* ---------------- home ---------------- */
function Home({ setTab, feedback }) {
  return (
    <div>
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="flex justify-center"><Pill><span style={{ width: 6, height: 6, borderRadius: 99, background: "#2DD4A7", display: "inline-block" }} />AI-Powered Job &amp; Internship Fraud Detection</Pill></div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "46px", lineHeight: 1.15, marginTop: "22px" }}>
          Your <GradText>Shield</GradText> Before You Apply.
        </h1>
        <p className="mt-5 text-[16px] max-w-xl mx-auto" style={{ color: MUTED }}>
          CareerShield combines a machine learning model trained on real scam data with rule-based recruiter checks to flag risky job and internship listings — right in your browser with our Chrome extension.
        </p>
        <div className="mt-8 flex justify-center gap-3 flex-wrap">
          <button onClick={() => setTab("check")} className="px-5 py-3 rounded-full text-[14px] font-semibold flex items-center gap-2" style={{ background: GRAD_BTN, color: "#fff" }}>
            <Search size={15} /> Analyze a Listing
          </button>
          <button onClick={() => setTab("dashboard")} className="px-5 py-3 rounded-full text-[14px] font-semibold flex items-center gap-2" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
            <BarChart3 size={15} /> View Analytics
          </button>
        </div>
      </div>

      {/* real training facts — no placeholder numbers, straight from the Kaggle run */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-x" style={{ background: CARD, border: `1px solid ${BORDER}`, borderColor: BORDER }}>
          {[
            ["98%", "Model Accuracy (EMSCAD test set)"],
            ["17,880", "Job Postings (EMSCAD dataset)"],
            ["3-Layer", "Risk Engine — ML + Rules + Extension"],
          ].map(([n, l], i) => (
            <div key={i} className="px-4 py-7 text-center" style={{ borderColor: BORDER }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "30px", color: "#8FA9FF" }}>{n}</div>
              <div className="text-[12.5px] mt-1.5" style={{ color: MUTED }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* features */}
      <div className="max-w-5xl mx-auto px-6 pt-20">
        <div className="text-[12px] font-semibold tracking-wide" style={{ color: "#38BDF8" }}>CORE FEATURES</div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "30px", marginTop: "8px" }}>
          Everything You Need to <GradText>Stay Safe</GradText>
        </h2>
        <p className="mt-3 max-w-lg text-[14.5px]" style={{ color: MUTED }}>
          Tools to identify suspicious internship offers, wherever you found them, before they cause harm.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          <FeatureCard icon={Target} color="#F0475C" title="Risk Scoring Engine" body='Rule-based analytics evaluate 9 risk factors and generate a 0–100 scam risk score in seconds.' />
          <FeatureCard icon={KeyRound} color="#F5A524" title="Keyword Detection" body='Automatically flags scam-associated phrases like "guaranteed placement", "pay now" and "100% job guarantee".' />
          <FeatureCard icon={BarChart3} color="#8B5CF6" title="Visual Analytics" body="Charts break down exactly why an internship was flagged, with color-coded risk indicators." />
          <FeatureCard icon={Link2} color="#38BDF8" title="Multi-Platform Checker" body="Log where you found the listing — LinkedIn, Naukri, Internshala, campus cell or PrepInsta — and factor that into the score." />
          <FeatureCard icon={Puzzle} color="#2DD4A7" title="Chrome Extension" body="Check any job listing right on LinkedIn, Naukri, or Indeed — install the CareerShield extension from the project files." />
          <FeatureCard icon={MessageSquareText} color="#EC4899" title="Company Reviews" body="Search any company and see what actually happened when other students applied — genuine offer, ghosted, or a scam." />
        </div>
      </div>

      {/* extension teaser */}
      <div className="max-w-5xl mx-auto px-6 pt-16">
        <div className="rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#2DD4A722" }}>
              <Puzzle size={18} color="#2DD4A7" />
            </div>
            <div>
              <div className="text-[14.5px] font-semibold">Also works as a Chrome Extension</div>
              <div className="text-[12.5px]" style={{ color: MUTED }}>Check listings right on LinkedIn, Naukri, or Internshala — no copy-pasting.</div>
            </div>
          </div>
          <button onClick={() => setTab("extension")} className="text-[13px] font-semibold flex items-center gap-1" style={{ color: "#8FA9FF" }}>
            See how it works <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* red flags */}
      <div className="max-w-5xl mx-auto px-6 pt-20">
        <div className="rounded-2xl p-8" style={{ background: "rgba(240,71,92,0.06)", border: `1px solid rgba(240,71,92,0.3)` }}>
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wide" style={{ color: RISK }}>
            <ShieldAlert size={14} /> SCAM AWARENESS
          </div>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "24px", marginTop: "8px" }}>Common Red Flags to Watch For</h3>
          <div className="grid sm:grid-cols-2 gap-5 mt-6">
            {[
              ["Registration / Processing Fees", "Legitimate companies never ask students to pay a fee to join an internship program."],
              ["Gmail / Yahoo Email IDs", "Real companies use official business domain emails, not free providers."],
              ["Guaranteed Placement Promises", "No ethical company can guarantee 100% placement — it's a classic lure."],
              ["No Official Website", "Reputable organizations have verified web presence. No website = high risk."],
              ["WhatsApp-Only Communication", "Scammers avoid traceable official channels and prefer informal apps."],
              ["Unrealistic Salary for Interns", "₹45,000+/month for a beginner internship with no experience? Big red flag."],
            ].map(([t, d], i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RISK }} />
                <div className="text-[13.5px]"><span className="font-semibold">{t}: </span><span style={{ color: MUTED }}>{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* company reviews */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <div className="text-[12px] font-semibold tracking-wide" style={{ color: "#38BDF8" }}>COMPANY REVIEWS</div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "26px", marginTop: "8px" }}>What Happened When They <GradText>Applied</GradText></h3>
          <button onClick={() => setTab("feedback")} className="text-[13px] font-semibold flex items-center gap-1" style={{ color: "#8FA9FF" }}>
            Search companies &amp; add yours <ArrowRight size={13} />
          </button>
        </div>
        {feedback.length === 0 ? (
          <div className="rounded-2xl p-8 mt-8 text-center" style={{ border: `1px dashed ${BORDER}` }}>
            <p className="text-[13.5px]" style={{ color: MUTED2 }}>No reviews yet — be the first to share what happened when you applied somewhere.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-5 mt-8">
            {feedback.slice(0, 3).map((t) => <TestimonialCard key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, color, title, body }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
        <Icon size={18} color={color} />
      </div>
      <div className="mt-4 text-[15px] font-semibold">{title}</div>
      <div className="mt-1.5 text-[13.5px]" style={{ color: MUTED }}>{body}</div>
    </div>
  );
}

const OUTCOME_STYLE = {
  "Genuine — got the offer": { color: SAFE },
  "Never heard back": { color: MUTED },
  "Asked for money/fee": { color: WARN },
  "Confirmed scam": { color: RISK },
  "Still in process": { color: "#38BDF8" },
};

function TestimonialCard({ t }) {
  const oc = OUTCOME_STYLE[t.outcome] || { color: MUTED };
  return (
    <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[14.5px] font-semibold">{t.company}</div>
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0" style={{ color: oc.color, border: `1px solid ${oc.color}` }}>{t.outcome}</span>
      </div>
      <div className="text-[12px] mt-0.5" style={{ color: MUTED2 }}>{t.role}</div>
      <div className="flex gap-0.5 mt-2">
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} fill={n <= t.rating ? "#F5A524" : "none"} color={n <= t.rating ? "#F5A524" : MUTED2} />)}
      </div>
      <p className="mt-2.5 text-[13.5px]" style={{ color: "rgba(238,236,251,0.85)" }}>"{t.text}"</p>
      <div className="flex items-center gap-2.5 mt-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ background: CARD_2, color: "#C4B5FD" }}>
          {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div>
          <div className="text-[13px] font-semibold">{t.name}</div>
          <div className="text-[11.5px]" style={{ color: MUTED2 }}>{t.college}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- OCR: image + PDF text extraction ---------------- */
const TESSERACT_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js";
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

function loadScript(src, isLoaded) {
  return new Promise((resolve, reject) => {
    if (isLoaded()) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load " + src)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.body.appendChild(s);
  });
}

async function ensureTesseract() {
  await loadScript(TESSERACT_URL, () => !!window.Tesseract);
}

async function ensurePdfJs() {
  await loadScript(PDFJS_URL, () => !!window.pdfjsLib);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
}

async function extractFromImage(file, onProgress) {
  await ensureTesseract();
  const { data } = await window.Tesseract.recognize(file, "eng", {
    logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100)); },
  });
  return data.text;
}

async function extractFromPDF(file, onProgress) {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let full = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(" ");
    if (pageText.trim().length > 20) {
      full += pageText + "\n";
    } else {
      // likely a scanned page with no text layer — render it and OCR the image
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      await ensureTesseract();
      const { data } = await window.Tesseract.recognize(canvas, "eng");
      full += data.text + "\n";
    }
    if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100));
  }
  return full;
}

/* ---------------- check internship ---------------- */
function CheckTab({ form, set, setForm, livePreview, runAnalysis, result, ocrText, setOcrText, analyzing, resetForm }) {
  const canSubmit = !!(form.description.trim() || ocrText.trim());
  const [ocrStatus, setOcrStatus] = useState("idle"); // idle | loading | done | error
  const [ocrProgress, setOcrProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setOcrStatus("loading");
    setOcrProgress(0);
    setOcrError("");
    setOcrText("");
    try {
      let text = "";
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) text = await extractFromPDF(file, setOcrProgress);
      else if (file.type.startsWith("image/")) text = await extractFromImage(file, setOcrProgress);
      else throw new Error("Please upload an image or a PDF file.");
      setOcrText(text.trim());
      // auto-fill any EMPTY form fields (company, role, email, website, fee, stipend) from the letter
      const found = extractFieldsFromText(text);
      setForm((f) => {
        const next = { ...f };
        Object.entries(found).forEach(([k, v]) => { if (!String(next[k] || "").trim()) next[k] = v; });
        return next;
      });
      setOcrStatus(text.trim() ? "done" : "error");
      if (!text.trim()) setOcrError("Couldn't find any readable text in that file — try a clearer screenshot, or paste the text manually below.");
    } catch (err) {
      setOcrStatus("error");
      setOcrError("Something went wrong reading that file. You can paste the offer letter text manually below instead.");
    }
  };

  const handleFile = (e) => processFile(e.target.files[0]);

  const openCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch (err) {
      setCameraError("Couldn't access the camera. Check browser permissions, or use the upload option instead.");
    }
  };

  const closeCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    closeCamera();
    canvas.toBlob((blob) => {
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      processFile(file);
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="text-center">
        <div className="flex justify-center"><Pill><Search size={12} /> RISK ANALYSIS</Pill></div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "32px", marginTop: "14px" }}>Check Your Internship Offer</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: MUTED }}>Fill in the details below. Our engine evaluates 9 risk factors and gives you an instant scam risk score.</p>
      </div>

      <div className="rounded-2xl p-7 mt-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Company Name" required><input className={inputCls} style={inputStyle} placeholder="e.g. Infosys, XYZ Solutions" value={form.company} onChange={set("company")} /></Field>
          <Field label="Internship Role" required><input className={inputCls} style={inputStyle} placeholder="e.g. Web Developer, Marketing Intern" value={form.role} onChange={set("role")} /></Field>
          <Field label="Contact Email"><input className={inputCls} style={inputStyle} placeholder="contact@company.com" value={form.email} onChange={set("email")} /></Field>
          <Field label="Website URL"><input className={inputCls} style={inputStyle} placeholder="https://www.company.com" value={form.website} onChange={set("website")} /></Field>
          <Field label="Registration / Processing Fee (₹)"><input type="number" className={inputCls} style={inputStyle} placeholder="0 (enter 0 if no fee)" value={form.fee} onChange={set("fee")} /></Field>
          <Field label="Monthly Salary Offered (₹)"><input type="number" className={inputCls} style={inputStyle} placeholder="e.g. 10000" value={form.salary} onChange={set("salary")} /></Field>
          <Field label="Primary Communication Method">
            <select className={inputCls} style={inputStyle} value={form.comm} onChange={set("comm")}>
              <option value="">Select method</option>
              {COMMS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Certificate Guaranteed?">
            <select className={inputCls} style={inputStyle} value={form.certGuaranteed} onChange={set("certGuaranteed")}>
              <option value="">Select</option>
              {CERT_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Where did you find this listing?">
              <select className={inputCls} style={inputStyle} value={form.source} onChange={set("source")}>
                <option value="">Select platform</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Internship Description" required>
              <textarea rows={5} className={inputCls} style={inputStyle} placeholder="Paste the full internship offer description here..." value={form.description} onChange={set("description")} />
            </Field>
          </div>
        </div>

        {/* OCR: offer letter / screenshot upload */}
        <div className="rounded-xl p-5 mt-5" style={{ background: BG_SOFT, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "#B9AEF9" }}>
            <Upload size={14} /> Offer letter / screenshot (optional)
          </div>
          <p className="text-[12px] mt-1" style={{ color: MUTED2 }}>Upload a photo or PDF of the offer letter — text is extracted automatically via OCR and added to the analysis.</p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-semibold cursor-pointer" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
              <Upload size={13} /> Choose image or PDF
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
            </label>
            <button onClick={openCamera} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-semibold" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
              <Camera size={13} /> Scan with Camera
            </button>
            {fileName && <span className="text-[12px]" style={{ color: MUTED2 }}>{fileName}</span>}
          </div>
          {cameraError && <p className="mt-2 text-[12.5px]" style={{ color: RISK }}>{cameraError}</p>}

          {showCamera && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
              <div className="rounded-2xl p-4 w-full max-w-md" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="text-[13px] font-semibold mb-2">Position the offer letter in frame</div>
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" style={{ background: "#000" }} />
                <div className="flex gap-2 mt-3">
                  <button onClick={capturePhoto} className="flex-1 py-2.5 rounded-full text-[13px] font-semibold" style={{ background: GRAD_BTN, color: "#fff" }}>
                    Capture
                  </button>
                  <button onClick={closeCamera} className="px-4 py-2.5 rounded-full text-[13px]" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {ocrStatus === "loading" && (
            <div className="mt-3">
              <div className="flex justify-between text-[12px]" style={{ color: MUTED }}><span>Reading text…</span><span>{ocrProgress}%</span></div>
              <div className="h-1.5 rounded-full mt-1" style={{ background: CARD }}>
                <div className="h-full rounded-full" style={{ width: `${ocrProgress}%`, background: GRAD_BTN }} />
              </div>
            </div>
          )}

          {ocrStatus === "error" && <p className="mt-3 text-[12.5px]" style={{ color: RISK }}>{ocrError}</p>}

          {(ocrStatus === "done" || ocrText) && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: SAFE }}>
                <CheckCircle2 size={13} /> Text extracted — edit it below if anything looks off
              </div>
              <textarea rows={4} className={inputCls} style={inputStyle} value={ocrText} onChange={(e) => setOcrText(e.target.value)} />
            </div>
          )}
        </div>


        {/* live preview — uses the exact same blended calculation as the final result */}
        <div className="rounded-xl p-5 mt-5" style={{ background: BG_SOFT, border: `1px solid ${BORDER}` }}>
          <div className="text-[13px] flex items-center gap-2" style={{ color: "#B9AEF9" }}>
            Live Preview — <span style={{ color: livePreview.band.color, fontWeight: 700 }}>{livePreview.loading ? "calculating…" : livePreview.band.label}</span>
          </div>
          <div className="mt-3 h-2 rounded-full relative" style={{ background: "linear-gradient(90deg,#2DD4A7,#F5A524,#F0475C)" }}>
            <div className="absolute -top-1.5 w-3 h-5 rounded transition-all" style={{ left: `calc(${livePreview.score}% - 6px)`, background: "#fff", boxShadow: "0 0 0 2px rgba(0,0,0,0.3)", opacity: livePreview.loading ? 0.5 : 1 }} />
          </div>
          <div className="flex justify-between text-[11.5px] mt-2" style={{ color: MUTED2 }}>
            <span>Safe (0)</span><span>Suspicious (40–70)</span><span>High Risk (100)</span>
          </div>
          <p className="mt-2.5 text-[11.5px]" style={{ color: MUTED2 }}>
            {livePreview.mlStatus === "connected" ? "Includes the connected ML model — matches the final score exactly." : "Rule-based only (ML backend not connected) — matches the final score exactly."}
          </p>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            disabled={!canSubmit || analyzing}
            onClick={runAnalysis}
            className="flex-1 py-3.5 rounded-full text-[14px] font-semibold flex items-center justify-center gap-2"
            style={{ background: GRAD_BTN, color: "#fff", opacity: canSubmit && !analyzing ? 1 : 0.4, cursor: canSubmit && !analyzing ? "pointer" : "not-allowed" }}
          >
            <Search size={15} /> {analyzing ? "Analyzing…" : "Analyze Internship Risk"}
          </button>
          {(form.company || form.description || result) && (
            <button
              onClick={resetForm}
              className="px-5 py-3.5 rounded-full text-[13.5px]"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }) {
  const { score, band, risky, suspicious, missing, positive, company, role, mlStatus, mlProb } = result;
  return (
    <div className="rounded-2xl p-7 mt-6" style={{ background: CARD, border: `1px solid ${band.color}55` }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[12px]" style={{ color: MUTED2 }}>{company} · {role}</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "22px" }}>Risk Report</div>
        </div>
        <div className="px-4 py-1.5 rounded-full text-[12.5px] font-semibold" style={{ color: band.color, border: `1px solid ${band.color}` }}>{band.label.toUpperCase()}</div>
      </div>
      <div className="flex items-end gap-3 mt-4">
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "42px", color: band.color }}>{score}</div>
        <div className="text-[13px] pb-1.5" style={{ color: MUTED2 }}>/ 100</div>
      </div>
      {mlStatus === "connected" ? (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]" style={{ background: "rgba(45,212,167,0.12)", color: SAFE }}>
          <CheckCircle2 size={11} /> ML model connected — EMSCAD model scored this {mlProb}% fraud, blended with rule checks
        </div>
      ) : (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]" style={{ background: BG_SOFT, color: MUTED2 }}>
          Rule-based score only — start the FastAPI backend to include the trained ML model
        </div>
      )}
      <ReasonRow label="Matched risky patterns" items={risky} color={RISK} />
      <ReasonRow label="Suspicious indicators" items={suspicious} color={WARN} />
      <ReasonRow label="Missing information" items={missing} color={MUTED} />
      <ReasonRow label="Positive indicators" items={positive} color={SAFE} />
    </div>
  );
}

function ReasonRow({ label, items, color }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <div className="text-[12px] font-semibold" style={{ color: "#B9AEF9" }}>{label}</div>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-[13.5px] pl-4 relative leading-snug">
            <span className="absolute left-0" style={{ color }}>—</span>{it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- dashboard ---------------- */
function Dashboard({ submissions, stats, setTab, goToNewAnalysis }) {
  const [risk, setRisk] = useState("All Risk Levels");
  const [source, setSource] = useState("All Sources");
  const [view, setView] = useState("overview"); // overview | submissions
  const [extSubmissions, setExtSubmissions] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const syncExtension = () => {
    setSyncing(true);
    fetch(`${API_BASE}/submissions`)
      .then((r) => r.json())
      .then((data) => {
        const mapped = (data.submissions || []).map((s, i) => ({
          id: `ext-${i}-${s.date}-${s.company}`,
          company: s.company || "Unknown",
          role: s.role || "Not specified",
          score: s.score,
          fee: 0,
          salary: 0,
          date: s.date || new Date().toISOString().slice(0, 10),
          source: s.source || "Chrome Extension",
          tags: s.tags || [],
        }));
        setExtSubmissions(mapped);
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  };

  React.useEffect(() => { syncExtension(); }, []);

  const allSubmissions = useMemo(() => [...extSubmissions, ...submissions], [extSubmissions, submissions]);

  const filtered = allSubmissions.filter((s) => {
    const b = bandOf(s.score).label;
    const okRisk = risk === "All Risk Levels" || b === risk;
    const okSource = source === "All Sources" || s.source === source;
    return okRisk && okSource;
  });

  const dist = useMemo(() => {
    const safe = allSubmissions.filter((s) => s.score <= 30).length;
    const susp = allSubmissions.filter((s) => s.score > 30 && s.score <= 70).length;
    const high = allSubmissions.filter((s) => s.score > 70).length;
    return [
      { name: "Safe", value: safe, color: SAFE },
      { name: "Suspicious", value: susp, color: WARN },
      { name: "High Risk", value: high, color: RISK },
    ];
  }, [allSubmissions]);

  const keywordFreq = useMemo(() => {
    const map = {};
    allSubmissions.forEach((s) => (s.tags || []).forEach((t) => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allSubmissions]);
  const maxFreq = keywordFreq[0]?.[1] || 1;

  const weekly = useMemo(() => {
    return last7Days().map(({ key, label }) => {
      const dayItems = allSubmissions.filter((s) => s.date === key);
      return { day: label, total: dayItems.length, flagged: dayItems.filter((s) => s.score > 70).length };
    });
  }, [allSubmissions]);

  const liveStats = useMemo(() => {
    const total = allSubmissions.length;
    const fake = allSubmissions.filter((s) => s.score > 70).length;
    const genuine = allSubmissions.filter((s) => s.score <= 30).length;
    const avg = Math.round(allSubmissions.reduce((a, s) => a + s.score, 0) / (total || 1));
    return { total, fakeRate: Math.round((fake / (total || 1)) * 100), genuineRate: Math.round((genuine / (total || 1)) * 100), avg };
  }, [allSubmissions]);

  const exportCSV = () => {
    const header = "Company,Role,Score,Risk,Fee,Salary,Source,Date\n";
    const rows = allSubmissions.map((s) => `${s.company},${s.role},${s.score},${bandOf(s.score).label},${s.fee},${s.salary},${s.source},${s.date}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "careershield_report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const SIDEBAR_ITEMS = [
    ["overview", "Overview", BarChart3, "#8B6EFF"],
    ["submissions", "Submissions", ClipboardList, "#F5A524"],
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "26px" }}>Admin Analytics Dashboard</h1>
          <p className="text-[13.5px]" style={{ color: MUTED }}>Real-time job & internship scam intelligence</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3.5 py-2 rounded-lg text-[12.5px] flex items-center gap-1.5" style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
            <Calendar size={13} /> {new Date().toDateString()}
          </div>
          <button onClick={syncExtension} className="px-3.5 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5" style={{ background: CARD_2, color: TEXT }}>
            <Puzzle size={13} /> {syncing ? "Syncing…" : "Sync Extension"}
          </button>
          <button onClick={exportCSV} className="px-3.5 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5" style={{ background: CARD_2, color: TEXT }}>
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      <div className="flex gap-6 mt-6 items-start">
        <aside className="w-52 shrink-0 rounded-2xl p-4 hidden md:block" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="text-[10.5px] font-semibold tracking-wide px-4 mb-3" style={{ color: MUTED2 }}>ANALYTICS</div>
          {SIDEBAR_ITEMS.map(([key, label, Icon, color]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13.5px] mb-1 relative"
              style={{ background: view === key ? "rgba(139,110,255,0.14)" : "transparent", color: view === key ? TEXT : MUTED, fontWeight: view === key ? 600 : 500 }}
            >
              {view === key && <span className="absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full" style={{ background: "#8B6EFF" }} />}
              <Icon size={15} color={view === key ? color : MUTED2} /> {label}
            </button>
          ))}
          <button
            onClick={goToNewAnalysis}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13.5px] mt-2"
            style={{ color: "#8FA9FF", fontWeight: 600, borderTop: `1px solid ${BORDER}` }}
          >
            <Search size={15} color="#8FA9FF" /> New Analysis
          </button>
          <div className="text-[10px] px-4 mt-4 leading-relaxed" style={{ color: MUTED2 }}>
            CareerShield v1.0<br />React · FastAPI · Scikit-learn
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {view === "overview" && (
            <>
              <div className="grid sm:grid-cols-4 gap-4">
                <StatCard label="Total Analyzed" value={liveStats.total} delta={`${extSubmissions.length} from extension`} up bg="#7C3AED" />
                <StatCard label="Fake Rate" value={`${liveStats.fakeRate}%`} delta="High risk share" up bg="#DC2626" />
                <StatCard label="Genuine Rate" value={`${liveStats.genuineRate}%`} delta="Safe share" bg="#059669" />
                <StatCard label="Avg Risk Score" value={liveStats.avg} delta="Across all checks" bg="#2563EB" />
              </div>

              <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="flex justify-between text-[14px] font-semibold"><span>Weekly Submission Trend</span><span className="text-[11.5px] font-normal" style={{ color: MUTED2 }}>Last 7 days</span></div>
                  <div style={{ width: "100%", height: 220, marginTop: 10 }}>
                    <ResponsiveContainer>
                      <LineChart data={weekly}>
                        <CartesianGrid stroke={BORDER} vertical={false} />
                        <XAxis dataKey="day" stroke={MUTED2} fontSize={12} />
                        <YAxis stroke={MUTED2} fontSize={12} />
                        <Tooltip contentStyle={{ background: BG_SOFT, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="total" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                        <Line type="monotone" dataKey="flagged" stroke={RISK} strokeWidth={2} dot={{ r: 3 }} name="Flagged" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="flex justify-between text-[14px] font-semibold"><span>Risk Distribution</span><span className="text-[11.5px] font-normal" style={{ color: MUTED2 }}>All submissions</span></div>
                  <div style={{ width: "100%", height: 200, marginTop: 10 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={dist} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={3}>
                          {dist.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 text-[11.5px] mt-1">
                    {dist.map((d) => <span key={d.name} className="flex items-center gap-1.5" style={{ color: MUTED }}><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}</span>)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-5 mt-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-1.5 text-[14px] font-semibold"><Flame size={14} color={WARN} /> Top Scam Keywords</div>
                {keywordFreq.length === 0 ? (
                  <p className="text-[13px] mt-3" style={{ color: MUTED2 }}>No patterns matched yet — flagged keywords from your analyses will show up here.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {keywordFreq.map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-[12.5px]"><span style={{ color: MUTED }}>"{k}"</span><span style={{ color: MUTED2 }}>{v}</span></div>
                        <div className="h-1.5 rounded-full mt-1" style={{ background: BG_SOFT }}>
                          <div className="h-full rounded-full" style={{ width: `${(v / maxFreq) * 100}%`, background: "linear-gradient(90deg,#F5A524,#F0475C)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {view === "submissions" && (
            <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-[14px] font-semibold">Recent Submissions</div>
                <div className="flex gap-2">
                  <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded-lg px-3 py-1.5 text-[12.5px]" style={inputStyle}>
                    {["All Risk Levels", "Safe", "Suspicious", "High Risk"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg px-3 py-1.5 text-[12.5px]" style={inputStyle}>
                    <option>All Sources</option>
                    {SOURCES.map((s) => <option key={s}>{s}</option>)}
                    <option>Chrome Extension</option>
                  </select>
                </div>
              </div>
              {allSubmissions.length === 0 ? (
                <p className="text-[13px] mt-4" style={{ color: MUTED2 }}>No listings analyzed yet. Run a check from the "Check Internship" tab, or use the Chrome extension, and it'll show up here.</p>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ color: MUTED2 }}>
                        {["Company", "Role", "Risk", "Level", "Fee", "Source", "Date"].map((h) => <th key={h} className="text-left font-normal pb-2 pr-4">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const b = bandOf(s.score);
                        return (
                          <tr key={s.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td className="py-2.5 pr-4 font-medium">{s.company}</td>
                            <td className="py-2.5 pr-4" style={{ color: MUTED }}>{s.role}</td>
                            <td className="py-2.5 pr-4 font-semibold" style={{ color: b.color }}>{s.score}%</td>
                            <td className="py-2.5 pr-4"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: b.color, border: `1px solid ${b.color}` }}>{b.label}</span></td>
                            <td className="py-2.5 pr-4" style={{ color: MUTED }}>{s.fee ? `₹${s.fee}` : "Free"}</td>
                            <td className="py-2.5 pr-4" style={{ color: MUTED }}>{s.source}</td>
                            <td className="py-2.5 pr-4" style={{ color: MUTED2 }}>{s.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, delta, up, bg }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: bg }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "26px", color: "#fff" }}>{value}</div>
      <div className="text-[12.5px] mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>{label}</div>
      <div className="flex items-center gap-1 text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.75)" }}>
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {delta}
      </div>
    </div>
  );
}

const OUTCOMES = ["Genuine — got the offer", "Never heard back", "Asked for money/fee", "Confirmed scam", "Still in process"];

/* ---------------- company reviews ---------------- */
function FeedbackTab({ feedback, setFeedback }) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [text, setText] = useState("");

  const submit = () => {
    if (!company.trim() || !text.trim() || !name.trim()) return;
    setFeedback((f) => [{ id: Date.now(), company, role: role || "Role not specified", outcome, rating, name, college: college || "CareerShield User", text }, ...f]);
    setCompany(""); setRole(""); setText(""); setName(""); setCollege(""); setRating(5); setOutcome(OUTCOMES[0]);
  };

  const filtered = feedback.filter((f) => f.company.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="text-[12px] font-semibold tracking-wide" style={{ color: "#38BDF8" }}>COMPANY REVIEWS</div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "28px", marginTop: "8px" }}>What Happened When They <GradText>Applied</GradText></h1>
      <p className="mt-2 text-[14px]" style={{ color: MUTED }}>Search a company to see real applicant experiences, or share your own.</p>

      <div className="relative mt-6 max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={MUTED2} />
        <input className={inputCls} style={{ ...inputStyle, paddingLeft: "34px", marginTop: 0 }} placeholder="Search by company name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl p-8 text-center h-full flex items-center justify-center" style={{ border: `1px dashed ${BORDER}`, minHeight: "220px" }}>
              <p className="text-[13.5px]" style={{ color: MUTED2 }}>
                {feedback.length === 0 ? "No reviews posted yet. Your review could be the first one here." : `No reviews found for "${search}" yet.`}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filtered.map((t) => <TestimonialCard key={t.id} t={t} />)}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5 h-fit" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="text-[14px] font-semibold flex items-center gap-1.5"><MessageSquareText size={15} /> Share what happened</div>
          <div className="mt-4 space-y-3">
            <Field label="Company you applied to" required><input className={inputCls} style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. QuickHire Solutions" /></Field>
            <Field label="Role"><input className={inputCls} style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. HR Trainee Intern" /></Field>
            <Field label="What actually happened?">
              <select className={inputCls} style={inputStyle} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Rating"><div className="mt-1.5"><Stars value={rating} onChange={setRating} /></div></Field>
            <Field label="Your name"><input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Sharma" /></Field>
            <Field label="College (optional)"><input className={inputCls} style={inputStyle} value={college} onChange={(e) => setCollege(e.target.value)} placeholder="e.g. DTU" /></Field>
            <Field label="Describe your experience" required><textarea rows={3} className={inputCls} style={inputStyle} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened when you applied? Did they ask for money, ghost you, or was it genuine?" /></Field>
            <button onClick={submit} className="w-full py-2.5 rounded-full text-[13px] font-semibold" style={{ background: GRAD_BTN, color: "#fff" }}>Post Review</button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ---------------- extension info ---------------- */
function ExtensionInfoTab() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <div className="flex justify-center"><Pill><Puzzle size={12} /> CHROME EXTENSION</Pill></div>
      <h1 className="text-center" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "30px", marginTop: "14px" }}>
        Check listings <GradText>without leaving the job site.</GradText>
      </h1>
      <p className="text-center mt-3 max-w-xl mx-auto text-[14.5px]" style={{ color: MUTED }}>
        The CareerShield extension runs the same risk engine used on this site directly on LinkedIn, Naukri, Internshala, or any job page — plus you can upload a PDF or screenshot straight from the popup.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mt-10">
        {[
          ["1. Install", "Click \"Add to Chrome\" on the CareerShield listing — installs in a few seconds, no account needed."],
          ["2. Open a listing", "Browse to any job or internship posting page — or open a PDF/screenshot of an offer letter."],
          ["3. Click Check", "Hit the CareerShield icon → \"Check This Job\" (or upload a file) for an instant risk score."],
        ].map(([t, d], i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="text-[13.5px] font-semibold" style={{ color: "#8FA9FF" }}>{t}</div>
            <div className="text-[12.5px] mt-1.5" style={{ color: MUTED }}>{d}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {[
          ["Score + reasons", "Same 0–100 risk score and matched red flags as the web app, shown right in the popup."],
          ["Job / Company / Location / Source", "Pulled from the page automatically so you know exactly what was checked."],
          ["CareerShield Recommends", "A plain-language suggestion — proceed, verify carefully, or don't apply."],
          ["Synced to your Dashboard", "Every check made from the extension is saved and shows up back here under Dashboard → Submissions."],
        ].map(([t, d], i) => (
          <div key={i} className="rounded-xl p-4 flex gap-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <CheckCircle2 size={16} color={SAFE} className="shrink-0 mt-0.5" />
            <div>
              <div className="text-[13.5px] font-semibold">{t}</div>
              <div className="text-[12.5px] mt-1" style={{ color: MUTED }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5 mt-8 text-center" style={{ background: BG_SOFT, border: `1px solid ${BORDER}` }}>
        <p className="text-[12.5px]" style={{ color: MUTED2 }}>
          Currently running in developer mode for this project (not yet published to the Chrome Web Store) — the extension files are included with this project's deliverables.
        </p>
      </div>
    </div>
  );
}

/* ---------------- footer ---------------- */
function Footer() {
  return (
    <div className="border-t py-8 flex justify-center items-center gap-2" style={{ borderColor: BORDER }}>
      <Logo size={18} />
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "15px" }}>CareerShield</span>
    </div>
  );
}
