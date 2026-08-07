# ARIADNE — UI / UX / Product Design Plan

## Rola

Jesteś **senior product designerem, UX researcherem oraz senior frontend developerem** specjalizującym się w aplikacjach SaaS, AI tools, developer tools i knowledge-management products.

Pracujemy nad **drugą iteracją redesignu UX/UI aplikacji ARIADNE**.

Obecna wersja po pierwszym redesignie jest już funkcjonalnie znacznie lepsza i jej podstawowa struktura może zostać zachowana. Nie chcę kolejnego redesignu „od zera” dla samego efektu wizualnego.

Teraz naszym zadaniem jest:

1. uczynić produkt zrozumiałym również dla mniej technicznych użytkowników,
2. dodać first-run onboarding i product education,
3. dodać trwałą historię interakcji,
4. poprawić mental model produktu,
5. usunąć generyczne wzorce typu „AI-generated SaaS UI”,
6. stworzyć bardziej charakterystyczny visual language dla Ariadne,
7. oprzeć decyzje projektowe na **realnym researchu z internetu**, a nie wyłącznie na domyślnych wzorcach UI,
8. stworzyć spójny **motion system** i potraktować animację jako część języka produktu,
9. zachować aktualną logikę biznesową wszędzie tam, gdzie jest to możliwe.

---

# 1. CZYM JEST ARIADNE

Ariadne jest aplikacją służącą do przechowywania, porządkowania i odzyskiwania kontekstu projektów podczas pracy z LLM-ami.

Jej rolą jest m.in.:

- zapamiętywanie decyzji projektowych,
- zapamiętywanie ustaleń,
- przechowywanie ograniczeń projektu,
- zapisywanie zmian i ważnych informacji,
- umożliwienie późniejszego pytania AI o historię i kontekst projektu,
- przygotowywanie nowych informacji do zatwierdzenia przed dodaniem ich do pamięci projektu.

Najprostszy model produktu:

**USER TELLS**  
→ użytkownik przekazuje decyzję, zmianę lub ustalenie.

**ARIADNE STRUCTURES**  
→ Ariadne porządkuje i przygotowuje informację.

**USER REVIEWS**  
→ użytkownik zatwierdza lub odrzuca.

**ARIADNE REMEMBERS**  
→ informacja trafia do pamięci projektu.

**USER ASKS**  
→ później użytkownik może pytać Ariadne o tę wiedzę.

Ten model musi być **czytelny w samym interfejsie**, również dla osoby nietechnicznej.

Metaforą marki jest mitologiczna Ariadna i nić prowadząca przez labirynt:

**chaos → nić → kontekst → uporządkowana wiedza → właściwa odpowiedź.**

Nie chcę jednak dosłownego „greckiego interfejsu”, kolumn, ornamentów ani historyzującej estetyki.

Ariadne ma wyglądać jak współczesne, bardzo dobre narzędzie AI/developer tool, ale z własnym charakterem.

---

# 2. WAŻNE: NAJPIERW RESEARCH, POTEM DESIGN

Nie chcę, żebyś projektował nowy kierunek wizualny wyłącznie na podstawie swojej domyślnej wiedzy o UI ani na podstawie typowych komponentów generowanych przez AI.

Nie chcę kolejnego:

- generic SaaS,
- shadcn clone,
- Linear clone,
- rounded card dashboard,
- „AI blue glow” interface,
- zestawu identycznych pill badges.

Zanim zmienisz jakikolwiek komponent, CSS lub layout, przeprowadź **realny research z internetu**.

Jeśli masz dostęp do web search / internetu, użyj go.

Nie opieraj researchu na przypadkowych blogach SEO typu:

- „20 UI trends for 2026”
- „10 best SaaS design ideas”
- „AI UI inspiration”

Preferuj źródła, które pokazują:

- nagradzane projekty,
- prawdziwe produkty,
- pełne user flows,
- analizy UX,
- systemy projektowe firm produktowych,
- realne onboarding flows,
- realne AI interfaces,
- wysokiej jakości developer tools.

---

# 3. RESEARCH — CZTERY WARSTWY

## A. ART DIRECTION / VISUAL CHARACTER

Przeanalizuj aktualne i wysokiej jakości przykłady z:

- Awwwards,
- SiteInspire,
- Godly,
- podobnych uznanych curated galleries.

Szczególnie interesują nas kategorie:

- Technology,
- AI,
- developer tools,
- digital products,
- editorial interfaces,
- knowledge systems,
- archives,
- research platforms,
- productivity tools.

Nie kopiuj landing page’y do aplikacji.

Awwwards / SiteInspire / Godly mają służyć do znalezienia:

- bardziej charakterystycznej typografii,
- kompozycji,
- rytmu,
- hierarchy,
- sposobu użycia whitespace,
- asymetrii,
- cienkich linii,
- editorial layouts,
- subtelnych motywów graficznych,
- sposobów budowania brand character.

Sprawdź kilka różnych kierunków, nie jeden przykład.

---

## B. PRODUCT UI / REAL APPLICATION PATTERNS

Przeanalizuj prawdziwe patterns z:

- Mobbin,
- Page Flows,
- SaaSFrame.

Szukaj szczególnie:

- AI assistant interfaces,
- chat history,
- knowledge bases,
- note-taking tools,
- project management,
- productivity,
- developer tools,
- onboarding,
- dashboards,
- approval/review flows,
- source references,
- first-run experience.

