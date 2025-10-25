"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";

type PendingLog = {
  id: string;
  note: string | null;
  created_at: string;
  user_id: string;
  action_type: {
    name: string;
    base_points: number;
    negative: boolean;
  };
};

export default function ApprovalsPage() {
  const sb = createBrowserSupabase();

  const [loading, setLoading] = useState(true);
  const [isGM, setIsGM] = useState<boolean | null>(null);
  const [items, setItems] = useState<PendingLog[]>([]);
  const [msg, setMsg] = useState("");

  async function loadPending() {
    // 1. tko je prijavljen?
    const meRes = await fetch("/api/auth/me", { method: "GET" });
    const meJson = await meRes.json();
    const userPayload = meJson.user;

    if (!userPayload) {
      // nije prijavljen -> baci na login
      window.location.href = "/login";
      return;
    }

    const role = userPayload.role as string;
    const authId = userPayload.sub as string; // local_user.id

    // ako nisi GM, nemaš pravo na ovu stranicu
    if (role !== "gm") {
      setIsGM(false);
      setMsg("Nemaš ovlasti 🙅‍♂️");
      setLoading(false);
      return;
    }

    setIsGM(true);

    // 2. load svih pending zahtjeva
    // GM ima pravo vidjeti sve korisnike
    const { data, error } = await sb
      .from("action_log")
      .select(
        "id, note, created_at, user_id, action_type:action_type_id(name, base_points, negative)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setMsg("Greška kod učitavanja.");
      setLoading(false);
      return;
    }

    setItems((data as any) || []);
    setLoading(false);
  }

  async function approve(id: string) {
    setMsg("Odobravam...");
    const res = await fetch("/api/approve", {
      method: "POST",
      body: JSON.stringify({ id }),
      headers: { "Content-Type": "application/json" },
    });


    if (res.ok) {
      setMsg("Odobreno ✅");
      await loadPending();
    } else {
      setMsg("Greška kod odobravanja ❌");
    }
  }

  useEffect(() => {
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 text-gray-900 p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center text-sm text-gray-500">
          Učitavam...
        </div>
      </main>
    );
  }

  // ako nisi GM
  if (isGM === false) {
    return (
      <main className="min-h-screen bg-gray-100 text-gray-900 p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
          <p className="text-sm">{msg}</p>
        </div>
      </main>
    );
  }

  // ako jesi GM
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-xl font-semibold mb-4 text-center">
          ✅ Odobravanje aktivnosti
        </h1>

        {msg && <p className="text-center text-sm mb-4">{msg}</p>}

        {items.length === 0 ? (
          <p className="text-center text-gray-500 text-sm">
            Trenutno nema zahtjeva 💤
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((log) => (
              <li
                key={log.id}
                className="border rounded-xl p-4 bg-gray-50 flex flex-col gap-2"
              >
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">
                    {log.action_type.name}
                  </span>{" "}
                  ({log.action_type.negative ? "-" : "+"}
                  {log.action_type.base_points} bodova)
                </div>

                {log.note && (
                  <div className="text-sm">Bilješka: {log.note}</div>
                )}

                <div className="text-xs text-gray-400">
                  Prijavljeno:{" "}
                  {new Date(log.created_at).toLocaleString("hr-HR")}
                </div>

                <button
                  onClick={() => approve(log.id)}
                  className="self-start px-4 py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition text-sm"
                >
                  Odobri i dodaj bodove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
