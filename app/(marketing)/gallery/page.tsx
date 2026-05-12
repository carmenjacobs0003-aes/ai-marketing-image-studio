import { CommunityGallery } from "@/components/gallery/community-gallery";
import { listPublicGalleryItems } from "@/lib/gallery/db";
import type { GalleryItem, GallerySort } from "@/lib/gallery/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TypedSupabaseClient } from "@/lib/db/helpers";
import { createSignedImageUrl } from "@/lib/storage/images";

const validSorts = new Set(["featured", "trending", "newest"]);
const GALLERY_QUERY_TIMEOUT_MS = 3500;

type GalleryPageProps = {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
};

type GalleryDataset = Awaited<ReturnType<typeof listPublicGalleryItems>>;

function emptyGalleryDataset(page = 1, pageSize = 12): GalleryDataset {
  return {
    count: 0,
    hasMore: false,
    items: [],
    page,
    pageSize
  };
}

async function withTimeout<T>(promise: Promise<T>, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(message)),
      GALLERY_QUERY_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function signGalleryItems(items: GalleryItem[]) {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      signedUrl: item.image_storage_path
        ? await createSignedImageUrl(item.image_storage_path).catch(() => null)
        : null
    }))
  );
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gallery | SYNTRIX AI",
  description:
    "Browse reusable AI visuals, campaign generations, prompts, and creator profiles."
};

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const sort = validSorts.has(searchParams.sort ?? "")
    ? (searchParams.sort as GallerySort)
    : "featured";
  const page = Number(searchParams.page ?? "1");
  let loadError: string | null = null;
  let main = emptyGalleryDataset(page);
  let featured = emptyGalleryDataset(1, 3);
  let trending = emptyGalleryDataset(1, 3);
  let newest = emptyGalleryDataset(1, 3);

  try {
    const supabase =
      createSupabaseAdminClient() as unknown as TypedSupabaseClient;
    [main, featured, trending, newest] = await withTimeout(
      Promise.all([
        listPublicGalleryItems(supabase, {
          query: searchParams.q,
          category: searchParams.category,
          sort,
          page,
          pageSize: 12
        }),
        listPublicGalleryItems(supabase, { sort: "featured", pageSize: 3 }),
        listPublicGalleryItems(supabase, { sort: "trending", pageSize: 3 }),
        listPublicGalleryItems(supabase, { sort: "newest", pageSize: 3 })
      ]),
      "Gallery data request timed out"
    );
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Gallery data is temporarily unavailable.";
  }

  const [items, featuredItems, trendingItems, newestItems] = await Promise.all([
    signGalleryItems(main.items),
    signGalleryItems(featured.items),
    signGalleryItems(trending.items),
    signGalleryItems(newest.items)
  ]);

  return (
    <CommunityGallery
      featuredItems={featuredItems}
      hasMore={main.hasMore}
      initialCategory={searchParams.category ?? ""}
      initialQuery={searchParams.q ?? ""}
      initialSort={sort}
      items={items}
      loadError={loadError}
      newestItems={newestItems}
      page={main.page}
      total={main.count}
      trendingItems={trendingItems}
    />
  );
}
