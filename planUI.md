Jesteś senior product designerem oraz senior frontend developerem specjalizującym się w aplikacjach SaaS, developer tools i AI tools.

Chcę przeprowadzić kompleksowy redesign UX/UI aplikacji ARIADNE.

Nie chodzi o kosmetyczną zmianę CSS. Chcę, żebyś najpierw zrozumiał sposób działania produktu, obecny flow użytkownika, strukturę projektu i istniejące komponenty, a następnie przebudował doświadczenie użytkownika tak, aby aplikacja była znacznie bardziej intuicyjna, nowoczesna i przyjazna.

==================================================
1. CZYM JEST ARIADNE
==================================================

Ariadne jest aplikacją służącą do przechowywania, porządkowania i odzyskiwania kontekstu projektów programistycznych podczas pracy z LLM-ami.

Jej rolą jest m.in.:

- zapamiętywanie decyzji projektowych,
- zapamiętywanie ustaleń,
- przechowywanie ograniczeń projektu,
- zapisywanie zmian i ważnych informacji,
- umożliwienie późniejszego pytania AI o historię i kontekst projektu,
- przygotowywanie nowych informacji do zatwierdzenia przed dodaniem ich do bazy wiedzy.

Metaforą marki jest mitologiczna Ariadna i nić prowadząca przez labirynt.

Ta metafora powinna być odczuwalna subtelnie:

chaos → nić → kontekst → uporządkowana wiedza → właściwa odpowiedź.

Nie chcę jednak dosłownego „greckiego interfejsu”.

Produkt ma wyglądać jak współczesne, bardzo dobre narzędzie AI/developer tool.

==================================================
2. NAJWAŻNIEJSZY PROBLEM OBECNEGO UI
==================================================

Obecny interfejs jest:

- bardzo kwadratowy,
- mocno formularzowy,
- mało przyjazny,
- mało intuicyjny,
- zbyt podobny do panelu administracyjnego,
- pozbawiony dobrej hierarchii informacji,
- pełen cienkich linii i podobnie wyglądających elementów,
- zbyt techniczny wizualnie,
- trudny do szybkiego zeskanowania.

Użytkownik często nie wie:

- gdzie dokładnie się znajduje,
- czego dotyczy widoczna informacja,
- co może zrobić na danym ekranie,
- czego Ariadne od niego oczekuje,
- co stanie się po kliknięciu danej akcji,
- z jakiego projektu pochodzi informacja,
- które informacje są kluczowe,
- czym różnią się poszczególne części aplikacji.

Nie chcę tylko „ładniejszej wersji obecnego UI”.

Chcę poprawić MODEL MENTALNY aplikacji.

Po wejściu na każdy ekran użytkownik powinien w ciągu kilku sekund wiedzieć:

1. Gdzie jestem?
2. Co widzę?
3. Co mogę tutaj zrobić?
4. Co się stanie po wykonaniu akcji?

==================================================
3. WAŻNE OGRANICZENIA TECHNICZNE
==================================================

Najpierw przeanalizuj istniejący kod.

Sprawdź:

- routing,
- komponenty,
- strukturę danych,
- istniejące funkcjonalności,
- modele danych,
- API,
- sposób obsługi projektów,
- sposób działania zatwierdzeń,
- sposób działania asystenta,
- sposób dodawania informacji do bazy,
- authentication flow.

NIE zmieniaj istniejącej logiki biznesowej bez potrzeby.

NIE usuwaj istniejących funkcjonalności.

NIE przebudowuj backendu tylko po to, żeby osiągnąć lepszy wygląd.

NIE zmieniaj modeli danych, jeśli da się wykonać redesign na istniejącej strukturze.

NIE instaluj nowych bibliotek tylko po to, aby uzyskać prosty efekt wizualny, jeśli można go osiągnąć istniejącym stackiem.

Jeśli podczas pracy okaże się, że konkretna poprawa UX wymaga zmiany logiki lub struktury danych:
- najpierw to wskaż,
- wyjaśnij dlaczego,
- wybierz najmniej inwazyjne rozwiązanie.

==================================================
4. BRANDING
==================================================

Nazwa:

ARIADNE

Kolor główny marki:

#205C9C

Typografia:

1. Marcellus
Używaj bardzo oszczędnie.

