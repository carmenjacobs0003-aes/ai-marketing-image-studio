"use client";

import { useMemo, useState, type FormEvent } from "react";
import type {
  BrandKit,
  ImageGeneration,
  MarketingGeneration,
  Project
} from "@/lib/db/queries";

type ProjectDashboardProps = {
  projects: Project[];
  brandKits: BrandKit[];
  marketingHistory: MarketingGeneration[];
  imageHistory: ImageGeneration[];
};

type ProjectForm = {
  name: string;
  description: string;
  brandKitId: string;
  status: "active" | "archived";
};

const emptyForm: ProjectForm = {
  name: "",
  description: "",
  brandKitId: "",
  status: "active"
};

export function ProjectDashboard({
  projects,
  brandKits,
  marketingHistory,
  imageHistory
}: ProjectDashboardProps) {
  const [items, setItems] = useState(projects);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const brandById = useMemo(
    () => new Map(brandKits.map((kit) => [kit.id, kit])),
    [brandKits]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(
        editingId ? `/api/projects/${editingId}` : "/api/projects",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            brandKitId: form.brandKitId || null,
            status: form.status
          })
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to save project.");
        return;
      }

      setItems((current) =>
        editingId
          ? current.map((item) =>
              item.id === payload.project.id ? payload.project : item
            )
          : [payload.project, ...current]
      );
      setEditingId(null);
      setForm(emptyForm);
      setStatus("Project saved. Use it from Marketing, Studio, or Images.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save project."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProject(id: string) {
    setError(null);
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Unable to delete project.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form
          className="space-y-4 rounded-3xl border border-cyan-300/20 bg-black/80 p-5 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10"
          onSubmit={onSubmit}
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Saved projects
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {editingId ? "Edit project" : "Create project"}
            </h2>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            <span>Name</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/80 focus:ring-2"
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              value={form.name}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Description</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/80 focus:ring-2"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              value={form.description}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Brand kit</span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/80 focus:ring-2"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  brandKitId: event.target.value
                }))
              }
              value={form.brandKitId}
            >
              <option value="">No brand kit</option>
              {brandKits.map((brandKit) => (
                <option key={brandKit.id} value={brandKit.id}>
                  {brandKit.name}
                </option>
              ))}
            </select>
          </label>
          {editingId ? (
            <label className="block space-y-2 text-sm font-medium">
              <span>Status</span>
              <select
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/80 focus:ring-2"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as ProjectForm["status"]
                  }))
                }
                value={form.status}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
              {status}
            </p>
          ) : null}
          <button
            className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 hover:shadow-[0_0_28px_rgba(103,232,249,0.55)] disabled:opacity-60"
            disabled={isSaving || !form.name.trim()}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : editingId
                ? "Update project"
                : "Save project"}
          </button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          {items.length ? (
            items.map((project) => (
              <article
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-cyan-950/20 transition hover:border-cyan-300/50 hover:shadow-cyan-500/20"
                key={project.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-black">{project.name}</h2>
                  <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-semibold capitalize text-cyan-100">
                    {project.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {project.description ?? "No description yet."}
                </p>
                <p className="mt-3 text-xs text-cyan-200">
                  Brand:{" "}
                  {project.brand_kit_id
                    ? (brandById.get(project.brand_kit_id)?.name ??
                      "Linked kit")
                    : "None"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Updated {new Date(project.updated_at).toLocaleString()}
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    className="flex-1 rounded-xl border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300 hover:text-slate-950"
                    onClick={() => {
                      setEditingId(project.id);
                      setForm({
                        name: project.name,
                        description: project.description ?? "",
                        brandKitId: project.brand_kit_id ?? "",
                        status: project.status as ProjectForm["status"]
                      });
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="flex-1 rounded-xl border border-red-400/40 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
                    onClick={() => deleteProject(project.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-300 md:col-span-2">
              No projects yet. Save your first campaign workspace.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-3xl border border-cyan-300/20 bg-black/80 p-5 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Project history
        </p>
        <h2 className="mt-2 text-2xl font-black">Saved content timeline</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-black text-cyan-200">Marketing content</h3>
            {marketingHistory.length ? (
              marketingHistory.map((item) => (
                <HistoryCard
                  key={item.id}
                  title={item.prompt}
                  meta={`${item.content_type.replaceAll("_", " ")} · ${new Date(item.created_at).toLocaleString()}`}
                />
              ))
            ) : (
              <EmptyHistory label="No saved marketing content yet." />
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-black text-cyan-200">Generated images</h3>
            {imageHistory.length ? (
              imageHistory.map((item) => (
                <HistoryCard
                  key={item.id}
                  title={item.prompt}
                  meta={`${item.status} · ${new Date(item.created_at).toLocaleString()}`}
                />
              ))
            ) : (
              <EmptyHistory label="No saved images yet." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryCard({ title, meta }: { title: string; meta: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="line-clamp-2 font-medium text-white">{title}</p>
      <p className="mt-2 text-xs capitalize text-slate-400">{meta}</p>
    </article>
  );
}

function EmptyHistory({ label }: { label: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
      {label}
    </p>
  );
}
