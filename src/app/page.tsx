import Link from "next/link";

const foundations = [
  ["01", "Empresas e unidades", "Organize seus estabelecimentos e configure o fuso horário de cada unidade."],
  ["02", "Cada pessoa, seu acesso", "Defina os perfis da equipe e as unidades em que cada pessoa pode trabalhar."],
  ["03", "Histórico de alterações", "Consulte os registros de mudanças de configuração e permissões da empresa."],
];

export default function Home() {
  return (
    <main>
    <header><Link className="brand" href="/">MoreThis<span>®</span></Link><span className="badge">BASE DE DESENVOLVIMENTO</span></header>
    <section className="hero">
    <p className="eyebrow">GESTÃO PARA RESTAURANTES</p>
    <h1>Uma base sólida.<br /><span>Espaço para crescer.</span></h1>
        <p className="intro">Comece organizando sua empresa, unidades e equipe. Uma base para a gestão da sua pastelaria ou lanchonete.</p>
        <Link className="button" href="/app">Acessar Morethis <span aria-hidden="true">↗</span></Link>
      </section>
      <section id="foundation" aria-labelledby="foundation-title">
        <div className="section-heading"><h2 id="foundation-title">Seu espaço de gestão</h2><span>Empresas · Unidades · Equipe</span></div>
        <div className="grid">{foundations.map(([number, title, description]) => (
          <article key={number}><span className="number">{number}</span><h3>{title}</h3><p>{description}</p></article>
        ))}</div>
      </section>
      <aside><span className="status-dot" /><p><strong>Configure sua empresa, unidades e equipe.</strong><br />Acesso com senha e convites manuais já disponíveis. Os módulos de operação do restaurante estão em desenvolvimento.</p></aside>
      <footer><span>MORETHIS / WORKSPACE</span><span>Construído para evoluir.</span></footer>
    </main>
  );
}
