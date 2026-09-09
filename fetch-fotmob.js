import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


// ============================================================
// CONFIGURAÇÃO
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEAGUE_ID = 268;
const SEASON = 2026;

const BASE_URL = "https://www.fotmob.com/api/data";

const DATA_DIR = path.join(__dirname, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");
const MATCHES_DIR = path.join(RAW_DIR, "matches");

const REQUEST_DELAY = 100;


// ============================================================
// CRIAR DIRETÓRIOS
// ============================================================

[
    DATA_DIR,
    RAW_DIR,
    PROCESSED_DIR,
    MATCHES_DIR
].forEach(dir => {

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, {
            recursive: true
        });

    }

});


// ============================================================
// UTILITÁRIOS
// ============================================================

function sleep(ms) {

    return new Promise(resolve => {

        setTimeout(resolve, ms);

    });

}


async function fetchJSON(url) {

    console.log(`🌐 ${url}`);

    const response = await fetch(url, {

        headers: {

            "User-Agent":
                "Mozilla/5.0",

            "Accept":
                "application/json, text/plain, */*",

            "Referer":
                "https://www.fotmob.com/"

        }

    });

    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status} - ${response.statusText}`
        );

    }

    return await response.json();

}


function saveJSON(filename, data) {

    fs.writeFileSync(
        filename,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    console.log(
        `💾 Salvo: ${filename}`
    );

}


function readJSON(filename) {

    if (!fs.existsSync(filename)) {

        return null;

    }

    return JSON.parse(
        fs.readFileSync(filename, "utf8")
    );

}


function parseScore(scoreStr) {

    if (!scoreStr) {

        return {
            home: null,
            away: null
        };

    }

    const match =
        scoreStr.match(/(\d+)\s*-\s*(\d+)/);

    if (!match) {

        return {
            home: null,
            away: null
        };

    }

    return {

        home:
            Number(match[1]),

        away:
            Number(match[2])

    };

}


// ============================================================
// 1. BUSCAR DADOS DA LIGA
// ============================================================

async function getLeagueData() {

    console.log("\n======================================");
    console.log("⚽ FOTMOB - BRASILEIRÃO");
    console.log("======================================\n");

    const url =
        `${BASE_URL}/leagues?id=${LEAGUE_ID}&ccode3=BRA`;

    const data =
        await fetchJSON(url);

    saveJSON(
        path.join(
            RAW_DIR,
            "league.json"
        ),
        data
    );

    return data;

}


// ============================================================
// 2. EXTRAIR INFORMAÇÕES DA TEMPORADA
// ============================================================

function getSeasonInfo(data) {

    const details =
        data.details || {};

    return {

        league_id:
            details.id,

        league_name:
            details.name,

        country:
            details.country,

        season:
            details.selectedSeason,

        latest_season:
            details.latestSeason,

        provider:
            details.dataProvider

    };

}


// ============================================================
// 3. EXTRAIR PARTIDAS
// ============================================================

function extractMatches(data) {

    const matches =
        data?.fixtures?.allMatches || [];

    console.log(
        `\n📅 Total de partidas no calendário: ${matches.length}`
    );

    const normalized = [];

    for (const match of matches) {

        const status =
            match.status || {};

        const score =
            parseScore(
                status.scoreStr
            );

        normalized.push({

            match_id:
                Number(match.id),

            round:
                Number(match.roundName),

            date:
                status.utcTime,

            finished:
                status.finished === true,

            started:
                status.started === true,

            cancelled:
                status.cancelled === true,

            score: {

                home:
                    score.home,

                away:
                    score.away

            },

            home: {

                id:
                    Number(match.home?.id),

                name:
                    match.home?.name

            },

            away: {

                id:
                    Number(match.away?.id),

                name:
                    match.away?.name

            }

        });

    }

    return normalized;

}


// ============================================================
// 4. LOCALIZAR URL DAS ESTATÍSTICAS
// ============================================================

function getStatsURL(data, statName) {

    const statsTeams =
        data?.stats?.teams || [];

    const stat =
        statsTeams.find(
            item => item.name === statName
        );

    if (!stat) {

        console.log(
            `⚠ Estatística não encontrada: ${statName}`
        );

        return null;

    }

    return stat.fetchAllUrl;

}


// ============================================================
// 5. BAIXAR ESTATÍSTICAS GERAIS DE XG
// ============================================================

async function getXGStats(data) {

    console.log("\n======================================");
    console.log("📊 BAIXANDO EXPECTED GOALS");
    console.log("======================================");

    const xgURL =
        getStatsURL(
            data,
            "expected_goals_team"
        );

    const xgaURL =
        getStatsURL(
            data,
            "expected_goals_conceded_team"
        );

    const xgDiffURL =
        getStatsURL(
            data,
            "_xg_diff_team"
        );


    const result = {

        xg:
            xgURL
                ? await fetchJSON(xgURL)
                : null,

        xga:
            xgaURL
                ? await fetchJSON(xgaURL)
                : null,

        xg_difference:
            xgDiffURL
                ? await fetchJSON(xgDiffURL)
                : null

    };


    saveJSON(
        path.join(
            RAW_DIR,
            "xg.json"
        ),
        result.xg
    );


    saveJSON(
        path.join(
            RAW_DIR,
            "xga.json"
        ),
        result.xga
    );


    saveJSON(
        path.join(
            RAW_DIR,
            "xg_difference.json"
        ),
        result.xg_difference
    );


    return result;

}


// ============================================================
// 6. INSPECIONAR ESTRUTURA DE XG
// ============================================================

function inspectXG(xgData) {

    console.log("\n======================================");
    console.log("🔎 ESTRUTURA XG");
    console.log("======================================");

    if (!xgData) {

        console.log(
            "⚠ Dados de xG indisponíveis"
        );

        return;

    }

    console.log(
        "Chaves:",
        Object.keys(xgData)
    );

}


// ============================================================
// 7. BUSCAR DETALHES DE UMA PARTIDA
// ============================================================

async function fetchMatchDetails(matchId) {

    const url =
        `${BASE_URL}/matchDetails?matchId=${matchId}`;

    return await fetchJSON(url);

}


// ============================================================
// 8. EXTRAIR ESTATÍSTICAS DETALHADAS DA PARTIDA
// ============================================================

function parseStatValue(raw) {
    if (raw === null || raw === undefined || raw === "") return { value: 0, percent: null };
    if (typeof raw === "number") return { value: raw, percent: null };
    
    // Formato com porcentagem: "413 (85%)"
    const match = String(raw).match(/([\d.,]+)\s*\(([\d.,]+)%\)/);
    if (match) {
        const count = parseFloat(match[1].replace(",", "."));
        const pct = parseFloat(match[2].replace(",", "."));
        return { value: count, percent: pct };
    }
    
    const num = parseFloat(String(raw).replace(",", "."));
    return { value: isNaN(num) ? 0 : num, percent: null };
}

function extractMatchStats(matchData) {
    try {
        const periods = matchData?.content?.stats?.Periods;
        const allPeriod = periods?.All?.stats || [];
        
        const rawMap = {};
        for (const group of allPeriod) {
            for (const stat of (group.stats || [])) {
                if (stat.key && stat.stats && stat.stats.length >= 2) {
                    rawMap[stat.key] = {
                        home: stat.stats[0],
                        away: stat.stats[1]
                    };
                }
            }
        }
        
        const parseFor = (side) => {
            const get = (key) => rawMap[key]?.[side];
            const val = (key) => parseStatValue(get(key)).value;
            
            const passesParsed = parseStatValue(get("accurate_passes"));
            const crossesParsed = parseStatValue(get("accurate_crosses"));
            const longBallsParsed = parseStatValue(get("long_balls_accurate"));
            const groundDuelsParsed = parseStatValue(get("ground_duels_won"));
            const aerialDuelsParsed = parseStatValue(get("aerials_won"));
            const dribblesParsed = parseStatValue(get("dribbles_succeeded"));
            
            return {
                possession: val("BallPossesion"),
                xg: val("expected_goals"),
                xg_open_play: val("expected_goals_open_play"),
                xg_set_play: val("expected_goals_set_play"),
                xg_non_penalty: val("expected_goals_non_penalty"),
                xgot: val("expected_goals_on_target"),
                
                shots_total: val("total_shots"),
                shots_on_target: val("ShotsOnTarget"),
                shots_off_target: val("ShotsOffTarget"),
                shots_blocked: val("blocked_shots"),
                shots_woodwork: val("shots_woodwork"),
                shots_inside_box: val("shots_inside_box"),
                shots_outside_box: val("shots_outside_box"),
                
                passes_accurate: passesParsed.value,
                passes_accuracy_pct: passesParsed.percent,
                passes_own_half: val("own_half_passes"),
                passes_opp_half: val("opposition_half_passes"),
                long_balls_accurate: longBallsParsed.value,
                long_balls_accuracy_pct: longBallsParsed.percent,
                crosses_accurate: crossesParsed.value,
                crosses_accuracy_pct: crossesParsed.percent,
                touches_opp_box: val("touches_opp_box"),
                offsides: val("Offsides"),
                big_chances: val("big_chance"),
                big_chances_missed: val("big_chance_missed_title"),
                
                tackles: val("matchstats.headers.tackles"),
                interceptions: val("interceptions"),
                blocks: val("shot_blocks"),
                clearances: val("clearances"),
                keeper_saves: val("keeper_saves"),
                
                duels_won: val("duel_won"),
                ground_duels_won: groundDuelsParsed.value,
                ground_duels_pct: groundDuelsParsed.percent,
                aerial_duels_won: aerialDuelsParsed.value,
                aerial_duels_pct: aerialDuelsParsed.percent,
                dribbles_won: dribblesParsed.value,
                dribbles_pct: dribblesParsed.percent,
                
                corners: val("corners"),
                yellow_cards: val("yellow_cards"),
                red_cards: val("red_cards"),
                fouls: val("fouls")
            };
        };

        return {
            home: parseFor("home"),
            away: parseFor("away")
        };
    } catch (error) {
        console.log(`⚠ Erro ao extrair estatísticas detalhadas: ${error.message}`);
        return null;
    }
}


// ============================================================
// 9. NORMALIZAR DETALHES DA PARTIDA
// ============================================================

function normalizeMatchDetails(
    match,
    matchData
) {
    const detailedStats = extractMatchStats(matchData);

    return {
        match_id:
            match.match_id,

        round:
            match.round,

        date:
            match.date,

        finished:
            match.finished,

        home: {
            id:
                match.home.id,

            name:
                match.home.name,

            goals:
                match.score.home,

            xg:
                detailedStats?.home?.xg ?? null,

            stats:
                detailedStats?.home ?? null
        },

        away: {
            id:
                match.away.id,

            name:
                match.away.name,

            goals:
                match.score.away,

            xg:
                detailedStats?.away?.xg ?? null,

            stats:
                detailedStats?.away ?? null
        }
    };
}


// ============================================================
// 10. BAIXAR DETALHES DAS PARTIDAS ENCERRADAS
// ============================================================

async function getFinishedMatchesDetails(matches) {

    console.log("\n======================================");
    console.log("📈 COLETANDO XG INDIVIDUAL DAS PARTIDAS");
    console.log("======================================");

    const finishedMatches =
        matches.filter(
            match =>
                match.finished &&
                !match.cancelled
        );

    console.log(
        `Partidas encerradas: ${finishedMatches.length}`
    );

    let cached = 0;
    let downloaded = 0;
    let errors = 0;


    for (
        let i = 0;
        i < finishedMatches.length;
        i++
    ) {

        const match =
            finishedMatches[i];

        const filename =
            path.join(
                MATCHES_DIR,
                `${match.match_id}.json`
            );


        console.log(
            `\n[${i + 1}/${finishedMatches.length}] ` +
            `${match.home.name} x ${match.away.name}`
        );


        // ----------------------------------------------------
        // CACHE
        // ----------------------------------------------------

        if (fs.existsSync(filename)) {
            const existing = readJSON(filename);
            if (existing && existing.home && existing.home.stats) {
                console.log("✓ Cache completo encontrado");
                cached++;
                continue;
            }
        }


        // ----------------------------------------------------
        // DOWNLOAD
        // ----------------------------------------------------

        try {

            const matchData =
                await fetchMatchDetails(
                    match.match_id
                );

            const normalized =
                normalizeMatchDetails(
                    match,
                    matchData
                );

            saveJSON(
                filename,
                normalized
            );

            downloaded++;

        } catch (error) {

            console.error(
                `❌ Erro na partida ${match.match_id}:`,
                error.message
            );

            errors++;

        }


        // Pequeno intervalo entre requisições

        if (
            i <
            finishedMatches.length - 1
        ) {

            await sleep(
                REQUEST_DELAY
            );

        }

    }


    console.log("\n======================================");
    console.log("📊 RESUMO DA COLETA DE PARTIDAS");
    console.log("======================================");

    console.log(
        `Cache: ${cached}`
    );

    console.log(
        `Novas partidas: ${downloaded}`
    );

    console.log(
        `Erros: ${errors}`
    );


    return {

        total:
            finishedMatches.length,

        cached,

        downloaded,

        errors

    };

}


// ============================================================
// 11. GERAR RESUMO DAS PARTIDAS
// ============================================================

function generateMatchSummary(matches) {

    const finished =
        matches.filter(
            match => match.finished
        );

    const scheduled =
        matches.filter(
            match =>
                !match.finished &&
                !match.cancelled
        );

    console.log("\n======================================");
    console.log("📈 RESUMO");
    console.log("======================================");

    console.log(
        `Total de jogos: ${matches.length}`
    );

    console.log(
        `Encerrados: ${finished.length}`
    );

    console.log(
        `Agendados: ${scheduled.length}`
    );


    return {

        total:
            matches.length,

        finished:
            finished.length,

        scheduled:
            scheduled.length

    };

}


// ============================================================
// 12. EXECUÇÃO PRINCIPAL
// ============================================================

async function main() {

    try {

        // ----------------------------------
        // Liga
        // ----------------------------------

        const leagueData =
            await getLeagueData();


        // ----------------------------------
        // Temporada
        // ----------------------------------

        const seasonInfo =
            getSeasonInfo(
                leagueData
            );


        console.log("\n🏆 TEMPORADA");

        console.table(
            seasonInfo
        );


        // ----------------------------------
        // Partidas
        // ----------------------------------

        const matches =
            extractMatches(
                leagueData
            );


        const matchSummary =
            generateMatchSummary(
                matches
            );


        saveJSON(
            path.join(
                PROCESSED_DIR,
                "matches.json"
            ),
            matches
        );


        // ----------------------------------
        // Estatísticas gerais de xG
        // ----------------------------------

        const xgStats =
            await getXGStats(
                leagueData
            );


        inspectXG(
            xgStats.xg
        );


        // ----------------------------------
        // NOVO:
        // Detalhes individuais das partidas
        // ----------------------------------

        const matchesDetailsSummary =
            await getFinishedMatchesDetails(
                matches
            );


        // ----------------------------------
        // Arquivo final
        // ----------------------------------

        const finalData = {

            metadata: {

                source:
                    "FotMob",

                league_id:
                    LEAGUE_ID,

                season:
                    SEASON,

                fetched_at:
                    new Date().toISOString()

            },


            competition:
                seasonInfo,


            summary:
                matchSummary,


            matches,


            match_details:
                matchesDetailsSummary,


            stats: {

                xg:
                    xgStats.xg,

                xga:
                    xgStats.xga,

                xg_difference:
                    xgStats.xg_difference

            }

        };


        saveJSON(
            path.join(
                PROCESSED_DIR,
                "fotmob_brasileirao_2026.json"
            ),
            finalData
        );


        console.log("\n======================================");
        console.log("✅ COLETA CONCLUÍDA");
        console.log("======================================");


        console.log(
            "\nArquivo final:"
        );


        console.log(
            path.join(
                PROCESSED_DIR,
                "fotmob_brasileirao_2026.json"
            )
        );


    } catch (error) {

        console.error("\n❌ ERRO:");

        console.error(
            error.message
        );

        console.error(
            error.stack
        );

    }

}


main();