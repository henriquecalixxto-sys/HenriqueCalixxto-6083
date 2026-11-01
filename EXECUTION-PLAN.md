# Plano de Execução Definitivo — Separação DEV / PROD

**Calixto Agency · 29 de agosto de 2026 · v1.0**

Base: `SEPARATION-PLAN.md` (Bloqueador 2) + a auditoria somente-leitura de
arquitetura de deployment. Este documento substitui os dois como fonte de
verdade operacional.

**INFORMATION-ONLY.** Nada foi criado, modificado, apagado, renomeado,
migrado, rotacionado ou reiniciado na produção desta análise. Nenhum backup
executado, nenhum banco ou bucket criado, nenhum `git init`, nenhum `db:push`,
nenhum seed, nenhum deploy. Nenhum valor de segredo aparece neste arquivo.

---

## 1. EXECUTIVE SUMMARY

O projeto está em melhor posição do que o rótulo "produção compartilhada"
sugere, e em posição pior do que o roadmap de go-live sugeria.

**Melhor**, porque **não existe produção real**. Não há domínio próprio, nem
processo de servidor de produção, nem pipeline, nem usuários reais dependendo de
uptime. O host `*.runable.site` é preview do dev server deste sandbox. Isso
significa que não existe migração de dados de produção a fazer: **nenhum byte de
dado real precisa se mover.** A separação é um exercício de provisionar
infraestrutura nova e reapontar configuração — não de mover dados quentes.

**Pior**, porque a lista de bloqueadores presumia que "produção" existia e só
precisava ser endurecida. Não é o caso. Antes de separar DEV de PROD é preciso
**criar PROD**: destino de deploy, cofre de segredos, domínio, processo de
servidor, caminho de deploy e caminho de rollback. Quatro dos cinco não existem.
E há um bloqueador estrutural que nenhuma fase anterior nomeou: **sem Git, não
existe rollback de código.** A única forma de desfazer uma mudança hoje é editar
de volta à mão. Isso precisa ser resolvido antes do primeiro deploy, não depois.

**Reordenação em relação ao plano anterior.** O `SEPARATION-PLAN.md` colocava a
criação do ambiente DEV como Fase 1 e presumia que produção seria a infra atual
"promovida no lugar". Mantenho a promoção in-place — é o caminho que não move
dados — mas **antecipo uma dependência crítica**: a viabilidade da Runable como
host de produção precisa ser respondida *antes* de qualquer provisionamento.
Se a Runable não oferecer cofre de segredos e variáveis por ambiente, a decisão
de host muda, e com ela muda o que se provisiona, onde e com quais credenciais.
Provisionar antes de saber é fazer duas vezes. Essa verificação é a Fase 0.

**Estado atual dos bloqueadores de go-live:** 1 preparado/não executado ·
2 planejado/não executado · 3, 4, 5 não iniciados · e dois bloqueadores novos
identificados por esta análise (ausência de destino PROD, ausência de Git).

**Veredito:** o go-live está a 11 fases de distância, das quais 7 dependem
exclusivamente de você em dashboards externos. Nada nesta análise pode ser
executado sem essa dependência ser resolvida primeiro.

---

## 2. ARQUITETURA-ALVO

### 2.1 DEVELOPMENT

| Item | Alvo |
| --- | --- |
| Onde roda | Sandbox / máquina local do desenvolvedor |
| Banco | Turso `calixto-dev` — novo, vazio, mesma região |
| Token de banco | Escopado **exclusivamente** ao banco dev |
| Bucket | Tigris `calixto-dev-docs` — novo, vazio, privado |
| Par de chaves | Escopado **exclusivamente** ao bucket dev |
| `NODE_ENV` | `development` |
| `WEBSITE_URL` | `http://localhost:4200` |
| `BETTER_AUTH_SECRET` | Valor exclusivo de dev |
| Dados | Apenas sintéticos, via `seed` |
| Origem do env | `.env` local, gitignored, com `DEV_DATABASE_URL` e `DEV_S3_BUCKET` |
| Acesso a PROD | **Zero, imposto por escopo de credencial** — não por código |

A imposição é o ponto. Checagem em código é contornável por engano; uma chave
sem permissão no bucket de produção não é contornável por engano nenhum.

### 2.2 PREVIEW / STAGING — recomendação: **não criar agora**

Vale enfrentar a pergunta em vez de criar por reflexo. Um ambiente de staging se
justifica quando há (a) equipe com mais de um desenvolvedor, (b) deploys
frequentes com risco de regressão, ou (c) necessidade de validar com dados
parecidos com os de produção antes de publicar. Nenhuma das três se aplica hoje:
é um desenvolvedor, o produto ainda não foi lançado, e validar com dados
parecidos com produção é precisamente o que não se quer fazer.

O custo de criar staging agora é concreto: **um terceiro banco, um terceiro
bucket, um terceiro conjunto de credenciais e um terceiro lugar onde um segredo
pode vazar** — mais superfície para proteger, num momento em que dois ambientes
ainda não estão separados. Um staging mal isolado é pior que nenhum staging,
porque tende a receber uma cópia de dados reais "só para testar".

**Recomendação:** ir a dois ambientes primeiro. Reavaliar staging quando existir
uma segunda pessoa com acesso ou o primeiro deploy que dê medo. Se e quando
existir, ele recebe recursos 100% próprios e dados sintéticos — nunca cópia de
produção — e entra na mesma disciplina de escopo de credencial.

O preview atual da Runable, importante: **ele hoje é o DEV**, não um terceiro
ambiente. Depois da separação ele continua sendo a janela pública do sandbox de
desenvolvimento, e por isso não deve nunca carregar credencial de produção.

