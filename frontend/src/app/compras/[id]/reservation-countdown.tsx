"use client";

import { useEffect, useState } from "react";

export function ReservationCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return <p className="purchase-countdown" role="timer">{remaining === null ? "Calculando tiempo restante…" : remaining > 0 ? `La reserva vence en ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "La reserva venció. Actualiza la página para ver su estado."}</p>;
}
