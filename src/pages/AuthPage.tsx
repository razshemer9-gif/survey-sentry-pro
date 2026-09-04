import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "@/lib/auth";
import authLogo from "@/assets/auth-logo.png";
import "./AuthPage.css";

export default function AuthPage() {
  const navigate = useNavigate();

  const [loginEmail,    setLoginEmail]    = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading,  setLoginLoading]  = useState(false);
  const [loginError,    setLoginError]    = useState("");
  const [showLoginPwd,  setShowLoginPwd]  = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("הבקשה לקחה יותר מדי זמן — בדוק חיבור לאינטרנט ונסה שוב")), 12000)
      );
      await Promise.race([signIn(loginEmail, loginPassword), timeout]);
      navigate("/");
    } catch (err: unknown) {
      setLoginError(translateError(err instanceof Error ? err.message : "שגיאה בהתחברות"));
    } finally {
      setLoginLoading(false);
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
        <g opacity="0.12" stroke="#7ab3ff" strokeWidth="0.75">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 52} x2="800" y2={i * 52} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 53} y1="0" x2={i * 53} y2="900" />
          ))}
        </g>

        {/* Floor plan — top left (bigger, more visible) */}
        <g opacity="0.32" stroke="#a0c4ff" strokeWidth="1.8" fill="none">
          <rect x="18" y="30" width="220" height="160" rx="2" />
          <rect x="18" y="30" width="98"  height="75"  rx="1" />
          <rect x="138" y="30" width="100" height="110" rx="1" />
          <line x1="136" y1="30"  x2="136" y2="190" />
          <line x1="18"  y1="120" x2="238" y2="120" />
          <rect x="38"  y="170" width="36" height="6" rx="1" />
          <rect x="168" y="138" width="36" height="6" rx="1" />
          <line x1="238" y1="148" x2="258" y2="148" />
          <line x1="238" y1="160" x2="253" y2="160" />
          {/* Door arcs */}
          <path d="M18 105 A 22 22 0 0 1 40 83" strokeDasharray="none" />
          <path d="M136 110 A 20 20 0 0 0 156 90" strokeDasharray="none" />
          {/* Dimension marks */}
          <line x1="18" y1="205" x2="238" y2="205" strokeWidth="1" />
          <line x1="18" y1="200" x2="18"  y2="210" strokeWidth="1" />
          <line x1="238" y1="200" x2="238" y2="210" strokeWidth="1" />
        </g>

        {/* Wheelchair accessibility icon — bottom left, large & prominent */}
        <g opacity="0.36" transform="translate(28,660) scale(4.2)" stroke="#7ab3ff" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Circle background outline */}
          <circle cx="12" cy="12" r="11" strokeWidth="0.9" opacity="0.4" />
          {/* Head */}
          <circle cx="12" cy="4.5" r="2" />
          {/* Body / arm */}
          <path d="M10 7c0 0 .6 2.5 2 2.5h4.5" />
          {/* Torso */}
          <path d="M9.5 13.5l1-6" />
          {/* Seat + footrest */}
          <path d="M9.5 13.5h5.5l1.8 4.5H9.5" />
          {/* Wheels */}
          <circle cx="9.5"  cy="21" r="2.8" />
          <circle cx="17.5" cy="21" r="2.8" />
        </g>

        {/* Checklist document — top right, large & prominent */}
        <g opacity="0.30" transform="translate(618,30) scale(3.5)" stroke="#a0c4ff" strokeWidth="1.2" fill="none" strokeLinecap="round">
          <rect x="3" y="2" width="18" height="22" rx="2.5" />
          {/* Header line */}
          <line x1="7" y1="7"  x2="17" y2="7"  />
          <line x1="7" y1="11" x2="17" y2="11" />
          <line x1="7" y1="15" x2="17" y2="15" />
          <line x1="7" y1="19" x2="13" y2="19" />
          {/* Checkmarks */}
          <polyline points="3,6 4.5,7.5 6.5,5"   strokeWidth="1.6" stroke="#7ab3ff" />
          <polyline points="3,10 4.5,11.5 6.5,9"  strokeWidth="1.6" stroke="#7ab3ff" />
          <polyline points="3,14 4.5,15.5 6.5,13" strokeWidth="1.6" stroke="#7ab3ff" />
        </g>

        {/* Ruler / measure — bottom center */}
        <g opacity="0.22" stroke="#7ab3ff" strokeWidth="1.2">
          <line x1="300" y1="832" x2="640" y2="832" />
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i}
              x1={300 + i * 30} y1="824"
              x2={300 + i * 30} y2={i % 4 === 0 ? "840" : "827"}
            />
          ))}
        </g>

        {/* Engineering compass arc — bottom right */}
        <g opacity="0.26" stroke="#a0c4ff" strokeWidth="1.6" fill="none">
          <path d="M 660 840 A 140 140 0 0 0 790 720" />
          <line x1="660" y1="840" x2="700" y2="715" />
          <line x1="660" y1="840" x2="780" y2="790" />
          <circle cx="660" cy="840" r="4" fill="#a0c4ff" opacity="0.5" />
        </g>

        {/* Dimension lines — left side mid */}
        <g opacity="0.18" stroke="#7ab3ff" strokeWidth="1" strokeDasharray="5 4">
          <line x1="8" y1="360" x2="8" y2="650" />
          <line x1="2" y1="360" x2="14" y2="360" />
          <line x1="2" y1="650" x2="14" y2="650" />
        </g>
      </svg>

      {/* ── Main content column ── */}
      <div className="ap-wrapper">

        {/* ── Hero ── */}
        <div className="ap-hero">
          <div className="ap-logo-wrap">
            <img
              src={authLogo}
              alt="שמר בטיחות יועצים — בטיחות לפני הכל"
              width={300}
              height="auto"
            />
          </div>

          <h1 className="ap-title">מערכת סקרים מקצועיים</h1>
          <p className="ap-subtitle">פותח ע״י שמר בטיחות יועצים בע״מ</p>
        </div>

        {/* ── Glass form card ── */}
        <div className="ap-card">

          {/* Login form — the only way in. Accounts are created by an
              administrator in the Supabase dashboard; there is deliberately
              no self-service sign-up. */}
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

        </div>

        {/* ── Footer ── */}
        <p className="ap-footer">© 2026 שמר בטיחות יועצים בע״מ · כל הזכויות שמורות</p>
      </div>
    </div>
  );
}

// Sign-in only — the sign-up cases ("User already registered", the password
// length rule) were dropped along with the registration form.
function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "כתובת דואר אלקטרוני או סיסמה שגויים";
  if (msg.includes("Email not confirmed"))        return "יש לאשר את כתובת הדואר האלקטרוני תחילה";
  if (msg.includes("Unable to validate email"))   return "כתובת דואר אלקטרוני לא תקינה";
  return msg;
}