Interesuje nas nie marketing, tylko realne działanie aplikacji.

Przeanalizuj m.in.:

- jak użytkownik rozpoczyna pracę,
- jak produkt tłumaczy swoją wartość,
- jak wygląda first-run,
- gdzie przechowywana jest historia,
- jak nawigacja zachowuje kontekst,
- jak odróżniane są read / write / review actions,
- jak aplikacja komunikuje rezultat działania,
- jak wygląda guidance bez przeciążania użytkownika.

---

## C. UX RESEARCH

Zweryfikuj decyzje przy pomocy źródeł takich jak:

- Built for Mars,
- Nielsen Norman Group.

Nie implementuj onboardingu tylko dlatego, że „onboarding jest dobry”.

Sprawdź:

- kiedy product tour pomaga,
- kiedy przeszkadza,
- progressive disclosure,
- show, don’t tell,
- learn-by-doing,
- mental models,
- information hierarchy,
- cognitive load,
- contextual help,
- first-run experience,
- recognition vs recall,
- guidance w produktach o nietypowym modelu działania.

Nasza hipoteza:

Ariadne jest produktem o niestandardowym modelu działania, dlatego nowy użytkownik powinien szybko zrozumieć:

1. co Ariadne zapamiętuje,
2. jak później można tę pamięć wykorzystać,
3. czym różni się pytanie od dodawania wiedzy,
4. dlaczego istnieje zatwierdzanie,
5. dlaczego nic nie trafia do pamięci projektu automatycznie.

Zweryfikuj tę hipotezę w researchu.

---

## D. CRAFT / MICROINTERACTIONS / MOTION

Przejrzyj:

- Design Spells,
- Raycast,
- Vercel / Geist,
- Linear,
- Arc,
- Notion,
- Claude,
- ChatGPT,
- inne wysokiej jakości developer tools i AI tools znalezione podczas researchu.

Interesują nas:

- microinteractions,
- transition states,
- focus,
- command/search interactions,
- empty states,
- feedback,
- keyboard behavior,
- loading,
- selection,
- source expansion,
- chat transitions,
- history switching,
- context panels,
- approval actions,
- graph / knowledge-map interactions.

Nie dodawaj animacji tylko dlatego, że są efektowne.

Dla każdej animacji odpowiedz:

**WHAT DOES THIS MOTION COMMUNICATE?**

Jeśli odpowiedź brzmi tylko:

**„looks cool”**

nie implementuj jej.

---

# 4. WYNIK RESEARCHU — ZANIM ZACZNIESZ IMPLEMENTOWAĆ

Najpierw przedstaw krótkie podsumowanie researchu.

Nie potrzebuję eseju.

## A. 5–10 konkretnych produktów / realizacji

Dla każdego:

- źródło,
- konkretny pattern / decyzja,
- co warto z niego zaczerpnąć,
- czego NIE kopiować.

## B. 5–8 design principles

Nie pisz ogólników typu:

- use whitespace,
- keep it simple,
- make it modern.

Każdy principle ma prowadzić do konkretnej decyzji w Ariadne.

Przykład:

**PRINCIPLE 01 — Conversation is the primary product action**

Evidence:  
[konkretny produkt / źródło]

Application to Ariadne:  
[konkretna decyzja]

## C. 2–3 możliwe visual directions

Dla każdego opisz:

- typography,
- composition,
- density,
- surfaces,
- lines / borders,
- navigation,
- metadata,
- imagery,
- motion,
- sposób wykorzystania motywu Ariadny.

Następnie wybierz najsilniejszy kierunek i krótko uzasadnij go researchowo.

Nie implementuj na ślepo pierwszego pomysłu.

---

# 5. OBECNY STAN UI — CZEGO NIE CHCEMY STRACIĆ

Obecna wersja aplikacji po pierwszym redesignie jest zasadniczo funkcjonalna.

Mamy m.in.:

- sidebar,
- project switcher,
- Przegląd,
- Projekt,
- Zapytaj,
- Dodaj kontekst,
- Do zatwierdzenia,
- dashboard z composerem,
- czytelniejszy widok projektu,
- cards dla wpisów,
- ekran logowania z obrazem dłoni i nici,
- lepsze CTA,
- badge z liczbą oczekujących wpisów.

Nie chcę kolejnego totalnego resetu.

Zachowaj to, co działa.

Druga iteracja ma skupić się na:

- zrozumiałości produktu,
- charakterze,
- historii,
- onboardingu,
- motion,
- usunięciu generycznych patterns,
- refinement.

---

# 6. GŁÓWNY PROBLEM OBECNEJ WERSJI

Obecny UI jest już „OK”, ale nadal może wyglądać jak dobry, generyczny SaaS.

Dla osoby nietechnicznej nadal nie jest od razu jasne:

- czym dokładnie jest Ariadne,
- po co istnieje,
- co użytkownik powinien wpisać,
- czym różni się „Zapytaj” od „Dodaj kontekst”,
- co trafia do pamięci projektu,
- dlaczego istnieje ekran „Do zatwierdzenia”,
- skąd Ariadne bierze odpowiedzi,
- gdzie później znaleźć wcześniejsze rozmowy.

To trzeba rozwiązać nie tylko copywritingiem, ale też strukturą produktu.

---

# 7. ONBOARDING / PRODUCT EDUCATION

Dodaj first-run onboarding.

Nie chcę generycznego touru składającego się z 10–12 tooltipów:

- „to jest menu”,
- „to jest przycisk”,
- „tu kliknij”.

