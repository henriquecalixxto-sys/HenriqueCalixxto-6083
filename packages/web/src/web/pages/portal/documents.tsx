import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Download, UploadCloud } from "lucide-react";
import { PortalLayout } from "../../components/portal-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

function Documents() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documents = useQuery({ queryKey: ["my-documents"], queryFn: async () => (await api.portal.documents.$get()).json() });

  const remove = useMutation({
    mutationFn: async (id: number) => (await api.portal.documents[":id"].$delete({ param: { id: String(id) } })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-documents"] }),
  });

  const download = async (id: number) => {
    const res = await api.portal.documents[":id"].url.$get({ param: { id: String(id) } });
    const body: any = await res.json();
    if (!res.ok || !body?.url) {
      setError(body?.message ?? "This document is no longer available.");
      return;
    }
    // noopener/noreferrer: the short-lived signed URL must not leak via Referer.
    window.open(body.url, "_blank", "noopener,noreferrer");
  };

  // Client-side checks are UX only — the API re-validates type, extension and size
  // and verifies the stored object with HeadObject before creating any record.
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`${file.name} is larger than 25 MB.`);
          continue;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError(`${file.name}: this file type is not accepted.`);
          continue;
        }
        const presign = await api.portal.documents.presign.$post({
          json: { filename: file.name, contentType: file.type, size: file.size },
        });
        const presignBody: any = await presign.json();
        if (!presign.ok || !presignBody?.url) {
          setError(presignBody?.message ?? `Could not start upload for ${file.name}.`);
          continue;
        }
        const put = await fetch(presignBody.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!put.ok) {
          setError(`Upload failed for ${file.name}.`);
          continue;
        }
        const register = await api.portal.documents.$post({
          json: { filename: file.name, key: presignBody.key, contentType: file.type, size: file.size },
        });
        if (!register.ok) {
          const body: any = await register.json().catch(() => null);
          setError(body?.message ?? `${file.name} was rejected.`);
        }
      }
      await qc.invalidateQueries({ queryKey: ["my-documents"] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <PortalLayout>
        <h1 className="text-3xl mb-8">Documents</h1>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
          className="border-2 border-dashed border-brand-border hover:border-brand-gold transition-colors bg-white p-14 text-center cursor-pointer mb-10"
        >
          <UploadCloud className="text-brand-gold mx-auto mb-4" size={32} />
          <p className="font-display mb-1">{uploading ? "Uploading..." : "Drop files here or click to upload"}</p>
          <p className="text-brand-gray text-sm">PDF, JPG, PNG, DOCX, XLSX, TXT — up to 25 MB, encrypted and private to your account</p>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {error && (
          <div className="border border-red-300 bg-red-50 text-red-700 text-sm px-5 py-4 mb-8">{error}</div>
        )}

        <div className="border border-brand-border bg-white divide-y divide-brand-border">
          {listOf(documents.data, "documents").map((d: any) => (
            <div key={d.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <FileText className="text-brand-gold" size={20} />
                <div>
                  <p className="text-sm">{d.filename}</p>
                  <p className="text-brand-gray text-xs">{new Date(d.createdAt).toLocaleDateString()} · {d.uploadedBy}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => download(d.id)} className="text-brand-gray hover:text-brand-gold"><Download size={18} /></button>
                <button onClick={() => remove.mutate(d.id)} className="text-brand-gray hover:text-red-600"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
          {listOf(documents.data, "documents").length === 0 && <p className="px-6 py-10 text-brand-gray text-sm text-center">No documents uploaded yet.</p>}
        </div>
      </PortalLayout>
    </ProtectedRoute>
  );
}

export default function PortalDocumentsPage() {
  return <Documents />;
}
