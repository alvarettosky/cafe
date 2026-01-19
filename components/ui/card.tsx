"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}

export function Card({ className, children, hoverEffect = false, ...props }: CardProps) {
    const MotionDiv = motion.div as any;
    return (
        <MotionDiv
            initial={hoverEffect ? { opacity: 0, y: 10 } : undefined}
            animate={hoverEffect ? { opacity: 1, y: 0 } : undefined}
            whileHover={hoverEffect ? { y: -2, transition: { duration: 0.2 } } : undefined}
            className={cn(
                "rounded-xl border bg-card text-card-foreground shadow-sm glass p-6",
                className
            )}
            {...props}
        >
            {children}
        </MotionDiv>
    );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("flex flex-col space-y-1.5 pb-2", className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3 className={cn("font-semibold leading-none tracking-tight text-lg", className)} {...props}>
            {children}
        </h3>
    );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("pt-0", className)} {...props}>{children}</div>;
}
