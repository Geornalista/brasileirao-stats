import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ============================================================
   CONFIGURAÇÃO
============================================================ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");
const APP_DIR = path.join(DATA_DIR, "app");

const SEASON = 2026;

const MATCHES_FILE = path.join(PROCESSED_DIR, "matches.json");

const OUTPUT_STATS = path.join(
  APP_DIR,
  `brasileirao_stats_${SEASON}.json`
);

const OUTPUT_HISTORY = path.join(
  APP_DIR,
  `brasileirao_historico_${SEASON}.json`
);

/* ============================================================
   UTILITÁRIOS
============================================================ */

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Erro ao ler ${file}:`, error.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function toNumber(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "-"
  ) {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const parsed = Number(
    String(value)
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function percent(part, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return round((part / total) * 100, 1);
}

function average(total, games) {
  if (!games || games <= 0) {
    return 0;
  }

  return round(total / games, 2);
}

function normalizeName(name) {
  if (!name) return "";

  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getNestedValue(obj, paths = []) {
  for (const pathString of paths) {
    const parts = pathString.split(".");
    let value = obj;

    for (const part of parts) {
      if (value === undefined || value === null) {
        break;
      }

      value = value[part];
    }

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

/* ============================================================
   NORMALIZAÇÃO DE EQUIPES
============================================================ */

const TEAM_ALIASES = {
  "athletico paranaense": "Athletico Paranaense",
  "athletico-pr": "Athletico Paranaense",
  "atletico paranaense": "Athletico Paranaense",

  "atletico mineiro": "Atlético-MG",
  "atlético mineiro": "Atlético-MG",
  "atletico-mg": "Atlético-MG",

  "red bull bragantino": "RB Bragantino",
  "bragantino": "RB Bragantino",

  "vasco": "Vasco da Gama",

  "coritiba": "Coritiba",

  "gremio": "Grêmio",

  "sao paulo": "São Paulo",

  "vitoria": "Vitória"
};

function canonicalTeamName(name) {
  if (!name) return "";

  const original = String(name).trim();
  const normalized = normalizeName(original);

  if (TEAM_ALIASES[normalized]) {
    return TEAM_ALIASES[normalized];
  }

  return original;
}

/* ============================================================
   ESTRUTURA DE ESTATÍSTICAS
============================================================ */

function createEmptyStats() {
  return {
    games: 0,

    wins: 0,
    draws: 0,
    losses: 0,

    goals_for: 0,
    goals_against: 0,
    total_goals: 0,

    avg_goals_for: 0,
    avg_goals_against: 0,
    avg_total_goals: 0,

    over_05_count: 0,
    over_15_count: 0,
    over_25_count: 0,
    over_35_count: 0,

    over_05: 0,
    over_15: 0,
    over_25: 0,
    over_35: 0,

    under_05: 0,
    under_15: 0,
    under_25: 0,
    under_35: 0,

    btts_count: 0,
    btts: 0,

    zero_zero_count: 0,
    zero_zero: 0,

    clean_sheets_count: 0,
    clean_sheets: 0,

    failed_to_score_count: 0,
    failed_to_score: 0,

    xg_total: 0,
    xga_total: 0,
    xgd_total: 0,

    xg: 0,
    xga: 0,
    xgd: 0,

    points: 0,
    points_per_game: 0
  };
}

function finalizeStats(stats) {
  const games = stats.games;

  stats.avg_goals_for = average(stats.goals_for, games);
  stats.avg_goals_against = average(stats.goals_against, games);
  stats.avg_total_goals = average(stats.total_goals, games);

  stats.over_05 = percent(stats.over_05_count, games);
  stats.over_15 = percent(stats.over_15_count, games);
  stats.over_25 = percent(stats.over_25_count, games);
  stats.over_35 = percent(stats.over_35_count, games);

  stats.under_05 = round(100 - stats.over_05, 1);
  stats.under_15 = round(100 - stats.over_15, 1);
  stats.under_25 = round(100 - stats.over_25, 1);
  stats.under_35 = round(100 - stats.over_35, 1);

  stats.btts = percent(stats.btts_count, games);

  stats.zero_zero = percent(
    stats.zero_zero_count,
    games
  );

  stats.clean_sheets = percent(
    stats.clean_sheets_count,
    games
  );

  stats.failed_to_score = percent(
    stats.failed_to_score_count,
    games
  );

  stats.xg = average(stats.xg_total, games);
  stats.xga = average(stats.xga_total, games);
  stats.xgd = average(stats.xgd_total, games);

  stats.points_per_game = average(
    stats.points,
    games
  );

  return stats;
}

/* ============================================================
   EXTRAÇÃO DOS CAMPOS DAS PARTIDAS
============================================================ */

function getHomeTeam(match) {
  return canonicalTeamName(
    getNestedValue(match, [
      "homeTeam.name",
      "home.name",
      "home_team.name",
      "homeTeam",
      "home",
      "home_name",
      "homeTeamName"
    ])
  );
}

function getAwayTeam(match) {
  return canonicalTeamName(
    getNestedValue(match, [
      "awayTeam.name",
      "away.name",
      "away_team.name",
      "awayTeam",
      "away",
      "away_name",
      "awayTeamName"
    ])
  );
}

function getHomeGoals(match) {
  return toNumber(
    getNestedValue(match, [
      "homeScore",
      "home_score",
      "score.home",
      "score.homeScore.current",
      "result.home",
      "goals.home"
    ])
  );
}

function getAwayGoals(match) {
  return toNumber(
    getNestedValue(match, [
      "awayScore",
      "away_score",
      "score.away",
      "score.awayScore.current",
      "result.away",
      "goals.away"
    ])
  );
}

function getRound(match) {
  return toNumber(
    getNestedValue(match, [
      "round",
      "roundNumber",
      "leagueRound",
      "roundInfo.round"
    ]),
    0
  );
}

function getDate(match) {
  const timestamp = getNestedValue(match, [
    "date",
    "matchDate",
    "startTime",
    "time",
    "timestamp"
  ]);

  if (!timestamp) {
    return null;
  }

  if (
    typeof timestamp === "number" &&
    timestamp > 1000000000
  ) {
    return new Date(timestamp * 1000).toISOString();
  }

  return timestamp;
}

/* ============================================================
   EXTRAÇÃO DE xG
============================================================ */

function getHomeXG(match) {
  return toNumber(
    getNestedValue(match, [
      "homeXg",
      "home_xg",
      "xg.home",
      "stats.home.xg",
      "statistics.home.xg",
      "expectedGoals.home",
      "homeExpectedGoals"
    ])
  );
}

function getAwayXG(match) {
  return toNumber(
    getNestedValue(match, [
      "awayXg",
      "away_xg",
      "xg.away",
      "stats.away.xg",
      "statistics.away.xg",
      "expectedGoals.away",
      "awayExpectedGoals"
    ])
  );
}

/* ============================================================
   ATUALIZAÇÃO DE ESTATÍSTICAS
============================================================ */

function updateStats(
  stats,
  goalsFor,
  goalsAgainst,
  xgFor = 0,
  xgAgainst = 0
) {
  stats.games++;

  stats.goals_for += goalsFor;
  stats.goals_against += goalsAgainst;

  const totalGoals =
    goalsFor + goalsAgainst;

  stats.total_goals += totalGoals;

  if (goalsFor > goalsAgainst) {
    stats.wins++;
    stats.points += 3;
  } else if (goalsFor === goalsAgainst) {
    stats.draws++;
    stats.points += 1;
  } else {
    stats.losses++;
  }

  if (totalGoals >= 1) {
    stats.over_05_count++;
  }

  if (totalGoals >= 2) {
    stats.over_15_count++;
  }

  if (totalGoals >= 3) {
    stats.over_25_count++;
  }

  if (totalGoals >= 4) {
    stats.over_35_count++;
  }

  if (
    goalsFor > 0 &&
    goalsAgainst > 0
  ) {
    stats.btts_count++;
  }

  if (
    goalsFor === 0 &&
    goalsAgainst === 0
  ) {
    stats.zero_zero_count++;
  }

  if (goalsAgainst === 0) {
    stats.clean_sheets_count++;
  }

  if (goalsFor === 0) {
    stats.failed_to_score_count++;
  }

  stats.xg_total += xgFor;
  stats.xga_total += xgAgainst;
  stats.xgd_total += xgFor - xgAgainst;
}

/* ============================================================
   ESTRUTURA DAS EQUIPES
============================================================ */

function createTeam(name) {
  return {
    team: name,

    geral: createEmptyStats(),
    mandante: createEmptyStats(),
    visitante: createEmptyStats()
  };
}

/* ============================================================
   HISTÓRICO DAS PARTIDAS
============================================================ */

function createHistoryRecord(
  match,
  team,
  isHome,
  opponent,
  goalsFor,
  goalsAgainst,
  xg,
  xga
) {
  return {
    rodada: getRound(match),
    data: getDate(match),

    local: isHome
      ? "Casa"
      : "Fora",

    adversario: opponent,

    gols_pro: goalsFor,
    gols_contra: goalsAgainst,

    placar: `${goalsFor} x ${goalsAgainst}`,

    xg: round(xg, 2),
    xga: round(xga, 2),
    xgd: round(xg - xga, 2)
  };
}

/* ============================================================
   MÉDIA MÓVEL
============================================================ */

function calculateRollingAverage(
  records,
  field,
  window = 5
) {
  return records.map((record, index) => {
    const start = Math.max(
      0,
      index - window + 1
    );

    const slice = records.slice(
      start,
      index + 1
    );

    const total = slice.reduce(
      (sum, item) =>
        sum + toNumber(item[field]),
      0
    );

    return round(
      total / slice.length,
      2
    );
  });
}

function enrichHistory(records) {
  const sorted = [...records].sort(
    (a, b) => {
      const roundA = toNumber(a.rodada);
      const roundB = toNumber(b.rodada);

      return roundA - roundB;
    }
  );

  const rollingXG = calculateRollingAverage(
    sorted,
    "xg",
    5
  );

  const rollingXGA = calculateRollingAverage(
    sorted,
    "xga",
    5
  );

  const rollingXGD = calculateRollingAverage(
    sorted,
    "xgd",
    5
  );

  return sorted.map((record, index) => ({
    ...record,

    xg_movel_5: rollingXG[index],
    xga_movel_5: rollingXGA[index],
    xgd_movel_5: rollingXGD[index]
  }));
}

/* ============================================================
   CÁLCULO DA TENDÊNCIA RECENTE
============================================================ */

function calculateTrend(records) {
  if (!records || records.length === 0) {
    return {
      ataque: {
        status: "Sem dados",
        variacao: 0
      },

      defesa: {
        status: "Sem dados",
        variacao: 0
      },

      equilibrio: {
        status: "Sem dados",
        variacao: 0
      }
    };
  }

  const lastFive = records.slice(-5);

  const avgSeasonXG =
    records.reduce(
      (sum, item) =>
        sum + toNumber(item.xg),
      0
    ) / records.length;

  const avgRecentXG =
    lastFive.reduce(
      (sum, item) =>
        sum + toNumber(item.xg),
      0
    ) / lastFive.length;

  const avgSeasonXGA =
    records.reduce(
      (sum, item) =>
        sum + toNumber(item.xga),
      0
    ) / records.length;

  const avgRecentXGA =
    lastFive.reduce(
      (sum, item) =>
        sum + toNumber(item.xga),
      0
    ) / lastFive.length;

  const avgSeasonXGD =
    records.reduce(
      (sum, item) =>
        sum + toNumber(item.xgd),
      0
    ) / records.length;

  const avgRecentXGD =
    lastFive.reduce(
      (sum, item) =>
        sum + toNumber(item.xgd),
      0
    ) / lastFive.length;

  function variation(recent, season) {
    if (season === 0) return 0;

    return round(
      ((recent - season) / Math.abs(season)) *
        100,
      1
    );
  }

  function trendStatus(
    variationValue,
    inverse = false
  ) {
    const value = inverse
      ? -variationValue
      : variationValue;

    if (value > 5) {
      return "Melhorando";
    }

    if (value < -5) {
      return "Piorando";
    }

    return "Estável";
  }

  const attackVariation = variation(
    avgRecentXG,
    avgSeasonXG
  );

  const defenseRawVariation = variation(
    avgRecentXGA,
    avgSeasonXGA
  );

  const balanceVariation = variation(
    avgRecentXGD,
    avgSeasonXGD
  );

  return {
    ataque: {
      status: trendStatus(attackVariation),
      variacao: attackVariation,

      temporada: round(avgSeasonXG, 2),
      ultimos_5: round(avgRecentXG, 2)
    },

    defesa: {
      status: trendStatus(
        defenseRawVariation,
        true
      ),

      variacao: round(
        -defenseRawVariation,
        1
      ),

      temporada: round(avgSeasonXGA, 2),
      ultimos_5: round(avgRecentXGA, 2)
    },

    equilibrio: {
      status: trendStatus(balanceVariation),
      variacao: balanceVariation,

      temporada: round(avgSeasonXGD, 2),
      ultimos_5: round(avgRecentXGD, 2)
    }
  };
}

/* ============================================================
   LEITURA DOS DADOS
============================================================ */

console.log("");
console.log("========================================");
console.log(" PROCESSAMENTO BRASILEIRÃO STATS");
console.log("========================================");
console.log("");

console.log(
  "Lendo partidas:",
  MATCHES_FILE
);

let matchesData = readJSON(
  MATCHES_FILE,
  []
);

let matches = [];

/*
  Aceita diferentes formatos possíveis do
  matches.json.
*/

if (Array.isArray(matchesData)) {
  matches = matchesData;
} else if (Array.isArray(matchesData.matches)) {
  matches = matchesData.matches;
} else if (
  Array.isArray(matchesData.data)
) {
  matches = matchesData.data;
} else if (
  Array.isArray(matchesData.events)
) {
  matches = matchesData.events;
}

console.log(
  `Partidas encontradas: ${matches.length}`
);

if (matches.length === 0) {
  console.error("");
  console.error(
    "ERRO: Nenhuma partida encontrada."
  );

  console.error(
    "Verifique o arquivo data/processed/matches.json"
  );

  process.exit(1);
}

/* ============================================================
   PROCESSAMENTO DAS EQUIPES
============================================================ */

const teams = {};
const history = {};

let processedMatches = 0;

for (const match of matches) {
  const homeTeam = getHomeTeam(match);
  const awayTeam = getAwayTeam(match);

  if (!homeTeam || !awayTeam) {
    continue;
  }

  const homeGoals = getHomeGoals(match);
  const awayGoals = getAwayGoals(match);

  /*
    Ignora partidas sem placar válido.
  */

  if (
    homeGoals === null ||
    awayGoals === null ||
    homeGoals === undefined ||
    awayGoals === undefined
  ) {
    continue;
  }

  if (!teams[homeTeam]) {
    teams[homeTeam] = createTeam(homeTeam);
  }

  if (!teams[awayTeam]) {
    teams[awayTeam] = createTeam(awayTeam);
  }

  if (!history[homeTeam]) {
    history[homeTeam] = [];
  }

  if (!history[awayTeam]) {
    history[awayTeam] = [];
  }

  const homeXG = getHomeXG(match);
  const awayXG = getAwayXG(match);

  /*
    HOME TEAM
  */

  updateStats(
    teams[homeTeam].geral,
    homeGoals,
    awayGoals,
    homeXG,
    awayXG
  );

  updateStats(
    teams[homeTeam].mandante,
    homeGoals,
    awayGoals,
    homeXG,
    awayXG
  );

  /*
    AWAY TEAM
  */

  updateStats(
    teams[awayTeam].geral,
    awayGoals,
    homeGoals,
    awayXG,
    homeXG
  );

  updateStats(
    teams[awayTeam].visitante,
    awayGoals,
    homeGoals,
    awayXG,
    homeXG
  );

  /*
    HISTÓRICO HOME
  */

  history[homeTeam].push(
    createHistoryRecord(
      match,
      homeTeam,
      true,
      awayTeam,
      homeGoals,
      awayGoals,
      homeXG,
      awayXG
    )
  );

  /*
    HISTÓRICO AWAY
  */

  history[awayTeam].push(
    createHistoryRecord(
      match,
      awayTeam,
      false,
      homeTeam,
      awayGoals,
      homeGoals,
      awayXG,
      homeXG
    )
  );

  processedMatches++;
}

console.log(
  `Partidas processadas: ${processedMatches}`
);

console.log(
  `Equipes encontradas: ${Object.keys(teams).length}`
);

/* ============================================================
   FINALIZAÇÃO DAS ESTATÍSTICAS
============================================================ */

Object.values(teams).forEach((team) => {
  finalizeStats(team.geral);
  finalizeStats(team.mandante);
  finalizeStats(team.visitante);
});

/* ============================================================
   PROCESSAMENTO DO HISTÓRICO
============================================================ */

const historyOutput = {};

Object.entries(history).forEach(
  ([teamName, records]) => {
    const enrichedRecords =
      enrichHistory(records);

    historyOutput[teamName] = {
      team: teamName,

      partidas: enrichedRecords,

      tendencia: calculateTrend(
        enrichedRecords
      ),

      resumo: {
        jogos: enrichedRecords.length,

        xg_medio: average(
          enrichedRecords.reduce(
            (sum, item) =>
              sum + toNumber(item.xg),
            0
          ),
          enrichedRecords.length
        ),

        xga_medio: average(
          enrichedRecords.reduce(
            (sum, item) =>
              sum + toNumber(item.xga),
            0
          ),
          enrichedRecords.length
        ),

        xgd_medio: average(
          enrichedRecords.reduce(
            (sum, item) =>
              sum + toNumber(item.xgd),
            0
          ),
          enrichedRecords.length
        )
      }
    };
  }
);

/* ============================================================
   ESTATÍSTICAS DA LIGA
============================================================ */

const leagueStats = createEmptyStats();

Object.values(teams).forEach((team) => {
  /*
    Não somamos diretamente os stats de cada equipe,
    pois isso duplicaria os jogos da liga.

    A liga é calculada novamente a partir das partidas.
  */
});

for (const match of matches) {
  const homeTeam = getHomeTeam(match);
  const awayTeam = getAwayTeam(match);

  if (!homeTeam || !awayTeam) {
    continue;
  }

  const homeGoals = getHomeGoals(match);
  const awayGoals = getAwayGoals(match);

  const homeXG = getHomeXG(match);
  const awayXG = getAwayXG(match);

  leagueStats.games++;

  const totalGoals =
    homeGoals + awayGoals;

  leagueStats.total_goals += totalGoals;
  leagueStats.goals_for += totalGoals;

  if (totalGoals >= 1) {
    leagueStats.over_05_count++;
  }

  if (totalGoals >= 2) {
    leagueStats.over_15_count++;
  }

  if (totalGoals >= 3) {
    leagueStats.over_25_count++;
  }

  if (totalGoals >= 4) {
    leagueStats.over_35_count++;
  }

  if (
    homeGoals > 0 &&
    awayGoals > 0
  ) {
    leagueStats.btts_count++;
  }

  if (
    homeGoals === 0 &&
    awayGoals === 0
  ) {
    leagueStats.zero_zero_count++;
  }

  leagueStats.xg_total +=
    homeXG + awayXG;

  leagueStats.xga_total +=
    homeXG + awayXG;
}

finalizeStats(leagueStats);

/* ============================================================
   RANKINGS
============================================================ */

const teamList = Object.values(teams);

function ranking(metric, context = "geral") {
  return [...teamList]
    .map((team) => ({
      team: team.team,
      value: toNumber(
        team[context][metric]
      )
    }))
    .sort((a, b) => b.value - a.value);
}

const rankings = {
  over_05: ranking("over_05"),
  over_15: ranking("over_15"),
  over_25: ranking("over_25"),
  over_35: ranking("over_35"),

  btts: ranking("btts"),

  zero_zero: ranking("zero_zero"),

  avg_total_goals: ranking(
    "avg_total_goals"
  ),

  avg_goals_for: ranking(
    "avg_goals_for"
  ),

  avg_goals_against: ranking(
    "avg_goals_against"
  ),

  xg: ranking("xg"),

  xga: ranking("xga"),

  xgd: ranking("xgd")
};

/* ============================================================
   OBJETO FINAL DO APP
============================================================ */

const output = {
  season: SEASON,

  updated_at: new Date().toISOString(),

  league: {
    name: "Campeonato Brasileiro Série A",
    season: SEASON,

    teams: Object.keys(teams).length,

    stats: leagueStats
  },

  teams,

  rankings
};

/* ============================================================
   GRAVAÇÃO DOS ARQUIVOS
============================================================ */

ensureDir(APP_DIR);

writeJSON(
  OUTPUT_STATS,
  output
);

writeJSON(
  OUTPUT_HISTORY,
  {
    season: SEASON,

    updated_at: new Date().toISOString(),

    teams: historyOutput
  }
);

console.log("");
console.log("========================================");
console.log(" PROCESSAMENTO CONCLUÍDO");
console.log("========================================");
console.log("");

console.log(
  `Arquivo principal: ${OUTPUT_STATS}`
);

console.log(
  `Arquivo histórico: ${OUTPUT_HISTORY}`
);

console.log("");

console.log(
  "Resumo da liga:"
);

console.log(
  `Jogos: ${leagueStats.games}`
);

console.log(
  `Média de gols: ${leagueStats.avg_total_goals}`
);

console.log(
  `Over 2.5: ${leagueStats.over_25}%`
);

console.log(
  `BTTS: ${leagueStats.btts}%`
);

console.log(
  `0 x 0: ${leagueStats.zero_zero}%`
);

console.log("");