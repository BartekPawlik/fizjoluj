import { requireSession } from "@/features/auth/session";
import { isUuid } from "@/features/auth/validation";
import { STUDY_ASSET_BUCKET } from "@/features/editorial/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  if (!isUuid(assetId)) return new Response(null, { status: 404 });
  const { supabase } = await requireSession();

  const { data: asset, error } = await supabase.from("study_topic_revision_assets")
    .select("object_path, content_type").eq("id", assetId).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!asset) return new Response(null, { status: 404 });

  const file = await supabase.storage.from(STUDY_ASSET_BUCKET).download(asset.object_path, {}, {
    cache: "no-store",
  });
  if (file.error) return new Response(null, { status: 404 });
  return new Response(file.data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": asset.content_type,
      "Content-Disposition": asset.content_type === "application/pdf" ? "attachment" : "inline",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
