const jwt = require("jsonwebtoken");

/**
 * Requires a valid customer JWT (from /api/auth/login or /api/auth/register).
 * Attaches req.userId on success.
 */
function verifyCustomer(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "customer") throw new Error("Wrong role");
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}

/**
 * Requires a valid admin JWT (from /api/admin/login).
 */
function verifyAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin login required." });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") throw new Error("Wrong role");
    next();
  } catch (err) {
    res.status(401).json({ message: "Your admin session has expired. Please log in again." });
  }
}

/**
 * Optional auth: if a valid customer token is present, attaches req.userId.
 * Does NOT block the request if the token is missing or invalid — used for
 * guest checkout, where logging in is nice-to-have but not required.
 */
function optionalCustomer(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
      if (decoded.role === "customer") req.userId = decoded.id;
    } catch (err) {
      // invalid/expired token — treat the request as a guest, don't block it
    }
  }
  next();
}

module.exports = { verifyCustomer, verifyAdmin, optionalCustomer };
