# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PouringTraceability(Document):
    def validate(self):
        self.calculate_totals()

    def calculate_totals(self):
        total_cast = 0
        total_bunch = 0

        for row in self.pouring_traceability:
            total_cast += row.total_cast_weight or 0
            total_bunch += row.total_bunch_weight or 0

        self.total_cast_weight = total_cast
        self.total_bunch_weight = total_bunch


@frappe.whitelist()
def get_items_from_mould_batch(mould_batch_id):
    """
    Get list of items from Machine and Hand Mould child table
    """
    if not mould_batch_id:
        return []

    items = frappe.get_all(
        "Machine And Hand Mould Table",
        filters={"parent": mould_batch_id},
        fields=["item_name1"],
        distinct=True,
    )

    # Return unique item names
    return [item.item_name1 for item in items if item.item_name1]


@frappe.whitelist()
def get_item_details_from_mould_batch(mould_batch_id, item_name):
    """
    Get item details from Machine and Hand Mould child table
    """
    if not mould_batch_id or not item_name:
        return {}

    item_row = frappe.get_all(
        "Machine And Hand Mould Table",
        filters={
            "parent": mould_batch_id,
            "item_name1": item_name,
        },
        fields=[
            "start_no",
            "end_no",
            "total_cast_weight",
            "total_bunch_weight",
            "total_good_mould_qty",
        ],
        limit=1,
    )

    if item_row:
        return item_row[0]

    return {}