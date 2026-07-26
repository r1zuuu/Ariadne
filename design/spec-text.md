Specyfikacja projektowa / Design specification

# Ariadne

Warstwa pamieci dla agentow piszacych kod. Aplikacja desktopowa, okno od 1024 px. Ten dokument jest kompletem wartosci do implementacji: tokeny, komponenty, osiem ekranow ze stanami i tekstami, sygnatura, DESIGN.md.

Register
product
Osobowosc
przypisane &middot; rozwazne &middot; ciche
Motyw
jasny wszedzie, ciemne wylacznie plotno grafu, bez przelacznika
Kroje
Literata (proza, tytuly) &middot; Martian Mono (dane, etykiety, liczby)

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│   ┌────────────────────────   ────────────────────────┐   │
│   │                                                   │   │
│   │   ┌───────────────────────────────────────────┐   │   │
│   │   │                                           │   │   │
│   │   │   ┌────────────────   ────────────────┐   │   │   │
│   │   │   │                                   │   │   │   │
│   │   │   │   ┌───────────────────────────┐   │   │   │   │
│   │   │   │   │                           │   │   │   │   │
│   │   │   │   │   ┌────────   ────────┐   │   │   │   │   │
│   │   │   │   │   │                   │   │   │   │   │   │
│   │   │   │   │   │   ┌───────────┐   │   │   │   │   │   │
│   │   │   │   │   │   │           │   │   │   │   │   │   │
│   │   │   │   │   │   │           │   │   │   │   │   │   │
│   │   │   │   │   │   │     ●     │   │   │   │   │   │   │
│   │   │   │   │   │   │     │     │   │   │   │   │   │   │
│   │   │   │   │   │   │     │     │   │   │   │   │   │   │
│   │   │   │   │   │   └──── │ ────┘   │   │   │   │   │   │
│   │   │   │   │   │         │         │   │   │   │   │   │
│   │   │   │   │   └───────────────────┘   │   │   │   │   │
│   │   │   │   │             │             │   │   │   │   │
│   │   │   │   └──────────── │ ────────────┘   │   │   │   │
│   │   │   │                 │                 │   │   │   │
│   │   │   └───────────────────────────────────┘   │   │   │
│   │   │                     │                     │   │   │
│   │   └──────────────────── │ ────────────────────┘   │   │
│   │                         │                         │   │
│   └───────────────────────────────────────────────────┘   │
│                             │                             │
└──────────────────────────── │ ────────────────────────────┘
```

Plansza wejscia. Labirynt kretenski rysowany jedna linia, nic wychodzi na dol.
Wariant z portretem rzezby wymaga zrodlowego zdjecia, patrz sekcja 8.

01

## Audyt

14 pozycji &middot; 4 decyzje podwazone

Cztery pozycje uwazam za bledne decyzje, nie za braki. Reszta to dziury, ktore w projekcie musialem czyms zalatac, i te zalatania sa oznaczone w sekcjach ekranow.

A1Sprzecznosc: onboarding kontra terminal

Krok 3 kaze otworzyc terminal osobie, dla ktorej zabito zmienna srodowiskowa. Jedno polecenie to ulepszenie dla wlasciciela i zero dla drugiej persony. Rozwiazane: krok 3 jest jawnie pomijalny, nie zmniejszonym linkiem, a stan bez agenta jest pelnoprawny.

A2Bledna decyzja: brak GET dla wpisow

API ma confirm i archive, nie ma czytania. Piec z osmiu ekranow zyje z listy i wyszukiwania. Projektuje na zalozeniu: GET /projects/:id/nodes z filtrem statusu, typu, pliku i kursorem, oraz POST /search zwracajacym similarity. Filtrowanie i sortowanie po stronie serwera, bo 40 pozycji w kolejce to nie gorna granica.

A3Bledna decyzja: contradicted bez producenta

Status istnieje w modelu, nic go nie nadaje i nic nie mowi, co odwolalo wpis. W zakresie: POST /nodes/:id/contradict z polem supersededBy. Kazdy wpis odwolany pokazuje nic do wpisu, ktory go odwolal, i bez tego odnosnika status jest nieczytelny.

A4Bledna decyzja: czlowiek nie edytuje wpisu

Poprawa literowki przez prosbe do modelu jest absurdem. W zakresie: PUT /nodes/:id i edycja w miejscu w czytniku. Bez historii wersji, bo jej nie wybrales, ale data modyfikacji i kanal edycji sa widoczne.

A5Bledna decyzja: graf jako trzeci panel

Ciemne plotno wstawione obok jasnej karty i jasnej listy wyglada jak wklejony widget, a graf calego projektu traci sens okolo 150 wierzcholkow. W projekcie graf to tryb pelnoekranowy wolany z karty, zawsze z zakresem: sasiedztwo wpisu, jeden plik, albo ostatnie 60 wpisow.

A6Ochra nie dojdzie do 4.5:1

Szafran na chlodnym tynku musi zejsc do palonej ochry, zeby uniesc tekst. Nasycony pigment zyje tylko na znaczniku, gdzie wystarcza 3:1. Wartosci w sekcji 03.

A7Mono na tytulach kontra zakaz przebrania

Martian Mono na tytulach plus kapitaliki w etykietach oddaja wiekszosc powierzchni jednej grubosci, co jest najkrotsza droga do terminalowego kostiumu, a polskie naglowki w mono sa nadmiernie szerokie. Zamienione: Literata prowadzi, mono trzyma dane.

A8Offline jest nieprawda

Embeddingi i model rozbijajacy tekst to siec. Lokalne fonty to nie offline. Rozdzielone na trzy rozne awarie: serwer nie wstal, brak sieci, klucz modelu odrzucony. Kazda ma inny komunikat i inny zakres blokady, patrz ekran 03 i 08.

A9Kolejke wolno olewac, ale nie bezkarnie

Jesli proposed wazy w szukaniu tyle samo co confirmed, ignorowanie kolejki psuje baze. Wybrales oznaczanie: wpis nieoceniony ma znacznik i etykiete rowniez w wynikach i w cytowaniach asystenta.

A10Braki poza zakresem

Historia wersji, wspoldzielenie bazy miedzy kontami, konflikt rownoleglej edycji czlowieka i agenta, karta projektu bez repo_ref, koszt tokenow modelu. Terminy powrotu w sekcji 08.

02

## Nawigacja, trzy warianty

rekomendacja: 2c

2aKolumna dwupoziomowa

ARIADNE

ariadne-core

— □ ×

Globalne w kolumnie (projekty, kolejka, ustawienia), ekrany projektu jako zakladki w tresci. Zawsze wiadomo, gdzie jestes. Koszt: dwa paski nawigacji nad soba i 74 px zjedzone na stale przy oknie 1024.

2bPasek tytulu jako nawigacja

ARIADNE

ariadne-core ▾

— □ ×

Pelna szerokosc dla tresci, przelacznik projektu wbudowany w pasek okna. Najlepsze dla czytania wpisow. Koszt: kolejka i ustawienia znikaja z pola widzenia, licznik oczekujacych musi walczyc o miejsce w pasku zakladek.

2cKolumna zwijana plus paleta

ARIADNE

ariadne-core ▾

⌘K

— □ ×

zapytaj bazy_

Rekomendacja. Kolumna 200 px z etykietami, zwijana do 56 px skrotem albo automatycznie ponizej 1180 px szerokosci okna. Paleta na Cmd K robi to samo plus szukanie po wpisach. Cztery akcje z planu ekranu glownego zyja w palecie, nie jako przyciski.

Co widac zawsze

Kolumna: przelacznik projektu, cztery pozycje projektu (Przeglad, Wpisy, Asystent, Baza), Do zatwierdzenia z licznikiem, Ustawienia na dole. Wszystko ponizej przelacznika jest zalezne od projektu i przy braku wybranego projektu kolumna pokazuje tylko Projekty, Do zatwierdzenia i Ustawienia. Graf nie jest pozycja w kolumnie, bo jest trybem, nie miejscem.

03

## Tokeny

### Kolor

Kontrast liczony wzorem WCAG 2.x wobec tla, na ktorym token faktycznie leci: --plaster dla wszystkiego poza grafem, --canvas dla grafu. Zaden neutralny odcien nie jest czysty, kazdy ma 0.008 do 0.020 chromy w strone akcentu.

Token
OKLCH
Kontrast
Uzycie

--plaster

0.968 0.008 240

tlo

Tynk wapienny. Tlo aplikacji, jedno, bez wyjatkow.

--plaster-raised

0.985 0.005 240

1.06:1

Powierzchnia czytania: czytnik wpisu, paleta, pola formularzy.

--plaster-sunk

0.941 0.010 240

1.06:1

Kolumna nawigacji, pasek tytulu, hover wiersza, blok danych.

--ink

0.260 0.020 250

14.2:1

Proza wpisow, tytuly, wartosci w metryczkach.

--ink-2

0.450 0.020 250

6.8:1

Tekst drugorzedny, zajawki, opisy pol.

--ink-3

0.530 0.015 250

4.8:1

Etykiety monospace, daty, sciezki. Dolna granica dla tekstu.

--edge

0.620 0.015 250

3.3:1

Obramowania elementow interaktywnych. Minimum 3:1 wymuszone przez WCAG 2.2.

--hairline

0.860 0.010 250

1.4:1

Wlosowa linia miedzy rzedami. Dekoracja, nigdy nie niesie znaczenia.

--blue

0.470 0.120 253

6.0:1

Blekit egipski. Akcent, nic, status confirmed, focus.

--blue-lift

0.720 0.120 250

6.0:1 na canvas

Ten sam pigment podniesiony dla ciemnego plotna grafu. Nie wolno go uzyc na tynku (2.2:1).

--ochre

0.520 0.105 78

4.9:1

Ochra palona. Tekst i etykieta statusu proposed.

--ochre-mark

0.630 0.130 78

3.2:1

Szafran. Wylacznie znacznik i wypelnienie wierzcholka, nigdy tekst.

--iron

0.505 0.150 27

5.9:1

Czerwien zelazowa. Status contradicted, usuniecia w diffie, bledy pol.

--slate

0.500 0.012 250

5.5:1

Status archived. Jedyny status bez chromy, bo nieaktualnosc to brak barwy.

--canvas

0.220 0.020 250

tlo grafu

Plotno grafu i nic tylko tam. Nie jest drugim motywem, nie ma przelacznika.

--canvas-ink

0.930 0.010 240

15.8:1 na canvas

Etykiety wierzcholkow i tekst panelu w grafie.

#### Cztery statusy, cztery ksztalty

Znacznik 10 px, zawsze z napisem, zawsze rozny ksztaltem. Test: wydrukuj w skali szarosci i rozpoznaj kazdy.

POTWIERDZONY
pelny kwadrat, blekit

PROPONOWANY
pusty romb, ochra

ODWOLANY
kwadrat przekreslony, czerwien

ZARCHIWIZOWANY
plaska belka, szarosc

#### Krawedzie grafu

Dwa zrodla krawedzi musza sie roznic znaczeniowo, wiec roznia sie ksztaltem linii, nie tylko barwa.

WSPOLNY PLIK
1 px ciagla

PODOBIENSTWO > 0.75
1 px kreskowana

ODWOLUJE
1 px ze strzalka

### Typografia

Stosunek 1.26 miedzy stopniami, siedem stopni, dwa kroje, cztery grubosci razem. Proza zawsze 17 px w kolumnie 68 znakow, bo wpis do 4000 znakow to normalny przypadek czytania.

--text-display

43 / 49 / 600
Literata, -0.01em

Ariadne

--text-title

34 / 41 / 600
Literata

Do zatwierdzenia

--text-section

27 / 34 / 600
Literata

Ostatnie wpisy

--text-lead

21 / 32 / 500
Literata

Pierwsze zdanie wpisu jako naglowek wiersza

--text-body

17 / 28 / 400
Literata, 68ch

Odrzucilismy kolejke zadan w Postgresie, bo jedna instancja Tauri nie potrzebuje brokera, a kazda dodatkowa usluga to kolejny proces do wystartowania przy uruchomieniu aplikacji.

--text-small

15 / 25 / 400
Literata

Zajawka, opis pola, tekst pomocniczy pod formularzem.

--text-data

13 / 20 / 400
Martian Mono

src/graph/edges.ts 2026-07-19 14:02 0.82

--text-label

11 / 16 / 500
Martian Mono, 0.12em, caps

Repozytorium &middot; Etap &middot; Ograniczenia

Etykieta monospace ma twardy limit 24 znakow. Dluzsza etykieta w kapitalikach z rozstrzeleniem lamie sie na dwie linie i przestaje byc etykieta, wiec wtedy idzie do --text-small bez kapitalikow. Cyfry w mono zawsze tabular-nums, bo liczniki kolejki zmieniaja sie na oczach.

### Odstepy

Siatka 4 px, dziesiec stopni. Uzasadnienie liczby stopni: aplikacja ma trzy rozne gestosci na raz i kazda potrzebuje pary wartosci (wewnetrzna i miedzy elementami), do tego dwa stopnie skrajne, ktorych zaden uklad nie dzieli.

space-12 px &middot; przesuniecie znacznika do linii bazowej

space-24 px &middot; znacznik do etykiety statusu

space-38 px &middot; wnetrze wiersza listy (gestosc danych)

space-412 px &middot; miedzy wierszami, wnetrze pola formularza

space-516 px &middot; wnetrze panelu (gestosc formularza)

space-624 px &middot; miedzy grupami pol, wnetrze czytnika

space-732 px &middot; miedzy sekcjami ekranu (gestosc czytania)

space-848 px &middot; margines tresci ekranu

space-972 px &middot; oddech nad naglowkiem ekranu

space-10112 px &middot; plansza wejscia i pusta baza, tylko tam

Zakaz: space-5 jako domyslny wszedzie. Wiersz listy nigdy nie dostaje odstepu panelu, panel nigdy nie dostaje odstepu wiersza.

### Promienie i krawedzie

radius-00 px. Domyslnie wszystko: panele, wiersze, plansze, graf.

radius-12 px. Wylacznie to, co sie klika albo w co sie pisze: przyciski, pola, chipy filtrow.

radius-fullNie istnieje. Zaden token nie daje pigulki ani kolka.

Cienie: dokladnie jeden, 0 8px 24px oklch(0.26 0.02 250 / 0.14), tylko dla paletty polecen i menu kontekstowego, czyli dla rzeczy naprawde unoszacych sie nad ekranem. Karty nie maja cieni, maja krawedz.

### Ruch

dur-state120 ms, cubic-bezier(0.22,1,0.36,1). Hover, focus, zmiana statusu.

dur-enter200 ms, ta sama krzywa. Pojawienie sie palety, czytnika, panelu grafu. Tylko krycie.

dur-thread420 ms, cubic-bezier(0.16,1,0.3,1). Jedyna choreografia w aplikacji, rysowanie nici.

Nie animujemy wlasciwosci ukladu: zero height, width, top. Dozwolone: opacity, color, background, transform: scaleX dla nici. Zero odbicia, zero sprezystosci, zero opoznien kaskadowych.

Przy prefers-reduced-motion: reduce wszystkie trzy tokeny ida na 0 ms. Nic nie znika, pojawia sie w pelnej dlugosci.

04

## Inwentarz komponentow

14 komponentow

Button

Warianty: primary (blekit, tekst --plaster-raised), secondary (krawedz --edge), quiet (tylko tekst), destructive (krawedz i tekst --iron). Wysokosc 34 px, padding 8 / 16, radius-1, tekst 15 px Literata 500.

Potwierdz
Odrzuc
Pokaz graf
Zarchiwizuj
Wylaczony
Focus

Focus: outline 2px --blue, offset 2px. Na blekitnym tle przycisku offset daje jasny przeswit tynku, wiec pierscien jest widoczny na kazdym tle, na ktorym moze wyladowac. Wylaczony nie ma stanu hover i nie wchodzi w kolejnosc Tab.

Field

Etykieta w mono kapitalikami nad polem, wartosc 17 px Literata. Bez pudelka w ukladzie karty akcesyjnej (ekran 01, 02b), z pudelkiem w formularzach wewnatrz aplikacji. Blad zawsze tekstem pod polem, nigdy samym kolorem krawedzi.

Nazwa projektu

Repozytorium

Adres serwera

!Nie odpowiada. Sprawdz, czy serwer Ariadne jest uruchomiony.

NodeRow

Jeden wiersz na wpis, wysokosc 44 px, siatka 18px 1fr max-content max-content 74px: znacznik, pierwsze zdanie, pliki, typ, data. Hover podklada --plaster-sunk, klik otwiera czytnik. Stany: spoczynek, hover, focus (pierscien wewnetrzny), wybrany (nic po lewej krawedzi, 1 px), niepewny (znacznik ochra plus etykieta).

Kolejka zadan zostaje w SQLite, bez brokera
2 pliki
decision
19 lip

Embeddingi licza sie lokalnie, dopoki model zmiesci sie w pamieci NIEOCENIONY
1 plik
note
21 lip

Tokeny trzymamy w keychainie systemowym ODWOLANY PRZEZ #418
3 pliki
decision
03 lip

Pierwsza wersja schematu bazy, przed rozbiciem anchors
—
session
28 cze

Provenance

Metryczka wpisu. Zawsze te same pola w tej samej kolejnosci, bo to podpis pod eksponatem: kanal, sesja, commit, pliki, daty. Warianty: inline (pod pierwszym zdaniem w czytniku), compact (jedna linia w cytowaniu), full (blok w czytniku). Brak wartosci to —, nigdy puste miejsce.

Kanalcoder
Sesjas_9f2c &middot; 19 lip 2026, 14:02
Commita41f0c8
Pliki

src/queue/worker.ts :: processTask
migrations/0004_queue.sql

Zmieniony21 lip 2026, 09:40 &middot; app_form

Citation

Wtracenie w tekscie: liczba w mono 13 px, blekit, podniesiona o 2 px, pole klikalne 24 px. Klik rozwija metryczke pod akapitem, nie nad, i nie przewija tekstu. Stany: spoczynek, hover (podkreslenie), rozwinieta (nic laczy liczbe z rozwinieciem), wpis nieoceniony (liczba w ochrze plus znacznik rombu).

Kolejka zadan zostaje w SQLite, bez zewnetrznego brokera1, a limit rownoleglosci ustawiono na cztery zadania, co bylo mierzone na twoim laptopie2 ◇.

POTWIERDZONY
decision &middot; coder &middot; 19 lip 2026

Broker to kolejny proces do wystartowania razem z aplikacja, a jedna instancja Tauri go nie potrzebuje.

src/queue/worker.tsmigrations/0004_queue.sql

DiffPair

Dwie kolumny, zapisane po lewej, proponowane po prawej, po 46 znakow przy oknie 1024 i po 62 powyzej 1280. Usuniete w czerwieni zelazowej przekreslone, dodane w blekicie podkreslone 1 px. Ponizej 1024 kolumny ida jedna pod druga z etykietami. Warianty: edit, delete (prawa kolumna to pusta plyta z napisem, nie czerwona plama).

Zapisane &middot; 19 lip

Limit rownoleglosci kolejki to osiem zadan, ustawiony na oko.

Proponowane &middot; app_chat

Limit rownoleglosci kolejki to cztery zadania, zmierzony na laptopie wlasciciela.

Poprosil: kanal app_chat, 21 lip 09:38
Odrzuc
Zatwierdz zmiane

Zasada opisu. Naglowek kolumny zawsze mowi wprost, co w niej jest i skad to jest: Zapisane, 19 lip oraz Proponowane, app_chat. Nigdy same slowa przed i po, bo czlowiek ma wiedziec, ktora wersja jest w bazie teraz.

StatusChip

Znacznik plus napis, nigdy sam kolor i nigdy sam znacznik. Wysokosc 20 px, odstep znacznik do napisu 4 px. Wariant with-reason dodaje po napisie powod jednym zdaniem, bo status bez powodu jest domyslaniem sie: przy odwolanym numer wpisu, ktory go odwolal, przy nieocenionym data zapisu i kanal.

POTWIERDZONYprzez ciebie, 20 lip. Agent traktuje jako pewnik.
NIEOCENIONYzapisal agent, 21 lip. Czeka na twoja ocene.
ODWOLANYprzez wpis 418 z 22 lip. Nie stosuj tej decyzji.
ZARCHIWIZOWANY28 cze. Nie wychodzi w wyszukiwaniu, zostaje w bazie.

Reader

Panel czytania wpisu, otwiera sie po kliknieciu wiersza w prawej czesci ekranu, szerokosc tekstu twardo 68 znakow. Kolejnosc: status z powodem, pelna tresc, metryczka, dzialania. Edycja w miejscu: klik w tresc zamienia akapit w pole, bez modalu. Stany: czytanie, edycja, zapisywanie (przyciski wylaczone, napis Zapisuje), konflikt (agent zmienil wpis w trakcie, dwie wersje w DiffPair).

NIEOCENIONY&middot; zapisal agent 21 lip, czeka na twoja ocene

Embeddingi licza sie lokalnie, dopoki model zmiesci sie w pamieci. Powod: klucz do modelu jest opcjonalny, wiec aplikacja musi umiec szukac po znaczeniu bez niego, choc wolniej i na krotszym kontekscie.

Potwierdz
Popraw tresc
Zarchiwizuj
Wpis 417

CommandPalette

Wolana Cmd K lub Ctrl K. Szerokosc 560 px, 32 px od gory okna, jedyny element z cieniem. Dwie funkcje w jednym polu: polecenia i szukanie po wpisach. Kazda pozycja ma napis mowiacy, co sie stanie, i po prawej miejsce, do ktorego przenosi. Stany: puste pole (ostatnie cztery uzyte polecenia), pisanie, brak wynikow, szukanie w toku (napis Szukam po znaczeniu).

>kolejk

Otworz kolejke do zatwierdzenia6 oczekuje

Zatwierdz wszystkie zadania od agentawymaga potwierdzenia

Wpis: kolejka zadan zostaje w SQLite0.91 &middot; decision

TitleBar

Wlasny pasek okna, wysokosc 38 px, tlo --plaster-sunk, dolna krawedz 1 px --hairline. Po lewej nazwa aplikacji i nazwa otwartego projektu, po prawej stan polaczenia z serwerem napisany slowami i kontrolki okna. Kontrolki po stronie systemowej: na macOS po lewej, na Windows po prawej, reszta paska sie do tego dostosowuje. Cala wolna powierzchnia jest obszarem przeciagania.

ARIADNE

ariadne-core
Serwer odpowiada
— □ ×

Stan polaczenia ma trzy napisy, nigdy tylko kropke: Serwer odpowiada, Serwer nie odpowiada, Brak sieci, szukanie po znaczeniu niedostepne.

Banner

Pasek komunikatu pod paskiem tytulu, pelna szerokosc, 1 px krawedz w barwie roli. Zawsze trzy czesci w tej samej kolejnosci: co sie stalo, co to znaczy dla ciebie, przycisk z jedna czynnoscia. Bez ikony ostrzegawczej i bez slowa ups. Warianty: error (serwer, sesja), notice (klucz modelu, tryb ograniczony), done (token wygenerowany).

SESJA
Twoja sesja wygasla po 24 godzinach. Wpisy sa bezpieczne, trzeba sie zalogowac ponownie.
Zaloguj sie

TRYB OGRANICZONY
Nie ma klucza do modelu, wiec asystent nie odpowiada. Lista wpisow, kolejka i graf dzialaja normalnie.
Dodaj klucz

GraphCanvas

Tryb pelnoekranowy, tlo --canvas, wolany przyciskiem z widoku projektu i zamykany klawiszem Esc. Zawsze ma ustawiony zakres i napisane, jaki: sasiedztwo wybranego wpisu, jeden plik, albo ostatnie 60 wpisow. Wierzcholek to kwadrat 10 px w barwie statusu, etykieta to pierwsze cztery slowa wpisu, maksymalnie trzy krawedzie na wierzcholek. Stany: liczenie ukladu (napis Ukladam graf), gotowy, wierzcholek wybrany (panel po prawej z pelna trescia), zakres pusty.

ZAKRES: SASIEDZTWO WPISU 417 &middot; 12 WIERZCHOLKOW

kolejka w SQLite

embeddingi lokalnie

WYBRANY WPIS

Kolejka zadan zostaje w SQLite, bez brokera.

decision &middot; 19 lip
2 pliki wspolne z sasiadem

EmptyPlate

Stan pusty jako plyta z napisem, nie obrazek i nie zachecanie. Zawsze dwa zdania i najwyzej jeden przycisk: pierwsze zdanie mowi, czego nie ma i dlaczego, drugie mowi, co sie stanie samo albo co zrobic. Odstep od gory space-10 (112 px), tekst wyrownany do lewej krawedzi tresci, nigdy do srodka.

Baza pusta

Ten projekt nie ma jeszcze zadnego wpisu, bo agent nie prowadzil w nim sesji, a ty nic nie zapisales. Pierwsze wpisy pojawia sie tutaj same po zakonczeniu sesji agenta.

Zapisz pierwszy wpis sam

ProjectRow

Wiersz projektu na ekranie glownym, wysokosc 56 px. Siatka: nazwa, repozytorium w mono, etap, liczba wpisow, liczba oczekujacych, data ostatniej sesji. Liczba oczekujacych zawsze z rzeczownikiem (6 oczekuje), nigdy naga liczba w kolku. Stany: spoczynek, hover, focus, wybrany, projekt bez repozytorium (napis bez repozytorium zamiast pustego miejsca).

ariadne-core
github.com/kacper/ariadne
prototyp
418 wpisow
6 oczekuje

remont-mieszkania
bez repozytorium
utrzymanie
12 wpisow
nic nie czeka

CommandBlock

Jedyne miejsce w calej aplikacji z ciemnym tlem poza grafem: blok z poleceniem do terminala w kroku 3 onboardingu. Tlo --canvas, tekst --canvas-ink 14 px, zawijanie z widocznym znakiem kontynuacji. Nad blokiem zdanie mowiace, co to polecenie robi, pod blokiem zdanie mowiace, gdzie je wkleic. Token wstawiony w tresc, widoczny raz. Stany przycisku: Kopiuj polecenie, Skopiowane (napis wraca po 4 s), Kopiowanie niedostepne (zaznacz recznie).

To polecenie dopisuje Ariadne do Claude Code jako zrodlo pamieci. Token jest w nim wklejony, nie trafia do repozytorium.

```
claude mcp add --scope user --transport http ariadne http://localhost:3000/mcp --header "Authorization: Bearer ar_9f2c41…"
```

Kopiuj

Wklej to w terminalu i nacisnij Enter. Jesli nie uzywasz terminala, pomin ten krok, aplikacja dziala bez agenta.

QueueItem

Pozycja kolejki do zatwierdzenia. Zwinieta pokazuje rodzaj zadania nazwany po ludzku (Zmiana tresci, Usuniecie wpisu), pierwsze zdanie wpisu, kto poprosil i kiedy. Rozwinieta pokazuje DiffPair. Warianty: edit, delete, unreviewed-node (wpis nieoceniony, bez diffa, tylko tresc i dwa przyciski). Stany: zwinieta, rozwinieta, wybrana do zbiorczego dzialania, przetwarzana, zakonczona (wiersz zostaje 3 s z napisem Zatwierdzone i cofnieciem).

Zmiana tresci
Limit rownoleglosci kolejki to osiem zadan
poprosil agent &middot; 21 lip

Usuniecie wpisu
Tokeny trzymamy w keychainie systemowym
poprosil asystent &middot; 22 lip

ThreadLink

Nic: linia 1 px w blekicie egipskim. Wolno jej wystapic tylko tam, gdzie dwie rzeczy naprawde sa powiazane: wskaznik postepu onboardingu, polaczenie wpisow dzielacych plik, krawedz grafu, oraz linia od cytowania do rozwinietego zrodla. Nigdy jako obramowanie, separator wiersza ani ozdoba naglowka. Rozdzielnik tresci to zawsze --hairline, nie blekit.

Krok 2 z 3, nic narysowana do miejsca, w ktorym jestes

WSPOLNY PLIK

src/queue/worker.ts

05

## Osiem ekranow

nawigacja 2c &middot; okno od 1024 px

Szkice sa w skali znakow, nie pikseli. SIDE to kolumna nawigacji 200 px, BAR to wlasny pasek tytulu 38 px. Kolejnosc czytania jest numerowana i jest zarazem kolejnoscia Tab.

01

### Logowanie i rejestracja

Wpuscic wlasciciela do wlasnej bazy w dwoch polach, bez opowiadania mu, czym jest produkt.

```
┌─BAR──────────────────────────────────────────────────────┐
│ ARIADNE                                          — □ ×  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── plansza ASCII ───┐   WEJSCIE DO BAZY                │
│  │ labirynt, jedna    │   ─────────────────────────────  │
│  │ linia, blekit,     │   ADRES         you@domena.pl    │
│  │ nic wychodzi w dol │   ─────────────────────────────  │
│  │                    │   HASLO         ••••••••         │
│  │                    │   ─────────────────────────────  │
│  └────────────────────┘   [ Wejdz ]   Nie mam konta      │
│                           ─────────────────────────────  │
│                           [ Zaloguj przez Google ]       │
│                           Serwer localhost:3000 odpowiada│
└──────────────────────────────────────────────────────────┘
```

Kolejnosc czytania

Naglowek Wejscie do bazy, 27 px. Mowi, co to za okno, bez slowa witaj.

Rzedy karty akcesyjnej: etykieta w mono po lewej, pole po prawej, wlosowa linia miedzy nimi. Zero pudelka, zero wysrodkowanej karty.

Przycisk glowny i obok niego, nie pod nim, przejscie do rejestracji.

Pod wlosowa linia logowanie przez Google jako druga, rownorzedna droga: przycisk wariantu secondary, bez kolorowego logo dostawcy w wypelnieniu, tylko znak 16 px w krawedzi. Nad nim nie ma slowa albo, jest linia i tyle.

Stan serwera napisany slowami na dole, zawsze widoczny.

Stany

Ladowanie: przycisk mowi Sprawdzam i jest wylaczony, pola zostaja czytelne.

Blad danych: jedno zdanie pod polem hasla, w czerwieni zelazowej, mowiace co zrobic, nie co jest zle.

Serwer nie odpowiada: przycisk wylaczony, banner z adresem serwera i przyciskiem Sprobuj ponownie.

Rejestracja: ten sam uklad, trzeci rzad Powtorz haslo, po wyslaniu przejscie prosto do onboardingu, bez ekranu potwierdzenia.

Element
Polski
English

title
Wejscie do bazy
Entry to the base

submit
Wejdz
Enter

switchToRegister
Nie mam konta
I do not have an account

google
Zaloguj przez Google
Sign in with Google

google.note
Konto Google zaklada nowe konto Ariadne przy pierwszym wejsciu. Kazde konto ma wlasne projekty i wlasna baze.
A Google account creates a new Ariadne account on first entry. Every account has its own projects and its own base.

error.credentials
Ten adres i haslo nie pasuja do siebie. Sprawdz haslo albo zaloz konto.
This address and password do not match. Check the password or create an account.

error.server
Serwer Ariadne na localhost:3000 nie odpowiada. Uruchom go i sprobuj ponownie.
The Ariadne server at localhost:3000 is not responding. Start it and try again.

02

### Onboarding, trzy kroki

Zebrac profil, zalozyc pierwszy projekt, podlaczyc agenta, i zejsc z drogi.

```
┌─BAR──────────────────────────────────────────────────────┐
├──────────────────────────────────────────────────────────┤
│  ■━━━━━━━━━━━━━━■──────────────□                         │
│  PROFIL          PROJEKT        AGENT                    │
│  krok 2 z 3                                              │
│                                                          │
│  Pierwszy projekt                                        │
│  ────────────────────────────────────────────────────    │
│  NAZWA          [ ariadne-core                       ]   │
│  REPOZYTORIUM   [ github.com/kacper/ariadne          ]   │
│                 mozesz zostawic puste                    │
│  STACK          [ Tauri 2, Next.js, Tailwind v4      ]   │
│  ETAP           ( ) prototyp ( ) produkcja ( ) utrzym.   │
│  OGRANICZENIA   [                                    ]   │
│  ────────────────────────────────────────────────────    │
│  [ Dalej ]   Wroc                          Pomin krok 3  │
└──────────────────────────────────────────────────────────┘
```

Kolejnosc czytania

Wskaznik postepu z nicia i napisem krok 2 z 3. Nic jest narysowana tylko do miejsca, w ktorym jestes.

Naglowek kroku, 27 px, rzeczownik, nie zachecanie.

Rzedy pol z etykietami w mono, kazde pole opcjonalne ma pod soba napisane wprost, ze mozna je zostawic puste.

Dzialania: Dalej, Wroc, i po prawej jawne Pomin krok 3 tej samej wielkosci co reszta.

Kroki

2a Profil: cztery pytania, jedno na ekranie, kazde z przykladowa odpowiedzia w polu jako podpowiedz. Na koncu gotowy tekst profilu w edytowalnym polu z napisem, ze agent dostanie go na starcie kazdej sesji.

2b Projekt: formularz wyzej. Tylko nazwa jest wymagana, i tak jest napisane przy polu.

2c Agent: wybor z listy (Claude Code, Codex, inne), CommandBlock z poleceniem i tokenem, jedno zdanie nad blokiem o tym, co polecenie robi, i jedno pod nim o tym, gdzie je wkleic.

Stany

Blad walidacji: tylko przy nazwie projektu, zdanie pod polem.

Token nie wygenerowal sie: blok pokazuje napis, ze polecenie bedzie gotowe po ponownej probie, i przycisk Wygeneruj token.

Pominiety krok 3: aplikacja startuje normalnie, w ustawieniach zostaje pozycja Podlacz agenta z tym samym blokiem.

Element
Polski
English

step.profile.title
Kim jestes przy pracy
How you work

step.profile.note
Ten tekst agent dostaje na starcie kazdej sesji. Mozesz go zmienic teraz i pozniej w ustawieniach.
The agent receives this text at the start of every session. You can edit it now and later in settings.

field.optional
mozesz zostawic puste
you can leave this empty

step.agent.what
To polecenie dopisuje Ariadne do twojego agenta jako zrodlo pamieci. Token jest w nim wklejony i nie trafia do repozytorium.
This command adds Ariadne to your agent as a memory source. The token is embedded in it and never touches your repository.

step.agent.where
Wklej to w terminalu i nacisnij Enter. Nie uzywasz terminala? Pomin ten krok, aplikacja dziala bez agenta.
Paste it in a terminal and press Enter. Not using a terminal? Skip this step, the app works without an agent.

step.agent.tokenOnce
Ten token widzisz teraz i nigdy wiecej. Zgubiony token zastepuje sie nowym w ustawieniach.
You see this token now and never again. A lost token is replaced with a new one in settings.

step.skip
Pomin krok 3
Skip step 3

03

### Ekran glowny, zmiany i projekty

Odpowiedziec na jedno pytanie po sesji kodowania: co agent zapisal, odkad tu nie bylem.

```
┌─BAR─────────────────────────────────── Serwer odpowiada ─┐
├─SIDE────────┬────────────────────────────────────────────┤
│ ARIADNE     │ Od 21 lip, 09:12                           │
│ [ariadne-c▾]│ ──────────────────────────────────────     │
│             │ ■ Kolejka zadan zostaje w SQL…  19l  agent │
│ Przeglad    │ ◇ Embeddingi licza sie lokal…   21l  agent │
│ Wpisy       │ ⊠ Tokeny w keychainie          22l  ty     │
│ Asystent    │ ◇ Limit rownoleglosci to cz…    22l  agent │
│ Baza        │ ── 14 wierszy bez przewijania ──           │
│ ──────────  │ [ Pokaz wszystkie 26 zmian ]               │
│ Do zatw. 6  │                                            │
│             │ Projekty                                   │
│ ──────────  │ ──────────────────────────────────────     │
│ Ustawienia  │ ariadne-core   418 wpisow   6 oczekuje     │
│ ⌘K          │ remont-mieszk.  12 wpisow   nic nie czeka  │
└─────────────┴────────────────────────────────────────────┘
```

Kolejnosc czytania

Naglowek z data ostatniego wejscia, dokladna: Od 21 lip, 09:12. Nie ostatnio, nie dzisiaj.

Wiersze zmian, najnowsze na gorze, kazdy ze znacznikiem statusu, pierwszym zdaniem, data i kanalem (agent albo ty).

Jeden przycisk do pelnej listy wpisow, z liczba i rzeczownikiem.

Lista projektow pod spodem, jako punkt startu, nie jako siatka kart.

Cztery akcje z planu

Nie sa przyciskami na tym ekranie. Wybierz projekt to przelacznik w kolumnie, Zapytaj asystenta i Rozmawiaj z baza to pozycje kolumny wewnatrz projektu, Do zatwierdzenia to pozycja z licznikiem. Wszystkie cztery sa tez w palecie na Cmd K.

Stany

Ladowanie: szkielet wierszy w --plaster-sunk, bez pulsowania, bez wirujacych kolek.

Nic sie nie zmienilo: jedno zdanie Od 21 lip nic sie nie zmienilo, pod nim od razu lista projektow.

Pusto po onboardingu: EmptyPlate mowiaca, ze pierwsze wpisy pojawia sie same po sesji agenta, plus przycisk zapisania wpisu recznie.

Serwer nie odpowiada: banner na gorze, lista pokazuje ostatnie znane dane z napisem dane z 21 lip 09:12, moga byc nieaktualne.

Przepelniony: ponad 14 zmian, lista sie urywa i przycisk pokazuje pelna liczbe, bez nieskonczonego przewijania.

Element
Polski
English

home.since
Od 21 lip, 09:12
Since 21 Jul, 09:12

home.nothing
Od 21 lip, 09:12 nic sie nie zmienilo. Agent nie prowadzil sesji.
Nothing has changed since 21 Jul, 09:12. The agent has not run a session.

home.showAll
Pokaz wszystkie 26 zmian
Show all 26 changes

home.stale
Dane z 21 lip, 09:12. Serwer nie odpowiada, wiec moga byc nieaktualne.
Data from 21 Jul, 09:12. The server is not responding, so it may be out of date.

04

### Widok projektu

Pokazac, czym ten projekt jest wedlug bazy, i wpuscic do wpisow oraz do grafu.

```
┌─BAR──────────────────────────────────────────────────────┐
├─SIDE────────┬────────────────────────────────────────────┤
│ [ariadne-c▾]│ ariadne-core            [ Pokaz graf ]     │
│             │ ──────────────────────────────────────     │
│ Przeglad  ◄ │ REPOZYTORIUM  github.com/kacper/ariadne    │
│ Wpisy       │ ETAP          prototyp                     │
│ Asystent    │ STACK         Tauri 2, Next.js, Tailwind   │
│ Baza        │ DLA KOGO      wlasciciel i osoba nietech.  │
│ ──────────  │ KONWENCJE     docs/CONVENTIONS.md          │
│ Do zatw. 6  │ OGRANICZENIA  offline, CSP, bez ikon z lib │
│             │ ──────────────────────────────────────     │
│ ──────────  │ Ostatnie wpisy                 6 oczekuje  │
│ Ustawienia  │ ■ Kolejka zadan zostaje…   2 pliki   19l   │
│ ⌘K          │ ◇ Embeddingi lokalnie…     1 plik    21l   │
│             │ [ Wszystkie 418 wpisow ]                   │
└─────────────┴────────────────────────────────────────────┘
```

Kolejnosc czytania

Nazwa projektu, 34 px, i obok niej jedyne dzialanie otwierajace graf.

Karta projektu jako rzedy etykieta plus wartosc, wlosowe linie miedzy rzedami. Klik w wartosc edytuje ja w miejscu, bez modalu, bez trybu edycji calej karty.

Ostatnie wpisy, szesc wierszy, po prawej licznik oczekujacych jako odnosnik do kolejki.

Przejscie do pelnej listy wpisow z konkretna liczba.

Graf

Nie jest trzecia kolumna na tym ekranie. Przycisk otwiera tryb pelnoekranowy na ciemnym plotnie, z zakresem wypisanym na gorze i wyjsciem przez Esc. Uzasadnienie w audycie, punkt A5.

Stany

Karta niepelna: puste pola pokazuja napis nie podano i sa klikalne. Nigdy pusty wiersz bez wyjasnienia.

Projekt bez wpisow: karta zostaje, lista zamienia sie w EmptyPlate, przycisk grafu wylaczony z napisem graf pojawi sie przy trzech wpisach.

Zapisywanie pola: wartosc zostaje widoczna, pod nia napis Zapisuje, po zapisie Zapisane 09:41 na 4 s.

Blad zapisu: wartosc wraca do poprzedniej, zdanie pod polem mowi, ze zmiana nie zostala zapisana i dlaczego.

Element
Polski
English

project.graph
Pokaz graf
Show graph

project.graphLocked
Graf pojawi sie, gdy projekt bedzie mial trzy wpisy
The graph appears once the project has three entries

field.empty
nie podano, kliknij aby dopisac
not provided, click to add

project.empty
Ten projekt nie ma zadnego wpisu. Pierwsze pojawia sie same po sesji agenta, mozesz tez zapisac wpis sam.
This project has no entries. The first ones appear on their own after an agent session, or you can write one yourself.

05

### Czat z asystentem

Odpowiedziec na pytanie o projekt i pokazac, z ktorych wpisow ta odpowiedz jest zlozona.

```
┌─BAR──────────────────────────────────────────────────────┐
├─SIDE────────┬────────────────────────────────────────────┤
│ [ariadne-c▾]│ Ty, 09:44                                  │
│             │ Dlaczego kolejka nie jest w Postgresie?    │
│ Przeglad    │                                            │
│ Wpisy       │ Asystent, 09:44                            │
│ Asystent  ◄ │ Kolejka zostaje w SQLite bez brokera[1],   │
│ Baza        │ a limit rownoleglosci to cztery[2 ◇].      │
│ ──────────  │   │ ■ POTWIERDZONY  decision coder 19 lip  │
│ Do zatw. 6  │   │ Broker to kolejny proces do wystar…    │
│             │   │ src/queue/worker.ts  0004_queue.sql    │
│ ──────────  │                                            │
│ Ustawienia  │ ──────────────────────────────────────     │
│ ⌘K          │ [ Zapytaj o ten projekt…            ][ → ] │
└─────────────┴────────────────────────────────────────────┘
```

Kolejnosc czytania

Twoje pytanie, oznaczone slowem Ty i godzina. Bez awatarow i baniek.

Odpowiedz, 17 px, kolumna 68 znakow, strumieniowana. Cytowania sa liczbami w mono w tekscie.

Klik w liczbe rozwija zrodlo pod akapitem: status z powodem, metryczka, pliki jako odnosniki. Nic 1 px laczy liczbe z rozwinieciem.

Pole pytania przypiete na dole, zawsze widoczne.

Zasady cytowan

Cytowanie z wpisu nieocenionego ma liczbe w ochrze i romb obok, a w rozwinieciu napis, ze wpis czeka na ocene. Odpowiedz nie udaje pewnosci, ktorej baza nie ma.

Cytowanie z wpisu odwolanego ma liczbe w czerwieni i napis, ktory wpis go odwolal, a asystent pisze o nim w czasie przeszlym.

Klik w plik otwiera liste wpisow przefiltrowana po tym pliku, nie edytor kodu.

Stany

Szuka: napis Szukam po znaczeniu w 418 wpisach, bez animowanych kropek.

Pisze: tekst pojawia sie strumieniem, cytowania doklejaja sie w miejscu, nie przeskakuja.

Brak wynikow: jedno zdanie, ze baza nie ma nic na ten temat, plus propozycja zapisania tego jako wpisu.

Brak klucza do modelu: pole wylaczone, banner trybu ograniczonego z przyciskiem do ustawien.

Przerwany strumien: odpowiedz zostaje ucieta z napisem, ze polaczenie zerwalo sie w trakcie, i przyciskiem Zapytaj ponownie.

Element
Polski
English

ask.placeholder
Zapytaj o ten projekt
Ask about this project

ask.searching
Szukam po znaczeniu w 418 wpisach
Searching 418 entries by meaning

ask.noResults
Baza nie ma nic na ten temat. Jesli wiesz odpowiedz, zapisz ja jako wpis, zeby agent ja znal.
The base has nothing on this. If you know the answer, save it as an entry so the agent knows it.

cite.unreviewed
Ten wpis czeka na twoja ocene, wiec traktuj go ostroznie.
This entry is awaiting your review, so treat it with care.

ask.interrupted
Polaczenie zerwalo sie w trakcie odpowiedzi. To, co widzisz, jest niepelne.
The connection dropped mid-answer. What you see is incomplete.

06

### Rozmowa z baza

Przyjac surowy tekst dowolnej jakosci i zamienic go we wpisy, pokazujac wprost, co zostanie dodane, zmienione i usuniete.

```
┌─BAR──────────────────────────────────────────────────────┐
├─SIDE────────┬────────────────────────────────────────────┤
│ [ariadne-c▾]│ Ty, 10:02                                  │
│             │ zmienilismy limit na 4 bo osiem zabijalo   │
│ Przeglad    │ laptopa, i keychain wypada                 │
│ Wpisy       │                                            │
│ Asystent    │ Z tego tekstu wychodza trzy operacje:      │
│ Baza      ◄ │ ──────────────────────────────────────     │
│ ──────────  │ DODAJ WPIS      Limit rownoleglosci…  [+]  │
│ Do zatw. 8  │ ZMIEN WPIS 412  osiem → cztery       [~]  │
│             │ USUN WPIS 388   Tokeny w keychainie  [!]  │
│ ──────────  │ ── dwie ostatnie czekaja w kolejce ──      │
│ Ustawienia  │ [ Wpisz surowy tekst…               ][ → ] │
└─────────────┴────────────────────────────────────────────┘
```

Kolejnosc czytania

Twoj surowy tekst zostaje widoczny w calosci, bez poprawiania.

Zdanie mowiace, ile operacji z niego wyszlo, liczba wprost.

Lista operacji, kazda z nazwa czynnosci po ludzku (Dodaj wpis, Zmien wpis 412, Usun wpis 388), trescia i numerem wpisu, ktorego dotyczy.

Napis wprost, co sie stalo z operacjami niszczacymi: sa juz w kolejce do zatwierdzenia i nic sie nie wykonalo.

Zasada operacji niszczacych

Dodanie wpisu wykonuje sie od razu, bo nic nie traci. Zmiana i usuniecie zawsze pokazuja sie natychmiast jako pozycje kolejki, z widocznym DiffPair na miejscu, bez przechodzenia na ekran 07. Gdy przelacznik all-permission jest wlaczony, operacje wykonuja sie od razu, a wiersz mowi wykonane od razu, bo masz wlaczone pelne uprawnienia i daje cofniecie na 10 s.

Stany

Rozbija tekst: napis Rozbijam na wpisy i twoj tekst zostaje na ekranie.

Nic nie wyszlo: zdanie, ze z tego tekstu nie da sie zrobic wpisu, i pytanie o jedna konkretna rzecz, ktorej brakuje.

Konflikt: jesli wpis zmienil sie od czasu propozycji, wiersz mowi wpis zmienil sie w trakcie i pokazuje trzy wersje: zapisana, proponowana, twoja.

Brak klucza do modelu: pole wylaczone, ale zostaje przycisk Zapisz jako jeden wpis bez rozbijania, bo to nie wymaga modelu.

Element
Polski
English

talk.placeholder
Wpisz surowy tekst, nie musi byc ladny
Write raw text, it does not need to be tidy

talk.result
Z tego tekstu wychodza trzy operacje. Dodanie wykonalo sie od razu, zmiana i usuniecie czekaja na twoja zgode.
Three operations come out of this text. The addition is done, the change and the deletion are waiting for your approval.

talk.allPermission
Wykonane od razu, bo masz wlaczone pelne uprawnienia. Cofnij
Applied immediately because full permission is on. Undo

talk.nothing
Z tego tekstu nie da sie zrobic wpisu, bo nie wiadomo, czego dotyczy. Dopisz, o ktory plik albo decyzje chodzi.
No entry can be made from this text because it is unclear what it refers to. Add which file or decision it concerns.

07

### Do zatwierdzenia

Przejsc przez zaleglosci w tempie jednego klawisza na pozycje, bez poczucia, ze cos wybucha przy zwloce.

```
┌─BAR──────────────────────────────────────────────────────┐
├─SIDE────────┬────────────────────────────────────────────┤
│ [ariadne-c▾]│ Do zatwierdzenia                           │
│             │ 6 zadan i 34 wpisy czekaja. Mozesz wrocic  │
│ Przeglad    │ do tego kiedy chcesz, nic nie przepada.    │
│ Wpisy       │ ──────────────────────────────────────     │
│ Asystent    │ [ zadania 6 ][ nieocenione 34 ][ odwol. 2 ]│
│ Baza        │ ──────────────────────────────────────     │
│ ──────────  │ ☐ ZMIANA TRESCI  Limit rownoleg…  agent    │
│ Do zatw. 40◄│ ┌ zapisane ─────────┬ proponowane ───────┐ │
│             │ │ osiem zadan       │ cztery zadania     │ │
│ ──────────  │ └───────────────────┴────────────────────┘ │
│ Ustawienia  │              [ Odrzuc ] [ Zatwierdz ]      │
│ ⌘K          │ ☐ USUNIECIE      Tokeny w keych…  asystent │
│             │ 3 zaznaczone  [ Zatwierdz zaznaczone (3) ] │
└─────────────┴────────────────────────────────────────────┘
```

Kolejnosc czytania

Naglowek i pod nim dwa zdania: ile czeka i ze zwloka nic nie kosztuje. To jedyne miejsce, gdzie interfejs mowi o sobie.

Trzy zakladki z liczbami: zadania, nieocenione, odwolane. Kazda z rzeczownikiem, nie naga liczba.

Pierwsza pozycja rozwinieta z DiffPair, kolejne zwiniete. Rozwija sie jedna na raz.

Pasek zbiorczego dzialania pojawia sie dopiero po zaznaczeniu i mowi, ilu pozycji dotyczy.

Czterdziesci pozycji

Klawiatura jest glowna droga: strzalki wybieraja, Y zatwierdza, N odrzuca, Space zaznacza, i skroty sa wypisane w stopce ekranu, nie ukryte w pomocy. Zatwierdzona pozycja zostaje w miejscu na 3 s z napisem Zatwierdzone, cofnij, potem znika i licznik spada. Lista nie przeskakuje pod palcem.

Stany

Pusto: zdanie Nic nie czeka na zatwierdzenie i data ostatniej ocenionej pozycji. Bez pochwal.

Zbiorcze usuniecie: jedyne potwierdzenie w calej aplikacji, bo dotyczy wielu wpisow naraz: pyta o liczbe i wypisuje pierwsze trzy tytuly.

Blad zatwierdzenia: pozycja wraca do kolejki z napisem, ze nie udalo sie jej zatwierdzic, i przyciskiem ponowienia.

Sesja wygasla w trakcie: banner, zaznaczenie zostaje po ponownym zalogowaniu.

Element
Polski
English

queue.subtitle
6 zadan i 34 wpisy czekaja. Mozesz wrocic do tego kiedy chcesz, nic nie przepada.
6 tasks and 34 entries are waiting. Come back whenever you want, nothing expires.

queue.tabs
zadania 6 &middot; nieocenione 34 &middot; odwolane 2
tasks 6 &middot; unreviewed 34 &middot; contradicted 2

queue.keys
Y zatwierdza &middot; N odrzuca &middot; Space zaznacza &middot; strzalki wybieraja
Y approves &middot; N rejects &middot; Space selects &middot; arrows move

queue.done
Zatwierdzone. Cofnij
Approved. Undo

queue.empty
Nic nie czeka na zatwierdzenie. Ostatnia pozycje ocenilas 22 lip.
Nothing is waiting for approval. You reviewed the last item on 22 Jul.

queue.bulkDelete
Usunac 3 wpisy? Znikna z wyszukiwania, zostana w bazie. Dotyczy: Tokeny w keychainie, Limit osiem zadan, Pierwszy schemat bazy.
Delete 3 entries? They leave search and stay in the base. Affected: Tokens in the keychain, Limit of eight tasks, First database schema.

08

### Ustawienia

Trzymac w jednym miejscu cztery rzeczy, ktore sie zmienia rzadko, i powiedziec przy kazdej, co jej wlaczenie oznacza.

```
┌─BAR──────────────────────────────────────────────────────┐
├─SIDE────────┬────────────────────────────────────────────┤
│ [ariadne-c▾]│ Ustawienia                                 │
│             │ ──────────────────────────────────────     │
│ Przeglad    │ PROFIL                                     │
│ Wpisy       │ [ Junior frontend, pracuje po polsku,  ]   │
│ Asystent    │ [ kod po angielsku, nie znosi over-…   ]   │
│ Baza        │ Agent dostaje ten tekst na starcie sesji   │
│ ──────────  │ ──────────────────────────────────────     │
│ Do zatw. 6  │ TOKENY MCP                                 │
│             │ laptop     utworzony 12 lip  uzyty 10:02   │
│ ──────────  │ stary-mac  utworzony 03 cze  nieuzywany    │
│ Ustawienia ◄│ [ Nowy token ]                             │
│ ⌘K          │ ──────────────────────────────────────     │
│             │ PELNE UPRAWNIENIA AGENTA        [ ○——— ]  │
│             │ Wylaczone: zmiany i usuniecia agenta ida   │
│             │ do kolejki. Wlaczone: wykonuja sie od razu │
│             │ ──────────────────────────────────────     │
│             │ KLUCZ DO MODELU     [ ····  ] opcjonalny   │
│             │ JEZYK   (•) polski ( ) English             │
│             │ ──────────────────────────────────────     │
│             │ Wyeksportuj baze     Wyloguj sie           │
└─────────────┴────────────────────────────────────────────┘
```

Kolejnosc czytania

Profil, bo zmienia sie najczesciej i wplywa na kazda sesje agenta.

Tokeny MCP: etykieta, data utworzenia, data ostatniego uzycia albo napis nieuzywany. Surowy token widoczny raz, przy wygenerowaniu, i tak napisane obok.

Pelne uprawnienia agenta z opisem obu stanow pod przelacznikiem, po polsku, bez slowa all-permission w interfejsie.

Klucz do modelu z napisem opcjonalny i zdaniem, co dziala bez niego.

Jezyk, potem eksport bazy i wylogowanie na koncu.

Jezyk

Przy pierwszym uruchomieniu jezyk bierze sie z systemu: polski, gdy system jest polski, inaczej angielski. Zmienia sie tylko tutaj i dziala od razu, bez restartu okna. Nazwy statusow w interfejsie sa tlumaczone, nazwy w kodzie i w API zostaja angielskie.

Stany

Nowy token: pojawia sie CommandBlock z gotowym poleceniem i napisem, ze token widac tylko teraz.

Usuniecie tokenu: zdanie mowiace, ktory agent przestanie miec dostep, i dopiero potem przycisk.

Klucz odrzucony: pole z krawedzia w czerwieni i zdanie, ze dostawca odrzucil klucz, plus co dziala bez niego.

Eksport: po kliknieciu napis z nazwa pliku i miejscem zapisu, bez okna postepu.

Element
Polski
English

settings.permission
Pelne uprawnienia agenta
Full agent permission

settings.permission.off
Wylaczone: zmiany i usuniecia proponowane przez agenta czekaja w kolejce na twoja zgode.
Off: changes and deletions proposed by the agent wait in the queue for your approval.

settings.permission.on
Wlaczone: agent zmienia i usuwa wpisy od razu, bez pytania. Cofniecie masz 10 sekund.
On: the agent changes and deletes entries immediately, without asking. You get 10 seconds to undo.

settings.key.note
Opcjonalny. Bez klucza dzialaja wpisy, kolejka, graf i szukanie po znaczeniu. Nie dziala asystent i rozbijanie surowego tekstu.
Optional. Without a key, entries, the queue, the graph and meaning search work. The assistant and raw-text splitting do not.

settings.token.once
Token widzisz raz, przy wygenerowaniu. Nie da sie go pozniej odczytac, mozna tylko wydac nowy.
You see the token once, when it is generated. It cannot be read later, only replaced.

settings.export
Wyeksportuj baze do pliku JSON
Export the base to a JSON file

06

## Sygnatura, czyli nic

trzy miejsca, zero wyjatkow

Nic to linia 1 px w --blue. Wolno jej wystapic tylko tam, gdzie dwie rzeczy sa naprawde powiazane, i w kazdym z trzech miejsc dziala inaczej. Wszedzie indziej separator to --hairline i nie jest blekitny. Czwarte, dopuszczone uzycie techniczne: linia od cytowania do rozwinietego zrodla, bo to ta sama zasada w mniejszej skali.

1. Postep onboardingu

Trzy kwadraty 10 px, odstep 60 px. Nic jest narysowana tylko do kroku, w ktorym jestes, dalej biegnie --hairline. Przy przejsciu do nastepnego kroku odcinek rysuje sie od lewej: transform: scaleX(0 → 1), 420 ms, cubic-bezier(0.16,1,0.3,1), transform-origin: left. Kwadrat celu wypelnia sie po zakonczeniu, zmiana background w 120 ms. Obok zawsze napis krok 2 z 3, bo linia sama nie jest informacja.

Reduced motion: odcinek pojawia sie od razu w pelnej dlugosci, animation: none. Napis zmienia sie identycznie, wiec zadna informacja nie zalezy od ruchu.

2. Wspolny plik miedzy wpisami

Kolejka zadan zostaje w SQLite
Limit rownoleglosci to cztery zadania

Na liscie wpisow i w czytniku: pionowa linia 1 px po lewej krawedzi wiersza, laczaca wylacznie te wiersze, ktore dziela plik z wpisem aktualnie wybranym. Pojawia sie na wybor wpisu, znika po odznaczeniu, opacity 0 → 1 w 120 ms, bez ruchu w osi X. Nad grupa napis w mono z nazwa pliku, bo linia mowi ze, a napis mowi ktory.

Reduced motion: linia i napis pojawiaja sie bez przejscia. Grupowanie wierszy nie zmienia sie, wiec uklad nie skacze.

3. Krawedz w grafie

Na ciemnym plotnie nic ma barwe --blue-lift, bo --blue daje tam 2.2:1. Ciagla oznacza wspolny plik, kreskowana podobienstwo powyzej 0.75, ze strzalka odwolanie. Krawedzie nie animuja sie przy przeliczaniu ukladu: symulacja liczy sie w tle, plotno pokazuje napis Ukladam graf, a gotowy uklad pojawia sie w jednej klatce, opacity 200 ms. Zaden wierzcholek nie drga po ustawieniu.

Reduced motion: symulacja dostaje twardy limit 60 iteracji i rysuje sie raz, bez przejscia krycia. Podswietlenie sasiadow przy wyborze zmienia sie natychmiast.

07

## DESIGN.md

plik w repozytorium: DESIGN.md

```
---
name: Ariadne
register: product
personality: [attributed, deliberate, quiet]
theme: light-only, dark graph canvas
color:
  plaster:        oklch(0.968 0.008 240)   # app background
  plaster-raised: oklch(0.985 0.005 240)   # reading surface
  plaster-sunk:   oklch(0.941 0.010 240)   # rails, hover, data blocks
  ink:            oklch(0.260 0.020 250)   # 14.2:1 on plaster
  ink-2:          oklch(0.450 0.020 250)   # 6.8:1
  ink-3:          oklch(0.530 0.015 250)   # 4.8:1, text floor
  edge:           oklch(0.620 0.015 250)   # 3.3:1, control borders
  hairline:       oklch(0.860 0.010 250)   # 1.4:1, decoration only
  blue:           oklch(0.470 0.120 253)   # 6.0:1, accent, confirmed, thread
  blue-lift:      oklch(0.720 0.120 250)   # 6.0:1 on canvas only
  ochre:          oklch(0.520 0.105 78)    # 4.9:1, proposed text
  ochre-mark:     oklch(0.630 0.130 78)    # 3.2:1, marker fill only
  iron:           oklch(0.505 0.150 27)    # 5.9:1, contradicted, deletions
  slate:          oklch(0.500 0.012 250)   # 5.5:1, archived
  canvas:         oklch(0.220 0.020 250)   # graph only
  canvas-ink:     oklch(0.930 0.010 240)   # 15.8:1 on canvas
