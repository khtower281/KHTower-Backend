import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private/Admin
export const createTransaction = async (req, res) => {
  try {
    const {
      date,
      description,
      checkNo,
      receiptUrl,
      receiptType,
      paymentMethod,
      amountPKR,
      category,
      status,
    } = req.body;

    // Validate category exists
    const cat = await Category.findById(category);
    if (!cat) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // Check No required for Check payment
    if (paymentMethod === "Check" && (!checkNo || !checkNo.trim())) {
      return res
        .status(400)
        .json({ message: "Check No is required for Check payments" });
    }

    const transaction = await Transaction.create({
      date: date || Date.now(),
      description: description?.trim(),
      checkNo: checkNo?.trim() || "",
      receiptUrl: receiptUrl || "",
      receiptType: receiptType || "",
      paymentMethod,
      amountPKR,
      category,
      status: status || "Pending",
    });

    const populated = await transaction.populate("category", "name color");

    return res.status(201).json({
      message: "Transaction created successfully",
      transaction: populated,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all transactions (with filters, sorting, pagination)
// @route   GET /api/transactions
// @access  Private/Admin
export const getTransactions = async (req, res) => {
  try {
    const {
      // filters
      category,
      status,
      paymentMethod,
      startDate,
      endDate,
      search,
      // sorting
      sortBy = "date", // date | amountPKR | serialNo
      sortOrder = "desc", // asc | desc
      // pagination
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Search in description / checkNo
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ description: regex }, { checkNo: regex }];
    }

    // Sort direction
    const direction = sortOrder === "asc" ? 1 : -1;
    const allowedSorts = ["date", "amountPKR", "serialNo"];
    const sortField = allowedSorts.includes(sortBy) ? sortBy : "date";

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("category", "name color")
        .sort({ [sortField]: direction })
        .skip(skip)
        .limit(limitNum),
      Transaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      count: transactions.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      transactions,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private/Admin
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate(
      "category",
      "name color"
    );

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.status(200).json({ transaction });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private/Admin
export const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const {
      date,
      description,
      checkNo,
      receiptUrl,
      receiptType,
      paymentMethod,
      amountPKR,
      category,
      status,
    } = req.body;

    if (category) {
      const cat = await Category.findById(category);
      if (!cat) return res.status(400).json({ message: "Invalid category" });
      transaction.category = category;
    }

    const finalPaymentMethod = paymentMethod || transaction.paymentMethod;
    const finalCheckNo =
      checkNo !== undefined ? checkNo.trim() : transaction.checkNo;

    if (finalPaymentMethod === "Check" && !finalCheckNo) {
      return res
        .status(400)
        .json({ message: "Check No is required for Check payments" });
    }

    if (date) transaction.date = date;
    if (description !== undefined) transaction.description = description.trim();
    if (checkNo !== undefined) transaction.checkNo = checkNo.trim();
    if (receiptUrl !== undefined) transaction.receiptUrl = receiptUrl;
    if (receiptType !== undefined) transaction.receiptType = receiptType;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (amountPKR !== undefined) transaction.amountPKR = amountPKR;
    if (status) transaction.status = status;

    await transaction.save();
    await transaction.populate("category", "name color");

    return res.status(200).json({
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private/Admin
export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    await transaction.deleteOne();

    return res.status(200).json({ message: "Transaction deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get summary stats (total, by status, by category)
// @route   GET /api/transactions/stats/summary
// @access  Private/Admin
export const getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const [totals, byCategory, byStatus, byPayment] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amountPKR" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amountPKR" },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $project: {
            _id: 0,
            categoryId: "$_id",
            categoryName: "$category.name",
            color: "$category.color",
            total: 1,
            count: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amountPKR" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$paymentMethod",
            total: { $sum: "$amountPKR" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      overall: totals[0] || { totalAmount: 0, count: 0 },
      byCategory,
      byStatus,
      byPayment,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Bulk delete transactions
// @route   POST /api/transactions/bulk-delete
// @access  Private/Admin
export const bulkDeleteTransactions = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No transaction IDs provided" });
    }

    // Safety: cap at 500 per request
    if (ids.length > 500) {
      return res
        .status(400)
        .json({ message: "Cannot delete more than 500 transactions at once" });
    }

    const result = await Transaction.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      message: `${result.deletedCount} transaction(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