Najpierw pokaż **wartość i model produktu**.

Preferowany kierunek:

## KROK 1 — ARIADNE PAMIĘTA

Dodawaj decyzje, ustalenia i ważne informacje o projekcie.

## KROK 2 — ARIADNE ODPOWIADA

Później możesz zapytać, dlaczego coś zostało zrobione, co ustaliliście albo jakie ograniczenia ma projekt.

## KROK 3 — TY KONTROLUJESZ PAMIĘĆ

Nic ważnego nie trafia do pamięci projektu bez Twojej akceptacji.

To nie są obowiązkowe final copy.
Popraw je, jeśli research wskaże lepszą wersję.

Preferuj:

- guided onboarding,
- contextual onboarding,
- learn-by-doing,
- progressive disclosure.

Jeśli da się zrobić małą realną akcję zamiast samego czytania slajdów, wybierz realną akcję.

---

## ONBOARDING — CONTEXTUAL TOUR

Po pierwszym wyjaśnieniu można przejść przez najważniejsze miejsca:

### PRZEGLĄD

„Tutaj zobaczysz najważniejszy kontekst projektu i możesz od razu zapytać Ariadne.”

### PROJEKT

„Tutaj przechowywane są podstawowe informacje, technologie i zasady projektu.”

### ZAPYTAJ

„Rozmawiaj z pamięcią projektu.”

### DODAJ DO PAMIĘCI / DODAJ KONTEKST

„Powiedz Ariadne o decyzji, zmianie lub ustaleniu, które powinna zapamiętać.”

### DO ZATWIERDZENIA

„Tutaj kontrolujesz, co Ariadne faktycznie zapisze do pamięci projektu.”

Onboarding musi mieć:

- Pomiń,
- Wstecz,
- Dalej,
- progress,
- zakończenie,
- persistence ukończenia.

Nie pokazuj pełnego onboardingu przy każdym logowaniu.

Dodaj możliwość uruchomienia go ponownie, np.:

**Pomoc → Oprowadź mnie po Ariadne**

lub inną lokalizację zgodną z aktualnym IA.

---

# 8. DOKUMENTACJA / ISTNIEJĄCY PLIK .MD

W repozytorium istnieje plik MD używany jako dokumentacja produktu / decyzji / roadmapy.

Znajdź właściwy plik.

Dodaj do niego feature:

**FIRST-RUN ONBOARDING / PRODUCT EDUCATION**

Zapisz:

- problem,
- cel,
- flow,
- zasady działania,
- możliwość restartu,
- persistence ukończenia,
- acceptance criteria.

Nie twórz nowego przypadkowego MD, jeśli istniejący dokument już pełni tę funkcję.

---

# 9. HISTORIA — „ZAPYTAJ ARIADNE”

Obecnie rozmowy w „Zapytaj” nie mają trwałej, dostępnej historii.

To jest problem.

Jeżeli użytkownik:

- zamknie ekran,
- wróci później,
- rozpocznie nową rozmowę,

powinien móc wrócić do wcześniejszych rozmów.

Zaprojektuj trwałą **conversation history**.

Nie twórz automatycznie wielkiego ChatGPT-clone sidebaru, jeśli nie jest potrzebny.

Najpierw sprawdź najlepsze realne patterns.

Historia powinna pozwalać:

- rozpocząć nową rozmowę,
- zobaczyć ostatnie rozmowy,
- otworzyć poprzednią rozmowę,
- automatycznie wygenerować tytuł rozmowy z pierwszego pytania,
- zobaczyć datę / ostatnią aktywność,
- zachować projektowy kontekst rozmowy.

Przykład:

**Ostatnie rozmowy**

- Dlaczego wybraliśmy Next.js?
- Co ustaliliśmy w sprawie case studies?
- Jakie ograniczenia ma ten projekt?
- Co zmieniło się ostatnio?

Historia rozmów musi być trwała, nie tylko w stanie aktualnego komponentu.

Najpierw sprawdź obecną architekturę danych i wybierz najmniej inwazyjne rozwiązanie.

---

# 10. „DODAJ KONTEKST” / „DODAJ DO PAMIĘCI” — HISTORIA

Ta funkcja również nie może działać jak jednorazowy formularz, po którym interakcja znika.

Potrzebna jest osobna historia procesu dodawania wiedzy.

Nie nazywaj tego koniecznie „historią czatu”.

Lepszy model:

**Ostatnio dodany kontekst**

Każdy element powinien pokazywać:

- datę,
- treść przesłaną przez użytkownika,
- propozycję wygenerowaną przez Ariadne,
- status.

Statusy np.:

- OCZEKUJE NA ZATWIERDZENIE,
- ZAPISANO,
- ODRZUCONO / ARCHIWIZOWANO.

Kliknięcie powinno pozwalać zobaczyć pełny przebieg:

**Ty napisałeś:**  
[...]

**Ariadne zaproponowała:**  
[...]

**Status:**  
[...]

To ma zwiększać zaufanie i poczucie kontroli.

---

# 11. TERMINOLOGIA DLA NIETECHNICZNYCH UŻYTKOWNIKÓW

Przejrzyj nazewnictwo.

Szczególnie:

**Dodaj kontekst**

może być nadal zbyt abstrakcyjne.

Rozważ researchowo lepsze określenie, np.:

**Dodaj do pamięci**

albo inne, jeśli będzie bardziej naturalne.

Najważniejsze, żeby model był czytelny:

