"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="workspace"><h1>Não foi possível carregar seu espaço.</h1><p>Verifique a conexão e a disponibilidade do servidor.</p><button onClick={reset}>Tentar novamente</button></main>;
}
