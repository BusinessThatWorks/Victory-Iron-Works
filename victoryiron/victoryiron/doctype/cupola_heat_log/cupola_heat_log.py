# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt



class CupolaHeatlog(Document):
	pass

@frappe.whitelist()
def get_cupola_consumption_items():
	item_names = [
		"Hard Coke",
		"Flux Lime Stone",
		"Sand Pig Iron",
		"Pig Iron",
		"DS BLOCK",
		"Ferro Manganese",
		"Ferro Silicon",
		"CI Foundry Return",
		"DI Foundry Return",
		"MS Scrap",
		"MS CI Scrap",
		"Mould Box Scrap"
	]

	items = frappe.get_all(
		"Item",
		filters={"name": ["in", item_names]},
		fields=["name", "stock_uom", "valuation_rate"]
	)

	# 🔥 preserve order as per item_names
	item_map = {item["name"]: item for item in items}
	ordered_items = [item_map[name] for name in item_names if name in item_map]

	return ordered_items

@frappe.whitelist()
def get_day_total_charge(date):
    if not date:
        return 0

    result = frappe.db.sql("""
        SELECT
            SUM(total_charge_mix_quantity) AS total_qty
        FROM
            `tabCupola Heat log`
        WHERE
            date = %s
    """, (date,), as_dict=True)

    return flt(result[0].total_qty) if result and result[0].total_qty else 0

@frappe.whitelist()
def get_coke_metal_ratio(date):
    if not date:
        return 0

    # 1️⃣ Total Metallic Charge
    metal = frappe.db.sql("""
        SELECT SUM(total_charge_mix_quantity)
        FROM `tabCupola Heat log`
        WHERE date = %s
    """, (date,))[0][0] or 0

    # 2️⃣ Total Hard Coke from child table
    coke = frappe.db.sql("""
        SELECT SUM(ct.quantity)
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch
            ON ct.parent = ch.name
        WHERE
            ch.date = %s
            AND ct.item_name = 'Hard Coke'
    """, (date,))[0][0] or 0

    metal = flt(metal)
    coke = flt(coke)

    if coke == 0:
        return 0

    ratio = metal / coke
    return round(ratio, 2)


@frappe.whitelist()
def get_flux_metal_ratio(date):
    if not date:
        return 0

    # Total Hard Coke (numerator)
    hard_coke = frappe.db.sql("""
        SELECT SUM(ct.quantity)
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch
            ON ct.parent = ch.name
        WHERE
            ch.date = %s
            AND ct.item_name = 'Hard Coke'
    """, (date,))[0][0] or 0

    # Total Flux Lime Stone (denominator)
    flux = frappe.db.sql("""
        SELECT SUM(ct.quantity)
        FROM `tabConsumption Table` ct
        INNER JOIN `tabCupola Heat log` ch
            ON ct.parent = ch.name
        WHERE
            ch.date = %s
            AND ct.item_name = 'Flux Lime Stone'
    """, (date,))[0][0] or 0

    hard_coke = flt(hard_coke)
    flux = flt(flux)

    if flux == 0:
        return 0

    ratio = hard_coke / flux
    return round(ratio, 2)

