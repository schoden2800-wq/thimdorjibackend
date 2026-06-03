
const Booking = require('../models/bookingModels');
const Room = require('../models/roomModel');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { addBookingToSheet, updateBookingInSheet, removeBookingFromSheet } = require("../google-sync/googleSheet");
const roomNumberList = require("../roomNumberList");
const { sendMailWithGmailApi } = require("../utils/gmailSender");
;
const adminEmail = process.env.ADMIN_EMAIL;


const validator = require("validator");
const sanitizeHtml = require("sanitize-html");
const generateBookingNumber = async () => {
  const lastBooking = await Booking.findOne().sort({ createdAt: -1 });

  let nextNumber = 1;

  if (lastBooking && lastBooking.bookingNumber) {
    const lastNum = parseInt(lastBooking.bookingNumber.replace("RN-", ""), 10);
    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
  }

  // Convert number to 2-digit format: 1 → "01", 2 → "02"
  const twoDigit = nextNumber.toString().padStart(2, "0");

  return `RN-${twoDigit}`;
};
// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     // Validate dates
//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);
//     const nights = Math.ceil((co - ci) / (1000 * 60 * 60 * 24));

//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });

//     // -----------------------------------------------------------
//     // MULTI-ROOM HANDLING
//     // -----------------------------------------------------------
//     let total = 0;
//     let roomDetails = [];

//     for (const reqRoom of roomSelection) {
//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyType,
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed
//       } = reqRoom;

//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // Base price
//       const basePrice =
//         occupancyType === "single"
//           ? pricing[mealPlan].single
//           : pricing[mealPlan].double;

//       // Extra bed
//       const extraBedCost = extraBed ? (pricing.extraBed?.[mealPlan] || 0) : 0;

//       // Child policy
//       let childCost = 0;
//       childrenAges.forEach((age) => {
//         if (age === "1-5") return;
//         if (age === "6-11") childCost += pricing.childPolicy?.age6to11?.[mealPlan] || 0;
//         if (age === "12+") childCost += basePrice;
//       });

//       // Per night total for THIS room item
//       const perNightTotal = basePrice * roomsRequested + extraBedCost + childCost;

//       total += perNightTotal * nights;

//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType,
//         mealPlan,
//         adults,
//         children: childrenAges.map((age) => ({ age })),
//         extraBeds: extraBed ? 1 : 0,
//         pricePerNight: basePrice
//       });
//     }

//     // -----------------------------------------------------------
//     // SAVE BOOKING
//     // -----------------------------------------------------------
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,
//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },
//       specialRequest,
//       totalPrice: total,
//       assignedRoom: [],
//       status: "pending"
//     });

//     // -----------------------------------------------------------
//     // EMAIL TEMPLATES (NEW, NEAT, SIMPLE)
//     // -----------------------------------------------------------

//     const htmlContentUser = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">Booking Received</h2>
//           <p>Dear <strong>${firstName}</strong>,</p>
//           <p>Your booking request has been <strong>received</strong>. We will contact you shortly.</p>
          
//           <h3 style="color:#444;">Booking Summary</h3>
//           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
//           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
//           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
//           <p><strong>Total Rooms:</strong> ${roomDetails.reduce((s,r)=>s+r.quantity,0)}</p>
//           <p><strong>Total Price:</strong> BTN ${total.toFixed(2)}</p>

//           <p style="margin-top: 20px;">Warm regards,<br><strong>Hotel Team</strong></p>
//         </div>
//       </div>
//     `;

//     const htmlContentAdmin = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">New Booking Received</h2>

//           <h3 style="color:#444;">Customer Info</h3>
//           <p><strong>${firstName} ${lastName}</strong></p>
//           <p>${email}</p>

//           <h3 style="color:#444;">Booking Summary</h3>
//           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
//           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
//           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
//           <p><strong>Total:</strong> BTN ${total.toFixed(2)}</p>
//         </div>
//       </div>
//     `;

//     // -----------------------------------------------------------
//     // SEND EMAILS
//     // -----------------------------------------------------------
//     try {
//       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlContentUser);
//       await sendMailWithGmailApi(
//         adminEmail,
//         `New Booking - ${bookingNumber}`,
//         htmlContentAdmin,
//         { from: email }
//       );
//     } catch (e) {
//       console.error("EMAIL ERROR:", e.message);
//     }

//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// // exports.createBooking = async (req, res) => {
// //   try {
// //     const {
// //       firstName,
// //       lastName,
// //       email,
// //       country,
// //       phone,
// //       checkIn,
// //       checkOut,
// //       roomSelection,
// //       specialRequest
// //     } = req.body;

// //     if (!roomSelection?.length)
// //       return res.status(400).json({ message: "Room selection is required" });

// //     // Validate dates
// //     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
// //       return res.status(400).json({ message: "Invalid dates" });

// //     const ci = new Date(checkIn);
// //     const co = new Date(checkOut);
// //     const nights = Math.ceil((co - ci) / (1000 * 60 * 60 * 24));

// //     if (nights <= 0)
// //       return res.status(400).json({ message: "Check-out must be after check-in" });

// //     // -----------------------------------------------------------
// //     // MULTI-ROOM HANDLING
// //     // -----------------------------------------------------------
// //     let total = 0;
// //     let roomDetails = [];

// //     for (const reqRoom of roomSelection) {
// //       const {
// //         roomType,
// //         roomsRequested = 1,
// //         occupancyType,
// //         mealPlan,
// //         adults,
// //         childrenAges = [],
// //         extraBed
// //       } = reqRoom;

// //       const roomDoc = await Room.findOne({ roomType });
// //       if (!roomDoc)
// //         return res.status(400).json({ message: `Room ${roomType} not found` });

// //       const pricing = roomDoc.pricing;

// //       // Base price
// //       const basePrice =
// //         occupancyType === "single"
// //           ? pricing[mealPlan].single
// //           : pricing[mealPlan].double;

// //       // Extra bed
// //       const extraBedCost = extraBed ? (pricing.extraBed?.[mealPlan] || 0) : 0;

// //       // Child policy
// //       let childCost = 0;
// //       childrenAges.forEach((age) => {
// //         if (age === "1-5") return;
// //         if (age === "6-11") childCost += pricing.childPolicy?.age6to11?.[mealPlan] || 0;
// //         if (age === "12+") childCost += basePrice;
// //       });

// //       // Per night total for THIS room item
// //       const perNightTotal = basePrice * roomsRequested + extraBedCost + childCost;

// //       total += perNightTotal * nights;

// //       roomDetails.push({
// //         roomType,
// //         quantity: roomsRequested,
// //         occupancyType,
// //         mealPlan,
// //         adults,
// //         children: childrenAges.map((age) => ({ age })),
// //         extraBeds: extraBed ? 1 : 0,
// //         pricePerNight: basePrice
// //       });
// //     }

// //     // -----------------------------------------------------------
// //     // SAVE BOOKING
// //     // -----------------------------------------------------------

// //     const bookingNumber = await generateBookingNumber();

// //     const booking = await Booking.create({
// //       bookingNumber,
// //       firstName,
// //       lastName,
// //       email,
// //       country,
// //       phoneNumber: phone,
// //       checkIn: ci,
// //       checkOut: co,
// //       rooms: roomDetails,
// //       meals: {
// //         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
// //         lunch: roomDetails.some(r => r.mealPlan === "ap"),
// //         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
// //       },
// //       specialRequest,
// //       totalPrice: total,
// //       assignedRoom: [],
// //       status: "pending"
// //     });

// //     // -----------------------------------------------------------
// //     // EMAILS
// //     // -----------------------------------------------------------

// //     const htmlContentUser = `
// //       <div style="font-family: Arial, sans-serif;">
// //         <h2>Booking Received</h2>
// //         <p>Dear ${firstName}, your booking has been received.</p>
// //         <p><strong>Booking Number:</strong> ${bookingNumber}</p>
// //         <p><strong>Total:</strong> $${total.toFixed(2)}</p>
// //       </div>
// //     `;

// //     const htmlContentAdmin = `
// //       <div style="font-family: Arial, sans-serif;">
// //         <h2>New Booking Received</h2>
// //         <p>Booking Number: ${bookingNumber}</p>
// //         <p>Customer: ${firstName} ${lastName}</p>
// //         <p>Total: $${total.toFixed(2)}</p>
// //       </div>
// //     `;

// //     try {
// //       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlContentUser);
// //       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlContentAdmin, { from: email });
// //     } catch (e) {
// //       console.error("EMAIL ERROR:", e.message);
// //     }

// //     return res.status(201).json({
// //       message: "Booking created successfully",
// //       booking
// //     });

// //   } catch (err) {
// //     console.error("Booking creation error:", err);
// //     return res.status(500).json({ message: "Server error" });
// //   }
// // };

// // exports.createBooking = async (req, res) => {
// //   try {
// //     const {
// //       firstName,
// //       lastName,
// //       email,
// //       country,
// //       phone,
// //       checkIn,
// //       checkOut,
// //       roomSelection,
// //       specialRequest,
// //       mealPlan,        // ep, cp, map, ap
// //       occupancyType,   // single or double
// //       adults,
// //       children,
// //       childrenAges,    // ["1-5","6-11","12+"]
// //       extraBed,        // true/false
// //     } = req.body;

// //     if (!roomSelection?.length)
// //       return res.status(400).json({ message: "Room selection is required" });

// //     const reqRoom = roomSelection[0];
// //     const roomType = reqRoom.roomType;
// //     const roomsRequested = Number(reqRoom.roomsRequested || 1);