### 2.3 PRODUCTION

| Item | Alvo | Existe hoje? |
| --- | --- | --- |
| Domínio próprio | Domínio comprado, HTTPS, DNS apontado | Não |
| Processo de servidor | `packages/web/src/server.ts` (Bun.serve) rodando de verdade | Escrito, nunca executado |
| Gerenciador de processo | pm2 via `ecosystem.config.cjs`, ou o que o host oferecer | Não em execução |
| Banco | Turso — o banco atual, promovido in-place | Sim (compartilhado) |
| Bucket | Tigris — o bucket atual, promovido in-place | Sim (compartilhado) |
| Credenciais | Escopadas por recurso, criadas novas | Não |
| Segredos | **Fora do filesystem**, em cofre injetado no deploy | Não — hoje em `.env` |
| `NODE_ENV` | `production` | Não |
| `RUNABLE_URL` | **Ausente** | Presente |
| Variáveis de dev | **Ausentes** (`DEV_DATABASE_URL`, `DEV_S3_BUCKET`, `ALLOW_DESTRUCTIVE`) | n/a |
| Processo de deploy | Documentado em `DEPLOYMENT.md`, reproduzível | Não |
| Rollback | Deploy anterior restaurável + snapshot de banco + PITR | Não |
| Build servido | Artefato de `bun run build`, não dev server | Não |

Duas invariantes, ambas não-negociáveis:

1. **Produção nunca depende de credencial de desenvolvimento.** Valores de prod
   existem só no cofre. O desenvolvedor não consegue ler, logo não consegue vazar.
2. **Desenvolvimento nunca alcança documento de produção.** Imposto por escopo de
   chave no provedor.

---

## 3. SEQUÊNCIA SEGURA DE MIGRAÇÃO

### 3.1 A sequência, e por que esta ordem

```
FASE 0   Preservação + decisão de host        ← nada muda ainda
FASE 1   Criar ambiente DEV                   ← recursos novos e vazios
FASE 2   Provar isolamento                    ← o gate que importa
FASE 3   Preparar código                      ← só código, sem infra
FASE 4   Criar destino PROD                   ← infra nova
FASE 5   Migrar segredos para o cofre         ← primeiro risco de indisponibilidade
FASE 6   Rotacionar credenciais               ← PRIMEIRO PONTO DE NÃO-RETORNO
FASE 7   Git e versionamento                  ← habilita rollback de código
FASE 8   Deploy inicial
FASE 9   Validação pós-deploy
FASE 10  Go-Live
```

Três decisões de ordenação merecem justificativa:

**Por que a decisão de host vem antes de tudo (Fase 0).** Provisionar banco,
bucket e credenciais antes de saber onde produção vai rodar significa refazer o
trabalho se a resposta for "a Runable não tem cofre de segredos". A pergunta é
gratuita; o retrabalho não é.

**Por que Git vem na Fase 7 e não na 1.** Tentador colocar antes — versionamento
é boa prática e não custa nada. Mas o primeiro commit é o commit que define o
histórico permanente, e enquanto o `.env` com credenciais reais está no
workspace, o risco de commitá-lo por acidente é real e a consequência é
permanente: um segredo commitado uma vez está exposto para sempre no histórico, e
rotação passa a ser o único remédio. **Git entra depois que os segredos de
produção saíram do filesystem** (Fase 5) e depois que as credenciais expostas
foram rotacionadas (Fase 6). Aí o primeiro commit nasce limpo por construção, não
por cuidado.

**Por que rotação (6) vem depois de separação (1–5).** Rotacionar credenciais que
ainda são compartilhadas significa rotacionar de novo depois de separar. E rotacionar
`BETTER_AUTH_SECRET` antes do cadastro de 2FA dos admins (Bloqueador 4) invalida
o cadastro, porque esse secret criptografa os segredos TOTP em repouso.

### 3.2 Passos que são apenas código

Fase 3 inteira, mais a instrumentação da Fase 2. Nenhum depende de infraestrutura
existir, todos são reversíveis por edição, nenhum toca dados. Detalhe na seção 5.

### 3.3 Passos que exigem dashboard externo

Fases 0 (Runable), 1 (Turso + Tigris), 4 (Runable + DNS), 5 (cofre), 6 (Turso +
Tigris + provedores), 7 (Git), 8 (Runable). Sete das onze fases. Detalhe na seção 6.

### 3.4 Reversibilidade

| Fase | Reversível | Como |
| --- | --- | --- |
| 0 | Sim — nada muda | — |
| 1 | Sim | Recursos novos e vazios; apagar sem consequência |
| 2 | Sim | Somente leitura |
| 3 | Sim | Edição de código |
| 4 | Sim | Destino novo; desfazer é não usar |
| 5 | Sim | Valores antigos ainda válidos; reverter e redeployar |
| **6** | **NÃO** | **Revogação é irreversível** |
| 7 | Parcial | Histórico é permanente: um segredo commitado não sai |
| 8 | Sim, se 7 existir | Redeploy do commit anterior |
| 9 | Sim | Somente leitura |
| 10 | Não aplicável | Decisão, não operação |

### 3.5 Primeiro ponto de não-retorno

**Fase 6, no momento em que a credencial antiga é revogada** — não quando a nova
é criada. Criar chave nova é aditivo e reversível; revogar a antiga é o ato que
não desfaz. Até esse instante, todo o plano volta atrás editando configuração.

Segundo ponto, de natureza diferente: **o primeiro commit Git (Fase 7)**. Não é
irreversível operacionalmente — é irreversível *informacionalmente*. O que entrar
no histórico fica.

