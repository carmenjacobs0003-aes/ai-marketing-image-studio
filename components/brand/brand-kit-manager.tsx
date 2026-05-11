"use client";

import { useState, type FormEvent } from "react";
import type { BrandKit } from "@/lib/db/queries";

type BrandKitManagerProps = { brandKits: BrandKit[] };
type BrandForm = {
  name: string;
  colors: string;
  fonts: string;
  tone: string;
  voice: string;
  logoUrl: string;
  guidelines: string;
  isDefault: boolean;
};

const emptyForm: BrandForm = {
  name: "",
  colors: "#00E5FF, #FFFFFF",
  fonts: "Inter, Space Grotesk",
  tone: "Futuristic, confident, clear",
  voice: "",
  logoUrl: "",
  guidelines: "",
  isDefault: false
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formFromBrandKit(brandKit: BrandKit): BrandForm {
  return {
    name: brandKit.name,
    colors: brandKit.colors.join(", "),
    fonts: brandKit.fonts.join(", "),
    tone: brandKit.tone ?? "",
    voice: brandKit.voice ?? "",
    logoUrl: brandKit.logo_url ?? "",
    guidelines: brandKit.guidelines ?? "",
    isDefault: brandKit.is_default
  };
}

export function BrandKitManager({ brandKits }: BrandKitManagerProps) {
  const [items, setItems] = useState(brandKits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(
        editingId ? `/api/brand-kits/${editingId}` : "/api/brand-kits",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            colors: splitList(form.colors),
            fonts: splitList(form.fonts),
            tone: form.tone || null,
            voice: form.voice || null,
            logoUrl: form.logoUrl || null,
            guidelines: form.guidelines || null,
            isDefault: form.isDefault
          })
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to save brand kit.");
        return;
      }

      setItems((current) => {
        const next = editingId
          ? current.map((item) =>
              item.id === payload.brandKit.id ? payload.brandKit : item
            )
          : [payload.brandKit, ...current];
        return payload.brandKit.is_default
          ? next.map((item) => ({
              ...item,
              is_default: item.id === payload.brandKit.id
            }))
          : next;
      });
      setEditingId(null);
      setForm(emptyForm);
      setStatus("Brand kit saved and ready for prompt injection.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save brand kit."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteKit(id: string) {
    setError(null);
    const response = await fetch(`/api/brand-kits/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Unable to delete brand kit.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form className="glass-card space-y-4 p-5" onSubmit={onSubmit}>
        <div>
          <p className="eyebrow">Brand kit</p>
          <h2 className="mt-2 text-2xl font-black">
            {editingId ? "Edit brand kit" : "Create brand kit"}
          </h2>
        </div>
        {[
          ["Brand name", "name"],
          ["Colours", "colors"],
          ["Fonts", "fonts"],
          ["Tone", "tone"],
          ["Logo URL", "logoUrl"]
        ].map(([label, key]) => (
          <label className="block space-y-2 text-sm font-medium" key={key}>
            <span>{label}</span>
            <input
              className="field-control"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [key]: event.target.value
                }))
              }
              value={form[key as keyof BrandForm] as string}
            />
          </label>
        ))}
        <label className="block space-y-2 text-sm font-medium">
          <span>Voice</span>
          <textarea
            className="field-control min-h-24"
            onChange={(event) =>
              setForm((current) => ({ ...current, voice: event.target.value }))
            }
            value={form.voice}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Guidelines</span>
          <textarea
            className="field-control min-h-24"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                guidelines: event.target.value
              }))
            }
            value={form.guidelines}
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <input
            checked={form.isDefault}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isDefault: event.target.checked
              }))
            }
            type="checkbox"
          />
          Use as default brand kit for automatic prompt injection
        </label>
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
          className="neon-button w-full"
          disabled={isSaving || !form.name.trim()}
          type="submit"
        >
          {isSaving
            ? "Saving..."
            : editingId
              ? "Update brand kit"
              : "Save brand kit"}
        </button>
      </form>
      <section className="grid gap-4 md:grid-cols-2">
        {items.length ? (
          items.map((brandKit) => (
            <article className="glass-card glass-hover p-5" key={brandKit.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-cyan-300">
                    {brandKit.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    {brandKit.tone ?? brandKit.voice ?? "No tone saved yet."}
                  </p>
                </div>
                {brandKit.is_default ? (
                  <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">
                    Default
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {brandKit.colors.map((color) => (
                  <span
                    className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs text-slate-200"
                    key={color}
                  >
                    {color}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Fonts: {brandKit.fonts.join(", ") || "Not set"}
              </p>
              {brandKit.logo_url ? (
                <p className="mt-2 break-all text-xs text-cyan-200">
                  Logo: {brandKit.logo_url}
                </p>
              ) : null}
              <div className="mt-5 flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300 hover:text-slate-950"
                  onClick={() => {
                    setEditingId(brandKit.id);
                    setForm(formFromBrandKit(brandKit));
                  }}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="flex-1 rounded-xl border border-red-400/40 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
                  onClick={() => deleteKit(brandKit.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state md:col-span-2">
            <h2 className="text-xl font-black text-white">
              No brand kits yet.
            </h2>
            <p className="mt-2 text-sm leading-6">
              Create a default brand kit to give image and marketing generators
              a consistent voice, palette, typography, and AI-ready guidelines.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