// //     // Validate dates
// //     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
// //       return res.status(400).json({ message: "Invalid dates" });

// //     const ci = new Date(checkIn);
// //     const co = new Date(checkOut);
// //     const nights = Math.ceil((co - ci) / (1000 * 60 * 60 * 24));

// //     if (nights <= 0)
// //       return res.status(400).json({ message: "Check-out must be after check-in" });

// //     // Find room document
// //     const roomDoc = await Room.findOne({ roomType });
// //     if (!roomDoc)
// //       return res.status(400).json({ message: `Room ${roomType} not found` });

// //     const pricing = roomDoc.pricing;

// //     // 1️⃣ BASE ROOM PRICE PER NIGHT
// //     const basePrice =
// //       occupancyType === "single"
// //         ? pricing[mealPlan].single
// //         : pricing[mealPlan].double;

// //     // 2️⃣ EXTRA BED COST PER NIGHT
// //     let extraBedCost = 0;
// //     if (extraBed) extraBedCost = pricing.extraBed?.[mealPlan] || 0;

// //     // 3️⃣ CHILD COST PER NIGHT
// //     let childCost = 0;
// //     (childrenAges || []).forEach((age) => {
// //       if (age === "1-5") return; // Free
// //       if (age === "6-11") childCost += pricing.childPolicy?.age6to11?.[mealPlan] || 0;
// //       if (age === "12+") childCost += basePrice;
// //     });

// //     // 4️⃣ TOTAL PER NIGHT
// //     const totalPerNight = basePrice * roomsRequested + extraBedCost + childCost;

// //     // 5️⃣ FINAL TOTAL FOR ALL NIGHTS
// //     const total = totalPerNight * nights;

// //     const bookingNumber = await generateBookingNumber();

// //     const childrenFormatted = (childrenAges || []).map((age) => ({ age }));

// //     const booking = await Booking.create({
// //       bookingNumber,
// //       firstName,
// //       lastName,
// //       email,
// //       country,
// //       phoneNumber: phone,
// //       checkIn: ci,
// //       checkOut: co,
// //       rooms: [
// //         {
// //           roomType,
// //           quantity: roomsRequested,
// //           occupancyType,
// //           mealPlan,
// //           adults,
// //           children: childrenFormatted,
// //           extraBeds: extraBed ? 1 : 0,
// //           pricePerNight: basePrice,
// //         },
// //       ],
// //       meals: {
// //         breakfast: mealPlan !== "ep",
// //         lunch: mealPlan === "ap",
// //         dinner: mealPlan === "map" || mealPlan === "ap",
// //       },
// //       specialRequest,
// //       totalPrice: total,
// //       assignedRoom: [],
// //       status: "pending",
// //     });

// //     // ---------------------------------------------
// //     // SEND EMAIL TO USER AND ADMIN
// //     // ---------------------------------------------
// //     const htmlContentUser = `
// //       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
// //         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
// //           <h2 style="color: #006600;">Booking Received</h2>
// //           <p>Dear <strong>${firstName}</strong>,</p>
// //           <p>Your booking request has been <strong>received</strong> successfully. Our team will confirm once payment is received.</p>
// //           <h3 style="color:#444;">Booking Details</h3>
// //           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
// //           <p><strong>Room Type:</strong> ${roomType}</p>
// //           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
// //           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
// //           <p><strong>Total Price:</strong> $${total.toFixed(2)}</p>
// //           <p style="margin-top: 20px;">Best Regards,<br><strong>Hotel Management Team</strong></p>
// //         </div>
// //       </div>
// //     `;

// //     const htmlContentAdmin = `
// //       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
// //         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
// //           <h2 style="color: #006600;">New Booking Received</h2>
// //           <p>A new booking has been made by <strong>${firstName} ${lastName}</strong> (${email}).</p>
// //           <h3 style="color:#444;">Booking Details</h3>
// //           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
// //           <p><strong>Room Type:</strong> ${roomType}</p>
// //           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
// //           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
// //           <p><strong>Total Price:</strong> $${total.toFixed(2)}</p>
// //         </div>
// //       </div>
// //     `;

// //     try {
// //       // Send confirmation to user
// //       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlContentUser);

// //       // Send booking notification to admin, from user
// //       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlContentAdmin, { from: email });
// //     } catch (emailErr) {
// //       console.error("EMAIL SEND ERROR:", emailErr.message);
// //     }

// //     return res.status(201).json({
// //       message: "Booking created successfully",
// //       booking,
// //     });
// //   } catch (err) {
// //     console.error("Booking creation error:", err);
// //     return res.status(500).json({ message: "Server error" });
// //   }
// // };
// // exports.createBooking = async (req, res) => {
// //   try {
// //     const {
// //       firstName,
// //       lastName,
// //       email,
// //       country,
// //       phone,
// //       checkIn,
// //       checkOut,
// //       roomSelection,
// //       specialRequest,
// //       mealPlan,        // ep, cp, map, ap
// //       occupancyType,   // single or double
// //       adults,
// //       children,
// //       childrenAges,    // ["1-5","6-11","12+"]
// //       extraBed,        // true/false
// //     } = req.body;

// //     if (!roomSelection?.length)
// //       return res.status(400).json({ message: "Room selection is required" });

// //     const reqRoom = roomSelection[0];
// //     const roomType = reqRoom.roomType;
// //     const roomsRequested = Number(reqRoom.roomsRequested || 1);

// //     // Validate dates
// //     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
// //       return res.status(400).json({ message: "Invalid dates" });

// //     const ci = new Date(checkIn);
// //     const co = new Date(checkOut);
// //     const nights = Math.ceil((co - ci) / (1000 * 60 * 60 * 24));

// //     if (nights <= 0)
// //       return res.status(400).json({ message: "Check-out must be after check-in" });

// //     // Find room document
// //     const roomDoc = await Room.findOne({ roomType });
// //     if (!roomDoc)
// //       return res.status(400).json({ message: `Room ${roomType} not found` });

// //     const pricing = roomDoc.pricing;

// //     // 1️⃣ BASE ROOM PRICE
// //     const basePrice =
// //       occupancyType === "single"
// //         ? pricing[mealPlan].single
// //         : pricing[mealPlan].double;

// //     const roomCost = basePrice * roomsRequested;

// //     // 2️⃣ CHILD COST
// //     let childCost = 0;
// //     (childrenAges || []).forEach((age) => {
// //       if (age === "1-5") return; // Free
// //       if (age === "6-11") childCost += pricing.childPolicy?.age6to11?.[mealPlan] || 0;
// //       if (age === "12+") childCost += basePrice;
// //     });

// //     // 3️⃣ EXTRA BED (ONE ONLY)
// //     let extraBedCost = 0;
// //     if (extraBed) extraBedCost = pricing.extraBed?.[mealPlan] || 0;

// //     // 4️⃣ TOTAL PER NIGHT
// //     const totalPerNight = roomCost + childCost + extraBedCost;

// //     // 5️⃣ FINAL TOTAL
// //     const total = totalPerNight * nights;

// //     const bookingNumber = await generateBookingNumber();

// //     const childrenFormatted = (childrenAges || []).map((age) => ({ age }));

// //     const booking = await Booking.create({
// //       bookingNumber,
// //       firstName,
// //       lastName,
// //       email,
// //       country,
// //       phoneNumber: phone,
// //       checkIn: ci,
// //       checkOut: co,
// //       rooms: [
// //         {
// //           roomType,
// //           quantity: roomsRequested,
// //           occupancyType,
// //           mealPlan,
// //           adults,
// //           children: childrenFormatted,
// //           extraBeds: extraBed ? 1 : 0,
// //           pricePerNight: basePrice,
// //         },
// //       ],
// //       meals: {
// //         breakfast: mealPlan !== "ep",
// //         lunch: mealPlan === "ap",
// //         dinner: mealPlan === "map" || mealPlan === "ap",
// //       },
// //       specialRequest,
// //       totalPrice: total,
// //       assignedRoom: [],
// //       status: "pending",
// //     });

// //     // ---------------------------------------------
// //     // SEND EMAIL TO USER AND ADMIN
// //     // ---------------------------------------------
// //     const htmlContentUser = `
// //       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
// //         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
// //           <h2 style="color: #006600;">Booking Received</h2>
// //           <p>Dear <strong>${firstName}</strong>,</p>
// //           <p>Your booking request has been <strong>received</strong> successfully. Our team will confirm once payment is received.</p>
// //           <h3 style="color:#444;">Booking Details</h3>
// //           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
// //           <p><strong>Room Type:</strong> ${roomType}</p>
// //           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
// //           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
// //           <p><strong>Total Price:</strong> $${total.toFixed(2)}</p>
// //           <p style="margin-top: 20px;">Best Regards,<br><strong>Hotel Management Team</strong></p>
// //         </div>
// //       </div>
// //     `;

// //     const htmlContentAdmin = `
// //       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
// //         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
// //           <h2 style="color: #006600;">New Booking Received</h2>
// //           <p>A new booking has been made by <strong>${firstName} ${lastName}</strong> (${email}).</p>
// //           <h3 style="color:#444;">Booking Details</h3>
// //           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
// //           <p><strong>Room Type:</strong> ${roomType}</p>
// //           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
// //           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
// //           <p><strong>Total Price:</strong> $${total.toFixed(2)}</p>
// //         </div>
// //       </div>
// //     `;

// //     try {
// //       // Send confirmation to user
// //       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlContentUser);