type:
  prose: Literata, latin-ext, weights 400/500/600
  data:  Martian Mono, latin-ext, weights 400/500
  scale: 43/34/27/21/17/15/13/11, ratio 1.26
  measure: 68ch
space: [2, 4, 8, 12, 16, 24, 32, 48, 72, 112]
radius: [0, 2]
motion:
  state:  120ms cubic-bezier(0.22,1,0.36,1)
  enter:  200ms cubic-bezier(0.22,1,0.36,1)
  thread: 420ms cubic-bezier(0.16,1,0.3,1)
a11y: WCAG 2.2 AA, status never color-only, reduced-motion honoured
---

# Overview

Ariadne is a desktop window over a research archive, not a dashboard. It shows
what a coding agent decided, when, in which files, and whether a human has
vouched for it. Every screen is a catalogued surface: label on the left, value on
the right, hairline between rows, no boxes around boxes.

**The Instrument Rule.** Nothing on screen celebrates a number; every number is a
reading you can act on.

**The Attribution Rule.** No statement appears without its source, its date and
its status in the same eyeful.

**The Plain Note Rule.** Every label, empty state and status says in words what it
is and what to do next, so the reader never has to infer meaning from a colour,
an icon or a position.

# Colors

Four roles carry meaning and nothing else carries it: blue is the thread and
`confirmed`, ochre is `proposed`, iron is `contradicted`, slate is `archived`.
Neutrals are limestone plaster tinted 0.008 to 0.020 chroma toward the accent.
Pure black and pure white are absent from the palette.

