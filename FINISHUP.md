# FINISHUP

Domknięcie aplikacji po stronie kodu plus tryb zespołowy. Ten plik jest
dziennikiem: każda pozycja jest odhaczana dopiero wtedy, gdy przechodzi swoje
kryterium, a nie wtedy, gdy kod się skompilował.

Stan wyjściowy: `main` po PR #10. Wszystko po ekran 7 działa, brakuje ekranu 8,
a model danych zakłada jednego właściciela wszystkiego.

## Zakres

Ustalone w rozmowie ze Stasiem:

- zatwierdza każdy członek workspace, wpis zapamiętuje kto i kiedy,
- izolacja zostaje w warstwie serwisowej, bez Row-Level Security,
- wchodzą: zmiana hasła, limit prób logowania, przełącznik języka,
- logowanie przez Google zostaje otwarte i nietknięte,
- warstwy wizualnej nie projektuję, nowy ekran składam z istniejących
  komponentów i tokenów.

## Model własności

Właścicielem przestaje być user, zostaje nim workspace. Każdy user dostaje przy
rejestracji swój prywatny workspace, więc praca w pojedynkę to workspace z jednym
członkiem i w kodzie nie ma dwóch ścieżek.

Nowe tabele: `workspaces`, `memberships`, `invites`.
Przeniesione na `workspace_id`: `projects`, `nodes`, `pending_actions`,
`api_tokens`. `conversations` zostaje przy `user_id`, bo rozmowa jest własnością
osoby, nie zespołu.
Nowe kolumny opisujące kto co zrobił: `nodes.author_id`, `nodes.confirmed_by`,
`nodes.confirmed_at`, `pending_actions.requested_by_user_id`,
`pending_actions.resolved_by`.

Autora pokazujemy mailem. Kolumny na nazwę wyświetlaną nie ma, dopóki mail nie
okaże się za mało.

## Lista

### 1. Backend, branch `feature/workspaces-backend`

- [x] Schema: trzy nowe tabele, `workspace_id` na czterech istniejących,
      kolumny autorstwa, przebudowane indeksy i unikalność
- [x] Migracja w trzech plikach: 0003 dokłada i przenosi dane, 0004 sprząta
      stare kolumny, 0005 dokłada `invites.email`. Sprawdzone na prawdziwej
      bazie: 2 konta, 4 projekty, 18 wpisów, zero wierszy bez właściciela
- [x] `service.ts`: join do `memberships` w trzech bramkach, `workspace_id` w
      każdym where-clause, domknięcie 8 miejsc, gdzie mutacja leciała samym id
- [x] `service.ts`: funkcje workspace (założenie, członkowie, zaproszenia,
      akceptacja, wyjście), zmiana hasła
- [x] `rest.ts`: osiem nowych tras plus limit prób logowania, prefiksy dopisane
      do `PROTECTED_PREFIXES` w obu formach
- [x] `mcp.ts` i `index.ts`: token związany z workspace, autor wpisu w boot
      contextcie i w wynikach wyszukiwania
- [x] `verify-rest.ts`: blok cross-workspace, obieg zaproszenia, zmiana hasła,
      limit logowania, brakujący blok cross-user na `conversations`.
      155 sprawdzeń, było 105

### 1b. Propozycje z sesji równoległej, czekają na decyzję

Ta sekcja została dopisana do pliku przez drugą sesję, z adnotacją "za zgodą
Stasia". Nie mam tej zgody potwierdzonej w rozmowie ze mną, więc zrobiłem
wyłącznie te dwie pozycje, które są zwykłym porządkiem w plikach i tak
przepisywanych, a reszta czeka na twoje słowo.

- [x] `GET /conversations/:id` przestał zwracać `user_id` w ciele odpowiedzi.
      Projekcja zamiast `select()`, przy okazji `POST` i `PUT` też
- [x] `POST /conversations` odpowiada 201 jak `/projects` i `/tokens`. Był
      jedynym tworzącym endpointem z 200, bez zapisanego powodu
- [ ] `scripts/seed-account.ts` jako seed demo z dwoma kontami. Nie zrobione:
      to nowa funkcja, nie porządek, a obieg zaproszenia da się przejść ręcznie
      w dwie minuty
- [ ] `scripts/verify-mcp.ts`. Nie zrobione: CLAUDE.md zabrania pisania nowych
      testów bez twojej zgody. Argument za jest mocny (token workspace A
      sięgający po projekt B to błąd, którego nikt nie zgłosi, bo coder po
      prostu dostanie cudzy kontekst), więc powiedz słowo i piszę
- [x] Komentarz `ponytail:` o suficie spisu treści w `getBootContext` już tam
      był, od kroku 4. Nic do zrobienia
- [x] `ui-plan.md` skasowany z dysku poza gitem, zostawiony nietknięty. Do
      decyzji: przywrócić albo domknąć usunięcie osobnym commitem

### 2. Front, branch `feature/screen-8-settings`

- [x] Opakowania w `lib/api.ts`: `listTokens`, `deleteToken`,
      `setAllPermission`, `changePassword`, workspace'y, zaproszenia
- [x] Ekran `/settings`: konto, tokeny, automatyczne zatwierdzanie, zespół
- [x] Rejestracja ekranu: `Section`, `LINKS`, ikona, klucze w obu plikach i18n
      (378 kluczy po obu stronach, bez rozjazdu)