// //       // Send booking notification to admin, from user
// //       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlContentAdmin, { from: email });
// //     } catch (emailErr) {
// //       console.error("EMAIL SEND ERROR:", emailErr.message);
// //     }

// //     return res.status(201).json({
// //       message: "Booking created successfully",
// //       booking,
// //     });
// //   } catch (err) {
// //     console.error("Booking creation error:", err);
// //     return res.status(500).json({ message: "Server error" });
// //   }
// // };

// // --------------------------------------------
// // CONFIRM BOOKING
// // --------------------------------------------
// exports.confirmBooking = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const { transactionNumber } = req.body;

//     if (!transactionNumber)
//       return res.status(400).json({ message: "Transaction number required" });

//     const booking = await Booking.findById(bookingId);
//     if (!booking)
//       return res.status(404).json({ message: "Booking not found" });

//     booking.status = "confirmed";
//     booking.transactionNumber = transactionNumber;
//     await booking.save();

//     const htmlContent = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">Booking Confirmed</h2>
//           <p>Dear <strong>${booking.firstName}</strong>,</p>
//           <p>Your booking has been <strong>successfully confirmed</strong>.</p>
//           <h3 style="color:#444;">Booking Details</h3>
//           <p><strong>Booking Number:</strong> ${booking.bookingNumber}</p>
//           <p><strong>Room Type:</strong> ${booking.rooms[0].roomType}</p>
//           <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toDateString()}</p>
//           <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toDateString()}</p>
//           <h3 style="margin-top:20px;color:#444;">Payment</h3>
//           <p><strong>Transaction Number:</strong> ${transactionNumber}</p>
//           <p>Status: <span style="color:green;"><strong>Confirmed</strong></span></p>
//           <p style="margin-top: 20px;">Best Regards,<br><strong>Hotel Management Team</strong></p>
//         </div>
//       </div>
//     `;

//     try {
//       await sendMailWithGmailApi(booking.email, `Booking Confirmed - ${booking.bookingNumber}`, htmlContent);
//       await sendMailWithGmailApi(ADMIN_EMAIL, `Booking Confirmed - ${booking.bookingNumber}`, htmlContent);
//     } catch (emailErr) {
//       console.error("EMAIL SEND ERROR:", emailErr.message);
//     }

//     return res.status(200).json({
//       message: "Booking confirmed.",
//       booking,
//     });
//   } catch (error) {
//     console.error("Booking confirmation error:", error);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     // Validate dates
//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);
//     const nights = Math.ceil((co - ci) / (1000 * 60 * 60 * 24));

//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });

//     // -----------------------------------------------------------
//     // MULTI-ROOM HANDLING
//     // -----------------------------------------------------------
//     let total = 0;
//     let roomDetails = [];

//     for (const reqRoom of roomSelection) {
//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyType,
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed = 0          // <-- number: 0, 1, 2
//       } = reqRoom;

//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // Base price
//       const basePrice =
//         occupancyType === "single"
//           ? pricing[mealPlan].single
//           : pricing[mealPlan].double;

//       // ---------------------------------------------------------
//       // EXTRA BED CALCULATION
//       // Each extra bed costs pricing.extraBed[mealPlan]
//       // Max extra beds depends on how many double rooms roomType has
//       // ---------------------------------------------------------
//       const doubleRooms = roomDoc.doubleRooms || 1; // example: 1 → max 1 bed, 2 → max 2 beds
//       const maxExtraBeds = doubleRooms;

//       const extraBedsUsed = Math.min(extraBed, maxExtraBeds);

//       const extraBedPrice = pricing.extraBed?.[mealPlan] || 0;
//       const extraBedCost = extraBedsUsed * extraBedPrice;

//       // Child policy
//       let childCost = 0;
//       childrenAges.forEach((age) => {
//         if (age === "1-5") return;
//         if (age === "6-11")
//           childCost += pricing.childPolicy?.age6to11?.[mealPlan] || 0;
//         if (age === "12+") childCost += basePrice;
//       });

//       // Per night total for THIS room item
//       const perNightTotal =
//         basePrice * roomsRequested +
//         extraBedCost +
//         childCost;

//       total += perNightTotal * nights;

//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType,
//         mealPlan,
//         adults,
//         children: childrenAges.map((age) => ({ age })),
//         extraBeds: extraBedsUsed,
//         extraBedPrice,
//         extraBedCostPerNight: extraBedCost,
//         childCostPerNight: childCost,
//         pricePerNight: basePrice
//       });
//     }

//     // -----------------------------------------------------------
//     // SAVE BOOKING
//     // -----------------------------------------------------------
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,
//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },
//       specialRequest,
//       totalPrice: total,
//       assignedRoom: [],
//       status: "pending"
//     });

//     // -----------------------------------------------------------
//     // EMAIL TEMPLATES (UNCHANGED)
//     // -----------------------------------------------------------

//     const htmlContentUser = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">Booking Received</h2>
//           <p>Dear <strong>${firstName}</strong>,</p>
//           <p>Your booking request has been <strong>received</strong>. We will contact you shortly.</p>
          
//           <h3 style="color:#444;">Booking Summary</h3>
//           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
//           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
//           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
//           <p><strong>Total Rooms:</strong> ${roomDetails.reduce((s,r)=>s+r.quantity,0)}</p>
//           <p><strong>Total Price:</strong> BTN ${total.toFixed(2)}</p>

//           <p style="margin-top: 20px;">Warm regards,<br><strong>Hotel Team</strong></p>
//         </div>
//       </div>
//     `;

//     const htmlContentAdmin = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">New Booking Received</h2>

//           <h3 style="color:#444;">Customer Info</h3>
//           <p><strong>${firstName} ${lastName}</strong></p>
//           <p>${email}</p>

//           <h3 style="color:#444;">Booking Summary</h3>
//           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
//           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
//           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
//           <p><strong>Total:</strong> BTN ${total.toFixed(2)}</p>
//         </div>
//       </div>
//     `;

//     // -----------------------------------------------------------
//     // SEND EMAILS (UNCHANGED)
//     // -----------------------------------------------------------
//     try {
//       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlContentUser);
//       await sendMailWithGmailApi(
//         adminEmail,
//         `New Booking - ${bookingNumber}`,
//         htmlContentAdmin,
//         { from: email }
//       );
//     } catch (e) {
//       console.error("EMAIL ERROR:", e.message);
//     }

//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest,
//       journalNumber,
//       statusOverride
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);
//     const nights = Math.ceil((co - ci) / 86400000);

//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });


//     // ---------------------------------------------------
//     // PROCESS MULTI-ROOM SELECTION
//     // ---------------------------------------------------
//     let total = 0;
//     let roomDetails = [];
//     let assignedRoomsFinal = []; // <-- AUTO ASSIGN HERE


//     for (const reqRoom of roomSelection) {

//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyType = [],     // ARRAY from frontend
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed = 0
//       } = reqRoom;

//       // FIND ROOM DOCUMENT
//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // ---------------------------------------------------
//       // AUTO ASSIGN ROOM NUMBERS FROM DB
//       // ---------------------------------------------------
//       const allowedRooms = roomDoc.roomNumbers; // <— EXACT DB ROOM NUMBERS

//       if (!allowedRooms || allowedRooms.length === 0) {
//         return res.status(400).json({
//           message: `No room numbers added for ${roomType}`
//         });
//       }

//       // Find existing bookings that overlap
//       const bookedRooms = await Booking.find({
//         "rooms.roomType": roomType,
//         checkIn: { $lte: co },
//         checkOut: { $gte: ci },
//         status: { $in: ["pending", "confirmed", "guaranteed", "checked_in"] }
//       });

//       const usedRooms = bookedRooms.flatMap(b => b.assignedRoom || []);

//       const freeRooms = allowedRooms.filter(r => !usedRooms.includes(r));

//       if (freeRooms.length < roomsRequested) {
//         return res.status(400).json({
//           message: `Only ${freeRooms.length} rooms available for ${roomType}`
//         });
//       }

//       const autoAssign = freeRooms.slice(0, roomsRequested);
//       assignedRoomsFinal.push(...autoAssign);



//       // ------------------ BASE ROOM TOTAL ------------------
//       let baseTotal = 0;

//       for (let i = 0; i < roomsRequested; i++) {
//         const occ = occupancyType[i] || "double";
//         const occKey = occ === "single" ? "single" : "double";

//         const base = pricing?.[mealPlan]?.[occKey] ?? 0;
//         baseTotal += base;
//       }

//       // ------------------ EXTRA BEDS ------------------
//       const doubleCount = occupancyType.filter(o => o === "double").length;
//       const maxExtra = doubleCount;

//       const appliedExtraBeds = Math.min(extraBed, maxExtra);
//       const extraBedPrice = pricing.extraBed?.[mealPlan] ?? 0;
//       const extraBedCost = appliedExtraBeds * extraBedPrice;

//       // ------------------ CHILDREN COST ------------------
//       let childCost = 0;

//       childrenAges.forEach(age => {
//         if (age === "1-5") return;

//         if (age === "6-11") {
//           childCost += pricing.childPolicy?.age6to11?.[mealPlan] ?? 0;
//         }

//         if (age === "12+") {
//           const avg = baseTotal / roomsRequested;
//           childCost += avg;
//         }
//       });

//       const perNightTotal = baseTotal + extraBedCost + childCost;
//       total += perNightTotal * nights;

