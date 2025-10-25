import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// helper: tko je logiran (hero ili gm), čita cookie token
async function getUserFromCookie(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.split("; ").find((c) => c.startsWith("token="));
  if (!match) return null;
  const token = match.split("=")[1];

  try {
    const { payload } = await jose.jwtVerify(
      token,
      new TextEncoder().encode(process.env.NEXTAUTH_JWT_SECRET!)
    );
    return payload as {
      sub: string;   // local_user.id
      role: string;  // "hero" ili "gm"
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1. provjeri login
  const currentUser = await getUserFromCookie(req);
  if (!currentUser) {
    return NextResponse.json({ error: "Nisi prijavljen." }, { status: 401 });
  }

  // 2. uzmi rewardId iz bodyja
  const body = await req.json();
  const { rewardId } = body;
  if (!rewardId) {
    return NextResponse.json({ error: "Nema rewardId." }, { status: 400 });
  }

  // 3. nađi app_user.id koji odgovara ovom auth korisniku
  const { data: appUserRow, error: appUserErr } = await supabase
    .from("app_user")
    .select("id")
    .eq("auth_id", currentUser.sub)
    .single();

  if (appUserErr || !appUserRow) {
    return NextResponse.json(
      { error: "Nema profila korisnika." },
      { status: 400 }
    );
  }

  const appUserId = appUserRow.id;

  // 4. dohvatimo nagradu (naslov, cijenu itd.)
  const { data: rewardRow, error: rewardErr } = await supabase
    .from("reward")
    .select("id, title, cost")
    .eq("id", rewardId)
    .single();

  if (rewardErr || !rewardRow) {
    return NextResponse.json(
      { error: "Nagrada ne postoji." },
      { status: 404 }
    );
  }

  const price = rewardRow.cost;

  // 5. dohvatimo user_stats da vidimo ima li dovoljno bodova
  const { data: statsRow, error: statsErr } = await supabase
    .from("user_stats")
    .select("total_points")
    .eq("user_id", appUserId)
    .single();

  if (statsErr || !statsRow) {
    return NextResponse.json(
      { error: "Ne mogu dohvatiti bodove." },
      { status: 500 }
    );
  }

  const currentPoints = statsRow.total_points ?? 0;

  if (currentPoints < price) {
    return NextResponse.json(
      { error: "Nemaš dovoljno bodova." },
      { status: 400 }
    );
  }

  // 6. skini bodove
  const newTotal = currentPoints - price;

  const { error: statsUpdateErr } = await supabase
    .from("user_stats")
    .update({
      total_points: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", appUserId);

  if (statsUpdateErr) {
    return NextResponse.json(
      { error: "Ne mogu skinuti bodove." },
      { status: 500 }
    );
  }

  // 7. ZAPIŠI U LOG (ovo je novo i bitno)
  const { error: logInsertErr } = await supabase
    .from("reward_log")
    .insert({
      user_id: appUserId,
      reward_id: rewardRow.id,
      cost_at_redeem: price,
    });

  if (logInsertErr) {
    // ako ovo pukne, bodovi su već skinuti,
    // ali nemamo evidenciju. To je rijetko, ali ajmo svejedno javiti.
    console.error("reward_log insert error", logInsertErr);
  }

  return NextResponse.json({
    message: "Nagrada uzeta 🎁",
    remaining: newTotal,
  });
}
