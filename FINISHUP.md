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

### 2. Front, branch `feature/screen-8-settings`

- [ ] Opakowania w `lib/api.ts`, których dziś nie ma: `listTokens`,
      `deleteToken`, `setAllPermission`, `changePassword`, workspace'y,
      zaproszenia
- [ ] Ekran `/settings`: konto, tokeny, automatyczne zatwierdzanie, zespół
- [ ] Rejestracja ekranu: `Section`, `LINKS`, ikona, klucze w obu plikach i18n
- [ ] Nazwa workspace w metadanych projektu i autor przy wpisie

### 3. Weryfikacja

- [ ] `npx tsx scripts/verify-rest.ts` przechodzi w całości
- [ ] `npm run build` we froncie przechodzi
- [ ] W oknie: konto A zaprasza, konto B widzi projekt A
- [ ] W oknie: B pyta asystenta o decyzję zapisaną przez A i dostaje odpowiedź
      z cytowaniem oraz autorem
- [ ] Przez MCP: token B dla wspólnego workspace zwraca kartę projektu A
- [ ] W oknie: B zatwierdza wpis, A widzi przy nim podpis B

### 4. Dokumentacja

- [ ] `plan-ariadne.md`: sekcja 0 (dziś kłamie), sekcje 3, 10, 11, 13, 14
- [ ] `PRODUCT.md`: druga osoba w zespole jako czytelnik archiwum
- [ ] Ten plik zamknięty jako zapis tego, co powstało

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

## Znalezione po drodze

- `verify-rest.ts` miał asercję zależną od kolejności (`body[0].name === "Check"`
  po listowaniu projektów sortowanym po `updatedAt`). Projekt "Other", dokładany
  w kroku 5a.1, jest nowszy, więc ten check był złamany na `main` i nikt tego nie
  zobaczył, bo skrypt nie dochodził tak daleko. Teraz porównuje posortowaną listę
  nazw.
