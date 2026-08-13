"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AgentStep,
  KeyStep,
  PROFILE_QUESTIONS,
  ProfileStep,
  ProjectStep,
  effectiveRepoRef,
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
  getAccount,
  listProjects,
  mintToken,
  readToken,
  saveGeminiKey,
  saveProfile,
  serverUrl,
  type GeminiKeySource,
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

// A refresh used to end the run. Half of this wizard has already touched the
// server by step 3 - the profile is saved, the key is stored, the project
// exists - so reloading dropped someone back at question one with no way to
// reach the state they had, and past step 3 the guard below then sent them
// straight to /home. The minted token is the part that does not survive that: it
// is shown once and only its hash is kept.
//
// Everything the run holds therefore goes to localStorage on every change and is
// cleared when the wizard ends. Same store as the session token, which the app
// already keeps there, so this adds no new place for anything to sit.
const WIZARD_KEY = "ariadne.onboarding";

type Wizard = {
  step: 1 | 2 | 3 | 4;
  profileIndex: number;
  answers: Answers;
  profile: string;
  card: Card;
  agent: Agent;
  token: string | null;
};

function readWizard(): Wizard | null {
  try {
    const raw = localStorage.getItem(WIZARD_KEY);
    return raw ? (JSON.parse(raw) as Wizard) : null;
  } catch {
    // A half-written or hand-edited record must not be the reason the screen
    // will not open. Starting over is worse than resuming and better than a
    // blank page.
    return null;
  }
}

export default function OnboardingScreen() {
  const t = useTranslations("onboarding");
  const tAuth = useTranslations("auth");
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [profileIndex, setProfileIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [profile, setProfile] = useState("");
  const [card, setCard] = useState<Card>(EMPTY_CARD);
  const [geminiKey, setGeminiKey] = useState("");
  // Whether the account already carries a working key, in which case step 2
  // takes an empty field. There is no server-wide key to fall back on.
  const [keySource, setKeySource] = useState<GeminiKeySource>("none");
  const [agent, setAgent] = useState<Agent>("claude-code");
  const [token, setToken] = useState<string | null>(null);
  const [tokenFailed, setTokenFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Read after mount rather than in a state initializer: this page is
  // prerendered by Node, where localStorage does not exist, and reading during
  // render would hand the client different markup than the server built.
  // Nothing is written back until this turns true, or the first render would
  // save its own empty defaults over the record it is about to load.
  const [restored, setRestored] = useState(false);

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

    const saved = readWizard();
    if (saved) {
      setStep(saved.step);
      setProfileIndex(saved.profileIndex);
      setAnswers(saved.answers);
      setProfile(saved.profile);
      setCard(saved.card);
      setAgent(saved.agent);
      setToken(saved.token);
    }
    setRestored(true);

    // A server that cannot be reached must not lock the owner out of their own
    // onboarding, so only a definite answer redirects. A run already in progress
    // is not a second run: by step 4 the project exists, and that is exactly the
    // state this used to read as "already onboarded" while the person was still
    // looking at a token they had not copied yet.
    if (!saved) {
      void listProjects()
        .then((rows) => rows.length && router.replace("/home"))
        .catch(() => {});
    }
    void getAccount()
      .then((account) => setKeySource(account.geminiKey))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!restored) return;
    const record: Wizard = { step, profileIndex, answers, profile, card, agent, token };
    try {
      localStorage.setItem(WIZARD_KEY, JSON.stringify(record));
    } catch {
      // A full or blocked store costs the resume and nothing else; the wizard
      // itself keeps working exactly as it did before any of this.
    }
  }, [restored, step, profileIndex, answers, profile, card, agent, token]);

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
        const typed = geminiKey.trim();
        // Empty is only allowed when the account already has a working key, which
        // is what this same field saved on an earlier run. Otherwise the way on
        // is closed: the wall exists either way, and here it comes with the
        // sentence that explains it and the link that fixes it.
        if (!typed && keySource !== "user") {
          setFieldError(t("key.requiredError"));
          return;
        }
        // A wrong key stops here too, because the one moment this is fixable
        // cheaply is while it is still on screen. saveGeminiKey proves it works
        // with a one-word embedding before it stores anything.
        if (typed) {
          await saveGeminiKey(typed);
          setKeySource("user");
          setGeminiKey("");
        }
        setStep(3);
        return;
      }

      if (step === 3) {
        if (!card.name.trim()) {
          setFieldError(t("project.error.name"));
          return;
        }
        await createProject({
          name: card.name.trim(),
          // The backend requires a repo_ref and a project without a repository is
          // a real case, so the name stands in until there is one. Same helper the
          // step used to show this value, so the screen cannot promise one string
          // and the archive hold another.
          repoRef: effectiveRepoRef(card),
          stack: card.stack.trim(),
          etap: card.etap,
          ograniczenia: card.ograniczenia.trim(),
        });
        await mint();
        setStep(4);
        return;
      }

      // The run is over, so the record goes. Leaving it would mean the next
      // visit to this page resumes a finished wizard and offers a token that was
      // already handed over.
      localStorage.removeItem(WIZARD_KEY);
      router.push("/home");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "validation" && step === 2) {
        setFieldError(caught.message);
      } else if (caught instanceof ApiError && caught.code === "validation" && step === 3) {
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
    if (step > 1) return setStep((step - 1) as 1 | 2 | 3);
  };

  const canGoBack = step > 1 || profileIndex > 0;

  // The right column: what has been entered so far. It is here because two thirds
  // of this screen was empty and the question "why am I typing this" had no
  // answer on it.
  // The key step has no record of its own to show, so it keeps the profile on
  // screen: what was just written is better company than an empty project card.
  const preview: { title: string; note?: string; entries: Entry[]; empty: string } =
    step <= 2
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
              <KeyStep
                value={geminiKey}
                source={keySource}
                error={fieldError}
                onChange={setGeminiKey}
              />
            ) : step === 3 ? (
              <ProjectStep
                card={card}
                error={fieldError}
                heading={t("project.title")}
                onChange={(patch) => setCard({ ...card, ...patch })}
              />
            ) : (
              <AgentStep
                agent={agent}
                token={token}
                failed={tokenFailed}
                repoRef={effectiveRepoRef(card)}
                onAgent={setAgent}
                onRegenerate={() => void mint()}
              />
            )}

            {/* Set off by a rule and a wider gap above: the actions are a
                different kind of thing from the question, and uniform spacing was
                making the whole screen read as one undifferentiated column. */}
            <div className="mt-9 flex items-center gap-6 border-t border-hairline pb-8 pt-6">
              <Button onClick={() => void advance()} disabled={busy}>
                {step === 4 ? t("finish") : t("next")}
              </Button>
              {canGoBack ? (
                <Button variant="quiet" onClick={back} disabled={busy}>
                  {t("back")}
                </Button>
              ) : null}
              {/* No way out of the wizard any more. It used to drop straight to
                  /home, which since the key became mandatory would land someone
                  on a screen where every action refuses, with the explanation
                  two steps behind them. The invite link under step 3 is still
                  there for the one person this wizard is genuinely not for. */}
            </div>

            {/* Somebody invited into a team has no project of their own, and
                this wizard is what a fresh account sees first. Without a way
                out of it the invitation ends here, on a form asking them to
                start a project they were never going to start. */}
            {step === 3 ? (
              <button
                type="button"
                // Walking out counts as ending the run. A record left behind
                // here would resume a wizard nobody meant to return to, and
                // would keep suppressing the "already onboarded" redirect for
                // good.
                onClick={() => {
                  localStorage.removeItem(WIZARD_KEY);
                  router.push("/settings");
                }}
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
