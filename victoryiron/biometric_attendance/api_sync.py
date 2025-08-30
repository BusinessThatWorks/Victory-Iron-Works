# # import requests
# # import frappe
# # from datetime import datetime, timedelta

# # def sync_biometric_attendance():
# #     start_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
# #     end_date = datetime.now().strftime('%Y-%m-%d')

# #     api_url = f"https://www.ontimeemployeemanager.com/RawDataAPI/api/Attendance/EmployeeAttendance_PeriodWise?StartDate={start_date}&EndDate={end_date}"

# #     try:
# #         response = requests.get(api_url, timeout=30)
# #         data = response.json()

# #         if data.get("STATUS") == "true":
# #             for entry in data.get("Data", []):
# #                 # Avoid duplicates
# #                 if not frappe.db.exists("Biometric Attendance", {
# #                     "card_number": entry.get("card_number"),
# #                     "punch_date": entry.get("Punch_Date")
# #                 }):
# #                     doc = frappe.get_doc({
# #                         "doctype": "Biometric Attendance",
# #                         "card_number": entry.get("card_number"),
# #                         "employee_name": entry.get("NAME"),
# #                         "punch_date": entry.get("Punch_Date"),
# #                         "is_fingerprint": entry.get("Is_Fingure_Based"),
# #                         "is_rf": entry.get("Is_RF_Based")
# #                     })
# #                     doc.insert(ignore_permissions=True)
# #         else:
# #             frappe.log_error(str(data.get("Error")), "Biometric Attendance API Error")
# #     except Exception as e:
# #         frappe.log_error(str(e), "Biometric Attendance API Sync Failed")










# import frappe
# import requests
# from datetime import datetime, timedelta

# @frappe.whitelist()
# def sync_daily_attendance():
#     # Get yesterday's date
#     today = datetime.today()
#     yesterday = today - timedelta(days=1)
    
#     start_date = yesterday.strftime("%Y-%m-%d")
#     end_date = yesterday.strftime("%Y-%m-%d")

#     url = "https://www.ontimeemployeemanager.com/RawDataAPI/api/Attendance/EmployeeAttendance_PeriodWise"
#     params = {
#         "StartDate": start_date,
#         "EndDate": end_date
#     }

#     response = requests.get(url, params=params)

#     if response.status_code == 200:
#         res_json = response.json()

#         if res_json.get("STATUS") == "true" and "Data" in res_json:
#             data = res_json["Data"]
#             inserted = 0
#             skipped = 0

#             for entry in data:
#                 card_number = entry.get("card_number")
#                 name = entry.get("NAME")
#                 raw_punch_date = entry.get("Punch_Date")

#                 if not card_number or not raw_punch_date:
#                     continue

#                 try:
#                     punch_datetime = datetime.strptime(raw_punch_date, "%Y-%m-%dT%H:%M:%S")
#                     punch_date_str = punch_datetime.strftime("%Y-%m-%d %H:%M:%S")
#                 except ValueError:
#                     print(f"❌ Invalid date format: {raw_punch_date}")
#                     continue

#                 exists = frappe.db.exists("Biometric Attendance", {
#                     "card_number": card_number,
#                     "punch_date": punch_date_str
#                 })

#                 if exists:
#                     skipped += 1
#                     continue

#                 is_finger_based = "Yes" if entry.get("Is_Fingure_Based", "").lower() == "yes" else "No"
#                 is_rf_based = "Yes" if entry.get("Is_RF_Based", "").lower() == "yes" else "No"

#                 doc = frappe.get_doc({
#                     "doctype": "Biometric Attendance",
#                     "card_number": card_number,
#                     "name1": name,
#                     "punch_date": punch_date_str,
#                     "is_finger_based": is_finger_based,
#                     "is_rf_based": is_rf_based
#                 })

#                 doc.insert(ignore_permissions=True)
#                 frappe.db.commit()
#                 inserted += 1

#             print(f"\n✅ Attendance sync complete for {start_date}: Inserted {inserted}, Skipped {skipped}")
#         else:
#             print("❌ API returned false status or no data")
#     else:
#         print(f"❌ Failed to fetch API. Status code: {response.status_code}")