Może pojawiać się w:
- logo,
- dużych brandowych nagłówkach,
- ekranie logowania,
- pojedynczych hero headings.

NIE używaj Marcellusa do długiego tekstu UI.

2. Geist Sans
Podstawowy font interfejsu.

Używaj do:
- nawigacji,
- opisów,
- formularzy,
- przycisków,
- odpowiedzi AI,
- interfejsu,
- większości nagłówków.

3. Geist Mono
Używaj do:
- nazw repozytoriów,
- paths,
- branchy,
- dat,
- metadata,
- danych technicznych,
- elementów związanych z kodem.

Jeśli fonty nie są jeszcze poprawnie skonfigurowane, skonfiguruj je w sposób właściwy dla obecnego frameworka.

==================================================
5. DESIGN LANGUAGE
==================================================

Chcę odejść od obecnego „kwadratowego panelu administracyjnego”.

Kierunek:

- nowoczesny,
- spokojny,
- bardzo czytelny,
- elegancki,
- techniczny, ale nie surowy,
- premium developer tool,
- dużo whitespace,
- dobra hierarchia informacji.

Inspiracja może pochodzić z dobrych współczesnych AI tools i developer tools.

Szczególnie pod względem UX rozmowy inspiracją może być sposób rozpoczynania rozmowy w ChatGPT:

- jasny cel ekranu,
- dużo przestrzeni,
- centralny composer,
- przykładowe pytania,
- brak niepotrzebnego wizualnego hałasu.

NIE kopiuj interfejsu ChatGPT 1:1.

Chcę:

- subtelnie zaokrąglone komponenty,
- cards zamiast ciągłego używania separatorów,
- wyraźne grupowanie informacji,
- badges,
- status chips,
- dobrze zaprojektowane empty states,
- czytelne primary actions,
- spokojne secondary actions,
- dobre hover states,
- dobre focus states,
- logiczne spacingi,
- spójny grid,
- czytelną hierarchy typography.

Nie przesadzaj z:

- border radius,
- cieniami,
- gradientami,
- efektami glow,
- glassmorphism,
- dekoracjami AI.

To nadal ma być narzędzie dla developerów.

Preferowany ogólny klimat kolorystyczny:

Primary:
#205C9C

Light background:
około #F4F7FB / #F3F6FA

Surface:
#FFFFFF

Primary text:
ciemny grafit / granat zamiast absolutnej czerni.

Muted text:
spokojny szaro-niebieski.

Borders:
bardzo subtelne.

==================================================
6. NAWIGACJA
==================================================

Obecny sidebar zostaje jako idea, ale wymaga redesignu.

Obecna struktura:

Przegląd
Projekt
Asystent
Baza
Do zatwierdzenia

Zachowaj te funkcjonalności, ale popraw sposób ich prezentacji.

Project switcher:

Aktualny select projektu wygląda jak zwykłe przypadkowe pole formularza.

Zaprojektuj go jako prawdziwy PROJECT SWITCHER.

Powinien wyraźnie pokazywać:

- nazwę aktywnego projektu,
- możliwość przełączenia projektu,
- opcjonalnie status lub małą informację pomocniczą.

Użytkownik powinien cały czas wiedzieć, na jakim projekcie pracuje.

Active navigation:

Obecnie aktywność zakładki komunikuje praktycznie tylko cienka niebieska linia.

Zaprojektuj dużo czytelniejszy active state:
- subtelne tło,
- kolor,
- ikona lub inne wzmocnienie hierarchii.

„Do zatwierdzenia” powinno mieć badge z liczbą oczekujących elementów.

Nie przesadzaj z ikonami. Jeśli ich używasz, niech faktycznie pomagają w skanowaniu interfejsu.

==================================================
7. PRZEGLĄD / HOME
==================================================

Obecny ekran przeglądu jest przede wszystkim listą wpisów.

Chcę zamienić go w prawdziwy PROJECT HOME / DASHBOARD.

Bardzo ważne:

rozmowa z Ariadne powinna stać się jednym z najważniejszych elementów produktu.

Nie chcę, aby użytkownik musiał najpierw wejść do osobnej zakładki „Asystent”, żeby zadać pytanie.

Na górze dashboardu powinien znajdować się duży, elegancki AI composer.

Przykładowy heading:

