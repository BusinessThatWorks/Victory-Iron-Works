import frappe

# ----------------------- 1️⃣ DETAILS TAB -------------------------
@frappe.whitelist()
def get_cupola_details(from_date=None, to_date=None):
    query = """
        SELECT
            name, date, charge_no, grade, time, cupola_temp, temp_time,
            total_charge_mix_calculation, coke_type, total_quantity
        FROM `tabCupola Heat log`
        WHERE 1=1
    """

    if from_date and to_date:
        query += " AND date BETWEEN %s AND %s"
        result = frappe.db.sql(query, (from_date, to_date), as_dict=True)
    else:
        result = frappe.db.sql(query, as_dict=True)

    return result


# ----------------------- 2️⃣ FIRING / PREP TAB --------------------
@frappe.whitelist()
def get_cupola_firingprep(from_date=None, to_date=None):
    query = """
        SELECT
            name, date,
            start AS ignition_start_time,
            end AS ignition_end_time,
            light_up, metal_out_at, blower_on_for_melting, cupola_drop_at,
            melting AS coke_metal_ratio,
            lime_stone AS coke_limestone_ratio,
            total_melting_hours,
            total_melting_hours_metal_out,
            average_melting_rate,
            average_melting_rate_metal_out,
            fire_bricks, fire_wood, steam_coal
        FROM `tabCupola Heat log`
        WHERE 1=1
    """

    if from_date and to_date:
        query += " AND date BETWEEN %s AND %s"
        result = frappe.db.sql(query, (from_date, to_date), as_dict=True)
    else:
        result = frappe.db.sql(query, as_dict=True)

    return result


# ----------------------- 3️⃣ CONSUMPTION TAB ---------------------
@frappe.whitelist()
def get_cupola_consumption(from_date=None,to_date=None):
    conditions = ""
    params = []

    if from_date and to_date:
        conditions = " AND ch.date BETWEEN %s AND %s"
        params = [from_date,to_date]

    data = frappe.db.sql(f"""
        SELECT 
            ch.name as parent,
            ch.date,
            ct.item_name,
            ct.quantity,
            ct.uom,
            ct.valuation_rate,
            ct.total_valuation
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch
            ON ct.parent = ch.name
        WHERE 1=1 {conditions}
        ORDER BY ch.date, ct.idx
    """, params, as_dict=True)

    return data
