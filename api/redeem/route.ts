import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Ovo je MVP verzija: hardcodamo da Antea kupuje nagrade
const HERO_AUTH_ID = "antea-dev";

export async function POST(req: Request) {
  const body = await req.json();
  const rewardId = body.rewardId;

  // 1. Dohvati korisnika (Antea)
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("app_user")
    .select("id")
    .eq("auth_id", HERO_AUTH_ID)
    .single();

  if (userErr || !userRow) {
    return NextResponse.json({ error: "Korisnik ne postoji" }, { status: 400 });
  }

  // 2. Dohvati user_stats
  const { data: statsRow, error: statsErr } = await supabaseAdmin
    .from("user_stats")
    .select("total_points")
    .eq("user_id", userRow.id)
    .single();

  if (statsErr || !statsRow) {
    return NextResponse.json({ error: "Nema user_stats" }, { status: 400 });
  }

  // 3. Dohvati reward (cijenu)
  const { data: rewardRow, error: rewardErr } = await supabaseAdmin
    .from("reward")
    .select("id, title, cost")
    .eq("id", rewardId)
    .single();

  if (rewardErr || !rewardRow) {
    return NextResponse.json({ error: "Nagrada ne postoji" }, { status: 400 });
  }

  // 4. Provjeri ima li dovoljno bodova
  if (statsRow.total_points < rewardRow.cost) {
    return NextResponse.json({ error: "Nedovoljno bodova 🥺" }, { status: 400 });
  }

  // 5. Skini bodove i kreiraj redemption
  const newTotal = statsRow.total_points - rewardRow.cost;

  const { error: updErr } = await supabaseAdmin
    .from("user_stats")
    .update({
      total_points: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userRow.id);

  if (updErr) {
    return NextResponse.json({ error: "Nisam mogao skinuti bodove" }, { status: 500 });
  }

  const { error: redErr } = await supabaseAdmin
    .from("redemption")
    .insert({
      user_id: userRow.id,
      reward_id: rewardRow.id,
      status: "approved", // znači: "kupila sam, sad ti moraš isporučiti"
    });

  if (redErr) {
    return NextResponse.json({ error: "Nisam mogao kreirati redemption" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    remaining: newTotal,
    message: `✅ Uzela je nagradu "${rewardRow.title}"`
  });
}