### 3.6 Dependências obrigatórias antes da rotação (Fase 6)

Nenhuma credencial deve ser rotacionada antes de **todas** estas existirem:

1. Ambiente DEV separado e com isolamento **provado** (Fase 2, não Fase 1).
2. Destino de produção existindo e sabidamente funcional (Fase 4).
3. Cofre de segredos operando, com os valores atuais já dentro (Fase 5).
4. Backup do banco validado, com restauração testada — não só o arquivo gerado.
5. Credenciais novas criadas, deployadas e confirmadas funcionando, com as antigas
   ainda válidas.
6. Janela de manutenção acordada para o `BETTER_AUTH_SECRET`, que desloga todos.
7. Decisão tomada sobre 2FA: rotação **antes** do cadastro dos admins.

---

## 4. CHECKLIST OPERACIONAL

Legenda — **Resp**: AGENTE ou USUÁRIO · **Rev**: reversível.

### FASE 0 — Preservação e decisão de host

| # | Ação | Resp | Risco | Rev | Pré-requisito | Evidência de conclusão |
| --- | --- | --- | --- | --- | --- | --- |
| 0.1 | Responder na UI da Runable as 14 perguntas da seção 7 | USUÁRIO | Nenhum | Sim | — | Respostas escritas, uma por pergunta |
| 0.2 | Decidir o host de produção com base em 0.1 | USUÁRIO + AGENTE | Decisão errada custa retrabalho de fases 4–8 | Sim | 0.1 | Decisão registrada com justificativa |
| 0.3 | `bun run backup` do banco compartilhado atual | AGENTE | Baixo — somente leitura no banco; grava arquivo local | Sim | — | Diretório `backups/<ts>/` com contagem de linhas por tabela > 0 |
| 0.4 | Validar o snapshot: contagens conferem, colunas de credencial `__REDACTED__` | AGENTE | Nenhum | Sim | 0.3 | Relatório de contagens + confirmação da redação |
| 0.5 | Ensaio de restauração do snapshot em banco descartável | USUÁRIO (cria o banco) + AGENTE | Médio — jamais apontar restore para o banco compartilhado | Sim | 0.3, banco descartável | Restauração concluída, contagens iguais às de 0.4 |
| 0.6 | Copiar o snapshot para fora do sandbox | USUÁRIO | Baixo — **o arquivo contém dados de clientes** | Sim | 0.4 | Cópia confirmada em local controlado |
| 0.7 | Inventariar onde valores de produção existem hoje (`.env`, shells, backups, notas, histórico de terminal) | USUÁRIO | Nenhum | Sim | — | Lista de locais |

Nota sobre 0.5: sem ensaio de restauração, o backup é uma suposição. É o único
item da Fase 0 que exige criar um recurso, e ele é descartável.

Nota sobre 0.6: o snapshot redige credenciais, **não** dados de clientes. Trate
o arquivo com o mesmo cuidado do banco.

### FASE 1 — Criação do ambiente DEV

| # | Ação | Resp | Risco | Rev | Pré-requisito | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Criar banco Turso `calixto-dev` (mesma região) | USUÁRIO | Baixo — recurso novo e vazio | Sim | 0.2 | Banco listado no dashboard |
| 1.2 | Criar token escopado **só** em `calixto-dev` | USUÁRIO | Baixo | Sim | 1.1 | Token criado; escopo confirmado na UI |
| 1.3 | Criar bucket Tigris `calixto-dev-docs`, privado, sem acesso público | USUÁRIO | Baixo | Sim | 0.2 | Bucket listado; acesso público bloqueado |
| 1.4 | Criar par de chaves escopado **só** em `calixto-dev-docs` | USUÁRIO | Baixo | Sim | 1.3 | Par criado; escopo confirmado na UI |
| 1.5 | Gerar `BETTER_AUTH_SECRET` exclusivo de dev (`openssl rand -base64 48`) | USUÁRIO | Nenhum | Sim | — | Valor gerado, não compartilhado |
| 1.6 | Montar o `.env` de dev: credenciais dev + `DEV_DATABASE_URL` + `DEV_S3_BUCKET` + `NODE_ENV=development` + `WEBSITE_URL` local | USUÁRIO | **ALTO se errar** — manter valor de prod aqui anula a fase | Sim | 1.1–1.5 | `bun run security:separation` mostra "proven distinct" nas duas checagens |
| 1.7 | Confirmar que nenhum valor de produção sobrou no `.env` de dev | AGENTE | Nenhum — verificação | Sim | 1.6 | Fingerprints de 1.6 diferentes dos registrados na auditoria |
| 1.8 | `bun run db:push` com o `.env` de dev carregado | AGENTE | **ALTO se o env estiver errado** — aplica DDL onde `DATABASE_URL` apontar | Sim (banco vazio) | 1.7 aprovado | Schema aplicado; tabelas listadas no banco dev |
| 1.9 | `bun run seed` — dados sintéticos | AGENTE | Médio — mesma dependência de env | Sim | 1.8 | Linhas de seed presentes |
| 1.10 | Confirmar zero registro real de cliente no banco dev | AGENTE | Nenhum | Sim | 1.9 | Consulta mostrando só registros de seed |
| 1.11 | Subir o dev server contra a infra dev e exercitar login/upload/download/delete | AGENTE | Baixo | Sim | 1.9 | Fluxo completo funcionando; objeto aparece no bucket dev |

**1.7 é um gate, não uma etapa.** É a última verificação antes de 1.8 executar
DDL. Se 1.7 não passar, 1.8 não roda — porque um `.env` mal montado transforma
`db:push` em alteração de schema no banco de produção.

