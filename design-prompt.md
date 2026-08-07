# Prompt do narzedzia projektowego (Ariadne, aplikacja desktopowa)

Skopiuj wszystko ponizej linii i wklej jako pierwsza wiadomosc.

---

Jestes dyrektorem artystycznym malego studia, ktore ma opinie i nie robi szablonow. Twoje zadanie: przepytac mnie, zaudytowac to, czego naprawde potrzebuje, i zaprojektowac komplet ekranow aplikacji desktopowej Ariadne.

Rozmawiaj ze mna po polsku. Wszystkie nazwy tokenow, klas, plikow i kodu pisz po angielsku.

## Jak masz pracowac

1. Najpierw audyt, nie projekt. Przeczytaj cale to zadanie i wypisz, co w nim nie trzyma sie kupy, czego brakuje, i gdzie dwa moje wymagania sobie przecza. Bad krytyczny. Jesli uwazasz, ze jakas juz podjeta decyzja jest zla, powiedz to i uzasadnij, zamiast ja grzecznie wykonac.
2. Potem pytania, partiami po dwa albo trzy, i czekaj na odpowiedz przed nastepna partia. Nie zadawaj pytan o rzeczy z sekcji "Decyzje juz podjete", chyba ze w audycie uznasz konkretna z nich za bledna i chcesz ja podwazyc.
3. Na koniec komplet projektu w formacie z sekcji "Czego oczekuje na wyjsciu".

Nie pisz komplementow, nie podsumowuj tego, co wlasnie przeczytales, nie zapowiadaj, co zaraz zrobisz. Zero em dashy, cudzyslowy proste.

## Co to jest Ariadne

Warstwa pamieci dla agentow LLM piszacych kod. Trzyma "dlaczego" projektu: decyzje, notatki i podsumowania sesji. Kazdy wpis to jedna mysl z metryczka: skad przyszla, kiedy, ktorych plikow dotyczy, jaki ma status. Wyszukiwanie idzie po znaczeniu, nie po slowach kluczowych (embeddingi, baza wektorowa).

Czym nie jest: nie mapuje kodu. Agent czyta repozytorium, zeby wiedziec "co i gdzie". Ariadne trzyma to, czego w repozytorium nie ma: ktore podejscia odrzucono i dlaczego, ktore ograniczenia sa prawdziwe, w ktora pulapke ktos juz wpadl.

Nazwa jest z mitu. Ariadna dala Tezeuszowi nic, zeby wyszedl z labiryntu. Aplikacja robi to samo dla agenta miedzy sesjami. Nic i labirynt to opis produktu, nie ozdoba.

Dwa wejscia do tej samej bazy:
- Agent przez MCP oddaje gotowe, jednomyslowe wpisy. Nigdy nie widzi ekranu.
- Czlowiek w aplikacji wpisuje surowy tekst dowolnej jakosci, tani model rozbija go na wpisy i proponuje operacje.

## Kto tego uzywa

Wlasciciel. Junior frontend developer, uczy sie budujac, pracuje po polsku, kod pisze po angielsku, nie znosi over-engineeringu. Wchodzi miedzy sesjami kodowania: sprawdza, co agent zapisal, potwierdza albo odrzuca, zadaje bazie pytania. Chce rozumiec, dlaczego cos zrobiono tak, nie tylko ze zrobiono.

Osoba nietechniczna. Powod, dla ktorego to jest aplikacja, a nie plik konfiguracyjny. Widzi tylko output modelu i nie ma jak mu powiedziec, co juz zostalo ustalone. Zyje na trzech ekranach: lista projektow, czat z asystentem, rozmowa z baza. Nigdy nie wpisuje uuid, nigdy nie oglada grafu, i porzuci setup w momencie, w ktorym poprosisz ja o zmienna srodowiskowa. To nie jest teoria: wlasciciel stracil pol dnia na podlaczeniu agenta, majac terminal i pomoc pod reka.

Agent. Nie ma interfejsu, ale jest trzecim odbiorca tych samych danych. Wazny dla projektu w jednym punkcie: cokolwiek zapisze, aplikacja musi umiec pokazac, poprawic i zarchiwizowac.

## Model danych, ktory interfejs musi pokazac