„Czego chcesz się dowiedzieć?”

lub:

„Zapytaj Ariadne o ten projekt”

Supporting copy:

„Ariadne odpowiada na podstawie zapisanych decyzji, ustaleń i kontekstu projektu.”

Pod spodem:
duży input / composer.

UX powinien przypominać rozpoczęcie nowej rozmowy w nowoczesnym AI tool.

Pod composerem można pokazać clickable suggestion prompts, np.:

„Jakie decyzje podjęliśmy ostatnio?”

„Co zostało jeszcze do zrobienia?”

„Dlaczego wybraliśmy ten stack?”

„Jakie ograniczenia ma ten projekt?”

„Co zmieniło się ostatnio?”

Poniżej rozmowy/dashboardu pokaż czytelne sekcje:

OSTATNIE USTALENIA

- kilka najważniejszych ostatnich decyzji,
- nie pełna ściana tekstu.

DO ZATWIERDZENIA

- liczba oczekujących wpisów,
- 2–3 najnowsze elementy,
- CTA do pełnej listy.

OSTATNIA AKTYWNOŚĆ

- co ostatnio dodano,
- co zatwierdzono,
- co zmieniono.

O PROJEKCIE

snapshot:
- etap,
- repozytorium,
- stack,
- ważne ograniczenia.

Dashboard powinien dawać użytkownikowi poczucie:

„Wiem, co dzieje się w tym projekcie.”

==================================================
8. ASYSTENT
==================================================

Obecny ekran zawiera copy typu:

„Zapytaj asystenta”

„Zapytaj o przeszłość projektu.”

To jest zbyt abstrakcyjne.

Nie wiadomo:
- czego można pytać,
- jakie informacje posiada Ariadne,
- skąd odpowiedź będzie pochodzić.

Przebuduj ekran w pełnoprawny AI conversation interface.

Empty state:

Heading:

„Zapytaj Ariadne o swój projekt”

Supporting copy:

„Ariadne odpowiada na podstawie zapisanych decyzji, ustaleń i kontekstu tego projektu.”

Duży composer.

Pod composerem pokaż kilka przykładowych pytań.

Po rozpoczęciu rozmowy:

- pokaż czytelną historię conversation,
- user messages,
- odpowiedzi Ariadne,
- dobre odstępy,
- rozsądną szerokość tekstu,
- łatwe skanowanie odpowiedzi.

Bardzo ważne:

Ariadne odpowiada na podstawie zapisanych wpisów.

Pokaż więc SOURCES.

Ale nie jako wielką techniczną ścianę.

Przykład:

„Na podstawie 3 wpisów”

po kliknięciu użytkownik może rozwinąć źródła.

Każde źródło może pokazywać:
- tytuł,
- typ,
- datę,
- fragment.

==================================================
9. PROJEKT
==================================================

Obecny ekran „Projekt” wygląda jak formularz administracyjny.

Praktycznie każda informacja ma tę samą wagę wizualną.

Chcę zmienić go w PROJECT PROFILE / PROJECT OVERVIEW.

Na górze:

Portfolio

obok badge:

Produkcja

Poniżej repozytorium.

Następnie osobne, dobrze zaprojektowane sekcje.

O PROJEKCIE

Krótki opis celu projektu.

TECHNOLOGIE

Nie pokazuj całego stacku jako jednego bardzo długiego tekstu.

Użyj tagów / chips:

Next.js
React
TypeScript
Tailwind
next-intl
Framer Motion

itd.

REPOZYTORIUM

Czytelnie zaprezentowany link / nazwa repozytorium.

OGRANICZENIA I WAŻNE ZASADY

Ta sekcja powinna być dobrze widoczna, ponieważ te informacje są szczególnie ważne dla AI.

ETAP

Czytelny status.

Domyślnie ekran powinien być READABLE VIEW.

Nie chcę stale oglądać ogromnego formularza.

Dodaj akcję:

„Edytuj projekt”

Dopiero wtedy przechodzimy do edycji danych.

==================================================
10. BAZA
==================================================

Obecna nazwa:

„Rozmawiaj z bazą”

jest niejasna.

Jeszcze bardziej niejasny jest placeholder typu:

„Odwołujemy decyzję o...”

Użytkownik nie rozumie różnicy między:

ASYSTENT

