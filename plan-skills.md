# Skills. Udostępnianie umiejętności między Claude a Codeksem

Stan: zrobione, branch `feature/skills`. Ten plik zaczął życie jako plan osobnej
zakładki na 3,5 dnia i został przepisany po tym, jak zakres spadł do jednej
sekcji w ustawieniach. Zostawiony w repo dla powodów, nie dla zakresu; decyzje
siedzą też w samej Ariadnie.

## Problem

Umiejętności agentów to katalogi na dysku, po jednym korzeniu na narzędzie:
`~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`. Każde narzędzie czyta
swój własny, więc skill leżący w jednym jest niewidoczny dla drugiego. W chwili
pisania: 58 skilli razem, Claude widział 14, Codex CLI **jeden**.

Mechanizm łączenia istniał i był używany ręcznie: cztery junctiony założone przez
`mklink /J` w cztery i pół miesiąca. Bariera to nie brak możliwości, tylko
konieczność pamiętania o poleceniu i wklejania dwóch długich ścieżek.

## Rozwiązanie

Sekcja `Skille` na dole ekranu ustawień. Pokazuje stan każdego korzenia
("Claude: 14 z 58") i ma jeden przycisk, który zakłada wszystkie brakujące
dowiązania, w obie strony, dla wszystkich narzędzi naraz.

Dowiązanie, nie kopia. Na dysku zostaje jeden katalog z jednym `SKILL.md`,
pozostałe korzenie dostają do niego drzwi. Nie ma dwóch wersji, więc nie ma
dryfu, nie ma "która wygrywa" i nie ma czego synchronizować. Junction na
Windowsie, bo nie wymaga uprawnień administratora ani trybu dewelopera;
symlink na uniksach.

## Co powstało

| Plik | Co robi |
|---|---|
| `frontend/src-tauri/src/skills.rs` | dwie komendy: `skills_scan`, `skills_link_all`, plus cztery testy |
| `frontend/src-tauri/src/lib.rs` | pierwszy `invoke_handler` w projekcie |
| `frontend/lib/skills.ts` | wywołania i `summarise()`, czyli skan zamieniony na cztery liczby |
| `frontend/app/(shell)/settings/page.tsx` | `SkillsSection` |
| `frontend/components/icons.tsx` | `IconSkills` |
| `i18n/pl.json`, `i18n/en.json` | sekcja `settings.skills*` |

Backend, baza i MCP: zero zmian. Nowa trasa: żadna.

## Zasady, które trzymają to bezpiecznie

Moduł jest **wyłącznie addytywny**. Zakłada dowiązania i nic poza tym.

- **Nigdy nie kasuje.** `fs::remove_dir_all` na junctionie przechodzi przez niego
  i czyści zawartość celu, więc naiwne "przestań udostępniać" w `.codex`
  skasowałoby oryginał w `.agents`. W tym module nie ma funkcji usuwającej w
  ogóle. Nadmiarowe dowiązania zdejmuje się ręcznie przez `rmdir` (bez `/S`).
- **Nigdy nie nadpisuje.** Nazwa zajęta w korzeniu docelowym jest pomijana.
- **Nigdy nie przenosi.** Skill zostaje tam, gdzie leży.
- **Nazwa katalogu przechodzi przez `linkable_name`** zanim trafi do
  `cmd /C mklink`. Nie chodzi o wrogiego użytkownika, tylko o to, że `cmd.exe`
  re-parsuje własną linię poleceń i cudzysłowanie Rusta tego nie przeżywa.
- `CREATE_NO_WINDOW` na procesie potomnym, inaczej przy każdym z kilkudziesięciu
  dowiązań mignie czarne okno konsoli.

## Rozważone i odrzucone

**Narzędzie MCP `get_skills`.** Skill to katalog z bundlem, nie tekst: `SKILL.md`
odwołuje się do `scripts/` i `references/` ścieżkami, których na dysku agenta by
nie było. Do tego znika progressive disclosure, odkrywanie skilli jest katalogowe
więc coś musiałoby agentowi kazać zawołać to narzędzie, a backend stoi na
Renderze usypiającym po 15 minutach. Wraca do rozważenia, gdy pojawi się drugi
komputer albo drugi człowiek, i wtedy jako `install_skill` (kanał dystrybucji),
nie `get_skills` (serwowanie treści do kontekstu).

**Osobna zakładka z listą i formularzem tworzenia.** 3,5 dnia na GUI do jednej
linii `mklink /J`, w aplikacji, która wg PRODUCT.md trzyma "dlaczego" projektu, a
nie pliki. Ustawienia trzymają już rzeczy należące do maszyny: tokeny, klucz,
język.

**Przycisk osobno na narzędzie**, z obawy że dorzucenie 44 skilli do Claude
kosztuje tokeny w każdej sesji i rozmywa trafność triggerowania. Obawa
przesadzona: klaster skilli o designie, który miał się rozmywać, i tak był już w
całości w `.claude/skills`. Wrócić, jeśli wybór skilla zacznie realnie chybiać.

## Odłożone

- Tworzenie skilla z aplikacji. Formularz na dwa pola, gdy okaże się potrzebny.
- Usuwanie i zdejmowanie pojedynczych dowiązań. Wymaga kasowania, patrz zasady.
- Rozstrzyganie konfliktu nazw z UI. Dziś raportowany, rozstrzyga człowiek.
- Naprawa zepsutych dowiązań. Liczone i pokazywane, nie ruszane.
- Skille projektowe (`<repo>/.claude/skills`) i skille z pluginów.

## Do sprawdzenia ręcznie

1. Otworzyć ustawienia w oknie aplikacji (`npm run tauri dev`), zjechać na dół.
   Liczby mają się zgadzać z `dir /AL` po trzech korzeniach.
2. Kliknąć przycisk, potwierdzić toast, zrestartować Codeksa i sprawdzić, czy
   widzi skille, których wcześniej nie miał.
3. Porównać zawartość `~/.agents/skills` przed i po. Ma być identyczna.
