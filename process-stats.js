import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


// ============================================================
// CONFIGURAÇÃO DE CAMINHOS
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(
    __dirname,
    "data"
);

const RAW_DIR = path.join(
    DATA_DIR,
    "raw"
);

const PROCESSED_DIR = path.join(
    DATA_DIR,
    "processed"
);

const APP_DIR = path.join(
    DATA_DIR,
    "app"
);


// ============================================================
// ARQUIVOS DE ENTRADA
// ============================================================

const MATCHES_FILE = path.join(
    PROCESSED_DIR,
    "matches.json"
);

const XG_FILE = path.join(
    RAW_DIR,
    "xg.json"
);

const XGA_FILE = path.join(
    RAW_DIR,
    "xga.json"
);

const XGD_FILE = path.join(
    RAW_DIR,
    "xg_difference.json"
);


// ============================================================
// NOVOS ARQUIVOS - HISTÓRICO TEMPORAL
// ============================================================

const MATCH_DETAILS_DIR = path.join(
    RAW_DIR,
    "matches"
);

const HISTORY_OUTPUT_FILE = path.join(
    APP_DIR,
    "brasileirao_historico_2026.json"
);


// ============================================================
// ARQUIVO PRINCIPAL DO APP
// ============================================================

const OUTPUT_FILE = path.join(
    APP_DIR,
    "brasileirao_stats_2026.json"
);


// ============================================================
// GARANTIR DIRETÓRIOS
// ============================================================

[
    DATA_DIR,
    RAW_DIR,
    PROCESSED_DIR,
    APP_DIR,
    MATCH_DETAILS_DIR
].forEach(dir => {

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(
            dir,
            {
                recursive: true
            }
        );

    }

});


// ============================================================
// UTILITÁRIOS
// ============================================================

function readJSON(filename) {

    if (!fs.existsSync(filename)) {

        throw new Error(
            `Arquivo não encontrado: ${filename}`
        );

    }

    return JSON.parse(
        fs.readFileSync(
            filename,
            "utf8"
        )
    );

}


function saveJSON(filename, data) {

    fs.writeFileSync(
        filename,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );

    console.log(
        `💾 Arquivo salvo: ${filename}`
    );

}


function round(value, decimals = 2) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(value)
    ) {

        return null;

    }

    const factor =
        10 ** decimals;

    return (
        Math.round(
            value * factor
        ) / factor
    );

}


function percentage(part, total) {

    if (
        !total ||
        total === 0
    ) {

        return {

            value: 0,

            percentage: 0

        };

    }

    return {

        value:
            part,

        percentage:
            round(
                (part / total) * 100,
                1
            )

    };

}


function safeDivide(a, b) {

    if (
        a === null ||
        a === undefined ||
        b === null ||
        b === undefined ||
        b === 0
    ) {

        return null;

    }

    return round(
        a / b,
        3
    );

}


// ============================================================
// NORMALIZAR ESTATÍSTICAS XG
// ============================================================

function normalizeXGStats(
    xgData,
    xgaData,
    xgdData
) {

    const teams =
        new Map();


    function processStat(
        data,
        statKey
    ) {

        if (!data) {
            return;
        }


        const stats =
            data?.stats ||
            data?.statsData ||
            data?.teams ||
            [];


        const rows =
            Array.isArray(stats)
                ? stats
                : Object.values(stats);


        for (const item of rows) {

            const teamId =
                item.teamId ??
                item.id ??
                item.team?.id;

            const teamName =
                item.teamName ??
                item.name ??
                item.team?.name;


            if (
                teamId === undefined ||
                teamId === null
            ) {

                continue;

            }


            const value =

                item.value ??
                item.statValue ??
                item.stats?.value ??
                item.total ??
                item[statKey];


            if (!teams.has(teamId)) {

                teams.set(
                    teamId,
                    {
                        id:
                            teamId,

                        name:
                            teamName,

                        xg:
                            null,

                        xga:
                            null,

                        xgd:
                            null
                    }
                );

            }


            const team =
                teams.get(teamId);


            if (
                teamName &&
                !team.name
            ) {

                team.name =
                    teamName;

            }


            if (
                value !== undefined &&
                value !== null
            ) {

                team[statKey] =
                    Number(value);

            }

        }

    }


    processStat(
        xgData,
        "xg"
    );

    processStat(
        xgaData,
        "xga"
    );

    processStat(
        xgdData,
        "xgd"
    );


    return teams;

}