a

BAZA.

Funkcja tego miejsca jest inna:

ASYSTENT:
użytkownik PYTA o istniejącą wiedzę.

BAZA:
użytkownik DODAJE / AKTUALIZUJE wiedzę.

UI i copy muszą jasno to komunikować.

Rozważ zmianę nazwy „Baza” w nawigacji, jeżeli da się to zrobić bez zmiany logiki produktu.

Lepsze kierunki nazewnictwa:

„Dodaj kontekst”
„Kontekst”
„Dodaj informację”

Wybierz nazwę najbardziej zgodną z funkcją.

Heading ekranu np.:

„Dodaj informację do kontekstu”

Supporting copy:

„Opisz decyzję, zmianę lub ustalenie. Ariadne przygotuje propozycję wpisu do zatwierdzenia — nic nie zostanie zapisane automatycznie.”

Zamiast cienkiej pojedynczej linii z placeholderem zrób prawdziwy composer / textarea.

Przykładowe podpowiedzi:

„Zmieniliśmy bibliotekę formularzy z X na Y.”

„Nie używamy backendu — aplikacja pozostaje statyczna.”

„Case studies odkładamy na później.”

„Nowy projekt wymaga wpisów w pl.json i en.json.”

Po wysłaniu:

pokaż wygenerowaną propozycję wpisu w czytelnej karcie.

Użytkownik powinien od razu rozumieć:

- co Ariadne wyciągnęła z jego wypowiedzi,
- co zostanie zapisane,
- że wpis oczekuje na zatwierdzenie.

==================================================
11. DO ZATWIERDZENIA
==================================================

To obecnie najsłabszy ekran UX aplikacji.

Obecna długa lista tekstu jest bardzo trudna do skanowania.

Nie wiadomo:

- gdzie zaczyna się kolejny wpis,
- którego projektu dotyczy,
- co dokładnie jest propozycją,
- jakiego rodzaju jest informacja,
- skąd pochodzi,
- kiedy została utworzona,
- co faktycznie zatwierdzamy.

Przebuduj ten ekran całkowicie.

Najważniejsza zasada:

GRUPUJ ELEMENTY WEDŁUG PROJEKTU.

Przykład:

PORTFOLIO
4 oczekujące

Pod spodem osobne APPROVAL CARDS.

Każda karta powinna mieć:

TYPE BADGE:

Decyzja
Ograniczenie
Zmiana
Notatka
Ustalenie

jeśli takie typy istnieją w danych.

Następnie:

KRÓTKI TYTUŁ

np.

„Kolejność projektów ustawiana ręcznie”

TREŚĆ

czytelne podsumowanie.

METADATA

- projekt,
- data,
- źródło,
- autor / agent, jeśli istnieje i ma znaczenie.

ACTIONS

Primary:

„Zatwierdź”

Secondary:

„Odrzuć”
lub:
„Archiwizuj”

zgodnie z faktyczną logiką produktu.

Jeżeli treść jest długa:
- pokaż rozsądny preview,
- dodaj „Pokaż więcej”.

Użytkownik powinien móc przeskanować 10 kart w kilka sekund.

Jeśli istniejąca logika bezpiecznie na to pozwala, rozważ akcję:

„Zatwierdź wszystkie”

dla konkretnego projektu.

Nie dodawaj jej jednak tylko wizualnie, jeśli backend tego poprawnie nie obsługuje.

==================================================
12. MICROCOPY
==================================================

Przejrzyj WSZYSTKIE komunikaty w aplikacji.

Obecny język jest często techniczny lub abstrakcyjny.

Przykłady problematycznego copy:

„Zapytaj o przeszłość projektu.”

„Rozmawiaj z bazą.”

Zastępuj takie teksty komunikatami mówiącymi:

- co użytkownik może zrobić,
- czego może oczekiwać,
- jaki będzie rezultat.

Copy powinno być:
- krótkie,
- konkretne,
- naturalne,
- bez marketingowego nadęcia.

Nie tłumacz użytkownikowi wewnętrznej architektury systemu, jeśli nie musi jej znać.

==================================================
13. EKRAN LOGOWANIA
==================================================

Ekran logowania wymaga osobnego redesignu.

Obecnie znajduje się na nim duży, prosty, geometryczny labirynt.

