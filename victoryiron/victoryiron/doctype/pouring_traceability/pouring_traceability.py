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

    def on_cancel(self):
        self.restore_available_qty_in_mould_batch()

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