import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// čitanje GM korisnika iz cookieja
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
    return payload; // { sub, username, role }
  } catch {
    return null;
  }
}

// helper da dobijemo "YYYY-MM-DD" iz Date
function toDateOnly(d: Date) {
  return d.toISOString().split("T")[0];
}

export async function POST(req: Request) {
  // 1. samo GM smije
  const currentUser = await getUserFromCookie(req);
  if (!currentUser || currentUser.role !== "gm") {
    return NextResponse.json({ error: "Nemaš ovlasti." }, { status: 403 });
  }

  const body = await req.json();
  const { week_start } = body; // npr. "2025-10-20" (ponedjeljak)

  if (!week_start) {
    return NextResponse.json(
      { error: "week_start je obavezan (YYYY-MM-DD, ponedjeljak)" },
      { status: 400 }
    );
  }

  // izračunaj kraj tjedna = week_start + 7 dana (ekskluzivno)
  const startDate = new Date(week_start + "T00:00:00Z");
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endStr = toDateOnly(endDate); // YYYY-MM-DD

  // 2. dohvati sve korisnike
  const { data: allUsers, error: usersErr } = await supabase
    .from("app_user")
    .select("id, display_name");

  if (usersErr || !allUsers) {
    return NextResponse.json(
      { error: "Ne mogu dohvatiti korisnike." },
      { status: 500 }
    );
  }

  const results: any[] = [];

  // 3. iteracija kroz svakog usera
  for (const user of allUsers) {
    // 3a. provjeri je li već zatvoren taj tjedan za ovog usera (da ne dupliramo bodove)
    const { data: existingSummary } = await supabase
      .from("weekly_summary")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", week_start)
      .maybeSingle();

    if (existingSummary) {
      results.push({
        user: user.display_name,
        status: "preskočeno (već obračunato prije)",
      });
      continue;
    }

    // 3b. dohvat svih odobrenih aktivnosti tog usera u tom tjednu
    // uključujemo action_type.name da možemo provjeriti točno "Trening"
    const { data: logs, error: logsErr } = await supabase
      .from("action_log")
      .select(
        "id, created_at, status, action_type:action_type_id(name)"
      )
      .eq("user_id", user.id)
      .eq("status", "approved")
      .gte("created_at", week_start)
      .lt("created_at", endStr);

    if (logsErr) {
      results.push({
        user: user.display_name,
        status: "greška dohvat logova",
        details: logsErr.message,
      });
      continue;
    }

    // 3c. filtriraj SAMO one gdje je action_type.name === "Trening"
    const treningLogs = (logs || []).filter(
      (l: any) => l.action_type?.name === "Trening"
    );

    const workoutsCount = treningLogs.length;

    // 3d. odluči bonus
    const bonus = workoutsCount >= 3 ? 20 : -30;

    // 3e. upiši weekly_summary red
    const { data: summaryIns, error: summaryErr } = await supabase
      .from("weekly_summary")
      .insert({
        user_id: user.id,
        week_start,
        workouts_count: workoutsCount,
        bonus_applied: bonus,
      })
      .select("id")
      .single();

    if (summaryErr || !summaryIns) {
      results.push({
        user: user.display_name,
        status: "greška weekly_summary insert",
        details: summaryErr?.message,
      });
      continue;
    }

    // 3f. ažuriraj user_stats.total_points
    const { data: statsRow, error: statsErr } = await supabase
      .from("user_stats")
      .select("total_points")
      .eq("user_id", user.id)
      .single();

    if (statsErr || !statsRow) {
      results.push({
        user: user.display_name,
        status: "greška dohvat user_stats",
      });
      continue;
    }

    const newTotal = (statsRow.total_points || 0) + bonus;

    const { error: statsUpdateErr } = await supabase
      .from("user_stats")
      .update({
        total_points: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (statsUpdateErr) {
      results.push({
        user: user.display_name,
        status: "greška update user_stats",
        details: statsUpdateErr.message,
      });
      continue;
    }

    results.push({
      user: user.display_name,
      workoutsCount,
      bonusApplied: bonus,
      newTotal,
      status: "OK",
    });
  }

  return NextResponse.json({
    week_start,
    results,
  });
}