Usuń ten element.

W katalogu:

/public

umieściłem/am nowy obraz do wykorzystania.

Najpierw sprawdź zawartość katalogu /public i znajdź nowo dodany obraz przedstawiający:

dłoń trzymającą cienką złotą nić na ciemnogranatowym, malarskim tle.

To właśnie ten obraz ma być wykorzystany na ekranie logowania.

Nie konwertuj go do ASCII.

Nie zamieniaj go w ilustrację.

Nie przerysowuj go.

Nie nakładaj na niego ciężkich efektów.

Użyj oryginalnego obrazu jako elementu art direction.

Chcę SPLIT SCREEN LOGIN.

Układ desktop:

około 40–45%:
panel logowania

około 55–60%:
art panel z obrazem

Możesz zdecydować, czy formularz będzie po lewej czy po prawej, zależnie od kompozycji obrazu i jakości layoutu.

ART PANEL

Obraz powinien:
- zajmować znaczną część panelu,
- być dobrze wykadrowany,
- eksponować dłoń i złotą nić,
- zachować odpowiednie proporcje,
- używać object-fit: cover lub podobnego rozwiązania tam, gdzie jest to właściwe.

Nie próbuj wtapiać ciemnego obrazu bezpośrednio w jasnoniebieskie tło całego UI.

Traktuj go jako osobny, ciemny art panel.

Możesz zastosować bardzo subtelny overlay w granacie, jeśli poprawi to spójność z brandingiem.

Nie używaj mocnego gradientu.

FORMULARZ

Druga część ekranu powinna być bardzo czysta i jasna.

Tło:
około #F4F7FB lub podobne.

Zawartość:

logo / nazwa Ariadne

heading:

„Zaloguj się do Ariadne”

albo krótsze:
„Zaloguj się”

Supporting copy może być bardzo subtelne.

Następnie:

adres e-mail
hasło
primary button
akcja „Nie mam konta”

Popraw:

- odstępy,
- rozmiary inputów,
- labelki,
- focus states,
- CTA,
- alignment,
- responsywność.

Obecny tekst:

„Serwer Ariadne na localhost:3000 odpowiada”

jest zbyt mocno eksponowany.

Jeżeli status serwera musi pozostać widoczny:
- pokaż go jako bardzo subtelny system status,
- może z małą zieloną kropką,
- nie może konkurować z formularzem.

Można zastosować bardzo subtelny tagline odnoszący się do idei produktu, ale nie jest obowiązkowy.

Ewentualne kierunki:

„Twoja nić przez kontekst projektu.”

lub podobne.

Nie dodawaj tekstu tylko po to, żeby zapełnić ekran.

Obraz sam w sobie jest silnym elementem brandowym.

Na mobile:
- formularz ma być najważniejszy,
- art panel może zostać ograniczony lub przeniesiony,
- login musi pozostać bardzo funkcjonalny.

==================================================
14. COMPONENT SYSTEM
==================================================

Nie twórz osobnych przypadkowych styli na każdym ekranie.

Zbuduj spójny mini design system.

Zidentyfikuj i utwórz / uporządkuj reusable components, np.:

Button

IconButton

Input

Textarea

AI Composer

Card

Badge

StatusBadge

ProjectSwitcher

NavigationItem

EmptyState

PageHeader

SectionHeader

ActivityItem

DecisionCard

ApprovalCard

SourceReference

TechnologyTag

ProjectSummary

Toast / feedback state, jeśli już istnieje system feedbacku.

Ustal spójne wartości:

- radius,
- border,
- spacing,
- typography,
- button heights,
- input heights,
- container widths,
- gaps.

==================================================
15. FEEDBACK PO AKCJACH
==================================================

To jest bardzo ważne.

Aplikacja ma jasno komunikować rezultat każdej operacji.

Po akcji użytkownik powinien dostać czytelny feedback.

Np.:

po dodaniu kontekstu:

„Propozycja została utworzona i czeka na zatwierdzenie.”

po zatwierdzeniu:

„Wpis dodano do kontekstu projektu.”

po odrzuceniu:

„Propozycja została odrzucona.”

po zapisaniu projektu:

„Zmiany w projekcie zostały zapisane.”

Nie zostawiaj użytkownika w sytuacji, w której kliknął przycisk i nie wie, czy coś się wydarzyło.