//       // ------------------ SAVE ROOM BLOCK ------------------
//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType,
//         mealPlan,
//         adults,
//         children: childrenAges.map(age => ({ age })),
//         extraBeds: appliedExtraBeds,
//         extraBedPrice,
//         extraBedCostPerNight: extraBedCost,
//         childCostPerNight: childCost,
//         pricePerNight: baseTotal
//       });
//     }


//     // ---------------------------------------------------
//     // SAVE BOOKING
//     // ---------------------------------------------------
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,

//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },

//       specialRequest,
//       totalPrice: total,
//       transactionNumber: journalNumber || "",

//       assignedRoom: assignedRoomsFinal,   // <-- AUTO ASSIGNED
//       status: statusOverride || "pending"
//     });


//     // ---------------------------------------------------
//     // EMAILS (UNCHANGED)
//     // ---------------------------------------------------
//     const htmlUser = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">Booking Received</h2>
//         <p>Dear <strong>${firstName}</strong>,</p>
//         <p>Your booking has been received.</p>

//         <h3>Booking Summary</h3>
//         <p><strong>Booking No:</strong> ${bookingNumber}</p>
//         <p><strong>Rooms Assigned:</strong> ${assignedRoomsFinal.join(", ")}</p>
//         <p><strong>Total Price:</strong> BTN ${total.toFixed(2)}</p>
//       </div>
//     `;

//     const htmlAdmin = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">New Booking Received</h2>
//         <p><strong>${firstName} ${lastName}</strong></p>
//         <p>${email}</p>

//         <h3>Booking Summary</h3>
//         <p><strong>No:</strong> ${bookingNumber}</p>
//         <p><strong>Assigned Rooms:</strong> ${assignedRoomsFinal.join(", ")}</p>
//         <p><strong>Total:</strong> BTN ${total.toFixed(2)}</p>
//       </div>
//     `;

//     try {
//       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlUser);
//       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlAdmin);
//     } catch (err) {
//       console.log("Email error:", err.message);
//     }


//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest,
//       journalNumber,
//       statusOverride,
//       assignedRoom // <--- MANUAL ROOM NUMBERS FROM FRONTEND
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);

//     const nights = Math.ceil((co - ci) / 86400000);
//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });

//     let total = 0;
//     let roomDetails = [];

//     // --------------------------
//     // ⭐ FINAL ROOM LIST HERE
//     // --------------------------
//     let assignedRoomsFinal = [];

//     // --------------------------------------------
//     // ⭐ 1. FRONTEND ASSIGNED ROOMS — USE EXACTLY
//     // --------------------------------------------
//     const frontendAssignedRooms =
//       Array.isArray(assignedRoom) && assignedRoom.length > 0
//         ? assignedRoom.map(r => String(r))
//         : [];

//     // If user selected room numbers → DO NOT AUTO ASSIGN
//     const shouldAutoAssign = frontendAssignedRooms.length === 0;

//     for (const reqRoom of roomSelection) {
//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyType = [],
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed = 0
//       } = reqRoom;

//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // ----------------------------------------------------------------
//       // ⭐ 2. AUTO ASSIGN ROOMS ONLY IF FRONTEND DID NOT GIVE ANY ROOMS
//       // ----------------------------------------------------------------
//       if (shouldAutoAssign) {
//         const allowedRooms = roomDoc.roomNumbers.map(String);

//         const overlapping = await Booking.find({
//           "rooms.roomType": roomType,
//           checkIn: { $lte: co },
//           checkOut: { $gte: ci },
//           status: { $in: ["pending", "confirmed", "guaranteed", "checked_in"] }
//         });

//         const usedRooms = overlapping.flatMap(b => b.assignedRoom || []).map(String);
//         const freeRooms = allowedRooms.filter(r => !usedRooms.includes(r));

//         if (freeRooms.length < roomsRequested) {
//           return res.status(400).json({
//             message: `Only ${freeRooms.length} rooms available for ${roomType}`
//           });
//         }

//         const autoAssigned = freeRooms.slice(0, roomsRequested);

//         assignedRoomsFinal.push(...autoAssigned);
//       }

//       // --------------------------
//       // ⭐ PRICING LOGIC
//       // --------------------------
//       let baseTotal = 0;
//       for (let i = 0; i < roomsRequested; i++) {
//         const occ = occupancyType[i] || "double";
//         const occKey = occ === "single" ? "single" : "double";
//         baseTotal += pricing?.[mealPlan]?.[occKey] ?? 0;
//       }

//       let childCost = 0;
//       childrenAges.forEach(age => {
//         if (age === "1-5") return;

//         if (age === "6-11") {
//           childCost += pricing.childPolicy?.age6to11?.[mealPlan] ?? 0;
//         }

//         if (age === "12+") {
//           const avg = baseTotal / roomsRequested;
//           childCost += avg;
//         }
//       });

//       const doubleCount = occupancyType.filter(o => o === "double").length;
//       const maxExtra = doubleCount;
//       const appliedExtraBeds = Math.min(extraBed, maxExtra);
//       const extraBedPrice = pricing.extraBed?.[mealPlan] ?? 0;
//       const extraBedCost = appliedExtraBeds * extraBedPrice;

//       const perNightTotal = baseTotal + childCost + extraBedCost;
//       total += perNightTotal * nights;

//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType,
//         mealPlan,
//         adults,
//         children: childrenAges.map(age => ({ age })),
//         extraBeds: appliedExtraBeds,
//         extraBedPrice,
//         extraBedCostPerNight: extraBedCost,
//         childCostPerNight: childCost,
//         pricePerNight: baseTotal
//       });
//     }

//     // ----------------------------------------------------------------
//     // ⭐ 3. APPLY FRONTEND ASSIGNED ROOMS (OVERRIDE EVERYTHING)
//     // ----------------------------------------------------------------
//     if (!shouldAutoAssign) {
//       assignedRoomsFinal = frontendAssignedRooms;
//     }

//     // ----------------------------------------------------------------
//     // ⭐ SAVE BOOKING
//     // ----------------------------------------------------------------
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,

//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },

//       specialRequest,
//       totalPrice: total,
//       transactionNumber: journalNumber || "",
//       assignedRoom: assignedRoomsFinal, // <-- FINAL CORRECT VALUE
//       status: statusOverride || "pending"
//     });

//     // ----------------------------------------------------------------
//     // ⭐ EMAILS (unchanged)
//     // ----------------------------------------------------------------
//     const htmlUser = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">Booking Received</h2>
//         <p>Dear <strong>${firstName}</strong>,</p>
//         <p><strong>Assigned Rooms:</strong> ${assignedRoomsFinal.join(", ")}</p>
//         <p><strong>Total Price:</strong> BTN ${total.toFixed(2)}</p>
//       </div>
//     `;

//     const htmlAdmin = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">New Booking</h2>
//         <p><strong>No:</strong> ${bookingNumber}</p>
//         <p><strong>Assigned Rooms:</strong> ${assignedRoomsFinal.join(", ")}</p>
//         <p><strong>Total:</strong> BTN ${total.toFixed(2)}</p>
//       </div>
//     `;

//     try {
//       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlUser);
//       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlAdmin);
//     } catch (err) {
//       console.log("Email error:", err.message);
//     }

