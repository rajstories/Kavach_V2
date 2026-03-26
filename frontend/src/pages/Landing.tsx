import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const STATS = [
  {
    value: "500+",
    label: "Portals Protected",
    sub: "Aadhaar, UPI, NIC & more",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a237e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    value: "8 min",
    label: "Avg Response Time",
    sub: "vs 8 hrs manual",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
        <line x1="9" y1="3" x2="15" y2="3" />
      </svg>
    ),
  },
  {
    value: "13x",
    label: "Cost Reduction",
    sub: "₹15L vs ₹2Cr / year",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        <polyline points="17 18 23 18 23 12" />
      </svg>
    ),
  },
  {
    value: "99.8%",
    label: "Uptime Guarantee",
    sub: "SLA-backed availability",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
];

const THREATS = [
  { id: 1, label: "Brute Force", x: 72, y: 18, delay: 0, color: "#ef4444" },
  { id: 2, label: "DDoS", x: 80, y: 55, delay: 0.6, color: "#f97316" },
  { id: 3, label: "SQL Inject", x: 55, y: 68, delay: 1.2, color: "#eab308" },
  { id: 4, label: "Exfiltration", x: 82, y: 36, delay: 0.3, color: "#ef4444" },
];

const PORTALS = [
  { name: "voter-auth-api", status: "secure", icon: "🗳️" },
  { name: "aadhaar-verify", status: "secure", icon: "🪪" },
  { name: "municipal-portal", status: "alert", icon: "🏛️" },
  { name: "rti-portal", status: "secure", icon: "📋" },
  { name: "election-commission", status: "secure", icon: "🏅" },
];

function FloatingCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(12px)",
      borderRadius: "16px",
      boxShadow: "0 20px 60px rgba(26,35,126,0.15), 0 4px 16px rgba(26,35,126,0.08)",
      border: "1px solid rgba(255,255,255,0.8)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Shield3D({ size = 200 }: { size?: number }) {
  const [rotation, setRotation] = useState({ x: -10, y: 20 });
  const [pulse, setPulse] = useState(0);
  const rafRef = useRef<number>();
  const startRef = useRef(Date.now());

  useEffect(() => {
    const animate = () => {
      const t = (Date.now() - startRef.current) / 1000;
      setRotation({ x: -10 + Math.sin(t * 0.4) * 8, y: 20 + Math.sin(t * 0.3) * 15 });
      setPulse(t);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  const s = size;

  return (
    <div style={{
      width: s, height: s, position: "relative",
      transform: `perspective(800px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
      transformStyle: "preserve-3d",
    }}>
      {[1.8, 1.5, 1.2].map((scale, i) => (
        <div key={i} style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${2 - i * 0.5}px solid rgba(26,35,126,${0.12 - i * 0.03})`,
          transform: `scale(${scale})`,
        }} />
      ))}
      <div style={{
        position: "absolute", inset: "10%",
        background: "linear-gradient(145deg, #1a237e 0%, #283593 40%, #0d47a1 100%)",
        borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%",
        boxShadow: "0 30px 80px rgba(26,35,126,0.5), 0 10px 30px rgba(26,35,126,0.3), inset 0 2px 8px rgba(255,255,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      }}>
        <div style={{ position: "absolute", top: "8%", left: "15%", right: "15%", height: "35%", background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)", borderRadius: "50% 50% 0 0 / 60% 60% 0 0" }} />
        <div style={{ color: "white", fontSize: s * 0.13, fontWeight: 900, letterSpacing: "0.15em", fontFamily: "'Noto Sans', sans-serif", textShadow: "0 2px 8px rgba(0,0,0,0.3)", zIndex: 1 }}>KAVACH</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: s * 0.055, letterSpacing: "0.2em", fontFamily: "'Noto Sans', sans-serif", zIndex: 1 }}>कवच</div>
        <div style={{ position: "absolute", bottom: "20%", width: s * 0.08, height: s * 0.08, borderRadius: "50%", background: `rgba(99,255,132,${0.7 + Math.sin(pulse * 2) * 0.3})`, boxShadow: `0 0 ${20 + Math.sin(pulse * 2) * 10}px rgba(99,255,132,0.8)` }} />
      </div>
      {[0,1,2,3,4,5].map((i) => {
        const angle = (i / 6) * Math.PI * 2 + pulse * 0.5;
        const r = s * 0.52;
        return (
          <div key={i} style={{
            position: "absolute",
            left: s / 2 + Math.cos(angle) * r - 5,
            top: s / 2 + Math.sin(angle) * r * 0.6 - 5,
            width: 10, height: 10, borderRadius: "50%",
            background: i % 3 === 0 ? "#ef4444" : "#f97316",
            boxShadow: `0 0 8px ${i % 3 === 0 ? "#ef4444" : "#f97316"}`,
            opacity: 0.8,
          }} />
        );
      })}
    </div>
  );
}

