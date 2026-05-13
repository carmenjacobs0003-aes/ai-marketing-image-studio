import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getImageGeneration,
  updateImageGeneration
} from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const imageId = body.imageId;

    if (!imageId) {
      return NextResponse.json(
        { error: "Missing imageId" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    const image = await getImageGeneration(
      supabase,
      imageId,
      user.id
    );

    if (!image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    await updateImageGeneration(
      supabase,
      image.id,
      user.id,
      {
        status: "queued",
        error_message: null
      }
    );

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Retry failed"
      },
      { status: 500 }
    );
  }
}
