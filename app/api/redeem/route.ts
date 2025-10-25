import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const rewardId = body.rewardId;

  // tko je ulogiran? (ovo je lagani hack jer koristimo anon key i browser session:
  // mi tu NEMAMO session automatski, pa ćemo ovo još malo dotjerati kasnije.
  //
  // Za sada ćemo vratiti grešku ako ne znamo usera.
  //
  // Pravo rješenje je: poslati auth_id iz fetch poziva s frontenda.
  const authId = body.authId;
  if (!authId) {
    return NextResponse.json({ error: "Nema authId" }, { status: 401 });
  }

  // 1. Dohvati app_user reda za tog authId
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("app_user")
    .select("id")
    .eq("auth_id", authId)
    .single();

  if (userErr || !userRow) {
    return NextResponse.json({ error: "Korisnik ne postoji" }, { status: 400 });
  }

  // 2. user_stats
  const { data: statsRow, error: statsErr } = await supabaseAdmin
    .from("user_stats")
    .select("total_points")
    .eq("user_id", userRow.id)
    .single();

  if (statsErr || !statsRow) {
    return NextResponse.json({ error: "Nema user_stats" }, { status: 400 });
  }

  // 3. reward
  const { data: rewardRow, error: rewardErr } = await supabaseAdmin
    .from("reward")
    .select("id, title, cost")
    .eq("id", rewardId)
    .single();

  if (rewardErr || !rewardRow) {
    return NextResponse.json({ error: "Nagrada ne postoji" }, { status: 400 });
  }

  if (statsRow.total_points < rewardRow.cost) {
    return NextResponse.json({ error: "Nedovoljno bodova 🥺" }, { status: 400 });
  }

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
      status: "approved",
    });

  if (redErr) {
    return NextResponse.json({ error: "Nisam mogao kreirati redemption" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    remaining: newTotal,
    message: `✅ Nagrada uzeta: "${rewardRow.title}"`,
  });
}