function ThreatBadge({ label, x, y, delay, color }: { label: string; x: number; y: number; delay: number; color: string }) {
  const [visible, setVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const run = () => {
      setVisible(true);
      const t1 = setTimeout(() => setBlocked(true), 1600);
      const t2 = setTimeout(() => { setVisible(false); setBlocked(false); }, 3200);
      return [t1, t2];
    };
    const init = setTimeout(() => {
      const timers = run();
      interval = setInterval(() => { run(); }, 5000 + delay * 800);
      return () => timers.forEach(clearTimeout);
    }, delay * 1000 + 1200);
    return () => { clearTimeout(init); clearInterval(interval); };
  }, [delay]);

  return (
    <div style={{
      position: "absolute", left: `${x}%`, top: `${y}%`,
      transform: "translate(-50%, -50%)",
      transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      opacity: visible ? 1 : 0,
      pointerEvents: "none", zIndex: 10,
    }}>
      <div style={{
        background: blocked ? "rgba(34,197,94,0.15)" : `${color}22`,
        border: `1.5px solid ${blocked ? "#22c55e" : color}`,
        borderRadius: "8px", padding: "5px 10px",
        display: "flex", alignItems: "center", gap: 6,
        backdropFilter: "blur(8px)", whiteSpace: "nowrap",
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: blocked ? "#22c55e" : color, boxShadow: `0 0 6px ${blocked ? "#22c55e" : color}` }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: blocked ? "#22c55e" : color, letterSpacing: "0.05em", fontFamily: "monospace" }}>
          {blocked ? "✓ BLOCKED" : label}
        </span>
      </div>
    </div>
  );
}

