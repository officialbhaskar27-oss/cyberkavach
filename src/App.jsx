import { useState, useRef } from "react";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are CyberKavach, a professional cybersecurity consulting AI used by ethical hackers to generate client reports. When given a target URL and client name, produce a detailed, professional vulnerability assessment report in JSON only (no markdown, no backticks, no explanation).

Return EXACTLY this structure:
{
  "meta": {
    "client_name": "...",
    "target_url": "...",
    "report_id": "CK-2026-XXXX",
    "date": "...",
    "assessor": "CyberKavach Security",
    "classification": "CONFIDENTIAL"
  },
  "executive_summary": "3-4 sentences in professional English. Summarize the security posture, key risks found, and urgency of remediation. Be specific to the domain type.",
  "risk_overview": {
    "overall_risk": "Critical|High|Medium|Low",
    "score": <0-100>,
    "critical_count": <n>,
    "high_count": <n>,
    "medium_count": <n>,
    "low_count": <n>,
    "passed_count": <n>
  },
  "findings": [
    {
      "id": "CK-F01",
      "title": "...",
      "severity": "Critical|High|Medium|Low|Informational",
      "category": "SSL/TLS|Headers|Information Disclosure|Access Control|Cookie Security|Configuration",
      "description": "Clear technical description of the vulnerability and why it matters.",
      "evidence": "What was observed / what header was missing / what path responded.",
      "impact": "Specific business/technical impact if exploited.",
      "recommendation": "Step-by-step remediation. Specific config changes or code snippets.",
      "references": ["OWASP Top 10", "CWE-XXX", "CERT-In Guidelines"]
    }
  ],
  "remediation_roadmap": [
    { "priority": 1, "action": "...", "effort": "Low|Medium|High", "timeline": "Immediate|1 week|1 month" }
  ],
  "compliance_notes": "Brief note on relevant Indian compliance: RBI cybersecurity framework, CERT-In guidelines, IT Act 2000 implications if applicable.",
  "disclaimer": "This assessment was conducted using automated and manual analysis techniques for educational and consulting purposes only. Results should be validated by a certified security professional before remediation."
}

