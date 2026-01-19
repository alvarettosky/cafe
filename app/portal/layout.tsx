"use client";

import { CustomerPortalProvider } from "@/context/customer-portal-context";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerPortalProvider>
      {children}
    </CustomerPortalProvider>
  );
}
