# import frappe
# import requests
# import json

# def create_purchase_receipt_in_site_a(doc, method):
#     # ✅ Validation: Only run for specific customer
#     if getattr(doc, "customer_name", "") != "Chamong Tee Exports      P LTD":
#         return  # Skip completely if customer name doesn't match

#     messages = []  # Collect logs for UI

#     try:
#         dn_name = doc.name
#         messages.append(f"Triggered for Delivery Note: {dn_name}")

#         # -----------------------------
#         # CONFIG SITE A
#         # -----------------------------
#         site_a_url = "https://chamongtee.m.frappe.cloud"
#         api_key = "048c19941b27fd9"
#         api_secret = "abedf75635ed09c"
#         headers = {
#             "Authorization": f"token {api_key}:{api_secret}",
#             "Content-Type": "application/json"
#         }

#         # -----------------------------
#         # HARD-CODED MAPPINGS
#         # -----------------------------
#         target_company = "Chamong Tee Exports Private Limited"
#         target_supplier = "Victory Iron Works LTD"

#         warehouse_mapping = {
#             "Stores - VI": "Stores - CT",
#             "Finished Goods - VI": "Finished Goods - CT"
#         }

#         tax_account_mapping = {
#             "Output Tax SGST - VI": "Input Tax SGST - CT",
#             "Output Tax CGST - VI": "Input Tax CGST - CT",
#             "Output Tax IGST - VI": "Input Tax IGST - CT"
#         }

#         messages.append(f"Mapped DN.company '{doc.company}' → PR.company '{target_company}'")
#         messages.append(f"Supplier hard-coded as '{target_supplier}'")

#         # -----------------------------
#         # CHECK SUPPLIER EXISTS IN SITE A
#         # -----------------------------
#         supplier_check_url = f"{site_a_url}/api/resource/Supplier/{target_supplier.replace(' ', '%20')}"
#         supplier_check = requests.get(supplier_check_url, headers=headers)
#         if supplier_check.status_code != 200:
#             messages.append(f"⚠️ Supplier {target_supplier} not found on Site A")
#             frappe.throw(f"STOP: Supplier {target_supplier} not found or no permission on Site A.")

#         # -----------------------------
#         # HANDLE POSTING TIME
#         # -----------------------------
#         posting_time_str = "00:00:00"
#         if getattr(doc, "posting_time", None):
#             try:
#                 td = doc.posting_time  # datetime.time
#                 posting_time_str = td.strftime("%H:%M:%S")
#             except Exception:
#                 posting_time_str = "00:00:00"

#         # -----------------------------
#         # BUILD PURCHASE RECEIPT DATA
#         # -----------------------------
#         pr_data = {
#             "doctype": "Purchase Receipt",
#             "supplier": target_supplier,
#             "company": target_company,
#             "posting_date": doc.posting_date.strftime("%Y-%m-%d"),
#             "posting_time": posting_time_str,
#             "set_warehouse": "Stores - CT",
#             "items": [],
#             "taxes": []
#         }

#         # ITEMS
#         for item in doc.items:
#             original_wh = getattr(item, "warehouse", None)
#             mapped_wh = warehouse_mapping.get(original_wh, original_wh) if original_wh else None
#             messages.append(f"Mapped warehouse: '{original_wh}' → '{mapped_wh}' for item {item.item_code}")

#             pr_data["items"].append({
#                 "item_code": item.item_code,
#                 "item_name": item.item_name,
#                 "description": item.description,
#                 "uom": item.uom,
#                 "qty": item.qty,
#                 "rate": item.rate,
#                 "amount": item.amount,
#                 "warehouse": mapped_wh
#             })

#         # TAXES
#         for t in getattr(doc, "taxes", []):
#             original_acc = t.account_head
#             mapped_acc = tax_account_mapping.get(original_acc, original_acc)
#             messages.append(f"Mapped tax account: '{original_acc}' → '{mapped_acc}'")

#             pr_data["taxes"].append({
#                 "charge_type": t.charge_type,
#                 "account_head": mapped_acc,
#                 "description": t.description,
#                 "rate": t.rate,
#                 "tax_amount": t.tax_amount
#             })

#         # -----------------------------
#         # SEND TO SITE A
#         # -----------------------------
#         messages.append(f"Sending Purchase Receipt to Site A for {dn_name}")
#         api_url = f"{site_a_url}/api/resource/Purchase Receipt"
#         response = requests.post(api_url, headers=headers, data=json.dumps(pr_data))
#         messages.append(f"Response Status: {response.status_code}")

