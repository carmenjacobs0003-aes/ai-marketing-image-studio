"use client";

import { useState } from "react";
import type { ImageGeneration, Project } from "@/lib/db/queries";
import type { ImageWithSignedUrl } from "@/lib/storage/images";

type ImageCard = ImageWithSignedUrl<ImageGeneration>;

type ImageLibraryGridProps = {
  images: ImageCard[];
  projects: Project[];
};

export function ImageLibraryGrid({ images, projects }: ImageLibraryGridProps) {
  const [items, setItems] = useState(images);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveToProject(imageId: string, projectId: string | null) {
    setSavingId(imageId);
    setErrors((current) => ({ ...current, [imageId]: "" }));

    try {
      const response = await fetch(`/api/images/${imageId}/save-to-project`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });
      const payload = await response.json();

      if (!response.ok) {
        setErrors((current) => ({
          ...current,
          [imageId]: payload.error ?? "Unable to save image to project."
        }));
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === imageId
            ? { ...item, project_id: payload.projectId }
            : item
        )
      );
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [imageId]:
          error instanceof Error
            ? error.message
            : "Unable to save image to project."
      }));
    } finally {
      setSavingId(null);
    }
  }

  if (!items.length) {
    return (
      <p className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-300 sm:col-span-2 lg:col-span-3">
        No generated images yet.
      </p>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((image) => (
        <article
          className="group overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-2xl shadow-cyan-950/20 transition hover:border-cyan-300/50 hover:shadow-cyan-500/20"
          key={image.id}
        >
          <div className="flex aspect-square items-center justify-center bg-black text-sm text-slate-400">
            {image.signedUrl ? (
              <img
                alt={image.prompt}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                src={image.signedUrl}
              />
            ) : image.status === "processing" ? (
              <div className="h-full w-full animate-pulse bg-cyan-300/10" />
            ) : (
              <span className="px-4 text-center">Preview unavailable</span>
            )}
          </div>
          <div className="space-y-4 p-5">
            <div>
              <h2 className="line-clamp-2 font-semibold">{image.prompt}</h2>
              <p className="mt-2 text-sm capitalize text-cyan-300">
                {image.status}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(image.created_at).toLocaleString()}
              </p>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Save to project</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-white outline-none ring-cyan-300 transition hover:border-cyan-300/40 focus:border-cyan-300/80 focus:ring-2"
                disabled={savingId === image.id}
                onChange={(event) =>
                  saveToProject(image.id, event.target.value || null)
                }
                value={image.project_id ?? ""}
              >
                <option value="">Image library only</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            {errors[image.id] ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                {errors[image.id]}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              {image.signedUrl ? (
                <a
                  className="inline-flex flex-1 justify-center rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 hover:shadow-[0_0_22px_rgba(103,232,249,0.5)]"
                  href={image.signedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Preview
                </a>
              ) : null}
              {image.downloadUrl ? (
                <a
                  className="inline-flex flex-1 justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 hover:shadow-[0_0_22px_rgba(103,232,249,0.5)]"
                  download
                  href={image.downloadUrl}
                >
                  Download
                </a>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
