"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";

export default function HomePage() {
  const sb = createBrowserSupabase();

  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isGM, setIsGM] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      // 1. tko je prijavljen?
      const meRes = await fetch("/api/auth/me", { method: "GET" });
      const meJson = await meRes.json();
      const userPayload = meJson.user;

      if (!userPayload) {
        window.location.href = "/login";
        return;
      }

      const authId = userPayload.sub as string; // local_user.id
      const roleFromToken = userPayload.role as string;
      setIsGM(roleFromToken === "gm");

      // 2. dohvati app_user za tog authId
      const { data: prof, error: profErr } = await sb
        .from("app_user")
        .select("id, role")
        .eq("auth_id", authId)
        .single();

      if (profErr || !prof) {
        // profil još nije bootstrapan
        window.location.href = "/after-login-local";
        return;
      }

      // 3. bodovi iz user_stats
      const { data: statsRow } = await sb
        .from("user_stats")
        .select("total_points")
        .eq("user_id", prof.id)
        .single();

      if (statsRow) {
        setTotalPoints(statsRow.total_points);
      } else {
        setTotalPoints(0);
      }

      // 4. koliko njenih zahtjeva čeka odobrenje
      const { data: pendings } = await sb
        .from("action_log")
        .select("id")
        .eq("status", "pending")
        .eq("user_id", prof.id);

      setPendingCount(pendings ? pendings.length : 0);

      setLoading(false);
    }

    load();
  }, [sb]);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900 p-8">
        <div className="text-sm text-gray-600">Učitavam...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900 p-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold">
          💖 Antea Fitness Dashboard
        </h1>

        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <div className="text-xs text-gray-500">Bodovi</div>
            <div className="text-2xl font-semibold">
              {totalPoints === null ? "…" : totalPoints}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <div className="text-xs text-gray-500">Na čekanju</div>
            <div className="text-2xl font-semibold">
              {pendingCount === null ? "…" : pendingCount}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="/log"
            className="block w-full px-4 py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition"
          >
            ➕ Prijavi aktivnost
          </a>

          <a
            href="/rewards"
            className="block w-full px-4 py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition"
          >
            🎁 Nagrade
          </a>

          {isGM && (
            <a
              href="/approvals"
              className="block w-full px-4 py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition"
            >
              ✅ Odobravanje (samo za GM)
            </a>
          )}
        </div>

        <p className="text-xs text-gray-500">
          "Svaki trening je level up." 🗡️
        </p>
      </div>
    </main>
  );
}
