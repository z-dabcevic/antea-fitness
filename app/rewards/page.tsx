"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";
import { supabase } from "@/lib/supabaseClient";

type Reward = {
  id: number;
  title: string;
  description: string | null;
  cost: number;
};

export default function RewardsPage() {
  const sb = createBrowserSupabase();

  const [loading, setLoading] = useState(true);
  const [authId, setAuthId] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadData() {
      // 1. provjeri tko je prijavljen iz našeg cookie-ja/JWT-a
      const meRes = await fetch("/api/auth/me", { method: "GET" });
      const meJson = await meRes.json();
      const userPayload = meJson.user;

      if (!userPayload) {
        window.location.href = "/login";
        return;
      }

      const currentAuthId = userPayload.sub as string; // local_user.id
      setAuthId(currentAuthId);

      // 2. provjeri/pročitaj app_user red
      const { data: appUserRow, error: appUserErr } = await sb
        .from("app_user")
        .select("id")
        .eq("auth_id", currentAuthId)
        .single();

      if (appUserErr || !appUserRow) {
        // user još nije bootstrapan → pošalji da se bootstrap-a
        window.location.href = "/after-login-local";
        return;
      }

      setAppUserId(appUserRow.id);

      // 3. koliko imam bodova?
      const { data: statsRow, error: statsErr } = await sb
        .from("user_stats")
        .select("total_points")
        .eq("user_id", appUserRow.id)
        .single();

      if (!statsErr && statsRow) {
        setPoints(statsRow.total_points);
      } else {
        setPoints(0);
      }

      // 4. lista nagrada iz reward tablice
      const { data: rewardData, error: rewardErr } = await supabase
        .from("reward")
        .select("*")
        .order("cost", { ascending: true });

      if (!rewardErr && rewardData) {
        setRewards(rewardData as any);
      }

      setLoading(false);
    }

    loadData();
  }, [sb]);

  async function redeemReward(rewardId: number) {
    if (!authId) {
      setMsg("Nema korisnika 😕");
      return;
    }

    setMsg("Šaljem zahtjev...");

    const res = await fetch("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ rewardId, authId }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || "Greška 😕");
      return;
    }

    // update bodova na ekranu nakon kupnje
    setPoints(json.remaining);
    setMsg(json.message + ` Preostali bodovi: ${json.remaining}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 text-gray-900 p-8 flex flex-col items-center">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6 text-center text-sm text-gray-500">
          Učitavam nagrade...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8 flex flex-col items-center">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-xl font-semibold text-center mb-2">
          🎁 Nagrade
        </h1>

        <p className="text-center text-sm text-gray-600 mb-4">
          Skupi bodove i zamijeni ih za chill, masaže i male nagrade 💖
        </p>

        <div className="text-center mb-6">
          <div className="text-sm text-gray-500">Tvoji bodovi:</div>
          <div className="text-3xl font-bold">
            {points === null ? "..." : points}
          </div>
        </div>

        {msg && (
          <div className="text-center text-sm mb-4">{msg}</div>
        )}

        <ul className="space-y-4">
          {rewards.map((r) => (
            <li
              key={r.id}
              className="border rounded-xl bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="text-sm text-gray-600">{r.description}</div>
                <div className="text-xs text-gray-400">
                  Cijena: {r.cost} bodova
                </div>
              </div>

              <button
                onClick={() => redeemReward(r.id)}
                disabled={points !== null && points < r.cost}
                className="px-4 py-2 rounded-xl font-semibold bg-black text-white hover:bg-gray-800 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Uzmi nagradu
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
