"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AgentStep,
  PROFILE_QUESTIONS,
  ProfileStep,
  ProjectStep,
  type Agent,
  type Answers,
  type Card,
} from "@/components/onboarding-steps";
import { ThreadProgress } from "@/components/thread-progress";
import { TitleBar } from "@/components/title-bar";
import { Banner, Button } from "@/components/ui";
import { ApiError, createProject, mintToken, readToken, saveProfile, serverUrl } from "@/lib/api";

// Screen 02. Collect a profile, create the first project, connect an agent, and
// get out of the way.
//
// Step 1 holds five views, four questions and the assembled text, while the
// thread still reads step 1 of 3, because the person answering is doing one
// thing. Step 3 is skippable out loud and at the same size as the other actions,
// because someone without a terminal is not a second-class user.

const HOST = serverUrl.replace(/^https?:\/\//, "");
const EMPTY_ANSWERS: Answers = { q1: "", q2: "", q3: "", q4: "" };
const EMPTY_CARD: Card = { name: "", repoRef: "", stack: "", etap: "prototyp", ograniczenia: "" };

export default function OnboardingScreen() {
  const t = useTranslations("onboarding");
  const tAuth = useTranslations("auth");
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profileIndex, setProfileIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [profile, setProfile] = useState("");
  const [card, setCard] = useState<Card>(EMPTY_CARD);
  const [agent, setAgent] = useState<Agent>("claude-code");
  const [token, setToken] = useState<string | null>(null);
  const [tokenFailed, setTokenFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Nobody reaches onboarding without a token, so arriving without one means a
  // reload after the session went away.
  useEffect(() => {
    if (!readToken()) router.replace("/");
  }, [router]);

  const mint = async () => {
    setTokenFailed(false);
    try {
      const minted = await mintToken(agent);
      setToken(minted.token);
    } catch {
      setTokenFailed(true);
    }
  };

  const failureMessage = (caught: unknown) =>
    caught instanceof ApiError && caught.failure === "rejected"
      ? caught.message
      : tAuth("error.server", { url: HOST });

  const advance = async () => {
    setFailure(null);
    setFieldError(null);
    setBusy(true);
    try {
      if (step === 1) {
        if (profileIndex < PROFILE_QUESTIONS.length) {
          const next = profileIndex + 1;
          // Assembled on the way to the last view, so the editable text is
          // already there when the reader arrives.
          if (next === PROFILE_QUESTIONS.length) setProfile(assemble(answers));
          setProfileIndex(next);
          return;
        }
        await saveProfile(profile);
        setStep(2);
        return;
      }

      if (step === 2) {
        if (!card.name.trim()) {
          setFieldError(t("project.error.name"));
          return;
        }
        await createProject({
          name: card.name.trim(),
          // The backend requires a repo_ref and a project without a repository is
          // a real case, so the name stands in until there is one.
          repoRef: card.repoRef.trim() || `local/${slug(card.name)}`,
          stack: card.stack.trim(),
          etap: card.etap,
          ograniczenia: card.ograniczenia.trim(),
        });
        await mint();
        setStep(3);
        return;
      }

      router.push("/");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "validation" && step === 2) {
        setFieldError(/repo_ref/.test(caught.message) ? t("project.error.repoTaken") : caught.message);
      } else {
        setFailure(failureMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setFailure(null);
    setFieldError(null);
    if (step === 1 && profileIndex > 0) return setProfileIndex(profileIndex - 1);
    if (step === 2) return setStep(1);
    if (step === 3) return setStep(2);
  };

  const title = step === 1 ? t("profile.title") : step === 2 ? t("project.title") : t("agent.title");
  const canGoBack = step > 1 || profileIndex > 0;

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      {failure ? <Banner variant="error" what={failure} /> : null}

      <main className="min-h-0 flex-1 overflow-y-auto px-8 pt-9">
        <ThreadProgress step={step} />

        <h1 className="pt-7 text-section">{title}</h1>

        <div className="max-w-[720px] pt-6">
          {step === 1 ? (
            <ProfileStep
              index={profileIndex}
              answers={answers}
              profile={profile}
              onAnswer={(key, value) => setAnswers({ ...answers, [key]: value })}
              onProfile={setProfile}
            />
          ) : step === 2 ? (
            <ProjectStep
              card={card}
              error={fieldError}
              onChange={(patch) => setCard({ ...card, ...patch })}
            />
          ) : (
            <AgentStep
              agent={agent}
              token={token}
              failed={tokenFailed}
              onAgent={setAgent}
              onRegenerate={() => void mint()}
            />
          )}
        </div>

        <div className="flex max-w-[720px] items-center gap-6 pb-9 pt-7">
          <Button onClick={() => void advance()} disabled={busy}>
            {step === 3 ? t("finish") : t("next")}
          </Button>
          {canGoBack ? (
            <Button variant="quiet" onClick={back} disabled={busy}>
              {t("back")}
            </Button>
          ) : null}
          {step < 3 ? (
            <Button variant="quiet" className="ml-auto" onClick={() => router.push("/")} disabled={busy}>
              {t("skip")}
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

// The four answers become one paragraph, because that is the shape the agent
// reads at the start of every session. Empty answers drop out instead of leaving
// dangling punctuation behind.
function assemble(answers: Answers): string {
  return PROFILE_QUESTIONS.map((key) => answers[key].trim())
    .filter(Boolean)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`))
    .join(" ");
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projekt"
  );
}
