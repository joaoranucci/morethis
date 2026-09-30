import { LoginForm } from "./form";
import Link from "next/link";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">morethis<span>®</span></Link>
        <span className={styles.headerNote}>SEU NEGÓCIO. MAIS POSSIBILIDADES.</span>
      </header>
      <div className={styles.content}>
        <section className={styles.showcase} aria-labelledby="product-heading">
          <p className={styles.eyebrow}><span /> SEU PRÓXIMO PASSO COMEÇA AQUI</p>
          <h2 id="product-heading">Menos complexidade.<br /><span>Mais possibilidades.</span></h2>
          <p className={styles.description}>Empresas, unidades e pessoas conectadas.<br />Um só lugar para fazer seu negócio acontecer.</p>
          <div className={styles.scene} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.dashboard}>
              <div className={styles.mockTop}><span className={styles.mockLogo}>m<span>+</span></span><span>Seu espaço de gestão</span><i>•••</i></div>
              <div className={styles.mockBody}>
                <div className={styles.mockNav}><b>▦</b><span>▤</span><span>◇</span><span>◎</span></div>
                <div className={styles.mockContent}>
                  <div className={styles.mockTitle}>Tudo conectado.<span>Visão geral</span></div>
                  <div className={styles.mockStats}><div><span>Empresas</span><strong>01</strong></div><div><span>Unidades</span><strong>03</strong></div><div><span>Equipe</span><strong>12</strong></div></div>
                  <div className={styles.chart}><div /><div /><div /><div /><div /><div /><div /><div /><div /><div /></div>
                  <div className={styles.mockBottom}><span>Uma operação, novas possibilidades</span><span>↗</span></div>
                </div>
              </div>
            </div>
            <div className={styles.floatingCard}><span className={styles.check}>✓</span><div><strong>Sua equipe, conectada</strong><span>Cada pessoa no lugar certo.</span></div></div>
            <div className={styles.floatingTile}>m<span>+</span></div>
          </div>
          <div className={styles.features}><span>Empresas e unidades</span><span>Gestão de equipe</span><span>Controle de acesso</span></div>
        </section>
        <LoginForm />
      </div>
      <footer className={styles.footer}><span>morethis · Feito para o seu próximo passo.</span><span>Gestão em um só lugar.</span></footer>
    </main>
  );
}