// ============================================================
// PROCESSAR PARTIDAS
// ============================================================

function processMatches(matches) {

    const teams =
        new Map();

    let validMatches = 0;


    function getTeam(
        id,
        name
    ) {

        if (!teams.has(id)) {

            teams.set(
                id,
                {

                    id,

                    name,

                    overall:
                        createStats(),

                    home:
                        createStats(),

                    away:
                        createStats()

                }
            );

        }

        return teams.get(id);

    }


    for (const match of matches) {

        if (
            !match.finished ||
            match.cancelled
        ) {

            continue;

        }


        const homeGoals =
            match.score?.home;

        const awayGoals =
            match.score?.away;


        if (
            homeGoals === null ||
            homeGoals === undefined ||
            awayGoals === null ||
            awayGoals === undefined
        ) {

            continue;

        }


        const homeTeam =
            getTeam(
                match.home.id,
                match.home.name
            );

        const awayTeam =
            getTeam(
                match.away.id,
                match.away.name
            );


        updateStats(
            homeTeam.overall,
            homeGoals,
            awayGoals
        );

        updateStats(
            awayTeam.overall,
            awayGoals,
            homeGoals
        );


        updateStats(
            homeTeam.home,
            homeGoals,
            awayGoals
        );

        updateStats(
            awayTeam.away,
            awayGoals,
            homeGoals
        );


        validMatches++;

    }


    return {

        teams,

        validMatches

    };

}


// ============================================================
// CRIAR ESTRUTURA ESTATÍSTICA
// ============================================================

function createStats() {

    return {

        matches:
            0,

        wins:
            0,

        draws:
            0,

        losses:
            0,

        goals_for:
            0,

        goals_against:
            0,

        goal_difference:
            0,

        over_05:
            0,

        over_15:
            0,

        over_25:
            0,

        over_35:
            0,

        btts:
            0,

        draw_00:
            0

    };

}


// ============================================================
// ATUALIZAR ESTATÍSTICAS
// ============================================================

function updateStats(
    stats,
    goalsFor,
    goalsAgainst
) {

    stats.matches++;

    stats.goals_for +=
        goalsFor;

    stats.goals_against +=
        goalsAgainst;

    stats.goal_difference =
        stats.goals_for -
        stats.goals_against;


    const totalGoals =
        goalsFor +
        goalsAgainst;


    if (goalsFor > goalsAgainst) {

        stats.wins++;

    } else if (goalsFor === goalsAgainst) {

        stats.draws++;

    } else {

        stats.losses++;

    }


    if (totalGoals > 0) {
        stats.over_05++;
    }

    if (totalGoals > 1) {
        stats.over_15++;
    }

    if (totalGoals > 2) {
        stats.over_25++;
    }

    if (totalGoals > 3) {
        stats.over_35++;
    }


    if (
        goalsFor > 0 &&
        goalsAgainst > 0
    ) {

        stats.btts++;

    }


    if (
        goalsFor === 0 &&
        goalsAgainst === 0
    ) {

        stats.draw_00++;

    }

}


// ============================================================
// FINALIZAR ESTATÍSTICAS
// ============================================================

function finalizeStats(stats) {

    return {

        matches:
            stats.matches,

        wins:
            stats.wins,

        draws:
            stats.draws,

        losses:
            stats.losses,

        goals_for:
            stats.goals_for,

        goals_against:
            stats.goals_against,

        goal_difference:
            stats.goal_difference,


        avg_goals_for:
            safeDivide(
                stats.goals_for,
                stats.matches
            ),

        avg_goals_against:
            safeDivide(
                stats.goals_against,
                stats.matches
            ),


        over_05:
            percentage(
                stats.over_05,
                stats.matches
            ),

        over_15:
            percentage(
                stats.over_15,
                stats.matches
            ),

        over_25:
            percentage(
                stats.over_25,
                stats.matches
            ),

        over_35:
            percentage(
                stats.over_35,
                stats.matches
            ),

        btts:
            percentage(
                stats.btts,
                stats.matches
            ),

        draw_00:
            percentage(
                stats.draw_00,
                stats.matches
            )

    };

}


// ============================================================
// CONSOLIDAR XG
// ============================================================