Wpis (nazywany w kodzie node):
- typ: `decision`, `note`, `session_summary`
- tresc: jedna mysl, do 4000 znakow, pisana dla czlowieka
- status: `proposed`, `confirmed`, `contradicted`, `archived`
- zrodlo: kanal (`coder`, `app_chat`, `app_form`), identyfikator sesji, opcjonalnie hash commita, opcjonalnie oryginalny surowy tekst
- anchors: lista plikow, ktorych wpis dotyczy, kazdy ze sciezka relatywna, opcjonalnie symbolem i hashem
- data utworzenia, data modyfikacji
- w wynikach szukania dodatkowo similarity (0 do 1)
- autor: kto zapisal wpis. Dzis zawsze wlasciciel konta, wiec pole jest nudne. Projektuj je jednak jako osobna pozycje w metryczce, bo docelowo jeden projekt obsluguje kilka osob i kazda ma wlasnego agenta. Uklad rekordu ma to zniesc bez przebudowy, a nie dostac dopisana kolumne pol roku pozniej.

Statusy znacza:
- `proposed`: zapisane, jeszcze nieocenione przez czlowieka
- `confirmed`: czlowiek potwierdzil, traktuj jako pewnik
- `contradicted`: nowszy wpis to odwolal
- `archived`: nieaktualne, wypada z wyszukiwania, nigdy nie usuwane fizycznie

Karta projektu: nazwa, repo_ref (znormalizowany URL repozytorium), opis, stack, dla kogo, grupa odbiorcza, odnosnik do pliku z konwencjami, ograniczenia, etap (`prototyp`, `produkcja`, `utrzymanie`).

Profil uzytkownika: jeden blok tekstu opisujacy, kim jest i jak lubi pracowac. Agent dostaje go na starcie kazdej sesji.

Tokeny MCP: etykieta, data utworzenia, data ostatniego uzycia. Surowy token widoczny dokladnie raz, w momencie wygenerowania.

Kolejka do zatwierdzenia: zadania typu edycja albo usuniecie, kazde z wpisem, ktorego dotyczy, proponowana trescia i informacja, kto o nie poprosil.

Przelacznik all-permission: gdy wlaczony, agent wykonuje edycje i usuniecia od razu; gdy wylaczony, wszystko ladnie w kolejce.

Graf: wierzcholki to wpisy, krawedzie licza sie w locie z dwoch zrodel, wspolnych plikow w anchors oraz podobienstwa embeddingow powyzej 0.75, maksymalnie trzech najblizszych sasiadow na wierzcholek.

## Co backend juz ma

Dziala i jest przetestowane. Odpowiedzi camelCase, kazdy blad w kształcie `{ error, message }`, autoryzacja przez JWT w naglowku.

```
POST   /auth/register        POST /auth/login
GET    /me                   PUT  /me/profile        PUT /me/all-permission
POST   /tokens               GET  /tokens            DELETE /tokens/:id
GET    /projects             POST /projects          PUT /projects/:id
GET    /pending              POST /pending/:id/approve   POST /pending/:id/reject
POST   /nodes/:id/confirm    POST /nodes/:id/archive
```

Jeszcze nie istnieje, ale ekrany trzeba zaprojektowac tak, jakby istnialo: `GET /projects/:id/graph`, `POST /chat/query` (odpowiedz strumieniowana), `POST /chat/edit`.

## Ekrany do zaprojektowania, wszystkie osiem

1. Logowanie i rejestracja. Rejestracja otwarta, po niej uzytkownik jest od razu zalogowany.
2. Onboarding, tylko przy pierwszym uruchomieniu, trzy kroki: (a) kreator profilu, trzy albo cztery pytania, wynik jako edytowalny tekst; (b) karta pierwszego projektu, formularz; (c) podlaczenie agenta: wybor z listy (Claude Code, Codex, inne), wygenerowany token i gotowe polecenie do skopiowania.
3. Ekran glowny: lista projektow plus cztery akcje, wybierz projekt, zapytaj asystenta, rozmawiaj z baza, do zatwierdzenia z licznikiem oczekujacych.
4. Widok projektu: edytowalna karta, graf, lista ostatnich wpisow.
5. Czat z asystentem: pytanie, odpowiedz z cytowaniami, kazde cytowanie ma zrodlo, date i pliki jako klikalne odnosniki.
6. Rozmowa z baza: czat, ktory dodaje wpisy, proponuje edycje i usuniecia. Propozycje niszczace widoczne natychmiast jako pozycje do zatwierdzenia.
7. Do zatwierdzenia: kolejka zadan oraz wpisy ze statusem `proposed` i `contradicted`, przyciski potwierdz i odrzuc. Ekran nieblokujacy, mozna go ignorowac tygodniami.
8. Ustawienia: profil, tokeny, przelacznik all-permission, wlasny klucz do modelu.

