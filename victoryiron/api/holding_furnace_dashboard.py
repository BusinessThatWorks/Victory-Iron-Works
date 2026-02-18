import frappe
import re

@frappe.whitelist()
def get_holding_furnace_dashboard(from_date=None, to_date=None):
    """
    Holding Furnace dashboard with ladle treatment data
    """
    filters = {}
    if from_date and to_date:
        filters["date"] = ["between", [from_date, to_date]]

    # Fetch parent records
    rows = frappe.get_all(
        "Holding Furnace Heat",
        filters=filters,
        fields=[
            "name", "date", "furnace_lining_noid",
            "total_metal_recieved", "total_metal_discharged", "total_units",
            "carbon_in_kg", "fe_silicon_in_kg", "crc_in_kg", "fe_mn_in_kg",
            "furnace_unit", "cooling_tower", "fesimg", "inoculant", "punching"
        ],
        order_by="date desc",
        limit=100
    )
    
    parent_names = [r.name for r in rows]
    if not parent_names:
        return _empty_response()

    # Fetch ladle discharge records
    ladle_child_rows = frappe.get_all(
        "Metal Discharge From Holding Furnace",
        filters={"parent": ["in", parent_names], "parenttype": "Holding Furnace Heat"},
        fields=["parent", "ladle_metal_id"]
    )
    
    ladle_ids = list({r.ladle_metal_id for r in ladle_child_rows if r.ladle_metal_id})
    
    # Fetch ladle metal data
    ladle_map = {}
    if ladle_ids:
        ladles = frappe.get_all(
            "Ladle Metal",
            filters={"name": ["in", ladle_ids]},
            fields=[
                "name", "grade_type", "ladle_id", "treatment_before_temp",
                "start_time", "total_weight_in_kg", "fesimg", "inoculant",
                "punching", "facture_test", "destination"
            ]
        )
        ladle_map = {l.name: l for l in ladles}

    # Fetch treatment logs
    treatment_child_rows = frappe.get_all(
        "Treatment Log",
        filters={"parent": ["in", parent_names], "parenttype": "Holding Furnace Heat"},
        fields=["parent", "treatment_id"]
    )
    
    treatment_ids = list({r.treatment_id for r in treatment_child_rows if r.treatment_id})
    
    # Fetch furnace bath chemical data
    furnace_bath_map = _build_furnace_bath_map(treatment_ids)
    
    # Build ladle rows with treatment data
    ladle_rows = _build_ladle_rows(ladle_child_rows, ladle_map, furnace_bath_map)
    
    return {
        "rows": rows,
        "ladle_rows": ladle_rows,
        "summary": _calculate_summary(rows, ladle_child_rows)
    }


def _build_furnace_bath_map(treatment_ids):
    """Build map of furnace bath data keyed by sample ID pattern"""
    if not treatment_ids:
        return {}
        
    furnace_baths = frappe.get_all(
        "Furnace Bath",
        filters={"name": ["in", treatment_ids]},
        fields=["name", "sample_id", "c", "cs", "perlite_", "si", "p", "ferrite_", "mn", "mg", "ce"]
    )
    
    furnace_bath_map = {}
    for fb in furnace_baths:
        if fb.sample_id:
            # Extract "13(K)" from "T-13(K)"
            match = re.search(r'T-(\d+\([A-Z]\))', fb.sample_id)
            if match:
                key = match.group(1)
                furnace_bath_map[key] = fb
    
    return furnace_bath_map


def _convert_ladle_to_key(ladle_id):
    """Convert K-13/L-6 → 13(K)"""
    if not ladle_id:
        return None
    
    first_part = ladle_id.split("/")[0] if "/" in ladle_id else ladle_id
    match = re.match(r'([A-Z])-(\d+)', first_part)
    
    if match:
        letter, number = match.group(1), match.group(2)
        return f"{number}({letter})"
    return None


def _build_ladle_rows(ladle_child_rows, ladle_map, furnace_bath_map):
    """Merge ladle data with treatment/furnace bath data"""
    ladle_rows = []
    
    for child in ladle_child_rows:
        lm = ladle_map.get(child.ladle_metal_id)
        if not lm:
            continue
        
        # Match treatment by ladle_id pattern
        match_key = _convert_ladle_to_key(lm.ladle_id)
        fb = furnace_bath_map.get(match_key) if match_key else None
        
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
            "treatment_id": fb.name if fb else None,
            "treatment_data": {
                "c": fb.c, "cs": fb.cs, "perlite_": fb.perlite_,
                "si": fb.si, "p": fb.p, "ferrite_": fb.ferrite_,
                "mn": fb.mn, "mg": fb.mg, "ce": fb.ce
            } if fb else None
        })
    
    return ladle_rows


def _calculate_summary(rows, ladle_child_rows):
    """Calculate aggregate KPIs"""
    return {
        "metal_in": sum(r.total_metal_recieved or 0 for r in rows),
        "metal_out": sum(r.total_metal_discharged or 0 for r in rows),
        "furnace_unit_total": sum(r.furnace_unit or 0 for r in rows),
        "cooling_tower_total": sum(r.cooling_tower or 0 for r in rows),
        "discharge_count": len(ladle_child_rows),
        "count": len(rows),
        "carbon_total": sum(r.carbon_in_kg or 0 for r in rows),
        "fesi_total": sum(r.fe_silicon_in_kg or 0 for r in rows),
        "crc_total": sum(r.crc_in_kg or 0 for r in rows),
        "femn_total": sum(r.fe_mn_in_kg or 0 for r in rows),
        "fesimg_total": sum(r.fesimg or 0 for r in rows),
        "inoculant_total": sum(r.inoculant or 0 for r in rows),
        "punching_total": sum(r.punching or 0 for r in rows),
    }


def _empty_response():
    """Return empty response when no data"""
    return {
        "rows": [],
        "ladle_rows": [],
        "summary": {k: 0 for k in [
            "metal_in", "metal_out", "furnace_unit_total", "cooling_tower_total",
            "discharge_count", "count", "carbon_total", "fesi_total", "crc_total",
            "femn_total", "fesimg_total", "inoculant_total", "punching_total"
        ]}
    }