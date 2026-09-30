"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { can, roleLabels, roles, type Role } from "@/lib/permissions";
import type { Membership, Unit, Workspace } from "@/server/workspace";

const values = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); return new FormData(event.currentTarget); };
const titles: Record<Role, string> = { owner: "Sua operação começa aqui.", manager: "Visão da gestão", cashier: "Acesso do caixa", attendant: "Acesso do atendimento", kitchen: "Acesso da cozinha", courier: "Acesso das entregas", admin: "Gestão da empresa", member: "Seu acesso" };

export function WorkspaceClient({ initial }: { initial: Workspace }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const creationKey = useRef<string | null>(null);
  const unitKey = useRef<string | null>(null);
  const org = data.organizations.find((o) => o.id === data.selectedId);

  async function refresh(id?: string) {
    const response = await fetch(`/api/workspace${id ? `?organizationId=${id}` : ""}`, { cache: "no-store" });
    if (response.status === 401) { router.replace("/entrar"); router.refresh(); throw new Error("Sua sessão expirou."); }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }
  async function run(body: object, success: string) {
    setPending(true); setError(""); setMessage(""); setInviteUrl("");
    try {
      const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (response.status === 401) { router.replace("/entrar"); router.refresh(); return false; }
      if (!response.ok) throw new Error(result.error);
      if (result.invitationToken) setInviteUrl(`${window.location.origin}/convite#${result.invitationToken}`);
      await refresh(result.organizationId ?? data.selectedId ?? undefined);
      setMessage(success); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Conexão perdida. Atualize antes de repetir a operação."); return false; }
    finally { setPending(false); }
  }
  async function choose(id: string) {
    setPending(true); setError(""); setMessage(""); setInviteUrl("");
    try { await refresh(id); } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao atualizar."); }
    finally { setPending(false); }
  }
  async function logout() {
    setPending(true);
    try { const result = await authClient.signOut(); if (result.error) throw new Error(); router.replace("/entrar"); router.refresh(); }
    catch { setError("Não foi possível sair. Verifique a conexão e tente novamente."); setPending(false); }
  }
  return <main className="workspace">
    <header><span className="brand">morethis<span>®</span></span><div className="toolbar"><span>{data.actor.name}</span><button className="secondary" disabled={pending} onClick={logout}>Sair</button></div></header>
    <div className="workspace-top"><div><p className="eyebrow">EMPRESAS E ACESSOS</p><h1>{org ? titles[org.role] : "Bem-vindo ao Morethis."}</h1><p className="muted">{org ? `${org.name} · ${roleLabels[org.role]}` : "Cadastre seu estabelecimento para começar."}</p></div>
    <div className="toolbar">{data.organizations.length > 0 && <label>Empresa<select aria-label="Empresa ativa" disabled={pending} value={data.selectedId ?? ""} onChange={(e) => { setCreating(false); void choose(e.target.value); }}>{data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}<button className="secondary" disabled={pending} onClick={() => setCreating(!creating)}>{creating ? "Fechar cadastro" : "Nova empresa"}</button><button className="secondary" disabled={pending} onClick={() => void choose(data.selectedId ?? "")}>Atualizar dados</button></div></div>
    {pending && <p role="status">Processando…</p>}{error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {inviteUrl && <section className="panel"><h2>Convite criado — não enviado</h2><p>Compartilhe este link com a pessoa convidada por um canal de sua confiança. Ele expira em 48 horas e aparece somente agora.</p><label>Link do convite<input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} /></label><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); setMessage("Link copiado."); } catch { setError("Selecione e copie o link manualmente."); } }}>Copiar link</button></section>}
    {(!org || creating) && <section className="panel"><h2>Cadastrar empresa e primeira unidade</h2><form className="form-grid" onSubmit={async (event) => {
      const f = values(event); creationKey.current ??= crypto.randomUUID();
      if (await run({ action: "onboard", requestId: creationKey.current, name: f.get("name"), slug: f.get("slug"), unitName: f.get("unitName"), timezone: f.get("timezone") }, "Empresa e primeira unidade criadas.")) { creationKey.current = null; setCreating(false); }
    }}><label>Nome da empresa<input name="name" required minLength={2} maxLength={100} /></label><label>Identificador da empresa<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={60} placeholder="minha-pastelaria" /></label><label>Nome da primeira unidade<input name="unitName" defaultValue="Unidade principal" required minLength={2} maxLength={100} /></label><Timezone /><button disabled={pending}>Criar empresa</button></form></section>}
    {org && <>
      <section className="panel"><div className="section-heading"><h2>Unidades disponíveis</h2><span>BRL · Português brasileiro</span></div>
        {!data.units.length && <p>Você ainda não tem acesso a uma unidade. Solicite ao proprietário.</p>}
        <div className="unit-grid">{data.units.map((unit) => <UnitCard key={`${unit.id}-${unit.version}`} unit={unit} canEdit={can(org.role, "units:manage")} pending={pending} save={(fields) => run({ action: "unit.update", organizationId: org.id, unitId: unit.id, version: unit.version, ...fields }, "Configuração da unidade atualizada.")} />)}</div>
      </section>
      {org.role === "owner" && <>
        <section className="panel"><h2>Adicionar unidade</h2><form className="form-grid" onSubmit={async (event) => { const f = values(event); unitKey.current ??= crypto.randomUUID(); if (await run({ action: "unit.create", organizationId: org.id, unitId: unitKey.current, name: f.get("name"), timezone: f.get("timezone") }, "Unidade criada.")) unitKey.current = null; }}><label>Nome da unidade<input name="name" required minLength={2} maxLength={100} /></label><Timezone /><button disabled={pending}>Adicionar unidade</button></form></section>
        <section className="panel"><h2>Equipe e permissões</h2><p>Somente proprietários alteram os acessos. Os demais perfis precisam de unidades explícitas.</p>
          {data.members.map((member) => <MemberCard key={`${org.id}-${member.user_id}-${member.version}`} member={member} units={data.units} pending={pending} save={(fields) => run({ action: "member.update", organizationId: org.id, userId: member.user_id, version: member.version, ...fields }, "Acesso atualizado.")} remove={() => run({ action: "member.remove", organizationId: org.id, userId: member.user_id, version: member.version }, "Membro removido da empresa.")} />)}
          <h3>Convidar pessoa</h3><p className="muted">Convite manual por link. Envio por e-mail não configurado.</p>
          <form className="form-grid" onSubmit={(event) => { const f = values(event); void run({ action: "invitation.create", organizationId: org.id, email: f.get("email"), role: f.get("role"), unitIds: f.getAll("unitIds") }, "Convite criado. Nenhuma mensagem foi enviada."); }}><label>E-mail da pessoa<input name="email" type="email" required maxLength={254} /></label><label>Perfil<select name="role" defaultValue="attendant">{roles.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></label><UnitChoices units={data.units} selected={[]} /><button disabled={pending}>Gerar convite</button></form>
          {data.invitations.length > 0 && <div className="table-scroll"><table><caption>Últimos convites</caption><thead><tr><th>E-mail</th><th>Perfil</th><th>Estado</th><th>Ação</th></tr></thead><tbody>{data.invitations.map((i) => <tr key={i.id}><td>{i.email}</td><td>{roleLabels[i.role]}</td><td>{i.accepted_at ? "Aceito" : i.revoked_at ? "Revogado" : new Date(i.expires_at) < new Date() ? "Expirado" : "Aguardando aceite"}</td><td>{!i.accepted_at && !i.revoked_at && <button className="secondary" disabled={pending} onClick={() => { if (window.confirm("Revogar este convite? O link deixará de funcionar.")) void run({ action: "invitation.revoke", organizationId: org.id, invitationId: i.id }, "Convite revogado."); }}>Revogar</button>}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="panel"><h2>Dados da empresa</h2><form key={`${org.id}-${org.version}`} className="form-grid" onSubmit={(event) => { const f = values(event); void run({ action: "organization.update", organizationId: org.id, version: org.version, name: f.get("name") }, "Empresa atualizada."); }}><label>Nome da empresa<input name="name" defaultValue={org.name} required minLength={2} maxLength={100} /></label><button disabled={pending}>Salvar empresa</button></form></section>
      </>}
      {can(org.role, "audit:read") && <section className="panel"><h2>Histórico de alterações</h2><p className="muted">Últimos 50 eventos acessíveis ao seu perfil. Datas no fuso da primeira unidade visível.</p>{!data.audit.length ? <p>Nenhuma alteração registrada neste escopo.</p> : <div className="table-scroll"><table><thead><tr><th>Quando</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>{data.audit.map((a) => <tr key={a.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: data.units[0]?.timezone ?? "America/Sao_Paulo" }).format(new Date(a.created_at))}</td><td>{a.action}</td><td><details><summary>Ver registro</summary><pre>{JSON.stringify(a.details, null, 2)}</pre></details></td></tr>)}</tbody></table></div>}</section>}
      <p className="scope-note">Etapa de acesso e configuração. Cardápio, PDV, cozinha, caixa e estoque ainda não estão disponíveis. Suas configurações são salvas no servidor; sem conexão, aguarde e atualize antes de repetir uma ação.</p>
    </>}
  </main>;
}

function Timezone({ value = "America/Sao_Paulo" }: { value?: string }) { const id = useId(); return <label>Fuso horário<input name="timezone" defaultValue={value} required maxLength={80} list={id} /><datalist id={id}><option>America/Sao_Paulo</option><option>America/Manaus</option><option>America/Rio_Branco</option><option>America/Noronha</option></datalist></label>; }
function UnitChoices({ units, selected }: { units: Unit[]; selected: string[] }) { return <fieldset className="unit-choices"><legend>Unidades autorizadas</legend>{units.map((u) => <label key={u.id}><input name="unitIds" type="checkbox" value={u.id} defaultChecked={selected.includes(u.id)} />{u.name}</label>)}</fieldset>; }
function UnitCard({ unit, canEdit, pending, save }: { unit: Unit; canEdit: boolean; pending: boolean; save: (fields: object) => Promise<boolean> }) {
  return <article><h3>{unit.name}</h3><p>{unit.timezone}</p>{canEdit && <details><summary>Editar unidade</summary><form onSubmit={(event) => { const f = values(event); void save({ name: f.get("name"), timezone: f.get("timezone") }); }}><label>Nome da unidade<input name="name" defaultValue={unit.name} required minLength={2} maxLength={100} /></label><Timezone value={unit.timezone} /><button disabled={pending}>Salvar unidade</button></form></details>}</article>;
}
function MemberCard({ member, units, pending, save, remove }: { member: Membership; units: Unit[]; pending: boolean; save: (fields: object) => Promise<boolean>; remove: () => Promise<boolean> }) {
  return <details className="member"><summary>{member.name || member.email} · {roleLabels[member.role]}</summary><p>{member.email}</p><form className="form-grid" onSubmit={(event) => { const f = values(event); if (window.confirm("Confirmar a alteração das permissões deste membro?")) void save({ role: f.get("role"), unitIds: f.getAll("unitIds") }); }}><label>Perfil<select name="role" defaultValue={member.role}>{!roles.includes(member.role as typeof roles[number]) && <option value={member.role}>{roleLabels[member.role]}</option>}{roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></label><UnitChoices units={units} selected={member.unit_ids} /><p className="muted">Proprietários acessam todas as unidades, independentemente das seleções.</p><button disabled={pending}>Salvar acesso</button><button className="danger" type="button" disabled={pending} onClick={() => { if (window.confirm("Remover o acesso desta pessoa à empresa?")) void remove(); }}>Remover da empresa</button></form></details>;
}
