# ⚽ Brasileirão Stats - Gols, Mercados e Expected Goals (xG)

Dashboard analítico completo do Campeonato Brasileiro Série A, alimentado diretamente pelos dados oficiais de partidas e Expected Goals (xG) do **FotMob**.

---

## 🚀 Funcionalidades

- **Métricas de Gols por Equipe e Geral**:
  - Over 0.5, Over 1.5, Over 2.5 e Over 3.5
  - Ambas Marcam (BTTS)
  - 0 x 0 (Zero a Zero real)
  - Média de Gols Pró, Sofridos e Totais
- **Expected Goals (xG)**:
  - xG por jogo (produção ofensiva esperada)
  - xGA por jogo (chances de perigo cedidas)
  - Saldo xG (xGD)
  - Comparativo visual e gráficos de dispersão/barras
- **Filtros de Contexto**: Geral, Mandante e Visitante
- **Comparador de Partidas (Simulador Poisson)**:
  - Projeção de gols esperados (lambda) no confronto
  - Placar mais provável e probabilidades de mercado (1X2, Over 1.5/2.5, BTTS)
- **Histórico & Tendências**:
  - Registro de todas as rodadas com xG individual
  - Gráficos de média móvel de 5 jogos (rolling averages)
- **Escudos Oficiais**:
  - Todos os 20 clubes com seus respectivos escudos em alta qualidade

---

## 🤖 Automação Diária no GitHub (GitHub Actions)

O repositório já inclui o arquivo [`.github/workflows/update-data.yml`](.github/workflows/update-data.yml).

### Como funciona:
1. **Agendamento**: Executa todos os dias às **03:00 (Horário de Brasília)** automaticamente.
2. **Execução Manual**: É possível disparar a atualização a qualquer momento na aba **Actions** > **Atualização Diária dos Dados do Brasileirão** > **Run workflow**.
3. **Commit Automático**: Quando novos jogos forem realizados, os novos dados são baixados do FotMob, processados e comitados automaticamente no repositório.

---

## 🌐 Como Publicar no GitHub Pages

1. Crie seu repositório no GitHub e envie os arquivos:
   ```bash
   git init
   git add .
   git commit -m "feat: versão inicial do Brasileirão Stats com xG e automação"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
2. No seu repositório no GitHub, vá em **Settings** > **Pages**.
3. Em **Branch**, selecione `main` e a pasta `/ (root)`.
4. Clique em **Save**.
5. Seu app estará no ar no link: `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`

---

## 💻 Executando Localmente

Para rodar o app na sua máquina:

```bash
# Iniciar o servidor local
npm run serve
# ou: python3 -m http.server 8080
```
Acesse no navegador: `http://localhost:8080/index.html`

### Para atualizar os dados manualmente:
```bash
npm run update
```
*(Executa a coleta do FotMob e o processamento dos arquivos JSON).*
