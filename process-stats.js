import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


// ============================================================
// CONFIGURAÇÃO
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");

const RAW_DIR = path.join(DATA_DIR, "raw");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");
const APP_DIR = path.join(DATA_DIR, "app");

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

const OUTPUT_FILE = path.join(
    APP_DIR,
    "brasileirao_stats_2026.json"
);


// ============================================================
// CRIAR DIRETÓRIO DE SAÍDA
// ============================================================

if (!fs.existsSync(APP_DIR)) {

    fs.mkdirSync(APP_DIR, {
        recursive: true
    });

}


// ============================================================
// UTILITÁRIOS
// ============================================================

function readJSON(file) {

    if (!fs.existsSync(file)) {

        throw new Error(
            `Arquivo não encontrado: ${file}`
        );

    }

    return JSON.parse(
        fs.readFileSync(file, "utf8")
    );

}


function saveJSON(file, data) {

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    console.log(`💾 Arquivo salvo: ${file}`);

}


function round(value, decimals = 2) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(value)
    ) {
        return null;
    }

    const factor = 10 ** decimals;

    return Math.round(value * factor) / factor;

}


function percentage(part, total) {

    if (!total || total === 0) {
        return 0;
    }

    return round(
        (part / total) * 100,
        1
    );

}


function safeDivide(a, b) {

    if (
        !b ||
        b === 0 ||
        a === null ||
        a === undefined
    ) {
        return null;
    }

    return round(a / b, 3);

}


// ============================================================
// LOCALIZAR STATLIST DO FOTMOB
// ============================================================

function getStatList(data) {

    if (!data) return [];

    // Estrutura mais comum encontrada nos arquivos
    if (Array.isArray(data.TopLists)) {

        for (const item of data.TopLists) {

            if (Array.isArray(item.StatList)) {
                return item.StatList;
            }

        }

    }

    // Caso exista estrutura alternativa
    if (Array.isArray(data.StatList)) {
        return data.StatList;
    }

    return [];

}


// ============================================================
// NORMALIZAR DADOS DE XG
// ============================================================

function normalizeXGStats(xgData, xgaData, xgdData) {

    const xgList = getStatList(xgData);
    const xgaList = getStatList(xgaData);
    const xgdList = getStatList(xgdData);

    const teams = new Map();


    // --------------------------------------------------------
    // xG
    // --------------------------------------------------------

    for (const item of xgList) {

        const teamId = Number(item.TeamId);

        if (!teamId) continue;

        teams.set(teamId, {

            id: teamId,

            name:
                item.ParticipantName,

            xg:
                Number(item.StatValue),

            goals_from_xg_file:
                Number(item.SubStatValue),

            matches_from_xg_file:
                Number(item.MatchesPlayed),

            xg_rank:
                Number(item.Rank),

            xga: null,
            goals_against_from_xga_file: null,
            xga_rank: null,

            xgd: null,
            goal_difference_from_xgd_file: null,
            xgd_rank: null

        });

    }


    // --------------------------------------------------------
    // xGA
    // --------------------------------------------------------

    for (const item of xgaList) {

        const teamId = Number(item.TeamId);

        if (!teamId) continue;

        if (!teams.has(teamId)) {

            teams.set(teamId, {
                id: teamId,
                name: item.ParticipantName
            });

        }

        const team = teams.get(teamId);

        team.xga =
            Number(item.StatValue);

        team.goals_against_from_xga_file =
            Number(item.SubStatValue);

        team.xga_rank =
            Number(item.Rank);

    }


    // --------------------------------------------------------
    // xG Difference
    // --------------------------------------------------------

    for (const item of xgdList) {

        const teamId = Number(item.TeamId);

        if (!teamId) continue;

        if (!teams.has(teamId)) {

            teams.set(teamId, {
                id: teamId,
                name: item.ParticipantName
            });

        }

        const team = teams.get(teamId);

        team.xgd =
            Number(item.StatValue);

        team.goal_difference_from_xgd_file =
            Number(item.SubStatValue);

        team.xgd_rank =
            Number(item.Rank);

    }


    return teams;

}


