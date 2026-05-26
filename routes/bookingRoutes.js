
const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const rateLimit = require("express-rate-limit");

// const bookingLimiter = rateLimit({
//   windowMs: 10 * 60 * 1000, 
//   max: 6,
//   message: { message: "Too many booking attempts, please try again later." }
// });
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,  // ⭐ REQUIRED
  legacyHeaders: false,   // ⭐ REQUIRED
  message: { message: "Too many booking attempts, please try again later." }
});



const {
  authenticateAdmin,
  authenticateReceptionist,
  authenticateAdminOrReceptionist,
} = require("../controllers/adminController");


// -------------------------
// PUBLIC ROUTES
// -------------------------
router.post("/book-rooms", bookingLimiter,bookingController.createBooking);
router.get("/search/:bookingNumber", bookingController.getBookingByNumber);


// -------------------------
// GET ROUTES (ADMIN + RECEPTIONIST)
// -------------------------
router.get("/pending", authenticateAdminOrReceptionist, bookingController.getPendingBookings);
router.get("/confirmed", authenticateAdminOrReceptionist, bookingController.getConfirmedBookings);
router.get("/checked-in", authenticateAdminOrReceptionist, bookingController.getCheckedInBookings);
router.get("/cancelled/all", authenticateAdminOrReceptionist, bookingController.getAllCancelledBookings);

// Dashboard (both)
router.get("/dashboard/stats", authenticateAdminOrReceptionist, bookingController.getDashboardStats);
router.get("/dashboard/monthly", authenticateAdminOrReceptionist, bookingController.getMonthlyStats);


// -------------------------
// ACTION ROUTES (RECEPTIONIST ONLY)
// -------------------------
router.put("/assign-room/:bookingId", authenticateReceptionist, bookingController.assignRoom);
router.put("/confirm/:bookingId", authenticateReceptionist, bookingController.confirmBooking);
router.put("/reject/:bookingId", authenticateReceptionist, bookingController.rejectBooking);

router.put("/checkin/:bookingId", authenticateReceptionist, bookingController.checkInBooking);
router.put("/change-room/:bookingId", authenticateReceptionist, bookingController.changeRoom);

router.put("/guarantee-booking/:bookingId", authenticateReceptionist, bookingController.guaranteeBooking);

router.get("/confirmed-guaranteed-bookings", authenticateReceptionist, bookingController.getConfirmedAndGuaranteedBookings);

router.put("/cancel/:bookingId", authenticateReceptionist, bookingController.cancelBooking);


module.exports = router;
