## Objetivo

Adaptar o Baasi CRM ao seu negócio de serviços financeiros (consulta de crédito, certificado digital, FAMPE/Pronampe/BNDES), cobrindo o ciclo completo do cliente e ativando ferramentas para trabalhar a carteira existente.

## 1. Pipeline de vendas

Criar **um pipeline único** chamado “Serviços Financeiros” com as etapas:

```text
Lead → Qualificação → Proposta → Documentação → Análise Bancária → Aprovado → Concluído
```

Plus zonas automáticas já existentes: **Perdido** (com motivo).

E adicionar um campo obrigatório no negócio: **Tipo de Serviço** (select):
- Consulta de Crédito
- Certificado Digital
- FAMPE
- Pronampe
- BNDES
- Outro

Esse campo permite filtrar o Kanban e os relatórios por linha de serviço, mantendo um fluxo único.

## 2. Campos personalizados

Adicionar via sistema de campos customizados já existente (Settings → Campos Personalizados).

**Em Empresas (Cliente):**
- CNPJ (texto com máscara)
- Porte: MEI / ME / EPP / Médio / Grande
- Faturamento anual (moeda)
- Banco de relacionamento (texto)
- Score de crédito (número 0–1000)
- Restrições / Observações de crédito (texto longo)
- Validade do Certificado Digital (data)
- Tipo de certificado: A1 / A3 — e-CPF / e-CNPJ

**Em Negócios (Operação):**
- Tipo de Serviço (já citado acima)
- Valor solicitado (moeda)
- Linha de crédito (texto: FAMPE, Pronampe, BNDES Giro, etc.)
- Taxa (%) (número)
- Prazo (meses) (número)
- Banco operador (texto)

Os campos aparecem automaticamente no drawer/modal de Empresa e Negócio, e ficam disponíveis para filtros e relatórios.

## 3. Trabalhar a carteira

Três frentes, usando o **Automation Engine** já existente:

### 3a. Alertas de inatividade
Reaproveitar a página **Risk Rules** (já existe) e pré-configurar 2 regras:
- Cliente sem atividade há **60 dias** → badge amarelo + tarefa “Reativar contato”
- Cliente sem atividade há **120 dias** → badge vermelho + notificação para o responsável

### 3b. Lembretes de renovação/vencimento
Criar uma **automação agendada** (pg_cron, padrão do projeto) que:
- Verifica diariamente a data **Validade do Certificado Digital** das empresas
- Cria automaticamente uma tarefa **30 dias antes** do vencimento: “Renovar certificado de {empresa}”
- Cria nova tarefa **7 dias antes** se a primeira ainda não foi concluída

### 3c. Cross-sell automático
Criar gatilho: ao mover um negócio para **Concluído**, o sistema:
- Identifica quais serviços o cliente ainda não contratou (com base nos negócios anteriores)
- Cria automaticamente tarefas de prospecção sugerindo os serviços faltantes (ex.: cliente que fez certificado → sugerir consulta de crédito; cliente que fez Pronampe → sugerir BNDES)
- A regra de cross-sell fica visível e editável em Settings, para você ajustar as combinações

Bônus: adicionar uma **tag automática de potencial** (Alto / Médio / Baixo) em Empresas, calculada a partir do faturamento e do nº de serviços contratados, exibida como badge na lista.

## 4. Dashboard adaptado

Ajustar o Dashboard para mostrar widgets úteis ao seu negócio:
- Negócios por **Tipo de Serviço** (gráfico de barras)
- Volume de capitais em análise (soma de “Valor solicitado” em Análise Bancária)
- Certificados vencendo nos próximos 30 / 60 / 90 dias
- Clientes inativos (60+ e 120+ dias)
- Funil de conversão por tipo de serviço

## 5. Onde ficam as configurações

- **Pipelines/etapas:** Settings → Pipelines
- **Tipo de Serviço e demais campos:** Settings → Campos Personalizados
- **Regras de inatividade:** menu Risk Rules (já existe)
- **Lembretes e cross-sell:** menu Automações
- **Pontuação de potencial:** Settings → Lead Scoring

## Entregáveis

1. Pipeline “Serviços Financeiros” com as 7 etapas criado via migração.
2. Campos personalizados (Empresa e Negócio) inseridos via migração + visíveis nos formulários.
3. Duas regras de inatividade pré-criadas.
4. Automação agendada de validade de certificado (edge function + pg_cron).
5. Automação de cross-sell ao concluir negócio.
6. Dashboard atualizado com os 5 widgets do item 4.
7. Filtros por “Tipo de Serviço” no Kanban de Negócios e em Relatórios.

## Detalhes técnicos

- Toda a parte de pipeline/etapas/campos custom é feita por **migração SQL** (seed) e usa as tabelas já existentes (`pipelines`, `pipeline_stages`, `custom_fields`, `custom_field_values`).
- Automações usam o **Automation Engine** já implementado (triggers + actions + pg_cron).
- O **Tipo de Serviço** será modelado como custom field do tipo `select` no `deals`, com filtro nativo no Kanban (`DealsKanban.tsx`) e nos relatórios (`Reports.tsx`).
- O cálculo de potencial será feito por uma função SQL `calculate_company_potential(company_id)` chamada por trigger nas tabelas `deals` e `companies`.
- Widgets do dashboard usam Recharts (já no projeto) e queries agregadas no Supabase.
- Nenhum dado existente será apagado; tudo é aditivo.
