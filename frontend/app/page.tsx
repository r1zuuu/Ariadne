"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TitleBar } from "@/components/title-bar";
import { Button, Input } from "@/components/ui";
import {
  ApiError,
  listProjects,
  login,
  readToken,
  register,
  serverReachable,
  serverUrl,
  writeToken,
} from "@/lib/api";

// Screen 01. Let the owner into their own base in two fields.
//
// Split screen, art on the left. The side is not arbitrary: in the painting the
// arm enters from the left edge and the threads fall away to the right, so the
// gesture carries the eye into the form instead of off the screen.

const HOST = serverUrl.replace(/^https?:\/\//, "");

type Mode = "login" | "register";

export default function EntryScreen() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<"checking" | "up" | "down">("checking");

  // Showing a login form to someone who already holds a token is the one thing
  // this screen must not do, so a held token leaves immediately.
  useEffect(() => {
    if (readToken()) router.replace("/home");
  }, [router]);

  const probe = () => {
    setServer("checking");
    void serverReachable().then((up) => setServer(up ? "up" : "down"));
  };

  useEffect(probe, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Checked here rather than by the backend, because only this screen knows
    // there are two password fields.
    if (mode === "register" && password !== again) {
      setError(t("error.passwordMismatch"));
      return;
    }

    setBusy(true);
    try {
      const { token } = mode === "login" ? await login(email, password) : await register(email, password);
      writeToken(token);
      // Onboarding is a one-time wizard, so only someone with no projects yet
      // belongs in it. Registering always lands there; signing in only does on
      // an account that never finished.
      const projects = mode === "register" ? [] : await listProjects();
      router.push(projects.length ? "/home" : "/onboarding");
    } catch (caught) {
      setError(messageFor(caught, mode, t));
      if (caught instanceof ApiError && caught.failure === "unreachable") setServer("down");
    } finally {
      setBusy(false);
    }
  };

  const down = server === "down";

  return (
    <div className="flex h-full flex-col">
      <TitleBar />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[55fr_45fr]">
        <ArtPanel tagline={t("tagline")} />

        {/* Scrolls on its own so a short window never clips the submit button. */}
        <div className="flex min-h-0 items-center justify-center overflow-y-auto px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <p className="display-serif text-lead uppercase tracking-[0.2em] text-ink-2">Ariadne</p>

            <h1 className="pt-7 text-title text-ink">
              {mode === "login" ? t("title") : t("titleRegister")}
            </h1>
            <p className="pt-2 text-body text-ink-2">
              {mode === "login" ? t("lead") : t("leadRegister")}
            </p>

            <form onSubmit={submit} className="flex flex-col gap-5 pt-8">
              <Input
                id="email"
                label={t("label.address")}
                type="email"
                autoComplete="email"
                autoFocus
                required
                placeholder={t("placeholder.address")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="password"
                label={t("label.password")}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                placeholder={mode === "login" ? t("placeholder.password") : t("placeholder.passwordNew")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error ?? undefined}
              />
              {mode === "register" ? (
                <Input
                  id="again"
                  label={t("label.passwordAgain")}
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder={t("placeholder.passwordAgain")}
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                />
              ) : null}

              <Button type="submit" size="lg" loading={busy} disabled={down} className="mt-1 w-full">
                {busy ? t("submitBusy") : mode === "login" ? t("submit") : t("submitRegister")}
              </Button>
            </form>

            <p className="pt-6 text-small text-ink-2">
              {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
                className="rounded-control font-medium text-thread underline underline-offset-2"
              >
                {mode === "login" ? t("switchToRegister") : t("switchToLogin")}
              </button>
            </p>

            {/* System status, not a headline. A dot plus one quiet line, and it
                only asks for attention in the one case where it has to. */}
            <p className="flex items-center gap-2 pt-10 text-data text-ink-3">
              <span
                aria-hidden="true"
                className={`h-[6px] w-[6px] rounded-pill ${
                  down ? "bg-iron" : server === "up" ? "bg-thread" : "bg-ink-3/40"
                }`}
              />
              <span className={down ? "text-iron" : undefined}>
                {t(`server.${server}`, { url: HOST })}
              </span>
              {down ? (
                <button type="button" onClick={probe} className="text-thread underline underline-offset-2">
                  {t("server.retry")}
                </button>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// The painting is the brand mark on this screen, so it is shown as a photograph
// on its own dark panel rather than blended into the light UI. Hidden below the
// two-column breakpoint: on a narrow window the form is the only thing that
// matters, and a decorative panel would push it under the fold.
function ArtPanel({ tagline }: { tagline: string }) {
  return (
    <div className="relative hidden overflow-hidden bg-canvas lg:block">
      <img
        src="/thread-1600.webp"
        srcSet="/thread-1000.webp 1000w, /thread-1600.webp 1600w"
        sizes="55vw"
        alt=""
        // Focused on the upper middle, where the hand and the threads are; the
        // default centre crop cuts the hand off on a tall panel.
        className="h-full w-full object-cover object-[50%_32%]"
      />
      {/* Barely there, and in the brand navy: enough to tie the panel to the
          rest of the product without turning the painting into a gradient. */}
      <div className="absolute inset-0 bg-thread/10 mix-blend-multiply" />
      <p className="absolute bottom-10 left-10 right-10 display-serif text-lead text-canvas-ink/85">
        {tagline}
      </p>
    </div>
  );
}

// The backend answers with a code; this turns it into the one sentence that says
// what to do, not what went wrong.
function messageFor(caught: unknown, mode: Mode, t: (key: string, values?: Record<string, string>) => string) {
  if (!(caught instanceof ApiError)) return t("error.credentials");
  if (caught.failure === "unreachable") return t("error.server", { url: HOST });
  if (caught.status === 401) return t("error.credentials");
  if (caught.code === "validation") {
    if (mode === "register" && /already registered/i.test(caught.message)) return t("error.emailTaken");
    if (/at least/i.test(caught.message)) return t("error.passwordShort");
    if (/email/i.test(caught.message)) return t("error.emailShape");
  }
  return caught.message;
}