//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
exports.createBooking = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      country,
      phone,
      checkIn,
      checkOut,
      roomSelection,
      specialRequest,
      journalNumber,
      statusOverride,
      assignedRoom // <-- manual rooms from FE
    } = req.body;

    // ----------------------------------------------------
    // BASIC VALIDATION
    // ----------------------------------------------------
    if (!roomSelection?.length)
      return res.status(400).json({ message: "Room selection is required" });

    if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
      return res.status(400).json({ message: "Invalid dates" });

    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    const nights = Math.ceil((co - ci) / 86400000);
    if (nights <= 0)
      return res.status(400).json({ message: "Check-out must be after check-in" });

    let total = 0;
    let roomDetails = [];

    // ----------------------------------------------------
    // FINAL ASSIGNED ROOMS (manual OR auto)
    // ----------------------------------------------------
    let assignedRoomsFinal = [];

    // Manual selected rooms
    const manualRooms =
      Array.isArray(assignedRoom) && assignedRoom.length > 0
        ? assignedRoom.map(r => String(r))
        : [];

    const isManual = manualRooms.length > 0;

    // ====================================================
    // ⭐ 1. DOUBLE BOOKING PREVENTION (MANUAL ROOMS)
    // ====================================================
    if (isManual) {
      const conflict = await Booking.findOne({
        assignedRoom: { $in: manualRooms },
        checkIn: { $lte: co },
        checkOut: { $gte: ci },
        status: { $in: ["pending", "confirmed", "guaranteed", "checked_in"] }
      });

      if (conflict) {
        return res.status(400).json({
          message: `One or more selected rooms are already booked`
        });
      }

      assignedRoomsFinal = [...manualRooms];
    }

    // ====================================================
    // ⭐ 2. PROCESS ROOM TYPES
    // ====================================================
    for (const reqRoom of roomSelection) {
      const {
        roomType,
        roomsRequested = 1,
        occupancyType = [],
        mealPlan,
        adults,
        childrenAges = [],
        extraBed = 0
      } = reqRoom;

      const roomDoc = await Room.findOne({ roomType });
      if (!roomDoc)
        return res.status(400).json({ message: `Room ${roomType} not found` });

      const pricing = roomDoc.pricing;

      // ----------------------------------------------------
      // ⭐ AUTO ASSIGN ROOMS IF MANUAL NOT PROVIDED
      // ----------------------------------------------------
      if (!isManual) {
        const allowedRooms = roomDoc.roomNumbers.map(String);

        const overlapping = await Booking.find({
          "rooms.roomType": roomType,
          checkIn: { $lte: co },
          checkOut: { $gte: ci },
          status: { $in: ["pending", "confirmed", "guaranteed", "checked_in"] }
        });

        const usedRooms = overlapping.flatMap(b => b.assignedRoom).map(String);

        const freeRooms = allowedRooms.filter(r => !usedRooms.includes(r));

        if (freeRooms.length < roomsRequested) {
          return res.status(400).json({
            message: `Only ${freeRooms.length} rooms available for ${roomType}`
          });
        }

        assignedRoomsFinal.push(...freeRooms.slice(0, roomsRequested));
      }

      // ----------------------------------------------------
      // ⭐ PRICING
      // ----------------------------------------------------
      let baseTotal = 0;

      for (let i = 0; i < roomsRequested; i++) {
        const occ = occupancyType[i] || "double";
        const occKey = occ === "single" ? "single" : "double";
        const price = pricing?.[mealPlan]?.[occKey] ?? 0;
        baseTotal += price;
      }

      let childCost = 0;
      childrenAges.forEach(age => {
        if (age === "6-11")
          childCost += pricing.childPolicy?.age6to11?.[mealPlan] ?? 0;

        if (age === "12+") {
          childCost += baseTotal / roomsRequested;
        }
      });

      const doubleCount = occupancyType.filter(o => o === "double").length;
      const appliedExtraBeds = Math.min(extraBed, doubleCount);
      const extraBedPrice = pricing.extraBed?.[mealPlan] ?? 0;
      const extraBedCost = appliedExtraBeds * extraBedPrice;

      const perNightTotal = baseTotal + childCost + extraBedCost;
      total += perNightTotal * nights;

      roomDetails.push({
        roomType,
        quantity: roomsRequested,
        occupancyType,
        mealPlan,
        adults,
        children: childrenAges.map(age => ({ age })),
        extraBeds: appliedExtraBeds,
        extraBedPrice,
        extraBedCostPerNight: extraBedCost,
        childCostPerNight: childCost,
        pricePerNight: baseTotal
      });
    }

    // ====================================================
    // ⭐ 3. FINAL — ALWAYS USE EXACT MANUAL ROOMS IF SET
    // ====================================================
    if (isManual) {
      assignedRoomsFinal = manualRooms;
    }

    // ====================================================
    // ⭐ 4. SAVE BOOKING
    // ====================================================
    const bookingNumber = await generateBookingNumber();

    const booking = await Booking.create({
      bookingNumber,
      firstName,
      lastName,
      email,
      country,
      phoneNumber: phone,
      checkIn: ci,
      checkOut: co,
      rooms: roomDetails,
      meals: {
        breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
        lunch: roomDetails.some(r => r.mealPlan === "ap"),
        dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
      },
      specialRequest,
      totalPrice: total,
      transactionNumber: journalNumber || "",
      assignedRoom: assignedRoomsFinal,
      status: statusOverride || "pending"
    });

    // ====================================================
    // ⭐ 5. EMAILS
    // ====================================================
    // const htmlUser = `
    //   <div style="font-family: Arial; padding: 20px;">
    //     <h2 style="color:#006600;">Booking Received</h2>
    //     <p>Assigned Rooms: ${assignedRoomsFinal.join(", ")}</p>
    //     <p>Total: BTN ${total.toFixed(2)}</p>
    //   </div>
    // `;

    // const htmlAdmin = `
    //   <div style="font-family: Arial; padding: 20px;">
    //     <h2 style="color:#006600;">New Booking</h2>
    //     <p>Rooms: ${assignedRoomsFinal.join(", ")}</p>
    //     <p>Total: BTN ${total.toFixed(2)}</p>
    //   </div>
    // `;
    const htmlUser = `
<div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
    <h2 style="color: #006600;">Booking Received</h2>

    <p>Dear <strong>${firstName} ${lastName}</strong>,</p>

    <p>Your booking request has been <strong>received successfully</strong>.</p>

    <h3 style="color:#333;">Booking Details</h3>

    <p><strong>Booking Number:</strong> ${bookingNumber}</p>
    <p><strong>Assigned Rooms:</strong> ${assignedRoomsFinal.join(", ") || "Not assigned yet"}</p>
    <p><strong>Check-In:</strong> ${ci.toDateString()}</p>
    <p><strong>Check-Out:</strong> ${co.toDateString()}</p>
    <p><strong>Total Amount:</strong> BTN ${total.toFixed(2)}</p>

    <p style="margin-top:20px;">
      Thank you for choosing <strong>Hotel Thim-Dorji</strong>.
      We will contact you shortly regarding your reservation.
    </p>

    <p style="margin-top:25px;">
      Best Regards,<br>
      <strong>Hotel Reservation Team</strong>
    </p>
  </div>
</div>
`;

const htmlAdmin = `
<div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
    <h2 style="color: #006600;">New Booking Received</h2>

    <h3 style="color:#333;">Guest Information</h3>

    <p><strong>Name:</strong> ${firstName} ${lastName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Country:</strong> ${country}</p>

    <h3 style="color:#333;">Booking Details</h3>

    <p><strong>Booking Number:</strong> ${bookingNumber}</p>
    <p><strong>Assigned Rooms:</strong> ${assignedRoomsFinal.join(", ") || "Not assigned yet"}</p>
    <p><strong>Check-In:</strong> ${ci.toDateString()}</p>
    <p><strong>Check-Out:</strong> ${co.toDateString()}</p>
    <p><strong>Total Amount:</strong> BTN ${total.toFixed(2)}</p>

    <p style="margin-top:25px;">
      Best Regards,<br>
      <strong>Hotel Reservation System</strong>
    </p>
  </div>
</div>
`;

    try {
      await sendMailWithGmailApi(email, `Booking ${bookingNumber}`, htmlUser);
      await sendMailWithGmailApi(adminEmail, `New Booking ${bookingNumber}`, htmlAdmin);
    } catch (err) {
      console.log("Email error:", err.message);
    }

    return res.status(201).json({
      message: "Booking created successfully",
      booking
    });
  } catch (err) {
    console.error("Booking creation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest,
//       journalNumber,
//       statusOverride,
//       assignedRoom // <-- ARRAY FROM FRONTEND (manual selection)
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);
//     const nights = Math.ceil((co - ci) / 86400000);

//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });

//     let total = 0;
//     let roomDetails = [];

//     // -----------------------------------------------------------------------------------
//     // ⭐ FINAL ROOMS LIST — manual OR auto
//     // -----------------------------------------------------------------------------------
//     let assignedRoomsFinal = [];

//     // Manual selection from frontend
//     const manualRooms =
//       Array.isArray(assignedRoom) && assignedRoom.length > 0
//         ? assignedRoom.map(r => String(r))
//         : [];

//     const isManual = manualRooms.length > 0;

//     // ===================================================================================
//     // ⭐ 1. VALIDATE MANUAL ROOMS (DOUBLE BOOKING PREVENTION)
//     // ===================================================================================
//     if (isManual) {
//       // check overlapping bookings on selected rooms
//       const conflict = await Booking.findOne({
//         assignedRoom: { $in: manualRooms },
//         checkIn: { $lte: co },
//         checkOut: { $gte: ci },
//         status: { $in: ["pending", "confirmed", "guaranteed", "checked_in"] }
//       });

//       if (conflict) {
//         return res.status(400).json({
//           message: `Room ${conflict.assignedRoom.join(", ")} is already booked for these dates`
//         });
//       }

//       // Use exactly what user selected
//       assignedRoomsFinal = [...manualRooms];
//     }

//     // ===================================================================================
//     // ⭐ 2. PROCESS EACH ROOM TYPE + AUTO ASSIGN ONLY IF MANUAL NOT GIVEN
//     // ===================================================================================
//     for (const reqRoom of roomSelection) {
//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyType = [],
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed = 0
//       } = reqRoom;

//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // ------------------------------------------------------------------------------
//       // ⭐ AUTO ASSIGN ONLY WHEN MANUAL IS EMPTY
//       // ------------------------------------------------------------------------------
//       if (!isManual) {
//         const allowedRooms = roomDoc.roomNumbers.map(String);

//         const overlapping = await Booking.find({
//           "rooms.roomType": roomType,
//           checkIn: { $lte: co },
//           checkOut: { $gte: ci },
//           status: { $in: ["pending", "confirmed", "guaranteed", "checked_in"] }
//         });

//         const usedRooms = overlapping.flatMap(b => b.assignedRoom).map(String);

//         const freeRooms = allowedRooms.filter(r => !usedRooms.includes(r));

//         if (freeRooms.length < roomsRequested) {
//           return res.status(400).json({
//             message: `Only ${freeRooms.length} rooms available for ${roomType}`
//           });
//         }

//         const autoAssigned = freeRooms.slice(0, roomsRequested);
//         assignedRoomsFinal.push(...autoAssigned);
//       }

//       // ------------------------------------------------------------------------------
//       // ⭐ PRICING
//       // ------------------------------------------------------------------------------
//       let baseTotal = 0;
//       for (let i = 0; i < roomsRequested; i++) {
//         const occ = occupancyType[i] || "double";
//         const occKey = occ === "single" ? "single" : "double";
//         baseTotal += pricing?.[mealPlan]?.[occKey] ?? 0;
//       }

//       let childCost = 0;
//       childrenAges.forEach(age => {
//         if (age === "6-11")
//           childCost += pricing.childPolicy?.age6to11?.[mealPlan] ?? 0;

//         if (age === "12+") {
//           const avg = baseTotal / roomsRequested;
//           childCost += avg;
//         }
//       });

//       const doubleCount = occupancyType.filter(o => o === "double").length;
//       const appliedExtraBeds = Math.min(extraBed, doubleCount);
//       const extraBedPrice = pricing.extraBed?.[mealPlan] ?? 0;
//       const extraBedCost = appliedExtraBeds * extraBedPrice;

//       const perNightTotal = baseTotal + childCost + extraBedCost;
//       total += perNightTotal * nights;

//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType,
//         mealPlan,
//         adults,
//         children: childrenAges.map(age => ({ age })),
//         extraBeds: appliedExtraBeds,
//         extraBedPrice,
//         extraBedCostPerNight: extraBedCost,
//         childCostPerNight: childCost,
//         pricePerNight: baseTotal
//       });
//     }

//     // ===================================================================================
//     // ⭐ 3. SAVE BOOKING
//     // ===================================================================================
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,

//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },

//       specialRequest,
//       totalPrice: total,
//       transactionNumber: journalNumber || "",
//       assignedRoom: assignedRoomsFinal,
//       status: statusOverride || "pending"
//     });

//     // ===================================================================================
//     // ⭐ EMAILS (UNCHANGED)
//     // ===================================================================================
//     const htmlUser = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">Booking Received</h2>
//         <p>Assigned Rooms: ${assignedRoomsFinal.join(", ")}</p>
//       </div>
//     `;

//     const htmlAdmin = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">New Booking</h2>
//         <p>Rooms: ${assignedRoomsFinal.join(", ")}</p>
//       </div>
//     `;

//     try {
//       await sendMailWithGmailApi(email, `Booking ${bookingNumber}`, htmlUser);
//       await sendMailWithGmailApi(adminEmail, `New Booking ${bookingNumber}`, htmlAdmin);
//     } catch (err) {
//       console.log("Email error:", err.message);
//     }

//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };


// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest,
//       journalNumber,
//       statusOverride
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);
//     const nights = Math.ceil((co - ci) / 86400000);