**The Four Roles Rule.** A colour that does not name a status or the thread has no
business being saturated.

**The Marker Floor Rule.** Saturated ochre lives only in 10 px markers at 3.2:1;
any ochre carrying text drops to 4.9:1.

**The One Dark Surface Rule.** The graph canvas is the only dark region in the
product, and it exists because thin lines between forty nodes need it.

# Typography

Literata sets every sentence a human reads; Martian Mono sets everything a
machine produced: paths, hashes, dates, similarity, status names, form labels.
Monospace labels are uppercase, tracked 0.12em, capped at 24 characters.

**The Two Voices Rule.** Prose in the serif, data in the mono, and never the
reverse.

**The Measure Rule.** Body text is 17px/28px in a 68-character column, because a
4000-character entry is a normal read, not an edge case.

# Elevation

There is one shadow in the product: `0 8px 24px oklch(0.26 0.02 250 / 0.14)`, worn
by the command palette and the context menu only. Everything else separates by a
1px border or by background step: plaster, plaster-sunk, plaster-raised.

**The Paper Rule.** Panels are cut paper, not floating cards: a border, a
background step, zero radius above 2px.

**The Modal Last Rule.** A modal is the last resort, allowed only for bulk
deletion; everything else resolves in place.

# Components

Fourteen components: TitleBar, SideRail, CommandPalette, ProjectRow, NodeRow,
Reader, Provenance, StatusChip, Citation, DiffPair, QueueItem, GraphCanvas,
CommandBlock, Banner, EmptyPlate, Field, Button. Each has rest, hover, focus,
active, disabled and error where applicable; focus is always
`outline: 2px var(--blue); outline-offset: 2px`.