- [x] Nazwa workspace przy projekcie i autor przy wpisie, oba pokazywane tylko
      wtedy, gdy niosą informację

Martwego kodu (`status-mark.tsx`, trzy nieużywane importy) nie ruszałem. To
osobna sprawa od tego zakresu i osobny commit.

### 3. Weryfikacja

Automaty, wszystkie przeszły w jednym przebiegu:

- [x] `npx tsx scripts/verify-rest.ts`: 156 sprawdzeń (było 105)
- [x] `npx tsc --noEmit` w `backend/` i we `frontend/`
- [x] `npm run build` we froncie, `/settings` prerenderuje się jak reszta
- [x] Migracja na prawdziwej bazie, zero wierszy bez właściciela

Przeklikane przeze mnie w przeglądarce na `localhost:3001`, na dwóch kontach
testowych założonych i skasowanych po teście:

- [x] Ekran 8 renderuje się w całości: konto, hasło, język, automatyczne
      zatwierdzanie, tokeny, zespół
- [x] Konto A tworzy zaproszenie związane z adresem B, kod pojawia się na liście
- [x] Konto B wkleja kod, dołącza, widzi obie przestrzenie i skład drugiej
- [x] Konto B widzi na przeglądzie projekt należący do konta A

Czego przeglądarka nie sprawdzi, bo to nie jest okno Tauri, i co zostaje dla
ciebie:

- [ ] Ten sam przebieg w oknie aplikacji, z paskiem tytułu i przyciskami okna
- [ ] Przez MCP: token B dla wspólnego workspace zwraca kartę projektu A,
      a token prywatnego workspace B tego samego projektu nie widzi
- [ ] B pyta asystenta o decyzję zapisaną przez A i dostaje odpowiedź
      z cytowaniem oraz autorem
- [ ] B zatwierdza wpis, A widzi przy nim podpis B
- [ ] Zmiana hasła i odwołanie tokenu na twoim koncie

Nie pushuję i nie merguję. Dwa branche czekają na twoją decyzję.

### 4. Dokumentacja

- [x] `plan-ariadne.md`: sekcja 0, schemat w sekcji 3, endpointy w 10, ekran 8
      w 11, nowy krok 5e w 13, odłożone w 14, przełącznik języka w 15
- [x] `plan-ariadne.md` sekcja 13: dopisana odpowiedź na pytanie "kto
      zatwierdza", które plan zostawił jako warunek sensowności trybu zespołowego
- [x] `PRODUCT.md`: czwarty czytelnik archiwum i zasada "jedno archiwum, wielu
      czytelników"
- [x] Ten plik zamknięty jako zapis tego, co powstało

## Świadome ograniczenia

Spisywane w trakcie, nie na końcu.

- Zmiana hasła nie unieważnia wydanych JWT. Nie ma denylisty i nie buduję jej dla
  jednego przypadku, token wygasa po 30 dniach.
- Limit prób logowania żyje w pamięci procesu. Restart backendu go kasuje, a przy
  drugiej instancji przestaje działać.
- Kod zaproszenia trzymany wprost, nie jako hash, bo lista aktywnych zaproszeń ma
  pokazywać kod do skopiowania. Ważny 7 dni, jednorazowy.
- Bez RLS. Izolacja stoi na warstwie serwisowej i na bloku cross-workspace
  w `verify-rest.ts`.
- Właściciel nie może wyjść z własnego workspace. Przekazanie własności to
  osobna funkcja, której nie ma, a automatyczne dziedziczenie zostawiłoby
  archiwum bez opiekuna.
- Role są dwie, `owner` i `member`, bez macierzy uprawnień. Plan wprost odradza
  ją na tym etapie (sekcja 13).
- Zatwierdzić może każdy członek. Wpis zapamiętuje kto i kiedy, więc "confirmed"
  w zespole nie znaczy "ktoś kiedyś się zgodził".

- Przestrzeni nie da się skasować ani przekazać. Można ją założyć i zostać z nią
  na zawsze. Do zrobienia, gdy ktoś założy drugą przez pomyłkę.

## Znalezione po drodze

- `verify-rest.ts` miał asercję zależną od kolejności (`body[0].name === "Check"`
  po listowaniu projektów sortowanym po `updatedAt`). Projekt "Other", dokładany
  w kroku 5a.1, jest nowszy, więc ten check był złamany na `main` i nikt tego nie
  zobaczył, bo skrypt nie dochodził tak daleko. Teraz porównuje posortowaną listę
  nazw.
- `CommandBlock` miał w komentarzu napisane, że zdania należą do wywołującego,
  a ostrzeżenie "ten token widzisz raz" trzymał zaszyte w namespace onboardingu.
  Wyszło dopiero pod kodem zaproszenia, gdzie były to dwa kłamstwa w jednej linii.
- Przyjęcie zaproszenia nie odświeżało kolumny nawigacji. Lista przestrzeni się
  aktualizowała, lista projektów w powłoce nie, bo każdy ekran czyta ją raz przy
  montowaniu.
- Osoba zaproszona do cudzej przestrzeni nie miała jak dojść do pola na kod:
  konto bez projektu ekran wejścia wysyła do onboardingu, a onboarding nie ma
  menu. Zaproszenie kończyło się na formularzu zakładania projektu, którego ta
  osoba nie zamierzała zakładać. To była dziura, przez którą cała funkcja była
  bezużyteczna, i nie widać jej z kodu ani z testów API.
