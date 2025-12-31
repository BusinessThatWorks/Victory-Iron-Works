# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class HoldingFurnaceHeat(Document):
	pass


@frappe.whitelist()
def get_ladle_metal_ids(date, source="Cupola"):
	"""
	Get all Ladle Metal docs where date matches and source matches.

	Args:
	    date:   Date string to filter by (YYYY-MM-DD)
	    source: Source to filter by (e.g. 'Cupola', 'Holding Furnace')

	Returns:
	    List of dicts with: name, total_weight_in_kg, start_time, end_time, ladle_type, grade_type
	"""
	filters = {"date": date}
	if source:
		filters["source"] = source

	ladle_metal_docs = frappe.get_all(
		"Ladle Metal",
		filters=filters,
		fields=["name", "total_weight_in_kg", "start_time", "end_time", "ladle_type", "grade_type"],
		order_by="name",
	)

	return ladle_metal_docs


@frappe.whitelist()
def get_furnace_bath_ids(date, sample_type=None):
	"""
	Get Furnace Bath document IDs where date matches and optionally filter by sample_type.

	Args:
	    date: Date string to filter by (YYYY-MM-DD)
	    sample_type: Optional sample_type filter (e.g. 'Bath', 'Treatment')

	Returns:
	    List of Furnace Bath document names (IDs)
	"""
	filters = {"date": date}
	if sample_type:
		filters["sample_type"] = sample_type

	furnace_bath_docs = frappe.get_all(
		"Furnace Bath",
		filters=filters,
		fields=["name"],
		order_by="name",
	)

	# Return list of IDs
	return [doc.name for doc in furnace_bath_docs]

# //ladle metal totals

@frappe.whitelist()
def get_ladle_totals(date=None):
    if not date:
        return {"punching":0, "inoculant":0, "fesimg":0}

    data = frappe.db.sql("""
        SELECT 
            SUM(punching) AS punching,
            SUM(inoculant) AS inoculant,
            SUM(fesimg) AS fesimg
        FROM `tabLadle Metal`
        WHERE date = %s
    """, (date,), as_dict=True)

    return data[0] if data else {"punching":0, "inoculant":0, "fesimg":0}

