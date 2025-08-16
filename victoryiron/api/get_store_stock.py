

import frappe
from frappe import _

@frappe.whitelist()
def get_store_stock(item_name):
    if not item_name:
        return 0

    warehouse_name = "Stores - VIW"  # exact warehouse name
    
    # Get actual stock quantity for the item in the specified warehouse
    # Using frappe.db.get_value or frappe.get_all from Bin doctype
    
    bin_doc = frappe.db.get_value("Bin",
                                  {"item_code": item_name, "warehouse": warehouse_name},
                                  "actual_qty")
    
    if bin_doc is None:
        # No stock found, return 0
        return 0
    
    return bin_doc
