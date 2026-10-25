import { Info } from "lucide-react";

export function DemoNotice() {
  return (
    <div className="demo-notice" role="note">
      <Info size={18} aria-hidden="true" />
      <span><strong>Vista previa.</strong> Estos eventos y precios son ejemplos; todavía no se pueden comprar entradas.</span>
    </div>
  );
}
