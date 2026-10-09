"""Parcours complets dans un vrai navigateur contre tests/e2e/server.js (vraie validation + vraie base locale)."""
import sys
from playwright.sync_api import sync_playwright
B = "http://localhost:8098"

def setv(pg, k, v):
    if isinstance(v, bool):
        if v: pg.check(f'input[name="{k}"]', force=True)
    elif isinstance(v, list):
        for x in v: pg.check(f'input[name="{k}"][value="{x}"]', force=True)
    elif pg.locator(f'input[name="{k}"][type=radio]').count():
        pg.check(f'input[name="{k}"][value="{v}"]', force=True)
    elif pg.locator(f'select[name="{k}"], select#i_{k}').count():
        pg.select_option(f'#i_{k}', v)
    else:
        pg.fill(f'#i_{k}', v)

def step(pg, vals):
    for k, v in vals.items(): setv(pg, k, v)
    pg.click(".pri"); pg.wait_for_timeout(350)

def run(name, url, steps, expect, vp=(390, 844)):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": vp[0], "height": vp[1]})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + url); pg.wait_for_timeout(500)
        for s in steps: step(pg, s)
        pg.wait_for_timeout(1200)
        txt = pg.inner_text("#card"); pg.screenshot(path=f"/var/tmp/e2e_{name}.png", full_page=False)
        ok = expect in txt and not errs
        print(("OK  " if ok else "FAIL"), name, "|", txt.replace("\n", " ")[:160], errs)
        b.close(); return ok

res = []
res.append(run("f1", "/index.html", [
  {"confirme": True, "civilite": "Dr", "prenom": "Sonia", "nom": "Sahli", "email": "sonia@iset.tn", "telephone": "+216 55 595 234"},
  {"institution": "ISET Sousse", "pays": "Tunisie", "fonction": "Enseignant-chercheur", "roles": ["Auteur d'une communication", "Participant"], "titre": "L'IAG en classe", "axe": "Approches pédagogiques"},
  {"regime": ["Sans porc", "Allergie (préciser)"], "allergie": "arachides", "accessibilite": "Non", "open_badge": "Les deux"},
  {"c_donnees": True, "c_infos": True, "c_photo": True}], "Bienvenue à RIPU26, Sonia"))
res.append(run("arrival", "/arrival.html?email=sonia@iset.tn&prenom=Sonia&nom=Sahli", [
  {"email": "sonia@iset.tn", "prenom": "Sonia", "nom": "Sahli", "telephone": "+216 55 595 234"},
  {"mode": "Avion", "date_arrivee": "2026-10-29", "aeroport": "Monastir Habib-Bourguiba (MIR)", "compagnie": "Tunisair", "vol": "tu 718", "heure": "14:35", "ville_depart": "Paris", "correspondance": "Oui", "ville_correspondance": "Istanbul"},
  {"nb_accompagnants": "2", "accompagnants": "Marie (adulte) ; Léo (8 ans)", "besoins": ["Siège enfant", "Autre"], "besoins_detail": "poussette"},
  {"navette": "Oui", "hotel": "Marhaba", "depart": "Dimanche 1er novembre"}], "transmises"))
res.append(run("excursion", "/excursion.html?email=marc@amu.fr", [
  {"email": "marc@amu.fr", "prenom": "Marc", "nom": "Durand", "participe": "Oui"},
  {"formule": "Les deux", "adultes": "1", "enfants": "2", "accompagnants": "Anne ; Léa (9 ans) ; Tom (6 ans)"},
  {"mobilite": "Non"}], "4"))
sys.exit(0 if all(res) else 1)
