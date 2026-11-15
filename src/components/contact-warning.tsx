import { ShieldAlert } from "lucide-react";
import { CONTACT_WARNING } from "@/lib/contact/rule";
import { cn } from "@/lib/utils";

/** Aviso de proibição de contato fora da Zexi (aparece quando o sistema ocultou algo). */
export function ContactWarning({ className }: { className?: string }) {
  return (
    <p
      role="alert"
      data-testid="aviso-contato"
      className={cn("flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900", className)}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{CONTACT_WARNING}</span>
    </p>
  );
}
