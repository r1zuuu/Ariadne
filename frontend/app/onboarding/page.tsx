"use client";

// Screen 02 lands here next. Until then this route exists so a successful login
// does not walk into a 404.
export default function OnboardingScreen() {
  return (
    <main className="px-8 pt-10">
      <h1 className="text-section">Onboarding</h1>
      <p className="max-w-[68ch] pt-5 text-body text-ink-2">
        Trzy kroki: profil, pierwszy projekt, podlaczenie agenta. Jeszcze nie zbudowane.
      </p>
    </main>
  );
}
