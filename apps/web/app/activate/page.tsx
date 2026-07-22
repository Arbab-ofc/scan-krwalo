"use client";

import { useState, useTransition } from "react";
import { api } from "../../lib/api";
import { AppShell } from "../../components/shell";

export default function ActivatePage() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await api<{ role: string }>("/activation/redeem", { method: "POST", body: JSON.stringify({ code: formData.get("code") }) });
        location.href = result.role === "SCANNER" ? "/scanner" : "/client";
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Activation failed");
      }
    });
  }
  return (
    <AppShell role="user">
      <section className="max-w-xl">
        <h1 className="text-3xl font-semibold">Activate profile</h1>
        <p className="mt-2 text-slate-500">Redeem an admin-generated SCN or CLI code.</p>
        <form action={submit} className="mt-6 grid gap-4">
          <input name="code" className="rounded-md border border-line bg-white px-4 py-4 text-xl uppercase tracking-widest" placeholder="SCN123456789" required />
          <button disabled={isPending} className="rounded-md bg-accent px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">
            {isPending ? "Redeeming..." : "Redeem code"}
          </button>
        </form>
        {message && <p className="mt-4 text-red-600">{message}</p>}
      </section>
    </AppShell>
  );
}
