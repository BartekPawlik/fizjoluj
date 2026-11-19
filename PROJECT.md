# Fizjoluj

Fizjoluj to polskojęzyczna platforma edukacyjna dla studentów fizjoterapii na pięcioletnich studiach magisterskich. Pomaga znaleźć materiały do zajęć, powtarzać wiedzę i śledzić własne przygotowania do zaliczeń oraz egzaminów. Pierwszą wersją jest responsywna aplikacja internetowa projektowana od widoku mobilnego.

## Zakres uruchomienia

- Pierwsza edycja w roku akademickim **2026/2027** obejmuje materiały **pierwszego roku studiów** dla około 500 użytkowników w Poznaniu i Szczecinie.
- Docelowy program obejmuje pięć lat i dziesięć semestrów. Administrator dodaje kolejne semestry, przedmioty i rzeczywiste materiały zgodnie z rozwojem programu. Katalog studenta pokazuje materiały opublikowane i dostępne dla jego członkostwa. W razie braku treści pokazuje komunikat o braku dostępnych materiałów.
- PWA, aplikacja mobilna i automatyczne generowanie fiszek z PDF w aplikacji są planami rozwoju po MVP. Materiały wspomagane przez AI mogą powstawać poza Fizjoluj i trafiają do redakcji poprzez import JSON.

## Użytkownicy i funkcje

| Rola | Funkcje |
| --- | --- |
| Student | Rejestracja i logowanie, panel przedmiotów i postępów, przeglądanie materiałów, fiszki i powtórki rozłożone w czasie, quizy i egzaminy próbne, własne wyniki i historia nauki, kalendarz zaliczeń oraz egzaminów. |
| Administrator | Zarządzanie przedmiotami, działami i tematami oraz dostępnością semestrów. Tworzenie i edycja notatek, fiszek i quizów, import JSON, podgląd, zapis szkiców i publikacja zatwierdzonych treści. Zarządzanie wydarzeniami i dostępem użytkowników. |

Tylko administrator zarządza wspólnymi materiałami i kalendarzem. Każdy student ma własne postępy, terminy powtórek i historię wyników.

## Model edukacyjny i organizacyjny

**Rok studiów → Semestr → Przedmiot → Dział → Temat.** Temat może zawierać notatki i wyjaśnienia, wskazówki ułatwiające zapamiętywanie, ilustracje i inne materiały pomocnicze, fiszki pytanie–odpowiedź oraz quizy i testy. W roadmapie egzamin próbny jest zestawem pytań z kilku tematów jednego przedmiotu.

Rok studiów oznacza etap programu, rok akademicki oznacza okres jego realizacji, a rocznik określa rok rozpoczęcia studiów. Student uzyskuje dostęp w ramach członkostwa powiązanego z uczelnią, lokalizacją i rocznikiem. Model powinien umożliwić późniejsze uwzględnienie grup. Katalog, zasady jego udostępniania i przynależność studenta stanowią odrębne elementy modelu. Dzięki temu dwie lokalizacje mogą korzystać z tego samego materiału, a własne wydarzenia przypisać do odpowiedniego grona.

Robocze założenie do potwierdzenia przed wdrożeniem kont to jedna uczelnia z lokalizacjami w Poznaniu i Szczecinie. Pilotaż zakłada wspólny katalog pierwszego roku oraz możliwość zawężenia wydarzeń do lokalizacji lub rocznika. Reguły nadawania dostępu i współdzielenia materiałów wymagają decyzji przed migracjami, które je egzekwują. Kolejne decyzje opisuje [roadmapa MVP](ROADMAP.md).

## Architektura aplikacji

