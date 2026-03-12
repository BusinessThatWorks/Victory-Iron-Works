# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt

# Default items for Charge Mix
DEFAULT_CHARGE_MIX_ITEMS = [
    "Sand Pig Iron",
    "Pig Iron",
    "M.S.SCRAP - CRC",
    "MS Scrap-Punching",
    "MS CI Scrap",
    "MS Scrap",
    "CI Foundry Return",
    "DI Foundry Return",
    "Carburiser (D.I)",
    "Ferro Silicon",
    "Ferro Manganese"
]

# Items to EXCLUDE from Total Charge Mix (Kg) calculation
EXCLUDE_FROM_WEIGHT_TOTAL = [
    "Carburiser (D.I)",
    "Ferro Silicon",
    "Ferro Manganese"
]
# Default items for Treatment Mix
DEFAULT_TREATMENT_MIX_ITEMS = [
    "Ferro Si- Magnesium (D. I)",
    "Inoculant (D.I)",
    "Slag Coagulator (D.I)"
]

class InductionFurnaceHeat(Document):
    def before_insert(self):
        """Add default items when creating new document"""
        if not self.charge_mix_component_item:
            self.add_default_charge_mix_items()

        if not self.table_bych:
                self.add_default_treatment_mix_items()        

    def add_default_charge_mix_items(self):
        """Add default charge mix items with their rates"""
        for item_code in DEFAULT_CHARGE_MIX_ITEMS:
            # Check if item exists
            if frappe.db.exists("Item", item_code):
                rate = get_item_valuation_rate(item_code)
                self.append("charge_mix_component_item", {
                    "item": item_code,
                    "weight_in_kg": 0,
                    "rate": rate,
                    "amount": 0
                })

    def add_default_treatment_mix_items(self):
        """Add default treatment mix items with their rates"""
        for item_code in DEFAULT_TREATMENT_MIX_ITEMS:
            if frappe.db.exists("Item", item_code):
                rate = get_item_valuation_rate(item_code)
                self.append("table_bych", {
                    "item": item_code,
                    "weight_in_kg": 0,
                    "rate": rate,
                    "amount": 0
                })

    def validate(self):
        self.calculate_charge_mix_totals()
        self.calculate_treatment_totals()
        self.calculate_furnace_running_time()
        self.calculate_furnace_unit_consumed()

    def calculate_charge_mix_totals(self):
        """Calculate total weight and valuation for charge mix
        Note: Weight total EXCLUDES Carburiser, Ferro Silicon, Ferro Manganese
        Valuation total INCLUDES all items
        """
        total_weight = 0
        total_valuation = 0

        for row in self.charge_mix_component_item or []:
            row.amount = flt(row.weight_in_kg) * flt(row.rate)
            
            # Add to valuation total (ALL items)
            total_valuation += flt(row.amount)
            
            # Add to weight total ONLY if NOT in exclude list
            if row.item not in EXCLUDE_FROM_WEIGHT_TOTAL:
                total_weight += flt(row.weight_in_kg)

        self.total_charge_mix_kg = flt(total_weight, 2)
        self.total_charge_mix_valuation = flt(total_valuation, 2)

    def calculate_treatment_totals(self):
        """Calculate total quantity and valuation for treatment mix"""
        total_quantity = 0
        total_valuation = 0

        for row in self.table_bych or []:
            row.amount = flt(row.weight_in_kg) * flt(row.rate)
            total_quantity += flt(row.weight_in_kg)
            total_valuation += flt(row.amount)

        self.total_treatment_quantity = flt(total_quantity, 2)
        self.total_treatment_valuation = flt(total_valuation, 2)

    def calculate_furnace_running_time(self):
        """Calculate total furnace running time in hours"""
        if self.furnace_on_time and self.furnace_off_time:
            from frappe.utils import time_diff_in_hours
            hours = time_diff_in_hours(self.furnace_off_time, self.furnace_on_time)
            # Handle negative (next day case)
            if hours < 0:
                hours += 24
            self.total_furnace_running_time = f"{flt(hours, 2)} Hours"

    def calculate_furnace_unit_consumed(self):
        """Calculate furnace unit consumed"""
        if self.furnace_meter_reading_start is not None and self.furnace_meter_reading_end is not None:
            self.total_furnace_unit_consumed = flt(
                self.furnace_meter_reading_end - self.furnace_meter_reading_start, 2
            )


@frappe.whitelist()
def get_item_valuation_rate(item_code):
    """Get valuation rate from Bin doctype for the given item"""
    if not item_code:
        return 0

    # Get valuation rate from Bin
    bin_rate = frappe.db.get_value(
        "Bin",
        {"item_code": item_code},
        "valuation_rate",
        order_by="modified desc"
    )

    if bin_rate:
        return flt(bin_rate)

    # Fallback: Get from Item master
    item_rate = frappe.db.get_value("Item", item_code, "valuation_rate")
    return flt(item_rate) if item_rate else 0


@frappe.whitelist()
def get_default_charge_mix_items():
    """Get default charge mix items with their rates in sorted order"""
    items = []
    for item_code in DEFAULT_CHARGE_MIX_ITEMS:
        if frappe.db.exists("Item", item_code):
            rate = get_item_valuation_rate(item_code)
            items.append({
                "item": item_code,
                "rate": rate
            })
    
    return items

@frappe.whitelist()
def get_default_treatment_mix_items():
    """Get default treatment mix items with their rates in sorted order"""
    items = []
    for item_code in DEFAULT_TREATMENT_MIX_ITEMS:
        if frappe.db.exists("Item", item_code):
            rate = get_item_valuation_rate(item_code)
            items.append({
                "item": item_code,
                "rate": rate
            })
    return items

# Export exclude list for JS use
@frappe.whitelist()
def get_exclude_from_weight_items():
    """Return list of items to exclude from weight total"""
    return EXCLUDE_FROM_WEIGHT_TOTAL