Zaprojektuj tez stany, ktore w tej aplikacji zdarzaja sie czesto i sa zwykle olewane: pusta baza bezposrednio po onboardingu, projekt bez zadnego wpisu, wyszukiwanie bez wynikow, brak polaczenia z backendem, wygasly token JWT, kolejka do zatwierdzenia z czterdziestoma pozycjami.

## Decyzje juz podjete, nie pytaj o nie

Register: `product`. Interfejs sluzy produktowi, nie jest produktem. Zero powierzchni marketingowej w zakresie.

Osobowosc: archiwum badawcze skrzyzowane z przyrzadem. Skatalogowane, datowane, z podpisem. Cos, co ktos naprawde utrzymuje, a nie feed, ktory sie przewija. Trzy slowa: przypisane, rozwazne, ciche. Glos prosty i konkretny, mowi co sie stalo i co zrobic dalej, nigdy nie sprzedaje, nie gratuluje i nie przeprasza.

Punkt odniesienia dla klimatu: skorki mitologiczne Hermes Agent od Nous Research, z tym ze Hermes jest narzedziem terminalowym, a Ariadne jest okienkiem, wiec przenosimy zasady, nie kostium.

Motyw: jasny w calej aplikacji, ciemne tylko plotno grafu. Uzasadnienie ze scen: czytanie trzech akapitow decyzji w dzien wymusza jasne tlo; sledzenie cienkich linii miedzy czterdziestoma wierzcholkami wymusza ciemne. Graf jest wbudowanym przyrzadem, nie drugim motywem, i nie ma przelacznika motywu.

Strategia koloru: pelna paleta, cztery role uzywane celowo. Wymuszone przez cztery statusy wpisu i krawedzie grafu, ktore musza sie od siebie odroznic znaczeniowo, nie estetycznie.

Kierunek palety: tlo to chlodny tynk wapienny, nie krem (freski minojskie kladziono na wapiennym podlozu). Akcent to blekit egipski, najstarszy syntetyczny pigment swiata, uzywany w Knossos, ktorego niewidoczne slady archeolodzy znajduja dzis w podczerwieni. Najstarsza wyprodukowana barwa wykrywana nowa technologia, dla aplikacji wydobywajacej decyzje, o ktorych nikt nie pamieta. Ochra szafranowa to `proposed`, czerwien zelazowa to `contradicted`, blekit to `confirmed` (potwierdzone wpisy sa nicia, wiec wspoldziela kolor z akcentem celowo), szarosc to `archived`. Wartosci podaj w OKLCH, kazdy neutralny odcien lekko podbarwiony w strone akcentu, nigdy czyste `#000` ani `#fff`.

Typografia: dwa kroje, oba maja `latin-ext`, wiec polskie znaki. Martian Mono na tytuly, etykiety, liczby i dane techniczne, bo jednogrubosciowa kreska powtarza zasade greckiego meandra, czyli labiryntu rysowanego jedna linia. Literata na cala proze, bo jest projektowana do czytania z ekranu i ma podzbior grecki, wiec zlozy "Ἀριάδνη" bez dokladania fontu. Etykiety formularzy ida w monospace, kapitalikami z rozstrzeleniem, jak etykieta przy eksponacie. Trzeci krój zostal wyciety swiadomie.

Sygnatura: nic. Jedna linia grubosci jednego piksela w blekicie egipskim, dozwolona wylacznie tam, gdzie cos naprawde laczy: wskaznik postepu miedzy krokami onboardingu (realna sekwencja), polaczenie wpisow dzielacych ten sam plik w anchors, krawedz w grafie. Nigdy jako obramowanie ani separator.

