import Contact from "../models/Contact.js";

// @desc    Create contact
// @route   POST /api/contacts
// @access  Private/Admin
export const createContact = async (req, res) => {
  try {
    const { name, description, phone } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!phone?.trim()) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const contact = await Contact.create({
      name: name.trim(),
      description: description?.trim() || "",
      phone: phone.trim(),
    });

    return res.status(201).json({
      message: "Contact created successfully",
      contact,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all contacts (with search + pagination)
// @route   GET /api/contacts
// @access  Private/Admin
export const getContacts = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { phone: regex },
        { description: regex },
      ];
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
      Contact.countDocuments(filter),
    ]);

    return res.status(200).json({
      count: contacts.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      contacts,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single contact
// @route   GET /api/contacts/:id
// @access  Private/Admin
export const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.status(200).json({ contact });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update contact
// @route   PUT /api/contacts/:id
// @access  Private/Admin
export const updateContact = async (req, res) => {
  try {
    const { name, description, phone } = req.body;

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }
      contact.name = name.trim();
    }

    if (phone !== undefined) {
      if (!phone.trim()) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      contact.phone = phone.trim();
    }

    if (description !== undefined) {
      contact.description = description.trim();
    }

    await contact.save();

    return res.status(200).json({
      message: "Contact updated successfully",
      contact,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete contact
// @route   DELETE /api/contacts/:id
// @access  Private/Admin
export const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await contact.deleteOne();

    return res.status(200).json({ message: "Contact deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Bulk delete contacts
// @route   POST /api/contacts/bulk-delete
// @access  Private/Admin
export const bulkDeleteContacts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No contact IDs provided" });
    }

    if (ids.length > 500) {
      return res
        .status(400)
        .json({ message: "Cannot delete more than 500 contacts at once" });
    }

    const result = await Contact.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      message: `${result.deletedCount} contact(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};