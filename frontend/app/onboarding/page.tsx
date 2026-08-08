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
import { RecordPreview, type Entry } from "@/components/record-preview";
import { ThreadProgress } from "@/components/thread-progress";
import { TitleBar } from "@/components/title-bar";
import { Banner, Button } from "@/components/ui";
import {
  ApiError,
  createProject,
  listProjects,
  mintToken,
  readToken,
  saveProfile,
  serverUrl,
} from "@/lib/api";

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

  // Two ways to be in the wrong place. Without a token the session went away
  // during a reload. With projects already on the account this is a second run
  // of a one-time wizard, and step 1 ends in saveProfile(), so letting it play
  // through would overwrite a written profile with whatever is typed here,
  // including nothing. An empty project list is what "first run" means.
  useEffect(() => {
    if (!readToken()) {
      router.replace("/");
      return;
    }
    // A server that cannot be reached must not lock the owner out of their own
    // onboarding, so only a definite answer redirects.
    void listProjects()
      .then((rows) => rows.length && router.replace("/home"))
      .catch(() => {});
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

      router.push("/home");
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

  const canGoBack = step > 1 || profileIndex > 0;

  // The right column: what has been entered so far. It is here because two thirds
  // of this screen was empty and the question "why am I typing this" had no
  // answer on it.
  const preview: { title: string; note?: string; entries: Entry[]; empty: string } =
    step === 1
      ? {
          title: t("profile.previewTitle"),
          note: t("profile.note"),
          empty: t("profile.previewEmpty"),
          entries: PROFILE_QUESTIONS.map((key) => ({
            label: t(`profile.${key}.label`),
            value: answers[key],
          })),
        }
      : {
          title: t("project.previewTitle"),
          empty: t("project.previewEmpty"),
          entries: [
            { label: t("project.label.name"), value: card.name },
            { label: t("project.label.repo"), value: card.repoRef },
            { label: t("project.label.stack"), value: card.stack },
            { label: t("project.label.etap"), value: t(`project.etap.${card.etap}`) },
            { label: t("project.label.limits"), value: card.ograniczenia },
          ],
        };

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      {failure ? <Banner variant="error" what={failure} /> : null}

      <ThreadProgress step={step} />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-x-16 px-8 pt-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
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

            {/* Set off by a rule and a wider gap above: the actions are a
                different kind of thing from the question, and uniform spacing was
                making the whole screen read as one undifferentiated column. */}
            <div className="mt-9 flex items-center gap-6 border-t border-hairline pb-8 pt-6">
              <Button onClick={() => void advance()} disabled={busy}>
                {step === 3 ? t("finish") : t("next")}
              </Button>
              {canGoBack ? (
                <Button variant="quiet" onClick={back} disabled={busy}>
                  {t("back")}
                </Button>
              ) : null}
              {step < 3 ? (
                <Button variant="quiet" className="ml-auto" onClick={() => router.push("/home")} disabled={busy}>
                  {t("skip")}
                </Button>
              ) : null}
            </div>

            {/* Somebody invited into a team has no project of their own, and
                this wizard is what a fresh account sees first. Without a way
                out of it the invitation ends here, on a form asking them to
                start a project they were never going to start. */}
            {step === 2 ? (
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="pb-8 text-small text-thread underline underline-offset-2"
              >
                {t("project.joinInstead")}
              </button>
            ) : null}
          </div>

          {/* Hidden below the two-column breakpoint rather than stacked: on a
              narrow window the record would push the actions off the fold. */}
          <div className="hidden lg:block">
            <RecordPreview
              title={preview.title}
              note={preview.note}
              entries={preview.entries}
              emptyNote={preview.empty}
            />
          </div>
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