//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });


//     // ---------------------------------------------------
//     // PROCESS MULTI-ROOM SELECTION
//     // ---------------------------------------------------
//     let total = 0;
//     let roomDetails = [];

//     for (const reqRoom of roomSelection) {

//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyType = [],     // ARRAY from frontend
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed = 0
//       } = reqRoom;

//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // ------------------ BASE ROOM TOTAL ------------------
//       let baseTotal = 0;

//       for (let i = 0; i < roomsRequested; i++) {
//         const occ = occupancyType[i] || "double";
//         const occKey = occ === "single" ? "single" : "double";

//         const base = pricing?.[mealPlan]?.[occKey] ?? 0;
//         baseTotal += base;
//       }

//       // ------------------ EXTRA BEDS ------------------
//       const doubleCount = occupancyType.filter(o => o === "double").length;
//       const maxExtra = doubleCount;

//       const appliedExtraBeds = Math.min(extraBed, maxExtra);
//       const extraBedPrice = pricing.extraBed?.[mealPlan] ?? 0;
//       const extraBedCost = appliedExtraBeds * extraBedPrice;

//       // ------------------ CHILDREN COST ------------------
//       let childCost = 0;

//       childrenAges.forEach(age => {
//         if (age === "1-5") return;

//         if (age === "6-11") {
//           childCost += pricing.childPolicy?.age6to11?.[mealPlan] ?? 0;
//         }

//         if (age === "12+") {
//           const avg = baseTotal / roomsRequested;
//           childCost += avg;
//         }
//       });

//       const perNightTotal = baseTotal + extraBedCost + childCost;
//       total += perNightTotal * nights;

//       // ------------------ SAVE ROOM BLOCK ------------------
//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType,   // ARRAY 그대로 저장
//         mealPlan,
//         adults,
//         children: childrenAges.map(age => ({ age })),
//         extraBeds: appliedExtraBeds,
//         extraBedPrice,
//         extraBedCostPerNight: extraBedCost,
//         childCostPerNight: childCost,
//         pricePerNight: baseTotal
//       });
//     }


//     // ---------------------------------------------------
//     // SAVE BOOKING
//     // ---------------------------------------------------
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,

//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },

//       specialRequest,
//       totalPrice: total,
//       transactionNumber: journalNumber || "",
//       assignedRoom: [],
//       status: statusOverride || "pending"
//     });


//     // ---------------------------------------------------
//     // EMAILS
//     // ---------------------------------------------------
//     const htmlUser = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">Booking Received</h2>
//         <p>Dear <strong>${firstName}</strong>,</p>
//         <p>Your booking has been received.</p>

//         <h3>Booking Summary</h3>
//         <p><strong>Booking No:</strong> ${bookingNumber}</p>
//         <p><strong>Total Price:</strong> BTN ${total.toFixed(2)}</p>
//       </div>
//     `;

//     const htmlAdmin = `
//       <div style="font-family: Arial; padding: 20px;">
//         <h2 style="color:#006600;">New Booking Received</h2>
//         <p><strong>${firstName} ${lastName}</strong></p>
//         <p>${email}</p>

//         <h3>Booking Summary</h3>
//         <p><strong>No:</strong> ${bookingNumber}</p>
//         <p><strong>Total:</strong> BTN ${total.toFixed(2)}</p>
//       </div>
//     `;

//     try {
//       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlUser);
//       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlAdmin);
//     } catch (err) {
//       console.log("Email error:", err.message);
//     }

//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// exports.createBooking = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       country,
//       phone,
//       checkIn,
//       checkOut,
//       roomSelection,
//       specialRequest,
//       journalNumber,
//       statusOverride     // "confirmed" | "guaranteed" | undefined
//     } = req.body;

//     if (!roomSelection?.length)
//       return res.status(400).json({ message: "Room selection is required" });

//     // Validate dates
//     if (!validator.isDate(checkIn) || !validator.isDate(checkOut))
//       return res.status(400).json({ message: "Invalid dates" });

//     const ci = new Date(checkIn);
//     const co = new Date(checkOut);
//     const nights = Math.ceil((co - ci) / (1000 * 60 * 60 * 24));

//     if (nights <= 0)
//       return res.status(400).json({ message: "Check-out must be after check-in" });

//     // -----------------------------------------------------------
//     // MULTI-ROOM HANDLING
//     // -----------------------------------------------------------
//     let total = 0;
//     let roomDetails = [];

//     for (const reqRoom of roomSelection) {

//       const {
//         roomType,
//         roomsRequested = 1,
//         occupancyTypes = [],        // ARRAY → ["double", "single"]
//         mealPlan,
//         adults,
//         childrenAges = [],
//         extraBed = 0                // TOTAL extra beds
//       } = reqRoom;

//       const roomDoc = await Room.findOne({ roomType });
//       if (!roomDoc)
//         return res.status(400).json({ message: `Room ${roomType} not found` });

//       const pricing = roomDoc.pricing;

//       // -----------------------------------------
//       // BASE ROOM PRICE (sum of each occupancy)
//       // -----------------------------------------
//       let baseTotal = 0;

//       for (let i = 0; i < roomsRequested; i++) {
//         const occ = occupancyTypes[i] || "double";
//         const occKey = occ === "single" ? "single" : "double";

//         const base =
//           occKey === "single"
//             ? pricing[mealPlan].single
//             : pricing[mealPlan].double;

//         baseTotal += base;
//       }

//       // -----------------------------------------
//       // EXTRA BEDS — based on double rooms
//       // -----------------------------------------
//       const doubleRooms = occupancyTypes.filter(o => o === "double").length;
//       const maxExtraBeds = doubleRooms;
//       const extraBedsApplied = Math.min(extraBed, maxExtraBeds);

//       const extraBedPrice = pricing.extraBed?.[mealPlan] || 0;
//       const extraBedCost = extraBedsApplied * extraBedPrice;

//       // -----------------------------------------
//       // CHILDREN PRICING (global)
//       // -----------------------------------------
//       let childCost = 0;

//       childrenAges.forEach((age) => {
//         if (age === "1-5") return;

//         if (age === "6-11")
//           childCost += pricing.childPolicy?.age6to11?.[mealPlan] || 0;

//         if (age === "12+") {
//           const avgBase = baseTotal / roomsRequested;
//           childCost += avgBase;
//         }
//       });

//       // per night total for this selection block
//       const perNightTotal = baseTotal + extraBedCost + childCost;

//       total += perNightTotal * nights;

//       // -----------------------------------------
//       // STORE SINGLE OBJECT EXACTLY AS YOU WANT
//       // -----------------------------------------
//       roomDetails.push({
//         roomType,
//         quantity: roomsRequested,
//         occupancyType: occupancyTypes,   // ARRAY
//         mealPlan,
//         adults,
//         children: childrenAges.map(a => ({ age: a })),
//         extraBeds: extraBedsApplied,
//         extraBedPrice,
//         extraBedCostPerNight: extraBedCost,
//         childCostPerNight: childCost,
//         pricePerNight: baseTotal
//       });
//     }

//     // -----------------------------------------------------------
//     // SAVE BOOKING
//     // -----------------------------------------------------------
//     const bookingNumber = await generateBookingNumber();

//     const booking = await Booking.create({
//       bookingNumber,
//       firstName,
//       lastName,
//       email,
//       country,
//       phoneNumber: phone,
//       checkIn: ci,
//       checkOut: co,
//       rooms: roomDetails,

