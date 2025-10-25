"use client";
import { useState } from "react";

export default function CloseDayButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function yyyymmddInTZ(date: Date, tz: string) {
    const fmt = new Intl.DateTimeFormat("hr-HR", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    });
    const parts = fmt.formatToParts(date).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
    // hr-HR daje "dd.mm.yyyy." → složimo YYYY-MM-DD
    const dd = parts.day.padStart(2, "0");
    const mm = parts.month.padStart(2, "0");
    const yyyy = parts.year;
    return `${yyyy}-${mm}-${dd}`;
  }

  async function closeYesterday() {
    setLoading(true);
    setMsg("Obračunavam jučerašnji dan...");
    const tz = "Europe/Zagreb";
    const now = new Date();
    // jučer u toj zoni:
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 1);
    const day = yyyymmddInTZ(d, tz);

    const res = await fetch("/api/daily-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day })
    });
    const data = await res.json();
    setMsg(`Dan ${day}: ${JSON.stringify(data.results, null, 2)}`);
    setLoading(false);
  }

  return (
    <div className="text-center mt-4">
      <button
        onClick={closeYesterday}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
      >
        🌙 Zatvori jučerašnji dan
      </button>
      <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">{msg}</p>
    </div>
  );
}
