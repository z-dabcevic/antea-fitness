"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";

export default function AfterLoginLocalPage() {
  const sb = createBrowserSupabase();
  const [msg, setMsg] = useState("Provjera profila...");

  useEffect(() => {
    async function run() {
      // 1. saznaj tko je prijavljen preko našeg cookie-ja / JWT-a
      const meRes = await fetch("/api/auth/me", { method: "GET" });
      const meJson = await meRes.json();
      const userPayload = meJson.user; // { sub, username, role } ili null

      if (!userPayload) {
        setMsg("Nisi prijavljen ❌");
        window.location.href = "/login";
        return;
      }

      // sub = local_user.id
      const authId = userPayload.sub as string;
      const username = userPayload.username as string;
      const role = userPayload.role as string;

      // 2. provjeri postoji li app_user red
      const { data: appUserRow, error: appUserErr } = await sb
        .from("app_user")
        .select("id, role")
        .eq("auth_id", authId)
        .maybeSingle();

      let appUserId: string | null = null;

      if (!appUserRow || appUserErr) {
        // kreiraj ga
        const { data: inserted, error: insertErr } = await sb
          .from("app_user")
          .insert({
            auth_id: authId,
            display_name: username,
            role: role === "gm" ? "gm" : "hero",
          })
          .select("id")
          .single();

        if (insertErr || !inserted) {
          setMsg("Ne mogu stvoriti app_user ❌");
          return;
        }

        appUserId = inserted.id;
      } else {
        appUserId = appUserRow.id;
      }

      // 3. provjeri user_stats
      const { data: statsRow, error: statsErr } = await sb
        .from("user_stats")
        .select("user_id")
        .eq("user_id", appUserId!)
        .maybeSingle();

      if (!statsRow || statsErr) {
        const { error: makeStatsErr } = await sb.from("user_stats").insert({
          user_id: appUserId!,
          total_points: 0,
          current_streak: 0,
          best_streak: 0,
        });

        if (makeStatsErr) {
          setMsg("user_stats nije kreiran ❌");
          return;
        }
      }

      setMsg("Sve spremno ✅ Preusmjeravam...");
      window.location.href = "/";
    }

    run();
  }, [sb]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900 p-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
        <p className="text-sm">{msg}</p>
      </div>
    </main>
  );
}
