import { Suspense } from "react";
import GuestCanteenClient from "./GuestCanteenClient";

export function generateStaticParams() {
  return [
    { canteenSlug: "main-canteen" },
    { canteenSlug: "north-canteen" },
    { canteenSlug: "south-canteen" },
  ];
}

interface GuestPageProps {
  params: Promise<{ canteenSlug: string }>;
}

async function CanteenContent({ params }: GuestPageProps) {
  const { canteenSlug } = await params;
  return <GuestCanteenClient canteenSlug={canteenSlug || "main-canteen"} />;
}

export default function GuestCanteenPage({ params }: GuestPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center text-xs text-stone-400 font-sans">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <span>Loading canteen...</span>
          </div>
        </div>
      }
    >
      <CanteenContent params={params} />
    </Suspense>
  );
}