### FASE 2 — Testes de isolamento

| # | Ação | Resp | Risco | Rev | Pré-requisito | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Chave dev contra bucket PROD → esperado `403` | AGENTE | Nenhum — leitura negada | Sim | 1.4 | Saída com `403`/AccessDenied |
| 2.2 | Token dev contra banco PROD → esperado rejeitado | AGENTE | Nenhum | Sim | 1.2 | Conexão recusada |
| 2.3 | `bun run security:separation` em dev → "proven distinct" ×2 | AGENTE | Nenhum | Sim | 1.6 | PASS, FAIL 0 |
| 2.4 | Comparar fingerprints dev vs prod — todos diferentes | AGENTE | Nenhum | Sim | 2.3 | Duas saídas, nenhum digest coincidente |
| 2.5 | Testar o tripwire: `DEV_DATABASE_URL` = URL de prod sob `NODE_ENV=production` → boot recusado. **Desfazer depois.** | AGENTE | Baixo — não sobe servidor, só valida o guard | Sim | 2.3 | Guard recusa; variável removida em seguida |
| 2.6 | Confirmar que `guardDestructiveScript` agora protege de fato | AGENTE | Nenhum | Sim | 3.5 | Script destrutivo recusado no perfil errado |

**2.1 e 2.2 são os únicos itens de todo o plano que provam separação.** Todo o
resto prova que o ambiente novo funciona. Se 2.1 e 2.2 não falharem fechado, o
Bloqueador 2 não está resolvido, independentemente do que digam os arquivos.

### FASE 3 — Preparação do código

Todos AGENTE, todos reversíveis por edição, nenhum depende de infra existir.
Detalhe de cada um na seção 5.

| # | Ação | Risco | Pré-req | Evidência |
| --- | --- | --- | --- | --- |
| 3.1 | Parametrizar `apiUrl` do mobile por ambiente | Baixo | — | Build de dev e de prod resolvendo hosts diferentes |
| 3.2 | Guard: recusar `RUNABLE_URL` sob `NODE_ENV=production` | Baixo | — | Checagem falha quando a variável está presente em prod |
| 3.3 | Corrigir/remover `website.config.json` boilerplate | Muito baixo | — | Arquivo descreve a realidade ou não existe |
| 3.4 | Alinhar fallback do desktop (3000 → 4200) | Muito baixo | — | Desktop em dev abre a porta correta |
| 3.5 | Endurecer `guardDestructiveScript`: exigir confirmação por fingerprint do alvo, não só `NODE_ENV` | Médio — muda comportamento de scripts de ops | — | Script recusa alvo de prod mesmo com `NODE_ENV=development` |
| 3.6 | Ampliar `golive` e `security:separation` com as provas 2.1/2.2 | Baixo | Fase 2 | Gate falha quando o isolamento não é comprovável |
| 3.7 | Escrever `DEPLOYMENT.md` | Nenhum | 0.2 | Documento com build, start, env, rollback |
| 3.8 | Preparar `.gitignore` e árvore para primeiro commit limpo (sem `git init`) | Nenhum | — | Varredura mostra zero segredo rastreável |

**3.5 é a correção mais importante da fase.** O guard atual confia em
`NODE_ENV`, e é exatamente `NODE_ENV=development` que um desenvolvedor tem
quando aponta ferramenta destrutiva para produção. Um guard que valida o *alvo*
em vez do *rótulo do ambiente* fecha o furo real.

### FASE 4 — Preparação do destino PROD

| # | Ação | Resp | Risco | Rev | Pré-req | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Criar o destino de produção no host escolhido | USUÁRIO | Médio | Sim | 0.2 | Destino existindo, ainda sem tráfego |
| 4.2 | Confirmar que o destino executa build e start do projeto | USUÁRIO | Médio | Sim | 4.1 | Build concluído; processo no ar |
| 4.3 | Registrar/apontar domínio próprio, HTTPS ativo | USUÁRIO | Médio — erro de DNS causa indisponibilidade | Sim | 4.1 | HTTPS válido no domínio |
| 4.4 | Confirmar persistência de filesystem e comportamento de restart | USUÁRIO | Nenhum | Sim | 4.2 | Resposta registrada |
| 4.5 | Confirmar acesso a logs do processo | USUÁRIO | Nenhum | Sim | 4.2 | Logs visíveis |
| 4.6 | Ajustar `WEBSITE_URL`, CSP `frame-ancestors` e origens para o domínio real | AGENTE | Médio — errar aqui quebra login e CORS | Sim | 4.3 | Login funcionando no domínio; CORS negando origem estranha |

### FASE 5 — Migração de segredos

| # | Ação | Resp | Risco | Rev | Pré-req | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 5.1 | Cadastrar no cofre **todas** as variáveis de prod (seção 6, Runable) | USUÁRIO | Médio — variável faltando impede o boot | Sim | 4.1 | Lista do cofre confere com `.env.template` |
| 5.2 | Garantir ausência de `RUNABLE_URL`, `DEV_*`, `ALLOW_DESTRUCTIVE` no cofre | USUÁRIO | Baixo | Sim | 5.1 | `env.no_dev_vars_in_prod` → PASS |
| 5.3 | `NODE_ENV=production` no destino | USUÁRIO | Baixo | Sim | 5.1 | `security:config` perfil prod, FAIL 0 |
| 5.4 | Boot de produção lendo **só** do cofre | USUÁRIO | Médio | Sim | 5.1–5.3 | Serviço no ar sem `.env` no filesystem |
| 5.5 | Remover valores de produção do `.env` do sandbox e dos locais de 0.7 | USUÁRIO | **Não reversível na prática** — se não houver cópia no cofre, o acesso se perde | Parcial | 5.4 confirmado | `security:separation` no sandbox mostra fingerprints de dev |