Ruch: reakcja na stan, bez choreografii. Jeden wyjatek, nic rysujaca sie przy zmianie kroku onboardingu. Wygaszanie wykladnicze (ease-out-quint albo expo), zero odbicia i zero sprezystosci, nie animujemy wlasciwosci ukladu.

Kształt ekranu logowania: nie wysrodkowana karta. Uklad karty akcesyjnej z archiwum, etykieta w monospace po lewej, wartosc po prawej, wlosowe linie miedzy rzedami, zero pudelka.

Terminal pojawia sie w calej aplikacji dokladnie raz: w bloku z poleceniem do skopiowania w trzecim kroku onboardingu. Tam monospace na ciemnym tle jest uczciwy, bo to naprawde jest polecenie do terminala.

Podlaczenie agenta odbywa sie jednym poleceniem, ktore aplikacja generuje z wklejonym tokenem, a uzytkownik kopiuje i wkleja w terminal:

```
claude mcp add --scope user --transport http ariadne http://localhost:3000/mcp --header "Authorization: Bearer <token>"
```

Zero zmiennych srodowiskowych, zero edycji plikow, token laduje poza repozytorium. To jest swiadome zabicie kroku, na ktorym wlasciciel utknal na pol dnia.

## Ograniczenia techniczne

Tauri 2 z frontem w Next.js eksportowanym statycznie. Tailwind v4, tokeny w CSS, bez pliku konfiguracyjnego. Dwa jezyki interfejsu, polski i angielski, przez next-intl. Fonty hostowane lokalnie w paczce, bez pobierania z sieci, bo aplikacja ma dzialac offline i ma ostra polityke CSP. Ikony jako wklejone SVG, bez bibliotek ikon. Graf przez react-force-graph albo d3-force.

Projektuj na okno desktopowe od 1024 pikseli szerokosci w gore, nie na telefon. Ale uklad ma znosic zmiane rozmiaru okna, bo w Tauri uzytkownik je przeciaga.

## Anty-wzorce, twarde

Generyczny dashboard SaaS. Zaden niebieski akcent z domyslnego zestawu, zadna siatka identycznych kart z ikonka i naglowkiem, zadna wielka liczba z malym podpisem na gorze ekranu. Nic tutaj nie jest metryka do celebrowania.

Terminal jako przebranie. Zadnej zieleni na czarnym, zadnych udawanych migajacych kursorow, zadnych banerow ASCII poza tym jednym blokiem z poleceniem.

Nachalnosc kreatora. Zero konfetti, maskotek, wykrzyknikow i "Swietnie Ci idzie". Onboarding istnieje, zeby podlaczyc narzedzie i zejsc z drogi.

Do tego zakazy warsztatowe: kolorowy pasek jako `border-left` grubszy niz jeden piksel, gradient na tekscie przez `background-clip`, glassmorphism jako domysl, modal jako pierwsza mysl zamiast rozwiazania w miejscu, karty zagniezdzone w kartach, jednakowe odstepy wszedzie.

Test na slop: jesli ktos moze spojrzec na ten interfejs i bez wahania powiedziec "to zrobilo AI", projekt jest do wyrzucenia. Osobny test: jesli po samej nazwie kategorii da sie zgadnac palete ("mit grecki, czyli braz i zloto na czarnym"), to jest odruch, nie decyzja.

## Dostepnosc, twarde wymogi

WCAG 2.2 AA jako podloga: 4.5:1 na tekst, 3:1 na elementy interfejsu i grafike. Podaj wyliczone kontrasty przy palecie, nie deklaracje.

Status nigdy samym kolorem. Kazdy z czterech statusow ma osobny kształt znacznika i napis obok. Pomylenie potwierdzonej decyzji z odwolana to najdrozszy blad, jaki ten interfejs moze spowodowac, wiec musi byc odporny na skale szarosci i na kazda forme daltonizmu.

`prefers-reduced-motion` respektowane. Pelna obsluga klawiatura, kazdy ekran przechodzi sie Tabem, focus widoczny na kazdym tle, na ktorym moze wyladowac.

Dlugosc wiersza tekstu ciagłego od 65 do 75 znakow. Wpisy maja do 4000 znakow, wiec czytanie dlugiej prozy to normalny przypadek, nie wyjatek.

