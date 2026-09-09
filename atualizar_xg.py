#!/usr/bin/env python3
"""Atualiza dados de xG do Brasileirão a partir do Tableau Public.

Fonte: https://public.tableau.com/shared/B3WPFJBSS?:display_count=n&:origin=viz_share_link
Saída: data/xg/brasil.json
"""

from __future__ import annotations
import csv, io, json, re, sys
from datetime import datetime, timezone
from pathlib import Path
import requests

SHARE_ID = "B3WPFJBSS"
SHARED_URL = "https://public.tableau.com/shared/B3WPFJBSS?:display_count=n&:origin=viz_share_link"
OUT = Path("data/xg/brasil.json")
FALLBACK_WORKBOOK = "FootballxGLeagueTablesv4"
FALLBACK_VIEW = "LeagueTablesv2"
HEADERS = {"User-Agent": "Mozilla/5.0 (GitHub Actions; xG updater)", "Accept": "application/json,text/csv,*/*"}


def log(s): print(s, flush=True)


def walk(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k, v
            yield from walk(v)
    elif isinstance(obj, list):
        for v in obj: yield from walk(v)


def first(data, names):
    names = {x.lower() for x in names}
    for k, v in walk(data):
        if str(k).lower() in names and isinstance(v, str) and v.strip(): return v.strip()
    return None


def resolve(session):
    url = f"https://public.tableau.com/profile/api/workbook/shared/{SHARE_ID}"
    try:
        r = session.get(url, headers=HEADERS, timeout=60)
        r.raise_for_status(); data = r.json()
        workbook = first(data, ["workbookRepoUrl", "workbook_repo_url"])
        view = first(data, ["viewName", "defaultViewName", "sheetName", "sheetRepoUrl"])
        if workbook and view:
            return workbook, view.split("/")[-1]
    except Exception as e:
        log(f"Aviso ao resolver Share ID: {e}")
    return FALLBACK_WORKBOOK, FALLBACK_VIEW


def read_csv(text):
    try: delim = csv.Sniffer().sniff(text[:5000], delimiters=",;\t|").delimiter
    except csv.Error: delim = ","
    return [
        {str(k).strip(): (str(v).strip() if v is not None else "") for k, v in row.items() if k}
        for row in csv.DictReader(io.StringIO(text), delimiter=delim)
        if row and any(row.values())
    ]


def score_columns(cols):
    s = " ".join(c.lower() for c in cols)
    return sum(x in s for x in ["team", "xg", "xga", "games"])


def direct_csv(session, workbook, view):
    urls = [
        f"https://public.tableau.com/views/{workbook}/{view}.csv?:showVizHome=no",
        f"https://public.tableau.com/views/{workbook}/{view}/CSVDownload.csv?:showVizHome=no",
    ]
    for url in urls:
        log(f"Tentando CSV: {url}")
        try:
            r = session.get(url, headers=HEADERS, timeout=60); r.raise_for_status()
            rows = read_csv(r.text)
            if rows and score_columns(list(rows[0])) >= 2:
                log(f"CSV encontrado: {len(rows)} linhas")
                return rows
        except Exception as e: log(f"Falhou: {e}")
    return []


def tableau_scraper(workbook, view):
    try:
        from tableauscraper import TableauScraper as TS
    except ImportError:
        raise RuntimeError("Instale tableauscraper: pip install tableauscraper")
    url = f"https://public.tableau.com/views/{workbook}/{view}?:showVizHome=no"
    log("Tentando extração via tableauscraper...")
    ts = TS(); ts.loads(url); wb = ts.getWorkbook()
    best = None
    for ws in wb.worksheets:
        df = ws.data
        if df is None or df.empty: continue
        score = score_columns([str(c) for c in df.columns])
        if best is None or score > best[0]: best = (score, ws.name, df)
    if not best or best[0] < 2: raise RuntimeError("Não encontrei uma worksheet compatível com a tabela de xG.")
    log(f"Worksheet selecionada: {best[1]}")
    return best[2].fillna("").astype(str).to_dict("records")


def norm(s): return re.sub(r"[^a-z0-9]", "", str(s).lower())

def col(columns, aliases):
    d = {norm(c): c for c in columns}
    for a in aliases:
        if norm(a) in d: return d[norm(a)]
    for a in aliases:
        a = norm(a)
        for k, v in d.items():
            if a in k or k in a: return v
    return None

def num(v):
    if v is None: return None
    s = str(v).replace("%", "").replace(" ", "").replace(",", ".")
    s = re.sub(r"[^0-9.+-]", "", s)
    try: return float(s)
    except: return None


def normalize(rows):
    if not rows: raise RuntimeError("Nenhum dado recebido.")
    cols = list(rows[0])
    m = {
        "team": col(cols, ["Team", "Club", "Squad"]),
        "games": col(cols, ["Games", "MP", "Matches Played"]),
        "goal_diff": col(cols, ["Goal Diff", "Goal Difference", "GD"]),
        "xg": col(cols, ["xG"]),
        "xga": col(cols, ["xGA", "xG Against"]),
        "net_xg": col(cols, ["Net xG", "xGD", "xG Difference"]),
        "xg_pts": col(cols, ["xG Pts", "xG Points", "xPts", "Expected Points"]),
    }
    log("Mapeamento: " + json.dumps(m, ensure_ascii=False))
    missing = [k for k in ["team", "games", "xg", "xga"] if not m[k]]
    if missing: raise RuntimeError(f"Colunas obrigatórias ausentes: {missing}. Disponíveis: {cols}")
    out = []
    for r in rows:
        team = str(r.get(m["team"], "")).strip()
        games, xg, xga = num(r.get(m["games"])), num(r.get(m["xg"])), num(r.get(m["xga"]))
        if not team or games is None or xg is None or xga is None: continue
        net = num(r.get(m["net_xg"])) if m["net_xg"] else xg-xga
        gd = num(r.get(m["goal_diff"])) if m["goal_diff"] else None
        pts = num(r.get(m["xg_pts"])) if m["xg_pts"] else None
        out.append({"team":team,"games":int(games) if games.is_integer() else games,"goal_diff":gd,"xg":round(xg,2),"xga":round(xga,2),"net_xg":round(net,2),"xg_pts":round(pts,2) if pts is not None else None})
    if len(out) < 10: raise RuntimeError(f"Apenas {len(out)} equipes foram reconhecidas; a tabela extraída provavelmente não é a correta.")
    return out


def main():
    session = requests.Session()
    workbook, view = resolve(session)
    log(f"Workbook: {workbook}")
    log(f"View: {view}")
    rows = direct_csv(session, workbook, view)
    if not rows: rows = tableau_scraper(workbook, view)
    teams = normalize(rows)
    teams.sort(key=lambda x: x["net_xg"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"league":"Brasil","season":"2026","source":"FootballXG / Tableau Public","source_url":SHARED_URL,"updated_at":datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z"),"teams":teams}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"OK: {len(teams)} equipes gravadas em {OUT}")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        log(f"ERRO: {e}"); sys.exit(1)