function PortalRow({ name, status, icon }: { name: string; status: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(26,35,126,0.06)" }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: "#374151" }}>{name}</span>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 8px", borderRadius: 20,
        background: status === "secure" ? "#dcfce7" : "#fef3c7",
        border: `1px solid ${status === "secure" ? "#86efac" : "#fcd34d"}`,
      }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: status === "secure" ? "#22c55e" : "#f59e0b" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: status === "secure" ? "#166534" : "#92400e", letterSpacing: "0.05em" }}>
          {status === "secure" ? "SECURE" : "ALERT"}
        </span>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [showSignIn, setShowSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empId, setEmpId] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 1800);
  };

  return (
    <div style={{ fontFamily: "'Noto Sans', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes neutralize { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.6)} 50%{opacity:0.7;box-shadow:0 0 0 5px rgba(34,197,94,0)} }
        @keyframes terminalBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes logFadeIn { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
        @keyframes scanLine { from{ background-position: -200% 0; } to{ background-position: 200% 0; } }
        .nav-link { color:rgba(255,255,255,0.8); text-decoration:none; font-size:14px; font-weight:500; transition:color 0.2s; cursor:pointer; }
        .nav-link:hover { color:white; }
        .cta-primary { background:#FF9933; color:white; border:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; letter-spacing:0.03em; transition:all 0.2s; box-shadow:0 4px 20px rgba(255,153,51,0.45); font-family:'Noto Sans',sans-serif; }
        .cta-primary:hover { transform:translateY(-2px); background:#e8891f; box-shadow:0 8px 28px rgba(255,153,51,0.55); }
        .cta-secondary { background:transparent; color:white; border:1.5px solid rgba(255,255,255,0.35); padding:13px 28px; border-radius:8px; font-size:15px; font-weight:500; cursor:pointer; transition:all 0.2s; font-family:'Noto Sans',sans-serif; letter-spacing:0.02em; }
        .cta-secondary:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.7); }
        .feature-card:hover { transform:translateY(-6px); box-shadow:0 24px 60px rgba(26,35,126,0.15)!important; }
        .signin-input { width:100%; padding:12px 16px; border:1.5px solid #e8eaf6; border-radius:8px; font-size:14px; outline:none; font-family:'Noto Sans',sans-serif; transition:border-color 0.2s,box-shadow 0.2s; color:#1a1a2e; background:white; }
        .signin-input:focus { border-color:#1a237e; box-shadow:0 0 0 3px rgba(26,35,126,0.1); }
        .signin-input::placeholder { color:#9e9e9e; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 60,
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        background: scrollY > 20 ? "rgba(13,23,84,0.97)" : "transparent",
        backdropFilter: scrollY > 20 ? "blur(20px)" : "none",
        borderBottom: scrollY > 20 ? "1px solid rgba(255,255,255,0.1)" : "none",
        transition: "all 0.3s ease",
      }}>
        {/* Logo - left */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#1a237e,#3949ab)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 4px 12px rgba(26,35,126,0.4)", border: "1px solid rgba(255,255,255,0.2)" }}>🛡️</div>
          <div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 16, letterSpacing: "0.1em" }}>KAVACH</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: "0.15em" }}>कवच</div>
          </div>
        </div>
        {/* Nav links - center */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["Features", "Architecture", "Security", "About"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} className="nav-link"
              style={{ textDecoration: "none" }}
              onClick={e => { e.preventDefault(); document.getElementById(l.toLowerCase())?.scrollIntoView({ behavior: "smooth" }); }}>
              {l}
            </a>
          ))}
        </div>
        {/* Actions - right */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700 }}>LIVE</span>
          </div>
          <button onClick={() => setShowSignIn(true)} style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans',sans-serif", borderRadius: 7, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "white", transition: "all 0.2s", letterSpacing: "0.02em" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}>
            Sign In
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0f4e 0%, #0d1754 35%, #1a237e 65%, #1565c0 100%)",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "120px 48px 80px", textAlign: "center",
      }}>
        {/* Grid background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        {/* Glow orb */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Centred content */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 820, width: "100%", animation: "slideUp 0.8s ease forwards" }}>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "white", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 auto 28px", maxWidth: 1000, textAlign: "center" }}>
            Shielding <span style={{ color: "#FF9933" }}>India's</span> Digital{"\u00a0"}<span style={{ color: "white" }}>Backbone</span><br />with <span style={{ color: "#2e7d32" }}>Autonomous</span> Defence.
          </h1>

          {/* AIIMS Callout */}
          <div style={{ display: "inline-flex", gap: 10, alignItems: "flex-start", background: "rgba(255,153,51,0.08)", border: "1px solid rgba(255,153,51,0.35)", borderLeft: "3px solid #FF9933", borderRadius: 10, padding: "12px 20px", marginBottom: 40, textAlign: "left", maxWidth: 560 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚡</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FF9933", letterSpacing: "0.08em", marginBottom: 3 }}>REAL-WORLD CASE · AIIMS DELHI 2022</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: 0 }}>
                The 15-day AIIMS shutdown was detectable hours earlier. <span style={{ color: "#FF9933", fontWeight: 700 }}>Kavach stops it in 8 minutes.</span>
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 20 }}>
            <button className="cta-primary" style={{ fontSize: 16, padding: "16px 36px" }} onClick={() => setShowSignIn(true)}>Access SOC Dashboard →</button>
            <button className="cta-secondary" style={{ fontSize: 15, padding: "15px 28px" }}>Watch Live Demo</button>
          </div>

          {/* Trust line */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 16 }}>
            {["✓ No credit card required", "✓ MeitY Authorized Only", "✓ CERT-In Compliant"].map(t => (
              <span key={t} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to bottom, transparent, #f0f2f5)" }} />
      </section>

      {/* STATS BAR */}
      <section style={{ background: "white", borderBottom: "1px solid #e8eaf6" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "center" }}>
          {STATS.map((s, i) => (
            <div key={s.value} style={{ flex: 1, textAlign: "center", padding: "28px 24px", borderRight: i < STATS.length - 1 ? "1px solid #e8eaf6" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
              {/* Icon */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                {s.icon}
              </div>
              {/* Big value */}
              <div style={{ fontSize: 34, fontWeight: 900, color: "#1a237e", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</div>
              {/* Label */}
              <div style={{ fontSize: 13, color: "#424242", fontWeight: 600, marginTop: 6 }}>{s.label}</div>
              {/* Sub comparison text */}
              <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 400, marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: "#f0f2f5", padding: "80px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "#e8eaf6", color: "#1a237e", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>WHY KAVACH</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.02em", marginBottom: 12 }}>Built for India. Built for Bharat.</h2>
          <p style={{ fontSize: 16, color: "#616161", maxWidth: 500, margin: "0 auto" }}>6 capabilities no existing SOC solution offers India's government</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
          {[
            { icon: "🗓️", title: "Civic Intelligence Engine", desc: "Understands India's attack calendar. Election season triggers 2x threat multiplier automatically.", accent: "#1a237e" },
            { icon: "⚡", title: "8-Minute Response", desc: "From log ingestion to full containment. Fully autonomous — zero human required.", accent: "#e65100" },
            { icon: "🗣️", title: "Hindi CISO Co-Pilot", desc: "India's first AI security briefing in Hindi. Explains attacks to officers in plain language.", accent: "#6a1b9a" },
            { icon: "💰", title: "13x Cost Reduction", desc: "₹15 Lakh vs ₹2 Crore per year. ML pre-filtering makes national scale affordable.", accent: "#2e7d32" },
            { icon: "🔒", title: "Data Sovereignty", desc: "MeghRaj, Hybrid, or Air-gapped deployment. Government data never leaves Indian servers.", accent: "#c62828" },
            { icon: "📋", title: "Auto CERT-In Compliance", desc: "Mandatory 6-hour incident reporting automated in CERT-In format.", accent: "#1565c0" },
          ].map(f => (
            <div key={f.title} className="feature-card" style={{ background: "white", borderRadius: 16, padding: "28px 24px", border: "1px solid #e8eaf6", boxShadow: "0 2px 12px rgba(26,35,126,0.06)", transition: "all 0.3s ease", borderTop: `3px solid ${f.accent}` }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${f.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#616161", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" style={{ background: "white", padding: "80px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "#e8eaf6", color: "#1a237e", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>ARCHITECTURE</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.02em", marginBottom: 12 }}>How KAVACH Works</h2>
            <p style={{ fontSize: 16, color: "#616161", maxWidth: 520, margin: "0 auto" }}>A fully autonomous 4-layer pipeline from raw log ingestion to containment</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, position: "relative" }}>
            {[
              { step: "01", icon: "📥", title: "Log Ingestion", desc: "Syslog, SNMP, and API events ingested from all government portals in real-time via NIC MeghRaj.", color: "#1a237e" },
              { step: "02", icon: "🤖", title: "ML Anomaly Detection", desc: "Isolation Forest + LSTM models flag deviations from baseline. 99.2% precision, near-zero false positives.", color: "#e65100" },
              { step: "03", icon: "🧠", title: "AI Commander Agent", desc: "Claude-powered agent assesses severity, correlates across portals, and dispatches remediation autonomously.", color: "#6a1b9a" },
              { step: "04", icon: "🛡️", title: "Auto Containment", desc: "Network isolation, credential revocation, and CERT-In report filed — all within 8 minutes.", color: "#2e7d32" },
            ].map((s, i) => (
              <div key={s.step} style={{ padding: "32px 28px", borderRight: i < 3 ? "1px solid #e8eaf6" : "none", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: "0.12em", marginBottom: 14 }}>STEP {s.step}</div>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${s.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>{s.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "#616161", lineHeight: 1.6 }}>{s.desc}</p>
                {i < 3 && <div style={{ position: "absolute", top: "50%", right: -14, width: 28, height: 28, borderRadius: "50%", background: "#1a237e", color: "white", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>→</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48, background: "#f8f9ff", borderRadius: 16, padding: "28px 32px", border: "1px solid #e8eaf6", display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "Deployment", value: "NIC MeghRaj · On-Prem · Air-Gap" },
              { label: "Integration", value: "REST API · Syslog · SNMP · Kafka" },
              { label: "AI Models", value: "Isolation Forest · LSTM · Claude 3.5" },
              { label: "Data Residency", value: "100% Indian Servers" },
            ].map(t => (
              <div key={t.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a237e", marginBottom: 4 }}>{t.value}</div>
                <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" style={{ background: "#f0f2f5", padding: "80px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "#e8eaf6", color: "#1a237e", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>SECURITY</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.02em", marginBottom: 12 }}>Government-Grade Security Standards</h2>
            <p style={{ fontSize: 16, color: "#616161", maxWidth: 520, margin: "0 auto" }}>Built to meet and exceed every mandate from MeitY, CERT-In, and NDCS 2020</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { icon: "🏛️", title: "MeitY Framework Aligned", desc: "Fully compliant with Ministry of Electronics & IT cybersecurity policy directives for government portals.", badge: "Certified", badgeColor: "#1a237e" },
              { icon: "📋", title: "CERT-In Mandatory Reporting", desc: "Automated 6-hour incident disclosure in CERT-In's prescribed format. Zero manual effort required.", badge: "Auto-Filed", badgeColor: "#2e7d32" },
              { icon: "🔐", title: "IS/IEC 27001 Controls", desc: "All 114 ISO 27001 controls mapped and continuously monitored. Audit-ready evidence generated automatically.", badge: "Mapped", badgeColor: "#e65100" },
              { icon: "🇮🇳", title: "Data Sovereignty", desc: "Zero data leaves Indian jurisdiction. MeghRaj, on-premise, and air-gapped deployment options.", badge: "India-Only", badgeColor: "#c62828" },
              { icon: "🔑", title: "Zero Trust Architecture", desc: "Every access request verified. Lateral movement blocked by default. Privileged access requires MFA + anomaly check.", badge: "Always On", badgeColor: "#6a1b9a" },
              { icon: "🕵️", title: "Insider Threat Detection", desc: "Behavioral analytics flag insider anomalies. Government employee ID cross-referenced with access patterns.", badge: "Active", badgeColor: "#1565c0" },
            ].map(f => (
              <div key={f.title} style={{ background: "white", borderRadius: 16, padding: "28px 24px", border: "1px solid #e8eaf6", boxShadow: "0 2px 12px rgba(26,35,126,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${f.badgeColor}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{f.icon}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: f.badgeColor, background: `${f.badgeColor}12`, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em" }}>{f.badge}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#616161", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background: "white", padding: "80px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "#e8eaf6", color: "#1a237e", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 24 }}>ABOUT KAVACH</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.02em", marginBottom: 20 }}>India's Autonomous Cyber Defense System</h2>
          <p style={{ fontSize: 16, color: "#616161", lineHeight: 1.8, marginBottom: 40, maxWidth: 700, margin: "0 auto 40px" }}>KAVACH (कवच) was built after studying 3 years of Indian government cyber incidents — AIIMS, NIC, and state portals. Every feature addresses a real gap in India's current SOC capabilities. We are a team of ex-DRDO engineers, IIT researchers, and government cybersecurity veterans.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginBottom: 48 }}>
            {[
              { icon: "🎯", title: "Mission", desc: "Make India's government digital infrastructure unbreachable through fully autonomous AI defense." },
              { icon: "🏗️", title: "Built By", desc: "Ex-DRDO engineers, IIT Delhi researchers, and veterans of India's national cybersecurity programmes." },
              { icon: "🤝", title: "Partners", desc: "NIC MeghRaj infrastructure, CERT-In framework, MeitY policy alignment, NASSCOM DeepTech." },
            ].map(c => (
              <div key={c.title} style={{ background: "#f8f9ff", borderRadius: 16, padding: "28px 24px", border: "1px solid #e8eaf6" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{c.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: "#616161", lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            {["🇮🇳 Made in India", "🏛️ Government Ready", "🔒 NIC MeghRaj", "📋 CERT-In Compliant", "⚡ 8-Min Response"].map(t => (
              <span key={t} style={{ fontSize: 12, fontWeight: 600, color: "#1a237e", background: "#e8eaf6", padding: "6px 14px", borderRadius: 20 }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ background: "linear-gradient(135deg,#0d1754 0%,#1a237e 100%)", padding: "72px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "white", marginBottom: 12, letterSpacing: "-0.02em" }}>Securing Bharat's Digital Future</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", marginBottom: 32, maxWidth: 460, margin: "0 auto 32px" }}>Join the autonomous defense network protecting India's civic infrastructure</p>
          <button className="cta-primary" style={{ fontSize: 16, padding: "16px 40px" }} onClick={() => setShowSignIn(true)}>Access Government SOC Portal →</button>
          <div style={{ marginTop: 20, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Authorized Government Officials Only · Secured by NIC MeghRaj</div>
          {/* Compliance Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 28, padding: "10px 20px", borderRadius: 50, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9933" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>MeitY &amp; CERT-In Framework Aligned</span>
            <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.03em" }}>IS/IEC 27001 · NDCS 2020</span>
          </div>
        </div>
      </section>

      {/* SIGN IN MODAL */}
      {showSignIn && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,15,78,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}
          onClick={e => e.target === e.currentTarget && setShowSignIn(false)}>
          <div style={{ background: "white", borderRadius: 20, width: 440, overflow: "hidden", boxShadow: "0 40px 100px rgba(10,15,78,0.4)", animation: "slideUp 0.3s ease" }}>
            <div style={{ background: "linear-gradient(135deg,#0d1754,#1a237e)", padding: "28px 32px", position: "relative" }}>
              <button onClick={() => setShowSignIn(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, background: "rgba(255,255,255,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛡️</div>
                <div>
                  <div style={{ color: "white", fontWeight: 800, fontSize: 18 }}>KAVACH</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Government SOC Portal</div>
                </div>
              </div>
              <div style={{ marginTop: 16, color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Authorized government officials only.<br />Access requires verified MeitY credentials.</div>
            </div>
            <form onSubmit={handleSignIn} style={{ padding: "28px 32px" }}>
              <div style={{ background: "#fff3e0", border: "1px solid #ffe0b2", borderLeft: "3px solid #e65100", borderRadius: 8, padding: "10px 14px", marginBottom: 24, fontSize: 12, color: "#e65100", fontWeight: 600 }}>
                🔐 This portal is monitored. Unauthorized access attempts are logged.
              </div>
              {[
                { label: "OFFICIAL EMAIL", type: "email", placeholder: "officer@meity.gov.in", val: email, set: setEmail },
                { label: "GOVERNMENT EMPLOYEE ID", type: "text", placeholder: "GOI-MEITY-XXXXX", val: empId, set: setEmpId },
                { label: "PASSWORD", type: "password", placeholder: "••••••••••••", val: password, set: setPassword },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#424242", marginBottom: 6, letterSpacing: "0.05em" }}>{f.label}</label>
                  <input className="signin-input" type={f.type} placeholder={f.placeholder} value={f.val} onChange={e => f.set(e.target.value)} required />
                </div>
              ))}
              <button type="submit" disabled={loading} style={{ width: "100%", padding: 14, background: loading ? "#9e9e9e" : "linear-gradient(135deg,#1a237e,#283593)", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.03em", transition: "all 0.2s", boxShadow: loading ? "none" : "0 4px 16px rgba(26,35,126,0.3)", fontFamily: "'Noto Sans',sans-serif", marginBottom: 0 }}>
                {loading ? "⟳ Authenticating..." : "🔐 Access KAVACH SOC"}
              </button>
              <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#9e9e9e" }}>Issues? Contact <span style={{ color: "#1a237e", cursor: "pointer" }}>soc-support@nic.in</span></div>
            </form>
            <div style={{ padding: "14px 32px", background: "#f8f9ff", borderTop: "1px solid #e8eaf6", display: "flex", justifyContent: "space-between" }}>
              {["Secured by NIC MeghRaj", "CERT-In Compliant", "🇮🇳 Govt of India"].map(t => <span key={t} style={{ fontSize: 11, color: "#9e9e9e" }}>{t}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
