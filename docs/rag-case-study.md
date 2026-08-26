# Hybrydowe wyszukiwanie w Ariadne: co zmierzyłem i co z tego wyciąłem

Ariadne to pamięć projektu dla agentów kodujących. Trzyma decyzje i notatki, a Claude Code
pyta ją przez MCP, dlaczego coś zbudowano tak, a nie inaczej. Całość stoi na wyszukiwaniu,
więc kiedy wyszukiwanie myli się o trzy pozycje, agent dostaje nie tę odpowiedź.

Ten dokument opisuje, jak sprawdziłem, czy drugie ramię wyszukiwania faktycznie pomaga,
i dlaczego skończyło się na wycięciu jego najdroższej części.

## 1. Problem

Wyszukiwanie wektorowe rozumie znaczenie. Zamienia pytanie na wektor, zamienia każdy wpis
w archiwum na wektor i szuka tych najbliższych. Dzięki temu "który ORM wybraliśmy" trafia
we wpis mówiący "wybraliśmy Drizzle", mimo że te dwa zdania nie mają wspólnego słowa.

Ta sama właściwość jest jego słabością. Embedding czyta sens i zaciera tożsamość. Notatka,
która nigdy nie pada nazwy `search_text`, leży w przestrzeni wektorowej mniej więcej tak
samo blisko pytania o tę kolumnę jak notatka, która ją wymienia. W archiwum pełnym decyzji
o bazie danych kilkanaście fragmentów wygląda semantycznie identycznie i nic ich nie
rozstrzyga.

Zauważyłem to, patrząc na to, o co Claude Code w ogóle pyta. Prawie zawsze o konkretną
nazwę: funkcję `searchNodes`, migrację `0009`, tabelę `code_anchors`. Czyli dokładnie o to,
w czym embedding jest najsłabszy.

## 2. Hipoteza

Jeśli samo znaczenie nie wystarcza, dołóżmy drugie ramię, które nie patrzy na znaczenie
w ogóle, tylko na litery.

Postgres ma to natywnie: kolumna `tsvector`, indeks GIN, `ts_rank_cd` do sortowania. Zero
nowych zależności. Wyszukiwanie pyta więc dwa razy o to samo, raz o sens i raz o nazwę,
a wyniki scala Reciprocal Rank Fusion: liczy się pozycja na obu listach, nie wynik
punktowy, bo cosine i `ts_rank_cd` to dwie nieporównywalne skale.

Hipoteza brzmiała: to poprawi wyszukiwanie. Nie miałem pojęcia o ile i czy w ogóle.

## 3. Jak mierzyłem

Zbudowałem golden set, czyli zestaw pytań z z góry znaną poprawną odpowiedzią.

Korpus: 180 fragmentów wyciętych z trzech dokumentów projektu. Nie dziesięć wpisów
testowych, bo przy dziesięciu i k=5 połowa archiwum mieści się w wynikach, każdy wariant
dostaje wynik bliski 1.0 i porównanie nic nie mówi.

Pytania: 62, wszystkie napisane ręcznie. To była świadoma decyzja metodologiczna. Model
piszący pytania widzi jeden fragment naraz i z konieczności produkuje bliźniaki, które
potem trzeba odsiewać progiem podobieństwa wziętym z sufitu. Człowiek widzący cały zestaw
naraz po prostu ich nie pisze.

Zestaw dzieli się na dwa rodzaje i to jest cała istota tego pomiaru:

