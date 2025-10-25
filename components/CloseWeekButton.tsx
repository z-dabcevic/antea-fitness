"use client";
import { useState } from "react";

export default function CloseWeekButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function closeWeek() {
    setLoading(true);
    setMsg("Zatvaram tjedan...");
    const now = new Date();
    const day = now.getUTCDay(); // 0 = nedjelja, 1 = ponedjeljak
    const diff = (day + 6) % 7; // broj dana od ponedjeljka
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diff);
    const weekStart = monday.toISOString().split("T")[0];

    const res = await fetch("/api/weekly-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart }),
    });
    const data = await res.json();
    setMsg(`Obračun za ${weekStart}:\n${JSON.stringify(data.results, null, 2)}`);
    setLoading(false);
  }

  return (
    <div className="text-center mt-6">
      <button
        onClick={closeWeek}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        🔒 Zatvori tekući tjedan
      </button>
      <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{msg}</p>
    </div>
  );
}
