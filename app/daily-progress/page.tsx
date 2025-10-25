"use client";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";

type Row = {
  day: string;
  points_earned: number;
  avg_baseline: number;
  bonus_applied: number;
  created_at: string;
};

export default function DailyProgressPage() {
  const sb = createBrowserSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPayload, setUserPayload] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then(r=>r.json());
      if (!me.user) { window.location.href = "/login"; return; }
      setUserPayload(me.user);

      // auth_id -> app_user.id
      const { data: appUser, error: appErr } = await sb
        .from("app_user").select("id").eq("auth_id", me.user.sub).single();
      if (appErr || !appUser) { window.location.href="/after-login-local"; return; }

      const { data, error } = await sb
        .from("daily_summary")
        .select("day, points_earned, avg_baseline, bonus_applied, created_at")
        .eq("user_id", appUser.id)
        .order("day", { ascending: false })
        .limit(30);

      if (!error && data) setRows(data as any);
      setLoading(false);
    }
    load();
  }, [sb]);

  if (loading) return <p className="text-center mt-10">Učitavam...</p>;

  return (
    <main className="max-w-xl mx-auto bg-white shadow-md rounded-2xl p-6 mt-8">
      <h1 className="text-xl font-semibold text-center mb-2">📆 Dnevni napredak</h1>
      <p className="text-center text-sm text-gray-600 mb-4">
        Ako je ukupan broj bodova dana veći od prosjeka zadnjih 7 dana → +10 bodova.
      </p>

      {rows.length === 0 ? (
        <p className="text-center text-gray-500">Nema još podataka.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="border rounded-xl bg-gray-50 p-4 flex justify-between items-center">
              <div>
                <div className="font-semibold">
                  {new Date(r.day + "T00:00:00Z").toLocaleDateString("hr-HR")}
                </div>
                <div className="text-sm text-gray-600">
                  Bodovi: <b>{r.points_earned}</b> · Prosjek: {Math.round(r.avg_baseline * 10) / 10}
                </div>
              </div>
              <div className={
                "text-sm font-semibold " + (r.bonus_applied > 0 ? "text-green-600" : "text-gray-400")
              }>
                {r.bonus_applied > 0 ? `+${r.bonus_applied}` : "—"}
              </div>
            </li>
          ))}
        </ul>
      )}

      {userPayload?.role === "gm" && (
        <div className="mt-6">
          {/* GM alat: manual “juče” obračun */}
          <p className="text-center text-xs text-gray-500 mb-2">GM alat</p>
          {/* Uvezi komponentu ako želiš direktno ovdje */}
        </div>
      )}
    </main>
  );
}
