"use client";

import Image from "next/image";
import { useState } from "react";
import type { ImageGeneration, Project } from "@/lib/db/queries";
import type { ImageWithSignedUrl } from "@/lib/storage/images";
import { PublishGalleryButton } from "@/components/gallery/publish-gallery-button";

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
      <div className="empty-state sm:col-span-2 lg:col-span-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-300/10 shadow-glow">
          <span className="text-2xl">✦</span>
        </div>
        <h2 className="mt-4 text-xl font-black text-white">
          Your gallery is a blank canvas.
        </h2>
        <p className="mt-2 text-sm leading-6">
          Generate your first campaign image in Studio and it will appear here
          with neon previews, project routing, and download actions.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((image) => (
        <article className="group glass-card glass-hover" key={image.id}>
          <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-black text-sm text-slate-400">
            {image.signedUrl ? (
              <Image
                alt={image.prompt}
                className="object-cover transition duration-500 group-hover:scale-105"
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                src={image.signedUrl}
              />
            ) : image.status === "processing" ? (
              <div className="skeleton-tile h-full w-full" />
            ) : (
              <span className="px-4 text-center">Preview unavailable</span>
            )}
          </div>
          <div className="relative z-10 space-y-4 p-5">
            <div>
              <h2 className="line-clamp-2 font-semibold text-white">
                {image.prompt}
              </h2>
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
                className="field-control py-2"
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
            {image.status === "completed" ? (
              <PublishGalleryButton
                defaultPrompt={image.prompt}
                defaultTitle={image.prompt}
                kind="image"
                sourceId={image.id}
              />
            ) : null}
            {errors[image.id] ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                {errors[image.id]}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              {image.signedUrl ? (
                <a
                  className="inline-flex flex-1 justify-center ghost-button px-4 py-2 text-sm"
                  href={image.signedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Preview
                </a>
              ) : null}
              {image.downloadUrl ? (
                <a
                  className="inline-flex flex-1 justify-center neon-button px-4 py-2 text-sm"
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
