const requireAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    next();
};

const requireAdminOrOperator = (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'operator') {
        return res.status(403).json({ error: "Forbidden: Admin or Operator access required" });
    }
    next();
};

const restrictWriteToAdminOrOperator = (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        if (req.userRole !== 'admin' && req.userRole !== 'operator') {
            return res.status(403).json({ error: "Forbidden: Write permissions required" });
        }
    }
    next();
};

module.exports = {
    requireAdmin,
    requireAdminOrOperator,
    restrictWriteToAdminOrOperator
};
