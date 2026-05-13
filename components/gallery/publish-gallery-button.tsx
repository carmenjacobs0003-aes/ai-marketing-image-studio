"use client";

import { useState, type FormEvent } from "react";

export function PublishGalleryButton({
  sourceId,
  kind,
  defaultTitle,
  defaultPrompt
}: {
  sourceId: string;
  kind: "image" | "marketing";
  defaultTitle: string;
  defaultPrompt: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle.slice(0, 120));
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(
    kind === "image" ? "AI Image" : "Marketing"
  );
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);

    const response = await fetch("/api/gallery/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId,
        kind,
        title,
        description,
        category,
        visibility,
        reusablePrompt: defaultPrompt,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      })
    });

    setIsSaving(false);
    if (response.ok) {
      setStatus(
        visibility === "public"
          ? "Published to the gallery."
          : "Saved as a private gallery item."
      );
      setOpen(false);
      return;
    }

    const payload = await response.json().catch(() => null);
    setStatus(payload?.error ?? "Unable to save gallery item.");
  }

  return (
    <div className="space-y-2">
      <button
        className="ghost-button w-full px-4 py-2 text-sm"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? "Close publish panel" : "Publish settings"}
      </button>
      {open ? (
        <form
          className="space-y-3 rounded-2xl border border-cyan-300/20 bg-black/70 p-3"
          onSubmit={onSubmit}
        >
          <input
            id="gallery-title"
            name="title"
            className="field-control py-2"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Asset title"
            value={title}
          />
          <textarea
            id="gallery-description"
            name="description"
            className="field-control min-h-20 py-2"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            value={description}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              id="gallery-publish-category"
              name="category"
              className="field-control py-2"
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Category"
              value={category}
            />
            <select
              id="gallery-visibility"
              name="visibility"
              className="field-control py-2"
              onChange={(event) =>
                setVisibility(event.target.value as "public" | "private")
              }
              value={visibility}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <input
            id="gallery-tags"
            name="tags"
            className="field-control py-2"
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, comma separated"
            value={tags}
          />
          <button
            className="neon-button w-full px-4 py-2 text-sm"
            disabled={isSaving || title.trim().length < 3}
            type="submit"
          >
            {isSaving ? "Publishing..." : "Save gallery item"}
          </button>
        </form>
      ) : null}
      {status ? (
        <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-xs text-cyan-100">
          {status}
        </p>
      ) : null}
    </div>
  );
}