function mergeXGData(
    teamsMap,
    xgTeams
) {

    const finalTeams = [];


    for (
        const team of teamsMap.values()
    ) {

        const xgInfo =
            xgTeams.get(team.id) ||
            {};


        const overall =
            finalizeStats(
                team.overall
            );

        const home =
            finalizeStats(
                team.home
            );

        const away =
            finalizeStats(
                team.away
            );


        const xg =
            xgInfo.xg ??
            null;

        const xga =
            xgInfo.xga ??
            null;

        const xgd =
            xgInfo.xgd ??
            null;


        overall.xg = {

            value:
                xg,

            per_match:
                safeDivide(
                    xg,
                    overall.matches
                )

        };


        overall.xga = {

            value:
                xga,

            per_match:
                safeDivide(
                    xga,
                    overall.matches
                )

        };


        overall.xgd = {

            value:
                xgd,

            per_match:
                safeDivide(
                    xgd,
                    overall.matches
                )

        };


        overall.goal_xg_difference =

            xg !== null
                ? round(
                    overall.goals_for - xg,
                    2
                )
                : null;


        overall.goal_xga_difference =

            xga !== null
                ? round(
                    overall.goals_against - xga,
                    2
                )
                : null;


        overall.offensive_efficiency =

            xg !== null
                ? safeDivide(
                    overall.goals_for,
                    xg
                )
                : null;


        overall.defensive_efficiency =

            xga !== null
                ? safeDivide(
                    overall.goals_against,
                    xga
                )
                : null;


        // ----------------------------------------------------
        // xG CASA/FORA
        // Ainda não disponível no dataset agregado.
        // Será futuramente calculado a partir do histórico.
        // ----------------------------------------------------

        home.xg = null;
        home.xga = null;
        home.xgd = null;

        away.xg = null;
        away.xga = null;
        away.xgd = null;


        finalTeams.push({

            id:
                team.id,

            name:
                team.name,

            overall,

            home,

            away

        });

    }


    return finalTeams;

}


// ============================================================
// ORDENAR EQUIPES
// ============================================================

function sortTeams(teams) {

    return teams.sort(
        (a, b) => {

            const pointsA =
                a.overall.wins * 3 +
                a.overall.draws;

            const pointsB =
                b.overall.wins * 3 +
                b.overall.draws;


            if (
                pointsB !== pointsA
            ) {

                return (
                    pointsB -
                    pointsA
                );

            }


            if (
                b.overall.goal_difference !==
                a.overall.goal_difference
            ) {

                return (
                    b.overall.goal_difference -
                    a.overall.goal_difference
                );

            }


            return (
                b.overall.goals_for -
                a.overall.goals_for
            );

        }
    );

}


// ============================================================
// CALCULAR RESUMO DA LIGA
// ============================================================

function calculateLeagueSummary(
    matches,
    teams
) {

    const finishedMatches =
        matches.filter(
            match =>
                match.finished === true &&
                match.score?.home !== null &&
                match.score?.home !== undefined &&
                match.score?.away !== null &&
                match.score?.away !== undefined
        );


    let totalGoals = 0;

    let over05 = 0;
    let over15 = 0;
    let over25 = 0;
    let over35 = 0;

    let btts = 0;
    let draw00 = 0;


    for (
        const match of finishedMatches
    ) {

        const home =
            match.score.home;

        const away =
            match.score.away;

        const total =
            home +
            away;


        totalGoals +=
            total;


        if (total > 0) over05++;
        if (total > 1) over15++;
        if (total > 2) over25++;
        if (total > 3) over35++;


        if (
            home > 0 &&
            away > 0
        ) {

            btts++;

        }


        if (
            home === 0 &&
            away === 0
        ) {

            draw00++;

        }

    }


    return {

        matches:
            finishedMatches.length,

        teams:
            teams.length,

        total_goals:
            totalGoals,

        avg_goals_per_match:
            safeDivide(
                totalGoals,
                finishedMatches.length
            ),

        over_05:
            percentage(
                over05,
                finishedMatches.length
            ),

        over_15:
            percentage(
                over15,
                finishedMatches.length
            ),

        over_25:
            percentage(
                over25,
                finishedMatches.length
            ),

        over_35:
            percentage(
                over35,
                finishedMatches.length
            ),

        btts:
            percentage(
                btts,
                finishedMatches.length
            ),

        draw_00:
            percentage(
                draw00,
                finishedMatches.length
            )

    };

}


