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
def get_cupola_consumption_summary(from_date=None, to_date=None):
    raw_conditions = ""
    totals_conditions = ""
    params = []

    if from_date and to_date:
        raw_conditions = " AND ch.date BETWEEN %s AND %s"
        totals_conditions = " AND `date` BETWEEN %s AND %s"
        params = [from_date, to_date]

    # -------- Consumption grouped item-wise --------
    raw = frappe.db.sql(f"""
        SELECT 
            ch.date,
            ct.item_name,
            SUM(ct.quantity) as qty,
            MIN(ct.idx) as idx
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch ON ct.parent = ch.name
        WHERE 1=1 {raw_conditions}
        GROUP BY ch.date, ct.item_name
        ORDER BY ch.date
    """, params, as_dict=True)

    # -------- Get total_charge_mix_quantity per date --------
    totals = frappe.db.sql(f"""
        SELECT 
            date,
            SUM(total_charge_mix_quantity) AS total_qty
        FROM `tabCupola Heat log`
        WHERE 1=1 {totals_conditions} AND firingprep_details = 0
        GROUP BY date
        ORDER BY date
    """, params, as_dict=True)

    total_map = {str(t.date): t.total_qty for t in totals}

    # -------- Item order by idx --------
    item_order_query = frappe.db.sql(f"""
        SELECT DISTINCT ct.item_name, MIN(ct.idx) as idx
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch ON ct.parent = ch.name
        WHERE 1=1 {raw_conditions}
        GROUP BY ct.item_name
        ORDER BY idx
    """, params, as_dict=True)

    ordered_items = [i.item_name.replace(" ", "_") for i in item_order_query]

    # -------- Structure output rows --------
    summary = {}
    for r in raw:
        date = str(r.date)
        item = r.item_name.replace(" ", "_")
        summary.setdefault(date, {"date": date})
        summary[date][item] = r.qty

    final = []
    for date, row in summary.items():
        out = {"date": date, "total_qty": total_map.get(date, 0)}
        for item in ordered_items:
            out[item] = row.get(item, 0)
        final.append(out)

    return {"rows": final, "item_order": ordered_items}




@frappe.whitelist()
def get_cupola_details_with_consumption(from_date=None, to_date=None):
    conditions = " AND ch.firingprep_details = 0"
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
            total_charge_mix_calculation,
            CONCAT(DATE(ch.date), '-', LPAD(ch.charge_no, 4, '0')) as heat_id_sort
        FROM `tabCupola Heat log` ch
        WHERE 1=1 {conditions}
        ORDER BY heat_id_sort ASC
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