- **Aplikacja.** Jeden projekt Next.js z App Routerem, Reactem i TypeScriptem, wdrażany na Vercel. Tailwind CSS i shadcn/ui zapewniają bazę dla responsywnego interfejsu. Grupy tras porządkują publiczne strony, część studencką i panel administratora. [Organizacja projektu w Next.js](https://nextjs.org/docs/app/getting-started/project-structure)
- **Logika biznesowa.** Moduły domenowe obsługują katalog, publikację, naukę, ocenianie i kalendarz. Strony składają widoki, a operacje serwerowe egzekwują uwierzytelnienie, uprawnienia i walidację. Reguły oceniania i harmonogramu powtórek można sprawdzać niezależnie od widoków. [Uwierzytelnianie i autoryzacja w Next.js](https://nextjs.org/docs/app/guides/authentication)
- **Dane i sesja.** Supabase dostarcza PostgreSQL i Supabase Auth. Migracje definiują schemat, ograniczenia, uprawnienia i polityki Row Level Security (RLS). Operacje w imieniu użytkownika powinny korzystać z jego sesji. Klucze uprzywilejowane pozostają po stronie serwera i służą wyłącznie operacjom wymagającym takich uprawnień. [Supabase Auth dla Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) · [Uprawnienia i RLS w Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **Repozytorium i środowiska.** GitHub przechowuje kod, migracje i dokumentację. Vercel obsługuje wdrożenia. Środowiska lokalne, podglądowe i produkcyjne mają odrębną konfigurację oraz korzystają z odpowiednio izolowanych danych. [Środowiska wdrożeniowe Vercel](https://vercel.com/docs/deployments/environments)

## Proponowana struktura katalogów

Drzewo przedstawia układ po rozbudowie MVP. Katalogi powstają wraz z pierwszym zatwierdzonym zastosowaniem.

```text
fizjoluj/
├── AGENTS.md
├── PROJECT.md
├── ROADMAP.md
├── .github/workflows/         # Sprawdzenia uruchamiane w GitHubie
├── docs/                      # Kontrakt importu i instrukcje wdrożeniowe
├── public/                    # Statyczne zasoby aplikacji
├── src/
│   ├── app/
│   │   ├── (public)/          # Strony dostępne bez sesji, w tym logowanie
│   │   ├── (student)/         # Panel, katalog, nauka, historia, kalendarz
│   │   ├── (admin)/
│   │   │   └── admin/         # Panel pod ścieżką /admin
│   │   ├── auth/              # Trasy techniczne logowania, gdy są potrzebne
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   └── ui/                # Wspólne komponenty shadcn/ui
│   ├── features/
│   │   ├── auth/              # Sesja, członkostwo i zarządzanie dostępem
│   │   ├── catalog/           # Hierarchia, odczyt i widoki katalogu
│   │   ├── editorial/         # Szkice, publikacja i import materiałów
│   │   ├── learning/          # Fiszki, powtórki i postęp w tematach
│   │   ├── assessments/       # Quizy, egzaminy próbne i historia prób
│   │   └── calendar/          # Wydarzenia i zakres ich widoczności
│   ├── lib/
│   │   └── supabase/          # Tworzenie klientów Supabase dla aplikacji
│   └── types/                 # W tym typy generowane ze schematu bazy
├── supabase/
│   ├── migrations/            # Schemat, uprawnienia, RLS i operacje SQL
│   └── tests/                 # Testy ograniczeń i polityk bazy
└── tests/                     # Testy przekrojowe aplikacji
```

Formularze, widoki i walidatory umieszczamy w obrębie ich modułu. Wydzielamy elementy używane przez kilka modułów. Zasoby materiałów uczelnianych, które podlegają kontroli dostępu, korzystają z chronionego mechanizmu przechowywania i odczytu.

## Ryzyka i decyzje architektoniczne

| Ryzyko | Proponowane rozwiązanie |
| --- | --- |
| Powiązanie treści z jednym rocznikiem utrudnia ponowne użycie programu i stopniowe uruchamianie semestrów. | Hierarchia programu, członkostwo studenta i reguła dostępności w danym roku akademickim mają własne powiązania. Katalog identyfikuje materiał niezależnie od pojedynczego udostępnienia. Wydanie 2026/2027 jest konfiguracją dostępu do rzeczywistych materiałów pierwszego roku. |
| Wyciek materiałów lub cudzych postępów podczas rozbudowy zakresów dostępu. | Rola i członkostwo są danymi kontrolowanymi przez serwer. W bazie ustawiamy uprawnienia i RLS według operacji, właściciela i zakresu dostępu. Weryfikujemy dostęp w operacjach serwerowych i testujemy uprawnienia gościa, dwóch różnych studentów, studenta po odebraniu dostępu oraz administratora. Osobne przypadki obejmują pliki, operacje bazy wywoływane przez aplikację i odpowiedzi w pamięci podręcznej. [RLS w Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) |
| Edycja lub wycofanie materiałów zmienia to, co widzi student podczas nauki, albo zniekształca jego historię. | Edytowany szkic i opublikowana wersja tematu mają osobny cykl życia. Publikacja atomowo ustawia nową dostępną wersję. Odczyt sprawdza również dostępność nadrzędnej ścieżki. Historia prób zachowuje wynik i odniesienie do wersji zestawu, a fiszka ma trwałą tożsamość oraz ustaloną politykę istotnych zmian. [Transakcje PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| Powtórzony lub uszkodzony import JSON pozostawia duplikaty lub częściowe zmiany. | Wersjonowany kontrakt zawiera stabilne identyfikatory w zakresie źródła i katalogu. Walidacja sprawdza format oraz relacje między wpisami, podgląd pokazuje planowane zmiany, a transakcja zapisuje wyłącznie szkice. Ponowienie identycznego pakietu zachowuje ten sam stan. Równoległa edycja po podglądzie wywołuje jawny konflikt. [Ograniczenia PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html) · [Transakcje PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| Klient ujawnia poprawne odpowiedzi albo może zapisać własny wynik. | Widok quizu otrzymuje pytania i warianty odpowiedzi. Serwer ocenia odpowiedzi według zapisanej wersji, sprawdza właściciela próby i zapisuje wynik. Dane z kluczem odpowiedzi mają osobne uprawnienia również na poziomie bazy. [Uprawnienia i RLS w Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) |
| Ponowne wysłanie oceny fiszki lub równoległa nauka na dwóch urządzeniach przesuwa harmonogram kilka razy. | Historia oceny i termin kolejnej powtórki zmieniają się w jednej transakcji. Identyfikator żądania pozwala rozpoznać ponowienie, a zasada zapisu równoległego chroni stan jednej pary student–fiszka. [Transakcje PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| Wydarzenie trafia do niewłaściwej lokalizacji lub zmienia dzień na urządzeniu użytkownika. | Zakres odbiorców wynika z członkostwa. Wydarzenia całodniowe przechowują datę, a wydarzenia godzinowe zapisują konkretny moment i są prezentowane według strefy `Europe/Warsaw` w MVP. |
| Środowisko podglądowe zmienia dane pilotażu lub udostępnia je osobom spoza projektu. | Środowiska mają własne zmienne i zestawy danych. Przed pilotażem sprawdzamy nadawanie i odbieranie dostępu, sposób odtworzenia bazy oraz podstawową wydajność katalogu, zapisów nauki i kalendarza. [Środowiska wdrożeniowe Vercel](https://vercel.com/docs/deployments/environments) |
