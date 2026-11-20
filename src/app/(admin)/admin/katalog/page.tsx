import Link from "next/link";

import { isUuid } from "@/features/auth/validation";
import { linkClass, Notice, readNotice } from "@/features/auth/ui";
import { CatalogEditor } from "@/features/catalog/catalog-editor";
import { readAdminCatalog } from "@/features/catalog/queries";

const messages = {
  saved: { text: "Zmiany zapisane." },
  duplicate: { text: "Taka pozycja już istnieje w tej części katalogu.", error: true },
  invalid: { text: "Sprawdź dane formularza i powiązanie z semestrem lub rocznikiem.", error: true },
  failed: { text: "Zapis się nie powiódł. Odśwież stronę i spróbuj ponownie.", error: true },
};

export default async function AdminCatalogPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { semestr, przedmiot, dzial, status } = await searchParams;
  const editor = await readAdminCatalog({
    semesterId: isUuid(semestr) ? semestr : undefined,
    subjectId: isUuid(przedmiot) ? przedmiot : undefined,
    sectionId: isUuid(dzial) ? dzial : undefined,
  });

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
      <Link href="/admin" className={linkClass}>Dostęp studentów</Link>
      <h1 className="text-3xl font-semibold tracking-tight">Katalog studiów</h1>
      <Notice content={readNotice(status, messages)} />
      {editor ? <CatalogEditor editor={editor} /> : (
        <Notice content={{ text: "Nie udało się pobrać katalogu. Odśwież stronę.", error: true }} />
      )}
    </main>
  );
}