// ============================================================
// ============================================================
// FASE 7 - HISTÓRICO TEMPORAL
// ============================================================
// ============================================================


// ============================================================
// MÉDIA DE VALORES
// ============================================================

function average(values) {

    const validValues =
        values.filter(
            value =>
                value !== null &&
                value !== undefined &&
                !Number.isNaN(value)
        );


    if (
        validValues.length === 0
    ) {

        return null;

    }


    const total =
        validValues.reduce(
            (sum, value) =>
                sum + value,
            0
        );


    return round(
        total / validValues.length,
        3
    );

}


// ============================================================
// CARREGAR DETALHES INDIVIDUAIS DAS PARTIDAS
// ============================================================

function loadMatchDetails() {

    console.log(
        "\n📂 Carregando histórico individual das partidas..."
    );


    if (
        !fs.existsSync(
            MATCH_DETAILS_DIR
        )
    ) {

        console.log(
            "⚠ Diretório de detalhes das partidas não encontrado."
        );

        return [];

    }


    const files =
        fs.readdirSync(
            MATCH_DETAILS_DIR
        )
        .filter(
            file =>
                file.endsWith(".json")
        );


    const matches = [];


    for (
        const file of files
    ) {

        try {

            const fullPath =
                path.join(
                    MATCH_DETAILS_DIR,
                    file
                );


            const match =
                readJSON(
                    fullPath
                );


            if (
                !match ||
                !match.finished
            ) {

                continue;

            }


            if (
                !match.home ||
                !match.away
            ) {

                continue;

            }


            matches.push(
                match
            );

        } catch (error) {

            console.log(
                `⚠ Erro ao ler ${file}: ${error.message}`
            );

        }

    }


    console.log(
        `✓ Partidas históricas carregadas: ${matches.length}`
    );


    return matches;

}


// ============================================================
// CRIAR ESTRUTURA DE EQUIPE HISTÓRICA
// ============================================================

function createHistoryTeam(
    id,
    name
) {

    return {

        id,

        name,

        matches: []

    };

}


// ============================================================
// PROCESSAR PARTIDAS PARA PERSPECTIVA DE CADA EQUIPE
// ============================================================

function processHistoricalMatches(
    matchDetails
) {

    console.log(
        "\n📈 Processando séries temporais..."
    );


    const teams =
        new Map();


    for (
        const match of matchDetails
    ) {

        const home =
            match.home;

        const away =
            match.away;


        if (
            !home?.id ||
            !away?.id
        ) {

            continue;

        }


        // ----------------------------------------------------
        // Criar mandante
        // ----------------------------------------------------

        if (
            !teams.has(home.id)
        ) {

            teams.set(
                home.id,
                createHistoryTeam(
                    home.id,
                    home.name
                )
            );

        }


        // ----------------------------------------------------
        // Criar visitante
        // ----------------------------------------------------

        if (
            !teams.has(away.id)
        ) {

            teams.set(
                away.id,
                createHistoryTeam(
                    away.id,
                    away.name
                )
            );

        }


        const homeTeam =
            teams.get(
                home.id
            );

        const awayTeam =
            teams.get(
                away.id
            );


        // ----------------------------------------------------
        // PERSPECTIVA DO MANDANTE
        // ----------------------------------------------------

        homeTeam.matches.push({

            match_id:
                match.match_id,

            round:
                match.round,

            date:
                match.date,


            opponent: {

                id:
                    away.id,

                name:
                    away.name

            },


            location:
                "home",


            goals_for:
                home.goals,

            goals_against:
                away.goals,


            xg:
                home.xg,

            xga:
                away.xg,


            xgd:

                home.xg !== null &&
                home.xg !== undefined &&
                away.xg !== null &&
                away.xg !== undefined

                    ? round(
                        home.xg -
                        away.xg,
                        3
                    )

                    : null

        });


        // ----------------------------------------------------
        // PERSPECTIVA DO VISITANTE
        // ----------------------------------------------------

        awayTeam.matches.push({

            match_id:
                match.match_id,

            round:
                match.round,

            date:
                match.date,


            opponent: {

                id:
                    home.id,

                name:
                    home.name

            },


            location:
                "away",


            goals_for:
                away.goals,

            goals_against:
                home.goals,


            xg:
                away.xg,

            xga:
                home.xg,


            xgd:

                away.xg !== null &&
                away.xg !== undefined &&
                home.xg !== null &&
                home.xg !== undefined

                    ? round(
                        away.xg -
                        home.xg,
                        3
                    )

                    : null

        });

    }


    return teams;

}


