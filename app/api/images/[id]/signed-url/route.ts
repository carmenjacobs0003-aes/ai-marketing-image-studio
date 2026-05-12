import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getImageGeneration } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSignedDownloadUrl,
  createSignedImageUrl
} from "@/lib/storage/images";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const image = await getImageGeneration(supabase, params.id, user.id).catch(
    () => null
  );

  if (!image?.storage_path) {
    return NextResponse.json(
      { error: "Image storage path is unavailable." },
      { status: 404 }
    );
  }

  const [signedUrlResult, downloadUrlResult] = await Promise.allSettled([
    createSignedImageUrl(image.storage_path),
    createSignedDownloadUrl(image.storage_path)
  ]);

  if (signedUrlResult.status === "rejected") {
    return NextResponse.json(
      { error: "Unable to refresh image preview." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    id: image.id,
    signedUrl: signedUrlResult.value,
    downloadUrl:
      downloadUrlResult.status === "fulfilled" ? downloadUrlResult.value : null,
    storagePath: image.storage_path
  });
}