- 40 pytań zwykłą prozą, bez ani jednej nazwy własnej ("Dlaczego odpadł pomysł postawienia
  tego na własnej maszynie od Oracle?"),
- 22 pytania nazywające rzecz po imieniu ("Dlaczego kolumna `search_text` używa
  konfiguracji `simple`, a nie słownika językowego?").

Każde pytanie jest przypięte do dokładnie jednego wpisu. Skrypt przerywa pracę, jeśli
kotwica pasuje do więcej niż jednego fragmentu, bo dwuznaczny klucz odpowiedzi to
dwuznaczny pomiar.

Porównałem trzy warianty na tym samym korpusie i tych samych pytaniach: samo ramię
wektorowe, samo ramię nazw, oraz hybryda.

### Metryki, po ludzku

**recall@1** to odsetek pytań, w których poprawna odpowiedź trafiła na pierwsze miejsce.

**recall@3** to samo, ale liczy się trafienie w pierwszej trójce.

**MRR** to średnia z odwrotności pozycji. Pierwsze miejsce daje 1.0, drugie 0.5, czwarte
0.25, brak trafienia 0. Jedna liczba mówiąca, jak wysoko średnio ląduje poprawna
odpowiedź. Nietrafienie liczy się jako zero, a nie jest pomijane, bo wyszukiwarka
odpowiadająca na jedno pytanie na dziesięć nie może wypaść lepiej od tej, która
odpowiada na dziewięć.

**Latency** to mediana czasu jednego wyszukiwania, razem z wywołaniami do Google.

## 4. Wyniki

Najpierw liczba zbiorcza, ta, którą łatwo pokazać i która najmniej znaczy.

| wariant | recall@1 | recall@3 | MRR | mediana czasu |
| --- | --- | --- | --- | --- |
| wektor | 77% | 95% | 0.859 | 351 ms |
| hybryda | 79% | 95% | 0.866 | 856 ms |

Dwa punkty procentowe. Wygląda na to, że drugie ramię prawie nic nie wnosi, a czas
podwaja. Gdybym skończył tutaj, wyciąłbym je i miałbym na to twarde dane.

Podział na dwa rodzaje pytań pokazuje coś zupełnie innego.

### Zwykła proza, 40 pytań

| wariant | recall@1 | recall@3 | MRR |
| --- | --- | --- | --- |
| wektor | 78% | 98% | 0.867 |
| hybryda | 73% | 93% | 0.822 |

Hybryda tu szkodzi. Ramię nazw milczy w 83% tych pytań, bo nie ma czego szukać, ale w tych
kilku, w których się odzywa, wrzuca do fuzji przypadkowe dopasowania i spycha poprawną
odpowiedź w dół.

### Pytania z identyfikatorem, 22 pytania

| wariant | recall@1 | recall@3 | MRR |
| --- | --- | --- | --- |
| wektor | 77% | 91% | 0.845 |
| hybryda | 91% | 100% | 0.947 |

Ten sam mechanizm, ta sama baza, odwrotny wynik.

## 5. Co naprawdę pokazały dane

Najważniejszego wniosku nie widać w żadnej z tabel powyżej, dopóki nie spojrzy się na
recall@10.

Na pytaniach z identyfikatorem recall@10 wynosi 100% dla wektora i 100% dla hybrydy.
Wektor i tak znajdował poprawną odpowiedź, jeśli patrzeć na dziesięć wyników. Hybryda nie
znalazła ani jednej rzeczy, której wektor by nie znalazł.

**Ona nie znajduje więcej. Ona układa lepiej.**

To zmienia sens całego eksperymentu. Drugie ramię nie rozszerza zasięgu wyszukiwania,
tylko rozstrzyga kolejność tam, gdzie wektor sam nie umie zdecydować.

Najczystszy przykład z całego zestawu to pytanie o to, dlaczego kolumna `search_text` używa
konfiguracji `simple`:

| wariant | pozycja poprawnej odpowiedzi |
| --- | --- |
| wektor | 6 |
| nazwy | 1 |
| hybryda | 1 |

Wektor doskonale zrozumiał, że pytanie dotyczy konfiguracji indeksu tekstowego. Problem
w tym, że w tym archiwum jest kilkanaście fragmentów o schemacie bazy i wszystkie znaczą
mniej więcej to samo. Nazwa `search_text` jest jednoznaczna tam, gdzie znaczenie
jednoznaczne nie jest. Wystarczyła jako rozstrzygnięcie.

I dlatego RRF działa: kiedy dwie niezależne metody wskazują ten sam wpis, sama ich zgodność
jest sygnałem trafności. Nic więcej się w tym nie dzieje.

## 6. Gdzie hybryda naprawdę ma znaczenie

Wyszukiwanie jest wołane z trzech miejsc i odpowiedź jest inna dla każdego.

**Claude Code przez MCP.** To najważniejszy przypadek. Agent pyta o `searchNodes`, o
migrację `0009`, o `code_anchors`, czyli niemal wyłącznie pytaniami z identyfikatorem.
Kolejność ma tu ogromne znaczenie, bo agent często zaczyna działać na pierwszym trafieniu
i nie czyta reszty. Pół sekundy w turze agenta trwającej kilkadziesiąt sekund jest
niewidoczne.

**Czat w aplikacji.** Do promptu trafia pięć wpisów, więc liczy się recall@5, nie recall@1.
Tam różnica jest mała: 98% wobec 95% na prozie, 95% wobec 100% na identyfikatorach. Czas
też nie boli, bo zaraz po wyszukiwaniu i tak rusza generowanie odpowiedzi liczone
w sekundach.

**Endpoint `POST /search`.** Najsłabszy przypadek. Człowiek wpisuje zapytanie i czeka na
listę, więc opóźnienie jest w pełni odczuwalne. To też miejsce, gdzie najczęściej padają
pytania prozą, czyli te, dla których ramię nazw daje najmniej.

## 7. Koszt latency

Pełna hybryda podniosła medianę wyszukiwania z 351 ms do 856 ms.

To jest quality-latency trade-off: płacisz czasem odpowiedzi za lepszy ranking. Zwykle nie
da się mieć obu naraz i pytanie brzmi tylko, ile jesteś gotów zapłacić i za co.

Kiedy zobaczyłem, skąd te 500 ms się bierze, pytanie zrobiło się dużo ciekawsze. Nazwy
w zapytaniu wyciągały dwa mechanizmy:

- **regex** (`literalsByShape`), rozpoznający kształt: `snake_case`, `camelCase`, ścieżki,
  pliki z rozszerzeniem, hashe commitów. Praktycznie darmowy,
- **tani model LLM** (`extractLiterals`), łapiący nazwy, których kształt nie zdradza.
  Około 500 ms.

Przejrzałem 22 pytania z identyfikatorem: regex sam radzi sobie z jakimiś siedemnastoma.
Model był potrzebny tylko dla nazw wyglądających jak zwykłe słowa: `react-force-graph`,
CORS, MCP Inspector, RLS, React Flow.

Czyli płaciliśmy pół sekundy przy każdym wyszukiwaniu, żeby obsłużyć jeden przypadek na
pięć. I to nie przy co piątym wyszukiwaniu, tylko przy każdym: pytanie prozą też czekało na
model, który po zastanowieniu zwracał pustą listę.

## 8. Decyzja architektoniczna

Wyciąłem model. Zostaje hybryda: wektory plus dopasowanie leksykalne oparte na regexie.

To nie jest rozwiązanie optymalne matematycznie i nie chcę go tak przedstawiać. To
kompromis produktowy. Tracimy nazwy bez charakterystycznego kształtu, czyli mniej więcej
jeden przypadek na pięć wśród pytań, które w ogóle coś nazywają. W zamian każde
wyszukiwanie w produkcie przestaje płacić pół sekundy, a znika też cała klasa awarii: model
w tym miejscu był owinięty w połykanie błędów, żeby wyszukiwanie nie padało przez nieudane
rozpoznanie nazwy, więc jego limit albo awaria cicho pogarszały wyniki i nic tego nie
sygnalizowało.

Uczciwe zastrzeżenie: **finalnej architektury nie zmierzyłem osobnym benchmarkiem.** Liczby
w tym dokumencie opisują hybrydę z modelem. Wariant regexowy to decyzja podjęta na
podstawie rozkładu tych 22 pytań, nie na podstawie własnego przebiegu. Harness stoi
w repozytorium i domierzenie tego jest kwestią jednego uruchomienia, jeśli kiedyś będzie
warto.

## 9. Czego nauczył mnie ten benchmark

Najcenniejsze nie było "hybryda jest lepsza" ani "hybryda jest gorsza". Najcenniejsze było
to, że **odpowiedź zależy od rodzaju zapytania, a zagregowana liczba to ukrywa.**

Gdybym napisał tylko 40 pytań prozą, wniosek brzmiałby: ramię leksykalne szkodzi, wyciąć.
Gdybym napisał tylko 22 z nazwami, wniosek brzmiałby: ramię leksykalne to duży zysk,
zostawić i nie dotykać. Oba byłyby uczciwie zmierzone na własnym zestawie i oba byłyby
fałszywe dla produktu.

Zbiorcze +2 punkty procentowe to średnia z −5 i +14. Jedna liczba pokazująca "delikatną
poprawę" tam, gdzie naprawdę dzieje się rozjazd o dwadzieścia punktów w przeciwnych
kierunkach.

Wniosek praktyczny: golden set musi odzwierciedlać realne typy ruchu w produkcie, a nie być
przypadkową listą pytań. I trzeba raportować wyniki w podziale na te typy, bo dopiero wtedy
da się przeliczyć wynik na dowolny rozkład ruchu bez powtarzania pomiaru.

Druga rzecz, mniej efektowna, ale kosztowała mnie więcej: pomiar sam może być zepsuty
w sposób niewidoczny w wyniku. Model wyciągający nazwy połykał własne błędy, więc limit
Google dawał puste nazwy i ramię leksykalne wypadało gorzej, niż jest naprawdę, bez śladu
w tabeli. Dołożyłem do raportu kontrolę: ile pytań z identyfikatorem dostało od ramienia
nazw pustą odpowiedź. Wyszło 0 z 22, więc liczby są wiarygodne. Gdyby wyszło 8, cały
dokument byłby do wyrzucenia.

## 10. Finalna architektura

```
pytanie
  |
  +-- embedding (gemini-embedding-001, 768 wymiarów)
  |     -> 20 kandydatów po cosine distance (pgvector, indeks HNSW)
  |
  +-- regex na kształt identyfikatora
        -> 20 kandydatów po search_text (tsvector + GIN, ts_rank_cd)
  |
  scalenie po pozycji (RRF, damping 60)
  |
  przycięcie do k
```

Jedno wywołanie modelu na wyszukiwanie zamiast dwóch. Ramię leksykalne w całości na
Postgresie, bez dodatkowych zależności. Pytanie, które nie nazywa niczego, pomija drugie
ramię i wtedy całość jest dokładnie tym wyszukiwaniem, którym była, zanim je dołożyłem.

Pomiar jest odtwarzalny: `backend/scripts/eval-corpus.ts` buduje korpus,
`eval-questions.ts` rozwiązuje golden set, `eval-search.ts` liczy tabele. Wyniki lądują
w `backend/eval/results.md`.

---

# Hybrid search in Ariadne: what I measured and what I cut

Ariadne is project memory for coding agents. It stores decisions and notes, and Claude Code
queries it over MCP to find out why something was built the way it was. The whole thing
rests on search, so when search is wrong by three positions, the agent gets the wrong
answer.

This is how I checked whether the second search arm actually helps, and why it ended with
cutting out its most expensive part.

## 1. The problem

Vector search understands meaning. It turns the question into a vector, turns every entry
in the archive into a vector, and looks for the closest ones. That's how "which ORM did we
pick" finds an entry saying "we went with Drizzle", even though the two sentences share no
words.

That same property is its weakness. An embedding reads sense and blurs identity. A note
that never mentions the `search_text` column sits about as close in vector space to a
question about that column as a note that names it. In an archive full of database
decisions, a dozen fragments look semantically identical and nothing tells them apart.

I noticed it by looking at what Claude Code actually asks about. Almost always a specific
name: the `searchNodes` function, migration `0009`, the `code_anchors` table. Exactly where
embeddings are weakest.

## 2. The hypothesis

If meaning alone isn't enough, add a second arm that doesn't look at meaning at all, only
at letters.

Postgres does this natively: a `tsvector` column, a GIN index, `ts_rank_cd` for ranking.
No new dependencies. Search asks the same question twice, once by sense and once by name,
and merges the results with Reciprocal Rank Fusion: position on both lists counts, not the
score, because cosine and `ts_rank_cd` are two incomparable scales.

The hypothesis was that this would improve search. I had no idea by how much, or whether at
all.

## 3. How I measured it

I built a golden set: questions with a known correct answer.

Corpus: 180 fragments cut from three project documents. Not ten test entries, because with
ten and k=5 half the archive fits into the results, every variant scores near 1.0 and the
comparison says nothing.

Questions: 62, all hand-written. That was a deliberate methodological choice. A model
writing questions sees one fragment at a time and produces twins out of necessity, which
then have to be sieved out with a similarity threshold pulled out of thin air. A person
looking at the whole set at once simply doesn't write them.

The set splits into two kinds, and that split is the heart of the measurement:

- 40 questions in plain prose, with no proper name in them ("Why was running this on our
  own Oracle box dropped?"),
- 22 questions naming something specific ("Why does the `search_text` column use the
  `simple` configuration instead of a language dictionary?").

Every question is pinned to exactly one entry. The script halts if an anchor matches more
than one fragment, because an ambiguous answer key is an ambiguous measurement.

I compared three variants over the same corpus and the same questions: the vector arm
alone, the name arm alone, and the hybrid.

### The metrics, in plain terms

**recall@1** is the share of questions where the correct answer landed in first place.

**recall@3** is the same, but a hit anywhere in the top three counts.

**MRR** is the mean reciprocal rank. First place scores 1.0, second 0.5, fourth 0.25, a
miss 0. One number for how high the correct answer lands on average. A miss counts as zero
rather than being skipped, because a search that answers one question in ten must not score
better than one that answers nine.

**Latency** is the median time of one search, including the calls to Google.

## 4. Results

The aggregate number first. It's the easy one to show and the least meaningful.

| variant | recall@1 | recall@3 | MRR | median time |
| --- | --- | --- | --- | --- |
| vector | 77% | 95% | 0.859 | 351 ms |
| hybrid | 79% | 95% | 0.866 | 856 ms |

Two percentage points. It looks like the second arm adds almost nothing and doubles the
time. If I'd stopped here I would have cut it, with hard data to back me up.

Splitting the questions by kind shows something else entirely.

### Plain prose, 40 questions

| variant | recall@1 | recall@3 | MRR |
| --- | --- | --- | --- |
| vector | 78% | 98% | 0.867 |
| hybrid | 73% | 93% | 0.822 |

The hybrid hurts here. The name arm stays silent on 83% of these questions because there's
nothing to look for, but in the few where it does speak up, it throws accidental matches
into the fusion and pushes the correct answer down.

### Questions with identifiers, 22 questions

| variant | recall@1 | recall@3 | MRR |
| --- | --- | --- | --- |
| vector | 77% | 91% | 0.845 |
| hybrid | 91% | 100% | 0.947 |

Same mechanism, same database, opposite result.

## 5. What the data actually showed

The most important finding isn't visible in any table above until you look at recall@10.

On questions with identifiers, recall@10 is 100% for vector and 100% for hybrid. Vector was
finding the correct answer anyway, if you look at ten results. The hybrid didn't find a
single thing vector missed.

**It doesn't find more. It orders better.**

That changes what the whole experiment means. The second arm doesn't widen search reach, it
settles the ordering where vector can't decide on its own.

The cleanest example in the set is the question about why the `search_text` column uses the
`simple` configuration:

| variant | position of the correct answer |
| --- | --- |
| vector | 6 |
| names | 1 |
| hybrid | 1 |

Vector understood perfectly well that the question was about text index configuration. The
trouble is that this archive holds a dozen fragments about the database schema and they all
mean roughly the same thing. The name `search_text` is unambiguous where the meaning isn't.
That was enough to settle it.

And that's why RRF works: when two independent methods point at the same entry, their
agreement is itself a relevance signal. Nothing more clever than that is going on.

## 6. Where the hybrid actually matters

Search is called from three places and the answer differs for each.

**Claude Code over MCP.** The most important case. The agent asks about `searchNodes`,
migration `0009`, `code_anchors`, which is almost entirely identifier questions. Ordering
matters enormously here, because the agent often starts acting on the first hit and never
reads the rest. Half a second inside an agent turn that runs for tens of seconds is
invisible.

**Chat in the app.** Five entries go into the prompt, so recall@5 is what counts, not
recall@1. The difference there is small: 98% against 95% on prose, 95% against 100% on
identifiers. The time doesn't hurt either, because answer generation starts right after
search and takes seconds.

**The `POST /search` endpoint.** The weakest case. A person types a query and waits for a
list, so the delay is fully felt. It's also where prose questions show up most, which is
the type the name arm helps least with.

## 7. The latency cost

The full hybrid pushed the median search from 351 ms to 856 ms.

That's a quality-latency trade-off: you pay in response time for better ranking. You
usually can't have both, and the only question is how much you're willing to pay and for
what.

Once I saw where those 500 ms came from, the question got a lot more interesting. Names
were pulled out of the query by two mechanisms:

- **regex** (`literalsByShape`), matching by shape: `snake_case`, `camelCase`, paths, files
  with extensions, commit hashes. Effectively free,
- **a cheap LLM** (`extractLiterals`), catching names whose shape gives nothing away. About
  500 ms.

I went through the 22 identifier questions: the regex handles roughly seventeen on its own.
The model was only needed for names that look like ordinary words: `react-force-graph`,
CORS, MCP Inspector, RLS, React Flow.

So we were paying half a second on every search to cover one case in five. And not on every
fifth search, but on every single one: a prose question waited for the model too, which
thought about it and returned an empty list.

## 8. The architectural decision

I cut the model. What stays is the hybrid: vectors plus regex-based lexical matching.

This isn't the mathematically optimal answer and I don't want to present it as one. It's a
product trade-off. We lose names without a distinctive shape, roughly one case in five
among questions that name anything at all. In exchange every search in the product stops
paying half a second, and a whole failure class disappears with it: the model there was
wrapped in error swallowing so that search wouldn't fail when name extraction did, which
meant its rate limits and outages quietly degraded results with nothing to signal it.

An honest caveat: **I did not benchmark the final architecture separately.** The numbers in
this document describe the hybrid with the model in it. The regex-only variant is a
decision made from the distribution of those 22 questions, not from a run of its own. The
harness is in the repository and measuring it is one command away, if it ever becomes worth
doing.

## 9. What the benchmark taught me

The valuable part wasn't "the hybrid is better" or "the hybrid is worse". The valuable part
was that **the answer depends on the kind of query, and an aggregate number hides that.**

Had I written only the 40 prose questions, the conclusion would have been: the lexical arm
hurts, cut it. Had I written only the 22 with names, it would have been: the lexical arm is
a big win, keep it and don't touch it. Both would have been honestly measured on their own
set and both would have been false for the product.

The aggregate +2 percentage points is the average of −5 and +14. One number reading as a
slight improvement where a twenty-point split in opposite directions is actually happening.

The practical takeaway: a golden set has to mirror the real traffic types in the product,
not be a random list of questions. And results have to be reported per type, because only
then can you recompute the outcome for any traffic mix without repeating the measurement.

The second lesson is less flashy but cost me more: the measurement itself can be broken in
a way the result doesn't show. The name extraction model swallowed its own errors, so a
Google rate limit produced empty names, the lexical arm scored worse than it really is, and
nothing in the table said so. I added a check to the report: how many identifier questions
got an empty response from the name arm. It came out 0 of 22, so the numbers hold. Had it
come out 8, the whole document would have been worthless.

## 10. Final architecture

```
question
  |
  +-- embedding (gemini-embedding-001, 768 dimensions)
  |     -> 20 candidates by cosine distance (pgvector, HNSW index)
  |
  +-- regex on identifier shape
        -> 20 candidates by search_text (tsvector + GIN, ts_rank_cd)
  |
  fusion by position (RRF, damping 60)
  |
  trim to k
```

One model call per search instead of two. The lexical arm entirely inside Postgres, no
extra dependencies. A question that names nothing skips the second arm, and then the whole
thing is exactly the search it was before I added it.

The measurement is reproducible: `backend/scripts/eval-corpus.ts` builds the corpus,
`eval-questions.ts` resolves the golden set, `eval-search.ts` computes the tables. Results
land in `backend/eval/results.md`.