// ============================================================
// ORDENAR E CALCULAR MÉTRICAS TEMPORAIS
// ============================================================

function calculateHistoricalMetrics(
    team
) {

    // --------------------------------------------------------
    // ORDENAR POR RODADA E DATA
    // --------------------------------------------------------

    team.matches.sort(
        (a, b) => {

            const roundA =
                Number(a.round) || 0;

            const roundB =
                Number(b.round) || 0;


            if (
                roundA !== roundB
            ) {

                return (
                    roundA -
                    roundB
                );

            }


            return (
                new Date(a.date) -
                new Date(b.date)
            );

        }
    );


    let cumulativeXG = 0;
    let cumulativeXGA = 0;
    let cumulativeXGD = 0;

    let validXGCount = 0;
    let validXGACount = 0;


    team.matches.forEach(
        (
            match,
            index
        ) => {

            // ------------------------------------------------
            // ACUMULADOS
            // ------------------------------------------------

            if (
                match.xg !== null &&
                match.xg !== undefined
            ) {

                cumulativeXG +=
                    match.xg;

                validXGCount++;

            }


            if (
                match.xga !== null &&
                match.xga !== undefined
            ) {

                cumulativeXGA +=
                    match.xga;

                validXGACount++;

            }


            if (
                match.xgd !== null &&
                match.xgd !== undefined
            ) {

                cumulativeXGD +=
                    match.xgd;

            }


            match.cumulative = {

                xg:
                    round(
                        cumulativeXG,
                        3
                    ),

                xga:
                    round(
                        cumulativeXGA,
                        3
                    ),

                xgd:
                    round(
                        cumulativeXGD,
                        3
                    ),


                xg_per_match:

                    validXGCount > 0

                        ? round(
                            cumulativeXG /
                            validXGCount,
                            3
                        )

                        : null,


                xga_per_match:

                    validXGACount > 0

                        ? round(
                            cumulativeXGA /
                            validXGACount,
                            3
                        )

                        : null

            };


            // ------------------------------------------------
            // MÉDIA MÓVEL DOS ÚLTIMOS 5 JOGOS
            // ------------------------------------------------

            const windowSize = 5;


            const start =
                Math.max(
                    0,
                    index -
                    windowSize +
                    1
                );


            const recentMatches =
                team.matches.slice(
                    start,
                    index + 1
                );


            match.rolling_5 = {

                matches:
                    recentMatches.length,


                xg:
                    average(
                        recentMatches.map(
                            item =>
                                item.xg
                        )
                    ),


                xga:
                    average(
                        recentMatches.map(
                            item =>
                                item.xga
                        )
                    ),


                xgd:
                    average(
                        recentMatches.map(
                            item =>
                                item.xgd
                        )
                    ),


                goals_for:
                    average(
                        recentMatches.map(
                            item =>
                                item.goals_for
                        )
                    ),


                goals_against:
                    average(
                        recentMatches.map(
                            item =>
                                item.goals_against
                        )
                    )

            };

        }
    );


    return team;

}


// ============================================================
// GERAR RESUMO DA TEMPORADA
// ============================================================

function generateTeamHistorySummary(
    team
) {

    const matches =
        team.matches;


    const totalMatches =
        matches.length;


    const xgValues =
        matches
            .map(
                match =>
                    match.xg
            )
            .filter(
                value =>
                    value !== null &&
                    value !== undefined
            );


    const xgaValues =
        matches
            .map(
                match =>
                    match.xga
            )
            .filter(
                value =>
                    value !== null &&
                    value !== undefined
            );


    const xgdValues =
        matches
            .map(
                match =>
                    match.xgd
            )
            .filter(
                value =>
                    value !== null &&
                    value !== undefined
            );


    const last5 =
        matches.slice(-5);


    return {

        matches:
            totalMatches,


        season: {

            xg:
                average(
                    xgValues
                ),

            xga:
                average(
                    xgaValues
                ),

            xgd:
                average(
                    xgdValues
                ),

            goals_for:
                average(
                    matches.map(
                        match =>
                            match.goals_for
                    )
                ),

            goals_against:
                average(
                    matches.map(
                        match =>
                            match.goals_against
                    )
                )

        },


        last_5: {

            matches:
                last5.length,


            xg:
                average(
                    last5.map(
                        match =>
                            match.xg
                    )
                ),


            xga:
                average(
                    last5.map(
                        match =>
                            match.xga
                    )
                ),


            xgd:
                average(
                    last5.map(
                        match =>
                            match.xgd
                    )
                ),


            goals_for:
                average(
                    last5.map(
                        match =>
                            match.goals_for
                    )
                ),


            goals_against:
                average(
                    last5.map(
                        match =>
                            match.goals_against
                    )
                )

        }

    };

}


