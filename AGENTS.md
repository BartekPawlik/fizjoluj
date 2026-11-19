# Zasady pracy w repozytorium Fizjoluj

[PROJECT.md](PROJECT.md) opisuje wymagania i proponowaną architekturę. [ROADMAP.md](ROADMAP.md) wyznacza zakres etapów i kryteria odbioru. Zmiany przygotowuj po polsku w komunikacji z użytkownikiem, dokumentacji projektowej i tekstach interfejsu. W kodzie używaj czytelnych nazw zgodnych z konwencją danego modułu.

## Przed implementacją etapu

1. Przeczytaj odpowiedni zakres dokumentacji i sprawdź stan repozytorium, dostępne polecenia oraz istniejący kod.
2. Przedstaw analizę wymagań, plan, kryteria odbioru i listę plików do utworzenia lub modyfikacji. Wskaż założenia i decyzje, które mogą zmienić zakres lub zachowanie aplikacji.
3. Poczekaj na zatwierdzenie planu przez użytkownika. Zatwierdzenie dotyczy wskazanego etapu. Istotne zmiany zakresu przedstaw przed ich wdrożeniem.

## W trakcie implementacji

- Realizuj zatwierdzony zakres, zachowuj zastane zmiany użytkownika i wykorzystuj istniejące komponenty, typy oraz reguły domenowe.
- Używaj TypeScriptu i unikaj `any`. Dane zewnętrzne przyjmuj jako `unknown`, waliduj na granicy systemu i przekazuj dalej rozpoznane typy.
- Buduj małe komponenty wielokrotnego użytku. Oddziel prezentację od reguł domenowych, uprawnień i zapisu danych. Projektuj mobile-first i sprawdzaj podstawowe operacje klawiaturą.
- Sprawdzaj uprawnienia po stronie serwera przy operacjach na danych oraz egzekwuj dostęp w PostgreSQL za pomocą uprawnień i RLS. Chroń szkice, klucze odpowiedzi, postępy i wyniki. Dane osobiste zapisuj i odczytuj w zakresie wymaganym przez funkcję.
- Trzymaj sekrety i klucze uprzywilejowane w konfiguracji serwerowej. Przykłady konfiguracji zawierają wyłącznie nazwy zmiennych i jawne wartości przykładowe.
- Zmiany schematu, uprawnień i polityk dostępu zapisuj w migracjach. Zmiany danych projektuj pod kątem jednolitego wyniku po błędzie, ponowieniu lub równoległej operacji. Weryfikuj istniejące dane podczas zmian schematu.
- Waliduj import JSON po stronie serwera. Sprawdzaj wersję formatu, strukturę i powiązania rekordów. Zapisuj importowane materiały jako szkice. Publikację wykonuje administrator jako osobną operację.
- Katalog produkcyjny zasilaj wyłącznie rzeczywistymi, zaakceptowanymi materiałami. W roku akademickim 2026/2027 publikuj wyłącznie materiały pierwszego roku. Dane techniczne do testów trzymaj w środowisku testowym.

## Po implementacji etapu

1. Uruchom dostępne testy, lint i sprawdzenie typów. Uruchom także sprawdzenia właściwe dla etapu, na przykład kompilację produkcyjną przy zmianach konfiguracji lub testy RLS przy zmianach polityk dostępu.
2. Porównaj wynik z kryteriami odbioru. Podsumuj zmiany i podaj wyniki sprawdzeń oraz przyczynę każdego sprawdzenia, którego nie udało się uruchomić.
3. Wskaż problemy lub decyzje wymagające uwagi i zaproponuj kolejny etap do zatwierdzenia.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
