// frappe.ui.form.on('Item', {
//     onload: function (frm) {
//         console.log("✅ Custom app JS loaded for Item");

//         frappe.after_ajax(() => {
//             setTimeout(() => {
//                 const $input = frm.fields_dict.item_name?.$wrapper?.find('input');

//                 if ($input?.length) {
//                     console.log("🎯 Found item_name input");

//                     $input.on('input', function () {
//                         const value = $(this).val();
//                         console.log("✍️ item_name typed:", value);
//                         frm.set_value('custom_hsn', value);
//                     });
//                 } else {
//                     console.warn("⚠️ item_name input not found");
//                 }
//             }, 300);
//         });
//     }
// });
