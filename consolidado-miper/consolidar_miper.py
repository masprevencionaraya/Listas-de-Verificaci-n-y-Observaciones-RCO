"""Consolida matrices MIPER (SIGO-F-006 Rev.09) en un archivo general.

Uso:  python3 consolidar_miper.py <carpeta_con_xlsm> <salida.xlsx>

Lee la hoja MIPER de cada archivo, homologa los niveles de riesgo de las
distintas escalas (Seguridad, Higiene, Músculo-esquelético, Psicosocial) a
4 niveles y genera la tabla resumen de riesgo inicial vs residual.
"""
import collections
import glob
import os
import re
import sys
import unicodedata

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

NIVELES = ["Intolerable / crítico", "Importante / alto", "Moderado / medio", "Tolerable / bajo"]

# Nivel original de la matriz -> (nivel homologado, escala de origen)
HOMOLOGACION = [
    ("INTOLERABLE", NIVELES[0], "Seguridad / Emergencia (VEP 16)"),
    ("IMPORTANTE", NIVELES[1], "Seguridad / Emergencia (VEP 8)"),
    ("MODERADO", NIVELES[2], "Seguridad / Emergencia (VEP 4)"),
    ("TOLERABLE", NIVELES[3], "Seguridad / Emergencia (VEP 1-2)"),
    ("NIVEL 4", NIVELES[0], "Higiene (VRE > LP / DRD > 1)"),
    ("CRE", NIVELES[0], "Higiene – Con riesgo de exposición (VRE > LP, agentes físicos/biológicos)"),
    ("NIVEL 3", NIVELES[1], "Higiene (0,5 LP ≤ VRE ≤ LP / 0,5 < DRD ≤ 1)"),
    ("NIVEL 2", NIVELES[2], "Higiene (0,25 LP ≤ VRE < 0,5 LP / 0,33 ≤ DRD ≤ 0,5)"),
    ("NIVEL 1", NIVELES[3], "Higiene (VRE < 0,25 LP / DRD < 0,33)"),
    ("SRE", NIVELES[3], "Higiene – Sin riesgo de exposición (VRE ≤ LP)"),
    ("ALTO", NIVELES[1], "Músculo-esquelético / Psicosocial (alto)"),
    ("MEDIO", NIVELES[2], "Músculo-esquelético / Psicosocial (medio)"),
    ("Medio-Alerta", NIVELES[2], "Psicosocial (+1 alerta)"),
    ("BAJO", NIVELES[3], "Músculo-esquelético / Psicosocial (bajo)"),
]

CATEGORIAS = {
    "SEGURIDAD_EMERGENCIA": "Seguridad / Emergencia",
    "HIGIENE": "Higiene ocupacional",
    "MUSCULO_ESQUELETICO": "Músculo-esquelético",
    "PSICOSOCIAL": "Psicosocial",
}


def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()


