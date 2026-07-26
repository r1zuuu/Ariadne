"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LabyrinthPlate } from "@/components/labyrinth-plate";
import { TitleBar, type ServerState } from "@/components/title-bar";
import { Banner, Button, Field } from "@/components/ui";
import { ApiError, clearToken, login, readToken, register, serverReachable, serverUrl, writeToken } from "@/lib/api";

// Screen 01. Let the owner into their own base in two fields, without telling
// them what the product is.
//
// The layout is an accession record, not a centred card: monospace label on the
// left, value on the right, a hairline between rows, no box around anything.

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
  const [server, setServer] = useState<ServerState>("checking");
  // Showing a login form to someone who already holds a token is the one thing
  // this screen must not do. The main screen is the next piece of work, so until
  // it exists this branch says where the flow stands instead of pretending.
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => setSignedIn(Boolean(readToken())), []);

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
      router.push("/onboarding");
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
      {down ? (
        <Banner
          variant="error"
          what={t("server.down", { url: HOST })}
          means={t("server.downMeans")}
          action={{ label: t("server.retry"), onClick: probe }}
        />
      ) : null}

      <main className="flex min-h-0 flex-1 items-start gap-10 overflow-y-auto px-8 pt-10">
        <div className="hidden shrink-0 pt-6 lg:block">
          <LabyrinthPlate />
        </div>

        <div className="min-w-0 max-w-[560px] flex-1">
          <h1 className="text-section">
            {signedIn ? t("signedIn.title") : mode === "login" ? t("title") : t("titleRegister")}
          </h1>

          {signedIn ? (
            <div className="pt-6">
              <p className="max-w-[68ch] text-body text-ink-2">{t("signedIn.note")}</p>
              <div className="pt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    clearToken();
                    setSignedIn(false);
                  }}
                >
                  {t("signedIn.leave")}
                </Button>
              </div>
            </div>
          ) : (
          <>

          <form onSubmit={submit} className="pt-6">
            <div className="divide-y divide-hairline border-y border-hairline">
              <Field
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
              <Field
                id="password"
                label={t("label.password")}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error ?? undefined}
              />
              {mode === "register" ? (
                <Field
                  id="again"
                  label={t("label.passwordAgain")}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                />
              ) : null}
            </div>

            {/* Beside the button, not under it: switching mode is a peer of
                submitting, not a smaller afterthought. */}
            <div className="flex items-center gap-6 pt-6">
              <Button type="submit" disabled={busy || down}>
                {busy ? t("submitBusy") : mode === "login" ? t("submit") : t("submitRegister")}
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
              >
                {mode === "login" ? t("switchToRegister") : t("switchToLogin")}
              </Button>
            </div>
          </form>

          </>
          )}

          <p className="pt-7 font-data text-data text-ink-3">
            {t(`server.${server}`, { url: HOST })}
          </p>
        </div>
      </main>
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
