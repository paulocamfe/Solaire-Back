function success(res, data, message = 'OK') {
  return res.json({ success: true, message, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

module.exports = { success, fail };
