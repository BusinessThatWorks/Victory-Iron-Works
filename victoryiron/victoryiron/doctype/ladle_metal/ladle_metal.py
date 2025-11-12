# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class LadleMetal(Document):
	def before_save(self):
		"""Rebuild consumption table from all charge_ids before saving"""
		print("Ladle Metal: Starting to rebuild consumption table from charge_ids")

		# Get all unique charge_ids from metal_received_from_cupola
		charge_ids = []
		charge_ids_set = set()  # To track unique charge_ids
		if self.metal_received_from_cupola:
			for row in self.metal_received_from_cupola:
				if row.charge_id and row.charge_id not in charge_ids_set:
					charge_ids.append(row.charge_id)
					charge_ids_set.add(row.charge_id)
					print(f"Ladle Metal: Found charge_id: {row.charge_id}")

		print(f"Ladle Metal: Total unique charge_ids to process: {len(charge_ids)}")

		if not charge_ids:
			print("Ladle Metal: No charge_ids found, clearing table_zvhx")
			self.table_zvhx = []
			return

		# Collect all consumption_table rows from all charge_ids
		all_consumption_rows = []

		for charge_id in charge_ids:
			print(f"Ladle Metal: Fetching consumption_table for charge_id: {charge_id}")

			try:
				# Fetch the Cupola Heat log document
				cupola_heat_log = frappe.get_doc("Cupola Heat log", charge_id)

				if cupola_heat_log and cupola_heat_log.consumption_table:
					consumption_rows = cupola_heat_log.consumption_table
					print(f"Ladle Metal: Found {len(consumption_rows)} rows for charge_id {charge_id}")

					# Add all rows to the collection
					for row in consumption_rows:
						all_consumption_rows.append(
							{
								"item_name": row.item_name,
								"quantity": row.quantity or 0,
								"valuation_rate": row.valuation_rate or 0,
								"uom": row.uom,
								"store_stock": row.store_stock or 0,
								"total_valuation": row.total_valuation or 0,
							}
						)
				else:
					print(f"Ladle Metal: No consumption_table found for charge_id {charge_id}")
			except frappe.DoesNotExistError:
				print(f"Ladle Metal: Cupola Heat log document {charge_id} not found")
			except Exception as e:
				print(f"Ladle Metal: Error fetching charge_id {charge_id}: {str(e)}")

		print(f"Ladle Metal: Total consumption rows collected: {len(all_consumption_rows)}")

		# Group rows by item_name and aggregate values
		grouped_data = {}

		for row in all_consumption_rows:
			item_name = row["item_name"] or ""

			if item_name not in grouped_data:
				# First occurrence of this item_name
				grouped_data[item_name] = {
					"item_name": row["item_name"],
					"uom": row["uom"],
					"quantity": float(row["quantity"] or 0),
					"valuation_rate": float(row["valuation_rate"] or 0),
					"total_valuation": float(row["total_valuation"] or 0),
					"store_stock": float(row["store_stock"] or 0),
					"count": 1,  # Track how many rows we're grouping
				}
				print(f"Ladle Metal: Created new group for item_name: {item_name}")
			else:
				# Item already exists, aggregate values
				existing = grouped_data[item_name]

				# Sum quantity
				existing["quantity"] += float(row["quantity"] or 0)

				# Average valuation_rate (calculate running average)
				total_rate = (existing["valuation_rate"] * existing["count"]) + float(
					row["valuation_rate"] or 0
				)
				existing["count"] += 1
				existing["valuation_rate"] = total_rate / existing["count"]

				# Sum total_valuation
				existing["total_valuation"] += float(row["total_valuation"] or 0)

				# Take latest store_stock
				existing["store_stock"] = float(row["store_stock"] or 0)

				print(
					f"Ladle Metal: Updated group for item_name {item_name}: qty={existing['quantity']}, rate={existing['valuation_rate']}, total_val={existing['total_valuation']}"
				)

		print(f"Ladle Metal: Grouping complete. Number of unique items: {len(grouped_data)}")

		# Clear existing table_zvhx
		self.table_zvhx = []

		# Add grouped rows to table_zvhx
		for item_name, data in grouped_data.items():
			new_row = self.append("table_zvhx", {})
			new_row.item_name = data["item_name"]
			new_row.uom = data["uom"]
			new_row.quantity = data["quantity"]
			new_row.valuation_rate = data["valuation_rate"]
			new_row.total_valuation = data["total_valuation"]
			new_row.store_stock = data["store_stock"]
			print(f"Ladle Metal: Added grouped row for item_name: {item_name}")

		print(f"Ladle Metal: Final table_zvhx rows count: {len(self.table_zvhx)}")
