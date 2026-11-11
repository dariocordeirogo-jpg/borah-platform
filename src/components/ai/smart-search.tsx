import { Sparkles } from "lucide-react";
import { smartSearch } from "@/lib/ai/actions";

/** Busca inteligente: a pessoa escreve como fala ("tênis de corrida usado até 300") e a IA monta os filtros. */
export function SmartSearch() {
  return (
    <form action={smartSearch} className="mb-4 space-y-1.5 rounded-xl bg-navy-soft p-3">
      <label htmlFor="busca-ia" className="flex items-center gap-1.5 text-xs font-semibold text-navy">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Busca inteligente
      </label>
      <input
        id="busca-ia"
        name="q"
        maxLength={200}
        placeholder="Ex.: tênis de corrida usado até 300 reais"
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
      />
      <button type="submit" className="w-full rounded-lg bg-navy py-2 text-sm font-semibold text-white hover:bg-navy-2">
        Buscar com IA
      </button>
    </form>
  );
}