==================================================
16. EMPTY STATES
==================================================

Każda sekcja powinna mieć dobrze zaprojektowany empty state.

Nie używaj wyłącznie komunikatów typu:

„brak wpisów”

„nic nie czeka”

Jeżeli nie ma danych, powiedz użytkownikowi:
- co to znaczy,
- co może zrobić dalej.

Np.:

„Nie masz jeszcze zapisanych decyzji.”

„Dodaj pierwsze ustalenie do kontekstu projektu.”

==================================================
17. RESPONSIVENESS
==================================================

Desktop jest głównym środowiskiem pracy, ale layout musi poprawnie reagować na mniejsze szerokości.

Sidebar może:
- się zwężać,
- przechodzić w drawer,
- zachowywać się zgodnie z najlepszym UX dla obecnej architektury.

Nie pozwalaj:
- na overflow długiego stacku,
- na zbyt szerokie paragrafy,
- na rozpadające się formularze,
- na ucinanie istotnych CTA.

==================================================
18. ACCESSIBILITY
==================================================

Zadbaj o:

- semantic HTML,
- poprawną hierarchy headings,
- labels dla formularzy,
- keyboard navigation,
- focus states,
- odpowiednie contrast ratios,
- wystarczająco duże clickable areas,
- disabled states,
- loading states,
- aria tam, gdzie rzeczywiście jest potrzebna.

==================================================
19. SPOSÓB PRACY
==================================================

Nie zaczynaj od losowego przepisywania CSS.

Najpierw wykonaj audyt obecnej aplikacji.

ETAP 1 — ANALIZA

Sprawdź kod i opisz krótko:

- obecną strukturę UI,
- istniejące reusable components,
- największe problemy UX,
- które komponenty można zachować,
- które trzeba przebudować,
- czy istnieją jakieś ograniczenia techniczne.

ETAP 2 — PLAN

Przed implementacją przedstaw zwięzły plan redesignu:

- layout,
- navigation,
- dashboard,
- assistant,
- project,
- knowledge/context input,
- approvals,
- login,
- design system.

Nie potrzebuję bardzo długiego dokumentu.
Kilka konkretnych punktów wystarczy.

ETAP 3 — IMPLEMENTACJA

Następnie wykonaj redesign.

Nie zatrzymuj się po samym planie.

Wprowadź zmiany w kodzie.

ETAP 4 — WERYFIKACJA

Po implementacji:

- sprawdź czy projekt się buduje,
- napraw błędy,
- sprawdź najważniejsze flow,
- upewnij się, że nie usunąłeś istniejącej funkcjonalności,
- sprawdź responsywność,
- sprawdź długie treści,
- sprawdź loading / disabled / empty states.

==================================================
20. NAJWAŻNIEJSZY CEL PRODUKTOWY
==================================================

Finalny produkt ma sprawiać wrażenie:

„Ariadne prowadzi mnie przez kontekst projektu.”

A nie:

„Patrzę na panel administracyjny bazy danych.”

Najważniejsze cechy końcowego UX:

CLARITY
Użytkownik zawsze wie, co widzi.

CONTEXT
Zawsze wiadomo, którego projektu dotyczą informacje.

CONVERSATION
Rozmowa z Ariadne jest centralną częścią doświadczenia.

TRUST
Widać, skąd pochodzą odpowiedzi i co dokładnie zostanie zapisane.

CONTROL
Nic ważnego nie trafia do pamięci projektu bez świadomego zatwierdzenia użytkownika.

CALM
Interfejs nie przytłacza użytkownika.

INTELLIGENCE
Ariadne ma wyglądać jak inteligentne narzędzie pracy, a nie jak formularz do obsługi rekordów w bazie.

==================================================
21. WAŻNE: NIE ZMIENIAJ DLA SAMEJ ZMIANY
==================================================

Jeżeli coś w obecnym produkcie działa dobrze, możesz to zachować.

Każda zmiana powinna mieć powód UX.

Nie przebudowuj aplikacji dla efektu wizualnego kosztem funkcjonalności.

Zacznij teraz od analizy repozytorium i istniejącego UI, znajdź również odpowiedni obraz w katalogu /public, następnie przedstaw krótki plan i przejdź bezpośrednio do implementacji redesignu.