**The Shape Plus Word Rule.** Every status renders as marker shape plus written
label plus, where it exists, its reason.

**The Row Height Rule.** A node row is 44px and shows one sentence; reading the
full entry happens in the Reader, never in the list.

**The Terminal Once Rule.** Dark background plus monospace on a light app is
honest exactly once: the onboarding command block.

# Do's and Don'ts

Do write the reason next to the status: `contradicted by entry 418`, not a red
square. Do state what a toggle does in both positions. Do use exact timestamps.
Do keep the queue ignorable and say so in words.

Don't put a coloured bar thicker than 1px on the left of anything. Don't gradient
text. Don't nest a card in a card. Don't use the blue thread as a divider. Don't
congratulate, apologise or exclaim. Don't invent a fifth accent for a fifth
meaning; add a shape instead.

**The No Guessing Rule.** If a label, count or state could be misread by someone
who has never seen this app, spell it out in a sentence instead.

```

08

## Czego swiadomie nie zaprojektowalem

Rzecz
Dlaczego nie teraz
Kiedy wrocic

Wspolna baza dla kilku kont
Uzytkownikow jest wielu, kazdy ma wlasne konto i wlasne projekty, i wszyscy dostaja dokladnie te same osiem ekranow, bez podzialu na techniczna i nietechniczna osobe. Nie zaprojektowalem natomiast pracy kilku kont nad jednym projektem, bo backend nie ma czlonkostwa ani rol, a zaproszenia bez modelu uprawnien byly by wymyslaniem.
Gdy dwa konta beda musialy czytac i potwierdzac te sama baze, czyli przy pierwszym projekcie zespolowym.

Historia wersji wpisu
Nie wybralas jej do zakresu. Interfejs pokazuje date modyfikacji i kanal, wiec wiadomo, ze zmiana byla, ale nie da sie zobaczyc poprzedniej tresci.
Przy pierwszym przypadku, gdy bedziesz chciala cofnac zmiane starsza niz 10 sekund.

Graf calego projektu
Powyzej 150 wierzcholkow przestaje cokolwiek znaczyc, a krawedzie licza sie w locie. Zaprojektowany jest graf z zakresem, nie graf wszystkiego.
Gdy zakres sasiedztwa okaze sie za waski w praktyce, najwczesniej po 300 wpisach.

Plansza z portretem rzezby w ASCII
Chcesz ja i zgadzam sie na jedno miejsce, ale konwersja wymaga zrodlowego zdjecia, ktorego nie mam. Zamiast tego wchodzi labirynt kretenski rysowany jedna linia, bo to ta sama zasada bez podrabiania fotografii.
Gdy podrzucisz zdjecie rzezby: siatka 96 na 56 znakow, 12 stopni gestosci, jeden kolor tuszu, tylko ekran 01 i 02.

Filtry i szukanie na liscie wpisow
Zaprojektowane sa wiersz, czytnik i gestosc, ale nie panel filtrow, bo nie wiadomo, czy filtrowanie idzie po stronie serwera. To pytanie do backendu, nie do projektu.
Razem z endpointem czytania wpisow, patrz audyt A2.

Koszt i limity modelu
Klucz jest opcjonalny i nie ma danych o zuzyciu w API. Interfejs nie udaje, ze wie, ile wydales.
Gdy pojawi sie licznik zuzycia po stronie serwera.

Powiadomienia systemowe
Kolejka ma byc nieblokujaca. Powiadomienie o nowym wpisie zamienia ja w feed, czyli w to, czym Ariadne nie jest.
Prawdopodobnie nigdy. Wroc do tego tylko wtedy, gdy okaze sie, ze kolejka jest ignorowana miesiacami.

Widok jednego pliku
Kusi, bo anchors to pliki, ale to zaczatek mapowania kodu, czyli tego, czym Ariadne swiadomie nie jest. Na razie plik jest tylko filtrem listy.
Gdy filtrowanie po pliku bedzie uzywane czesciej niz szukanie po znaczeniu.

Dwie rzeczy z tej listy sa pytaniami do backendu, nie do projektu: endpoint czytania wpisow (A2) i endpoint nadajacy status odwolany razem z polem supersededBy (A3). Bez nich ekrany 03, 04, 05, 06 i 07 nie maja z czego zyc.