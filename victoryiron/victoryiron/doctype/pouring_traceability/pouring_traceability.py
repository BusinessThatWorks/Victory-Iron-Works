# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PouringTraceability(Document):

    def validate(self):
        self.calculate_child_values()
        self.validate_pouring_range()
        self.validate_available_quantity()
        self.calculate_totals()

    def on_submit(self):
        self.update_available_qty_in_mould_batch()
        self.create_stock_entry()

    def on_cancel(self):
        self.restore_available_qty_in_mould_batch()
        self.cancel_linked_stock_entry()  # <-- ADD THIS LINE

    # ========================
    # STOCK ENTRY CREATION - NEW METHODS
    # ========================

    def create_stock_entry(self):
        """Create Stock Entry on submit with items from pouring traceability"""
        
        stock_entry = frappe.new_doc("Stock Entry")
        stock_entry.stock_entry_type = "Pouring"
        stock_entry.custom_pouring_id = self.name
        
        items_added = False
        
        for row in self.pouring_traceability:
            if not row.mould_batch_id or not row.poured_quantity:
                continue
            
            # Get item details from the chain
            item_details = self.get_item_details_for_stock_entry(row)
            
            if not item_details:
                frappe.throw(
                    f"Row #{row.idx}: Could not find Item Code for '{row.item_name}'. "
                    f"Please check Production Tooling and Pattern Manufacturing setup."
                )
            
            for item in item_details:
                if not item.get("item_code"):
                    frappe.throw(
                        f"Row #{row.idx}: Item Code not found in Pattern Manufacturing. "
                        f"Please check the setup."
                    )
                
                stock_entry.append("items", {
                    "t_warehouse": "Pouring - VI",
                    "item_code": item.get("item_code"),
                    "qty": (row.poured_quantity or 0) * (item.get("cavity") or 1),
                    "custom_pouring_id": self.name,
                    "custom_item_cast_weight": row.cast_weight or 0,
                    "custom_item_bunch_weight": row.bunch_weight or 0,
                })
                items_added = True
        
        if not items_added:
            frappe.throw(
                "No valid items found to create Stock Entry. "
                "Please check Mould Batch and Item details."
            )
        
        # Insert and Submit - if fails, exception will rollback everything
        stock_entry.insert()
        stock_entry.submit()
        
        # Save Stock Entry ID in Pouring Traceability
        self.db_set("stock_entry_id", stock_entry.name, update_modified=False)
        
        frappe.msgprint(
            f"Stock Entry <b><a href='/app/stock-entry/{stock_entry.name}'>{stock_entry.name}</a></b> created successfully!",
            alert=True,
            indicator="green"
        )

    def get_item_details_for_stock_entry(self, row):
        """
        Get Item Code and Cavity from the chain:
        Mould Batch → Production Tooling → Pattern Manufacturing
        """
        items = []
        
        if not row.item_name:
            return items
        
        # row.item_name is Production Tooling link
        production_tooling_name = row.item_name
        
        # Check if Production Tooling exists
        if not frappe.db.exists("Production Tooling", production_tooling_name):
            frappe.throw(
                f"Row #{row.idx}: Production Tooling '{production_tooling_name}' not found. "
                f"Please check the Item Name."
            )
        
        prod_tooling = frappe.get_doc("Production Tooling", production_tooling_name)
        
        # Check if Pattern Item Details table has data
        if not prod_tooling.table_mfno:
            frappe.throw(
                f"Row #{row.idx}: Production Tooling '{production_tooling_name}' has no Pattern Item Details. "
                f"Please add Pattern details in Production Tooling."
            )
        
        # Loop through Pattern Item Details table (table_mfno)
        for pattern_row in prod_tooling.table_mfno:
            pattern_id_name = pattern_row.item_name  # Link to Pattern Manufacturing
            cavity = pattern_row.cavity or 1
            
            if not pattern_id_name:
                frappe.throw(
                    f"Row #{row.idx}: Pattern ID Name is missing in Production Tooling '{production_tooling_name}'. "
                    f"Please check Pattern Item Details table."
                )
            
            # Check if Pattern Manufacturing exists
            if not frappe.db.exists("Pattern Manufacturing", pattern_id_name):
                frappe.throw(
                    f"Row #{row.idx}: Pattern Manufacturing '{pattern_id_name}' not found. "
                    f"Please check the Pattern ID Name in Production Tooling."
                )
            
            # Get Item Code from Pattern Manufacturing
            item_code = frappe.db.get_value(
                "Pattern Manufacturing", 
                pattern_id_name, 
                "item_name"
            )
            
            if not item_code:
                frappe.throw(
                    f"Row #{row.idx}: Item Code (item_name) is empty in Pattern Manufacturing '{pattern_id_name}'. "
                    f"Please add Item Code in Pattern Manufacturing."
                )
            
            # Validate Item Code exists in Item master
            if not frappe.db.exists("Item", item_code):
                frappe.throw(
                    f"Row #{row.idx}: Item '{item_code}' does not exist in Item Master. "
                    f"Please create the Item first."
                )
            
            items.append({
                "item_code": item_code,
                "cavity": cavity
            })
        
        return items

    def cancel_linked_stock_entry(self):
        """Cancel linked Stock Entry when Pouring Traceability is cancelled"""
        
        # First check from the field
        if self.stock_entry_id:
            try:
                if frappe.db.exists("Stock Entry", self.stock_entry_id):
                    stock_entry_doc = frappe.get_doc("Stock Entry", self.stock_entry_id)
                    if stock_entry_doc.docstatus == 1:  # Only if submitted
                        stock_entry_doc.cancel()
                        frappe.msgprint(
                            f"Stock Entry <b>{self.stock_entry_id}</b> cancelled",
                            alert=True,
                            indicator="blue"
                        )
            except Exception as e:
                frappe.log_error(
                    f"Error cancelling Stock Entry {self.stock_entry_id}: {str(e)}",
                    "Stock Entry Cancel Error"
                )
                frappe.throw(
                    f"Could not cancel Stock Entry {self.stock_entry_id}: {str(e)}<br><br>"
                    f"Please cancel it manually first."
                )
            return
        
        # Fallback: Find Stock Entries linked to this Pouring Traceability
        stock_entries = frappe.get_all(
            "Stock Entry",
            filters={
                "custom_pouring_id": self.name,
                "docstatus": 1  # Only submitted ones
            },
            fields=["name"]
        )
        
        for se in stock_entries:
            try:
                stock_entry_doc = frappe.get_doc("Stock Entry", se.name)
                stock_entry_doc.cancel()
                frappe.msgprint(
                    f"Stock Entry <b>{se.name}</b> cancelled",
                    alert=True,
                    indicator="blue"
                )
            except Exception as e:
                frappe.log_error(
                    f"Error cancelling Stock Entry {se.name}: {str(e)}",
                    "Stock Entry Cancel Error"
                )
                frappe.throw(
                    f"Could not cancel Stock Entry {se.name}: {str(e)}<br><br>"
                    f"Please cancel it manually first."
                )
                
    def calculate_child_values(self):
        for row in self.pouring_traceability:
            if row.box_poured_from and row.box_poured_till:
                row.poured_quantity = abs(row.box_poured_till - row.box_poured_from) + 1
            else:
                row.poured_quantity = 0

            poured_qty = row.poured_quantity or 0
            row.total_cast_weight = (row.cast_weight or 0) * poured_qty
            row.total_bunch_weight = (row.bunch_weight or 0) * poured_qty

    def validate_pouring_range(self):
        for row in self.pouring_traceability:
            if not row.box_poured_from and not row.box_poured_till:
                continue
                
            if row.box_poured_from == 0 and row.box_poured_till == 0:
                continue

            box_from = row.box_created_from or 0
            box_to = row.box_created_to or 0

            if box_from == 0 and box_to == 0:
                continue

            range_min = min(box_from, box_to)
            range_max = max(box_from, box_to)

            poured_from = row.box_poured_from or 0
            poured_till = row.box_poured_till or 0

            if poured_from and (poured_from < range_min or poured_from > range_max):
                frappe.throw(
                    f"Row #{row.idx}: Box Poured From ({poured_from}) must be between {range_min} and {range_max}"
                )

            if poured_till and (poured_till < range_min or poured_till > range_max):
                frappe.throw(
                    f"Row #{row.idx}: Box Poured To ({poured_till}) must be between {range_min} and {range_max}"
                )

    def validate_available_quantity(self):
        """Validate poured quantity against available quantity from MHM"""
        # Group by batch, system, item, start_no, end_no (UNIQUE KEY)
        poured_map = {}
        
        for row in self.pouring_traceability:
            if not row.poured_quantity or row.poured_quantity == 0:
                continue
                
            if not row.mould_batch_id or not row.item_name:
                continue

            # UNIQUE KEY: includes start_no and end_no
            key = (
                row.mould_batch_id, 
                row.moulding_system or "", 
                row.item_name,
                row.box_created_from or 0,
                row.box_created_to or 0
            )
            
            if key not in poured_map:
                poured_map[key] = {
                    "total_poured": 0,
                    "rows": []
                }
            
            poured_map[key]["total_poured"] += row.poured_quantity
            poured_map[key]["rows"].append(row.idx)

        # Validate against MHM available_qty
        for (batch_id, moulding_system, item_name, start_no, end_no), data in poured_map.items():
            available = self.get_available_qty_from_mhm(batch_id, moulding_system, item_name, start_no, end_no)
            
            if data["total_poured"] > available:
                rows_str = ", ".join([str(r) for r in data["rows"]])
                frappe.throw(
                    f"Rows #{rows_str}: Total poured quantity ({data['total_poured']}) for item '{item_name}' "
                    f"(Range: {start_no}-{end_no}) exceeds available quantity ({available})"
                )

    def get_available_qty_from_mhm(self, batch_id, moulding_system, item_name, start_no, end_no):
        """Get available qty from Machine and Hand Mould Table - EXACT ROW MATCH"""
        filters = {
            "parent": batch_id,
            "item_name1": item_name,
            "start_no": start_no,
            "end_no": end_no,
        }
        
        if moulding_system:
            filters["machine_mould"] = moulding_system

        result = frappe.get_all(
            "Machine And Hand Mould Table",
            filters=filters,
            fields=["available_qty"],
            limit=1,
        )

        if result:
            return result[0].available_qty or 0
        return 0

    def calculate_totals(self):
        total_cast = 0
        total_bunch = 0

        for row in self.pouring_traceability:
            total_cast += row.total_cast_weight or 0
            total_bunch += row.total_bunch_weight or 0

        self.total_cast_weight = total_cast
        self.total_bunch_weight = total_bunch

    def update_available_qty_in_mould_batch(self):
        """Reduce available_qty in Machine and Hand Mould on submit"""
        updates = {}

        for row in self.pouring_traceability:
            if not row.mould_batch_id or not row.item_name:
                continue
            if not row.poured_quantity or row.poured_quantity == 0:
                continue

            # UNIQUE KEY: includes start_no and end_no
            key = (
                row.mould_batch_id, 
                row.moulding_system or "", 
                row.item_name,
                row.box_created_from or 0,
                row.box_created_to or 0
            )
            
            if key not in updates:
                updates[key] = 0
            
            updates[key] += row.poured_quantity

        for (batch_id, moulding_system, item_name, start_no, end_no), poured_qty in updates.items():
            self.reduce_available_qty(batch_id, moulding_system, item_name, start_no, end_no, poured_qty)

    def restore_available_qty_in_mould_batch(self):
        """Restore available_qty in Machine and Hand Mould on cancel"""
        updates = {}

        for row in self.pouring_traceability:
            if not row.mould_batch_id or not row.item_name:
                continue
            if not row.poured_quantity or row.poured_quantity == 0:
                continue

            key = (
                row.mould_batch_id, 
                row.moulding_system or "", 
                row.item_name,
                row.box_created_from or 0,
                row.box_created_to or 0
            )
            
            if key not in updates:
                updates[key] = 0
            
            updates[key] += row.poured_quantity

        for (batch_id, moulding_system, item_name, start_no, end_no), poured_qty in updates.items():
            self.increase_available_qty(batch_id, moulding_system, item_name, start_no, end_no, poured_qty)

    def reduce_available_qty(self, batch_id, moulding_system, item_name, start_no, end_no, poured_qty):
        """Reduce available qty in child table - EXACT ROW MATCH"""
        filters = {
            "parent": batch_id,
            "item_name1": item_name,
            "start_no": start_no,
            "end_no": end_no,
        }
        
        if moulding_system:
            filters["machine_mould"] = moulding_system

        child_rows = frappe.get_all(
            "Machine And Hand Mould Table",
            filters=filters,
            fields=["name", "available_qty"],
        )

        for child in child_rows:
            new_qty = (child.available_qty or 0) - poured_qty
            new_qty = max(0, new_qty)

            frappe.db.set_value(
                "Machine And Hand Mould Table",
                child.name,
                "available_qty",
                new_qty,
                update_modified=False
            )

        frappe.db.commit()

    def increase_available_qty(self, batch_id, moulding_system, item_name, start_no, end_no, poured_qty):
        """Restore available qty on cancel - EXACT ROW MATCH"""
        filters = {
            "parent": batch_id,
            "item_name1": item_name,
            "start_no": start_no,
            "end_no": end_no,
        }
        
        if moulding_system:
            filters["machine_mould"] = moulding_system

        child_rows = frappe.get_all(
            "Machine And Hand Mould Table",
            filters=filters,
            fields=["name", "available_qty", "total_good_mould_qty"],
        )

        for child in child_rows:
            max_qty = child.total_good_mould_qty or 0
            new_qty = (child.available_qty or 0) + poured_qty
            new_qty = min(new_qty, max_qty)

            frappe.db.set_value(
                "Machine And Hand Mould Table",
                child.name,
                "available_qty",
                new_qty,
                update_modified=False
            )

        frappe.db.commit()


