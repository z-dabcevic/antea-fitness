import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---- helper: tko zove (cookie JWT) ----
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
      role: string;  // "gm" ili "hero"
    };
  } catch {
    return null;
  }
}

// ---- helper: vrati sljedeći dan kao string YYYY-MM-DD ----
function nextDateString(dStr: string) {
  const d = new Date(dStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

// ---- helper: dohvati jučerašnji dan u "Europe/Zagreb" i vrati kao YYYY-MM-DD ----
function getYesterdayInZagreb(): string {
  const tz = "Europe/Zagreb";
  const now = new Date();

  // prvo uzmi "danas" u Europe/Zagreb
  const fmt = new Intl.DateTimeFormat("hr-HR", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = fmt.formatToParts(now).reduce((acc: any, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  // parts.day / parts.month / parts.year su stringovi iz lokalne zone
  const dd = parseInt(parts.day, 10);
  const mm = parseInt(parts.month, 10);
  const yyyy = parseInt(parts.year, 10);

  // konstruiramo "lokalni danas" kao UTC date bez vremena
  const local = new Date(Date.UTC(yyyy, mm - 1, dd));

  // sad idemo jedan dan unazad => jučer
  local.setUTCDate(local.getUTCDate() - 1);

  // pretvorimo u "YYYY-MM-DD"
  return local.toISOString().split("T")[0];
}

export async function POST(req: Request) {
  // 1. tko zove endpoint
  const currentUser = await getUserFromCookie(req);

  // 2. pokušaj pročitati body (može biti prazan kad zove Cron)
  let parsedBody: { day?: string } = {};
  try {
    parsedBody = await req.json();
  } catch {
    // nema bodyja, ignore
  }

  // 3. odluči koji dan obračunavamo
  //    - ako POST body sadrži "day": koristimo to
  //    - inače automatski koristimo "jučer" po Europe/Zagreb
  const effectiveDay = parsedBody.day || getYesterdayInZagreb();

  console.log("📆 daily-close: effectiveDay =", effectiveDay);

  // 4. sigurnost:
  //    - ako ovo ručno pozivaš iz appa: zahtijevaj GM
  //    - ako će to zvati Vercel Cron bez cookieja:
  //
  //  Scenarij:
  //    - Ako postoji currentUser (znači ljudski poziv iz preglednika),
  //      mora biti GM.
  //    - Ako NEMA currentUser (znači poziva Cron bez cookieja),
  //      svejedno dozvoljavamo. To je namjerno da cron radi automatski.
  //
  if (currentUser && currentUser.role !== "gm") {
    return NextResponse.json(
      { error: "Nemaš ovlasti." },
      { status: 403 }
    );
  }

  // 5. izračun kraja dana (exkluzivno)
  //    primijetit ćeš: uzimamo sljedeći dan u odnosu na effectiveDay
  const dayEnd = nextDateString(effectiveDay);

  // 6. dohvat svih korisnika iz app_user
  const { data: users, error: usersErr } = await sb
    .from("app_user")
    .select("id, display_name");

  if (usersErr || !users) {
    return NextResponse.json(
      { error: "Ne mogu dohvatiti korisnike." },
      { status: 500 }
    );
  }

  // rezultate ćemo vratiti kao pregled što se dogodilo
  const results: any[] = [];

  // 7. obradi svakog korisnika
  for (const u of users) {
    // 7.1. već obračunato za ovaj dan? (sprječava dupli bonus)
    const { data: exists } = await sb
      .from("daily_summary")
      .select("id")
      .eq("user_id", u.id)
      .eq("day", effectiveDay)
      .maybeSingle();

    if (exists) {
      results.push({
        user: u.display_name,
        status: "preskočeno (već obračunato)",
      });
      continue;
    }

    // 7.2. dohvati sve odobrene aktivnosti tog dana
    // action_log mora imati status="approved"
    // i mi računamo bodove istom logikom kao kod /api/approve:
    //   - base_points ako nije negative
    //   - -base_points ako je negative
    const { data: logs, error: logsErr } = await sb
      .from("action_log")
      .select(
        "id, created_at, status, action_type:action_type_id(base_points, negative)"
      )
      .eq("user_id", u.id)
      .eq("status", "approved")
      .gte("created_at", effectiveDay)
      .lt("created_at", dayEnd);

    if (logsErr) {
      results.push({
        user: u.display_name,
        status: "greška dohvat logova",
        details: logsErr.message,
      });
      continue;
    }

    const pointsToday = (logs || []).reduce((sum: number, row: any) => {
      if (!row.action_type) return sum;
      const base = row.action_type.base_points || 0;
      return sum + (row.action_type.negative
        ? -Math.abs(base)
        : Math.abs(base));
    }, 0);

    // 7.3. izračun prosjeka zadnjih 7 prethodnih obračunatih dana
    const { data: last7, error: histErr } = await sb
      .from("daily_summary")
      .select("points_earned, day")
      .eq("user_id", u.id)
      .lt("day", effectiveDay)
      .order("day", { ascending: false })
      .limit(7);

    if (histErr) {
      results.push({
        user: u.display_name,
        status: "greška dohvat povijesti",
        details: histErr.message,
      });
      continue;
    }

    const avg =
      last7 && last7.length > 0
        ? last7.reduce(
            (s: number, r: any) => s + (r.points_earned || 0),
            0
          ) / last7.length
        : 0;

    // 7.4. bonus logika:
    // ako je današnji učinak > prosjek, daj +10
    const bonus = pointsToday > avg ? 10 : 0;

    // 7.5. upiši u daily_summary
    const { error: insErr } = await sb.from("daily_summary").insert({
      user_id: u.id,
      day: effectiveDay,
      points_earned: pointsToday,
      avg_baseline: avg,
      bonus_applied: bonus,
    });

    if (insErr) {
      results.push({
        user: u.display_name,
        status: "greška daily_summary insert",
        details: insErr.message,
      });
      continue;
    }

    // 7.6. ako je bonus > 0, povećaj total_points
    if (bonus > 0) {
      // dohvat trenutnih bodova
      const { data: statsRow, error: statsErr } = await sb
        .from("user_stats")
        .select("total_points")
        .eq("user_id", u.id)
        .single();

      if (!statsErr && statsRow) {
        const newTotal =
          (statsRow.total_points ?? 0) + bonus;

        const { error: statsUpdateErr } = await sb
          .from("user_stats")
          .update({
            total_points: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", u.id);

        if (statsUpdateErr) {
          results.push({
            user: u.display_name,
            pointsToday,
            avgBaseline: avg,
            bonusApplied: bonus,
            status: "greška update bodova",
            details: statsUpdateErr.message,
          });
          continue;
        }

        results.push({
          user: u.display_name,
          pointsToday,
          avgBaseline: avg,
          bonusApplied: bonus,
          newTotal,
          status: "OK+bonus",
        });
      } else {
        // nije uspio dohvatiti user_stats
        results.push({
          user: u.display_name,
          pointsToday,
          avgBaseline: avg,
          bonusApplied: bonus,
          status: "greška dohvat user_stats",
        });
      }
    } else {
      // nema bonusa
      results.push({
        user: u.display_name,
        pointsToday,
        avgBaseline: avg,
        bonusApplied: 0,
        status: "OK",
      });
    }
  }

  // 8. gotovi smo
  return NextResponse.json({
    day: effectiveDay,
    results,
  });
}