// ============================================================
// CALCULAR TENDÊNCIA
// ============================================================

function calculateTrend(
    seasonValue,
    recentValue,
    inverse = false
) {

    if (
        seasonValue === null ||
        seasonValue === undefined ||
        recentValue === null ||
        recentValue === undefined
    ) {

        return {

            direction:
                "neutral",

            percentage:
                null

        };

    }


    let percentageChange =
        null;


    if (
        seasonValue !== 0
    ) {

        percentageChange =
            round(
                (
                    (
                        recentValue -
                        seasonValue
                    ) /
                    Math.abs(
                        seasonValue
                    )
                ) * 100,
                1
            );

    }


    let direction =
        "neutral";


    if (
        percentageChange !== null
    ) {

        if (
            percentageChange > 5
        ) {

            direction =
                inverse
                    ? "down"
                    : "up";

        }

        else if (
            percentageChange < -5
        ) {

            direction =
                inverse
                    ? "up"
                    : "down";

        }

    }


    return {

        direction,

        percentage:
            percentageChange

    };

}


// ============================================================
// GERAR ARQUIVO FINAL DE HISTÓRICO
// ============================================================

function generateHistoryData() {

    console.log(
        "\n========================================"
    );

    console.log(
        "📈 FASE 7 - HISTÓRICO TEMPORAL"
    );

    console.log(
        "========================================"
    );


    const matchDetails =
        loadMatchDetails();


    if (
        matchDetails.length === 0
    ) {

        console.log(
            "⚠ Nenhuma partida histórica disponível."
        );

        return null;

    }


    const historyTeamsMap =
        processHistoricalMatches(
            matchDetails
        );


    const teams = [];


    for (
        const team of historyTeamsMap.values()
    ) {

        calculateHistoricalMetrics(
            team
        );


        const summary =
            generateTeamHistorySummary(
                team
            );


        const offensiveTrend =
            calculateTrend(
                summary.season.xg,
                summary.last_5.xg
            );


        // Para xGA:
        // menor valor recente representa melhora defensiva.

        const defensiveTrend =
            calculateTrend(
                summary.season.xga,
                summary.last_5.xga,
                true
            );


        const xgdTrend =
            calculateTrend(
                summary.season.xgd,
                summary.last_5.xgd
            );


        teams.push({

            id:
                team.id,

            name:
                team.name,


            summary,


            trends: {

                offensive:
                    offensiveTrend,

                defensive:
                    defensiveTrend,

                balance:
                    xgdTrend

            },


            matches:
                team.matches

        });

    }


    // --------------------------------------------------------
    // ORDENAR ALFABETICAMENTE
    // --------------------------------------------------------

    teams.sort(
        (a, b) =>
            a.name.localeCompare(
                b.name,
                "pt-BR"
            )
    );


    // --------------------------------------------------------
    // ESTRUTURA FINAL
    // --------------------------------------------------------

    const output = {

        metadata: {

            competition:
                "Campeonato Brasileiro Série A",

            season:
                2026,

            source:
                "FotMob",

            generated_at:
                new Date().toISOString(),

            total_teams:
                teams.length,

            total_matches:
                matchDetails.length

        },


        teams

    };


    // --------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------

    saveJSON(
        HISTORY_OUTPUT_FILE,
        output
    );


    console.log(
        `✓ Histórico gerado para ${teams.length} equipes`
    );

    console.log(
        `✓ Arquivo: ${HISTORY_OUTPUT_FILE}`
    );


    return output;

}


