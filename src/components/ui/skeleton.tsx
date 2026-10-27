import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-shimmer rounded-xl bg-[linear-gradient(90deg,hsl(var(--secondary))_25%,hsl(var(--border))_50%,hsl(var(--secondary))_75%)] bg-[length:200%_100%]", className)} {...props} />;
}

export { Skeleton };
