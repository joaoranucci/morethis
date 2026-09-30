# Operação, backup e restauração

## Ambientes

Desenvolvimento: banco morethis, origem 127.0.0.1:3000. Testes: morethis_test, origem 127.0.0.1:3100. Testes não inserem demonstração no desenvolvimento. .env.test e capturas não são versionados. Nenhum deploy/serviço pago configurado.

Produção não validada. Antes de publicar: HTTPS, segredos próprios, banco TLS com privilégios mínimos, proxy que normalize IP encaminhado, política de cadastro/verificação de e-mail, monitoramento e retenção. Nunca use as credenciais locais publicamente.

## Saúde e rede

/api/health verifica processo; /api/ready verifica banco e tabela de sessões, devolvendo 503 genérico quando indisponível. Não valida todos os módulos/provedores. Erros de domínio são 4xx; falhas inesperadas não expõem detalhes internos.

Sem operação offline. Campos são preservados em erro. Resposta perdida pode corresponder a transação confirmada: atualize antes de repetir. Chave de criação é mantida na tela, mas não sobrevive a reload; confirme o cadastro existente primeiro.

## Backup local (PowerShell)

O dump contém dados pessoais, hashes e sessões. Armazene fora do repositório, com acesso restrito e criptografia. backups/ está ignorado, mas isso não protege o arquivo.

```powershell
New-Item -ItemType Directory -Force backups
docker compose exec -T db pg_dump -U morethis -d morethis -Fc -f /tmp/morethis-backup.dump
docker compose cp db:/tmp/morethis-backup.dump ./backups/morethis-backup.dump
```

Use nomes com data e não sobrescreva seu único backup. Em produção, usar mecanismo do provedor, retenção e RPO/RTO definidos. Backup não automatizado nesta entrega.

## Ensaio de restauração sem sobrescrever o original

```powershell
docker compose exec -T db createdb -U morethis morethis_restore
docker compose cp ./backups/morethis-backup.dump db:/tmp/morethis-restore.dump
docker compose exec -T db pg_restore -U morethis -d morethis_restore --no-owner --no-acl /tmp/morethis-restore.dump
docker compose exec -T db psql -U morethis -d morethis_restore -c "SELECT name, applied_at FROM schema_migrations ORDER BY name;"
```

Se o destino existir, escolha outro banco vazio; não use --clean. Verifique contagens, integridade, readiness e login em instância isolada apontando à cópia. Não conecte pagamentos/e-mail reais. Avalie revogar sessões e rotacionar segredos após incidente. Procedimento documentado, **não executado nesta entrega**.

## Testes

check, test:integration e test:e2e são independentes. Navegador exige build atualizado e test:setup. Aguarde um minuto ao repetir suíte que testou bloqueio de autenticação. CI usa banco descartável e Chromium; CI remota não executada por não haver remoto.
