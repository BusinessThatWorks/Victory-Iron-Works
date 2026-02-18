import frappe

@frappe.whitelist()
def get_holding_furnace_dashboard(from_date=None, to_date=None):

    filters = {}
    if from_date and to_date:
        filters["date"] = ["between", [from_date, to_date]]

    # -------------------------
    # Parent rows
    # -------------------------
    rows = frappe.get_all(
        "Holding Furnace Heat",
        filters=filters,
        fields=[
            "name",
            "date",
            "furnace_lining_noid",
            "total_metal_recieved",
            "total_metal_discharged",
            "total_units",
            "carbon_in_kg",
            "fe_silicon_in_kg",
            "crc_in_kg",
            "fe_mn_in_kg",
            "furnace_unit",
            "cooling_tower",
            "fesimg",
            "inoculant",
            "punching",
        ],
        order_by="date desc",
        limit=100
    )

    parent_names = [r.name for r in rows]

    # -------------------------
    # Child table rows
    # -------------------------
    ladle_child_rows = []
    ladle_rows = []

    if parent_names:
        ladle_child_rows = frappe.get_all(
            "Metal Discharge From Holding Furnace",   # table_ibpu doctype
            filters={
                "parent": ["in", parent_names],
                "parenttype": "Holding Furnace Heat"
            },
            fields=["parent", "ladle_metal_id"]
        )

    ladle_ids = list({r.ladle_metal_id for r in ladle_child_rows if r.ladle_metal_id})

    # -------------------------
    # Linked Ladle Metal data
    # -------------------------
    ladle_map = {}

    if ladle_ids:
        ladles = frappe.get_all(
            "Ladle Metal",
            filters={"name": ["in", ladle_ids]},
            fields=[
                "name",
                "grade_type",
                "ladle_id",
                "treatment_before_temp",
                "start_time",
                "total_weight_in_kg",
                "fesimg",
                "inoculant",
                "punching",
                "facture_test",
                "destination"
            ]
        )
        ladle_map = {l.name: l for l in ladles}

    # -------------------------
    # Merge row-wise
    # -------------------------
    for c in ladle_child_rows:
        lm = ladle_map.get(c.ladle_metal_id)
        if not lm:
            continue

        ladle_rows.append({
            "ladle_name": lm.name,
            "grade_type": lm.grade_type,
            "ladle_id": lm.ladle_id,
            "treatment_before_temp": lm.treatment_before_temp,
            "start_time": lm.start_time,
            "total_weight_in_kg": lm.total_weight_in_kg,
            "fesimg": lm.fesimg,
            "inoculant": lm.inoculant,
            "punching": lm.punching,
            "facture_test": lm.facture_test,
            "destination": lm.destination,
        })

    # -------------------------
    # discharge count
    # -------------------------
    discharge_count = len(ladle_child_rows)

    return {
        "rows": rows,
        "ladle_rows": ladle_rows,   # ✅ NEW TABLE DATA
        "summary": {
            "metal_in": sum(r.total_metal_recieved or 0 for r in rows),
            "metal_out": sum(r.total_metal_discharged or 0 for r in rows),
            "furnace_unit_total": sum(r.furnace_unit or 0 for r in rows),
            "cooling_tower_total": sum(r.cooling_tower or 0 for r in rows),
            "discharge_count": discharge_count,
            "count": len(rows),
            "carbon_total": sum(r.carbon_in_kg or 0 for r in rows),
            "fesi_total": sum(r.fe_silicon_in_kg or 0 for r in rows),
            "crc_total": sum(r.crc_in_kg or 0 for r in rows),
            "femn_total": sum(r.fe_mn_in_kg or 0 for r in rows),
            "fesimg_total": sum(r.fesimg or 0 for r in rows),
            "inoculant_total": sum(r.inoculant or 0 for r in rows),
            "punching_total": sum(r.punching or 0 for r in rows),
        }
    }


