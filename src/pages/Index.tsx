import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calculator, ChevronLeft, ExternalLink, Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { accessibilityScopeLabel, scopeFromChecks } from "@/lib/accessibility-scope";
import { loadStartingItems, loadUserSettings, newReport, refreshReports, saveReport } from "@/lib/storage";
import { startSyncEngine } from "@/lib/sync-engine";
import { welfareInspectorPrefill } from "@/lib/welfare-prefill";
import { getSurveyType, SURVEY_TYPES, SurveyReport, SurveyType } from "@/lib/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canUseStaticCalc, STATIC_CALC_URL } from "@/lib/static-calc-access";
import { useEngUi } from "@/hooks/use-eng-ui";
import { useResolvedTheme } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { greeting } from "@/lib/display-name";
import { ConsultantSettings } from "@/lib/types";
import logoDark from "@/assets/logo-shemer-dark.webp";
import logoLight from "@/assets/logo-shemer-light.webp";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SurveyType | null>(null);
  const [creating, setCreating] = useState(false);
  // Which certification(s) an accessibility report covers. Both are ticked by
  // default — the consultant unticks the one they are not certified for.
  const [scopeMatos, setScopeMatos] = useState(true);
  const [scopeService, setScopeService] = useState(true);
  // Account id -> display name, used to label reports written by someone else.
  // Only populated with other people's names for owners/admins; RLS returns
  // just the current user's profile to everyone else.
  // New design (preview users only): compact header, a search box over the
  // list, dense rows, and survey types that open with a single tap.
  const eng = useEngUi();
  const theme = useResolvedTheme();
  const isDark = theme === "dark";
  const [settings, setSettings] = useState<ConsultantSettings | null>(null);
  // True only while the first refresh is still in flight, so an empty cache
  // says "loading" rather than "you have no reports".

  // ProtectedRoute (App.tsx) already gates this page on a logged-in user.
  //
  // The device answers first. The screen is drawn, and the New Report button
  // is usable, from the IndexedDB cache alone — no network in that path at
  // all. The refresh then runs behind it and updates the list twice: once
  // when the names arrive, once when the recent reports have been pulled
  // down in full for offline use. See lib/storage.
  useEffect(() => {
    // Nothing on this screen shows a report, so nothing here waits for one.
    // Two things still happen, both out of sight:
    //
    // The sync engine starts, so work written on site with no signal goes up
    // as soon as the app is opened somewhere with one — it must not wait for
    // the consultant to visit a list first.
    //
    // And the reports are pulled down in the background, so that opening
    // הדוחות שלי on the way to a site, or at the site itself, finds them
    // already on the device. Failures are logged, not shown: a message about
    // a list would make no sense on a screen that shows no list, and the
    // list screen reports them where they mean something.
    startSyncEngine();
    refreshReports().catch((err) => console.warn("[home] background refresh failed", err));
  }, []);

  // The greeting's name, and nothing else from settings.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    loadUserSettings(user.id)
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  function openNewDialog() {
    setSelectedType(null);
    setScopeMatos(true);
    setScopeService(true);
    setTypeDialogOpen(true);
  }

  // `type` is passed when a survey type is opened with a single tap (new
  // design); otherwise the type chosen in the dialog is used.
  async function createNew(type: SurveyType | null = selectedType) {
    const selectedType = type;
    if (!selectedType || creating) return;
    setCreating(true);
    try {
      // Form 8 snapshots the consultant's מורשה נגישות details from their
      // account settings into the report at creation time. Missing details
      // don't block creation — just a heads-up; the consultant can fill them
      // in (in Settings) and re-enter the report's own חלק ב' fields later.
      if (selectedType === "accessibility_form_8" || selectedType === "accessibility_form_8_event") {
        if (!user) return;
        const settings = await loadUserSettings(user.id);
        const fmt = settings.reportFormats?.accessibility_form_8;
        if (!fmt?.accessibilityMatosName) {
          toast.info('חסרים פרטי מורשה נגישות עבור טופס 8. אפשר להמשיך וליצור את הדוח, ולהשלים את הפרטים בהגדרות החשבון בכל שלב.');
        }
        const draft: SurveyReport = {
          ...newReport(selectedType),
          form8ExpertName: fmt?.accessibilityMatosName,
          form8ExpertId: fmt?.accessibilityMatosId,
          form8ExpertRegistrationNumber: fmt?.accessibilityMatosRegistrationNumber,
          form8ExpertRegistryName: fmt?.accessibilityMatosRegistryName,
          form8ExpertAddress: fmt?.accessibilityExpertAddress,
          form8ExpertPhone: fmt?.accessibilityExpertPhone,
          form8ExpertEmail: fmt?.accessibilityExpertEmail,
          form8ServiceExpertName: fmt?.accessibilityServiceName,
          form8ServiceExpertId: fmt?.accessibilityServiceId,
          form8ServiceRegistrationNumber: fmt?.accessibilityServiceRegistrationNumber,
          form8ServiceRegistryName: fmt?.accessibilityServiceRegistryName,
          form8ExpertSignature: fmt?.accessibilityExpertSignature,
          // The event form is an approval: it is filed once both sets of
          // provisions hold, so both boxes start ticked and the consultant
          // unticks one only where it does not apply.
          ...(selectedType === "accessibility_form_8_event" && {
            form8BuildingApproved: true,
            form8ServiceApproved: true,
          }),
        };
        const r = await saveReport(draft);
        setTypeDialogOpen(false);
        navigate(`/report/${r.id}`);
        return;
      }

      // A welfare inspection asks for the inspector's own details — name,
      // identity number, qualification, registration number, telephone,
      // e-mail, years of experience — and they are the same on every one.
      // They come from the account; see lib/welfare-prefill for what the
      // retyping had been costing.
      if (selectedType === "welfare_inspection") {
        const settings = user ? await loadUserSettings(user.id) : null;
        const draft = {
          ...newReport(selectedType),
          ...(settings ? welfareInspectorPrefill(settings) : {}),
        };
        const r = await saveReport(draft);
        setTypeDialogOpen(false);
        navigate(`/report/${r.id}`);
        return;
      }

      // education_safety, element_stability and risk_survey start empty
      // (no template needed)
      if (selectedType === "education_safety" || selectedType === "element_stability" || selectedType === "risk_survey") {
        const r = await saveReport(newReport(selectedType));
        setTypeDialogOpen(false);
        navigate(`/report/${r.id}`);
        return;
      }

      // The accessibility survey opens on the consultant's own list, with
      // the clause, the proposed correction and the reference drawing
      // already on every finding. An account that has no list of its own
      // opens on the built-in checklist and the report still starts: a new
      // account used to be turned away here and told to go and build one.
      const savedItems = await loadStartingItems(selectedType);
      const draft = newReport(selectedType, savedItems ?? undefined);
      // Only the accessibility survey carries a certification scope.
      const scope = selectedType === "accessibility" ? scopeFromChecks(scopeMatos, scopeService) : null;
      const r = await saveReport(scope ? { ...draft, accessibilityScope: scope } : draft);
      setTypeDialogOpen(false);
      navigate(`/report/${r.id}`);
    } catch {
      toast.error("שגיאה ביצירת דוח חדש");
    } finally {
      setCreating(false);
    }
  }


  return (
    <AppShell>
      <div className="home-surface px-4 pb-4 safe-top">
        <header className="flex items-center justify-between gap-3 pt-3">
          {/* Settings is where the consultant's name, stamp and report text
              live, and it was a grey square that read as part of the frame.
              It carries the app's own blue now, so it is found at a glance
              on a bright screen held at arm's length. */}
          <Link
            to="/settings"
            aria-label="הגדרות"
            className="home-cta grid h-11 w-11 place-items-center rounded-2xl text-white shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--home-bg-top)]"
          >
            <SettingsIcon className="h-[22px] w-[22px]" />
          </Link>

          <img
            src={isDark ? logoDark : logoLight}
            alt="שמר בטיחות יועצים"
            width={168}
            height={85}
            decoding="async"
            className="h-[62px] w-auto select-none object-contain"
          />

          <ThemeToggle />
        </header>

        <h1 className="mt-4 text-center text-[32px] font-extrabold leading-none tracking-[-0.02em]">
          {greeting(settings, null, user?.email)}
        </h1>

        <button
          type="button"
          onClick={openNewDialog}
          className="home-cta mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-[28px] text-[21px] font-extrabold text-white transition-[transform,filter] active:scale-[0.99] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--home-cta-top)] focus-visible:ring-offset-[hsl(var(--home-bg-top))]"
        >
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <Plus className="h-5 w-5" />
          </span>
          יצירת דוח חדש
        </button>

      </div>

      {/* Survey type selection dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={(o) => { if (!creating) setTypeDialogOpen(o); }}>
        <DialogContent className="max-h-[85vh] w-[92vw] max-w-sm overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>בחר סוג סקר</DialogTitle>
          </DialogHeader>
          {eng && <p className="-mt-2 text-xs text-muted-foreground">הקשה על סוג הסקר פותחת דוח חדש מיד.</p>}
          <div className="space-y-2 py-1">
            {SURVEY_TYPES.map((t) => (
              <button
                key={t.id}
                disabled={eng && creating}
                onClick={() => {
                  setSelectedType(t.id);
                  // New design: every type but the accessibility survey
                  // (which first asks for its certification) opens at once.
                  if (eng && t.id !== "accessibility") createNew(t.id);
                }}
                className={cn(
                  "w-full rounded-2xl border-2 px-4 py-4 text-right transition-all",
                  eng && "border px-3 py-3 disabled:opacity-60",
                  selectedType === t.id
                    ? "ring-2 ring-offset-1"
                    : "border-border bg-background hover:bg-muted",
                )}
                style={
                  selectedType === t.id
                    ? { borderColor: t.color, background: t.color + "12", ringColor: t.color }
                    : {}
                }
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors"
                    style={{
                      borderColor: t.color,
                      background: selectedType === t.id ? t.color : "transparent",
                    }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: selectedType === t.id ? t.color : undefined }}
                  >
                    {t.label}
                  </span>
                  {eng && (creating && selectedType === t.id ? (
                    <Loader2 className="ms-auto h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
                  ) : t.id !== "accessibility" ? (
                    <ChevronLeft className="ms-auto h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : null)}
                </div>
              </button>
            ))}

            {/* Last in the list, and not one of the choices above: it starts
                nothing here but opens our separate static-calculations app,
                in a tab of its own. Linked rather than copied in, so its
                updates arrive on their own — and kept out of an iframe,
                where iOS files its saved calculations under a different site
                and restricts the microphone and sharing that its dictation
                and PDF sending need.

                Only the people who work with that app are offered it; for
                everyone else the list ends at the survey types. */}
            {canUseStaticCalc(user?.email) && (
            <a
              href={STATIC_CALC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-background px-4 py-4 text-right transition-colors hover:bg-muted"
            >
              <Calculator className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm font-semibold">חישובים סטטיים</span>
              <ExternalLink className="ms-auto h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            </a>
            )}
          </div>
          {selectedType === "accessibility" && (
            <div className="rounded-2xl border-2 border-primary/25 bg-primary-soft/30 p-3">
              <div className="text-sm font-bold text-primary">במה אתה מוסמך?</div>
              <p className="mt-1 text-xs text-muted-foreground">
                שתי ההסמכות מסומנות כברירת מחדל. הורד את הסימון מזו שאינך מוסמך לה — כותרת הדוח תשתנה בהתאם.
              </p>
              <div className="mt-3 space-y-2">
                {([
                  ["matos", 'מורשה נגישות מתו״ס', scopeMatos, setScopeMatos] as const,
                  ["service", "מורשה נגישות שירות", scopeService, setScopeService] as const,
                ]).map(([key, label, checked, setChecked]) => (
                  <label
                    key={key}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-3 rounded-xl border-2 px-3 py-3 transition-colors",
                      checked ? "border-primary bg-primary/10" : "border-border bg-background",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                      className="h-5 w-5 flex-shrink-0 accent-primary"
                    />
                    <span className={cn("text-sm font-semibold", checked && "text-primary")}>{label}</span>
                  </label>
                ))}
              </div>
              {!scopeMatos && !scopeService ? (
                <p className="mt-2 text-xs font-semibold text-destructive">יש לסמן לפחות הסמכה אחת.</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  כותרת הדוח: <strong>{`סקר ${accessibilityScopeLabel(scopeFromChecks(scopeMatos, scopeService)!)}`}</strong>
                </p>
              )}
            </div>
          )}
          {(!eng || selectedType === "accessibility") && (
          <Button
            onClick={() => createNew()}
            disabled={!selectedType || creating || (selectedType === "accessibility" && !scopeMatos && !scopeService)}
            className="mt-1 w-full gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            צור דוח
          </Button>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Index;