**pytasz → dodajesz / uczysz → zatwierdzasz → Ariadne pamięta.**

UI powinien tę logikę wzmacniać.

Nie używaj wewnętrznego języka systemu, jeśli użytkownik nie musi go znać.

---

# 12. „PRZEGLĄD” / HOME — LEPSZE WYJAŚNIENIE PRODUKTU

Obecny composer na home jest dobrym kierunkiem.

Ale nowy użytkownik nadal może nie wiedzieć, skąd Ariadne zna odpowiedzi.

Dodaj subtelne wyjaśnienie typu:

**Czego chcesz się dowiedzieć?**

Ariadne odpowiada na podstawie zapisanych decyzji, ustaleń i informacji o tym projekcie.

Jeśli dane na to pozwalają, można pokazać:

**Ariadne korzysta z 4 decyzji, 2 ustaleń i informacji o projekcie.**

oraz link:

**Zobacz pamięć projektu →**

Nie przeciążaj jednak ekranu.

---

# 13. „ZAPYTAJ” — AI CONVERSATION EXPERIENCE

„Zapytaj” powinno być pełnoprawnym AI conversation interface.

Empty state:

**Zapytaj Ariadne o swój projekt**

Supporting copy:

**Ariadne odpowiada na podstawie zapisanych decyzji, ustaleń i kontekstu tego projektu.**

Duży composer.

Przykładowe pytania jako suggestions.

Po rozpoczęciu rozmowy:

- naturalna historia rozmowy,
- dobra szerokość tekstu,
- źródła,
- brak agresywnych chat bubbles, jeśli research wskaże lepszy wzorzec.

Bardzo ważne:

Ariadne odpowiada na podstawie zapisanych wpisów.

Pokaż:

**Na podstawie 4 wpisów**

Po rozwinięciu użytkownik powinien móc zobaczyć źródła:

- tytuł,
- typ,
- datę,
- fragment.

Nie pokazuj metadata jako ściany technicznych danych.

---

# 14. „DODAJ KONTEKST” / „DODAJ DO PAMIĘCI”

Ta część służy do wprowadzania nowej wiedzy.

UI musi jasno komunikować różnicę:

**Zapytaj**  
→ pytasz o istniejącą pamięć.

**Dodaj do pamięci**  
→ przekazujesz Ariadne nową informację.

Supporting copy może brzmieć:

**Powiedz Ariadne o decyzji, zmianie lub ustaleniu. Przygotujemy propozycję wpisu do zatwierdzenia — nic nie zostanie zapisane automatycznie.**

Composer powinien mieć konkretne przykłady:

- „Zmieniliśmy bibliotekę formularzy z X na Y.”
- „Nie używamy backendu — aplikacja pozostaje statyczna.”
- „Case studies odkładamy na później.”
- „Nowy projekt wymaga wpisów w pl.json i en.json.”

Po wysłaniu:

pokaż propozycję w czytelnym stanie pośrednim.

Użytkownik ma rozumieć:

- co Ariadne zrozumiała,
- co proponuje zapisać,
- jaki jest status,
- gdzie to później znajdzie.

---

# 15. „DO ZATWIERDZENIA”

Aktualna wersja jest znacznie lepsza niż pierwotna, ale nadal dopracuj ją researchowo.

Najważniejsza zasada:

**GRUPUJ ELEMENTY WEDŁUG PROJEKTU.**

Każdy wpis powinien być łatwy do zeskanowania.

Powinien pokazywać:

- typ,
- tytuł,
- skróconą treść,
- projekt,
- datę,
- źródło, jeśli ma znaczenie,
- status,
- primary action,
- secondary action.

Primary:

**Zatwierdź**

Secondary:

**Odrzuć / Archiwizuj**

zgodnie z faktyczną logiką.

Jeśli treść jest długa:

**Pokaż więcej**

Jeśli backend pozwala bezpiecznie:

**Zatwierdź wszystkie dla projektu**

ale nie dodawaj funkcji tylko wizualnie.

---

# 16. PILL UI — USUŃ „AI SLOP”

Obecnie w UI pojawiają się elementy typu:

- Decyzja,
- Proponowany,
- Produkcja,
- technologie,

jako pełne, mocno zaokrąglone pills.

To jest zbyt charakterystyczne dla generycznego współczesnego AI/SaaS UI.

Nie chcę `border-radius: 9999px` jako domyślnego rozwiązania.

Zasada:

**Avoid pill-shaped UI unless the shape has a real semantic reason.**

Preferuj:

- małe rectangular labels,
- flat metadata,
- uppercase metadata,
- subtle underline,
- inline separators,
- mały radius 2–4 px.

Przykład zamiast:

[ Decyzja ] [ Proponowany ]

można użyć:

**DECYZJA · PROPONOWANY**

lub małych rectangular labels.

Dla technologii nie zakładaj automatycznie chipsów.

Sprawdź researchowo, czy lepszy będzie np.:

**STACK**  
Next.js · React · TypeScript · Tailwind · next-intl

w Geist Mono.

---

# 17. LESS CARD-HEAVY UI

Nie wszystko musi być card.

Obecny UI nadal momentami opiera się na schemacie:

card  
card  
card  
card

To wzmacnia generyczny SaaS character.

Sprawdź researchowo, gdzie można użyć:

- sections,
- dividers,
- editorial layout,
- whitespace,
- typography,
- grid,
- metadata,

zamiast kolejnych białych prostokątów.

