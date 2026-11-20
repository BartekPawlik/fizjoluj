# Fizjoluj

Polskojęzyczna platforma edukacyjna dla studentów fizjoterapii. Opis projektu znajduje się w [PROJECT.md](PROJECT.md), a zakres MVP w [ROADMAP.md](ROADMAP.md).

## Uruchomienie lokalne

Wymagane są Node.js 22 od wersji 22.13 lub Node.js 24 i nowszy oraz npm 10 lub nowszy. Do pracy zalecana jest wspierana wersja LTS Node.js.

```bash
npm ci
npm run dev
```

Strona startowa jest dostępna pod adresem [localhost:3000](http://localhost:3000).

## Lokalne konta i dostęp do nauki

Do testów kont użyj Supabase CLI i działającego Dockera. Z katalogu projektu uruchom:

```bash
supabase start
supabase status
```

Skopiuj `.env.example` do `.env.local`. Podaj adres API i publiczny klucz **Publishable** lub **anon** z wyniku `supabase status`, a potem uruchom ponownie Next.js. Stronę logowania otwieraj przez `http://localhost:3000/logowanie`. Wiadomości rejestracyjne i odzyskiwania hasła odbierzesz w lokalnej skrzynce pocztowej pod adresem wskazanym przez `supabase status`. [Lokalne środowisko Supabase](https://supabase.com/docs/guides/local-development) · [Testowanie przepływów uwierzytelniania](https://supabase.com/docs/guides/auth/testing-auth-flows)

Aby utworzyć pierwszego administratora, zarejestruj konto, potwierdź jego adres i odszukaj `user_id` w tabeli `public.profiles`. W edytorze SQL danego projektu wykonaj poniższą zmianę, podstawiając identyfikator zweryfikowanego konta administratora.

```sql
update public.profiles
set role = 'admin'
where user_id = '<UUID_konta_administratora>'
  and email_confirmed_at is not null
returning user_id;
```

Po zalogowaniu administrator ma dostęp do `/admin`. W pilotażu student sam zakłada konto i potwierdza adres. Administrator przypisuje mu Poznań albo Szczecin i rocznik 2026. W `/panel` student widzi stan przydziału. Żeby sprawdzić cofnięcie dostępu, cofnij go z drugiej sesji i odśwież panel zalogowanego studenta.

W hostowanym projekcie Supabase zastosuj migrację, ustaw Site URL na adres aplikacji, włącz rejestrację i potwierdzanie e-maila oraz ustaw minimum 12 znaków dla hasła. W nowym projekcie Free najpierw skonfiguruj własny SMTP, aby odblokować edycję szablonów. Następnie wklej treści **Confirm sign up** i **Reset password** z katalogu [supabase/templates](supabase/templates). Użyj publicznego klucza w konfiguracji aplikacji. [Ograniczenie edycji szablonów na Free](https://github.com/orgs/supabase/discussions/46599) · [Konfiguracja SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

## Sprawdzenia

```bash
npm run lint
npm run typecheck
npm run build
```

Gotową kompilację można uruchomić poleceniem `npm run start`.

Testy izolacji danych i operacji administratora uruchom na lokalnym Supabase poleceniem `supabase test db`.
