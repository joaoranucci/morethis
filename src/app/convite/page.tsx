"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function InvitationPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const value = window.location.hash.slice(1) || window.sessionStorage.getItem("morethis-invitation") || "";
    if (/^[a-f0-9]{64}$/.test(value)) {
      window.sessionStorage.setItem("morethis-invitation", value);
      window.history.replaceState(null, "", "/convite");
    }
  }, []);
  async function accept() {
    setPending(true); setError("");
    try {
      const token = window.sessionStorage.getItem("morethis-invitation");
      if (!token) throw new Error("Link de convite inválido. Peça um novo convite ao proprietário.");
      const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invitation.accept", token }) });
      if (response.status === 401) { router.replace("/entrar"); router.refresh(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.sessionStorage.removeItem("morethis-invitation");
      router.replace("/app"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível aceitar. Verifique sua conexão."); }
    finally { setPending(false); }
  }
  return <main className="access-page"><Link className="brand" href="/">morethis</Link><section className="access-card"><h1>Você recebeu um convite.</h1><p>Entre ou crie uma conta com o e-mail ao qual o convite foi destinado. O acesso só será concedido após a confirmação.</p>{error && <p className="notice error" role="alert">{error}</p>}<button disabled={pending} onClick={accept}>{pending ? "Confirmando…" : "Aceitar convite"}</button><p><Link href="/entrar">Entrar ou criar conta</Link></p></section></main>;
}