def riesgo_general(peligro, rf, especifico):
    """Nombre normalizado del riesgo para agrupar entre matrices."""
    p = sin_tildes(peligro or "")
    rf = rf or ""
    e = sin_tildes(especifico or "")
    if "ATROPELLO" in p:
        return "Atropello o golpe con vehículo (RF27)"
    if "MISMO NIVEL" in p:
        return "Caída al mismo nivel"
    if "ALTURA" in p or "DISTINTO NIVEL" in p:
        return "Caída de altura (RF02)"
    if "CAIDA DE OBJETO" in p:
        return "Caída de objetos (RF13)"
    if "CARGA SUSPENDIDA" in p:
        return "Aplastamiento por carga suspendida (RF03)"
    if "CLIMA" in p:
        return "Condiciones climáticas adversas"
    if "CHOQUE CONTRA OBJETO" in p:
        return "Choque contra objetos"
    if "SUSTANCIA" in p:
        return "Contacto con sustancias peligrosas / químicas (RF07)"
    if "LIBERACION DESCONTROLADA" in p:
        return "Liberación descontrolada de energía (RF04)"
    if "CORTADO" in p or "CORTES" in p:
        return "Cortes por objetos / herramientas cortopunzantes"
    if "CHOQUE" in p or "COLISION" in p or "VOLCAMIENTO" in p:
        if rf.startswith("RF25"):
            return "Choque, colisión o volcamiento – equipos móviles (RF25)"
        return "Choque, colisión o volcamiento – vehículos (RF10)"
    if "INCENDIO" in p:
        return "Incendio (RF06)"
    if "ELECTRIC" in p:
        return "Contacto con energía eléctrica (RF01)"
    if "ATRAPAMIENTO" in p:
        return "Atrapamiento de manos / extremidades"
    if "GOLPEADO" in p:
        return "Golpeado por / contra / entre"
    if "UV" in p:
        return "Exposición a radiación UV solar"
    if "POLVO" in p or "SILICE" in p:
        return "Exposición a polvo / sílice (RF20)"
    if "RUIDO" in p:
        return "Exposición a ruido"
    if "MMC" in p or "MANUAL DE CARGA" in p:
        return "Manejo manual de carga (MMC)"
    if "POSTURA" in p:
        return "Postura forzada"
    if "MANO BRAZO" in p:
        return "Vibración mano-brazo"
    if "VIBRACI" in p:
        return "Vibración cuerpo completo"
    if p == "PSICOSOCIAL":
        if "LIDERAZGO" in e:
            return "Psicosocial – calidad del liderazgo"
        if "CARGA DE TRABAJO" in e:
            return "Psicosocial – carga de trabajo"
        m = re.search(r"DIMENSION\s+(.+?)\s*\(", e)
        return "Psicosocial – " + (m.group(1).strip().lower() if m else "otra dimensión")
    if "INDUSTRIAL" in p:
        return "Emergencia industrial"
    if "NATURAL" in p:
        return "Emergencia por desastre natural"
    if "ANTROPIC" in p:
        return "Emergencia antrópica"
    if p.strip() in ("CONTACTO", "CONTACTO CON"):
        return "Contacto con (peligro sin especificar)"
    return (peligro or "").strip().capitalize()


def limpiar(v):
    if isinstance(v, str):
        v = re.sub(r"[ \t]+", " ", v).strip()
    return v


