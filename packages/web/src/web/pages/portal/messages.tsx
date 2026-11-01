import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { PortalLayout } from "../../components/portal-layout";
import { ProtectedRoute } from "../../components/protected-route";
import { api, listOf } from "../../lib/api";

function Messages() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const messages = useQuery({
    queryKey: ["my-messages"],
    queryFn: async () => (await api.portal.messages.$get()).json(),
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: async () => (await api.portal.messages.$post({ json: { body: text } })).json(),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["my-messages"] }); },
  });

  return (
    <ProtectedRoute>
      <PortalLayout>
        <h1 className="text-3xl mb-8">Messages</h1>
        <div className="border border-brand-border bg-white flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {listOf(messages.data, "messages").map((m: any) => (
              <div key={m.id} className={`max-w-md ${m.sender === "client" ? "ml-auto text-right" : ""}`}>
                <div className={`inline-block px-4 py-3 text-sm ${m.sender === "client" ? "bg-brand-gold text-brand-black" : "bg-brand-cream border border-brand-border"}`}>
                  {m.body}
                </div>
                <p className="text-brand-gray text-xs mt-1">{m.sender === "client" ? "You" : "Calixto Agency"} · {new Date(m.createdAt).toLocaleTimeString()}</p>
              </div>
            ))}
            {listOf(messages.data, "messages").length === 0 && <p className="text-brand-gray text-sm text-center py-10">No messages yet. Send a note to our team below.</p>}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}
            className="border-t border-brand-border p-4 flex gap-3"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1 border border-brand-border px-4 py-3 focus:border-brand-gold outline-none" />
            <button disabled={send.isPending} className="bg-brand-black text-white px-5 hover:bg-brand-gold hover:text-brand-black transition-colors"><Send size={18} /></button>
          </form>
        </div>
      </PortalLayout>
    </ProtectedRoute>
  );
}

export default function PortalMessagesPage() {
  return <Messages />;
}
