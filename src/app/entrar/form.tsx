"use client";
import styles from "./login.module.css";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")); const password = String(form.get("password"));
    try {
      const response = signup
        ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
        : await authClient.signIn.email({ email, password });
      if (response.error) {
        setError(response.error.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente." : signup ? "Não foi possível criar a conta. Verifique os dados ou tente entrar." : "Não foi possível entrar. Confira seu e-mail e senha.");
      } else {
        // A fragment invitation stays in the browser and survives authentication.
        const invitation = window.sessionStorage.getItem("morethis-invitation");
        router.replace(invitation ? `/convite#${invitation}` : "/app"); router.refresh();
      }
    } catch { setError("Sem conexão. Seus dados não foram enviados. Tente novamente."); }
    finally { setPending(false); }
  }
  return <section className={styles.card} aria-labelledby="login-heading">
    <div className={styles.cardIcon} aria-hidden="true">↗</div><p className={styles.cardEyebrow}>SEU ESPAÇO MORETHIS</p><h1 id="login-heading">{signup ? "Comece pela sua conta." : "Bom ter você por aqui."}</h1>
    <p>{signup ? "Depois de criar a conta, cadastre sua empresa ou aceite um convite." : "Entre para acessar suas empresas e unidades."}</p>
    <form onSubmit={submit} aria-busy={pending}>
      {signup && <label>Seu nome<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>}
      <label>E-mail<input name="email" placeholder="voce@empresa.com" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Senha<input name="password" placeholder="Sua senha" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 12 : 1} maxLength={128} /></label>
      {signup && <small>Use pelo menos 12 caracteres.</small>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className={styles.submit} disabled={pending}>{pending ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}</button>
    </form>
    <div className={styles.switchRow}><span>{signup ? "Já faz parte?" : "Novo por aqui?"}</span><button type="button" className={styles.switchButton} disabled={pending} onClick={() => { setSignup(!signup); setError(""); }}>{signup ? "Já tenho conta" : "Criar uma conta"}</button></div>
    
  </section>;
}