#         try:
#             resp_json = response.json()
#             messages.append(f"Response JSON: {json.dumps(resp_json, indent=2)}")
#         except Exception:
#             messages.append(f"Response Text: {response.text}")

#         if response.status_code in [200, 201]:
#             messages.append(f"✅ Purchase Receipt created successfully in Site A for {dn_name}")
#         else:
#             messages.append(f"❌ Failed to create Purchase Receipt in Site A")

#     except Exception as e:
#         messages.append(f"⚠️ Error: {str(e)}")

#     # Show all logs in UI
#     frappe.msgprint("<br>".join(messages))










import frappe
import requests
import json

def create_purchase_receipt_in_site_a(doc, method):
    # ✅ Validation: Only run for specific customer
    if getattr(doc, "customer_name", "") != "Chamong Tee Exports      P LTD":
        return  # Skip completely if customer name doesn't match

    try:
        dn_name = doc.name

        # -----------------------------
        # CONFIG SITE A
        # -----------------------------
        site_a_url = "https://chamongtee.m.frappe.cloud"
        api_key = "048c19941b27fd9"
        api_secret = "abedf75635ed09c"
        headers = {
            "Authorization": f"token {api_key}:{api_secret}",
            "Content-Type": "application/json"
        }

        # -----------------------------
        # HARD-CODED MAPPINGS
        # -----------------------------
        target_company = "Chamong Tee Exports Private Limited"
        target_supplier = "Victory Iron Works LTD"

        warehouse_mapping = {
            "Stores - VI": "Stores - CT",
            "Finished Goods - VI": "Finished Goods - CT"
        }

        tax_account_mapping = {
            "Output Tax SGST - VI": "Input Tax SGST - CT",
            "Output Tax CGST - VI": "Input Tax CGST - CT",
            "Output Tax IGST - VI": "Input Tax IGST - CT"
        }

        # -----------------------------
        # CHECK SUPPLIER EXISTS IN SITE A
        # -----------------------------
        supplier_check_url = f"{site_a_url}/api/resource/Supplier/{target_supplier.replace(' ', '%20')}"
        supplier_check = requests.get(supplier_check_url, headers=headers)
        if supplier_check.status_code != 200:
            frappe.throw(f"STOP: Supplier {target_supplier} not found or no permission on Site A.")

        # -----------------------------
        # HANDLE POSTING TIME
        # -----------------------------
        posting_time_str = "00:00:00"
        if getattr(doc, "posting_time", None):
            try:
                td = doc.posting_time  # datetime.time
                posting_time_str = td.strftime("%H:%M:%S")
            except Exception:
                posting_time_str = "00:00:00"

        # -----------------------------
        # BUILD PURCHASE RECEIPT DATA
        # -----------------------------
        pr_data = {
            "doctype": "Purchase Receipt",
            "supplier": target_supplier,
            "company": target_company,
            "posting_date": doc.posting_date.strftime("%Y-%m-%d"),
            "posting_time": posting_time_str,
            "set_warehouse": "Stores - CT",
            "items": [],
            "taxes": []
        }

        # ITEMS
        for item in doc.items:
            original_wh = getattr(item, "warehouse", None)
            mapped_wh = warehouse_mapping.get(original_wh, original_wh) if original_wh else None

            pr_data["items"].append({
                "item_code": item.item_code,
                "item_name": item.item_name,
                "description": item.description,
                "uom": item.uom,
                "qty": item.qty,
                "rate": item.rate,
                "amount": item.amount,
                "warehouse": mapped_wh
            })

        # TAXES
        for t in getattr(doc, "taxes", []):
            original_acc = t.account_head
            mapped_acc = tax_account_mapping.get(original_acc, original_acc)

            pr_data["taxes"].append({
                "charge_type": t.charge_type,
                "account_head": mapped_acc,
                "description": t.description,
                "rate": t.rate,
                "tax_amount": t.tax_amount
            })

        # -----------------------------
        # SEND TO SITE A
        # -----------------------------
        api_url = f"{site_a_url}/api/resource/Purchase Receipt"
        response = requests.post(api_url, headers=headers, data=json.dumps(pr_data))

        if response.status_code in [200, 201]:
            frappe.msgprint(f"✅ Purchase Receipt created successfully in Site A for {dn_name}")
        else:
            frappe.msgprint(f"❌ Failed to create Purchase Receipt in Site A (Status {response.status_code})")

    except Exception as e:
        frappe.msgprint(f"⚠️ Error: {str(e)}")
