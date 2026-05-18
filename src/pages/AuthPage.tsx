import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "@/lib/auth";

function SuperNagishLogo() {
  return (
    <svg
      viewBox="0 0 495 120"
      xmlns="http://www.w3.org/2000/svg"
      style={{ maxWidth: "260px", width: "100%", display: "block" }}
      aria-label="SuperNagish"
    >
      <defs>
        <linearGradient id="sn-silver" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#DDE8FF" />
          <stop offset="100%" stopColor="#98B4DC" />
        </linearGradient>
        <linearGradient id="sn-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#33C3FF" />
          <stop offset="100%" stopColor="#0055EE" />
        </linearGradient>
        <linearGradient id="sn-diamond-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#33C3FF" />
          <stop offset="100%" stopColor="#0044CC" />
        </linearGradient>
        <linearGradient id="sn-streak" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#33C3FF" stopOpacity="0" />
          <stop offset="15%" stopColor="#33C3FF" stopOpacity="0.6" />
          <stop offset="65%" stopColor="#0066FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
        </linearGradient>
        <filter id="sn-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="sn-text-glow" x="-5%" y="-25%" width="110%" height="150%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Horizontal light streak */}
      <line x1="5" y1="102" x2="360" y2="102" stroke="url(#sn-streak)" strokeWidth="1.5" />

      {/* SUPER – silver/white metallic */}
      <text
        x="5" y="91"
        fontFamily="'Heebo', 'Arial Black', Impact, system-ui"
        fontWeight="900"
        fontSize="74"
        fill="url(#sn-silver)"
        textLength="172"
        lengthAdjust="spacingAndGlyphs"
      >
        SUPER
      </text>

      {/* NAGISH – electric blue */}
      <text
        x="178" y="91"
        fontFamily="'Heebo', 'Arial Black', Impact, system-ui"
        fontWeight="900"
        fontSize="74"
        fill="url(#sn-blue)"
        filter="url(#sn-text-glow)"
        textLength="185"
        lengthAdjust="spacingAndGlyphs"
      >
        NAGISH
      </text>

      {/* Diamond – outer glow stroke */}
      <path
        d="M 435,5 L 490,60 L 435,115 L 380,60 Z"
        fill="none"
        stroke="url(#sn-diamond-stroke)"
        strokeWidth="4"
        filter="url(#sn-glow)"
      />
      {/* Diamond – inner outline */}
      <path
        d="M 435,14 L 481,60 L 435,106 L 389,60 Z"
        fill="none"
        stroke="rgba(51,195,255,0.35)"
        strokeWidth="1.5"
      />

      {/* Wheelchair figure centered at (440, 60) */}
      <g
        transform="translate(440, 60)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Head */}
        <circle cx="0" cy="-33" r="7" fill="#33C3FF" stroke="none" />
        {/* Body leaning forward */}
        <line x1="0" y1="-25" x2="4" y2="-10" stroke="#33C3FF" strokeWidth="5.5" />
        {/* Raised arm */}
        <line x1="2" y1="-19" x2="16" y2="-25" stroke="#33C3FF" strokeWidth="4.5" />
        {/* Seat horizontal */}
        <line x1="-14" y1="-8" x2="12" y2="-8" stroke="#33C3FF" strokeWidth="4.5" />
        {/* Seat back vertical */}
        <line x1="-14" y1="-8" x2="-14" y2="4" stroke="#33C3FF" strokeWidth="4.5" />
        {/* Leg / foot rest */}
        <line x1="12" y1="-8" x2="14" y2="5" stroke="#33C3FF" strokeWidth="3.5" />
        {/* Front caster */}
        <circle cx="12" cy="11" r="5" stroke="#33C3FF" strokeWidth="3" />
        {/* Rear wheel */}
        <circle cx="-14" cy="20" r="20" stroke="#33C3FF" strokeWidth="4.5" />
      </g>
    </svg>
  );
}

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

      <div className="auth-card-wrapper">
        {/* Logo */}
        <div className="auth-logo-container">
          <div className="auth-logo-float">
            <SuperNagishLogo />
          </div>
          <p className="auth-tagline">פלטפורמת סקרי נגישות מקצועית</p>
        </div>

        {/* Glass card */}
        <div className="auth-glass-card">
          {/* Tabs */}
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              className={`auth-tab${activeTab === "login" ? " auth-tab-active" : ""}`}
              onClick={() => setActiveTab("login")}
            >
              התחברות
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              className={`auth-tab${activeTab === "register" ? " auth-tab-active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              הרשמה
            </button>
          </div>

          {/* Login form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label htmlFor="login-email" className="auth-label">
                  דואר אלקטרוני
                </label>
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
                  className="auth-input"
                  placeholder="your@email.com"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="login-password" className="auth-label">
                  סיסמה
                </label>
                <input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  dir="ltr"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loginLoading}
                  className="auth-input"
                  placeholder="••••••••"
                />
                <label className="auth-show-password">
                  <input
                    type="checkbox"
                    checked={showLoginPassword}
                    onChange={(e) => setShowLoginPassword(e.target.checked)}
                  />
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
                <p className="auth-success-sub">
                  בדוק את תיבת הדואר שלך לאישור ואז התחבר.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="reg-email" className="auth-label">
                    דואר אלקטרוני
                  </label>
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
                    className="auth-input"
                    placeholder="your@email.com"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="reg-password" className="auth-label">
                    סיסמה (לפחות 6 תווים)
                  </label>
                  <input
                    id="reg-password"
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    dir="ltr"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={regLoading}
                    className="auth-input"
                    placeholder="••••••••"
                  />
                  <label className="auth-show-password">
                    <input
                      type="checkbox"
                      checked={showRegPassword}
                      onChange={(e) => setShowRegPassword(e.target.checked)}
                    />
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