// ============================================================
// ESTRUTURA BASE DE ESTATÍSTICAS
// ============================================================

function createEmptyStats() {

    return {

        matches: 0,

        wins: 0,
        draws: 0,
        losses: 0,

        goals_for: 0,
        goals_against: 0,

        total_goals: 0,


        // ----------------------------------------------------
        // OVER / UNDER
        // ----------------------------------------------------

        over_05_count: 0,
        over_15_count: 0,
        over_25_count: 0,
        over_35_count: 0,


        // ----------------------------------------------------
        // BTTS
        // ----------------------------------------------------

        btts_count: 0,


        // ----------------------------------------------------
        // 0x0
        // ----------------------------------------------------

        draw_00_count: 0,


        // ----------------------------------------------------
        // CLEAN SHEET
        // ----------------------------------------------------

        clean_sheet_count: 0,


        // ----------------------------------------------------
        // FAILED TO SCORE
        // ----------------------------------------------------

        failed_to_score_count: 0,


        // ----------------------------------------------------
        // RESULTADOS
        // ----------------------------------------------------

        scored_first_half_placeholder: 0

    };

}


// ============================================================
// ATUALIZAR ESTATÍSTICAS DE UMA EQUIPE
// ============================================================

function updateTeamStats(
    stats,
    goalsFor,
    goalsAgainst
) {

    stats.matches++;

    stats.goals_for += goalsFor;
    stats.goals_against += goalsAgainst;

    const totalGoals =
        goalsFor + goalsAgainst;

    stats.total_goals += totalGoals;


    // --------------------------------------------------------
    // RESULTADO
    // --------------------------------------------------------

    if (goalsFor > goalsAgainst) {

        stats.wins++;

    } else if (goalsFor === goalsAgainst) {

        stats.draws++;

    } else {

        stats.losses++;

    }


    // --------------------------------------------------------
    // OVER
    // --------------------------------------------------------

    if (totalGoals > 0) {
        stats.over_05_count++;
    }

    if (totalGoals > 1) {
        stats.over_15_count++;
    }

    if (totalGoals > 2) {
        stats.over_25_count++;
    }

    if (totalGoals > 3) {
        stats.over_35_count++;
    }


    // --------------------------------------------------------
    // AMBAS MARCAM
    // --------------------------------------------------------

    if (
        goalsFor > 0 &&
        goalsAgainst > 0
    ) {
        stats.btts_count++;
    }


    // --------------------------------------------------------
    // 0x0
    // --------------------------------------------------------

    if (
        goalsFor === 0 &&
        goalsAgainst === 0
    ) {
        stats.draw_00_count++;
    }


    // --------------------------------------------------------
    // CLEAN SHEET
    // --------------------------------------------------------

    if (goalsAgainst === 0) {
        stats.clean_sheet_count++;
    }


    // --------------------------------------------------------
    // FAILED TO SCORE
    // --------------------------------------------------------

    if (goalsFor === 0) {
        stats.failed_to_score_count++;
    }

}


// ============================================================
// FINALIZAR ESTATÍSTICAS
// ============================================================

