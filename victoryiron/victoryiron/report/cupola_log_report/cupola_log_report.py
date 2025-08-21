# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

# import frappe


# def execute(filters=None):
# 	columns, data = [], []
# 	return columns, data



import frappe

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    data = suppress_parent_repeats(data)  # 🔑 post-process to avoid parent repetition
    return columns, data


def get_columns():
    return [
        # ---- Parent (Cupola Log) ----
        {"label": "Date", "fieldname": "date", "fieldtype": "Date", "width": 120},
        {"label": "Cupola Number", "fieldname": "cupola_number", "fieldtype": "Data", "width": 120},
        {"label": "Lightup", "fieldname": "lightup", "fieldtype": "Data", "width": 100},
        {"label": "Blower", "fieldname": "blower", "fieldtype": "Data", "width": 100},
        {"label": "Blower Melting", "fieldname": "blowermelting", "fieldtype": "Data", "width": 120},
        {"label": "Out", "fieldname": "out", "fieldtype": "Data", "width": 100},
        {"label": "Drop", "fieldname": "drop", "fieldtype": "Data", "width": 100},
        {"label": "Punching", "fieldname": "punching", "fieldtype": "Data", "width": 100},
        {"label": "CRC", "fieldname": "crc", "fieldtype": "Float", "width": 100},
        {"label": "Steam Coal", "fieldname": "steam_coal", "fieldtype": "Float", "width": 120},
        {"label": "Fire Wood", "fieldname": "fire_wood", "fieldtype": "Float", "width": 120},
        {"label": "Fire Bricks", "fieldname": "fire_bricks", "fieldtype": "Float", "width": 120},

        # ---- Child (Cupola Consumption Table) ----
        {"label": "Grade", "fieldname": "grade", "fieldtype": "Data", "width": 120},
        {"label": "Grade Produced", "fieldname": "grade_produced", "fieldtype": "Float", "width": 120},
        {"label": "Time", "fieldname": "time", "fieldtype": "Time", "width": 120},
        {"label": "Cupola Temp", "fieldname": "cupola_temp", "fieldtype": "Float", "width": 120},
        {"label": "Temp Time", "fieldname": "temp_time", "fieldtype": "Time", "width": 120},
        {"label": "Hard Coke", "fieldname": "hard_coke", "fieldtype": "Float", "width": 120},
        {"label": "Coke Type", "fieldname": "coke_type", "fieldtype": "Data", "width": 120},
        {"label": "Flux", "fieldname": "flux", "fieldtype": "Float", "width": 120},
        {"label": "DS Block", "fieldname": "ds_block", "fieldtype": "Float", "width": 120},
        {"label": "Manganese", "fieldname": "manganese", "fieldtype": "Float", "width": 120},
        {"label": "Silicon", "fieldname": "silicon", "fieldtype": "Float", "width": 120},
        {"label": "Pig < 10", "fieldname": "pig__10", "fieldtype": "Float", "width": 120},
        {"label": "Pig 10-15", "fieldname": "pig__10_to_15", "fieldtype": "Float", "width": 120},
        {"label": "Pig 15-20", "fieldname": "pig__15_to_20", "fieldtype": "Float", "width": 120},
        {"label": "Pig 20-25", "fieldname": "pig__20_to_25", "fieldtype": "Float", "width": 120},
        {"label": "Pig > 25", "fieldname": "pig___25_", "fieldtype": "Float", "width": 120},
        {"label": "CI FR", "fieldname": "ci_fr", "fieldtype": "Float", "width": 120},
        {"label": "DI FR", "fieldname": "di_fr", "fieldtype": "Float", "width": 120},
        {"label": "Mould Box Scrap", "fieldname": "mould_box_scrap", "fieldtype": "Float", "width": 140},
        {"label": "MS Scrap", "fieldname": "ms_scrap", "fieldtype": "Float", "width": 120},
        {"label": "M CI Scrap", "fieldname": "m_ci_scrap", "fieldtype": "Float", "width": 120},
        {"label": "CI Sliper", "fieldname": "ci_sliper", "fieldtype": "Float", "width": 120},
        {"label": "DI Pipe", "fieldname": "di_pipe", "fieldtype": "Float", "width": 120},
        {"label": "Total", "fieldname": "total", "fieldtype": "Float", "width": 120},
    ]


def get_data(filters):
    conditions = ""
    values = {}

    if filters.get("from_date"):
        conditions += " AND cl.date >= %(from_date)s"
        values["from_date"] = filters["from_date"]
    if filters.get("to_date"):
        conditions += " AND cl.date <= %(to_date)s"
        values["to_date"] = filters["to_date"]

    query = f"""
        SELECT
            cl.name,
            cl.date,
            cl.cupola_number,
            cl.lightup,
            cl.blower,
            cl.blowermelting,
            cl.out,
            cl.drop,
            cl.punching,
            cl.crc,
            cl.steam_coal,
            cl.fire_wood,
            cl.fire_bricks,
            cct.grade,
            cct.grade_produced,
            cct.time,
            cct.cupola_temp,
            cct.temp_time,
            cct.hard_coke,
            cct.coke_type,
            cct.flux,
            cct.ds_block,
            cct.manganese,
            cct.silicon,
            cct.pig__10,
            cct.pig__10_to_15,
            cct.pig__15_to_20,
            cct.pig__20_to_25,
            cct.pig___25_,
            cct.ci_fr,
            cct.di_fr,
            cct.mould_box_scrap,
            cct.ms_scrap,
            cct.m_ci_scrap,
            cct.ci_sliper,
            cct.di_pipe,
            cct.total
        FROM
            `tabCupola Log` cl
        LEFT JOIN
            `tabCupola Consumption Table` cct ON cct.parent = cl.name
        WHERE
            cl.docstatus < 2 {conditions}
        ORDER BY
            cl.date DESC, cl.name ASC
    """

    return frappe.db.sql(query, values, as_dict=True)


def suppress_parent_repeats(data):
    """Remove repeating parent values after first row of each Cupola Log"""
    seen = set()
    for row in data:
        parent_id = row["name"]
        if parent_id in seen:
            # blank out parent fields
            row["date"] = None
            row["cupola_number"] = None
            row["lightup"] = None
            row["blower"] = None
            row["blowermelting"] = None
            row["out"] = None
            row["drop"] = None
            row["punching"] = None
            row["crc"] = None
            row["steam_coal"] = None
            row["fire_wood"] = None
            row["fire_bricks"] = None
        else:
            seen.add(parent_id)
    return data