# ========================
# API METHODS
# ========================

@frappe.whitelist()
def get_moulding_systems_from_batch(mould_batch_id):
    if not mould_batch_id:
        return []

    systems = frappe.get_all(
        "Machine And Hand Mould Table",
        filters={"parent": mould_batch_id},
        fields=["machine_mould"],
        distinct=True,
    )

    return [s.machine_mould for s in systems if s.machine_mould]


@frappe.whitelist()
def get_items_from_mould_batch(mould_batch_id, moulding_system=None):
    if not mould_batch_id:
        return []

    filters = {"parent": mould_batch_id}

    if moulding_system:
        filters["machine_mould"] = moulding_system

    items = frappe.get_all(
        "Machine And Hand Mould Table",
        filters=filters,
        fields=[
            "item_name1 as item_name",
            "start_no",
            "end_no",
            "cast_weight",
            "bunch_weight",
            "available_qty",
        ],
    )

    return items


@frappe.whitelist()
def get_item_details(mould_batch_id, moulding_system, item_name, start_no=None, end_no=None):
    if not mould_batch_id or not item_name:
        return {}

    filters = {
        "parent": mould_batch_id,
        "item_name1": item_name,
    }

    if moulding_system:
        filters["machine_mould"] = moulding_system
    
    if start_no is not None:
        filters["start_no"] = start_no
    
    if end_no is not None:
        filters["end_no"] = end_no

    item_row = frappe.get_all(
        "Machine And Hand Mould Table",
        filters=filters,
        fields=[
            "start_no",
            "end_no",
            "cast_weight",
            "bunch_weight",
            "available_qty",
        ],
        limit=1,
    )

    if item_row:
        return item_row[0]

    return {}