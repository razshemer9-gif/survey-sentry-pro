import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp } from "@/lib/auth";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-background" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Survey Sentry Pro</h1>
          <p className="mt-2 text-sm text-muted-foreground">פלטפורמת סקרי נגישות מקצועית</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">התחברות</TabsTrigger>
            <TabsTrigger value="register">הרשמה</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">דואר אלקטרוני</Label>
                <Input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loginLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">סיסמה</Label>
                <Input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loginLoading}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
                  <input type="checkbox" checked={showLoginPassword} onChange={(e) => setShowLoginPassword(e.target.checked)} className="h-4 w-4 accent-primary" />
                  הצג סיסמה
                </label>
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? "מתחבר..." : "התחבר"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            {regSuccess ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 text-center">
                <p className="font-semibold">ההרשמה הושלמה!</p>
                <p className="mt-1 text-xs">בדוק את תיבת הדואר שלך לאישור ואז התחבר.</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">דואר אלקטרוני</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    disabled={regLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">סיסמה (לפחות 6 תווים)</Label>
                  <Input
                    id="reg-password"
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={regLoading}
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
                    <input type="checkbox" checked={showRegPassword} onChange={(e) => setShowRegPassword(e.target.checked)} className="h-4 w-4 accent-primary" />
                    הצג סיסמה
                  </label>
                </div>
                {regError && (
                  <p className="text-sm text-destructive">{regError}</p>
                )}
                <Button type="submit" className="w-full" disabled={regLoading}>
                  {regLoading ? "נרשם..." : "הירשם"}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
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
