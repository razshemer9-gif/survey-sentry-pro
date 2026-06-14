import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "@/lib/auth";
import companyLogo from "@/assets/company-logo.png";

export default function AuthPage() {
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהתחברות";
      setLoginError(translateError(msg));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);
    try {
      await signUp(regEmail, regPassword);
      setRegSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהרשמה";
      setRegError(translateError(msg));
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="auth-page" dir="rtl">
      {/* Atmospheric glow orbs */}
      <div className="auth-glow-orb auth-glow-orb-1" />
      <div className="auth-glow-orb auth-glow-orb-2" />

      {/* Decorative engineering background elements */}
      <svg className="auth-deco" aria-hidden="true" viewBox="0 0 800 900" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Blueprint grid */}
        <g opacity="0.045" stroke="#7ab3ff" strokeWidth="0.8">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 52} x2="800" y2={i * 52} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 53} y1="0" x2={i * 53} y2="900" />
          ))}
        </g>
        {/* Floor plan outline top-left */}
        <g opacity="0.06" stroke="#a0c4ff" strokeWidth="1.2" fill="none">
          <rect x="30" y="40" width="180" height="130" rx="2" />
          <rect x="30" y="40" width="80" height="60" rx="1" />
          <rect x="130" y="40" width="80" height="90" rx="1" />
          <line x1="110" y1="40" x2="110" y2="170" />
          <line x1="30" y1="100" x2="210" y2="100" />
          <rect x="48" y="155" width="28" height="5" />
          <rect x="155" y="115" width="28" height="5" />
        </g>
        {/* Accessibility wheelchair icon — bottom right */}
        <g opacity="0.07" transform="translate(630,680) scale(2.4)" stroke="#7ab3ff" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <circle cx="12" cy="4" r="2" />
          <path d="M10 6.5c0 0 .5 2 2 2h4" />
          <path d="M9 12l1-5.5" />
          <path d="M9 12h5l1.5 4H9" />
          <circle cx="9" cy="20" r="2.5" />
          <circle cx="17" cy="20" r="2.5" />
        </g>
        {/* Checklist icon — top right */}
        <g opacity="0.06" transform="translate(640,50) scale(2.8)" stroke="#a0c4ff" strokeWidth="1.2" fill="none" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="20" rx="2" />
          <line x1="7" y1="9" x2="17" y2="9" />
          <line x1="7" y1="13" x2="17" y2="13" />
          <line x1="7" y1="17" x2="13" y2="17" />
          <polyline points="3.5,7 5,8.5 7,6" strokeWidth="1.4" />
          <polyline points="3.5,11 5,12.5 7,10" strokeWidth="1.4" />
        </g>
        {/* Ruler/measure lines — center decorative */}
        <g opacity="0.05" stroke="#7ab3ff" strokeWidth="1">
          <line x1="350" y1="820" x2="620" y2="820" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={350 + i * 34} y1="812" x2={350 + i * 34} y2={i % 4 === 0 ? "826" : "818"} />
          ))}
        </g>
        {/* Engineering compass arc */}
        <g opacity="0.05" stroke="#a0c4ff" strokeWidth="1.2" fill="none">
          <path d="M 80 800 A 120 120 0 0 1 260 720" />
          <line x1="80" y1="800" x2="115" y2="690" />
          <line x1="80" y1="800" x2="195" y2="750" />
        </g>
      </svg>

      <div className="auth-card-wrapper">
        {/* Hero */}
        <div className="auth-hero">
          <div className="auth-logo-float">
            <img
              src={companyLogo}
              alt="שמר בטיחות יועצים"
              style={{ maxWidth: "200px", width: "100%", height: "auto", objectFit: "contain" }}
            />
          </div>
          <h1 className="auth-hero-title">מערכת סקרים מקצועיים</h1>
          <p className="auth-hero-subtitle">פותח ע"י שמר בטיחות יועצים בע"מ</p>
        </div>

        {/* Glass card */}
        <div className="auth-glass-card">
          {/* Tabs */}
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={activeTab === "login"}
              className={`auth-tab${activeTab === "login" ? " auth-tab-active" : ""}`}
              onClick={() => setActiveTab("login")}>התחברות</button>
            <button type="button" role="tab" aria-selected={activeTab === "register"}
              className={`auth-tab${activeTab === "register" ? " auth-tab-active" : ""}`}
              onClick={() => setActiveTab("register")}>הרשמה</button>
          </div>

          {/* Login form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label htmlFor="login-email" className="auth-label">דואר אלקטרוני</label>
                <input id="login-email" type="email" inputMode="email" autoComplete="email" dir="ltr"
                  value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  required disabled={loginLoading} className="auth-input" placeholder="your@email.com" />
              </div>
              <div className="auth-field">
                <label htmlFor="login-password" className="auth-label">סיסמה</label>
                <input id="login-password" type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password" dir="ltr"
                  value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                  required disabled={loginLoading} className="auth-input" placeholder="••••••••" />
                <label className="auth-show-password">
                  <input type="checkbox" checked={showLoginPassword} onChange={(e) => setShowLoginPassword(e.target.checked)} />
                  הצג סיסמה
                </label>
              </div>
              {loginError && <p className="auth-error">{loginError}</p>}
              <button type="submit" className="auth-btn" disabled={loginLoading}>
                {loginLoading ? "מתחבר..." : "התחבר"}
              </button>
            </form>
          )}

          {/* Register form */}
          {activeTab === "register" && (
            regSuccess ? (
              <div className="auth-success">
                <p className="auth-success-title">ההרשמה הושלמה!</p>
                <p className="auth-success-sub">בדוק את תיבת הדואר שלך לאישור ואז התחבר.</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="reg-email" className="auth-label">דואר אלקטרוני</label>
                  <input id="reg-email" type="email" inputMode="email" autoComplete="email" dir="ltr"
                    value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                    required disabled={regLoading} className="auth-input" placeholder="your@email.com" />
                </div>
                <div className="auth-field">
                  <label htmlFor="reg-password" className="auth-label">סיסמה (לפחות 6 תווים)</label>
                  <input id="reg-password" type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password" dir="ltr"
                    value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                    required minLength={6} disabled={regLoading} className="auth-input" placeholder="••••••••" />
                  <label className="auth-show-password">
                    <input type="checkbox" checked={showRegPassword} onChange={(e) => setShowRegPassword(e.target.checked)} />
                    הצג סיסמה
                  </label>
                </div>
                {regError && <p className="auth-error">{regError}</p>}
                <button type="submit" className="auth-btn" disabled={regLoading}>
                  {regLoading ? "נרשם..." : "הירשם"}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "כתובת דואר אלקטרוני או סיסמה שגויים";
  if (msg.includes("Email not confirmed")) return "יש לאשר את כתובת הדואר האלקטרוני תחילה";
  if (msg.includes("User already registered")) return "כתובת דואר אלקטרוני זו כבר רשומה";
  if (msg.includes("Password should be at least")) return "הסיסמה חייבת להכיל לפחות 6 תווים";
  if (msg.includes("Unable to validate email")) return "כתובת דואר אלקטרוני לא תקינה";
  return msg;
}
