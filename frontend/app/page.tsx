"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TitleBar } from "@/components/title-bar";
import { Button, Input } from "@/components/ui";
import {
  ApiError,
  type Provider,
  authProviders,
  listProjects,
  login,
  readToken,
  register,
  signInWithProvider,
  writeToken,
} from "@/lib/api";

// Screen 01. Let the owner into their own base in two fields.
//
// Split screen, art on the left. The side is not arbitrary: in the painting the
// arm enters from the left edge and the threads fall away to the right, so the
// gesture carries the eye into the form instead of off the screen.

type Mode = "login" | "register";

// The provider's own spelling. Nobody writes "Github".
const PROVIDER_NAMES: Record<Provider, string> = { google: "Google", github: "GitHub" };

export default function EntryScreen() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  // Which provider we are mid-handoff with, so the button can say so and offer
  // a way out: the person is looking at a browser tab, not at this window.
  const [pending, setPending] = useState<Provider | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Showing a login form to someone who already holds a token is the one thing
  // this screen must not do, so a held token leaves immediately.
  useEffect(() => {
    if (readToken()) router.replace("/home");
  }, [router]);

  // Which ways in this server actually offers. A failure here is not worth a
  // message: the form still works, and buttons that cannot work stay hidden.
  useEffect(() => {
    void authProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  // Leaving the screen mid-handoff must stop the polling loop.
  useEffect(() => () => abort.current?.abort(), []);

  // Onboarding is a one-time wizard, so only someone with no projects yet
  // belongs in it. A fresh registration always lands there; every other way in
  // has to ask, because it may be an account that never finished.
  const enter = async (token: string, fresh: boolean) => {
    writeToken(token);
    const projects = fresh ? [] : await listProjects();
    router.push(projects.length ? "/home" : "/onboarding");
  };

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
      await enter(token, mode === "register");
    } catch (caught) {
      setError(messageFor(caught, mode, t));
    } finally {
      setBusy(false);
    }
  };

  const startProvider = async (provider: Provider) => {
    setError(null);
    setPending(provider);
    const controller = new AbortController();
    abort.current = controller;
    try {
      // Opens the system browser and does not return until the server has an
      // answer under this window's one-time id, or nobody comes back.
      const token = await signInWithProvider(provider, controller.signal);
      await enter(token, false);
    } catch (caught) {
      // Cancelling is a decision, not a failure, and needs no red text.
      if (controller.signal.aborted) return;
      // The copy below says "it did not happen" for every reason there is, which
      // is right for the reader and useless for anyone fixing it: a webview that
      // refused to open a browser and a provider that refused the account read
      // exactly the same. The real error goes to the console, where the person
      // debugging this is already looking.
      console.error("[sign-in]", provider, caught);
      setError(providerMessage(caught, provider, t));
    } finally {
      abort.current = null;
      setPending(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[55fr_45fr]">
        <ArtPanel tagline={t("tagline")} />

        {/* Scrolls on its own so a short window never clips the submit button. */}
        <div className="flex min-h-0 items-center justify-center overflow-y-auto px-6 py-8 sm:px-10">
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

              <Button
                type="submit"
                size="lg"
                loading={busy}
                disabled={!!pending}
                className="mt-1 w-full"
              >
                {busy ? t("submitBusy") : mode === "login" ? t("submit") : t("submitRegister")}
              </Button>
            </form>

            {/* Below the form, not above it: the address and password are how
                this account was made, and the providers are the alternative. */}
            {providers.length ? (
              <div className="pt-6">
                <p className="flex items-center gap-3 text-data text-ink-3">
                  <span aria-hidden="true" className="h-px flex-1 bg-edge/60" />
                  {t("or")}
                  <span aria-hidden="true" className="h-px flex-1 bg-edge/60" />
                </p>

                {/* Two marks, centred. The names were on the buttons and said
                    nothing the logos do not: these two are among the most
                    recognised marks there are, and the words made a column of
                    two wide bars out of a choice between two things. */}
                <div className="flex items-center justify-center gap-4 pt-6">
                  {providers.map((provider) => (
                    <m.button
                      key={provider}
                      type="button"
                      // The label is not decoration here. With the word gone the
                      // mark is the only thing on screen, and a screen reader has
                      // no logo to look at.
                      aria-label={t("continueWith", { provider: PROVIDER_NAMES[provider] })}
                      title={t("continueWith", { provider: PROVIDER_NAMES[provider] })}
                      disabled={busy || !!pending}
                      onClick={() => void startProvider(provider)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="grid h-[52px] w-[52px] place-items-center rounded-control border border-edge/60 bg-surface text-ink transition-colors duration-state hover:border-edge hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-thread disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pending === provider ? (
                        <m.span
                          aria-hidden="true"
                          className="block h-4 w-4 rounded-pill border-2 border-thread border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        />
                      ) : provider === "google" ? (
                        <GoogleMark />
                      ) : (
                        <GitHubMark />
                      )}
                    </m.button>
                  ))}
                </div>

                {/* The browser has the person's attention at this point, so this
                    window's only job is to offer a way back out of the wait. */}
                {pending ? (
                  <p className="pt-3 text-small text-ink-2">
                    {t("providerHint")}{" "}
                    <button
                      type="button"
                      onClick={() => abort.current?.abort()}
                      className="rounded-control font-medium text-thread underline underline-offset-2"
                    >
                      {t("providerCancel")}
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}

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
  if (caught.failure === "unreachable") return t("error.server");
  if (caught.status === 401) return t("error.credentials");
  if (caught.code === "validation") {
    if (mode === "register" && /already registered/i.test(caught.message)) return t("error.emailTaken");
    if (/at least/i.test(caught.message)) return t("error.passwordShort");
    if (/email/i.test(caught.message)) return t("error.emailShape");
  }
  return caught.message;
}

// Provider failures are different in kind: the server has already turned the
// interesting ones into a sentence meant to be read, so the job here is to pass
// those through and cover the two that carry no sentence of their own.
function providerMessage(
  caught: unknown,
  provider: Provider,
  t: (key: string, values?: Record<string, string>) => string,
) {
  const name = PROVIDER_NAMES[provider];
  if (!(caught instanceof ApiError)) return t("error.provider", { provider: name });
  if (caught.failure === "unreachable") return t("error.server");
  if (caught.code === "timeout") return t("error.providerTimeout", { provider: name });
  if (caught.message === "cancelled") return t("error.providerCancelled", { provider: name });
  return caught.message;
}

// The two marks, inline rather than fetched: the packaged window loads from disk
// under a strict policy, so anything with a URL in it is a thing that will not
// arrive one day. Google keeps its four colours because that is the mark people
// recognise; GitHub is monochrome by design and follows the text colour.
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
