import Category from "../models/Category.js";
import Transaction from "../models/Transaction.js";

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const existing = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    });

    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description?.trim() || "",
      color: color || "#3B82F6",
    });

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private/Admin
export const getCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const filter = includeInactive === "true" ? {} : { isActive: true };

    const categories = await Category.find(filter).sort({ name: 1 });

    return res.status(200).json({
      count: categories.length,
      categories,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Private/Admin
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({ category });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res) => {
  try {
    const { name, description, color, isActive } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check duplicate name (excluding current)
    if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const duplicate = await Category.findOne({
        name: { $regex: `^${name.trim()}$`, $options: "i" },
        _id: { $ne: category._id },
      });
      if (duplicate) {
        return res.status(400).json({ message: "Category name already in use" });
      }
    }

    category.name = name?.trim() || category.name;
    category.description =
      description !== undefined ? description.trim() : category.description;
    category.color = color || category.color;
    category.isActive = isActive !== undefined ? isActive : category.isActive;

    const updated = await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      category: updated,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Block deletion if transactions reference it
    const txCount = await Transaction.countDocuments({ category: category._id });
    if (txCount > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${txCount} transaction(s) use this category. Deactivate it instead.`,
      });
    }

    await category.deleteOne();

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};