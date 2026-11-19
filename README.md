# Fizjoluj

Polskojęzyczna platforma edukacyjna dla studentów fizjoterapii. Opis projektu znajduje się w [PROJECT.md](PROJECT.md), a zakres MVP w [ROADMAP.md](ROADMAP.md).

## Uruchomienie lokalne

Wymagane są Node.js 22 od wersji 22.13 lub Node.js 24 i nowszy oraz npm 10 lub nowszy. Do pracy zalecana jest wspierana wersja LTS Node.js.

```bash
npm ci
npm run dev
```

Strona startowa jest dostępna pod adresem [localhost:3000](http://localhost:3000).

## Sprawdzenia

```bash
npm run lint
npm run typecheck
npm run build
```

Gotową kompilację można uruchomić poleceniem `npm run start`.
