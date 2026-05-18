import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "@/lib/auth";
import supernagishLogo from "@/assets/WhatsApp Image 2026-05-18 at 22.57.55.jpeg";

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
            <img
              src={supernagishLogo}
              alt="SuperNagish"
              style={{
                maxWidth: "320px",
                width: "100%",
                height: "auto",
                objectFit: "contain",
              }}
            />
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
