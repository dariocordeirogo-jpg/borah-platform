import { Button } from "@/components/ui/button";

/** Ação da equipe que exige motivo (vai para a auditoria). */
export function ReasonForm({
  action,
  id,
  label,
  hidden,
  required = true,
  variant = "outline",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  hidden?: Record<string, string>;
  required?: boolean;
  variant?: "outline" | "primary";
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="reason"
        required={required}
        minLength={required ? 3 : undefined}
        maxLength={300}
        placeholder={required ? "Motivo (obrigatório)" : "Observação (opcional)"}
        aria-label={`Motivo: ${label}`}
        className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm"
      />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
