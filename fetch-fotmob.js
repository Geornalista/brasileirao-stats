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

[DATA_DIR, RAW_DIR, PROCESSED_DIR].forEach(dir => {

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, {
            recursive: true
        });

    }

});


// ============================================================
// UTILITÁRIOS
// ============================================================

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
// 5. BAIXAR ESTATÍSTICAS DE XG
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

    console.log(
        "\nAmostra:"
    );

    console.log(
        JSON.stringify(
            xgData,
            null,
            2
        ).substring(0, 3000)
    );

}


// ============================================================
// 7. GERAR RESUMO DAS PARTIDAS
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
// 8. EXECUÇÃO PRINCIPAL
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
        // xG
        // ----------------------------------

        const xgStats =
            await getXGStats(
                leagueData
            );


        inspectXG(
            xgStats.xg
        );


        // ----------------------------------
        // Arquivo final da Fase 1
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
        console.log("✅ FASE 1 CONCLUÍDA");
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