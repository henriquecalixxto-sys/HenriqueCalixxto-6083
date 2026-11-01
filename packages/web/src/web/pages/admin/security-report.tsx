import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import { AdminLayout } from "../../components/admin-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api } from "../../lib/api";

marked.setOptions({ gfm: true, breaks: false });

/**
 * The documents are fetched from an admin-only endpoint rather than bundled.
 * A go-live runbook lists this system's weakest points and unmitigated risks;
 * compiling it into the public JS bundle would publish that to anyone who
 * views source.
 */
const DOCS = [
  { id: "golive", label: "Go-Live Runbook" },
  { id: "audit", label: "Security Audit" },
] as const;

type Heading = { id: string; text: string; level: number };

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function Report() {
  const [docId, setDocId] = useState<(typeof DOCS)[number]["id"]>("golive");

  const doc = useQuery({
    queryKey: ["security-doc", docId],
    queryFn: async () =>
      (await api.docs[":id"].$get({ param: { id: docId } })).json() as Promise<{ markdown?: string; message?: string }>,
  });
  const source = doc.data?.markdown ?? "";

  const { html, headings } = useMemo(() => {
    const found: Heading[] = [];
    const renderer = new marked.Renderer();
    renderer.heading = ({ tokens, depth }) => {
      const text = tokens.map((t) => ("raw" in t ? t.raw : "")).join("");
      const id = slug(text);
      if (depth <= 2) found.push({ id, text, level: depth });
      return `<h${depth} id="${id}">${marked.parseInline(text)}</h${depth}>`;
    };
    const out = source ? (marked.parse(source, { renderer }) as string) : "";
    return { html: out, headings: found };
  }, [source]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [docId]);

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
        <div>
          <p className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-3">Operations</p>
          <h1 className="text-3xl md:text-4xl">Security Documentation</h1>
        </div>
        <div className="flex border border-brand-border">
          {DOCS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDocId(d.id)}
              className={`px-6 py-3 text-[12px] tracking-[0.12em] uppercase transition-colors ${
                d.id === docId ? "bg-brand-black text-white" : "hover:bg-brand-cream"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-10 items-start">
        {/* table of contents */}
        <nav className="hidden xl:block w-64 shrink-0 sticky top-10 max-h-[80vh] overflow-y-auto">
          <p className="text-[11px] tracking-[0.18em] uppercase text-brand-gray mb-4">On this page</p>
          <ul className="space-y-2 text-sm">
            {headings.map((h) => (
              <li key={h.id} className={h.level === 2 ? "pl-3" : ""}>
                <a href={`#${h.id}`} className="text-brand-gray hover:text-brand-black transition-colors block">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="doc-prose min-w-0 flex-1 border border-brand-border bg-white px-8 py-10 md:px-14 md:py-14">
          {doc.isLoading && <p className="text-brand-gray">Loading…</p>}
          {!doc.isLoading && !source && (
            <p className="text-brand-gray">
              {doc.data?.message ?? "This document is not available in this deployment."}
            </p>
          )}
          {/* Content is repository markdown authored in this project, never user input. */}
          {source && <div dangerouslySetInnerHTML={{ __html: html }} />}
        </article>
      </div>
    </AdminLayout>
  );
}

export default function AdminSecurityReportPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Report />
    </ProtectedRoute>
  );
}