Card powinien istnieć wtedy, kiedy informacja naprawdę stanowi osobny obiekt / action unit.

Nie otaczaj prostokątem każdego fragmentu tekstu.

---

# 18. VISUAL LANGUAGE ARIADNE

Nie chcę dosłownego „Greek UI”.

Nie chcę:

- kolumn,
- ornamentów,
- antycznych ramek,
- złotych gradientów,
- literalnych labiryntów wszędzie.

Chcę subtelniejszego systemu:

**modern knowledge archive × editorial intelligence × developer tool**

To nie jest jeszcze finalna decyzja wizualna.

Zweryfikuj ją researchowo i zaproponuj 2–3 kierunki.

Motyw Ariadny powinien wynikać z funkcji produktu.

Najciekawszym motywem może być:

**THE THREAD**

czyli nić jako metafora:

- relacji,
- ciągłości,
- źródła,
- historii,
- decyzji,
- kontekstu.

Może pojawiać się np. w:

- timeline,
- activity,
- sources,
- knowledge graph,
- onboarding,
- history,
- approval flow.

Ale bardzo oszczędnie.

To ma być signature motif, nie dekoracja.

---

# 19. TIMELINE / THREAD MOTIF

Jeżeli research potwierdzi ten kierunek, wykorzystaj nić jako element systemu.

Np.:

● 12 lipca  
│  
│ Wybrano Next.js  
│  
● 18 lipca  
│  
│ Dodano next-intl  
│  
● 26 lipca  
  Case studies przełożone

Linia może reprezentować „nić” prowadzącą przez historię projektu.

To może być bardziej charakterystyczne dla Ariadne niż kolejny badge.

---

# 20. KNOWLEDGE GRAPH / GRAF WPISÓW

Obecny graph wygląda trochę jak developer demo.

Jeżeli graf jest ważnym feature’em, przebuduj go w kierunku pełnoprawnej:

**MAPY KONTEKSTU / KNOWLEDGE MAP**

Przeanalizuj:

- czy powinien zajmować więcej miejsca,
- czy powinien mieć własny dedicated view,
- czy panel szczegółów powinien pojawiać się obok,
- jak wizualizować relacje,
- jak wykorzystać motion i „thread”.

Jeśli graph nie jest kluczowym feature’em, nie pozwól mu dominować wizualnie.

Nie dodawaj efektownego graphu tylko dla dekoracji.

---

# 21. BRANDING

Nazwa:

**ARIADNE**

Kolor główny:

**#205C9C**

Typografia:

## Marcellus

Używaj bardzo oszczędnie:

- logo,
- pojedyncze duże brandowe nagłówki,
- onboarding,
- login,
- hero moments.

Nie używaj do dłuższego tekstu UI.

## Geist Sans

Podstawowy font interfejsu:

- navigation,
- forms,
- buttons,
- copy,
- AI responses,
- większość headings.

## Geist Mono

Dla:

- repository,
- paths,
- branch,
- dates,
- metadata,
- technical information,
- code-related content.

---

# 22. LOGIN SCREEN

Aktualny ekran logowania z obrazem dłoni i nici jest dobrym kierunkiem.

Zachowaj:

- split layout,
- ciemny art panel,
- jasny login panel,
- obraz z `/public`,
- kontrast obrazu i formularza.

Nie konwertuj obrazu na ASCII.

Nie dodawaj:

- cursor parallax,
- ciągłego zoomu,
- floating image,
- mocnego gradientu,
- glow.

Formularz ma być prosty i elegancki.

Status serwera nie powinien konkurować z formularzem.

---

# 23. MOTION / ANIMATION SYSTEM

Motion jest ważną częścią tego redesignu.

Nie traktuj animacji jako dekoracji dodawanej na końcu.

Motion ma pomagać użytkownikowi rozumieć:

- skąd coś przyszło,
- gdzie coś zostało zapisane,
- co jest aktywne,
- co właśnie się zmieniło,
- jaki jest związek pomiędzy informacjami,
- jak użytkownik przechodzi przez kontekst projektu.

---

# 24. BIBLIOTEKA DO ANIMACJI

Projekt działa w:

- Next.js,
- React,
- TypeScript.

Najpierw sprawdź `package.json`.

Preferowana główna biblioteka:

**Motion for React**  
https://motion.dev/

czyli aktualna biblioteka rozwijana jako następca Framer Motion.

Sprawdź aktualną oficjalną dokumentację przed implementacją.

Preferowana składnia powinna być zgodna z aktualnymi rekomendacjami, np.:

```ts
import { motion } from "motion/react"
```

lub odpowiednia wersja dla:

- Next.js App Router,
- Server Components,
- Client Components.

Jeżeli projekt już używa:

`framer-motion`

nie instaluj bezmyślnie drugiej biblioteki.

Sprawdź aktualną ścieżkę migracji i zdecyduj:

- zachować istniejący package,
- albo przejść na `motion`.

Nie utrzymuj równolegle dwóch bibliotek robiących to samo.

Sprawdź również aktualne możliwości ograniczenia bundle size:

- `motion/react-client`,
- `LazyMotion`,
- `m`.

Zastosuj je tam, gdzie ma to sens.

Nie dodawaj GSAP jako drugiej głównej biblioteki.

GSAP może być użyty tylko wtedy, jeśli istnieje konkretna interakcja, której nie da się sensownie wykonać Motion.

W takim przypadku najpierw uzasadnij potrzebę.

