"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabaseBrowser";

export default function AfterLoginPage() {
  const supabase = createBrowserSupabase();

  const [msg, setMsg] = useState("Provjera profila...");

  useEffect(() => {
    async function ensureProfile() {
      // 1. Tko je prijavljen?
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      console.log("after-login: getUser user =", user, "err =", userErr);

      if (userErr || !user) {
        setMsg("Nisi prijavljen/a ❌ (nema usera iz Supabase autha)");
        // ako želiš, automatski vrati na /login:
        // window.location.href = "/login";
        return;
      }

      // 2. Pokušaj dohvatiti postojeći app_user red
      const { data: existingUser, error: existingErr } = await supabase
        .from("app_user")
        .select("id, role")
        .eq("auth_id", user.id)
        .single();

      console.log("after-login: existingUser =", existingUser, "err =", existingErr);

      let appUserId: string | null = null;
      let roleAssigned: string | null = null;

      if (!existingUser) {
        // 3. Ako nema app_user reda -> ovo je možda prvi login ikad.
        //    Moramo odrediti ulogu: prvi korisnik = gm, ostali = hero.

        // Provjeri koliko već ima korisnika
        const { data: allUsers, error: allUsersErr } = await supabase
          .from("app_user")
          .select("id");

        console.log("after-login: allUsers =", allUsers, "err =", allUsersErr);

        const roleToSet =
          allUsers && allUsers.length === 0 ? "gm" : "hero";

        // Pokušaj insert u app_user
        const { data: insertedUser, error: insertUserErr } = await supabase
          .from("app_user")
          .insert({
            auth_id: user.id,
            display_name:
              (user.user_metadata && user.user_metadata.full_name) ||
              user.email ||
              "Korisnik",
            role: roleToSet,
          })
          .select("id, role")
          .single();

        console.log("after-login: insertedUser =", insertedUser, "err =", insertUserErr);

        if (insertUserErr || !insertedUser) {
          setMsg(
            "Greška pri stvaranju profila u app_user ❌: " +
              (insertUserErr?.message || "nepoznato")
          );
          return;
        }

        appUserId = insertedUser.id;
        roleAssigned = insertedUser.role;

        // Napravi user_stats red za tog usera
        const { error: statsErr } = await supabase.from("user_stats").insert({
          user_id: insertedUser.id,
          total_points: 0,
          current_streak: 0,
          best_streak: 0,
        });

        console.log("after-login: create user_stats err =", statsErr);

        if (statsErr) {
          setMsg(
            "Profil je stvoren, ali user_stats nije ❌: " +
              statsErr.message
          );
          return;
        }
      } else {
        // postoji već
        appUserId = existingUser.id;
        roleAssigned = existingUser.role;
      }

      console.log("after-login: final appUserId =", appUserId, "role =", roleAssigned);

      if (!appUserId) {
        setMsg("Ne mogu dobiti appUserId ❌");
        return;
      }

      // Ako smo došli do ovdje, sve je ok -> preusmjeri na početnu
      setMsg("Sve spremno ✅ Preusmjeravam...");
      window.location.href = "/";
    }

    ensureProfile();
  }, [supabase]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900 p-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
        <p className="text-sm">{msg}</p>
        <p className="text-[10px] text-gray-400 mt-4">
          Ako ovo stoji dugo, otvori konzolu (F12 → Console) i pošalji mi što piše.
        </p>
      </div>
    </main>
  );
}
