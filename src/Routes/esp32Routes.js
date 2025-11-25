const express = require("express");
const router = express.Router();

const { receiveMeasurements } = require("../controllers/esp32Controller");

router.post("/esp32", receiveMeasurements);

module.exports = router;
