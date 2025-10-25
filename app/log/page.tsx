"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";
import { supabase } from "@/lib/supabaseClient";

type ActionType = {
  id: number;
  name: string;
  base_points: number;
  negative: boolean;
};

export default function LogPage() {
  const sb = createBrowserSupabase();

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  // ovo je ID iz tablice app_user (ne local_user)
  const [appUserId, setAppUserId] = useState<string | null>(null);

  // 1. učitaj usera, profil i tipove aktivnosti
  useEffect(() => {
    async function init() {
      // provjeri tko je prijavljen preko našeg cookie-ja
      const meRes = await fetch("/api/auth/me", { method: "GET" });
      const meJson = await meRes.json();
      const userPayload = meJson.user;

      if (!userPayload) {
        // nema login cookie -> idi na login
        window.location.href = "/login";
        return;
      }

      const authId = userPayload.sub as string; // local_user.id

      // probaj dohvatiti app_user red za tog authId
      const { data: appUserRow, error: appUserErr } = await sb
        .from("app_user")
        .select("id")
        .eq("auth_id", authId)
        .single();

      if (appUserErr || !appUserRow) {
        // profil još nije bootstrapan -> idi tamo
        window.location.href = "/after-login-local";
        return;
      }

      setAppUserId(appUserRow.id);

      // učitaj sve tipove aktivnosti (gym, zdravi obrok, itd.)
      const { data: types, error: typesErr } = await supabase
        .from("action_type")
        .select("*")
        .order("id", { ascending: true });

      if (typesErr) {
        console.error(typesErr);
        setStatusMsg("Greška pri učitavanju tipova aktivnosti 😕");
      } else {
        setActionTypes(types || []);
      }

      setLoading(false);
    }

    init();
  }, [sb]);

  async function handleSubmit() {
    if (!selectedId) {
        setStatusMsg("Molim odaberi aktivnost 🙏");
        return;
    }
    if (!appUserId) {
        setStatusMsg("Greška: nema profila korisnika.");
        return;
    }

    const { error: insertErr } = await supabase.from("action_log").insert({
      user_id: appUserId,
      action_type_id: selectedId,
      note: note || null,
      status: "pending",
    });

    if (insertErr) {
      console.error(insertErr);
      setStatusMsg("Greška pri slanju 😕");
    } else {
      setStatusMsg("Poslano na odobrenje ✅");
      setNote("");
      setSelectedId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center bg-gray-100 text-gray-900 p-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md text-center text-sm text-gray-500">
          Učitavam...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-gray-100 text-gray-900 p-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4 text-center">
          📝 Prijava aktivnosti
        </h1>

        <label className="block text-sm font-medium mb-1">
          Aktivnost
        </label>
        <select
          className="w-full border rounded-xl p-2 mb-4"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          <option value="">-- Odaberi --</option>
          {actionTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.negative ? "-" : "+"}
              {t.base_points} bodova)
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-1">
          Bilješka (opcionalno)
        </label>
        <textarea
          className="w-full border rounded-xl p-2 mb-4"
          rows={3}
          placeholder="npr. 'Leg day, 40 min cardio'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          className="w-full py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition"
          onClick={handleSubmit}
        >
          Pošalji na odobrenje
        </button>

        {statusMsg && (
          <p className="text-center text-sm mt-4">{statusMsg}</p>
        )}
      </div>
    </main>
  );
}