function finalizeStats(stats) {

    const matches =
        stats.matches;

    return {

        // ----------------------------------------------------
        // PARTIDAS
        // ----------------------------------------------------

        matches,

        wins:
            stats.wins,

        draws:
            stats.draws,

        losses:
            stats.losses,


        // ----------------------------------------------------
        // GOLS
        // ----------------------------------------------------

        goals_for:
            stats.goals_for,

        goals_against:
            stats.goals_against,

        goal_difference:
            stats.goals_for -
            stats.goals_against,

        total_goals:
            stats.total_goals,

        goals_for_per_match:
            safeDivide(
                stats.goals_for,
                matches
            ),

        goals_against_per_match:
            safeDivide(
                stats.goals_against,
                matches
            ),

        avg_total_goals:
            safeDivide(
                stats.total_goals,
                matches
            ),


        // ----------------------------------------------------
        // APROVEITAMENTO
        // ----------------------------------------------------

        win_percentage:
            percentage(
                stats.wins,
                matches
            ),

        draw_percentage:
            percentage(
                stats.draws,
                matches
            ),

        loss_percentage:
            percentage(
                stats.losses,
                matches
            ),


        // ----------------------------------------------------
        // OVER
        // ----------------------------------------------------

        over_05: {
            count:
                stats.over_05_count,

            percentage:
                percentage(
                    stats.over_05_count,
                    matches
                )
        },

        over_15: {
            count:
                stats.over_15_count,

            percentage:
                percentage(
                    stats.over_15_count,
                    matches
                )
        },

        over_25: {
            count:
                stats.over_25_count,

            percentage:
                percentage(
                    stats.over_25_count,
                    matches
                )
        },

        over_35: {
            count:
                stats.over_35_count,

            percentage:
                percentage(
                    stats.over_35_count,
                    matches
                )
        },


        // ----------------------------------------------------
        // BTTS
        // ----------------------------------------------------

        btts: {
            count:
                stats.btts_count,

            percentage:
                percentage(
                    stats.btts_count,
                    matches
                )
        },


        // ----------------------------------------------------
        // 0x0
        // ----------------------------------------------------

        draw_00: {
            count:
                stats.draw_00_count,

            percentage:
                percentage(
                    stats.draw_00_count,
                    matches
                )
        },


        // ----------------------------------------------------
        // CLEAN SHEET
        // ----------------------------------------------------

        clean_sheet: {
            count:
                stats.clean_sheet_count,

            percentage:
                percentage(
                    stats.clean_sheet_count,
                    matches
                )
        },


        // ----------------------------------------------------
        // FAILED TO SCORE
        // ----------------------------------------------------

        failed_to_score: {
            count:
                stats.failed_to_score_count,

            percentage:
                percentage(
                    stats.failed_to_score_count,
                    matches
                )
        }

    };

}


// ============================================================
// CRIAR EQUIPE
// ============================================================

function createTeam(id, name) {

    return {

        id,
        name,

        overall:
            createEmptyStats(),

        home:
            createEmptyStats(),

        away:
            createEmptyStats()

    };

}


// ============================================================
// PROCESSAR PARTIDAS
// ============================================================

function processMatches(matches) {

    const teams = new Map();

    let validMatches = 0;


    for (const match of matches) {

        // Apenas jogos encerrados
        if (match.finished !== true) {
            continue;
        }


        const homeGoals =
            match.score?.home;

        const awayGoals =
            match.score?.away;


        // Garantir placar válido
        if (
            homeGoals === null ||
            homeGoals === undefined ||
            awayGoals === null ||
            awayGoals === undefined
        ) {
            continue;
        }


        const homeId =
            Number(match.home?.id);

        const awayId =
            Number(match.away?.id);


        if (!homeId || !awayId) {
            continue;
        }


        // ----------------------------------------------------
        // CRIAR EQUIPES
        // ----------------------------------------------------

        if (!teams.has(homeId)) {

            teams.set(
                homeId,
                createTeam(
                    homeId,
                    match.home.name
                )
            );

        }


        if (!teams.has(awayId)) {

            teams.set(
                awayId,
                createTeam(
                    awayId,
                    match.away.name
                )
            );

        }


        const homeTeam =
            teams.get(homeId);

        const awayTeam =
            teams.get(awayId);


        // ----------------------------------------------------
        // GERAL
        // ----------------------------------------------------

        updateTeamStats(
            homeTeam.overall,
            homeGoals,
            awayGoals
        );

        updateTeamStats(
            awayTeam.overall,
            awayGoals,
            homeGoals
        );


        // ----------------------------------------------------
        // CASA
        // ----------------------------------------------------

        updateTeamStats(
            homeTeam.home,
            homeGoals,
            awayGoals
        );


        // ----------------------------------------------------
        // FORA
        // ----------------------------------------------------

        updateTeamStats(
            awayTeam.away,
            awayGoals,
            homeGoals
        );


        validMatches++;

    }


    console.log(
        `⚽ Jogos encerrados processados: ${validMatches}`
    );

    console.log(
        `🏆 Equipes encontradas: ${teams.size}`
    );


    return {
        teams,
        validMatches
    };

}


