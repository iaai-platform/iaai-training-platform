// public/js/linkedCourse.js
/**
 * Linked Course Management for In-Person Courses
 * Simple and minimal implementation
 */

class LinkedCourseManager {
  constructor() {
    this.currentCourseId = null;
    this.modal = null;
    this.editModal = null;
    this.init();
  }

  init() {
    this.createModals();
    this.bindEvents();
  }

  createModals() {
    // Create Add Linked Course Modal
    this.modal = document.createElement("div");
    this.modal.className = "modal-overlay";
    this.modal.id = "linkedCourseModal";
    this.modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Add Linked Online Course</h3>
                    <button class="close-btn" onclick="linkedCourseManager.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="linkedCourseForm">
                        <div class="form-group">
                            <label for="onlineCourseSelect">Select Online Course *</label>
                            <select id="onlineCourseSelect" name="onlineCourseId" required>
                                <option value="">Select an online course...</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="relationshipSelect">Relationship *</label>
                            <select id="relationshipSelect" name="relationship" required>
                                <option value="prerequisite">Prerequisite</option>
                                <option value="supplementary">Supplementary</option>
                                <option value="follow-up">Follow-up</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="isRequiredCheck" name="isRequired" checked>
                                Required for enrollment
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="completionRequiredCheck" name="completionRequired" checked>
                                Completion required
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="isFreeCheck" name="isFree" checked>
                                Free for enrolled students
                            </label>
                        </div>
                        
                        <div class="form-group" id="customPriceGroup" style="display: none;">
                            <label for="customPrice">Custom Price (USD)</label>
                            <input type="number" id="customPrice" name="customPrice" min="0" step="0.01" value="0">
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="linkedCourseManager.closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Linked Course</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

    // Create Edit Linked Course Modal
    this.editModal = document.createElement("div");
    this.editModal.className = "modal-overlay";
    this.editModal.id = "editLinkedCourseModal";
    this.editModal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Manage Linked Online Courses</h3>
                    <button class="close-btn" onclick="linkedCourseManager.closeEditModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div id="linkedCoursesList">
                        <div class="text-center">
                            <i class="fas fa-spinner fa-spin"></i> Loading...
                        </div>
                    </div>
                    <button type="button" class="btn btn-primary mt-3" onclick="linkedCourseManager.showAddModal()">
                        <i class="fas fa-plus"></i> Add Another Linked Course
                    </button>
                </div>
            </div>
        `;

    document.body.appendChild(this.modal);
    document.body.appendChild(this.editModal);
  }

  bindEvents() {
    // Handle form submission
    document
      .getElementById("linkedCourseForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveLinkedCourse();
      });

    // Handle free/paid toggle
    document.getElementById("isFreeCheck").addEventListener("change", (e) => {
      const customPriceGroup = document.getElementById("customPriceGroup");
      customPriceGroup.style.display = e.target.checked ? "none" : "block";
    });
  }

  async showAddModal(courseId) {
    this.currentCourseId = courseId;

    try {
      // Load online courses
      const response = await fetch("/api/admin/online-courses/list");
      if (!response.ok) throw new Error("Failed to load online courses");

      const courses = await response.json();
      const select = document.getElementById("onlineCourseSelect");

      select.innerHTML = '<option value="">Select an online course...</option>';
      courses.forEach((course) => {
        const option = document.createElement("option");
        option.value = course._id;
        option.textContent = `${course.basic.courseCode} - ${course.basic.title}`;
        select.appendChild(option);
      });

      this.modal.classList.add("active");
    } catch (error) {
      console.error("Error loading online courses:", error);
      this.showToast("Failed to load online courses", "error");
    }
  }

  async showEditModal(courseId) {
    this.currentCourseId = courseId;
    this.editModal.classList.add("active");

    try {
      // Load linked courses
      const response = await fetch(
        `/api/admin/in-person-courses/${courseId}/linked-courses`
      );
      if (!response.ok) throw new Error("Failed to load linked courses");

      const data = await response.json();
      this.renderLinkedCourses(data.linkedCourse);
    } catch (error) {
      console.error("Error loading linked courses:", error);
      document.getElementById("linkedCoursesList").innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Failed to load linked courses
                </div>
            `;
    }
  }

  renderLinkedCourses(linkedCourse) {
    const container = document.getElementById("linkedCoursesList");

    if (!linkedCourse || !linkedCourse.onlineCourseId) {
      container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    No linked courses found. Click "Add Another Linked Course" to add one.
                </div>
            `;
      return;
    }

    container.innerHTML = `
            <div class="linked-course-item">
                <div class="course-info">
                    <h5>${linkedCourse.courseTitle || "Loading..."}</h5>
                    <div class="course-details">
                        <span class="badge badge-primary">${
                          linkedCourse.relationship
                        }</span>
                        <span class="badge ${
                          linkedCourse.isRequired
                            ? "badge-warning"
                            : "badge-secondary"
                        }">
                            ${linkedCourse.isRequired ? "Required" : "Optional"}
                        </span>
                        <span class="badge ${
                          linkedCourse.isFree ? "badge-success" : "badge-info"
                        }">
                            ${
                              linkedCourse.isFree
                                ? "Free"
                                : `$${linkedCourse.customPrice || 0}`
                            }
                        </span>
                    </div>
                </div>
                <div class="course-actions">
                    <button class="btn btn-danger btn-sm" onclick="linkedCourseManager.removeLinkedCourse()">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
  }

  async saveLinkedCourse() {
    const form = document.getElementById("linkedCourseForm");
    const formData = new FormData(form);

    const data = {
      onlineCourseId: formData.get("onlineCourseId"),
      relationship: formData.get("relationship"),
      isRequired: formData.has("isRequired"),
      completionRequired: formData.has("completionRequired"),
      isFree: formData.has("isFree"),
      customPrice: parseFloat(formData.get("customPrice")) || 0,
    };

    try {
      const response = await fetch(
        `/api/admin/in-person-courses/${this.currentCourseId}/linked-course`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save linked course");
      }

      this.showToast("Linked course saved successfully", "success");
      this.closeModal();

      // Refresh the page or update the table
      if (typeof adminCourses !== "undefined" && adminCourses.loadCourses) {
        adminCourses.loadCourses();
      }
    } catch (error) {
      console.error("Error saving linked course:", error);
      this.showToast(error.message, "error");
    }
  }

  async removeLinkedCourse() {
    if (!confirm("Are you sure you want to remove this linked course?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/in-person-courses/${this.currentCourseId}/linked-course`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove linked course");
      }

      this.showToast("Linked course removed successfully", "success");
      this.closeEditModal();

      // Refresh the page or update the table
      if (typeof adminCourses !== "undefined" && adminCourses.loadCourses) {
        adminCourses.loadCourses();
      }
    } catch (error) {
      console.error("Error removing linked course:", error);
      this.showToast(error.message, "error");
    }
  }

  closeModal() {
    this.modal.classList.remove("active");
    document.getElementById("linkedCourseForm").reset();
    document.getElementById("customPriceGroup").style.display = "none";
  }

  closeEditModal() {
    this.editModal.classList.remove("active");
  }

  showToast(message, type = "info") {
    // Create toast if it doesn't exist
    let toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
            <i class="fas fa-${
              type === "success"
                ? "check"
                : type === "error"
                ? "exclamation-triangle"
                : "info"
            }"></i>
            <span>${message}</span>
        `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.linkedCourseManager = new LinkedCourseManager();
});

// CSS styles for the modals and components
const style = document.createElement("style");
style.textContent = `
    .linked-course-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        margin-bottom: 10px;
        background: #f9f9f9;
    }

    .course-info h5 {
        margin: 0 0 8px 0;
        color: #333;
    }

    .course-details {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }

    .badge-primary { background: #007bff; color: white; }
    .badge-secondary { background: #6c757d; color: white; }
    .badge-success { background: #28a745; color: white; }
    .badge-warning { background: #ffc107; color: #212529; }
    .badge-info { background: #17a2b8; color: white; }

    .course-actions {
        display: flex;
        gap: 8px;
    }

    .alert {
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
    }

    .alert-info {
        background: #d1ecf1;
        border: 1px solid #bee5eb;
        color: #0c5460;
    }

    .alert-danger {
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
    }

    .mt-3 {
        margin-top: 1rem;
    }

    .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
    }

    .toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        margin-bottom: 10px;
        border-radius: 8px;
        color: white;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .toast.show {
        transform: translateX(0);
    }

    .toast-success {
        background: #28a745;
    }

    .toast-error {
        background: #dc3545;
    }

    .toast-info {
        background: #17a2b8;
    }
`;
document.head.appendChild(style);