**5.5 é o passo que efetivamente remove a exposição** identificada na auditoria.
Só depois dele "segredos de produção não estão acessíveis de estação de
desenvolvimento" passa a ser verdade.

### FASE 6 — Rotação de credenciais · **PONTO DE NÃO-RETORNO**

Procedimento detalhado em `SECRET-ROTATION.md` §4. Regra invariável: criar →
deployar → confirmar → **só então** revogar.

| # | Ação | Resp | Risco | Rev | Pré-req | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 6.1 | Apagar e revogar as três credenciais não usadas | USUÁRIO | Baixo — nada as consome | NÃO (revogação) | 5.4 | Ausentes do cofre; revogadas no provedor |
| 6.2 | Regenerar a chave de CLI por trás de `RUNABLE_URL` | USUÁRIO | Baixo | NÃO | — | CLI autentica com a nova |
| 6.3 | Novo par Tigris escopado só ao bucket de prod; deployar; confirmar | USUÁRIO | Médio | Sim até 6.4 | 5.4 | Upload e download funcionando em prod |
| 6.4 | Revogar o par Tigris antigo | USUÁRIO | Médio | **NÃO** | 6.3 confirmado | Requisição com o par antigo → rejeitada |
| 6.5 | Novo token Turso; deployar; confirmar | USUÁRIO | Médio | Sim até 6.6 | 5.4 | App lê dados |
| 6.6 | Revogar o token Turso antigo | USUÁRIO | Médio | **NÃO** | 6.5 confirmado | Conexão com o antigo → rejeitada |
| 6.7 | Novo `BETTER_AUTH_SECRET`, em janela de manutenção | USUÁRIO | **ALTO** — desloga todos; invalida cadastros de 2FA | NÃO | 6.3–6.6, janela acordada | Login + desafio 2FA concluído após re-cadastro |

6.4 e 6.6 são as únicas evidências reais de que a rotação aconteceu. As outras
provam que a credencial nova funciona.

### FASE 7 — Git e versionamento

| # | Ação | Resp | Risco | Rev | Pré-req | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1 | Varredura final: nenhum segredo em arquivo rastreável | AGENTE | Nenhum | Sim | 5.5, 6.x | `bun run security:secrets` PASS |
| 7.2 | `git init` e primeiro commit com `.env` ignorado | AGENTE | **Alto se 7.1 falhar** — histórico é permanente | **NÃO** (histórico) | 7.1 PASS | `git status` sem `.env`; primeiro commit inspecionado |
| 7.3 | Criar repositório remoto **privado** | USUÁRIO | Médio — público expõe o código | Sim | 7.2 | Repositório privado confirmado |
| 7.4 | Push inicial | AGENTE/USUÁRIO | Médio | Não | 7.3 | Commit no remoto |
| 7.5 | Restringir quem tem acesso ao repositório e a builds | USUÁRIO | Médio | Sim | 7.3 | Lista de acesso revisada |

### FASE 8 — Deploy inicial

| # | Ação | Resp | Risco | Rev | Pré-req | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| 8.1 | `bun run build` e verificar artefato | AGENTE | Baixo | Sim | Fase 3 | Build sem erro; `dist` gerado |
| 8.2 | `bun run golive` no perfil de produção | AGENTE | Nenhum | Sim | 3.6 | 0 falhas |
| 8.3 | Deploy do commit versionado no destino de prod | USUÁRIO | **Médio-alto** — primeiro tráfego real | Sim se 7.x existir | 7.4, 8.2 | Site no ar no domínio próprio |
| 8.4 | Confirmar que produção serve o **build**, não o dev server | AGENTE | Nenhum | Sim | 8.3 | Assets com hash e cache imutável |
| 8.5 | Registrar o procedimento de rollback já testado | USUÁRIO + AGENTE | Nenhum | Sim | 8.3 | Rollback exercitado ao menos uma vez |

### FASE 9 — Validação pós-deploy

| # | Ação | Resp | Evidência |
| --- | --- | --- | --- |
| 9.1 | `security:config` e `security:separation` em prod | AGENTE | FAIL 0 nos dois |
| 9.2 | Contagens de linhas e de objetos iguais às de 0.4 | AGENTE | Comparação registrada |
| 9.3 | Chave de prod contra bucket de **dev** → `403` | AGENTE | Saída negada |
| 9.4 | Download como dono → 200; como outra conta → `404` | AGENTE | Suíte de IDOR |
| 9.5 | Login + 2FA + reset de senha (após Bloqueador 5) | AGENTE | Fluxos concluídos |
| 9.6 | `/admin/security`: 0 falhas de config, 0 admins sem 2FA | AGENTE | Print do painel |
| 9.7 | Sem regressão: site público, formulários, blog, portal, admin | AGENTE | Todas as páginas carregando |
| 9.8 | Logs e alertas chegando | USUÁRIO | Evento de teste visível |

### FASE 10 — Go-Live

| # | Ação | Resp | Pré-requisito |
| --- | --- | --- | --- |
| 10.1 | Revisar os 14 critérios de bloqueio da seção 8 — todos limpos | USUÁRIO + AGENTE | Fases 0–9 |
| 10.2 | Confirmar PITR e versionamento ativos (Bloqueador 3) | USUÁRIO | — |
| 10.3 | Confirmar 2FA de todos os admins (Bloqueador 4) | USUÁRIO | 6.7 |
| 10.4 | Confirmar reset de senha entregável, SPF/DKIM (Bloqueador 5) | USUÁRIO | — |
| 10.5 | Confirmar janela de retenção contra obrigação legal | USUÁRIO | — |
| 10.6 | Publicar | USUÁRIO | Todos acima |