---

# 25. MOTION PRINCIPLE — THE THREAD

Motywem Ariadne jest nić prowadząca przez labirynt.

Ta idea może zostać subtelnie wykorzystana również w motion language.

Nie oznacza to animowania złotej linii wszędzie.

Idea:

**information appears  
→ Ariadne connects it  
→ user follows the connection  
→ information becomes memory**

Możemy wykorzystywać:

- thin line,
- SVG path,
- progressing stroke,
- connecting line,
- active indicator,
- timeline,
- node connection.

Jeżeli korzystasz z SVG:

rozważ animowanie `pathLength`.

Najbardziej naturalne miejsca:

- onboarding,
- history,
- sources,
- knowledge graph,
- approval flow,
- activity timeline.

Motyw ma być signature interaction, nie gimmick.

---

# 26. GLOBAL MOTION TOKENS

Zaprojektuj spójny motion system.

Nie twórz przypadkowych wartości duration / easing w każdym komponencie.

Punkt startowy:

## MICRO

**120–180 ms**

Dla:

- hover,
- focus,
- button feedback,
- small state changes.

## STANDARD

**180–280 ms**

Dla:

- cards,
- accordions,
- navigation,
- panels,
- messages,
- source expansion.

## EMPHASIS

**300–450 ms**

Dla:

- onboarding,
- larger state transitions,
- meaningful relationship transitions.

Nie traktuj tych wartości jako obowiązkowych.

Zweryfikuj je podczas researchu.

Avoid:

- slow 700–1000 ms UI transitions,
- bounce everywhere,
- overshoot everywhere,
- excessive springiness,
- giant slide transitions,
- decorative parallax,
- floating UI,
- pulsing gradients,
- AI glow.

Ariadne ma być:

- calm,
- precise,
- intelligent,
- deliberate.

---

# 27. PAGE / NAVIGATION TRANSITIONS

Przejście pomiędzy:

- Przegląd,
- Projekt,
- Zapytaj,
- Dodaj do pamięci,
- Do zatwierdzenia,

nie powinno wyglądać jak pełny reload.

Preferowany charakter:

```txt
opacity: 0 → 1
translateY: 4–8px → 0
duration: ~180–260ms
```

Nie rób:

- dużego slide left/right,
- zoom całej strony,
- 3D,
- blur całej aplikacji.

Sidebar powinien pozostać stabilny.

Jeśli active navigation indicator zmienia pozycję:

rozważ shared layout animation / `layoutId`.

To może być subtelne nawiązanie do „nici”.

---

# 28. ONBOARDING MOTION

Onboarding powinien szczególnie wykorzystywać motion.

Nie chcę:

screen → fade → screen → fade.

Zaprojektuj go jako jedną historię.

Można wykorzystać subtelną linię / nić, która przeprowadza użytkownika przez model:

**YOU TELL**  
↓  
**ARIADNE STRUCTURES**  
↓  
**YOU REVIEW**  
↓  
**ARIADNE REMEMBERS**  
↓  
**YOU ASK**

Linia może być SVG path i rysować się wraz z kolejnymi etapami.

Użytkownik powinien mieć wrażenie:

**„I’m following the thread.”**

Nie rób jednak dosłownej kreskówki.

Podczas contextual tour:

- reszta UI może delikatnie się wyciszyć,
- target zostaje subtelnie podkreślony,
- panel pojawia się przez opacity + minimal movement,
- przejście pomiędzy targetami powinno być płynne.

Unikaj agresywnego spotlight tour typowego dla starych aplikacji enterprise.

---

# 29. LOGIN MOTION

Na login screen znajduje się art panel z obrazem dłoni i nici.

Obraz pozostaje przede wszystkim dziełem wizualnym.

Nie rób:

- cursor parallax,
- continuous zoom,
- animated gradient,
- floating image.

Przy pierwszym wejściu można zastosować subtelny reveal:

```txt
scale: 1.015 → 1
opacity: 0 → 1
duration: ~600–900ms
```

Formularz może wejść trochę szybciej.

Nie próbuj sztucznie animować złotej nici znajdującej się wewnątrz rasterowego obrazu.

---

# 30. CHAT MOTION — „ZAPYTAJ”

Rozmowa powinna mieć szczególnie dopracowany motion.

## USER MESSAGE

Po wysłaniu:

- szybkie przejście input → message,
- opacity,
- minimal Y,
- bez bubble bounce.

## ARIADNE RESPONSE

Podczas generowania:

nie używaj generycznych:

- trzech skaczących kropek,
- pulsującego AI gradientu.

Znajdź bardziej charakterystyczny loading state podczas researchu.

Może subtelnie odnosić się do:

- searching memory,
- following sources,
- connecting context.

Jeśli backend pozwala na streaming:

tekst powinien pojawiać się naturalnie.

Nie animuj każdego tokena osobnym efektem.

Layout powinien płynnie dopasowywać wysokość podczas pojawiania się odpowiedzi.

---

# 31. SOURCES MOTION

Element:

**Na podstawie 4 wpisów**

po rozwinięciu:

- smooth height / layout animation,
- opacity,
- ewentualnie bardzo mały stagger.

Źródła powinny wyglądać jak rozwinięcie odpowiedzi, nie osobny modal.

Motion ma pokazywać:

**odpowiedź → źródła → pamięć projektu**

---

# 32. CHAT HISTORY MOTION

Transition między rozmowami powinien być spokojny.

Nie animuj całego interfejsu.

