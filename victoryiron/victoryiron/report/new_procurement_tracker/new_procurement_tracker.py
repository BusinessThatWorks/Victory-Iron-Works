# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

# import frappe


# def execute(filters=None):
# 	columns, data = [], []
# 	return columns, data


import frappe


def execute(filters=None):
	filters = filters or {}

	columns = get_columns()
	data = get_data(filters)

	return columns, data


def get_columns():
	return [
		{
			"label": "Material Request",
			"fieldname": "material_request",
			"fieldtype": "Link",
			"options": "Material Request",
			"width": 150,
		},
		{"label": "Indent Date", "fieldname": "indent_date", "fieldtype": "Date", "width": 100},
		{"label": "MR Status", "fieldname": "mr_status", "fieldtype": "Data", "width": 100},
		{
			"label": "Item Code",
			"fieldname": "item_code",
			"fieldtype": "Link",
			"options": "Item",
			"width": 150,
		},
		{"label": "Item Name", "fieldname": "item_name", "fieldtype": "Data", "width": 180},
		{"label": "Requested Qty", "fieldname": "requested_qty", "fieldtype": "Float", "width": 120},
		{"label": "UOM", "fieldname": "uom", "fieldtype": "Link", "options": "UOM", "width": 80},
		{
			"label": "Purchase Order",
			"fieldname": "purchase_order",
			"fieldtype": "Link",
			"options": "Purchase Order",
			"width": 150,
		},
		{"label": "PO Status", "fieldname": "po_status", "fieldtype": "Data", "width": 100},
		{"label": "Ordered Qty", "fieldname": "ordered_qty", "fieldtype": "Float", "width": 120},
		{"label": "PO UOM", "fieldname": "po_uom", "fieldtype": "Link", "options": "UOM", "width": 80},
		{"label": "PO Rate", "fieldname": "po_rate", "fieldtype": "Currency", "width": 120},
		{"label": "Discount", "fieldname": "discount", "fieldtype": "Currency", "width": 120},
		{"label": "Item Amount", "fieldname": "item_amount", "fieldtype": "Currency", "width": 120},
		{
			"label": "Supplier",
			"fieldname": "supplier",
			"fieldtype": "Link",
			"options": "Supplier",
			"width": 150,
		},
		{"label": "PO Date", "fieldname": "po_date", "fieldtype": "Date", "width": 100},
		{"label": "Required By", "fieldname": "required_by", "fieldtype": "Date", "width": 100},
		{"label": "PO Grand Total", "fieldname": "po_grand_total", "fieldtype": "Currency", "width": 150},
		{
			"label": "Purchase Receipt",
			"fieldname": "purchase_receipt",
			"fieldtype": "Link",
			"options": "Purchase Receipt",
			"width": 150,
		},
		{"label": "Received Qty", "fieldname": "received_qty", "fieldtype": "Float", "width": 120},
		{"label": "Receipt Date", "fieldname": "receipt_date", "fieldtype": "Date", "width": 100},
		{
			"label": "Purchase Invoice",
			"fieldname": "purchase_invoice",
			"fieldtype": "Link",
			"options": "Purchase Invoice",
			"width": 150,
		},
		{"label": "Invoiced Qty", "fieldname": "invoiced_qty", "fieldtype": "Float", "width": 120},
		{"label": "Invoice Date", "fieldname": "invoice_date", "fieldtype": "Date", "width": 100},
	]


def get_data(filters):
	conditions = """
        mr.transaction_date BETWEEN %(from_date)s AND %(to_date)s
    """

	# Handle docstatus based on show_all filter
	if not filters.get("show_all"):
		conditions += " AND mr.docstatus = 1"

	if filters.get("item_code"):
		conditions += " AND mri.item_code = %(item_code)s"

	if filters.get("supplier"):
		conditions += " AND po.supplier = %(supplier)s"

	query = f"""
        SELECT
            mr.name AS material_request,
            mr.transaction_date AS indent_date,
            COALESCE(mr.workflow_state, mr.status) AS mr_status,

            mri.item_code,
            mri.item_name,
            mri.qty AS requested_qty,
            mri.uom,

            po.name AS purchase_order,
            COALESCE(po.workflow_state, po.status) AS po_status,
            poi.qty AS ordered_qty,
            poi.uom AS po_uom,
            poi.rate AS po_rate,
            poi.discount_amount AS discount,
            poi.amount AS item_amount,
            po.supplier,
            po.transaction_date AS po_date,
            po.schedule_date AS required_by,
            po.grand_total AS po_grand_total,

            pr.name AS purchase_receipt,
            pri.qty AS received_qty,
            pr.posting_date AS receipt_date,

            pi.name AS purchase_invoice,
            pii.qty AS invoiced_qty,
            pi.posting_date AS invoice_date

        FROM
            `tabMaterial Request` mr
        LEFT JOIN
            `tabMaterial Request Item` mri ON mri.parent = mr.name
        LEFT JOIN
            `tabPurchase Order Item` poi ON poi.material_request_item = mri.name
        LEFT JOIN
            `tabPurchase Order` po ON po.name = poi.parent AND po.docstatus >= 0
        LEFT JOIN
            `tabPurchase Receipt Item` pri ON pri.purchase_order_item = poi.name
        LEFT JOIN
            `tabPurchase Receipt` pr ON pr.name = pri.parent AND pr.docstatus >= 0
        LEFT JOIN
            `tabPurchase Invoice Item` pii ON pii.purchase_order = po.name AND pii.item_code = mri.item_code
        LEFT JOIN
            `tabPurchase Invoice` pi ON pi.name = pii.parent AND pi.docstatus >= 0

        WHERE {conditions}
        ORDER BY mr.name, mri.item_code
    """

	return frappe.db.sql(query, filters, as_dict=True)