---

## 5. MUDANÇAS DE CÓDIGO PLANEJADAS

Nenhuma implementada. Todas as oito podem ser feitas **antes** de a infraestrutura
existir, e nenhuma tem impacto em produção hoje — porque produção não existe.
Esse é justamente o argumento para fazê-las agora: o custo de errar nunca vai ser
mais baixo do que é neste momento.

### 5.1 `apiUrl` do mobile por ambiente

- **Arquivo:** `packages/mobile/app.json` (+ provável `app.config.ts` e `eas.json`)
- **Hoje:** `extra.apiUrl` fixo no host de preview do sandbox.
- **Desejado:** resolvido por perfil de build; build de produção aponta ao domínio próprio.
- **Risco:** Baixo. **Impacto em prod:** nenhum hoje; sem isso, um build de loja aponta para o sandbox.
- **Antes da infra?** Sim — com o domínio como placeholder documentado.

### 5.2 Guard contra `RUNABLE_URL` em produção

- **Arquivo:** `packages/web/src/api/lib/env-guard.ts`
- **Hoje:** a variável pode existir em produção sem nenhum aviso; carrega credencial embutida e não é usada por código de aplicação.
- **Desejado:** checagem `warn` em qualquer perfil e `fatal` sob `NODE_ENV=production`.
- **Risco:** Baixo — pode recusar um boot mal configurado, que é a intenção.
- **Antes da infra?** Sim.

### 5.3 `website.config.json` boilerplate

- **Arquivo:** `packages/web/website.config.json`
- **Hoje:** `name: "Runable"`, `url: example.com`, `hostname: xyz.runable.site`, `port: 8080`, descrição mencionando Cloudflare Workers. Nada disso é verdade.
- **Desejado:** refletir a realidade, ou ser removido se nada o consome.
- **Risco:** Muito baixo, com uma ressalva — **confirmar antes se a plataforma lê este arquivo**. Remover algo que o host consome causa falha de deploy.
- **Antes da infra?** Sim, depois dessa confirmação.

### 5.4 Inconsistência de porta no desktop

- **Arquivo:** `packages/desktop/electron/main.ts`
- **Hoje:** `WEBSITE_URL ?? "http://localhost:3000"`, enquanto o dev roda em 4200.
- **Desejado:** fallback 4200, e `WEBSITE_URL` documentada como obrigatória.
- **Risco:** Muito baixo. **Antes da infra?** Sim.

### 5.5 `guardDestructiveScript` — a mudança que mais importa

- **Arquivo:** `packages/web/src/api/lib/guard-script.ts`
- **Hoje:** bloqueia só quando `NODE_ENV=production`. Um desenvolvedor com `NODE_ENV=development` apontando para o banco de produção passa direto. **O guard está desarmado exatamente no cenário que o motivou.**
- **Desejado:** validar o **alvo**, não o rótulo. Comparar o fingerprint do `DATABASE_URL`/`S3_BUCKET` efetivos com uma lista de alvos de produção conhecidos e recusar por padrão, exigindo confirmação explícita por fingerprint.
- **Risco:** Médio — muda o comportamento de `retention`, `restore`, `seed` e `purge-test-accounts`. Precisa de teste em dev.
- **Impacto em prod:** positivo; fecha o furo destrutivo real.
- **Antes da infra?** Sim, mas a lista de alvos só fica completa na Fase 4.

### 5.6 Ampliar `golive` / `security:separation`

- **Arquivos:** `scripts/go-live-check.sh`, `packages/web/src/api/ops/check-separation.ts`
- **Hoje:** as checagens de separação passam como "não-provadas" quando as variáveis-evidência não existem.
- **Desejado:** exigir prova ativa — `403` da chave cruzada e recusa do token cruzado — como asserções do gate.
- **Risco:** Baixo. **Antes da infra?** Estrutura sim; a asserção só passa a valer na Fase 2.

### 5.7 `DEPLOYMENT.md`

- **Hoje:** não existe documento algum descrevendo como o código chega ao ar.
- **Desejado:** build, start, variáveis por ambiente, procedimento de deploy, rollback, contatos, o que fazer quando falha.
- **Risco:** Nenhum. **Antes da infra?** Só depois de 0.2 — documentar um deploy que ainda não foi decidido é inventar.

### 5.8 Preparação do primeiro commit limpo

- **Arquivos:** `.gitignore`, e uma varredura da árvore.
- **Hoje:** `.gitignore` já cobre `.env`; não há repositório, logo não há histórico contaminado — posição limpa que vale preservar.
- **Desejado:** varredura confirmando zero segredo em arquivo rastreável, `backups/` e artefatos ignorados, screenshots e `/tmp` fora.
- **Risco:** Nenhum na preparação. **Não executar `git init` nesta fase** — ver 3.1 da seção 3.
- **Antes da infra?** Sim.

---

## 6. AÇÕES QUE EXIGEM INTERVENÇÃO DO USUÁRIO

**Regra que vale para todas as plataformas:** nunca me envie valor de token,
chave secreta, senha, string de conexão completa, chave privada, código de backup
de 2FA ou o conteúdo de um `.env`. Me envie **nomes de variáveis, nomes de
recursos, regiões, escopos, status e mensagens de erro**. Se precisar confirmar
que dois valores diferem, use `bun run security:separation`, que compara por
fingerprint sem revelar nada.

