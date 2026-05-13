"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  Flag,
  Heart,
  Repeat2,
  Search,
  Sparkles
} from "lucide-react";
import { SyntrixLogo } from "@/components/brand/syntrix-logo";
import type { GalleryItem, GallerySort } from "@/lib/gallery/types";

type CommunityGalleryProps = {
  items: GalleryItem[];
  featuredItems: GalleryItem[];
  trendingItems: GalleryItem[];
  newestItems: GalleryItem[];
  page: number;
  hasMore: boolean;
  total: number;
  initialQuery: string;
  initialCategory: string;
  initialSort: GallerySort;
  loadError?: string | null;
};

const sorts: Array<{ value: GallerySort; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" }
];

function outputPreview(output: GalleryItem["marketing_output"]) {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    if ("text" in output && typeof output.text === "string") return output.text;
    return JSON.stringify(output, null, 2);
  }
  return "Reusable campaign generation";
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).length)
      search.set(key, String(value));
  });
  return `/gallery?${search.toString()}`;
}

function ShowcaseStrip({
  title,
  items
}: {
  title: string;
  items: GalleryItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-300" />
        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.slice(0, 3).map((item) => (
          <article className="glass-card p-4" key={item.id}>
            <p className="eyebrow">{item.category}</p>
            <h3 className="mt-2 line-clamp-1 font-black text-white">
              {item.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-slate-300">
              {item.reusable_prompt}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GalleryCard({ item }: { item: GalleryItem }) {
  const [likeCount, setLikeCount] = useState(item.like_count);
  useEffect(() => {
    fetch(`/api/gallery/items/${item.id}/metric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric: "view" })
    }).catch(() => null);
  }, [item.id]);
  const [status, setStatus] = useState<string | null>(null);

  async function track(metric: "view" | "copy" | "remix") {
    await fetch(`/api/gallery/items/${item.id}/metric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric })
    }).catch(() => null);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(item.reusable_prompt);
    await track("copy");
    setStatus("Prompt copied to clipboard.");
  }

  async function favorite() {
    const response = await fetch(`/api/gallery/items/${item.id}/favorite`, {
      method: "POST"
    });
    if (response.ok) {
      const payload = await response.json();
      setLikeCount((current) => current + (payload.favorited ? 1 : -1));
      setStatus(
        payload.favorited ? "Added to favorites." : "Removed from favorites."
      );
    } else {
      setStatus("Sign in to save favorites.");
    }
  }

  async function saveToLibrary() {
    const response = await fetch(
      `/api/gallery/items/${item.id}/save-to-project`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: null })
      }
    );
    setStatus(
      response.ok ? "Saved to your library." : "Sign in to save this item."
    );
  }

  async function report() {
    const reason = window.prompt("What should moderators review?");
    if (!reason) return;
    const response = await fetch(`/api/gallery/items/${item.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setStatus(
      response.ok ? "Report sent to moderation." : "Sign in to report content."
    );
  }

  const creatorName = item.creator?.full_name ?? "Community creator";
  const remixHref =
    item.kind === "image"
      ? `/studio?prompt=${encodeURIComponent(item.reusable_prompt)}&gallery=${item.id}`
      : `/marketing?prompt=${encodeURIComponent(item.reusable_prompt)}&gallery=${item.id}`;

  return (
    <article className="group glass-card glass-hover flex flex-col">
      {item.kind === "image" ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          {item.signedUrl ? (
            <Image
              alt={item.title}
              className="object-cover transition duration-500 group-hover:scale-105"
              fill
              loading="lazy"
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
              src={item.signedUrl}
            />
          ) : (
            <div className="skeleton-tile h-full w-full" />
          )}
        </div>
      ) : (
        <div className="min-h-56 border-b border-white/10 bg-black/70 p-5">
          <p className="eyebrow">Campaign generation</p>
          <pre className="mt-3 line-clamp-[8] whitespace-pre-wrap text-sm leading-6 text-slate-200">
            {outputPreview(item.marketing_output)}
          </pre>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="premium-badge">{item.category}</span>
            {item.featured ? (
              <span className="premium-badge">Featured</span>
            ) : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-xl font-black text-white">
            {item.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">
            {item.description ?? item.reusable_prompt}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-cyan-100"
              key={tag}
            >
              #{tag}
            </span>
          ))}
        </div>
        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>by {creatorName}</span>
            <span className="flex items-center gap-3">
              <Eye className="h-3.5 w-3.5" /> {item.view_count} · ❤ {likeCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="ghost-button px-3 py-2 text-sm"
              onClick={favorite}
              type="button"
            >
              <Heart className="mr-2 h-4 w-4" /> Like
            </button>
            <button
              className="ghost-button px-3 py-2 text-sm"
              onClick={copyPrompt}
              type="button"
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </button>
            <Link
              className="ghost-button px-3 py-2 text-sm"
              href={remixHref}
              onClick={() => track("remix")}
            >
              <Repeat2 className="mr-2 h-4 w-4" /> Remix
            </Link>
            <button
              className="ghost-button px-3 py-2 text-sm"
              onClick={saveToLibrary}
              type="button"
            >
              Save
            </button>
          </div>
          <button
            className="text-xs text-slate-500 hover:text-cyan-200"
            onClick={report}
            type="button"
          >
            <Flag className="mr-1 inline h-3 w-3" /> Report for moderation
          </button>
          {status ? (
            <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-xs text-cyan-100">
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CommunityGallery(props: CommunityGalleryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(props.initialQuery);
  const [category, setCategory] = useState(props.initialCategory);
  const categories = useMemo(
    () => [...new Set(props.items.map((item) => item.category))].sort(),
    [props.items]
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildQuery({
        q: query,
        category,
        sort: searchParams.get("sort") ?? props.initialSort
      })
    );
  }

  return (
    <main className="aurora-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/">
            <SyntrixLogo />
          </Link>
          <div className="flex gap-2">
            <Link className="ghost-button px-4 py-2 text-sm" href="/login">
              Sign in
            </Link>
            <Link className="neon-button px-4 py-2 text-sm" href="/signup">
              Publish work
            </Link>
          </div>
        </nav>
        <header className="page-hero">
          <p className="eyebrow">Gallery</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
            Reusable prompts and generated assets for campaign teams.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Discover public visuals, campaign generations, reusable prompts,
            creator profiles, and remix-ready ideas.
          </p>
        </header>
        <form
          className="glass-card grid gap-3 p-4 md:grid-cols-[1fr_220px_180px_auto]"
          onSubmit={onSubmit}
        >
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-cyan-300" />
            <input
              id="gallery-search"
              name="q"
              className="field-control pl-11"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prompts, tags, categories..."
              value={query}
            />
          </label>
          <select
            id="gallery-category"
            name="category"
            className="field-control"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            id="gallery-sort"
            name="sort"
            className="field-control"
            onChange={(event) =>
              router.push(
                buildQuery({ q: query, category, sort: event.target.value })
              )
            }
            value={props.initialSort}
          >
            {sorts.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
          <button className="neon-button" type="submit">
            Search
          </button>
        </form>
        {props.loadError ? (
          <div
            className="empty-state border-amber-300/35 bg-amber-300/[0.06] text-amber-100"
            role="status"
          >
            <p className="font-black">
              Gallery data is temporarily unavailable.
            </p>
            <p className="mt-2 text-sm leading-6">
              Live gallery data could not be loaded quickly. Details:{" "}
              {props.loadError}
            </p>
          </div>
        ) : null}
        <ShowcaseStrip title="Featured" items={props.featuredItems} />
        <ShowcaseStrip title="Trending" items={props.trendingItems} />
        <ShowcaseStrip title="Newest" items={props.newestItems} />
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {props.items.map((item) => (
            <GalleryCard item={item} key={item.id} />
          ))}
        </section>
        {!props.items.length ? (
          <p className="empty-state">
            {props.loadError
              ? "Gallery content is temporarily unavailable. Please refresh in a moment or try again from the dashboard."
              : "No public gallery items match this search."}
          </p>
        ) : null}
        <div className="flex flex-col items-center gap-3 pb-10 text-sm text-slate-400">
          <p>
            Showing {props.items.length} of {props.total} gallery items.
          </p>
          {props.hasMore ? (
            <Link
              className="ghost-button"
              href={buildQuery({
                q: props.initialQuery,
                category: props.initialCategory,
                sort: props.initialSort,
                page: props.page + 1
              })}
            >
              Load more
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
