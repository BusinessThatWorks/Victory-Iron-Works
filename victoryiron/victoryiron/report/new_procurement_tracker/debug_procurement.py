#!/usr/bin/env python3
"""
Debug script for Procurement Tracker Report
This script helps identify why certain sections are blank
"""

import frappe


def debug_procurement_data():
	"""Debug function to check data availability"""

	print("=== PROCUREMENT TRACKER DEBUG ===\n")

	# Check Material Requests
	mr_count = frappe.db.count("Material Request", {"docstatus": 1})
	print(f"1. Material Requests (Submitted): {mr_count}")

	if mr_count > 0:
		# Get sample MR
		sample_mr = frappe.db.get_value("Material Request", {"docstatus": 1}, "name")
		print(f"   Sample MR: {sample_mr}")

		# Check MR Items
		mr_items = frappe.db.count("Material Request Item", {"parent": sample_mr})
		print(f"   MR Items in sample: {mr_items}")

	# Check Purchase Orders
	po_count = frappe.db.count("Purchase Order", {"docstatus": 1})
	print(f"\n2. Purchase Orders (Submitted): {po_count}")

	if po_count > 0:
		# Check PO Items with MR reference
		po_items_with_mr = frappe.db.sql(
			"""
            SELECT COUNT(*) as count 
            FROM `tabPurchase Order Item` poi
            JOIN `tabPurchase Order` po ON po.name = poi.parent
            WHERE po.docstatus = 1 AND poi.material_request_item IS NOT NULL
        """,
			as_dict=True,
		)
		print(f"   PO Items with MR reference: {po_items_with_mr[0].count}")

	# Check Purchase Receipts
	pr_count = frappe.db.count("Purchase Receipt", {"docstatus": 1})
	print(f"\n3. Purchase Receipts (Submitted): {pr_count}")

	if pr_count > 0:
		# Check PR Items with PO reference
		pr_items_with_po = frappe.db.sql(
			"""
            SELECT COUNT(*) as count 
            FROM `tabPurchase Receipt Item` pri
            JOIN `tabPurchase Receipt` pr ON pr.name = pri.parent
            WHERE pr.docstatus = 1 AND pri.purchase_order_item IS NOT NULL
        """,
			as_dict=True,
		)
		print(f"   PR Items with PO reference: {pr_items_with_po[0].count}")

	# Check Purchase Invoices
	pi_count = frappe.db.count("Purchase Invoice", {"docstatus": 1})
	print(f"\n4. Purchase Invoices (Submitted): {pi_count}")

	if pi_count > 0:
		# Check PI Items with PO reference
		pi_items_with_po = frappe.db.sql(
			"""
            SELECT COUNT(*) as count 
            FROM `tabPurchase Invoice Item` pii
            JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
            WHERE pi.docstatus = 1 AND pii.purchase_order IS NOT NULL
        """,
			as_dict=True,
		)
		print(f"   PI Items with PO reference: {pi_items_with_po[0].count}")

	# Test the actual query
	print(f"\n5. Testing actual report query:")
	test_filters = {"from_date": "2024-01-01", "to_date": "2025-12-31"}

	try:
		from new_procurement_tracker import get_data

		data = get_data(test_filters)
		print(f"   Query returned {len(data)} records")

		if data:
			# Show sample record
			sample = data[0]
			print(f"   Sample record keys: {list(sample.keys())}")
			print(f"   Sample MR: {sample.get('material_request')}")
			print(f"   Sample PO: {sample.get('purchase_order')}")
			print(f"   Sample PR: {sample.get('purchase_receipt')}")
			print(f"   Sample PI: {sample.get('purchase_invoice')}")

	except Exception as e:
		print(f"   Error in query: {str(e)}")

	print(f"\n=== END DEBUG ===")


if __name__ == "__main__":
	debug_procurement_data()


