# Roadmapa MVP Fizjoluj

**Status.** Etap 1 ukończony. Następny etap dotyczy kont, członkostwa i uprawnień. Kolejne etapy mają proponowany zakres, ścieżki i kryteria odbioru. Szczegółowa lista plików trafia do zatwierdzenia przed implementacją każdego etapu. Zasady pracy znajdują się w [AGENTS.md](AGENTS.md), a architektura i ryzyka w [PROJECT.md](PROJECT.md).

## Cel wydania

Student z Poznania lub Szczecina może założyć konto, uzyskać dostęp do materiałów pierwszego roku 2026/2027, uczyć się z fiszek i powtórek, rozwiązać quiz i egzamin próbny, wrócić do własnej historii oraz sprawdzić terminy. Administrator może przygotować materiał ręcznie lub przez import JSON, sprawdzić szkic, opublikować go, dodać wydarzenie i zarządzać dostępem studentów. Główne zadania działają na telefonie i komputerze.

## 1. Lokalny szkielet aplikacji — ukończony

**Zakres i kolejność prac**

1. Dobrać kompatybilne stabilne wersje Node.js i zależności. Proponowany menedżer pakietów to npm z zapisanym plikiem blokady.
2. Utworzyć szkielet Next.js z App Routerem pod `src/`, Reactem, ścisłym TypeScriptem i ESLintem. Skonfigurować Tailwind CSS i bazę shadcn/ui. [Instalacja Next.js](https://nextjs.org/docs/app/getting-started/installation) · [shadcn/ui dla Next.js](https://ui.shadcn.com/docs/installation/next)
3. Przygotować stronę `/` z nazwą Fizjoluj, ustawieniem języka `pl`, podstawowymi stylami i układem działającym na telefonie i komputerze.
4. Dodać skrypty `dev`, `lint`, `typecheck` i `build`. Opisać wymagania i lokalne uruchamianie w `README.md`. Zainicjować lokalne repozytorium Git, aby kolejne etapy od początku miały historię zmian.
5. Uruchomić dostępne testy, lint, sprawdzenie typów i kompilację. Otworzyć stronę lokalnie i sprawdzić widok mobilny oraz desktopowy.

**Pliki do utworzenia**

| Pliki | Przeznaczenie |
| --- | --- |
| `package.json`, `package-lock.json` | Zależności, wymagania środowiskowe, skrypty i powtarzalna instalacja. |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` | Konfiguracja Next.js, TypeScriptu i ESLinta. |
| `postcss.config.mjs`, `components.json`, `src/lib/utils.ts` | Konfiguracja Tailwind CSS i shadcn/ui oraz funkcja łączenia klas. |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Główny układ, polskojęzyczna strona startowa i style. |
| `.gitignore`, `README.md` | Reguły ignorowania plików lokalnych i instrukcja uruchomienia. |

Git utworzy `.git/`, a Next.js wygeneruje lokalnie `next-env.d.ts` i katalog kompilacji `.next/`. Odbiór obejmuje lokalną stronę startową i konfigurację szkieletu. Konta, baza danych, katalog i wdrożenie mają własne etapy.

**Kryteria odbioru.** Instalacja z pliku blokady i lokalne uruchomienie działają. Strona ma polskie ustawienie języka i mieści się w obu rozmiarach widoku. `npm run lint`, `npm run typecheck` i `npm run build` kończą się powodzeniem.

## 2. Konta, członkostwo i uprawnienia

**Zależność.** Etap 1 i decyzja o organizacji pilotażu oraz zasadach nadawania dostępu.

- Skonfigurować Supabase Auth, sesję serwerową i wydzielone środowisko robocze. Propozycja na MVP obejmuje rejestrację i logowanie e-mailem oraz hasłem, potwierdzenie adresu, odzyskanie dostępu i wylogowanie.
- Dodać migracje dla roli, profilu, uczelni, lokalizacji, rocznika i członkostwa. Ustalić sposób nadania pierwszej roli administratora. Przygotować panel do przydzielania zakresu dostępu oraz jego nadawania i odbierania.
- Włączyć jawne uprawnienia i RLS. Sprawdzić zachowanie gościa, dwóch różnych studentów, konta z odebranym dostępem i administratora.

**Planowane ścieżki.** `.env.example`, `src/app/(public)/`, `src/app/auth/`, chronione układy w `src/app/(student)/` i `src/app/(admin)/admin/`, `src/features/auth/`, `src/lib/supabase/`, `src/types/`, `supabase/migrations/`, `supabase/tests/`.

**Kryteria odbioru.** Student rejestruje się i loguje. Administrator nadaje i odbiera dostęp. Własna sesja studenta umożliwia odczyt danych zgodnie z przydziałem. Próba zmiany własnej roli albo odczytu cudzego profilu kończy się odmową. Odebranie dostępu działa także przy istniejącej sesji.

## 3. Katalog studiów i panel przedmiotów

**Zależność.** Etap 2 i uzgodniona reguła widoczności wspólnego katalogu.

- Zdefiniować hierarchię roku studiów, semestru, przedmiotu, działu i tematu. Zapisać kolejność i stabilne identyfikatory oraz zakres udostępnienia programu na rok akademicki.
- Udostępnić administratorowi tworzenie i aktualizację struktury, w tym ustawienie dostępności semestru. Przygotować odczyt katalogu z kontrolą widoczności całej ścieżki. Treść tematu stanie się dostępna po publikacji w etapie 4.
- Dodać panel studenta z listą przedmiotów i nawigacją do katalogu oraz stanem dla użytkownika bez dostępnych materiałów.

**Planowane ścieżki.** `src/features/catalog/`, `src/app/(student)/`, `src/app/(admin)/admin/`, `supabase/migrations/`, `supabase/tests/`.

**Kryteria odbioru.** Administrator zapisuje pełną hierarchię, a student widzi pozycje udostępnione jego członkostwu. Konfiguracja 2026/2027 udostępnia wyłącznie pierwszy rok. Bezpośredni odczyt ukrytej pozycji kończy się odmową. Można dodać kolejny semestr przez dane i konfigurację dostępności.

## 4. Redakcja, podgląd i publikacja

**Zależność.** Etap 3 oraz uzgodniony format notatek, ilustracji i materiałów pomocniczych. Model redakcji wymaga też ustalenia pierwszych typów pytań, sposobu zapisu poprawnych odpowiedzi i tożsamości fiszek.

- Dodać edytor tematu z notatkami, wyjaśnieniami, wskazówkami, ilustracjami i materiałami pomocniczymi. Udostępnić formularze do tworzenia oraz edycji fiszek i quizów. Przechowywać pliki wymagające autoryzacji z kontrolą dostępu, proponując prywatny zasobnik Supabase Storage. [Kontrola dostępu w Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control)
- Zaimplementować wersje tematu i powiązanych materiałów, zapis szkicu, podgląd z widoku administratora i osobne zatwierdzenie publikacji. Uzgodnić zasady wycofywania, które zachowują wymagane odniesienia historyczne. Ograniczyć odczyt klucza odpowiedzi już podczas wprowadzania modelu pytań.
- Udostępnić studentowi widok opublikowanego tematu. Tryby nauki z fiszek i rozwiązywania zestawów pojawiają się w etapach 6 i 7.

**Planowane ścieżki.** `src/features/editorial/`, `src/features/catalog/`, trasy w `src/app/(admin)/admin/` i `src/app/(student)/`, `supabase/migrations/`, `supabase/tests/`.

**Kryteria odbioru.** Administrator zapisuje i sprawdza szkic, po czym publikuje materiał. Studenci widzą dotychczasową wersję w trakcie edycji oraz pełną nową wersję po publikacji. Próba odczytu szkicu lub jego pliku przez studenta kończy się odmową. Niepowodzenie publikacji zachowuje poprzedni stan.

## 5. Import materiałów z JSON

**Zależność.** Etap 4 i uzgodniony kontrakt pierwszej wersji importu.

- Opisać wersję schematu, stabilne identyfikatory, dopuszczalne typy treści i sposób wiązania pakietu z katalogiem. Zweryfikować format na reprezentatywnym, dostarczonym przez administratora pakiecie.
- Zaimplementować walidację serwerową struktury, ograniczeń rozmiaru, powiązań, duplikatów i konfliktów. Pokazać błędy z położeniem w pliku oraz podgląd wpisów do utworzenia lub aktualizacji.
- Zastosować pakiet w jednej transakcji jako szkic i ponownie sprawdzić warunki zapisu, jeśli katalog zmienił się od podglądu. Publikacja odbywa się w ustalonym przepływie redakcyjnym.

**Planowane ścieżki.** `src/features/editorial/import/`, trasa importu w `src/app/(admin)/admin/`, `supabase/migrations/`, `supabase/tests/`, dokumentacja kontraktu w `docs/`.

**Kryteria odbioru.** Można zweryfikować, podejrzeć i zapisać pakiet. Błędny plik, konflikt z późniejszą edycją lub błąd zapisu pozostawia poprzedni stan. Ponowny import identycznego pakietu daje ten sam stan. Student widzi skutki dopiero po publikacji.

## 6. Fiszki, powtórki i postęp

**Zależność.** Etap 4 oraz uzgodnione zasady postępu i powtórek. Etap 5 zapewnia drugi sposób wprowadzania fiszek.

- Dodać sesję fiszek z pokazaniem odpowiedzi i samooceną. Ustalić prosty harmonogram powtórek z deterministycznym wyliczeniem następnego terminu i regułą traktowania zmienionych fiszek.
- Zapisywać ocenę i termin w jednej operacji. Rozróżnić nowe oceny od ponowień tego samego żądania i ustalić zachowanie w razie oceny tej samej fiszki na dwóch urządzeniach.
- W panelu pokazać liczbę powtórek i postępy przedmiotów. Proponowany wskaźnik to liczba tematów oznaczonych przez studenta jako ukończone względem liczby tematów dostępnych. W historii pokazać odbyte powtórki.

**Planowane ścieżki.** `src/features/learning/`, `src/app/(student)/`, `supabase/migrations/`, `supabase/tests/`, `tests/`.

**Kryteria odbioru.** Po ocenie fiszki kolejka i historia odzwierciedlają zapis także po ponownym logowaniu. Dwa konta uczące się z tej samej fiszki mają niezależne terminy i wyniki. Ponowienie oceny zapisuje jeden wpis. Przypadek równoległej oceny ma przewidywalny wynik.

## 7. Quizy, egzaminy próbne i wyniki

**Zależność.** Etap 4 oraz uzgodnione typy pytań, punktacja i zakres informacji zwrotnej po oddaniu. Etap 6 dostarcza widoki postępów i historii.

- Udostępnić quiz tematyczny oraz prosty egzamin próbny jako opublikowany zestaw pytań z kilku tematów jednego przedmiotu. Dodać wybór tematów i konfigurację zestawu po stronie administratora.
- Zapisać wersję zestawu przypisaną do rozpoczętej próby. Oceniać odpowiedzi po stronie serwera i utrwalać wynik wraz z odniesieniem do tej wersji. Udostępniać pytania i opcje z pominięciem klucza oceniania do momentu oddania próby.
- Rozszerzyć panel i historię o próby oraz wyniki quizów i egzaminów. Określić zachowanie przy ponownym przesłaniu rozwiązania tej samej próby.

**Planowane ścieżki.** `src/features/assessments/`, `src/features/editorial/`, `src/app/(student)/`, `src/app/(admin)/admin/`, `supabase/migrations/`, `supabase/tests/`, `tests/`.

**Kryteria odbioru.** Student oddaje quiz oraz egzamin próbny i widzi oba wyniki we własnej historii. Próba zachowuje wynik po edycji zestawu. Ponowne przesłanie tej samej próby daje ten sam wynik. Uprawnienia bazy i operacji serwerowych chronią klucz odpowiedzi, cudze wyniki i zapis punktacji.

## 8. Kalendarz zaliczeń i egzaminów

**Zależność.** Etap 2 oraz uzgodniony zakres widoczności wydarzeń.

- Dodać panel wydarzeń z tytułem, rodzajem, terminem, powiązaniem z przedmiotem tam, gdzie ma zastosowanie, oraz zakresem uczelni, lokalizacji lub rocznika.
- Przygotować przegląd nadchodzących terminów z obsługą dat całodniowych i wydarzeń godzinowych. Przyjąć `Europe/Warsaw` jako strefę wyświetlania wydarzeń godzinowych w MVP.
- Przetestować widoczność w obu lokalizacjach, zmiany terminów i daty w okolicach zmiany czasu.

**Planowane ścieżki.** `src/features/calendar/`, `src/app/(student)/`, `src/app/(admin)/admin/`, `supabase/migrations/`, `supabase/tests/`, `tests/`.

**Kryteria odbioru.** Administrator tworzy i aktualizuje wydarzenia. Student widzi terminy przypisane do jego zakresu, również gdy wydarzenie jest całodniowe. Wspólne wydarzenie wyświetla się w obu lokalizacjach, a wydarzenie lokalne w przypisanej lokalizacji.

## 9. Odbiór i pilotaż

**Zależność.** Odbiór etapów 1–8, rzeczywiste materiały pierwszego roku, uzgodnione zasady dostępu i gotowe środowiska.

- Przygotować repozytorium GitHub, powtarzalne sprawdzenia przy zmianach oraz konfigurację wdrożeń Vercel i Supabase zgodną z przyjętym podziałem środowisk. Sprawdzić migrację od pustej bazy i procedurę odtworzenia danych.
- Przejść pełny proces w środowisku testowym. Administrator przygotowuje i publikuje materiał oraz konfiguruje kalendarz. Studenci z obu lokalizacji rejestrują się, uczą, zapisują własne wyniki i otrzymują odpowiednie terminy. Sprawdzić izolację danych, podstawy dostępności i wydajność najczęstszych operacji przy obciążeniu reprezentatywnym dla pilotażu.
- Po odbiorze udostępnić pilotaż dla ustalonej grupy z Poznania i Szczecina. Pakiet startowy obejmuje rzeczywiste, zatwierdzone materiały pierwszego roku i właściwe terminy.

**Planowane ścieżki.** `README.md`, `.github/workflows/`, `tests/`, dokumentacja wdrożenia i odtworzenia w `docs/`. Ustawienia projektów GitHub, Vercel i Supabase wymagają uzgodnienia w planie etapu.

**Kryteria odbioru.** Testy, lint, sprawdzenie typów i kompilacja przechodzą. Dwa konta studenckie z różnych lokalizacji oraz konto administratora przechodzą uzgodnione scenariusze w tym samym wydaniu. Środowisko pilotażu ma zatwierdzony katalog i potwierdzony sposób przywracania danych.

## Decyzje do zatwierdzenia przed właściwym etapem

| Przed etapem | Decyzja |
| --- | --- |
| 2 | Potwierdzenie, czy Poznań i Szczecin są lokalizacjami jednej uczelni. Wybór reguły nadawania dostępu po rejestracji, przypisania lokalizacji i rocznika oraz utworzenia pierwszego administratora. |
| 3–4 | Potwierdzenie wspólnego katalogu i zasad publikacji oraz wycofania. Ustalenie formatów notatek i załączników, typów pytań, zapisu poprawnych odpowiedzi i tożsamości fiszek. |
| 5 | Dostarczenie próbki JSON i ustalenie, jak rzeczywiste źródło identyfikuje materiały oraz ich aktualizacje. |
| 6–7 | Definicja ukończenia tematu, reguły powtórek, zakres egzaminu próbnego, punktacja i informacja zwrotna. |
| 8 | Potwierdzenie, które wydarzenia są wspólne, a które przypisywane do lokalizacji lub rocznika. |
| 9 | Dostępność materiałów, podział środowisk, zasady przechowywania danych i sposób udostępnienia pilotażu. |

Przed rozpoczęciem **etapu 2** uzgadniamy organizację pilotażu i zasady nadawania dostępu, a następnie zatwierdzamy plan implementacji. Uruchomienie kolejnych etapów następuje po odbiorze zależności i zatwierdzeniu ich planów.
