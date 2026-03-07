# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PouringTraceability(Document):

    def validate(self):
        self.calculate_child_values()
        self.validate_pouring_range()
        self.calculate_totals()

    def on_update(self):
        self.update_mould_batch_traceability()

    def calculate_child_values(self):
        for row in self.pouring_traceability:
            # Calculate poured quantity
            if row.box_poured_from and row.box_poured_till:
                if row.box_poured_till < row.box_poured_from:
                    frappe.throw(f"Row #{row.idx}: Box Poured To cannot be less than Box Poured From")
                row.poured_quantity = row.box_poured_till - row.box_poured_from + 1
            else:
                row.poured_quantity = 0

            # Calculate weights
            poured_qty = row.poured_quantity or 0
            row.total_cast_weight = (row.cast_weight or 0) * poured_qty
            row.total_bunch_weight = (row.bunch_weight or 0) * poured_qty

    def validate_pouring_range(self):
        for row in self.pouring_traceability:
            if not row.box_poured_from or not row.box_poured_till:
                continue

            box_from = row.box_created_from or 0
            box_to = row.box_created_to or 0

            if row.box_poured_from < box_from or row.box_poured_from > box_to:
                frappe.throw(
                    f"Row #{row.idx}: Box Poured From ({row.box_poured_from}) must be between {box_from} and {box_to}"
                )

            if row.box_poured_till < box_from or row.box_poured_till > box_to:
                frappe.throw(
                    f"Row #{row.idx}: Box Poured To ({row.box_poured_till}) must be between {box_from} and {box_to}"
                )

    def calculate_totals(self):
        total_cast = 0
        total_bunch = 0

        for row in self.pouring_traceability:
            total_cast += row.total_cast_weight or 0
            total_bunch += row.total_bunch_weight or 0

        self.total_cast_weight = total_cast
        self.total_bunch_weight = total_bunch

    def update_mould_batch_traceability(self):
        # Group rows by mould_batch_id
        batch_updates = {}

        for row in self.pouring_traceability:
            if not row.mould_batch_id or not row.item_name:
                continue
            if not row.box_poured_from or not row.box_poured_till:
                continue

            batch_id = row.mould_batch_id
            if batch_id not in batch_updates:
                batch_updates[batch_id] = []

            batch_updates[batch_id].append({
                "pouring_id": self.name,
                "treatment_id": row.treatment_no,
                "item_name": row.item_name,
                "box_poured_from": row.box_poured_from,
                "box_poured_to": row.box_poured_till,
                "poured_quantity": row.poured_quantity,
            })

        # Update each Machine and Hand Mould document
        for batch_id, rows in batch_updates.items():
            self.update_single_mould_batch(batch_id, rows)

    def update_single_mould_batch(self, batch_id, rows):
        mhm_doc = frappe.get_doc("Machine and Hand Mould", batch_id)

        for row_data in rows:
            # Check if entry already exists
            existing = False
            for trace_row in mhm_doc.table_xjpq:
                if (
                    trace_row.pouring_id == row_data["pouring_id"]
                    and trace_row.item_name == row_data["item_name"]
                    and trace_row.box_poured_from == row_data["box_poured_from"]
                    and trace_row.box_poured_to == row_data["box_poured_to"]
                ):
                    existing = True
                    break

            if not existing:
                # Get original item qty
                original_qty = self.get_original_item_qty(batch_id, row_data["item_name"])

                # Calculate total poured for this item till now
                total_poured = self.get_total_poured_for_item(mhm_doc, row_data["item_name"])
                total_poured += row_data["poured_quantity"]

                remaining_qty = original_qty - total_poured

                mhm_doc.append("table_xjpq", {
                    "pouring_id": row_data["pouring_id"],
                    "treatment_id": row_data["treatment_id"],
                    "item_name": row_data["item_name"],
                    "box_poured_from": row_data["box_poured_from"],
                    "box_poured_to": row_data["box_poured_to"],
                    "available_quantity": max(0, remaining_qty),
                })

        mhm_doc.flags.ignore_permissions = True
        mhm_doc.flags.ignore_validate_update_after_submit = True
        mhm_doc.save()

    def get_original_item_qty(self, batch_id, item_name):
        item_row = frappe.get_all(
            "Machine And Hand Mould Table",
            filters={"parent": batch_id, "item_name1": item_name},
            fields=["total_good_mould_qty"],
            limit=1,
        )
        if item_row:
            return item_row[0].total_good_mould_qty or 0
        return 0

    def get_total_poured_for_item(self, mhm_doc, item_name):
        total = 0
        for trace_row in mhm_doc.table_xjpq:
            if trace_row.item_name == item_name:
                # Calculate from box range
                box_from = trace_row.box_poured_from or 0
                box_to = trace_row.box_poured_to or 0
                if box_to >= box_from:
                    total += (box_to - box_from + 1)
        return total


@frappe.whitelist()
def get_items_from_mould_batch(mould_batch_id):
    if not mould_batch_id:
        return []

    items = frappe.get_all(
        "Machine And Hand Mould Table",
        filters={"parent": mould_batch_id},
        fields=["item_name1"],
        distinct=True,
    )

    return [item.item_name1 for item in items if item.item_name1]


@frappe.whitelist()
def get_item_details_from_mould_batch(mould_batch_id, item_name):
    if not mould_batch_id or not item_name:
        return {}

    # Get original item details
    item_row = frappe.get_all(
        "Machine And Hand Mould Table",
        filters={"parent": mould_batch_id, "item_name1": item_name},
        fields=["start_no", "end_no", "cast_weight", "bunch_weight", "total_good_mould_qty"],
        limit=1,
    )

    if not item_row:
        return {}

    data = item_row[0]
    original_qty = data.get("total_good_mould_qty") or 0

    # Check Mould Batch Traceability for already poured
    traceability_rows = frappe.get_all(
        "Mould Batch Traceability",
        filters={"parent": mould_batch_id, "item_name": item_name},
        fields=["available_quantity", "box_poured_to"],
        order_by="idx desc",
        limit=1,
    )

    if traceability_rows:
        # Use last available quantity from traceability
        data["available_quantity"] = traceability_rows[0].available_quantity or 0
        data["last_poured_to"] = traceability_rows[0].box_poured_to or 0
    else:
        # First time — use original quantity
        data["available_quantity"] = original_qty
        data["last_poured_to"] = 0

    return data