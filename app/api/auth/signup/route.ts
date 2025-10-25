import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { username, password, display_name } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  // provjeri postoji li username
  const { data: existing } = await supabase
    .from("local_user")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "username already taken" }, { status: 409 });
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const { data, error } = await supabase
    .from("local_user")
    .insert({
      username,
      password_hash: hash,
      display_name: display_name || username,
      role: "hero"
    })
    .select("id, username, role")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "db error" }, { status: 500 });
  }

  // Opcionalno: kreiraj app_user + user_stats redove za postojeću aplikaciju
  // ovdje koristiš data.id ili username kao most
  const { error: appErr } = await supabase.from("app_user").insert({
    auth_id: data.id,          // umjesto auth_id (jer ne koristimo Supabase auth)
    display_name: data.username,
    role: data.role
  });

  if (appErr) {
    // nije fatalno za signup — ali javi
    console.error("app_user insert err:", appErr);
  }

  return NextResponse.json({ ok: true, user: { id: data.id, username: data.username } });
}
