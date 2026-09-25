import PDFDocument from "pdfkit";
import axios from "axios";
import Transaction from "../models/Transaction.js";

// Helper: same date parse rule as transactionController (Pakistan noon)
const parsePakistanDate = (input) => {
  if (!input) return new Date();
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T12:00:00+05:00`);
  }
  return new Date(input);
};

// Helper: convert a Cloudinary URL to a smaller thumbnail URL
// Cloudinary allows transformation parameters directly in the URL
const buildThumbnailUrl = (url, width = 120) => {
  if (!url || !url.includes("/upload/")) return url;
  // Insert transformation right after "/upload/"
  return url.replace("/upload/", `/upload/w_${width},c_limit,q_auto,f_jpg/`);
};

// Helper: fetch an image from a URL as a Buffer
const fetchImageBuffer = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 8000,
    });
    return Buffer.from(response.data);
  } catch (err) {
    console.warn(`⚠️  Could not fetch image: ${url} — ${err.message}`);
    return null;
  }
};

// Helper: format a number as PKR
const formatPKR = (num) => {
  return `Rs ${Number(num).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Helper: format a date as "DD MMM YYYY"
const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
};

// @desc    Export transactions as PDF
// @route   GET /api/export/pdf
// @access  Private/Admin
export const exportTransactionsPDF = async (req, res) => {
  try {
    const {
      category,
      status,
      paymentMethod,
      startDate,
      endDate,
      search,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    // Build same filter as getTransactions
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = parsePakistanDate(startDate);
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59+05:00`);
        filter.date.$lte = end;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ description: regex }, { checkNo: regex }];
    }

    const direction = sortOrder === "asc" ? 1 : -1;
    const allowedSorts = ["date", "amountPKR", "serialNo"];
    const sortField = allowedSorts.includes(sortBy) ? sortBy : "date";

    const transactions = await Transaction.find(filter)
      .populate("category", "name color")
      .sort({ [sortField]: direction });

    if (transactions.length === 0) {
      return res
        .status(404)
        .json({ message: "No transactions found for the given filters" });
    }

    // Pre-fetch all receipt images in parallel
    const receiptBuffers = {};
    await Promise.all(
      transactions.map(async (t) => {
        if (t.receiptUrl && t.receiptType === "image") {
          const thumbUrl = buildThumbnailUrl(t.receiptUrl, 100);
          const buf = await fetchImageBuffer(thumbUrl);
          if (buf) receiptBuffers[t._id.toString()] = buf;
        }
      })
    );

    // Grand total
    const grandTotal = transactions.reduce(
      (sum, t) => sum + (t.amountPKR || 0),
      0
    );

    // Setup PDF response
    const filename = `KH-Tower-Transactions-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margin: 40,
      autoFirstPage: true,
      bufferPages: true,
    });

    doc.pipe(res);

    // ===== HEADER =====
    doc
      .fillColor("#1E3A8A")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("KH Tower", { align: "center" });

    doc
      .fillColor("#374151")
      .fontSize(10)
      .font("Helvetica")
      .text("Finance Management Report", { align: "center" })
      .moveDown(0.3);

    // Filter summary line
    const filterParts = [];
    if (startDate || endDate) {
      filterParts.push(
        `Period: ${startDate ? formatDate(startDate) : "Start"} → ${
          endDate ? formatDate(endDate) : "Today"
        }`
      );
    }
    if (status) filterParts.push(`Status: ${status}`);
    if (paymentMethod) filterParts.push(`Payment: ${paymentMethod}`);
    if (search) filterParts.push(`Search: "${search}"`);

    doc
      .fontSize(9)
      .fillColor("#6B7280")
      .text(filterParts.join("   |   ") || "All Transactions", {
        align: "center",
      })
      .moveDown(0.8);

    // Divider
    doc
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .strokeColor("#E5E7EB")
      .stroke()
      .moveDown(0.8);

    // ===== TABLE HEADER =====
    const columns = {
      sn: { x: 40, width: 30, label: "S#" },
      date: { x: 75, width: 60, label: "Date" },
      category: { x: 140, width: 80, label: "Category" },
      description: { x: 225, width: 145, label: "Description" },
      payment: { x: 375, width: 60, label: "Payment" },
      amount: { x: 440, width: 70, label: "Amount" },
      receipt: { x: 515, width: 40, label: "Receipt" },
    };

    const drawTableHeader = (y) => {
      doc
        .rect(40, y, doc.page.width - 80, 22)
        .fillColor("#1E3A8A")
        .fill();

      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold");
      Object.values(columns).forEach((col) => {
        doc.text(col.label, col.x, y + 7, {
          width: col.width,
          align: col.label === "Amount" ? "right" : "left",
        });
      });

      return y + 26;
    };

    let y = drawTableHeader(doc.y);

    // ===== ROWS =====
    const rowHeight = 46; // enough for image + text
    const pageBottom = doc.page.height - 60;

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];

      // Page break check
      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = drawTableHeader(40);
      }

      // Zebra stripes
      if (i % 2 === 0) {
        doc
          .rect(40, y - 4, doc.page.width - 80, rowHeight)
          .fillColor("#F9FAFB")
          .fill();
      }

      const textY = y + 4;

      // Serial No
      doc
        .fillColor("#111827")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(String(t.serialNo ?? "-"), columns.sn.x, textY, {
          width: columns.sn.width,
        });

      // Date
      doc
        .font("Helvetica")
        .fillColor("#374151")
        .text(formatDate(t.date), columns.date.x, textY, {
          width: columns.date.width,
        });

      // Category (with color dot)
      const catColor = t.category?.color || "#6B7280";
      doc
        .circle(columns.category.x + 3, textY + 4, 3)
        .fillColor(catColor)
        .fill();
      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(t.category?.name || "-", columns.category.x + 10, textY, {
          width: columns.category.width - 10,
          height: 40,
          ellipsis: true,
        });

      // Description
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#374151")
        .text(t.description || "-", columns.description.x, textY, {
          width: columns.description.width,
          height: 40,
          ellipsis: true,
        });

      // Payment Method
      const pmLabel =
        t.paymentMethod === "Check" && t.checkNo
          ? `Check\n#${t.checkNo}`
          : t.paymentMethod;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#374151")
        .text(pmLabel, columns.payment.x, textY, {
          width: columns.payment.width,
          height: 40,
        });

      // Amount (right-aligned)
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#B91C1C")
        .text(formatPKR(t.amountPKR), columns.amount.x, textY, {
          width: columns.amount.width,
          align: "right",
        });

      // Receipt thumbnail or link
      if (t.receiptUrl && t.receiptType === "image" && receiptBuffers[t._id.toString()]) {
        try {
          doc.image(
            receiptBuffers[t._id.toString()],
            columns.receipt.x,
            textY - 2,
            { fit: [36, 36] }
          );
        } catch (err) {
          doc
            .fontSize(7)
            .fillColor("#9CA3AF")
            .text("N/A", columns.receipt.x, textY + 10);
        }
      } else if (t.receiptUrl && t.receiptType === "pdf") {
        doc
          .fontSize(7)
          .fillColor("#2563EB")
          .font("Helvetica-Bold")
          .text("View PDF", columns.receipt.x, textY + 8, {
            width: columns.receipt.width,
            link: t.receiptUrl,
            underline: true,
          });
      } else {
        doc
          .fontSize(7)
          .fillColor("#9CA3AF")
          .font("Helvetica")
          .text("—", columns.receipt.x + 10, textY + 8);
      }

      // Status badge (below payment col — small text)
      const statusColor =
        t.status === "Completed" ? "#059669" : "#D97706";
      doc
        .fontSize(7)
        .fillColor(statusColor)
        .font("Helvetica-Bold")
        .text(t.status, columns.description.x, textY + 24, {
          width: columns.description.width,
        });

      // Row divider
      doc
        .moveTo(40, y + rowHeight - 2)
        .lineTo(doc.page.width - 40, y + rowHeight - 2)
        .strokeColor("#E5E7EB")
        .stroke();

      y += rowHeight;
    }

    // ===== GRAND TOTAL =====
    if (y + 50 > pageBottom) {
      doc.addPage();
      y = 40;
    }

    doc
      .rect(40, y + 6, doc.page.width - 80, 28)
      .fillColor("#1E3A8A")
      .fill();

    doc
      .fillColor("#FFFFFF")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("GRAND TOTAL", 50, y + 14, { width: 200 });

    doc
      .fontSize(12)
      .text(formatPKR(grandTotal), 0, y + 13, {
        width: doc.page.width - 50,
        align: "right",
      });

    doc
      .fontSize(9)
      .fillColor("#6B7280")
      .font("Helvetica")
      .text(
        `${transactions.length} transaction(s)`,
        50,
        y + 40
      );

    // ===== FOOTER on every page =====
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor("#9CA3AF")
        .font("Helvetica")
        .text(
          `KH Tower Finance  •  Generated ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}  •  Page ${i + 1} of ${range.count}`,
          40,
          doc.page.height - 40,
          { width: doc.page.width - 80, align: "center" }
        );
    }

    doc.end();
  } catch (error) {
    console.error("PDF export error:", error);
    // If headers already sent, can't send JSON — just end
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: "Server error", error: error.message });
    }
    res.end();
  }
};