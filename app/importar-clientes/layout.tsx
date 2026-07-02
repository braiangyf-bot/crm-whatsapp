import type { ReactNode } from "react";
import { exigirUsuarioPagina } from "@/lib/auth/exigirUsuarioPagina";

export default async function ImportarClientesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await exigirUsuarioPagina();

  return children;
}