//       meals: {
//         breakfast: roomDetails.some(r => r.mealPlan !== "ep"),
//         lunch: roomDetails.some(r => r.mealPlan === "ap"),
//         dinner: roomDetails.some(r => r.mealPlan === "map" || r.mealPlan === "ap")
//       },

//       specialRequest,
//       totalPrice: total,
//       transactionNumber: journalNumber || "",
//       assignedRoom: [],

//       // override with Confirmed or Guaranteed
//       status: statusOverride || "pending"
//     });

//     // -----------------------------------------------------------
//     // EMAILS (unchanged)
//     // -----------------------------------------------------------

//     const htmlContentUser = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">Booking Received</h2>
//           <p>Dear <strong>${firstName}</strong>,</p>
//           <p>Your booking request has been <strong>received</strong>.</p>
          
//           <h3 style="color:#444;">Booking Summary</h3>
//           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
//           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
//           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
//           <p><strong>Total Rooms:</strong> ${roomDetails.reduce((s,r)=>s+r.quantity,0)}</p>
//           <p><strong>Total Price:</strong> BTN ${total.toFixed(2)}</p>

//           <p style="margin-top: 20px;">Warm regards,<br><strong>Hotel Team</strong></p>
//         </div>
//       </div>
//     `;

//     const htmlContentAdmin = `
//       <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
//         <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
//           <h2 style="color: #006600;">New Booking Received</h2>

//           <h3 style="color:#444;">Customer Info</h3>
//           <p><strong>${firstName} ${lastName}</strong></p>
//           <p>${email}</p>

//           <h3 style="color:#444;">Booking Summary</h3>
//           <p><strong>Booking Number:</strong> ${bookingNumber}</p>
//           <p><strong>Check-in:</strong> ${ci.toDateString()}</p>
//           <p><strong>Check-out:</strong> ${co.toDateString()}</p>
//           <p><strong>Total:</strong> BTN ${total.toFixed(2)}</p>
//         </div>
//       </div>
//     `;

//     try {
//       await sendMailWithGmailApi(email, `Booking Received - ${bookingNumber}`, htmlContentUser);
//       await sendMailWithGmailApi(adminEmail, `New Booking - ${bookingNumber}`, htmlContentAdmin, { from: email });
//     } catch (e) {
//       console.error("EMAIL ERROR:", e.message);
//     }

//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking
//     });

//   } catch (err) {
//     console.error("Booking creation error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };


// ASSIGN ROOM
exports.assignRoom = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { assignedRoom } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const bookingRoomType = booking.rooms?.[0]?.roomType;
    const validRooms = roomNumberList[bookingRoomType] || [];

    const roomsToAssign = Array.isArray(assignedRoom)
      ? assignedRoom
      : [assignedRoom];

    const invalidRooms = roomsToAssign.filter((r) => !validRooms.includes(r));
    if (invalidRooms.length > 0) {
      return res.status(400).json({
        message: `Invalid room(s) for ${bookingRoomType}: ${invalidRooms.join(", ")}`,
      });
    }

    booking.assignedRoom = roomsToAssign;
    await booking.save();

    await addBookingToSheet(booking);

    res.status(200).json({
      message: `Room(s) ${booking.assignedRoom.join(", ")} assigned successfully.`,
      booking,
    });
  } catch (err) {
    console.error("Room assignment error:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { transactionNumber } = req.body;

    if (!transactionNumber) {
      return res.status(400).json({ message: 'Transaction number required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update booking status
    booking.status = "confirmed"; 
    booking.transactionNumber = transactionNumber;
    await booking.save();
await removeBookingFromSheet(booking);
    await updateBookingInSheet(booking);

    // -------------------------------------
    // SEND EMAIL USING GMAIL API
    // -------------------------------------

    try {
      const recipient = booking.isAgencyBooking 
        ? booking.agencyEmail 
        : booking.email;

      if (recipient) {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
            <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
              
              <h2 style="color: #006600;">Booking Confirmed</h2>

              <p>Dear <strong>${booking.isAgencyBooking ? booking.agentName : booking.firstName}</strong>,</p>

              <p>Your booking has been <strong>successfully confirmed</strong> after receiving the payment deposit.</p>

              <h3 style="color:#444;">Booking Details</h3>
              <p><strong>Booking Number:</strong> ${booking.bookingNumber}</p>
              <p><strong>Room Type:</strong> ${booking.rooms[0].roomType}</p>
              <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toDateString()}</p>
              <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toDateString()}</p>

              <h3 style="margin-top:20px;color:#444;">Payment</h3>
              <p><strong>Transaction Number:</strong> ${transactionNumber}</p>
              <p>Status: <span style="color:green;"><strong>Confirmed</strong></span></p>

              <p style="margin-top: 20px;">
                Best Regards,<br>
                <strong>Hotel Management Team</strong>
              </p>

            </div>
          </div>
        `;

        await sendMailWithGmailApi(
          recipient,
          `Booking Confirmed - ${booking.bookingNumber}`,
          htmlContent
        );
      }

    } catch (emailErr) {
      console.error("EMAIL SEND ERROR (confirmBooking):", emailErr.message);
    }

    // -------------------------------------
    // RESPONSE
    // -------------------------------------
    res.status(200).json({
      message: "Booking confirmed.",
      booking
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.guaranteeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { transactionNumber } = req.body;

    if (!transactionNumber)
      return res.status(400).json({ message: "Transaction number required" });

    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    // Update booking
    booking.status = "guaranteed"; // full payment done
    booking.transactionNumber = transactionNumber;
    await booking.save();
await removeBookingFromSheet(booking);
    await updateBookingInSheet(booking);

    // -----------------------------------------------------------
    //  SEND EMAIL TO GUEST (same style template as changePassword)
    // -----------------------------------------------------------

    const fullName = booking.isAgencyBooking
      ? booking.agentName || "Guest"
      : `${booking.firstName} ${booking.lastName}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #006600;">Booking Guaranteed</h2>

          <p>Dear <strong>${fullName}</strong>,</p>

          <p>Your booking has been <strong>fully guaranteed</strong> after receiving your payment.</p>

          <h3 style="color:#333;">Booking Details</h3>

          <p><strong>Booking Number:</strong> ${booking.bookingNumber}</p>
          <p><strong>Room Type:</strong> ${booking.rooms[0].roomType}</p>
          
          <p><strong>Check-In:</strong> ${booking.checkIn.toDateString()}</p>
          <p><strong>Check-Out:</strong> ${booking.checkOut.toDateString()}</p>
          <p><strong>Transaction Number:</strong> ${transactionNumber}</p>

          <p style="margin-top:20px;">
            Thank you for choosing <strong>Hotel Thim-Dorji</strong>.  
            We look forward to welcoming you.
          </p>

          <p style="margin-top: 25px;">Best Regards,<br><strong>Hotel Reservation Team</strong></p>
        </div>
      </div>
    `;

    // Send email (Gmail API)
    const guestEmail = booking.isAgencyBooking
      ? booking.agencyEmail
      : booking.email;

    if (guestEmail) {
      await sendMailWithGmailApi(
        guestEmail,
        "Your Booking is Guaranteed",
        htmlContent
      );
    }

    // -----------------------------------------------------------

    res.status(200).json({
      message: "Booking guaranteed and email sent.",
      booking,
    });

  } catch (error) {
    console.error("Guarantee Booking Error:", error);
    res.status(500).json({ message: error.message });
  }
};
exports.rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    // Only pending bookings can be rejected
    if (booking.status !== "pending") {
      return res.status(400).json({
        message: `Cannot reject booking in status: ${booking.status}`,
      });
    }

    // Update booking
    booking.status = "rejected";
    booking.rejectReason = reason || "No reason provided";
    booking.assignedRoom = [];
    await booking.save();

    await removeBookingFromSheet(booking);

    // -----------------------------------------------------------
    // 📧 SEND REJECTION EMAIL (Styled)
    // -----------------------------------------------------------

    const fullName = booking.isAgencyBooking
      ? booking.agentName || "Guest"
      : `${booking.firstName} ${booking.lastName}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">
          
          <h2 style="color: #cc0000;">Booking Rejected</h2>

          <p>Dear <strong>${fullName}</strong>,</p>

          <p>We regret to inform you that your booking request has been <strong>rejected</strong>.</p>

          <h3 style="color:#333;">Booking Details</h3>

          <p><strong>Booking Number:</strong> ${booking.bookingNumber}</p>
          <p><strong>Room Type:</strong> ${booking.rooms[0].roomType}</p>
          <p><strong>Check-In:</strong> ${booking.checkIn.toDateString()}</p>
          <p><strong>Check-Out:</strong> ${booking.checkOut.toDateString()}</p>

          <h3 style="color:#333;">Reason for Rejection</h3>
          <p style="color:#cc0000;"><strong>${booking.rejectReason}</strong></p>

          <p style="margin-top:20px;">
            If you have any questions or wish to modify your booking, please contact our reservations team.
          </p>

          <p style="margin-top: 25px;">Best Regards,<br><strong>Hotel Reservation Team</strong></p>
        </div>
      </div>
    `;

    const guestEmail = booking.isAgencyBooking
      ? booking.agencyEmail
      : booking.email;

    if (guestEmail) {
      await sendMailWithGmailApi(
        guestEmail,
        "Your Booking Has Been Rejected",
        htmlContent
      );
    }

    // -----------------------------------------------------------

    res.status(200).json({
      message: "Booking rejected successfully, email sent.",
      booking,
    });

  } catch (err) {
    console.error("Reject booking error:", err);
    res.status(500).json({ message: err.message });
  }
};


// CHECK-IN
exports.checkInBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = "checked_in";
    await booking.save();

    await updateBookingInSheet(booking);
    res.status(200).json({ message: 'Guest checked in', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// AUTO CHECKOUT
cron.schedule("0 0 * * *", async () => {
  const today = new Date();
  const bookings = await Booking.find({ status: "checked_in", checkOut: { $lte: today } });
  for (const booking of bookings) {
    booking.status = "checked_out";
    await booking.save();
    await updateBookingInSheet(booking);
  }
});

// CHANGE ROOM
exports.changeRoom = async (req, res) => {
  try {
    const { bookingId } = req.params;
    let { newRoom } = req.body;

    if (!newRoom || !String(newRoom).trim()) {
      return res.status(400).json({ message: "Please provide at least one room number." });
    }

    const newRooms = Array.isArray(newRoom)
      ? newRoom.map((r) => r.trim())
      : String(newRoom)
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean);

    if (newRooms.length === 0) {
      return res.status(400).json({ message: "Please provide at least one valid room number." });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const roomType = booking.rooms[0].roomType;

    const roomDoc = await Room.findOne({ roomType });
    if (!roomDoc)
      return res.status(404).json({ message: `Room type '${roomType}' not found.` });

    const allowedRooms = roomDoc.roomNumbers.map((r) =>
      String(r).replace(/["[\]]/g, "").trim()
    );

    const invalidRooms = newRooms.filter((r) => !allowedRooms.includes(r));
    if (invalidRooms.length > 0) {
      return res.status(400).json({
        message: `Invalid room(s): ${invalidRooms.join(", ")} for ${roomType}. 
Allowed rooms: ${allowedRooms.join(", ")}`,
      });
    }

    const overlapping = await Booking.find({
      _id: { $ne: bookingId },
      assignedRoom: { $in: newRooms },
      checkIn: { $lte: booking.checkOut },
      checkOut: { $gte: booking.checkIn },
      status: { $in: ["pending", "confirmed", "checked_in"] },
    });

    if (overlapping.length > 0) {
      const taken = overlapping.map((b) => b.assignedRoom).flat();
      const conflict = newRooms.filter((r) => taken.includes(r));
      return res.status(400).json({
        message: `Room(s) ${conflict.join(", ")} already booked or unavailable.`,
      });
    }

    const oldRooms = booking.assignedRoom || [];
    booking.assignedRoom = newRooms;
    await booking.save();

    res.status(200).json({
      success: true,
      message: `Room(s) changed from [${oldRooms.join(", ")}] → [${newRooms.join(", ")}]`,
      booking,
    });
  } catch (err) {
    console.error("CHANGE ROOM ERROR:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while changing room(s).",
      error: err.message,
    });
  }
};

// GET BOOKINGS
exports.getBookingByNumber = async (req, res) => {
  try {
    const { bookingNumber } = req.params;
    const booking = await Booking.findOne({ bookingNumber });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingBookings = async (_, res) => {
  try {
    const bookings = await Booking.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ bookings });
  } catch {
    res.status(500).json({ message: 'Error' });
  }
};

exports.getConfirmedBookings = async (_, res) => {
  try {
    const bookings = await Booking.find({ status: 'confirmed' }).sort({ createdAt: -1 });
    res.json({ bookings });
  } catch {
    res.status(500).json({ message: 'Error' });
  }
};

exports.getCheckedInBookings = async (_, res) => {
  try {
    const bookings = await Booking.find({ status: 'checked_in' }).sort({ checkIn: 1 });
    res.json({ bookings });
  } catch {
    res.status(500).json({ message: 'Error' });
  }
};
exports.getConfirmedAndGuaranteedBookings = async (_, res) => {
  try {
    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'guaranteed'] }
    }).sort({ createdAt: -1 });

    res.json({ bookings });
  } catch {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
};
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // ❌ RULE 1: Cannot cancel pending → use rejectBooking instead
    if (booking.status === "pending") {
      return res.status(400).json({
        message: "Pending bookings cannot be cancelled. Use reject option."
      });
    }

    // ❌ RULE 2: Cannot cancel guaranteed
    if (booking.status === "guaranteed") {
      return res.status(400).json({
        message: "Guaranteed bookings cannot be cancelled."
      });
    }

    // ❌ RULE 3: Cannot cancel after check-in
    if (booking.status === "checked_in") {
      return res.status(400).json({
        message: "Cannot cancel a checked-in booking."
      });
    }

    // ❌ RULE 4: Already cancelled / ended
    if (["checked_out", "rejected", "cancelled"].includes(booking.status)) {
      return res.status(400).json({
        message: `Booking already ${booking.status}.`
      });
    }

    // ✔ RULE 5: Only confirmed can be cancelled
    if (booking.status !== "confirmed") {
      return res.status(400).json({
        message: "Only confirmed bookings can be cancelled."
      });
    }

    // ⭐ SAVE CANCELLATION REASON
    booking.cancelReason = reason || "No reason provided";

    // ✔ CANCEL BOOKING
    booking.status = "cancelled";
    booking.assignedRoom = [];
    await booking.save();

    await removeBookingFromSheet(booking);

    // -----------------------------------------------------------
    // 📧 SEND CANCELLATION EMAIL (HTML Styled)
    // -----------------------------------------------------------

    const fullName = booking.isAgencyBooking
      ? booking.agentName || "Guest"
      : `${booking.firstName} ${booking.lastName}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 20px; border: 1px solid #ddd;">

          <h2 style="color: #cc0000;">Booking Cancelled</h2>

          <p>Dear <strong>${fullName}</strong>,</p>

          <p>Your booking has been <strong>cancelled</strong> by our reservation team.</p>

          <h3 style="color:#333;">Booking Details</h3>
          <p><strong>Booking Number:</strong> ${booking.bookingNumber}</p>
          <p><strong>Room Type:</strong> ${booking.rooms[0].roomType}</p>
          <p><strong>Check-In:</strong> ${booking.checkIn.toDateString()}</p>
          <p><strong>Check-Out:</strong> ${booking.checkOut.toDateString()}</p>

          <h3 style="color:#333;">Reason for Cancellation</h3>
          <p style="color:#cc0000;"><strong>${booking.cancelReason}</strong></p>

          <p style="margin-top:20px;">
            If you wish, you may create a new booking at any time.  
            Please contact us if you need assistance.
          </p>

          <p style="margin-top: 25px;">Best Regards,<br><strong>Hotel Reservation Team</strong></p>
        </div>
      </div>
    `;

    const guestEmail = booking.isAgencyBooking
      ? booking.agencyEmail
      : booking.email;

    if (guestEmail) {
      await sendMailWithGmailApi(
        guestEmail,
        "Your Booking Has Been Cancelled",
        htmlContent
      );
    }

    // -----------------------------------------------------------

    res.status(200).json({
      message: "Booking cancelled successfully. Email sent.",
      booking,
    });

  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getAllCancelledBookings = async (_, res) => {
  try {
    const bookings = await Booking.find({ status: "cancelled" })
      .sort({ cancelledAt: -1 });

    res.json({ bookings });
  } catch {
    res.status(500).json({ message: "Error fetching cancelled bookings" });
  }
};



// DASHBOARD STATS
exports.getDashboardStats = async (req, res) => {
  try {
    const SAARC_COUNTRIES = [
      "Afghanistan",
      "Bangladesh",
      // "Bhutan",
      "India",
      "Maldives",
      "Nepal",
      "Pakistan",
      "Sri Lanka"
    ];

    const totalBookings = await Booking.countDocuments();

    // Local = Bhutan
    const localGuests = await Booking.countDocuments({
      country: "Bhutan",
    });

    // Regional = SAARC except Bhutan
    const regionalGuests = await Booking.countDocuments({
      country: { $in: SAARC_COUNTRIES.filter(c => c !== "Bhutan") }
    });

    // Foreign = NOT in SAARC
    const foreignGuests = await Booking.countDocuments({
      country: { $nin: SAARC_COUNTRIES },
    });

    res.status(200).json({
      totalBookings,
      localGuests,
      regionalGuests,
      foreignGuests,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// MONTHLY GRAPH DATA
exports.getMonthlyStats = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Year is required" });
    }

    const SAARC_COUNTRIES = [
      "Afghanistan",
      "Bangladesh",
      "Bhutan",
      "India",
      "Maldives",
      "Nepal",
      "Pakistan",
      "Sri Lanka"
    ];

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const monthlyStats = months.map((m) => ({
      month: m,
      local: 0,
      regional: 0,
      foreign: 0,
    }));

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${parseInt(year) + 1}-01-01`);

    const bookings = await Booking.find({
      createdAt: { $gte: startDate, $lt: endDate },
    }).select("country createdAt");

    bookings.forEach((b) => {
      const monthIndex = new Date(b.createdAt).getMonth();
      const country = (b.country || "").trim();

      if (country === "Bhutan") {
        monthlyStats[monthIndex].local += 1;
      } 
      else if (SAARC_COUNTRIES.includes(country)) {
        monthlyStats[monthIndex].regional += 1;
      } 
      else {
        monthlyStats[monthIndex].foreign += 1;
      }
    });

    res.status(200).json(monthlyStats);
  } catch (err) {
    console.error("📊 Monthly stats error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
