# Copyright (c) 2025, beetashokechakraborty and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class MachineandHandMould(Document):
	
		def validate(self):
			self.calculate_child_good_qty()
			self.calculate_totals()

		# 1️⃣ Calculate good qty in each row
		def calculate_child_good_qty(self):

			for row in self.table_jelu:

				if row.start_no is not None and row.end_no is not None:

					if row.end_no < row.start_no:
						frappe.throw(f"Row #{row.idx}: End No cannot be less than Start No")

					row.total_good_mould_qty = (
						row.end_no - row.start_no + 1
					)

		# 2️⃣ Calculate machine totals
		def calculate_totals(self):

			totals = {
				"HP 1": {"good": 0, "reject": 0},
				"HP 2": {"good": 0, "reject": 0},
				"SS-A": {"good": 0, "reject": 0},
				"SS-B": {"good": 0, "reject": 0},
			}

			for row in self.table_jelu:
				machine = row.machine_mould

				if machine in totals:
					totals[machine]["good"] += row.total_good_mould_qty or 0
					totals[machine]["reject"] += row.total_rejected_mould_qty or 0

			self.hp_1_total_good_mould = totals["HP 1"]["good"]
			self.hp_1_total_reject_mould = totals["HP 1"]["reject"]

			self.hp_2_total_good_mould = totals["HP 2"]["good"]
			self.hp_2_total_reject_mould = totals["HP 2"]["reject"]

			self.ssa_good = totals["SS-A"]["good"]
			self.ssa_reject = totals["SS-A"]["reject"]

			self.ssb_good = totals["SS-B"]["good"]
			self.ssb_reject = totals["SS-B"]["reject"]