Rules:
- Generate 6-10 realistic findings based on the domain type
- Be specific: mention actual header names, actual paths, actual CVE patterns
- Severity must be realistic — not everything is Critical
- findings must be ordered Critical → Low
- remediation_roadmap: max 5 items, ordered by priority
- report_id: generate as CK-2026-[random 4 digit number]
- Make it feel like a real pentest report a client would pay ₹15,000+ for`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SEV_CONFIG = {
  Critical:      { bg: "#fef2f2", border: "#fca5a5", badge: "#dc2626", text: "#991b1b" },
  High:          { bg: "#fff7ed", border: "#fdba74", badge: "#ea580c", text: "#9a3412" },
  Medium:        { bg: "#fefce8", border: "#fde047", badge: "#ca8a04", text: "#854d0e" },
  Low:           { bg: "#f0fdf4", border: "#86efac", badge: "#16a34a", text: "#14532d" },
  Informational: { bg: "#eff6ff", border: "#93c5fd", badge: "#2563eb", text: "#1e3a8a" },
};

const RISK_CONFIG = {
  Critical: { color: "#dc2626", bg: "#fef2f2" },
  High:     { color: "#ea580c", bg: "#fff7ed" },
  Medium:   { color: "#ca8a04", bg: "#fefce8" },
  Low:      { color: "#16a34a", bg: "#f0fdf4" },
};

const EFFORT_COLOR = { Low: "#16a34a", Medium: "#ca8a04", High: "#dc2626" };
const TIMELINE_COLOR = { Immediate: "#dc2626", "1 week": "#ea580c", "1 month": "#16a34a" };

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function InputScreen({ onScan, loading }) {
  const [url, setUrl]    = useState("");
  const [name, setName]  = useState("");
  const [notes, setNotes] = useState("");

  const handle = () => {
    if (!url.trim() || !name.trim()) return;
    let t = url.trim();
    if (!t.startsWith("http")) t = "https://" + t;
    onScan(t, name.trim(), notes.trim());
  };

  const field = (label, val, set, ph, type = "text") => (
    <div style={{ marginBottom: "20px" }}>
      <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "1.5px", marginBottom: "7px", textTransform: "uppercase" }}>
        {label}
      </label>
      {type === "textarea" ? (
        <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={3}
          style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", color: "#1e293b", resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
          onFocus={e => e.target.style.borderColor = "#1e3a8a"}
          onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
      ) : (
        <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
          onKeyDown={e => e.key === "Enter" && handle()}
          style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", color: "#1e293b", outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
          onFocus={e => e.target.style.borderColor = "#1e3a8a"}
          onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div style={{ width: "42px", height: "42px", background: "#1e3a8a", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🛡</div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#1e3a8a", letterSpacing: "2px", fontFamily: "'Georgia', serif" }}>CYBERKAVACH</div>
              <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "2px" }}>SECURITY CONSULTING</div>
            </div>
          </div>
          <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>Professional vulnerability assessment report generator</p>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 4px 6px -1px #0001, 0 20px 60px -10px #1e3a8a18", padding: "36px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#1e293b", marginBottom: "24px", paddingBottom: "16px", borderBottom: "2px solid #f1f5f9" }}>
            New Assessment
          </div>

          {field("Client / Company Name", name, setName, "e.g. Sharma Enterprises Pvt. Ltd.")}
          {field("Target Website URL", url, setUrl, "e.g. https://sharmaco.in")}
          {field("Scope & Notes (optional)", notes, setNotes, "e.g. Focus on login portal. Exclude /api/internal. Client authorized this scan.", "textarea")}

          <button onClick={handle} disabled={loading || !url || !name}
            style={{
              width: "100%", padding: "14px", background: loading || !url || !name ? "#94a3b8" : "#1e3a8a",
              color: "#fff", border: "none", borderRadius: "9px", fontSize: "15px", fontWeight: "700",
              cursor: loading || !url || !name ? "not-allowed" : "pointer", letterSpacing: "0.5px",
              transition: "all 0.2s", fontFamily: "inherit",
            }}>
            {loading ? "⏳  Generating Report..." : "Generate Security Report →"}
          </button>

          <p style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8", marginTop: "16px", marginBottom: 0 }}>
            🔒 For authorized assessments only • Educational & consulting use
          </p>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ sev }) {
  const c = SEV_CONFIG[sev] || SEV_CONFIG.Informational;
  return (
    <span style={{ background: c.badge, color: "#fff", fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
      {sev.toUpperCase()}
    </span>
  );
}

function FindingCard({ f, index }) {
  const [open, setOpen] = useState(index < 2);
  const c = SEV_CONFIG[f.severity] || SEV_CONFIG.Informational;
  return (
    <div style={{ border: `1.5px solid ${c.border}`, borderRadius: "10px", overflow: "hidden", marginBottom: "12px", pageBreakInside: "avoid" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", background: c.bg, border: "none", cursor: "pointer",
        padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "12px", fontFamily: "inherit",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
          <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>{f.id}</span>
          <span style={{ fontSize: "14px", fontWeight: "700", color: c.text, textAlign: "left" }}>{f.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <SeverityBadge sev={f.severity} />
          <span style={{ color: "#94a3b8", fontSize: "12px" }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "20px 18px", background: "#fff" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: "20px", fontWeight: "600" }}>
              📁 {f.category}
            </span>
          </div>

          {[
            { label: "Description", val: f.description, icon: "📋" },
            { label: "Evidence", val: f.evidence, icon: "🔍" },
            { label: "Impact", val: f.impact, icon: "⚠️" },
            { label: "Recommendation", val: f.recommendation, icon: "✅" },
          ].map(({ label, val, icon }) => (
            <div key={label} style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "1px", marginBottom: "5px", textTransform: "uppercase" }}>
                {icon} {label}
              </div>
              <div style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.7", background: "#f8fafc", padding: "10px 14px", borderRadius: "7px", borderLeft: `3px solid ${c.border}` }}>
                {val}
              </div>
            </div>
          ))}

          {f.references?.length > 0 && (
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "1px", marginBottom: "6px", textTransform: "uppercase" }}>
                📎 References
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {f.references.map(r => (
                  <span key={r} style={{ fontSize: "11px", background: "#eff6ff", color: "#2563eb", padding: "3px 10px", borderRadius: "20px", border: "1px solid #bfdbfe" }}>{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportScreen({ data, onReset }) {
  const printRef = useRef();
  const rc = RISK_CONFIG[data.risk_overview.overall_risk] || RISK_CONFIG.Medium;

  const handlePrint = () => {
    const style = document.createElement("style");
    style.textContent = `@media print { body * { visibility: hidden } #print-area, #print-area * { visibility: visible } #print-area { position: absolute; top: 0; left: 0; width: 100% } .no-print { display: none !important } }`;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Top bar */}
      <div className="no-print" style={{ background: "#1e3a8a", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>🛡</span>
          <span style={{ color: "#fff", fontWeight: "800", fontSize: "15px", letterSpacing: "2px", fontFamily: "'Georgia', serif" }}>CYBERKAVACH</span>
          <span style={{ color: "#93c5fd", fontSize: "12px" }}>/ Report Ready</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handlePrint} style={{
            background: "#fff", color: "#1e3a8a", border: "none", padding: "9px 20px",
            borderRadius: "7px", fontWeight: "700", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
          }}>
            🖨️ Save as PDF
          </button>
          <button onClick={onReset} style={{
            background: "transparent", color: "#93c5fd", border: "1px solid #3b5a9a", padding: "9px 18px",
            borderRadius: "7px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
          }}>
            ← New Report
          </button>
        </div>
      </div>

      {/* Report body */}
      <div id="print-area" ref={printRef} style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 20px" }}>

        {/* Cover section */}
        <div style={{ background: "#1e3a8a", borderRadius: "14px", padding: "48px 44px", marginBottom: "24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#93c5fd", letterSpacing: "3px", marginBottom: "12px" }}>VULNERABILITY ASSESSMENT REPORT</div>
              <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: "900", fontFamily: "'Georgia', serif" }}>{data.meta.client_name}</h1>
              <div style={{ color: "#93c5fd", fontSize: "13px" }}>{data.meta.target_url}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "#93c5fd", letterSpacing: "2px", marginBottom: "8px" }}>REPORT ID</div>
              <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "monospace" }}>{data.meta.report_id}</div>
            </div>
          </div>
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #3b5a9a", display: "flex", gap: "32px", flexWrap: "wrap" }}>
            {[
              { label: "Date", val: data.meta.date },
              { label: "Assessor", val: data.meta.assessor },
              { label: "Classification", val: data.meta.classification },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: "10px", color: "#93c5fd", letterSpacing: "1.5px", marginBottom: "3px" }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Summary */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "28px 32px", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "800", color: "#1e293b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Executive Summary
          </h2>
          <p style={{ margin: 0, color: "#475569", fontSize: "14px", lineHeight: "1.8" }}>{data.executive_summary}</p>
        </div>

        {/* Risk Overview */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "28px 32px", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase" }}>
            Risk Overview
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
            {/* Score */}
            <div style={{ textAlign: "center", background: rc.bg, border: `2px solid ${rc.color}`, borderRadius: "12px", padding: "20px 28px" }}>
              <div style={{ fontSize: "48px", fontWeight: "900", color: rc.color, lineHeight: 1 }}>{data.risk_overview.score}</div>
              <div style={{ fontSize: "11px", color: "#64748b", letterSpacing: "1px", marginTop: "4px" }}>SECURITY SCORE</div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: rc.color, marginTop: "8px" }}>{data.risk_overview.overall_risk.toUpperCase()} RISK</div>
            </div>

            {/* Counts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", flex: 1 }}>
              {[
                { label: "Critical", val: data.risk_overview.critical_count, color: "#dc2626" },
                { label: "High",     val: data.risk_overview.high_count,     color: "#ea580c" },
                { label: "Medium",   val: data.risk_overview.medium_count,   color: "#ca8a04" },
                { label: "Low",      val: data.risk_overview.low_count,      color: "#16a34a" },
                { label: "Passed",   val: data.risk_overview.passed_count,   color: "#2563eb" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>{label}</span>
                  <span style={{ fontSize: "22px", fontWeight: "900", color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Findings */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "28px 32px", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase" }}>
            Findings ({data.findings.length})
          </h2>
          {data.findings.map((f, i) => <FindingCard key={f.id} f={f} index={i} />)}
        </div>

        {/* Roadmap */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "28px 32px", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase" }}>
            Remediation Roadmap
          </h2>
          {data.remediation_roadmap.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "14px", padding: "14px 18px", background: "#f8fafc", borderRadius: "9px", border: "1px solid #e2e8f0" }}>
              <div style={{ width: "32px", height: "32px", background: "#1e3a8a", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px", flexShrink: 0 }}>{r.priority}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>{r.action}</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: EFFORT_COLOR[r.effort] || "#64748b", background: "#f1f5f9", padding: "2px 9px", borderRadius: "20px", fontWeight: "700" }}>
                    Effort: {r.effort}
                  </span>
                  <span style={{ fontSize: "11px", color: TIMELINE_COLOR[r.timeline] || "#64748b", background: "#f1f5f9", padding: "2px 9px", borderRadius: "20px", fontWeight: "700" }}>
                    ⏱ {r.timeline}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance */}
        {data.compliance_notes && (
          <div style={{ background: "#eff6ff", borderRadius: "12px", padding: "24px 28px", marginBottom: "20px", border: "1px solid #bfdbfe" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "800", color: "#1e3a8a", textTransform: "uppercase" }}>
              📋 Compliance Notes
            </h2>
            <p style={{ margin: 0, color: "#334155", fontSize: "13.5px", lineHeight: "1.7" }}>{data.compliance_notes}</p>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ background: "#fafafa", borderRadius: "10px", padding: "18px 22px", border: "1px dashed #cbd5e1" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", letterSpacing: "1px", marginBottom: "6px" }}>DISCLAIMER</div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "12px", lineHeight: "1.7" }}>{data.disclaimer}</p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "32px", color: "#94a3b8", fontSize: "12px" }}>
          <div style={{ fontWeight: "700", color: "#1e3a8a", marginBottom: "4px", fontFamily: "'Georgia', serif" }}>🛡 CYBERKAVACH Security Consulting</div>
          Report ID: {data.meta.report_id} • Generated by CyberKavach AI • For Authorized Use Only
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]   = useState("input"); // input | loading | report | error
  const [report, setReport] = useState(null);
  const [error, setError]   = useState("");

  const handleScan = async (url, clientName, notes) => {
    setPhase("loading");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `Generate a professional security assessment report for:
Client: ${clientName}
Target URL: ${url}
Scope/Notes: ${notes || "Full website assessment"}
Today's Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`
          }],
        }),
      });

      const data = await res.json();
      const raw  = data.content?.find(b => b.type === "text")?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setReport(parsed);
      setPhase("report");
    } catch (e) {
      setError("Report generation failed: " + e.message);
      setPhase("error");
    }
  };

  if (phase === "input" || phase === "loading")
    return <InputScreen onScan={handleScan} loading={phase === "loading"} />;

  if (phase === "report" && report)
    return <ReportScreen data={report} onReset={() => { setReport(null); setPhase("input"); }} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "40px" }}>⚠️</div>
      <div style={{ color: "#dc2626", fontWeight: "700" }}>Error</div>
      <div style={{ color: "#64748b", fontSize: "13px", maxWidth: "400px", textAlign: "center" }}>{error}</div>
      <button onClick={() => setPhase("input")} style={{ background: "#1e3a8a", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit" }}>
        ← Try Again
      </button>
    </div>
  );
}
