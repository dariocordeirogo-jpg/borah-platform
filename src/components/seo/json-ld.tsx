/** Dados estruturados (schema.org) para buscadores. O conteúdo vem só do servidor; "<" é escapado. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