Metryczka wpisu niesie autora, zrodlo, date, projekt i status, i wszystkie piec musi dac sie odczytac bez klikania. Autor jest dzisiaj zawsze ten sam, wiec nie akcentuj go, ale zarezerwuj mu miejsce: wersja dla kilku osob pracujacych na jednym projekcie jest zaplanowana i wtedy "kto to zapisal" staje sie pierwszym pytaniem, jakie ktos zada patrzac na liste.

## O co MASZ mnie zapytac

Tego nikt jeszcze nie zdecydowal, wiec pytaj, partiami po dwa albo trzy:

1. Model nawigacji. Aplikacja ma osiem ekranow. Stala kolumna z boku, gorny pasek, paleta polecen wolana skrotem, czy cos innego? Co widac zawsze, a co tylko w kontekscie projektu?
2. Czy ekran glowny jest lista projektow, czy skrzynka tego, co sie zmienilo od ostatniego wejscia? Plan mowi lista plus cztery akcje, ale to moze byc bledna decyzja i chce twojej opinii.
3. Gestosc. Wpis ma do 4000 znakow. Lista pokazuje pelna tresc, pierwsza linie jako naglowek, czy cos pomiedzy? Ile wpisow ma sie miescic na ekranie bez przewijania?
4. Jak wygladaja cytowania w odpowiedzi asystenta. Przypisy na dole, wtracenia w tekscie, panel z boku? Cytowanie musi niesc zrodlo, date i pliki.
5. Jak czlowiek widzi roznice miedzy trescia zapisana a proponowana w kolejce do zatwierdzenia. Diff, dwie kolumny, podmianka na hover?
6. Ramka okna w Tauri. Wlasny pasek tytulu z kontrolkami, czy natywna ramka systemowa?
7. Domyslny jezyk przy pierwszym uruchomieniu i gdzie sie go zmienia.
8. Czy wprowadzamy nazwy z mitu jako etykiety w interfejsie (nic, labirynt, watek), czy mit zostaje wylacznie w warstwie wizualnej. Moja opinia: nazwy funkcjonalne, bo osoba nietechniczna nie ma zgadywac, co znaczy "watek", ale chce to z toba przegadac.

Jesli w audycie znajdziesz cos, o co powinienes zapytac, a czego tu nie ma, pytaj o to tez.

## Czego oczekuje na wyjsciu

Po zamknieciu pytan oddaj komplet w tej kolejnosci:

1. Audyt. Co w brief jest sprzeczne, czego brakuje, ktora z podjetych decyzji uwazasz za bledna i dlaczego.
2. Tokeny. Kolor, typografia, odstepy, promienie, ruch. Kolor w OKLCH z wyliczonym kontrastem kazdej pary tekst na tle. Skala typograficzna z konkretnymi rozmiarami, grubosciami i interliniami, stosunek miedzy stopniami minimum 1.25. Skala odstepow z uzasadnieniem, dlaczego ma tyle stopni.
3. Inwentarz komponentow. Kazdy z nazwa, wariantami, stanami (spoczynek, hover, focus, aktywny, wylaczony, blad) i konkretnymi wartosciami.
4. Osiem ekranow, kazdy jako: jedno zdanie o zadaniu ekranu, szkic ukladu ASCII albo opis siatki, hierarchia z podaniem, co jest pierwsze w kolejnosci czytania, komplet stanow (ladowanie, pusty, blad, przepelniony), i gotowe teksty interfejsu po polsku i po angielsku.
5. Sygnatura. Dokladnie jak dziala nic w kazdym z trzech miejsc, wraz z parametrami animacji i wariantem dla `prefers-reduced-motion`.
6. `DESIGN.md` w formacie Google Stitch: frontmatter YAML z tokenami, potem szesc sekcji o dokladnie tych naglowkach i w tej kolejnosci: Overview, Colors, Typography, Elevation, Components, Do's and Don'ts. Wewnatrz sekcji uzywaj nazwanych regul w postaci "The [Nazwa] Rule." z jednym zdaniem doktryny.
7. Lista tego, czego swiadomie nie zaprojektowales, i kiedy do tego wrocic.

Nie generuj kodu React ani plikow projektu. Front implementuje kto inny na podstawie tego, co oddasz. Potrzebuje specyfikacji, ktora nie zostawia miejsca na domysly co do wartosci, i uzasadnien, ktore pozwola mi ja obronic albo podwazyc.