// ============================================================
// EXECUÇÃO PRINCIPAL
// ============================================================

function main() {

    try {

        console.log(
            "\n========================================"
        );

        console.log(
            "⚽ FASE 2 - MOTOR ESTATÍSTICO"
        );

        console.log(
            "========================================\n"
        );


        // ----------------------------------------------------
        // CARREGAR ARQUIVOS
        // ----------------------------------------------------

        console.log(
            "📂 Carregando arquivos..."
        );


        const matches =
            readJSON(
                MATCHES_FILE
            );


        const xgData =
            readJSON(
                XG_FILE
            );


        const xgaData =
            readJSON(
                XGA_FILE
            );


        const xgdData =
            readJSON(
                XGD_FILE
            );


        // ----------------------------------------------------
        // NORMALIZAR XG
        // ----------------------------------------------------

        console.log(
            "\n📊 Processando dados de xG..."
        );


        const xgTeams =
            normalizeXGStats(
                xgData,
                xgaData,
                xgdData
            );


        console.log(
            `✓ Equipes com dados avançados: ${xgTeams.size}`
        );


        // ----------------------------------------------------
        // PROCESSAR PARTIDAS
        // ----------------------------------------------------

        console.log(
            "\n⚽ Processando partidas..."
        );


        const result =
            processMatches(
                matches
            );


        // ----------------------------------------------------
        // CONSOLIDAR
        // ----------------------------------------------------

        console.log(
            "\n🔗 Consolidando dados..."
        );


        let teams =
            mergeXGData(
                result.teams,
                xgTeams
            );


        teams =
            sortTeams(
                teams
            );


        // ----------------------------------------------------
        // ADICIONAR POSIÇÃO
        // ----------------------------------------------------

        teams =
            teams.map(
                (
                    team,
                    index
                ) => ({

                    position:
                        index + 1,

                    ...team

                })
            );


        // ----------------------------------------------------
        // RESUMO DA LIGA
        // ----------------------------------------------------

        const leagueSummary =
            calculateLeagueSummary(
                matches,
                teams
            );


        // ----------------------------------------------------
        // BANCO FINAL PRINCIPAL
        // ----------------------------------------------------

        const output = {

            metadata: {

                competition:
                    "Campeonato Brasileiro Série A",

                season:
                    2026,

                source:
                    "FotMob",

                generated_at:
                    new Date().toISOString(),

                total_teams:
                    teams.length,

                processed_matches:
                    result.validMatches

            },


            league_summary:
                leagueSummary,


            teams

        };


        // ----------------------------------------------------
        // SALVAR BANCO PRINCIPAL
        // ----------------------------------------------------

        saveJSON(
            OUTPUT_FILE,
            output
        );


        // ----------------------------------------------------
        // FASE 7 - GERAR HISTÓRICO TEMPORAL
        // ----------------------------------------------------

        generateHistoryData();


        // ----------------------------------------------------
        // RESUMO TERMINAL
        // ----------------------------------------------------

        console.log(
            "\n========================================"
        );

        console.log(
            "✅ PROCESSAMENTO CONCLUÍDO"
        );

        console.log(
            "========================================\n"
        );


        console.log(
            "RESUMO DA LIGA:"
        );


        console.table(
            leagueSummary
        );


        console.log(
            "\nPRIMEIRAS EQUIPES:"
        );


        console.table(

            teams
                .slice(
                    0,
                    10
                )
                .map(team => ({

                    Pos:
                        team.position,

                    Time:
                        team.name,

                    Jogos:
                        team.overall.matches,

                    GF:
                        team.overall.goals_for,

                    GA:
                        team.overall.goals_against,

                    SG:
                        team.overall.goal_difference,

                    "Over 2.5":
                        team.overall.over_25.percentage,

                    BTTS:
                        team.overall.btts.percentage,

                    xG:
                        team.overall.xg.value,

                    xGA:
                        team.overall.xga.value,

                    xGD:
                        team.overall.xgd.value

                }))

        );


        console.log(
            "\nArquivos gerados:"
        );

        console.log(
            OUTPUT_FILE
        );

        console.log(
            HISTORY_OUTPUT_FILE
        );


    } catch (error) {

        console.error(
            "\n❌ ERRO NO PROCESSAMENTO:"
        );

        console.error(
            error.message
        );

        console.error(
            error.stack
        );

    }

}


main();