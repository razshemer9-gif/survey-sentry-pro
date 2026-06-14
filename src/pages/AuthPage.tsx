import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "@/lib/auth";
import companyLogo from "@/assets/company-logo.png";
import "./AuthPage.css";

export default function AuthPage() {
  const navigate = useNavigate();

  const [loginEmail,    setLoginEmail]    = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading,  setLoginLoading]  = useState(false);
  const [loginError,    setLoginError]    = useState("");
  const [showLoginPwd,  setShowLoginPwd]  = useState(false);

  const [regEmail,    setRegEmail]    = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading,  setRegLoading]  = useState(false);
  const [regError,    setRegError]    = useState("");
  const [regSuccess,  setRegSuccess]  = useState(false);
  const [showRegPwd,  setShowRegPwd]  = useState(false);

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      navigate("/");
    } catch (err: unknown) {
      setLoginError(translateError(err instanceof Error ? err.message : "שגיאה בהתחברות"));
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
      setRegError(translateError(err instanceof Error ? err.message : "שגיאה בהרשמה"));
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="ap-page" dir="rtl">

      {/* ── Atmospheric glow orbs ── */}
      <div className="ap-orb ap-orb-1" />
      <div className="ap-orb ap-orb-2" />

      {/* ── Blueprint / engineering decorations ── */}
      <svg className="ap-deco" aria-hidden="true" viewBox="0 0 800 900" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Blueprint grid */}
        <g opacity="0.1" stroke="#7ab3ff" strokeWidth="0.75">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 52} x2="800" y2={i * 52} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 53} y1="0" x2={i * 53} y2="900" />
          ))}
        </g>

        {/* Floor plan — top left */}
        <g opacity="0.16" stroke="#a0c4ff" strokeWidth="1.5" fill="none">
          <rect x="30" y="40" width="185" height="135" rx="2" />
          <rect x="30" y="40" width="82"  height="62"  rx="1" />
          <rect x="132" y="40" width="83" height="92"  rx="1" />
          <line x1="112" y1="40"  x2="112" y2="175" />
          <line x1="30"  y1="102" x2="215" y2="102" />
          <rect x="48"  y="157" width="30" height="5" />
          <rect x="155" y="118" width="30" height="5" />
          <line x1="215" y1="130" x2="230" y2="130" />
          <line x1="215" y1="140" x2="225" y2="140" />
        </g>

        {/* Wheelchair accessibility icon — bottom right */}
        <g opacity="0.18" transform="translate(618,665) scale(2.6)" stroke="#7ab3ff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="4"  r="2" />
          <path d="M10 6.5c0 0 .5 2 2 2h4" />
          <path d="M9 12l1-5.5" />
          <path d="M9 12h5l1.5 4H9" />
          <circle cx="9"  cy="20" r="2.5" />
          <circle cx="17" cy="20" r="2.5" />
        </g>

        {/* Checklist — top right */}
        <g opacity="0.16" transform="translate(638,44) scale(3)" stroke="#a0c4ff" strokeWidth="1.1" fill="none" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="20" rx="2" />
          <line x1="7" y1="9"  x2="17" y2="9"  />
          <line x1="7" y1="13" x2="17" y2="13" />
          <line x1="7" y1="17" x2="13" y2="17" />
          <polyline points="3.5,7 5,8.5 7,6"    strokeWidth="1.5" />
          <polyline points="3.5,11 5,12.5 7,10" strokeWidth="1.5" />
        </g>

        {/* Ruler / measure — bottom center */}
        <g opacity="0.12" stroke="#7ab3ff" strokeWidth="1.1">
          <line x1="340" y1="828" x2="630" y2="828" />
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={i}
              x1={340 + i * 32} y1="820"
              x2={340 + i * 32} y2={i % 4 === 0 ? "835" : "824"}
            />
          ))}
        </g>

        {/* Engineering compass arc — bottom left */}
        <g opacity="0.14" stroke="#a0c4ff" strokeWidth="1.4" fill="none">
          <path d="M 70 810 A 130 130 0 0 1 265 728" />
          <line x1="70"  y1="810" x2="108" y2="695" />
          <line x1="70"  y1="810" x2="200" y2="758" />
          <circle cx="70" cy="810" r="3" fill="#a0c4ff" opacity="0.4" />
        </g>

        {/* Dimension lines — right side mid */}
        <g opacity="0.1" stroke="#7ab3ff" strokeWidth="1" strokeDasharray="4 4">
          <line x1="740" y1="300" x2="740" y2="600" />
          <line x1="730" y1="300" x2="750" y2="300" />
          <line x1="730" y1="600" x2="750" y2="600" />
        </g>
      </svg>

      {/* ── Main content column ── */}
      <div className="ap-wrapper">

        {/* ── Hero ── */}
        <div className="ap-hero">
          <div className="ap-logo-wrap">
            <img
              src={companyLogo}
              alt="שמר בטיחות יועצים"
              width={220}
              height="auto"
            />
          </div>

          <h1 className="ap-title">מערכת סקרים מקצועיים</h1>
          <p className="ap-subtitle">פותח ע״י שמר בטיחות יועצים בע״מ</p>

          <div className="ap-tags">
            <span>נגישות</span>
            <span className="ap-tags-dot">•</span>
            <span>בטיחות</span>
            <span className="ap-tags-dot">•</span>
            <span>מוסדות חינוך</span>
          </div>
        </div>

        {/* ── Glass form card ── */}
        <div className="ap-card">

          {/* Tabs */}
          <div className="ap-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              className={`ap-tab${activeTab === "login" ? " ap-tab-active" : ""}`}
              onClick={() => setActiveTab("login")}
            >
              התחברות
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              className={`ap-tab${activeTab === "register" ? " ap-tab-active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              הרשמה
            </button>
          </div>

          {/* Login form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="ap-form">
              <div className="ap-field">
                <label htmlFor="login-email" className="ap-label">דואר אלקטרוני</label>
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loginLoading}
                  className="ap-input"
                  placeholder="your@email.com"
                />
              </div>

              <div className="ap-field">
                <label htmlFor="login-password" className="ap-label">סיסמה</label>
                <input
                  id="login-password"
                  type={showLoginPwd ? "text" : "password"}
                  autoComplete="current-password"
                  dir="ltr"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loginLoading}
                  className="ap-input"
                  placeholder="••••••••"
                />
                <label className="ap-show-pwd">
                  <input
                    type="checkbox"
                    checked={showLoginPwd}
                    onChange={(e) => setShowLoginPwd(e.target.checked)}
                  />
                  הצג סיסמה
                </label>
              </div>

              {loginError && <p className="ap-error">{loginError}</p>}

              <button type="submit" className="ap-btn" disabled={loginLoading}>
                {loginLoading ? "מתחבר..." : "התחבר"}
              </button>
            </form>
          )}

          {/* Register form */}
          {activeTab === "register" && (
            regSuccess ? (
              <div className="ap-success">
                <p className="ap-success-title">ההרשמה הושלמה!</p>
                <p className="ap-success-sub">בדוק את תיבת הדואר שלך לאישור ואז התחבר.</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="ap-form">
                <div className="ap-field">
                  <label htmlFor="reg-email" className="ap-label">דואר אלקטרוני</label>
                  <input
                    id="reg-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    disabled={regLoading}
                    className="ap-input"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="ap-field">
                  <label htmlFor="reg-password" className="ap-label">סיסמה (לפחות 6 תווים)</label>
                  <input
                    id="reg-password"
                    type={showRegPwd ? "text" : "password"}
                    autoComplete="new-password"
                    dir="ltr"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={regLoading}
                    className="ap-input"
                    placeholder="••••••••"
                  />
                  <label className="ap-show-pwd">
                    <input
                      type="checkbox"
                      checked={showRegPwd}
                      onChange={(e) => setShowRegPwd(e.target.checked)}
                    />
                    הצג סיסמה
                  </label>
                </div>

                {regError && <p className="ap-error">{regError}</p>}

                <button type="submit" className="ap-btn" disabled={regLoading}>
                  {regLoading ? "נרשם..." : "הירשם"}
                </button>
              </form>
            )
          )}
        </div>

        {/* ── Footer ── */}
        <p className="ap-footer">© 2026 שמר בטיחות יועצים בע״מ · כל הזכויות שמורות</p>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "כתובת דואר אלקטרוני או סיסמה שגויים";
  if (msg.includes("Email not confirmed"))        return "יש לאשר את כתובת הדואר האלקטרוני תחילה";
  if (msg.includes("User already registered"))    return "כתובת דואר אלקטרוני זו כבר רשומה";
  if (msg.includes("Password should be at least"))return "הסיסמה חייבת להכיל לפחות 6 תווים";
  if (msg.includes("Unable to validate email"))   return "כתובת דואר אלקטרוני לא תקינה";
  return msg;
}
