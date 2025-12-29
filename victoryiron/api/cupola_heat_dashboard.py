import frappe

from datetime import datetime

# ----------------------- 2️⃣ FIRING / PREP TAB --------------------
@frappe.whitelist()
def get_cupola_firingprep(from_date=None, to_date=None):
    query = """
        SELECT
            name, date,
            firingprep_details,
            start AS ignition_start_time,
            end AS ignition_end_time,
            light_up, metal_out_at, blower_on_for_melting, cupola_drop_at,
            melting AS coke_metal_ratio,
            lime_stone AS coke_limestone_ratio,
            total_melting_hours,
            total_melting_hours_metal_out,
            average_melting_rate,
            average_melting_rate_metal_out,
            fire_bricks, fire_wood, stream_coal
        FROM `tabCupola Heat log`
        WHERE firingprep_details = 1    -- <-- only return if checked
    """

    params = []
    if from_date and to_date:
        query += " AND date BETWEEN %s AND %s"
        params = [from_date, to_date]

    return frappe.db.sql(query, params, as_dict=True)

@frappe.whitelist()
def get_cupola_consumption_summary(from_date=None,to_date=None):
    conditions = ""
    params = []

    if from_date and to_date:
        conditions = " AND ch.date BETWEEN %s AND %s"
        params = [from_date,to_date]

    raw = frappe.db.sql(f"""
        SELECT 
            ch.date,
            ct.item_name,
            SUM(ct.quantity) as qty
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch
            ON ct.parent = ch.name
        WHERE 1=1 {conditions}
        GROUP BY ch.date, ct.item_name
        ORDER BY ch.date
    """, params, as_dict=True)

    # Pivot conversion: date → item qty column only
    summary = {}
    for r in raw:
        date = str(r.date)
        item = r.item_name.replace(" ","_")

        if date not in summary:
            summary[date] = {"date": date}

        summary[date][item] = r.qty   # <-- sirf qty

    return list(summary.values())

@frappe.whitelist()
def get_cupola_details_with_consumption(from_date=None, to_date=None):

    # -------- Base parent data ---------
    conditions = " AND ch.firingprep_details = 0"  # ✔ exclude checked
    params = []

    if from_date and to_date:
        conditions += " AND ch.date BETWEEN %s AND %s"
        params = [from_date, to_date]

    details = frappe.db.sql(f"""
        SELECT 
            name,
            charge_no,
            grade,
            total_charge_mix_quantity,
            coke_type,
            total_charge_mix_calculation
        FROM `tabCupola Heat log` ch
        WHERE 1=1 {conditions}
    """, params, as_dict=True)

    # -------- Get child items in ORIGINAL ORDER (`idx`) ---------
    cons = frappe.db.sql(f"""
        SELECT 
            ct.parent as doc,
            ct.item_name,
            ct.quantity,
            ct.idx
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch ON ct.parent = ch.name
        WHERE 1=1 {conditions}
        ORDER BY ct.idx
    """, params, as_dict=True)

    # -------- Pivot + maintain order dynamically ---------
    consumption_map = {}
    item_order = []

    for r in cons:
        item = r.item_name.replace(" ", "_")

        if item not in item_order:
            item_order.append(item)

        consumption_map.setdefault(r.doc, {})[item] = r.quantity

    for d in details:
        d.update(consumption_map.get(d.name, {}))

    return {"rows": details, "item_order": item_order}




