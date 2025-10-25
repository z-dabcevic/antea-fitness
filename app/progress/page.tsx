"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";
import CloseWeekButton from "@/components/CloseWeekButton";

type WeekRow = {
  week_start: string;
  workouts_count: number;
  bonus_applied: number;
  created_at: string;
};

export default function ProgressPage() {
  const sb = createBrowserSupabase();

  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      // 1. Tko sam ja? (JWT cookie)
      const meRes = await fetch("/api/auth/me");
      const meJson = await meRes.json();
      const userPayload = meJson.user;

      if (!userPayload) {
        window.location.href = "/login";
        return;
      }

      const authId = userPayload.sub as string; // local_user.id

      // 2. Nađi moj app_user.id
      const { data: appUserRow, error: appUserErr } = await sb
        .from("app_user")
        .select("id")
        .eq("auth_id", authId)
        .single();

      if (appUserErr || !appUserRow) {
        window.location.href = "/after-login-local";
        return;
      }

      // 3. Dohvati moje week summaryje
      const { data: weekly, error: weeklyErr } = await sb
        .from("weekly_summary")
        .select("week_start, workouts_count, bonus_applied, created_at")
        .eq("user_id", appUserRow.id)
        .order("week_start", { ascending: false });

      if (weeklyErr) {
        console.error(weeklyErr);
        setMsg("Greška pri dohvaćanju napretka 😕");
      } else {
        setWeeks((weekly as any) || []);
      }

      setLoading(false);
    }

    load();
  }, [sb]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 text-gray-900 p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-6 text-sm text-gray-500">
          Učitavam napredak...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8 flex flex-col items-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl">
        <h1 className="text-xl font-semibold text-center mb-2">
          📅 Napredak po tjednima
        </h1>
        <p className="text-center text-sm text-gray-600 mb-4">
          3 treninga u tjednu = +20 bodova.
          Manje od toga = -30 bodova.
        </p>

        {msg && (
          <p className="text-center text-sm mb-4">{msg}</p>
        )}

        {weeks.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            Još nema podataka za tjedne.
          </p>
        ) : (
          <ul className="space-y-3">
            {weeks.map((w, i) => (
              <li
                key={i}
                className="border rounded-xl bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div className="font-semibold">
                    Tjedan od{" "}
                    {new Date(w.week_start + "T00:00:00Z").toLocaleDateString(
                      "hr-HR"
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Treninzi: {w.workouts_count}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={
                      "text-sm font-semibold " +
                      (w.bonus_applied >= 0
                        ? "text-green-600"
                        : "text-red-600")
                    }
                  >
                    {w.bonus_applied >= 0
                      ? `+${w.bonus_applied} bodova`
                      : `${w.bonus_applied} bodova`}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    obračunano{" "}
                    {new Date(w.created_at).toLocaleString("hr-HR")}
                  </div>



                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