// ============================================================
// ADICIONAR XG ÀS EQUIPES
// ============================================================

function mergeXGData(
    matchTeams,
    xgTeams
) {

    const finalTeams = [];


    for (
        const [teamId, team]
        of matchTeams.entries()
    ) {

        const xgData =
            xgTeams.get(teamId);


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


        // ----------------------------------------------------
        // DADOS AVANÇADOS
        // ----------------------------------------------------

        const xg =
            xgData?.xg ?? null;

        const xga =
            xgData?.xga ?? null;

        let xgd =
            xgData?.xgd ?? null;


        // Caso o arquivo de xGD falhe,
        // calcular a partir de xG - xGA

        if (
            xgd === null &&
            xg !== null &&
            xga !== null
        ) {

            xgd =
                round(xg - xga, 2);

        }


        // ----------------------------------------------------
        // ADICIONAR XG AO GERAL
        // ----------------------------------------------------

        overall.xg = {

            value:
                xg,

            per_match:
                xg !== null
                    ? safeDivide(
                        xg,
                        overall.matches
                    )
                    : null,

            rank:
                xgData?.xg_rank ?? null

        };


        overall.xga = {

            value:
                xga,

            per_match:
                xga !== null
                    ? safeDivide(
                        xga,
                        overall.matches
                    )
                    : null,

            rank:
                xgData?.xga_rank ?? null

        };


        overall.xgd = {

            value:
                xgd,

            per_match:
                xgd !== null
                    ? safeDivide(
                        xgd,
                        overall.matches
                    )
                    : null,

            rank:
                xgData?.xgd_rank ?? null

        };


        // ----------------------------------------------------
        // PERFORMANCE VS EXPECTATIVA
        // ----------------------------------------------------

        overall.performance_vs_xg = {

            goals_vs_xg:

                xg !== null
                    ? round(
                        overall.goals_for - xg,
                        2
                    )
                    : null,


            goals_against_vs_xga:

                xga !== null
                    ? round(
                        overall.goals_against - xga,
                        2
                    )
                    : null,


            goal_difference_vs_xgd:

                xgd !== null
                    ? round(
                        overall.goal_difference - xgd,
                        2
                    )
                    : null,


            offensive_efficiency:

                xg !== null
                    ? safeDivide(
                        overall.goals_for,
                        xg
                    )
                    : null,


            defensive_efficiency:

                xga !== null
                    ? safeDivide(
                        overall.goals_against,
                        xga
                    )
                    : null

        };


        // ----------------------------------------------------
        // XG DE CASA/FORA AINDA NÃO DISPONÍVEL
        // ----------------------------------------------------

        home.xg = null;
        home.xga = null;
        home.xgd = null;

        away.xg = null;
        away.xga = null;
        away.xgd = null;


        // ----------------------------------------------------
        // ESTRUTURA FINAL DA EQUIPE
        // ----------------------------------------------------

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

    return teams.sort((a, b) => {

        // Pontos
        const pointsA =
            a.overall.wins * 3 +
            a.overall.draws;

        const pointsB =
            b.overall.wins * 3 +
            b.overall.draws;


        if (pointsB !== pointsA) {
            return pointsB - pointsA;
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

    });

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


    for (const match of finishedMatches) {

        const home =
            match.score.home;

        const away =
            match.score.away;

        const total =
            home + away;

        totalGoals += total;


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
            readJSON(MATCHES_FILE);

        const xgData =
            readJSON(XG_FILE);

        const xgaData =
            readJSON(XGA_FILE);

        const xgdData =
            readJSON(XGD_FILE);


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
            processMatches(matches);


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
            sortTeams(teams);


        // ----------------------------------------------------
        // ADICIONAR POSIÇÃO
        // ----------------------------------------------------

        teams =
            teams.map(
                (team, index) => ({

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
        // BANCO FINAL
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
        // SALVAR
        // ----------------------------------------------------

        saveJSON(
            OUTPUT_FILE,
            output
        );


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
            teams.slice(0, 10).map(team => ({

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
            "\nArquivo gerado:"
        );

        console.log(
            OUTPUT_FILE
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