def leer_matriz(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["MIPER"]
    filas = []
    for r in range(10, ws.max_row + 1):
        g = ws.cell(r, 7).value
        n = ws.cell(r, 14).value
        if g is None and n is None:
            continue
        c = lambda k: limpiar(ws.cell(r, k).value)
        filas.append({
            "fila": r, "proceso": c(2), "actividad": c(3), "tarea": c(4), "puesto": c(5),
            "n_trab": c(6), "peligro": c(7), "categoria": c(8), "rf": c(9), "especifico": c(10),
            "p_i": c(11), "c_i": c(12), "vep_i": c(13), "nivel_i": c(14), "medidas": c(15),
            "jerarquia": c(16), "p_r": c(17), "c_r": c(18), "vep_r": c(19), "nivel_r": c(20),
            "responsable": c(21),
        })
    # Actividad principal = la más frecuente en la columna ACTIVIDAD
    act = collections.Counter(f["actividad"] for f in filas if f["actividad"]
                              and not sin_tildes(f["actividad"]).startswith("TODAS"))
    actividad = act.most_common(1)[0][0] if act else os.path.basename(path)
    cab = {"division": ws["B6"].value, "gerencia": ws["G6"].value, "superintendencia": ws["N6"].value,
           "dotacion": [ws["S7"].value, ws["T7"].value, ws["U7"].value]}
    return actividad, filas, cab


# ---------- estilos ----------
AZUL = PatternFill("solid", fgColor="D9E2F3")
GRIS = PatternFill("solid", fgColor="F2F2F2")
TITULO = PatternFill("solid", fgColor="1F3864")
COLOR_NIVEL = {
    NIVELES[0]: PatternFill("solid", fgColor="FF7C80"),
    NIVELES[1]: PatternFill("solid", fgColor="FFC000"),
    NIVELES[2]: PatternFill("solid", fgColor="FFFF99"),
    NIVELES[3]: PatternFill("solid", fgColor="A9D08E"),
}
fino = Side(style="thin", color="808080")
BORDE = Border(left=fino, right=fino, top=fino, bottom=fino)
CENTRO = Alignment(horizontal="center", vertical="center", wrap_text=True)
IZQ = Alignment(horizontal="left", vertical="center", wrap_text=True)
NEG = Font(bold=True)


def celda(ws, ref, valor, fill=None, font=None, align=CENTRO, borde=True, fmt=None):
    c = ws[ref]
    c.value = valor
    if fill:
        c.fill = fill
    if font:
        c.font = font
    c.alignment = align
    if borde:
        c.border = BORDE
    if fmt:
        c.number_format = fmt
    return c


def titulo(ws, ref_rango, texto):
    ws.merge_cells(ref_rango)
    c = ws[ref_rango.split(":")[0]]
    c.value = texto
    c.fill = TITULO
    c.font = Font(bold=True, color="FFFFFF", size=12)
    c.alignment = IZQ


def revisar(matrices, cabeceras):
    """Controles automáticos de calidad sobre las matrices."""
    obs = []  # (prioridad, archivo, fila, tema, hallazgo, recomendación)
    for nombre, actividad, filas in matrices:
        cab = cabeceras[nombre]
        vacios = [k for k in ("division", "gerencia", "superintendencia")
                  if not re.sub(r"^[A-Z ]+:", "", sin_tildes(cab[k] or "")).strip()]
        if vacios or not any(cab["dotacion"]):
            obs.append(("Media", nombre, "6-7", "Encabezado incompleto",
                        "Faltan datos del encabezado de la hoja MIPER: " + ", ".join(
                            vacios + ([] if any(cab["dotacion"]) else ["cantidad de trabajadores"])) + ".",
                        "Completar División, Gerencia, Superintendencia y dotación por género."))
        vistos = {}
        for f in filas:
            fila = f["fila"]
            pel = sin_tildes(f["peligro"] or "")
            esp = sin_tildes(f["especifico"] or "")
            if f["nivel_i"] not in [h[0] for h in HOMOLOGACION]:
                obs.append(("Alta", nombre, fila, "Fila sin evaluar",
                            f"'{f['peligro']}' tiene nivel inicial '{f['nivel_i']}' y sin evaluación residual.",
                            "Evaluar el riesgo o eliminar la fila si es solo un encabezado/nota."))
                continue
            if f["nivel_r"] == "INTOLERABLE":
                obs.append(("Alta", nombre, fila, "Riesgo residual intolerable",
                            f"'{f['peligro']}' queda INTOLERABLE (VEP {f['vep_r']}) después de los controles.",
                            "Según la metodología, un residual intolerable no permite ejecutar la tarea: "
                            "agregar/declarar controles (CCP/CCM, plan de emergencia, simulacros) y reevaluar."))
            if f["categoria"] == "HIGIENE" and f["nivel_r"] in ("BAJO", "MEDIO", "ALTO"):
                obs.append(("Media", nombre, fila, "Escala residual incorrecta",
                            f"Riesgo de higiene '{f['peligro']}' con residual '{f['vep_r']} / {f['nivel_r']}' "
                            "(escala músculo-esquelética).",
                            "Usar escala de higiene (para ruido: DRD < 0,33 → NIVEL 1)."))
            if pel.endswith(" CON") or pel.endswith(" POR/CONTRA") or pel in ("CONTACTO", "CONTACTO CON"):
                obs.append(("Media", nombre, fila, "Peligro incompleto",
                            f"El peligro '{f['peligro']}' está incompleto (no indica con qué).",
                            "Especificar el agente o la fuente (p. ej. 'Contacto con partes cortantes/calientes')."))
            if "UV" in pel and "(P6)" in esp:
                obs.append(("Baja", nombre, fila, "Código de riesgo específico",
                            "Radiación UV codificada como '(P6) Exposición a Calor'.",
                            "Usar '(P5) Exposición a Radiaciones No Ionizantes'."))
            if "INCENDIO" in pel and "RF06" not in esp:
                obs.append(("Media", nombre, fila, "Código de riesgo específico",
                            f"Incendio codificado como '{f['especifico']}'.", "Usar '(J) RF06 Incendios'."))
            if "POSTURA" in pel and "VIBRACION" in esp:
                obs.append(("Baja", nombre, fila, "Código de riesgo específico",
                            f"Postura forzada codificada como '{f['especifico']}'.",
                            "Usar el código de sobrecarga postural (T1–T8) que corresponda."))
            if "VIBRACI" in pel and "VIBRACION" not in esp:
                obs.append(("Baja", nombre, fila, "Código de riesgo específico",
                            f"Vibración codificada como '{f['especifico']}'.",
                            "Usar (T9) vibración cuerpo completo o (T10) mano-brazo."))
            if (isinstance(f["c_i"], (int, float)) and isinstance(f["c_r"], (int, float))
                    and f["c_r"] < f["c_i"] and f["jerarquia"] in ("CONTROLES ADMINISTRATIVOS", "EQUIPOS DE PROTECCIÓN PERSONAL")):
                obs.append(("Media", nombre, fila, "Reducción de consecuencia",
                            f"'{f['peligro']}' baja la consecuencia de {f['c_i']} a {f['c_r']} con "
                            f"{f['jerarquia'].lower()}.",
                            "Los controles administrativos/EPP normalmente reducen la probabilidad, no la "
                            "consecuencia; justificar o corregir."))
            if "ATRAPAMIENTO" in pel and not (f["rf"] or "").startswith("RF09"):
                obs.append(("Media", nombre, fila, "RF no asociado",
                            f"'{f['peligro']}' evaluado {f['nivel_i']} sin asociar a RF09 – Partes Móviles "
                            "(otra matriz sí lo asocia).",
                            "Evaluar asociar a RF09 y declarar sus controles críticos si la fuente son partes móviles."))
            if f["categoria"] == "SEGURIDAD_EMERGENCIA" and f["rf"] == "NA":
                obs.append(("Baja", nombre, fila, "Campo RF",
                            "Campo RF con 'NA' en un riesgo de seguridad.", "Usar 'No asociado a RF' (lista del formato)."))
            clave = (f["tarea"], riesgo_general(f["peligro"], f["rf"], f["especifico"]))
            if clave in vistos:
                obs.append(("Media", nombre, fila, "Fila duplicada",
                            f"'{f['peligro']}' se repite en la misma tarea (ver fila {vistos[clave]}).",
                            "Unificar en una sola fila o diferenciar la fuente del peligro."))
            else:
                vistos[clave] = fila
    return obs


def escribir_observaciones(ws, matrices, cabeceras):
    obs = revisar(matrices, cabeceras)
    orden = {"Alta": 0, "Media": 1, "Baja": 2}
    obs.sort(key=lambda o: (orden[o[0]], o[3], o[1], str(o[2])))
    titulo(ws, "A1:G1", "Observaciones de calidad detectadas en las matrices")
    ws["A2"] = f"{len(obs)} observaciones. Prioridad Alta = afecta la evaluación; Baja = forma/codificación."
    ws["A2"].font = Font(italic=True, color="595959")
    for i, h in enumerate(["N°", "Prioridad", "Archivo", "Fila MIPER", "Tema", "Hallazgo", "Recomendación"], 1):
        celda(ws, f"{get_column_letter(i)}4", h, AZUL, NEG)
    fills = {"Alta": COLOR_NIVEL[NIVELES[0]], "Media": COLOR_NIVEL[NIVELES[1]], "Baja": COLOR_NIVEL[NIVELES[2]]}
    for k, o in enumerate(obs, start=5):
        for i, v in enumerate((k - 4,) + o, start=1):
            c = ws.cell(k, i, v)
            c.border = BORDE
            c.alignment = IZQ if i >= 5 else CENTRO
        ws.cell(k, 2).fill = fills[o[0]]
    for i, w in enumerate([5, 10, 40, 10, 26, 60, 60], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A5"
    # resumen por tema
    fila = len(obs) + 7
    celda(ws, f"E{fila}", "Resumen por tema", GRIS, NEG)
    celda(ws, f"F{fila}", "N°", GRIS, NEG)
    for t, n in collections.Counter(o[3] for o in obs).most_common():
        fila += 1
        celda(ws, f"E{fila}", t, align=IZQ)
        celda(ws, f"F{fila}", n)


def main(carpeta, salida):
    archivos = sorted(glob.glob(os.path.join(carpeta, "*.xls*")))
    import hashlib
    matrices = []
    cabeceras = {}
    hashes = {}
    for a in archivos:
        h = hashlib.md5(open(a, "rb").read()).hexdigest()
        if h in hashes:
            print(f"Omitido (idéntico a {hashes[h]}): {a}")
            continue
        hashes[h] = os.path.basename(a)
        actividad, filas, cab = leer_matriz(a)
        nombre = re.sub(r"^[0-9a-f]{8}-", "", os.path.basename(a))
        matrices.append((nombre, actividad, filas))
        cabeceras[nombre] = cab

    wb = openpyxl.Workbook()
    ws_res = wb.active
    ws_res.title = "RESUMEN"
    ws_gen = wb.create_sheet("RIESGOS GENERALES")
    ws_det = wb.create_sheet("DETALLE")
    ws_hom = wb.create_sheet("HOMOLOGACION")

    # ---------- HOMOLOGACION ----------
    titulo(ws_hom, "A1:C1", "Homologación de niveles de riesgo a la tabla de 4 niveles")
    for i, h in enumerate(["Nivel en matriz MIPER", "Nivel homologado", "Escala / criterio SIGO-F-006"]):
        celda(ws_hom, f"{get_column_letter(i + 1)}3", h, AZUL, NEG)
    for i, (orig, hom, esc) in enumerate(HOMOLOGACION, start=4):
        celda(ws_hom, f"A{i}", orig)
        celda(ws_hom, f"B{i}", hom, COLOR_NIVEL[hom])
        celda(ws_hom, f"C{i}", esc, align=IZQ)
    fin_hom = 3 + len(HOMOLOGACION)
    ws_hom[f"A{fin_hom + 2}"] = ("Nota: los niveles que no estén en esta tabla (p. ej. 'No encontrado') "
                                  "quedan como 'Sin evaluar' y no se cuentan en el resumen.")
    ws_hom[f"A{fin_hom + 2}"].font = Font(italic=True)
    for col, w in zip("ABC", (24, 24, 70)):
        ws_hom.column_dimensions[col].width = w
    rango_hom = f"HOMOLOGACION!$A$4:$B${fin_hom}"

    # ---------- DETALLE ----------
    cab = ["N°", "Archivo", "Actividad", "Tarea", "Puesto de trabajo", "N° trab.", "Peligro (original)",
           "Riesgo general", "Categoría", "RF asociado", "Riesgo específico", "P inicial", "C inicial",
           "VEP / magnitud inicial", "Nivel inicial (matriz)", "Nivel inicial homologado",
           "Medidas preventivas", "Jerarquía de control", "P residual", "C residual",
           "VEP / magnitud residual", "Nivel residual (matriz)", "Nivel residual homologado",
           "Responsable", "Fila en matriz origen"]
    for i, h in enumerate(cab, start=1):
        celda(ws_det, f"{get_column_letter(i)}1", h, AZUL, NEG)
    r = 2
    for nombre, actividad, filas in matrices:
        for f in filas:
            vals = [r - 1, nombre, actividad, f["tarea"], f["puesto"], f["n_trab"], f["peligro"],
                    riesgo_general(f["peligro"], f["rf"], f["especifico"]),
                    CATEGORIAS.get(f["categoria"], f["categoria"]), f["rf"], f["especifico"],
                    f["p_i"], f["c_i"], f["vep_i"], f["nivel_i"],
                    f'=IFERROR(VLOOKUP(O{r},{rango_hom},2,FALSE),"Sin evaluar")',
                    f["medidas"], f["jerarquia"], f["p_r"], f["c_r"], f["vep_r"], f["nivel_r"],
                    f'=IFERROR(VLOOKUP(V{r},{rango_hom},2,FALSE),"Sin evaluar")',
                    f["responsable"], f["fila"]]
            for i, v in enumerate(vals, start=1):
                c = ws_det.cell(r, i, v)
                c.border = BORDE
                c.alignment = Alignment(vertical="top", wrap_text=True)
            r += 1
    fin_det = r - 1
    anchos = [5, 30, 28, 30, 24, 8, 30, 34, 20, 22, 30, 7, 7, 14, 14, 20, 60, 20, 7, 7, 14, 14, 20, 26, 8]
    for i, w in enumerate(anchos, start=1):
        ws_det.column_dimensions[get_column_letter(i)].width = w
    for rr in range(2, fin_det + 1):
        ws_det.row_dimensions[rr].height = 45
    ws_det.freeze_panes = "H2"
    tabla = Table(displayName="Detalle", ref=f"A1:{get_column_letter(len(cab))}{fin_det}")
    tabla.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws_det.add_table(tabla)
    from openpyxl.formatting.rule import CellIsRule
    for col in ("P", "W"):
        for niv, fill in COLOR_NIVEL.items():
            ws_det.conditional_formatting.add(
                f"{col}2:{col}{fin_det}", CellIsRule(operator="equal", formula=[f'"{niv}"'], fill=fill))

    INI = f"DETALLE!$P$2:$P${fin_det}"
    RES = f"DETALLE!$W$2:$W${fin_det}"
    CAT = f"DETALLE!$I$2:$I${fin_det}"
    ACT = f"DETALLE!$C$2:$C${fin_det}"
    GEN = f"DETALLE!$H$2:$H${fin_det}"

    # ---------- RESUMEN ----------
    ws = ws_res
    titulo(ws, "B1:F1", "Consolidado MIPER SIGO-F-006 Rev.09 – Distribución de riesgos por nivel")
    ws["B2"] = f"Matrices consolidadas: {len(matrices)}  |  Fuente: hoja DETALLE  |  Homologación: hoja HOMOLOGACION"
    ws["B2"].font = Font(italic=True, color="595959")

    def tabla_niveles(fila0, filtro=None, rotulo=None):
        """Tabla Nivel | Inicial N | % | Residual N | %. filtro = (rango, valor)."""
        if rotulo:
            ws.merge_cells(f"B{fila0}:F{fila0}")
            celda(ws, f"B{fila0}", rotulo, GRIS, NEG, IZQ)
            fila0 += 1
        for i, h in enumerate(["Nivel de riesgo", "Riesgo inicial (N° de riesgos)", "%",
                               "Riesgo residual (N° de riesgos)", "%"]):
            celda(ws, f"{get_column_letter(i + 2)}{fila0}", h, AZUL, NEG)
        ws.row_dimensions[fila0].height = 32
        tot = fila0 + len(NIVELES) + 1
        extra = f',{filtro[0]},"{filtro[1]}"' if filtro else ""
        for k, niv in enumerate(NIVELES):
            rr = fila0 + 1 + k
            celda(ws, f"B{rr}", niv, COLOR_NIVEL[niv], align=IZQ)
            celda(ws, f"C{rr}", f'=COUNTIFS({INI},B{rr}{extra})')
            celda(ws, f"D{rr}", f"=IF(C${tot}=0,0,C{rr}/C${tot})", fmt="0.0%")
            celda(ws, f"E{rr}", f'=COUNTIFS({RES},B{rr}{extra})')
            celda(ws, f"F{rr}", f"=IF(E${tot}=0,0,E{rr}/E${tot})", fmt="0.0%")
        celda(ws, f"B{tot}", "Total", GRIS, NEG, IZQ)
        celda(ws, f"C{tot}", f"=SUM(C{fila0 + 1}:C{tot - 1})", GRIS, NEG)
        celda(ws, f"D{tot}", f"=SUM(D{fila0 + 1}:D{tot - 1})", GRIS, NEG, fmt="0%")
        celda(ws, f"E{tot}", f"=SUM(E{fila0 + 1}:E{tot - 1})", GRIS, NEG)
        celda(ws, f"F{tot}", f"=SUM(F{fila0 + 1}:F{tot - 1})", GRIS, NEG, fmt="0%")
        return tot

    fila = tabla_niveles(4, rotulo="TABLA GENERAL – Todas las matrices")
    ws[f"B{fila + 1}"] = (f'=COUNTIF({INI},"Sin evaluar")&" fila(s) sin evaluar excluidas del conteo '
                          f'(ver hoja OBSERVACIONES)."')
    ws[f"B{fila + 1}"].font = Font(italic=True, color="C00000")
    fila += 3
    ws.merge_cells(f"B{fila}:F{fila}")
    celda(ws, f"B{fila}", "DESGLOSE POR CATEGORÍA DE RIESGO", TITULO, Font(bold=True, color="FFFFFF"), IZQ)
    fila += 2
    for cat in CATEGORIAS.values():
        fila = tabla_niveles(fila, (CAT, cat), cat) + 2
    ws.merge_cells(f"B{fila}:F{fila}")
    celda(ws, f"B{fila}", "DESGLOSE POR ACTIVIDAD (MATRIZ)", TITULO, Font(bold=True, color="FFFFFF"), IZQ)
    fila += 2
    for nombre, actividad, _ in matrices:
        fila = tabla_niveles(fila, (ACT, actividad), f"{actividad}  [{nombre}]") + 2
    ws.column_dimensions["A"].width = 2
    ws.column_dimensions["B"].width = 30
    for col in "CDEF":
        ws.column_dimensions[col].width = 18

    # ---------- RIESGOS GENERALES ----------
    grupos = collections.OrderedDict()
    for nombre, actividad, filas in matrices:
        for f in filas:
            if f["nivel_i"] in (None, "No encontrado"):
                continue
            g = riesgo_general(f["peligro"], f["rf"], f["especifico"])
            d = grupos.setdefault(g, {"cat": CATEGORIAS.get(f["categoria"], f["categoria"]),
                                      "rf": set(), "act": [], "cod": set()})
            if f["rf"] and f["rf"] not in ("NA", "No asociado a RF"):
                d["rf"].add(f["rf"])
            if actividad not in d["act"]:
                d["act"].append(actividad)
            if f["especifico"]:
                d["cod"].add(f["especifico"])
    orden_cat = list(CATEGORIAS.values())
    items = sorted(grupos.items(), key=lambda kv: (orden_cat.index(kv[1]["cat"]) if kv[1]["cat"] in orden_cat else 9,
                                                   0 if kv[1]["rf"] else 1, kv[0]))
    titulo(ws_gen, "A1:N1", "Riesgos asociados identificados en las matrices (agrupados)")
    ws_gen["A2"] = "Conteos calculados con fórmulas desde la hoja DETALLE. Ordenado por categoría y Riesgo de Fatalidad."
    ws_gen["A2"].font = Font(italic=True, color="595959")
    cab = ["N°", "Riesgo general", "Categoría", "RF asociado", "Código(s) riesgo específico",
           "Actividades donde aparece", "N° apariciones", "Inicial: Intolerable", "Inicial: Importante",
           "Inicial: Moderado", "Inicial: Tolerable", "Residual: Intolerable", "Residual: Importante",
           "Residual: Moderado", "Residual: Tolerable"]
    for i, h in enumerate(cab, start=1):
        celda(ws_gen, f"{get_column_letter(i)}4", h, AZUL, NEG)
    ws_gen.row_dimensions[4].height = 32
    for k, (g, d) in enumerate(items, start=5):
        vals = [k - 4, g, d["cat"], "\n".join(sorted(d["rf"])) or "No asociado a RF",
                "\n".join(sorted(d["cod"])), "\n".join(d["act"]),
                f'=COUNTIFS({GEN},B{k},{INI},"<>Sin evaluar")']
        vals += [f'=COUNTIFS({GEN},$B{k},{INI},"{n}")' for n in NIVELES]
        vals += [f'=COUNTIFS({GEN},$B{k},{RES},"{n}")' for n in NIVELES]
        for i, v in enumerate(vals, start=1):
            c = ws_gen.cell(k, i, v)
            c.border = BORDE
            c.alignment = IZQ if i in (2, 3, 4, 5, 6) else CENTRO
        ws_gen.row_dimensions[k].height = max(30, 15 * max(len(d["act"]), len(d["cod"]), 1))
    fin_gen = 4 + len(items)
    celda(ws_gen, f"B{fin_gen + 1}", "Total", GRIS, NEG, IZQ)
    for i in range(7, 16):
        col = get_column_letter(i)
        celda(ws_gen, f"{col}{fin_gen + 1}", f"=SUM({col}5:{col}{fin_gen})", GRIS, NEG)
    for col_letters, niveles in (("HIJK", NIVELES), ("LMNO", NIVELES)):
        for col, niv in zip(col_letters, niveles):
            ws_gen[f"{col}4"].fill = COLOR_NIVEL[niv]
    for i, w in enumerate([5, 44, 22, 30, 42, 48, 11, 11, 11, 11, 11, 11, 11, 11, 11], start=1):
        ws_gen.column_dimensions[get_column_letter(i)].width = w
    ws_gen.freeze_panes = "C5"

    escribir_observaciones(wb.create_sheet("OBSERVACIONES"), matrices, cabeceras)
    from openpyxl.workbook.properties import CalcProperties
    wb.calculation = CalcProperties(fullCalcOnLoad=True)
    wb.save(salida)
    return matrices, wb


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
