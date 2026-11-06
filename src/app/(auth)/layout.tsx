import { LogoMark } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-surface px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-card)] md:p-8">
        <LogoMark className="mx-auto h-12 w-12" />
        {children}
      </div>
    </div>
  );
}