Zachowaj:

- sidebar,
- history navigation,
- composer.

Zmieniaj głównie conversation content.

Preferuj:

- crossfade,
- minimal Y,
- layout animation.

Nie rób carousel sliding.

---

# 33. „DODAJ DO PAMIĘCI” — MOTION

To flow ma być szczególnie czytelne.

Po wysłaniu informacji:

1. user input zostaje wysłany,
2. pojawia się stan „Ariadne przygotowuje propozycję”,
3. pojawia się proposal,
4. proposal trafia do approval state.

Motion ma pokazywać ciągłość procesu.

Można użyć:

- subtle line / connector,
- progressive reveal,
- layout animation.

Nie rób efektu „magic AI”.

To ma wyglądać jak inteligentne porządkowanie informacji.

---

# 34. APPROVAL MOTION

Po kliknięciu:

**Zatwierdź**

element nie powinien po prostu zniknąć bez feedbacku.

Preferowany flow:

1. button state → processing,
2. success confirmation,
3. card subtelnie przechodzi do completed state,
4. dopiero potem znika lub przenosi się z listy.

Analogicznie dla:

- archiwizuj,
- odrzuć.

Użytkownik musi wiedzieć, że akcja się udała.

---

# 35. KNOWLEDGE GRAPH MOTION

Jeżeli graph pozostaje:

- nodes mogą mieć subtle hover / focus,
- edge może się podświetlać przy selection,
- panel szczegółów może otwierać się przez layout transition,
- nie animuj całego graphu bez powodu.

Jeśli używasz motywu nici:

selected relation może zostać pokazana jako subtelnie aktywowana ścieżka.

Nie twórz neonowego network graph.

---

# 36. HOVER / FOCUS / BUTTON STATES

Każdy interactive element powinien mieć:

- default,
- hover,
- focus-visible,
- active,
- disabled,
- loading.

Motion ma być bardzo szybki.

Nie używaj scale-up na każdym buttonie.

Preferuj:

- subtle background,
- border shift,
- icon movement 1–2px,
- opacity,
- underline,
- active indicator.

---

# 37. REDUCED MOTION

Accessibility jest obowiązkowe.

Obsłuż:

**prefers-reduced-motion**

Jeśli używasz Motion:

wykorzystaj aktualny oficjalny mechanizm, np. `useReducedMotion`, jeśli jest rekomendowany.

W reduced motion:

- usuń nonessential movement,
- pozostaw feedback poprzez opacity / immediate state,
- nie utrudniaj zrozumienia procesu.

---

# 38. PERFORMANCE

Motion nie może pogorszyć odczuwalnej wydajności aplikacji.

Preferuj:

- transform,
- opacity,
- layout animation tylko tam, gdzie ma sens.

Unikaj kosztownych ciągłych animacji.

Sprawdź:

- bundle size,
- hydration,
- client boundaries,
- unnecessary re-renders.

Nie konwertuj dużych fragmentów Server Components na Client Components tylko po to, żeby animować drobny element.

---

# 39. MICROCOPY

Przejrzyj wszystkie komunikaty.

Usuń język:

- techniczny,
- abstrakcyjny,
- systemowy.

Copy powinno mówić:

- co można zrobić,
- co się stanie,
- jaki będzie rezultat.

Każdy ekran powinien odpowiadać:

1. Gdzie jestem?
2. Co tutaj mogę zrobić?
3. Co się stanie po wykonaniu akcji?

---

# 40. FEEDBACK PO AKCJACH

Każda ważna akcja musi mieć czytelny feedback.

Np.:

Po dodaniu informacji:

**Propozycja została utworzona i czeka na zatwierdzenie.**

Po zatwierdzeniu:

**Wpis dodano do pamięci projektu.**

Po odrzuceniu:

**Propozycja została odrzucona.**

Po zapisaniu projektu:

**Zmiany w projekcie zostały zapisane.**

Nie zostawiaj użytkownika z pytaniem:

„Czy to zadziałało?”

---

# 41. EMPTY STATES

Nie używaj wyłącznie:

- brak wpisów,
- nic nie czeka.

Powiedz użytkownikowi:

- co to znaczy,
- co może zrobić dalej.

Np.:

**Nie masz jeszcze zapisanych decyzji.**

**Dodaj pierwsze ustalenie do pamięci projektu.**

---

# 42. COMPONENT SYSTEM

Nie twórz przypadkowych styli ekran po ekranie.

Uporządkuj reusable components, np.:

- Button,
- IconButton,
- Input,
- Textarea,
- AIComposer,
- Card,
- MetadataLabel,
- Status,
- ProjectSwitcher,
- NavigationItem,
- EmptyState,
- PageHeader,
- SectionHeader,
- ActivityItem,
- DecisionItem,
- ApprovalItem,
- SourceReference,
- TechnologyLabel,
- Timeline,
- ConversationHistory,
- ContextHistory,
- OnboardingStep,
- Toast / feedback state.

Zdefiniuj spójnie:

- radius,
- border,
- spacing,
- typography,
- container width,
- button height,
- input height,
- motion tokens.

---

# 43. RADIUS SYSTEM

Nie używaj automatycznie bardzo wysokiego border radius.

Preferowany punkt startowy:

- card: 6–8 px,
- input: 5–6 px,
- button: 4–6 px,
- metadata label: 2–4 px.

Nie stosuj `9999px` jako domyślnego radius.

Jeśli research wskaże lepszy system, dostosuj go.

