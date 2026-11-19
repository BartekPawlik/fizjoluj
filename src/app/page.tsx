import Link from "next/link";

export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12 sm:px-10 sm:py-20">
      <div className="w-full max-w-4xl rounded-xl border bg-card px-6 py-14 text-card-foreground sm:px-14 sm:py-20 lg:px-20 lg:py-24">
        <div aria-hidden="true" className="mb-7 h-1 w-12 rounded-full bg-primary" />
        <h1 className="text-6xl leading-none font-semibold tracking-tight text-primary sm:text-8xl">
          Fizjoluj
        </h1>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Platforma edukacyjna dla studentów fizjoterapii.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/logowanie" className="rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90">
            Zaloguj się
          </Link>
          <Link href="/rejestracja" className="rounded-md px-2 py-3 font-medium text-primary underline underline-offset-4">
            Załóż konto
          </Link>
        </div>
      </div>
    </main>
  );
}
