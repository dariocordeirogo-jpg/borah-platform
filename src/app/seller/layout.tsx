import type { Metadata } from "next";
import { SellerNav } from "@/components/seller-nav";

export const metadata: Metadata = { title: { default: "Painel do vendedor", template: "%s · ZEXI SELLER" }, robots: { index: false } };

export default function SellerLayout({ children }: LayoutProps<"/seller">) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 [&>*]:min-w-0 md:grid-cols-[230px_1fr] md:gap-6 md:py-8">
      <aside className="md:sticky md:top-32 md:self-start">
        <SellerNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