---

# 44. RESPONSIVENESS

Desktop jest głównym środowiskiem pracy.

Ale layout musi poprawnie działać na mniejszych szerokościach.

Nie pozwalaj na:

- overflow stacku,
- bardzo szerokie paragrafy,
- rozpadające się formularze,
- ucinanie CTA.

Sidebar może przechodzić w drawer / collapsible navigation.

Historia rozmów również musi mieć sensowny mobile / narrow-screen behavior.

---

# 45. ACCESSIBILITY

Zadbaj o:

- semantic HTML,
- hierarchy headings,
- labels,
- keyboard navigation,
- focus-visible,
- contrast ratios,
- clickable areas,
- disabled states,
- loading states,
- reduced motion,
- aria tam, gdzie jest potrzebna.

---

# 46. WAŻNE OGRANICZENIA TECHNICZNE

Najpierw przeanalizuj kod.

Sprawdź:

- routing,
- components,
- data flow,
- models,
- API,
- project state,
- approvals,
- assistant flow,
- context flow,
- auth,
- persistence,
- package.json.

Nie zmieniaj logiki biznesowej bez potrzeby.

Nie usuwaj istniejących funkcjonalności.

Nie przebudowuj backendu tylko dla visual effect.

Nie zmieniaj modeli danych, jeśli nie jest to potrzebne.

Jeśli historia rozmów / onboarding wymaga persistence:

najpierw sprawdź obecną architekturę i wybierz najmniej inwazyjne rozwiązanie.

Jeżeli konkretna poprawa UX wymaga zmiany danych:

- wskaż to,
- uzasadnij,
- wybierz najmniejszą sensowną zmianę.

---

# 47. SPOSÓB PRACY

Nie zaczynaj od losowego przepisywania CSS.

## ETAP 1 — RESEARCH

Wykonaj internetowy research zgodnie z tym dokumentem.

## ETAP 2 — AUDYT KODU

Sprawdź repozytorium i obecną implementację.

## ETAP 3 — SYNTEZA

Przedstaw:

- 5–10 najlepszych references,
- principles,
- 2–3 visual directions,
- motion direction,
- rekomendowaną bibliotekę / aktualną konfigurację Motion.

## ETAP 4 — PLAN

Przedstaw krótki plan zmian.

Uwzględnij:

- onboarding,
- history,
- visual language,
- navigation,
- home,
- assistant,
- add-to-memory,
- approvals,
- graph,
- motion system,
- technical impact.

Nie potrzebuję wielkiego dokumentu — konkrety.

## ETAP 5 — AKTUALIZACJA ISTNIEJĄCEGO MD

Znajdź właściwy plik dokumentacji / roadmapy i dodaj:

- onboarding,
- conversation history,
- add-to-memory history,
- visual redesign principles,
- motion system,
- acceptance criteria.

## ETAP 6 — IMPLEMENTACJA

Następnie wykonaj zmiany.

Nie zatrzymuj się na samym researchu i planie.

## ETAP 7 — WERYFIKACJA

Po implementacji:

- uruchom build,
- napraw błędy,
- sprawdź flow,
- sprawdź persistence,
- sprawdź responsiveness,
- sprawdź loading / empty / success / error states,
- sprawdź keyboard,
- sprawdź reduced motion,
- upewnij się, że nic nie zostało usunięte bez potrzeby.

---

# 48. FINALNY CEL PRODUKTOWY

Ariadne ma sprawiać wrażenie:

**„Ariadne prowadzi mnie przez kontekst projektu.”**

Nie:

**„Patrzę na panel administracyjny bazy danych.”**

Nie:

**„Patrzę na kolejny generyczny AI SaaS.”**

Najważniejsze cechy końcowego produktu:

## CLARITY

Użytkownik zawsze wie, co widzi.

## EDUCATION

Nowy użytkownik szybko rozumie model produktu.

## CONTEXT

Zawsze wiadomo, którego projektu dotyczą informacje.

## CONVERSATION

Rozmowa z Ariadne jest centralną częścią doświadczenia.

## MEMORY

Użytkownik rozumie, co Ariadne pamięta i skąd pochodzą odpowiedzi.

## TRUST

Widać źródła i status każdej informacji.

## CONTROL

Nic ważnego nie trafia do pamięci projektu bez świadomej akceptacji.

## CONTINUITY

Rozmowy i proces dodawania wiedzy mają trwałą historię.

## CALM

Interfejs nie przytłacza.

## CHARACTER

Ariadne ma własny visual language.

## MOTION

Animacja komunikuje relacje, ciągłość i zmianę.

## INTELLIGENCE

Produkt ma wyglądać jak inteligentne narzędzie pracy, a nie jak formularz CRUD.

---

# 49. ZACZNIJ TERAZ

Zacznij od:

1. internetowego researchu,
2. audytu repozytorium,
3. krótkiej syntezy findings,
4. 2–3 visual directions,
5. wyboru najlepszego kierunku,
6. researchu i konfiguracji Motion for React,
7. aktualizacji istniejącego pliku MD,
8. wdrożenia redesignu,
9. testów i weryfikacji.

Nie projektuj na podstawie domyślnych wzorców AI.

Każda większa decyzja wizualna lub UX powinna mieć:

- źródło,
- powód,
- zastosowanie w Ariadne.

Nie kopiuj pojedynczego produktu.

Zbuduj własny system Ariadne na podstawie najlepszych współczesnych wzorców.