Em screenshots, **oculte qualquer campo de valor de credencial**. Um token
parcialmente visível ainda reduz o espaço de busca de um atacante.

### Runable

- **Procurar:** configurações do projeto — ambientes, variáveis de ambiente, secrets, domínios, build/start command, deploys, logs, rollback, integração Git.
- **Criar:** nada ainda. Fase 0 é só levantamento.
- **Trazer de volta:** as 14 respostas da seção 7, textualmente.
- **Screenshots úteis:** tela de variáveis de ambiente **com os valores ocultos**; tela de deploys/histórico; tela de domínios; tela de configuração de build e start.
- **Nunca compartilhar:** valores das variáveis, `RUNABLE_URL`, chave de CLI.

### Turso

- **Procurar:** lista de bancos, região de cada um, tokens, e a seção de backups/PITR.
- **Criar:** banco `calixto-dev` (1.1); token escopado a ele (1.2); mais tarde, token novo de prod (6.5).
- **Trazer de volta:** nome e região do banco dev; confirmação de que o token é escopado a um banco só; se PITR está ativo no banco de produção e qual a janela de retenção; se é possível escopar token por banco (se não for, isso muda o desenho).
- **Screenshots úteis:** lista de bancos; tela de criação de token mostrando o **escopo** (não o token).
- **Nunca compartilhar:** `DATABASE_AUTH_TOKEN`, URL completa com credencial.

### Tigris

- **Procurar:** buckets, configuração de acesso público, versionamento de objetos, access keys e o escopo de cada uma.
- **Criar:** bucket `calixto-dev-docs` privado (1.3); par de chaves escopado a ele (1.4); mais tarde, par novo de prod (6.3).
- **Trazer de volta:** nome do bucket dev; confirmação de acesso público bloqueado; se versionamento está ativo no bucket de produção; **se é possível restringir uma access key a um bucket específico** — esta é a pergunta mais importante das duas plataformas, porque é ela que impõe o isolamento.
- **Screenshots úteis:** configuração de permissão do bucket; tela de escopo da chave.
- **Nunca compartilhar:** `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

Se o Tigris não permitir escopo por bucket, o isolamento passa a depender de
contas separadas — e isso precisa ser decidido antes da Fase 1, não descoberto
durante ela.

### GitHub (ou outro provedor Git)

- **Procurar:** criação de repositório **privado**; configurações de visibilidade e de colaboradores.
- **Criar:** repositório privado (7.3), somente depois de 7.1 passar.
- **Trazer de volta:** URL do repositório; confirmação de que é privado; lista de quem tem acesso.
- **Screenshots úteis:** aba de visibilidade; lista de colaboradores.
- **Nunca compartilhar:** token de acesso pessoal, chave SSH privada.

### DNS / registrador de domínio

- **Procurar:** domínio disponível; painel de registros DNS.
- **Criar:** registro apontando ao destino de produção (4.3); depois, SPF e DKIM do Resend.
- **Trazer de volta:** domínio escolhido; confirmação de HTTPS válido; qual tipo de registro o host exige.
- **Screenshots úteis:** tabela de registros DNS — sem risco de segredo aqui.
- **Nunca compartilhar:** credenciais de acesso ao registrador.

### Resend (Bloqueador 5 — depois)

- **Procurar:** API keys; verificação de domínio remetente.
- **Criar:** chave de API; registros SPF e DKIM.
- **Trazer de volta:** confirmação de domínio verificado; endereço remetente escolhido.
- **Nunca compartilhar:** `RESEND_API_KEY`.

---

## 7. QUESTÕES PARA A UI DA RUNABLE

Não presumo nada sobre a plataforma. As respostas determinam se ela pode hospedar
produção ou se é preciso outro host — e determinam a Fase 4 inteira.

**Bloqueantes — se qualquer uma for "não", a decisão de host muda:**

1. Existe um ambiente de **Production separado** do preview, ou o preview é o único destino?
2. Existem **variáveis de ambiente por ambiente**, de modo que prod e preview não compartilhem valores?
3. Existe **armazenamento seguro de secrets** — valores gravados, mascarados na UI, injetados no processo, e **não** materializados num arquivo do repositório?
4. O preview **pode ser separado** de produção, com credenciais próprias?

**Estruturais:**

5. Existe **domínio customizado** com HTTPS gerenciado?
6. Existe **build command** configurável? (Precisa rodar `bun run build`.)
7. Existe **start command** configurável? (Precisa rodar `bun packages/web/src/server.ts`, ou pm2 via `ecosystem.config.cjs`.)
8. O processo pode executar **Bun** e, se necessário, **pm2** ou comando customizado?
9. O **filesystem é persistente** entre restarts e deploys? (Importa para `backups/` e para saber se um `.env` sobrevive.)

**Operacionais:**

10. Existe **deploy manual** sob demanda?
11. Existe **integração Git**, com deploy a partir de um commit?
12. Existe **histórico de deploys**?
13. Existe **rollback** para um deploy anterior?
14. Existem **logs** do processo, com retenção e busca?

**Como interpretar as respostas.** Se 1–4 forem sim, a Runable hospeda produção e
a Fase 4 é curta. Se 3 for não, os segredos não podem sair do filesystem nessa
plataforma, e o alvo "segredos fora do filesystem" é inalcançável nela — isso
força outro host, e é o cenário que mais muda o plano. Se 11–13 forem não, o
rollback passa a depender inteiramente de Git mais deploy manual, e a Fase 7
deixa de ser boa prática e passa a ser pré-requisito de segurança operacional.

---

## 8. CRITÉRIOS DE BLOQUEIO DO GO-LIVE

Qualquer um destes verdadeiro, o go-live está bloqueado. Sem exceção e sem
"resolvemos depois do lançamento".

| # | Condição de bloqueio | Como verificar |
| --- | --- | --- |
| B-1 | DEV ainda alcança o banco de PROD | Teste 2.2 não retorna rejeição |
| B-2 | DEV ainda alcança o bucket de PROD | Teste 2.1 não retorna `403` |
| B-3 | Segredos de PROD existem em `.env` local ou em qualquer filesystem de dev | Item 5.5 não concluído |
| B-4 | Não existe backup **validado com restauração testada** | Itens 0.4 e 0.5 |
| B-5 | Não existe domínio de produção com HTTPS | Item 4.3 |
| B-6 | Mobile ainda aponta para o host de preview | `app.json` / perfil de build |
| B-7 | Não existe caminho de rollback testado | Item 8.5 |
| B-8 | Não existe versionamento Git com histórico limpo | Fase 7 |
| B-9 | `RUNABLE_URL` presente em produção | `env.no_dev_vars_in_prod` + guard 5.2 |
| B-10 | `NODE_ENV` não é `production` em produção | `security:config` perfil prod |
| B-11 | Testes de isolamento não executados ou com falha | Fase 2 completa |
| B-12 | Credenciais expostas não rotacionadas, ou antigas não revogadas | Itens 6.4 e 6.6 |
| B-13 | Produção servindo dev server em vez do build | Item 8.4 |
| B-14 | Admins de produção sem 2FA (Bloqueador 4) | `/admin/security` |
| B-15 | Reset de senha não entregável (Bloqueador 5) | Teste de entrega real |
| B-16 | PITR/versionamento inativos (Bloqueador 3) | Dashboards |
| B-17 | Janela de retenção não confirmada juridicamente | Confirmação escrita |

B-1, B-2, B-3 e B-12 são os quatro que definem se este bloqueador foi resolvido.
Os demais são condições de go-live que passam por outros bloqueadores.

---

## 9. RISCOS ADICIONAIS ENCONTRADOS

Sete pontos que nenhuma análise anterior nomeou.

**R-1 — Ausência de Git é ausência de rollback.** Registrado antes como boa
prática pendente. É mais que isso: sem histórico, um deploy ruim não tem para
onde voltar, e nenhuma mudança é atribuível ou revisável. Isso torna a Fase 7
pré-requisito da Fase 8, não um item de higiene.

**R-2 — O guard destrutivo depende do rótulo errado.** Já detalhado em 5.5.
Repito aqui porque é o risco mais provável de se materializar antes do go-live:
não exige atacante, só um comando de rotina no terminal errado.

**R-3 — O arquivo de backup contém dados de clientes.** O backup redige
credenciais, não dados pessoais. Levá-lo para fora do sandbox (item 0.6) cria uma
segunda cópia de dados de clientes num lugar provavelmente menos protegido que o
banco. É necessário — e precisa de destino controlado, não a pasta de downloads.

**R-4 — O ensaio de restauração precisa de um banco descartável.** Testar restore
é obrigatório, e `restore.ts` escreve no que `DATABASE_URL` apontar. O ensaio é,
por natureza, o momento de maior risco de sobrescrever produção por engano. Por
isso 0.5 exige banco descartável e verificação de alvo antes de rodar.

**R-5 — `website.config.json` é documentação falsa.** Diz "Cloudflare Workers",
`example.com`, porta 8080. Ninguém age com base nele hoje — mas é exatamente o
arquivo que alguém abre às pressas durante um incidente. Documentação errada custa
mais que documentação ausente.

**R-6 — Sem staging, o primeiro deploy é o primeiro teste real do caminho de
deploy.** Consequência aceita da recomendação 2.2, e mitigável: fazer 8.3 antes
de apontar o DNS, validar no endereço provisório do host, e só então apontar o
domínio. Assim o primeiro tráfego real não é o primeiro deploy.

**R-7 — A rotação do `BETTER_AUTH_SECRET` colide com o Bloqueador 4.** Rotacionar
invalida cadastros de 2FA, porque esse secret criptografa os segredos TOTP em
repouso. Se os admins se cadastrarem antes de 6.7, o cadastro é perdido. Ordem
correta: 6.7 primeiro, cadastro depois. Já registrado em `SECRET-ROTATION.md`,
mas vale repetir porque a ordem é fácil de inverter.

---

## 10. PRÓXIMO PASSO RECOMENDADO

**Fase 0, item 0.1: responder as 14 perguntas da seção 7 na UI da Runable.**

É o único trabalho que não depende de nada, e dele dependem quatro fases. Enquanto
as perguntas 1 a 4 estiverem sem resposta, provisionar qualquer coisa é apostar em
qual será a arquitetura — e cada aposta errada custa refazer o provisionamento com
credenciais novas, que é exatamente o retrabalho que a ordenação deste plano
existe para evitar.

Em paralelo, e sem risco, posso executar a Fase 3 inteira (mudanças de código),
com uma exceção: `DEPLOYMENT.md` (3.7) precisa da decisão de host, e o ajuste do
`website.config.json` (3.3) precisa da confirmação de que a plataforma não lê esse
arquivo.

**Sequência recomendada a partir daqui:** 0.1 → 0.2 → Fase 3 (código, em paralelo)
→ 0.3–0.7 (backup e validação) → Fase 1.

**NO CHANGES MADE — READ-ONLY / INFORMATION-ONLY**
