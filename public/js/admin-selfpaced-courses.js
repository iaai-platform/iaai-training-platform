// Global variables
//js/admin-selfpaced-course.js
let courses = [];
let selectedCourseId = null;
let editingCourseId = null;
let editingVideoId = null;
let questionCount = 0;
let certificationBodies = [];

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  loadStatistics();
  loadCourses();
  loadInstructors();
  loadCertificationBodies();
  setupEventListeners();
});

// Tab switching
function switchTab(tab) {
  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Find and activate the clicked tab
  const clickedTab = event
    ? event.target.closest(".tab-btn")
    : document.querySelector(
        `.tab-btn:nth-child(${tab === "courses" ? 1 : 2})`
      );
  if (clickedTab) {
    clickedTab.classList.add("active");
  }

  // Update tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  if (tab === "courses") {
    document.getElementById("coursesTab").classList.add("active");
  } else {
    document.getElementById("videosTab").classList.add("active");
    loadCoursesForVideoTab();
  }
}

// Load statistics
async function loadStatistics() {
  try {
    console.log("Loading statistics...");
    const response = await fetch("/admin-courses/selfpaced/api/statistics");
    const data = await response.json();

    console.log("Statistics response:", data);

    if (data.success && data.statistics) {
      document.getElementById("totalCourses").textContent =
        data.statistics.totalCourses || 0;
      document.getElementById("totalStudents").textContent =
        data.statistics.totalStudents || 0;
      document.getElementById("totalVideos").textContent =
        data.statistics.totalVideos || 0;
      document.getElementById("totalCertificates").textContent =
        data.statistics.totalCertificates || 0;
    }
  } catch (error) {
    console.error("Error loading statistics:", error);
    // Set default values on error
    document.getElementById("totalCourses").textContent = "0";
    document.getElementById("totalStudents").textContent = "0";
    document.getElementById("totalVideos").textContent = "0";
    document.getElementById("totalCertificates").textContent = "0";
  }
}

// Load courses
async function loadCourses() {
  try {
    console.log("Loading courses...");
    const response = await fetch("/admin-courses/selfpaced/api/courses");
    const data = await response.json();

    console.log("Courses response:", data);

    if (data.success) {
      courses = data.courses || [];
      console.log(`Loaded ${courses.length} courses`);
      renderCoursesTable(courses);
    } else {
      throw new Error(data.message || "Failed to load courses");
    }
  } catch (error) {
    console.error("Error loading courses:", error);
    showToast("Error loading courses", "error");
    // Show empty state if error
    courses = [];
    renderCoursesTable([]);
  }
}

// Render courses table
function renderCoursesTable(coursesToRender) {
  const tbody = document.getElementById("coursesTableBody");
  const emptyState = document.getElementById("noCoursesState");

  if (!coursesToRender || coursesToRender.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  tbody.innerHTML = coursesToRender
    .map((course) => {
      // Safely access nested properties with fallbacks
      const courseCode = course.basic?.courseCode || course.courseCode || "N/A";
      const title = course.basic?.title || course.title || "Untitled Course";
      const category =
        course.basic?.category || course.category || "uncategorized";
      const status = course.basic?.status || course.status || "draft";
      const price = course.access?.price || course.price || 0;
      const instructorName = course.instructor?.name || "Not Assigned";
      const videoCount = course.videos?.length || 0;
      const enrolledCount =
        course.enrolledStudents || course.access?.totalEnrollments || 0;

      // Display certification bodies
      const certificationDisplay = displayAllCertificationBodies(course);

      return `
            <tr>
                <td>
                    <div class="course-info">
                        <div class="course-title">${title}</div>
                        <div class="course-code">${courseCode}</div>
                    </div>
                </td>
                <td>
                    <span class="status-badge" style="background: #e0e7ff; color: #4f46e5;">
                        ${category}
                    </span>
                </td>
                <td>${instructorName}</td>
                <td>
                    ${
                      price === 0
                        ? '<span class="price-free">FREE</span>'
                        : `<span class="price-badge">$${price}</span>`
                    }
                </td>
                <td>
                    <div class="video-count">
                        <i class="fas fa-video"></i>
                        ${videoCount}
                    </div>
                </td>
                <td>${enrolledCount}</td>
                <td>
                    <span class="status-badge status-${status}">
                        ${status}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-view" onclick="manageCourseVideos('${
                          course._id
                        }')" 
                                title="Manage Videos">
                            <i class="fas fa-video"></i>
                        </button>
                        <button class="btn-icon btn-edit" onclick="editCourse('${
                          course._id
                        }')" 
                                title="Edit Course">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteCourse('${
                          course._id
                        }')" 
                                title="Delete Course">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    })
    .join("");
}

// Load instructors
async function loadInstructors() {
  try {
    console.log("Loading instructors...");
    const response = await fetch("/admin-courses/selfpaced/api/instructors");
    const data = await response.json();

    console.log("Instructors response:", data);

    if (data.success && data.instructors) {
      const select = document.getElementById("instructorId");
      select.innerHTML =
        '<option value="">Select Instructor</option>' +
        data.instructors
          .map(
            (instructor) =>
              `<option value="${instructor._id}">${
                instructor.fullName ||
                `${instructor.firstName} ${instructor.lastName}`
              }</option>`
          )
          .join("");

      console.log(`Loaded ${data.instructors.length} instructors`);
    } else {
      console.error("No instructors found or invalid response");
      showToast(
        "No instructors available. Please add instructors first.",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading instructors:", error);
    showToast("Error loading instructors", "error");
  }
}

// Load certification bodies - UPDATED FOR MULTIPLE BODIES
async function loadCertificationBodies() {
  try {
    console.log("Loading certification bodies...");
    const response = await fetch(
      "/admin-courses/selfpaced/api/certification-bodies"
    );
    const data = await response.json();

    if (data.success && data.certificationBodies) {
      certificationBodies = data.certificationBodies;
      updateCertificationBodiesSelect();
      console.log(`Loaded ${certificationBodies.length} certification bodies`);
    } else {
      console.error("No certification bodies found or invalid response");
      showEmptyCertificationBodiesState();
    }
  } catch (error) {
    console.error("Error loading certification bodies:", error);
    showErrorCertificationBodiesState();
  }
}

// UPDATED - Function to update the certification bodies select dropdowns
function updateCertificationBodiesSelect() {
  const primarySelect = document.getElementById("issuingAuthorityId");
  const additionalSelect = document.getElementById(
    "additionalCertificationBodies"
  );

  if (!primarySelect) {
    console.error("Primary certification body select element not found");
    return;
  }

  if (certificationBodies.length === 0) {
    primarySelect.innerHTML = `
      <option value="">Use Default (IAAI Training Institute)</option>
      <option value="" disabled>No certification bodies available</option>
    `;
    if (additionalSelect) {
      additionalSelect.innerHTML =
        '<option value="" disabled>No certification bodies available</option>';
    }
    return;
  }

  // Populate primary certification body dropdown
  primarySelect.innerHTML = `
    <option value="">Use Default (IAAI Training Institute)</option>
    ${certificationBodies
      .map((body) => `<option value="${body._id}">${body.companyName}</option>`)
      .join("")}
  `;

  // Populate additional certification bodies (multiple select)
  if (additionalSelect) {
    additionalSelect.innerHTML = certificationBodies
      .map((body) => `<option value="${body._id}">${body.companyName}</option>`)
      .join("");

    additionalSelect.addEventListener(
      "change",
      updateAdditionalCertificationBodies
    );
  }

  // Add event listener for primary selection changes
  primarySelect.addEventListener(
    "change",
    handlePrimaryCertificationBodySelection
  );
}

// NEW - Handle primary certification body selection
function handlePrimaryCertificationBodySelection() {
  const select = document.getElementById("issuingAuthorityId");
  const authorityInput = document.getElementById("issuingAuthority");

  if (!select || !authorityInput) return;

  const selectedId = select.value;

  if (selectedId) {
    const selectedBody = certificationBodies.find(
      (body) => body._id === selectedId
    );
    if (selectedBody) {
      authorityInput.value = selectedBody.companyName;
      console.log(
        "Selected primary certification body:",
        selectedBody.companyName
      );
    }
  } else {
    authorityInput.value = "IAAI Training Institute";
    console.log("Reset to default certification authority");
  }

  // Update certificate preview
  updateCertificatePreview();
}

// NEW - Handle additional certification bodies selection
function updateAdditionalCertificationBodies() {
  const select = document.getElementById("additionalCertificationBodies");
  const displayDiv = document.getElementById("additionalCertBodiesDisplay");

  if (!select || !displayDiv) return;

  const selectedOptions = Array.from(select.selectedOptions);

  if (selectedOptions.length === 0) {
    displayDiv.style.display = "none";
    return;
  }

  displayDiv.style.display = "block";
  const tagsContainer = displayDiv.querySelector("div");
  if (tagsContainer) {
    tagsContainer.innerHTML = selectedOptions
      .map((option) => {
        const body = certificationBodies.find((b) => b._id === option.value);
        return `
        <div class="cert-body-tag">
          <span>${body ? body.companyName : option.text}</span>
          <span class="remove-cert" onclick="removeCertificationBody('${
            option.value
          }')">&times;</span>
        </div>
      `;
      })
      .join("");
  }

  // Update certificate preview
  updateCertificatePreview();
}

// NEW - Remove certification body
function removeCertificationBody(bodyId) {
  const select = document.getElementById("additionalCertificationBodies");
  if (!select) return;

  const option = select.querySelector(`option[value="${bodyId}"]`);
  if (option) {
    option.selected = false;
  }

  updateAdditionalCertificationBodies();
}

// ===========================================
// NEW STREAMLINED CERTIFICATION FUNCTIONS
// ===========================================

/**
 * Toggle certification options visibility
 */
function toggleCertificationOptions() {
  const checkbox = document.getElementById("certificateEnabled");
  const options = document.getElementById("certificationOptions");

  if (options) {
    options.style.display = checkbox.checked ? "block" : "none";
  }

  updateCertificatePreview();
}

/**
 * Toggle assessment requirements visibility
 */
function toggleAssessmentRequirements() {
  const checkbox = document.getElementById("requireAssessment");
  const requirements = document.getElementById("assessmentRequirements");

  if (requirements) {
    requirements.style.display = checkbox.checked ? "block" : "none";
  }

  updateCertificatePreview();
}

/**
 * Update primary certification authority
 */
function updatePrimaryCertificationAuthority() {
  const select = document.getElementById("issuingAuthorityId");
  const authorityInput = document.getElementById("issuingAuthority");

  if (!select || !authorityInput) return;

  const selectedId = select.value;

  if (selectedId && certificationBodies) {
    const selectedBody = certificationBodies.find(
      (body) => body._id === selectedId
    );
    if (selectedBody) {
      authorityInput.value = selectedBody.companyName;
    }
  } else {
    authorityInput.value = "IAAI Training Institute";
  }

  updateCertificatePreview();
}

/**
 * Update secondary certification bodies display
 */
function updateSecondaryCertificationBodies() {
  const select = document.getElementById("additionalCertificationBodies");
  const displayDiv = document.getElementById("secondaryCertBodiesDisplay");
  const tagsContainer = document.getElementById("secondaryCertBodiesTags");

  if (!select || !displayDiv || !tagsContainer) return;

  const selectedOptions = Array.from(select.selectedOptions);

  if (selectedOptions.length === 0) {
    displayDiv.style.display = "none";
    return;
  }

  displayDiv.style.display = "block";
  tagsContainer.innerHTML = selectedOptions
    .map((option) => {
      const body = certificationBodies.find((b) => b._id === option.value);
      return `
          <div class="cert-body-tag" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; font-size: 0.875rem; color: #1e40af; font-weight: 500;">
              <span>${body ? body.companyName : option.text}</span>
              <span class="remove-cert" onclick="removeSecondaryCertificationBody('${
                option.value
              }')" style="cursor: pointer; color: #dc2626; font-weight: bold; padding: 0.25rem; border-radius: 3px; transition: all 0.2s ease;">&times;</span>
          </div>
      `;
    })
    .join("");

  updateCertificatePreview();
}

/**
 * Remove secondary certification body
 */
function removeSecondaryCertificationBody(bodyId) {
  const select = document.getElementById("additionalCertificationBodies");
  if (!select) return;

  const option = select.querySelector(`option[value="${bodyId}"]`);
  if (option) {
    option.selected = false;
  }

  updateSecondaryCertificationBodies();
}

// NEW - Update certificate preview in real-time
function updateCertificatePreview() {
  const certificateEnabled =
    document.getElementById("certificateEnabled")?.checked;
  const requireAssessment =
    document.getElementById("requireAssessment")?.checked;
  const primarySelect = document.getElementById("issuingAuthorityId");
  const additionalSelect = document.getElementById(
    "additionalCertificationBodies"
  );

  const previewPrimary = document.getElementById("previewPrimary");
  const previewSecondary = document.getElementById("previewSecondary");
  const previewSecondaryList = document.getElementById("previewSecondaryList");
  const previewRequirementText = document.getElementById(
    "previewRequirementText"
  );

  if (!certificateEnabled) {
    return; // Preview is hidden when certificate is disabled
  }

  // Update primary authority preview
  if (primarySelect && previewPrimary) {
    const selectedPrimary = primarySelect.options[primarySelect.selectedIndex];
    previewPrimary.textContent = selectedPrimary.text
      .replace(" (Default)", "")
      .replace("Use Default (", "")
      .replace(")", "");
  }

  // Update secondary bodies preview
  if (additionalSelect && previewSecondary && previewSecondaryList) {
    const selectedSecondary = Array.from(additionalSelect.selectedOptions);

    if (selectedSecondary.length > 0) {
      previewSecondary.style.display = "block";
      previewSecondaryList.textContent = selectedSecondary
        .map((opt) => opt.text)
        .join(", ");
    } else {
      previewSecondary.style.display = "none";
    }
  }

  // Update requirement preview
  if (previewRequirementText) {
    if (requireAssessment) {
      const minScore = document.getElementById("minimumScore")?.value || "70";
      previewRequirementText.textContent = `Passing assessments with ${minScore}% score`;
    } else {
      previewRequirementText.textContent = "Watching all videos";
    }
  }
}

// HELPER FUNCTIONS for displaying certification bodies
function displayAllCertificationBodies(course) {
  const bodies = [];

  // Add primary
  if (course.certification?.issuingAuthority) {
    bodies.push(course.certification.issuingAuthority);
  } else {
    bodies.push("IAAI Training Institute");
  }

  // Add additional
  if (course.certification?.certificationBodies?.length > 0) {
    course.certification.certificationBodies.forEach((cb) => {
      bodies.push(cb.name);
    });
  }

  if (bodies.length > 1) {
    return `${bodies[0]} +${bodies.length - 1} others`;
  }

  return bodies[0] || "IAAI Training Institute";
}

function getTotalCertificationBodiesCount(course) {
  let count = 0;

  if (course.certification?.issuingAuthorityId) count++;
  if (course.certification?.certificationBodies?.length > 0) {
    count += course.certification.certificationBodies.length;
  }

  return count || 1; // At least 1 (default)
}

// Show empty state for certification bodies
function showEmptyCertificationBodiesState() {
  const primarySelect = document.getElementById("issuingAuthorityId");
  const additionalSelect = document.getElementById(
    "additionalCertificationBodies"
  );

  if (primarySelect) {
    primarySelect.innerHTML =
      '<option value="">Use Default (IAAI Training Institute)</option><option value="" disabled>No certification bodies available</option>';
  }

  if (additionalSelect) {
    additionalSelect.innerHTML =
      '<option value="" disabled>No certification bodies available</option>';
  }
}

// Show error state for certification bodies
function showErrorCertificationBodiesState() {
  const primarySelect = document.getElementById("issuingAuthorityId");
  const additionalSelect = document.getElementById(
    "additionalCertificationBodies"
  );

  if (primarySelect) {
    primarySelect.innerHTML =
      '<option value="">Use Default (IAAI Training Institute)</option><option value="" disabled>Error loading certification bodies</option>';
  }

  if (additionalSelect) {
    additionalSelect.innerHTML =
      '<option value="" disabled>Error loading certification bodies</option>';
  }
}

// Show create course modal
function showCreateCourseModal() {
  editingCourseId = null;
  document.getElementById("courseForm").reset();
  document.getElementById("courseModalTitle").textContent = "Create New Course";
  document.getElementById("saveCourseText").textContent = "Create Course";

  // Reset certification body selections
  if (document.getElementById("issuingAuthorityId")) {
    document.getElementById("issuingAuthorityId").value = "";
  }
  if (document.getElementById("issuingAuthority")) {
    document.getElementById("issuingAuthority").value =
      "IAAI Training Institute";
  }
  if (document.getElementById("additionalCertificationBodies")) {
    Array.from(
      document.getElementById("additionalCertificationBodies").options
    ).forEach((option) => (option.selected = false));
  }

  // Hide additional certification bodies display
  const additionalDisplay = document.getElementById(
    "additionalCertBodiesDisplay"
  );
  if (additionalDisplay) {
    additionalDisplay.style.display = "none";
  }

  // Update certificate preview
  updateCertificatePreview();

  document.getElementById("courseModal").style.display = "block";
}

// UPDATED - Edit course with multiple certification bodies support
async function editCourse(courseId) {
  const course = courses.find((c) => c._id === courseId);
  if (!course) return;

  editingCourseId = courseId;
  document.getElementById("courseModalTitle").textContent = "Edit Course";
  document.getElementById("saveCourseText").textContent = "Update Course";

  // ========================================
  // POPULATE BASIC INFORMATION
  // ========================================
  document.getElementById("courseId").value = course._id;
  document.getElementById("courseCode").value =
    course.basic?.courseCode || course.courseCode || "";
  document.getElementById("category").value =
    course.basic?.category || course.category || "";
  document.getElementById("title").value =
    course.basic?.title || course.title || "";
  document.getElementById("description").value =
    course.basic?.description || course.description || "";
  document.getElementById("aboutThisCourse").value =
    course.basic?.aboutThisCourse || course.aboutThisCourse || "";
  document.getElementById("status").value =
    course.basic?.status || course.status || "draft";

  // ========================================
  // POPULATE CONTENT & LEARNING FIELDS
  // ========================================
  document.getElementById("experienceLevel").value =
    course.content?.experienceLevel || "all-levels";
  document.getElementById("estimatedMinutes").value =
    course.content?.estimatedMinutes || 60;
  document.getElementById("prerequisites").value =
    course.content?.prerequisites || course.prerequisites || "";

  // Populate objectives (array to text - one per line)
  const objectives = course.content?.objectives || [];
  if (document.getElementById("objectives")) {
    document.getElementById("objectives").value = objectives.join("\n");
  }

  // Populate target audience (array to comma-separated)
  const targetAudience = course.content?.targetAudience || [];
  if (document.getElementById("targetAudience")) {
    document.getElementById("targetAudience").value = targetAudience.join(", ");
  }

  // ========================================
  // POPULATE INSTRUCTOR & ACCESS
  // ========================================
  document.getElementById("instructorId").value =
    course.instructor?.instructorId || "";
  document.getElementById("price").value =
    course.access?.price || course.price || 0;
  document.getElementById("accessDays").value =
    course.access?.accessDays || 365;

  // ========================================
  // POPULATE MEDIA FIELDS
  // ========================================
  if (document.getElementById("previewVideoUrl")) {
    document.getElementById("previewVideoUrl").value =
      course.media?.previewVideoUrl || "";
  }

  // Handle existing thumbnail
  if (course.media?.thumbnailUrl) {
    showCurrentThumbnail(course.media.thumbnailUrl);
  } else {
    if (document.getElementById("currentThumbnail")) {
      document.getElementById("currentThumbnail").style.display = "none";
    }
  }

  // Reset upload UI
  if (typeof hideThumbnailUpload === "function") {
    hideThumbnailUpload();
  }
  pendingThumbnailUpload = null;
  if (document.getElementById("thumbnailFile")) {
    document.getElementById("thumbnailFile").value = "";
  }

  // ========================================
  // POPULATE CERTIFICATION BODIES - UPDATED FOR MULTIPLE BODIES
  // ========================================

  // Set primary certification body
  if (course.certification?.issuingAuthorityId) {
    if (document.getElementById("issuingAuthorityId")) {
      document.getElementById("issuingAuthorityId").value =
        course.certification.issuingAuthorityId;
    }
    if (document.getElementById("issuingAuthority")) {
      document.getElementById("issuingAuthority").value =
        course.certification.issuingAuthority || "IAAI Training Institute";
    }
  } else {
    if (document.getElementById("issuingAuthorityId")) {
      document.getElementById("issuingAuthorityId").value = "";
    }
    if (document.getElementById("issuingAuthority")) {
      document.getElementById("issuingAuthority").value =
        "IAAI Training Institute";
    }
  }

  // Set additional certification bodies
  const additionalSelect = document.getElementById(
    "additionalCertificationBodies"
  );
  if (additionalSelect && course.certification?.certificationBodies) {
    // Clear all selections first
    Array.from(additionalSelect.options).forEach(
      (option) => (option.selected = false)
    );

    // Select the relevant options
    course.certification.certificationBodies.forEach((certBody) => {
      const option = additionalSelect.querySelector(
        `option[value="${certBody.bodyId}"]`
      );
      if (option) {
        option.selected = true;
      }
    });

    // Update the display
    updateAdditionalCertificationBodies();
  }

  // ========================================
  // POPULATE SUPPORT FIELDS
  // ========================================
  if (document.getElementById("supportEmail")) {
    document.getElementById("supportEmail").value =
      course.support?.email || "support@iaa-i.com";
  }

  if (document.getElementById("responseTime")) {
    document.getElementById("responseTime").value =
      course.support?.responseTime || "48 hours";
  }

  // ========================================
  // POPULATE CERTIFICATION FIELDS - UPDATED
  // ========================================
  document.getElementById("certificateEnabled").checked =
    course.certification?.enabled !== false;

  if (document.getElementById("requireAllVideos")) {
    document.getElementById("requireAllVideos").checked =
      course.certification?.requirements?.requireAllVideos !== false;
  }

  if (document.getElementById("minimumScore")) {
    document.getElementById("minimumScore").value =
      course.certification?.requirements?.minimumScore || 70;
  }

  // Toggle certification options visibility
  if (document.getElementById("certificationOptions")) {
    document.getElementById("certificationOptions").style.display =
      document.getElementById("certificateEnabled").checked ? "block" : "none";
  }

  // ========================================
  // POPULATE METADATA FIELDS
  // ========================================
  const tags = course.metadata?.tags || [];
  if (document.getElementById("tags")) {
    document.getElementById("tags").value = tags.join(", ");
  }

  if (document.getElementById("internalNotes")) {
    document.getElementById("internalNotes").value =
      course.metadata?.internalNotes || "";
  }

  // Update certificate preview
  updateCertificatePreview();

  // ========================================
  // SHOW MODAL
  // ========================================
  document.getElementById("courseModal").style.display = "block";

  console.log("Course edit form populated with data:", {
    courseId: course._id,
    title: course.basic?.title || course.title,
    primaryCertBody: course.certification?.issuingAuthority,
    additionalCertBodies:
      course.certification?.certificationBodies?.length || 0,
  });
}

// Toggle certification options
function toggleCertificationOptions() {
  const checkbox = document.getElementById("certificateEnabled");
  const options = document.getElementById("certificationOptions");

  if (options) {
    options.style.display = checkbox.checked ? "block" : "none";
  }
}

// Close course modal
function closeCourseModal() {
  document.getElementById("courseModal").style.display = "none";
  document.getElementById("courseForm").reset();
  editingCourseId = null;
}

// UPDATED - Course form submission with multiple certification bodies
document
  .getElementById("courseForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById("saveCourseBtn");
    const submitText = document.getElementById("saveCourseText");
    const submitLoader = document.getElementById("saveCourseLoader");

    submitBtn.disabled = true;
    submitText.style.display = "none";
    submitLoader.style.display = "inline-block";

    try {
      const formData = new FormData(e.target);

      // Get certification body selections
      const primaryCertBodyId = formData.get("issuingAuthorityId") || undefined;
      const additionalSelect = document.getElementById(
        "additionalCertificationBodies"
      );
      const additionalCertBodies = additionalSelect
        ? Array.from(additionalSelect.selectedOptions).map((option) => ({
            bodyId: option.value,
            role: "co-issuer", // Default role
          }))
        : [];

      let courseData;

      if (editingCourseId) {
        // EDITING EXISTING COURSE
        const existingCourse = courses.find((c) => c._id === editingCourseId);
        if (!existingCourse) {
          throw new Error("Course not found");
        }

        courseData = {
          // Update basic information
          basic: {
            ...existingCourse.basic,
            courseCode: formData.get("courseCode")
              ? formData.get("courseCode").toUpperCase()
              : existingCourse.basic?.courseCode,
            title: formData.get("title") || existingCourse.basic?.title,
            description:
              formData.get("description") || existingCourse.basic?.description,
            aboutThisCourse:
              formData.get("aboutThisCourse") ||
              existingCourse.basic?.aboutThisCourse ||
              "",
            category:
              formData.get("category") || existingCourse.basic?.category,
            status: formData.get("status") || existingCourse.basic?.status,
            courseType: "self-paced",
          },

          // Update access information
          access: {
            ...existingCourse.access,
            price:
              parseFloat(formData.get("price")) ||
              existingCourse.access?.price ||
              0,
            accessDays:
              parseInt(formData.get("accessDays")) ||
              existingCourse.access?.accessDays ||
              365,
          },

          // Update content information
          content: {
            ...existingCourse.content,
            experienceLevel:
              formData.get("experienceLevel") ||
              existingCourse.content?.experienceLevel ||
              "all-levels",
            prerequisites:
              formData.get("prerequisites") ||
              existingCourse.content?.prerequisites ||
              "",
            objectives: formData.get("objectives")
              ? formData
                  .get("objectives")
                  .split("\n")
                  .map((obj) => obj.trim())
                  .filter((obj) => obj.length > 0)
              : existingCourse.content?.objectives || [],
            targetAudience: formData.get("targetAudience")
              ? formData
                  .get("targetAudience")
                  .split(",")
                  .map((audience) => audience.trim())
                  .filter((audience) => audience.length > 0)
              : existingCourse.content?.targetAudience || [],
            estimatedMinutes:
              parseInt(formData.get("estimatedMinutes")) ||
              existingCourse.content?.estimatedMinutes ||
              60,
            totalVideos: existingCourse.content?.totalVideos || 0,
            totalQuestions: existingCourse.content?.totalQuestions || 0,
          },

          // Update instructor information
          instructor: {
            ...existingCourse.instructor,
            instructorId:
              formData.get("instructorId") ||
              existingCourse.instructor?.instructorId,
          },

          // UPDATED - Multiple certification bodies support
          certification: {
            ...existingCourse.certification,
            enabled: formData.get("certificateEnabled") === "on",
            type: existingCourse.certification?.type || "completion",
            issuingAuthorityId: primaryCertBodyId,
            issuingAuthority:
              formData.get("issuingAuthority") || "IAAI Training Institute",
            certificationBodies: additionalCertBodies,
            requirements: {
              ...existingCourse.certification?.requirements,
              requireAllVideos: formData.get("requireAllVideos") === "on",
              minimumScore: parseInt(formData.get("minimumScore")) || 70,
              minimumAttendance: 100,
              practicalRequired: false,
            },
            validity: existingCourse.certification?.validity || {
              isLifetime: true,
            },
            features: existingCourse.certification?.features || {
              digitalBadge: true,
              blockchain: false,
              qrVerification: true,
              autoGenerate: true,
            },
            template:
              existingCourse.certification?.template || "professional_v1",
          },

          // Preserve existing media and videos
          media: {
            ...existingCourse.media,
            previewVideoUrl:
              formData.get("previewVideoUrl") ||
              existingCourse.media?.previewVideoUrl ||
              "",
          },

          // Update support information
          support: {
            ...existingCourse.support,
            email:
              formData.get("supportEmail") ||
              existingCourse.support?.email ||
              "support@iaa-i.com",
            responseTime:
              formData.get("responseTime") ||
              existingCourse.support?.responseTime ||
              "48 hours",
          },

          // Update metadata information
          metadata: {
            ...existingCourse.metadata,
            tags: formData.get("tags")
              ? formData
                  .get("tags")
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0)
              : existingCourse.metadata?.tags || [],
            internalNotes:
              formData.get("internalNotes") ||
              existingCourse.metadata?.internalNotes ||
              "",
            lastModifiedBy: existingCourse.metadata?.lastModifiedBy,
          },

          // Preserve all existing videos
          videos: existingCourse.videos || [],
        };

        console.log("Updating existing course with certification bodies:", {
          primary: courseData.certification.issuingAuthority,
          additional: courseData.certification.certificationBodies.length,
        });
      } else {
        // CREATING NEW COURSE
        courseData = {
          basic: {
            courseCode: formData.get("courseCode")
              ? formData.get("courseCode").toUpperCase()
              : undefined,
            title: formData.get("title"),
            description: formData.get("description"),
            aboutThisCourse: formData.get("aboutThisCourse") || "",
            category: formData.get("category"),
            status: formData.get("status"),
            courseType: "self-paced",
          },
          access: {
            price: parseFloat(formData.get("price")) || 0,
            currency: "USD",
            accessDays: parseInt(formData.get("accessDays")) || 365,
            totalEnrollments: 0,
          },
          content: {
            experienceLevel: formData.get("experienceLevel") || "all-levels",
            prerequisites: formData.get("prerequisites") || "",
            objectives: formData.get("objectives")
              ? formData
                  .get("objectives")
                  .split("\n")
                  .map((obj) => obj.trim())
                  .filter((obj) => obj.length > 0)
              : [],
            targetAudience: formData.get("targetAudience")
              ? formData
                  .get("targetAudience")
                  .split(",")
                  .map((audience) => audience.trim())
                  .filter((audience) => audience.length > 0)
              : [],
            estimatedMinutes: parseInt(formData.get("estimatedMinutes")) || 60,
            totalVideos: 0,
            totalQuestions: 0,
          },
          instructor: {
            instructorId: formData.get("instructorId"),
          },
          // NEW - Multiple certification bodies support
          certification: {
            enabled: formData.get("certificateEnabled") === "on",
            type: "completion",
            issuingAuthorityId: primaryCertBodyId,
            issuingAuthority:
              formData.get("issuingAuthority") || "IAAI Training Institute",
            certificationBodies: additionalCertBodies,
            requirements: {
              minimumAttendance: 100,
              minimumScore: parseInt(formData.get("minimumScore")) || 70,
              practicalRequired: false,
              requireAllVideos: formData.get("requireAllVideos") === "on",
            },
            validity: { isLifetime: true },
            features: {
              digitalBadge: true,
              blockchain: false,
              qrVerification: true,
              autoGenerate: true,
            },
            template: "professional_v1",
          },
          media: {
            thumbnailUrl: "",
            previewVideoUrl: formData.get("previewVideoUrl") || "",
          },
          support: {
            email: formData.get("supportEmail") || "support@iaa-i.com",
            responseTime: formData.get("responseTime") || "48 hours",
          },
          metadata: {
            tags: formData.get("tags")
              ? formData
                  .get("tags")
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0)
              : [],
            internalNotes: formData.get("internalNotes") || "",
          },
          videos: [],
        };

        console.log("Creating new course with certification bodies:", {
          primary: courseData.certification.issuingAuthority,
          additional: courseData.certification.certificationBodies.length,
        });
      }

      // Save the course
      const url = editingCourseId
        ? `/admin-courses/selfpaced/api/courses/${editingCourseId}`
        : "/admin-courses/selfpaced/api/courses";
      const method = editingCourseId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(courseData),
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (!result.success) {
        throw new Error(result.message || "Failed to save course");
      }

      // Handle thumbnail upload if pending
      let finalResult = result;

      if (pendingThumbnailUpload && result.course) {
        console.log("Uploading new thumbnail for course:", result.course._id);

        try {
          const thumbnailFormData = new FormData();
          thumbnailFormData.append("thumbnail", pendingThumbnailUpload);

          const thumbnailResponse = await fetch(
            `/admin-courses/selfpaced/api/courses/${result.course._id}/thumbnail`,
            {
              method: "POST",
              body: thumbnailFormData,
            }
          );

          const thumbnailResult = await thumbnailResponse.json();

          if (thumbnailResult.success) {
            console.log("New thumbnail uploaded successfully");
            finalResult.course = thumbnailResult.course;
            pendingThumbnailUpload = null;
            document.getElementById("thumbnailFile").value = "";
            hideThumbnailUpload();
            showToast("Course and thumbnail saved successfully!", "success");
          } else {
            console.warn("Thumbnail upload failed:", thumbnailResult.message);
            showToast(
              "Course saved, but thumbnail upload failed. You can upload it later.",
              "warning"
            );
          }
        } catch (thumbnailError) {
          console.error("Error uploading thumbnail:", thumbnailError);
          showToast(
            "Course saved, but thumbnail upload failed. You can upload it later.",
            "warning"
          );
        }
      } else {
        showToast(
          editingCourseId
            ? "Course updated successfully with certification bodies"
            : "Course created successfully with certification bodies",
          "success"
        );
      }

      // Clean up and refresh
      closeCourseModal();
      await loadCourses();
      await loadStatistics();
    } catch (error) {
      console.error("Error saving course:", error);
      showToast(error.message || "Error saving course", "error");
    } finally {
      submitBtn.disabled = false;
      submitText.style.display = "inline";
      submitLoader.style.display = "none";
    }
  });

// Delete course
async function deleteCourse(courseId) {
  const result = await Swal.fire({
    title: "Delete Course",
    text: "Are you sure you want to delete this course? This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Yes, delete it!",
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(
        `/admin-courses/selfpaced/api/courses/${courseId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast("Course deleted successfully", "success");
        loadCourses();
        loadStatistics();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast(error.message || "Error deleting course", "error");
    }
  }
}

// Manage course videos
function manageCourseVideos(courseId) {
  switchTab("videos");
  document.getElementById("courseSelect").value = courseId;
  loadCourseVideos();
}

// Load courses for video tab
function loadCoursesForVideoTab() {
  const select = document.getElementById("courseSelect");
  select.innerHTML =
    '<option value="">Select a Course</option>' +
    courses
      .map((course) => {
        const title = course.basic?.title || course.title || "Untitled";
        const code = course.basic?.courseCode || course.courseCode || "N/A";
        return `<option value="${course._id}">${title} (${code})</option>`;
      })
      .join("");
}

// Load course videos
async function loadCourseVideos() {
  const courseId = document.getElementById("courseSelect").value;
  selectedCourseId = courseId;

  console.log("Loading videos for course:", courseId);

  if (!courseId) {
    document.getElementById("videosContainer").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-video-slash"></i>
        <h3>Select a Course</h3>
        <p>Choose a course from the dropdown to manage its videos</p>
      </div>
    `;
    document.getElementById("addVideoBtn").disabled = true;
    document.getElementById("reorderBtn").disabled = true;
    return;
  }

  document.getElementById("addVideoBtn").disabled = false;

  try {
    const response = await fetch(
      `/admin-courses/selfpaced/api/courses/${courseId}`
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Failed to load course");
    }

    const course = result.course;
    console.log("Fresh course data from server:", course);

    const courseIndex = courses.findIndex((c) => c._id === courseId);
    if (courseIndex >= 0) {
      courses[courseIndex] = course;
    }

    const videos = course.videos || [];
    console.log("Videos found:", videos.length);

    document.getElementById("reorderBtn").disabled = videos.length < 2;

    if (videos.length === 0) {
      document.getElementById("videosContainer").innerHTML = `
        <div class="empty-state">
          <i class="fas fa-video-slash"></i>
          <h3>No Videos Yet</h3>
          <p>Add videos to this course to get started</p>
          <button class="btn btn-primary" onclick="showAddVideoModal()">
            <i class="fas fa-plus"></i> Add First Video
          </button>
        </div>
      `;
      return;
    }

    const sortedVideos = [...videos].sort(
      (a, b) => (a.sequence || 0) - (b.sequence || 0)
    );

    document.getElementById("videosContainer").innerHTML = `
      <div class="video-grid">
        ${sortedVideos
          .map((video, index) => {
            const videoId = video._id || video.id || `${index}`;
            const videoTitle = video.title || "Untitled Video";
            const videoDescription = video.description || "No description";
            const videoSequence = video.sequence || index + 1;
            const videoDuration = video.duration || 0;
            const videoUrl = video.videoUrl || "";
            const hasQuiz = video.exam && video.exam.length > 0;
            const quizCount = hasQuiz ? video.exam.length : 0;

            return `
              <div class="video-card" data-video-id="${videoId}" data-video-index="${index}">
                <div class="video-thumbnail">
                  <i class="fas fa-play-circle"></i>
                  <div class="video-sequence">#${videoSequence}</div>
                  ${
                    videoDuration > 0
                      ? `<div class="video-duration">${videoDuration} min</div>`
                      : ""
                  }
                </div>
                <div class="video-content">
                  <h3 class="video-title">${videoTitle}</h3>
                  <p class="video-description">${videoDescription}</p>
                  <div class="video-meta">
                    <div class="video-info">
                      ${
                        video.isPreview
                          ? '<span><i class="fas fa-eye"></i> Preview</span>'
                          : ""
                      }
                      ${
                        video.transcript
                          ? '<span><i class="fas fa-file-alt"></i> Transcript</span>'
                          : ""
                      }
                      ${
                        videoUrl
                          ? '<span><i class="fas fa-video"></i> Video</span>'
                          : '<span style="color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> No File</span>'
                      }
                    </div>
                    ${
                      hasQuiz
                        ? `<span class="quiz-badge">${quizCount} Questions</span>`
                        : '<span class="quiz-badge no-quiz-badge">No Quiz</span>'
                    }
                  </div>
                  <div class="video-actions">
                    ${
                      videoUrl
                        ? `<button class="btn-icon btn-play" onclick="playVideo('${videoUrl}', '${videoTitle.replace(
                            /'/g,
                            "\\'"
                          )}')" title="Play Video" style="background: #10b981; color: white;">
                           <i class="fas fa-play"></i>
                         </button>`
                        : `<button class="btn-icon" disabled title="No video file" style="background: #9ca3af; color: white;">
                           <i class="fas fa-ban"></i>
                         </button>`
                    }
                    <button class="btn-icon btn-edit video-edit-btn" 
                            data-video-id="${videoId}" 
                            data-video-index="${index}" 
                            title="Edit Video">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete video-delete-btn" 
                            data-video-id="${videoId}" 
                            data-video-index="${index}" 
                            title="Delete Video">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    attachVideoEventListeners();
    console.log("Video cards rendered successfully");
  } catch (error) {
    console.error("Error loading course videos:", error);
    document.getElementById("videosContainer").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
        <h3>Error Loading Videos</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadCourseVideos()">
          <i class="fas fa-refresh"></i> Try Again
        </button>
      </div>
    `;
    showToast("Error loading videos: " + error.message, "error");
  }
}

// Simple video preview function
function playVideo(videoUrl, videoTitle) {
  if (!videoUrl) {
    alert("Video not found");
    return;
  }

  const popup = window.open(
    "",
    "videoPreview",
    "width=600,height=400,scrollbars=no,resizable=yes"
  );
  popup.document.write(`
      <html>
        <head>
          <title>Preview: ${videoTitle}</title>
          <style>
            body { margin: 0; padding: 10px; background: #000; }
            video { width: 100%; height: 90%; }
            h3 { color: white; margin: 5px 0; font-family: Arial; }
          </style>
        </head>
        <body>
          <h3>${videoTitle}</h3>
          <video controls autoplay>
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support video playback.
          </video>
        </body>
      </html>
    `);
}

// Attach video event listeners
function attachVideoEventListeners() {
  console.log("Attaching video event listeners...");

  document.querySelectorAll(".video-edit-btn").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const videoId = this.getAttribute("data-video-id");
      console.log("Edit button clicked for video:", videoId);
      editVideo(videoId);
    });
  });

  document.querySelectorAll(".video-delete-btn").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const videoId = this.getAttribute("data-video-id");
      console.log("Delete button clicked for video:", videoId);
      deleteVideo(videoId);
    });
  });

  console.log("Video event listeners attached successfully");
}

// Show add video modal
function showAddVideoModal() {
  if (!selectedCourseId) {
    showToast("Please select a course first", "error");
    return;
  }

  editingVideoId = null;
  document.getElementById("videoForm").reset();
  document.getElementById("videoCourseId").value = selectedCourseId;
  document.getElementById("videoModalTitle").textContent = "Add Video";
  document.getElementById("saveVideoText").textContent = "Add Video";
  document.getElementById("videoFile").required = true;

  document.getElementById("enableAssessment").checked = false;
  document.getElementById("assessmentSection").style.display = "none";
  document.getElementById("examQuestions").innerHTML = "";
  questionCount = 0;

  const course = courses.find((c) => c._id === selectedCourseId);
  const nextSequence = course.videos ? course.videos.length + 1 : 1;
  document.getElementById("videoSequence").value = nextSequence;

  document.getElementById("videoModal").style.display = "block";
}

// Edit video
function editVideo(videoId) {
  console.log("Editing video:", videoId);
  console.log("Selected course ID:", selectedCourseId);

  const course = courses.find((c) => c._id === selectedCourseId);
  if (!course) {
    console.error("No course found for editing video");
    showToast("Error: Course not found", "error");
    return;
  }

  const videos = course.videos || [];
  console.log("All videos in course:", videos);

  let video = null;
  let actualVideoId = videoId;

  if (videoId && videoId !== "undefined") {
    video = videos.find(
      (v) => v._id && v._id.toString() === videoId.toString()
    );
    console.log("Found by _id:", video ? "Yes" : "No");
  }

  if (!video && !isNaN(videoId)) {
    const index = parseInt(videoId);
    if (index >= 0 && index < videos.length) {
      video = videos[index];
      actualVideoId = video._id || index;
      console.log("Found by index:", index, video ? "Yes" : "No");
    }
  }

  if (!video && !isNaN(videoId)) {
    video = videos.find((v) => v.sequence === parseInt(videoId));
    if (video) {
      actualVideoId = video._id || videoId;
      console.log("Found by sequence:", video ? "Yes" : "No");
    }
  }

  if (!video) {
    console.error("Video not found with ID/Index:", videoId);
    console.log(
      "Available videos:",
      videos.map((v, i) => ({
        index: i,
        _id: v._id,
        title: v.title,
        sequence: v.sequence,
      }))
    );
    showToast("Error: Video not found", "error");
    return;
  }

  console.log("Video found for editing:", video);

  editingVideoId = actualVideoId;

  document.getElementById("videoModalTitle").textContent = "Edit Video";
  document.getElementById("saveVideoText").textContent = "Update Video";
  document.getElementById("videoFile").required = false;

  document.getElementById("videoCourseId").value = selectedCourseId;
  document.getElementById("videoTitle").value = video.title || "";
  document.getElementById("videoSequence").value = video.sequence || "";
  document.getElementById("videoDuration").value = video.duration || "";
  document.getElementById("videoDescription").value = video.description || "";
  document.getElementById("videoTranscript").value = video.transcript || "";
  document.getElementById("isPreview").checked = video.isPreview || false;

  const currentVideoFile = document.getElementById("currentVideoFile");
  if (video.videoUrl && currentVideoFile) {
    currentVideoFile.style.display = "block";
    const fileName = video.videoUrl.split("/").pop();
    document.getElementById("currentVideoFileName").textContent = fileName;
  } else if (currentVideoFile) {
    currentVideoFile.style.display = "none";
  }

  document.getElementById("examQuestions").innerHTML = "";
  questionCount = 0;

  if (video.exam && video.exam.length > 0) {
    console.log("Loading assessment data:", video.exam);
    document.getElementById("enableAssessment").checked = true;
    document.getElementById("assessmentSection").style.display = "block";

    if (video.assessmentSettings) {
      document.getElementById("passingScore").value =
        video.assessmentSettings.passingScore || 70;
      document.getElementById("timeLimit").value =
        video.assessmentSettings.timeLimit || 0;
      document.getElementById("assessmentInstructions").value =
        video.assessmentSettings.instructions || "";
    }

    video.exam.forEach((question) => {
      addExamQuestion(question);
    });
  } else {
    document.getElementById("enableAssessment").checked = false;
    document.getElementById("assessmentSection").style.display = "none";
  }

  document.getElementById("videoModal").style.display = "block";
  console.log("Video modal opened for editing");
}

// Close video modal
function closeVideoModal() {
  document.getElementById("videoModal").style.display = "none";
  document.getElementById("videoForm").reset();
  document.getElementById("examQuestions").innerHTML = "";
  document.getElementById("currentVideoFile").style.display = "none";
  document.getElementById("enableAssessment").checked = false;
  document.getElementById("assessmentSection").style.display = "none";
  questionCount = 0;
  editingVideoId = null;
}

// Toggle assessment section
function toggleAssessment() {
  const checkbox = document.getElementById("enableAssessment");
  const section = document.getElementById("assessmentSection");
  section.style.display = checkbox.checked ? "block" : "none";

  if (!checkbox.checked) {
    document.getElementById("examQuestions").innerHTML = "";
    questionCount = 0;
  }
}

// Add exam question with enhanced features
function addExamQuestion(questionData = null) {
  questionCount++;
  const questionsDiv = document.getElementById("examQuestions");

  const questionHtml = `
        <div class="question-block" id="question-${questionCount}" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e5e7eb; position: relative;">
            <div style="position: absolute; top: -12px; left: 20px; background: #6366f1; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                Question ${questionCount}
            </div>
            <button type="button" class="btn-icon btn-delete" style="position: absolute; top: 1rem; right: 1rem;" onclick="removeQuestion(${questionCount})">
                <i class="fas fa-times"></i>
            </button>
            
            <div class="form-group" style="margin-top: 0.5rem;">
                <label>Question Text <span>*</span></label>
                <textarea class="form-control question-text" placeholder="Enter your question..." 
                          rows="2" required>${
                            questionData ? questionData.questionText : ""
                          }</textarea>
            </div>
            
            <div class="form-grid" style="margin-top: 1rem;">
                <div class="form-group">
                    <label>Question Type</label>
                    <select class="form-control question-type" onchange="updateQuestionType(${questionCount})">
                        <option value="multiple-choice" ${
                          questionData &&
                          questionData.type === "multiple-choice"
                            ? "selected"
                            : ""
                        }>Multiple Choice</option>
                        <option value="true-false" ${
                          questionData && questionData.type === "true-false"
                            ? "selected"
                            : ""
                        }>True/False</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Points</label>
                    <input type="number" class="form-control question-points" min="1" value="${
                      questionData ? questionData.points || 1 : 1
                    }" placeholder="1">
                </div>
            </div>
            
            <div class="options-section" style="margin-top: 1rem;">
                ${
                  questionData && questionData.type === "true-false"
                    ? getTrueFalseOptions(questionData)
                    : getMultipleChoiceOptions(questionData)
                }
            </div>
            
            <div class="form-group" style="margin-top: 1rem;">
                <label>Correct Answer <span>*</span></label>
                <input type="text" class="form-control correct-answer" placeholder="Enter the correct answer exactly as it appears above" 
                       value="${
                         questionData ? questionData.correctAnswer : ""
                       }" required>
            </div>
            
            <div class="form-group">
                <label>Explanation (Optional)</label>
                <textarea class="form-control question-explanation" placeholder="Explain why this is the correct answer..." 
                          rows="2">${
                            questionData ? questionData.explanation || "" : ""
                          }</textarea>
                <div class="form-hint">This will be shown to students after they answer</div>
            </div>
        </div>
    `;

  questionsDiv.insertAdjacentHTML("beforeend", questionHtml);
}

function getMultipleChoiceOptions(questionData) {
  return `
        <label style="font-size: 0.875rem; margin-bottom: 0.5rem; display: block;">Answer Options <span>*</span></label>
        <div class="options-container">
            ${[1, 2, 3, 4]
              .map(
                (i) => `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="color: #6b7280; font-size: 0.875rem;">${String.fromCharCode(
                      64 + i
                    )}.</span>
                    <input type="text" class="form-control option-input" placeholder="Option ${i}" 
                           value="${
                             questionData &&
                             questionData.options &&
                             questionData.options[i - 1]
                               ? questionData.options[i - 1]
                               : ""
                           }" required>
                </div>
            `
              )
              .join("")}
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="addOption(this)" style="margin-top: 0.5rem;">
            <i class="fas fa-plus"></i> Add Option
        </button>
    `;
}

function getTrueFalseOptions(questionData) {
  return `
        <label style="font-size: 0.875rem; margin-bottom: 0.5rem; display: block;">Answer Options</label>
        <div class="options-container">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span style="color: #6b7280; font-size: 0.875rem;">A.</span>
                <input type="text" class="form-control option-input" value="True" readonly>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="color: #6b7280; font-size: 0.875rem;">B.</span>
                <input type="text" class="form-control option-input" value="False" readonly>
            </div>
        </div>
    `;
}

function updateQuestionType(questionId) {
  const questionBlock = document.getElementById(`question-${questionId}`);
  const questionType = questionBlock.querySelector(".question-type").value;
  const optionsSection = questionBlock.querySelector(".options-section");

  if (questionType === "true-false") {
    optionsSection.innerHTML = getTrueFalseOptions();
  } else {
    optionsSection.innerHTML = getMultipleChoiceOptions();
  }
}

function addOption(button) {
  const optionsContainer = button.previousElementSibling;
  const optionCount = optionsContainer.children.length + 1;
  const optionLetter = String.fromCharCode(64 + optionCount);

  const newOption = document.createElement("div");
  newOption.style.cssText =
    "display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;";
  newOption.innerHTML = `
        <span style="color: #6b7280; font-size: 0.875rem;">${optionLetter}.</span>
        <input type="text" class="form-control option-input" placeholder="Option ${optionCount}" required>
        <button type="button" class="btn-icon btn-delete btn-sm" onclick="removeOption(this)">
            <i class="fas fa-times"></i>
        </button>
    `;

  optionsContainer.appendChild(newOption);
}

function removeOption(button) {
  button.parentElement.remove();
}

function removeQuestion(questionId) {
  document.getElementById(`question-${questionId}`).remove();
}

// Save video
document
  .getElementById("videoForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById("saveVideoBtn");
    const submitText = document.getElementById("saveVideoText");
    const submitLoader = document.getElementById("saveVideoLoader");

    submitBtn.disabled = true;
    submitText.style.display = "none";
    submitLoader.style.display = "inline-block";

    try {
      const formData = new FormData(e.target);

      const assessmentEnabled =
        document.getElementById("enableAssessment").checked;

      if (assessmentEnabled) {
        const assessmentSettings = {
          passingScore:
            parseInt(document.getElementById("passingScore").value) || 70,
          timeLimit: parseInt(document.getElementById("timeLimit").value) || 0,
          instructions:
            document.getElementById("assessmentInstructions").value || "",
        };
        formData.append(
          "assessmentSettings",
          JSON.stringify(assessmentSettings)
        );

        const questions = [];
        document.querySelectorAll(".question-block").forEach((questionDiv) => {
          const questionText =
            questionDiv.querySelector(".question-text").value;
          const questionType =
            questionDiv.querySelector(".question-type").value;
          const points =
            parseInt(questionDiv.querySelector(".question-points").value) || 1;
          const correctAnswer =
            questionDiv.querySelector(".correct-answer").value;
          const explanation = questionDiv.querySelector(
            ".question-explanation"
          ).value;

          const options = [];
          questionDiv.querySelectorAll(".option-input").forEach((input) => {
            if (input.value.trim()) {
              options.push(input.value.trim());
            }
          });

          if (questionText && correctAnswer && options.length >= 2) {
            questions.push({
              questionText,
              type: questionType,
              options,
              correctAnswer,
              points,
              explanation,
            });
          }
        });

        if (questions.length > 0) {
          formData.append("questions", JSON.stringify(questions));
        }
      } else {
        formData.append("questions", JSON.stringify([]));
        formData.append("assessmentSettings", JSON.stringify(null));
      }

      const url = editingVideoId
        ? `/admin-courses/selfpaced/api/videos/${selectedCourseId}/${editingVideoId}`
        : `/admin-courses/selfpaced/api/videos/${selectedCourseId}`;
      const method = editingVideoId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          editingVideoId
            ? "Video updated successfully"
            : "Video added successfully",
          "success"
        );
        closeVideoModal();
        loadCourses();
        loadCourseVideos();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error saving video:", error);
      showToast(error.message || "Error saving video", "error");
    } finally {
      submitBtn.disabled = false;
      submitText.style.display = "inline";
      submitLoader.style.display = "none";
    }
  });

// Delete video
async function deleteVideo(videoId) {
  const result = await Swal.fire({
    title: "Delete Video",
    text: "Are you sure you want to delete this video?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Yes, delete it!",
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(
        `/admin-courses/selfpaced/api/videos/${selectedCourseId}/${videoId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast("Video deleted successfully", "success");
        loadCourses();
        loadCourseVideos();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast(error.message || "Error deleting video", "error");
    }
  }
}

// Reorder videos
async function reorderVideos() {
  const course = courses.find((c) => c._id === selectedCourseId);
  if (!course || !course.videos || course.videos.length < 2) return;

  const { value: newOrder } = await Swal.fire({
    title: "Reorder Videos",
    html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 1rem;">Drag to reorder videos:</p>
                <div id="sortableVideos" style="max-height: 400px; overflow-y: auto;">
                    ${course.videos
                      .sort((a, b) => a.sequence - b.sequence)
                      .map(
                        (video) => `
                        <div class="sortable-item" data-video-id="${video._id}" 
                             style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f3f4f6; 
                                    border-radius: 6px; cursor: move; display: flex; align-items: center;">
                            <i class="fas fa-grip-vertical" style="margin-right: 0.5rem; color: #9ca3af;"></i>
                            <span>${video.sequence}. ${video.title}</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `,
    showCancelButton: true,
    confirmButtonText: "Save Order",
    didOpen: () => {
      const container = document.getElementById("sortableVideos");
      let draggedElement = null;

      container.addEventListener("dragstart", (e) => {
        if (e.target.classList.contains("sortable-item")) {
          draggedElement = e.target;
          e.target.style.opacity = "0.5";
        }
      });

      container.addEventListener("dragend", (e) => {
        if (e.target.classList.contains("sortable-item")) {
          e.target.style.opacity = "";
        }
      });

      container.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
          container.appendChild(draggedElement);
        } else {
          container.insertBefore(draggedElement, afterElement);
        }
      });

      function getDragAfterElement(container, y) {
        const draggableElements = [
          ...container.querySelectorAll(".sortable-item:not(.dragging)"),
        ];
        return draggableElements.reduce(
          (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
              return { offset: offset, element: child };
            } else {
              return closest;
            }
          },
          { offset: Number.NEGATIVE_INFINITY }
        ).element;
      }

      container.querySelectorAll(".sortable-item").forEach((item) => {
        item.draggable = true;
      });
    },
    preConfirm: () => {
      const items = document.querySelectorAll("#sortableVideos .sortable-item");
      return Array.from(items).map((item) => item.dataset.videoId);
    },
  });

  if (newOrder) {
    try {
      const response = await fetch(
        `/admin-courses/selfpaced/api/videos/${selectedCourseId}/reorder`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoIds: newOrder }),
        }
      );

      const result = await response.json();

      if (result.success) {
        showToast("Videos reordered successfully", "success");
        loadCourses();
        loadCourseVideos();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      showToast(error.message || "Error reordering videos", "error");
    }
  }
}

// Refresh courses
function refreshCourses() {
  loadCourses();
  loadStatistics();
}

// Export courses
async function exportCourses() {
  try {
    window.location.href = "/admin-courses/selfpaced/api/export/courses";
    showToast("Export started", "success");
  } catch (error) {
    showToast("Error exporting courses", "error");
  }
}

// Import courses
async function importCourses() {
  const { value: file } = await Swal.fire({
    title: "Import Courses",
    html: `
            <div>
                <p style="margin-bottom: 1rem;">Upload a CSV file with course data</p>
                <input type="file" id="importFile" accept=".csv" class="form-control">
            </div>
        `,
    showCancelButton: true,
    confirmButtonText: "Import",
    preConfirm: () => {
      const fileInput = document.getElementById("importFile");
      if (!fileInput.files[0]) {
        Swal.showValidationMessage("Please select a file");
        return false;
      }
      return fileInput.files[0];
    },
  });

  if (file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "/admin-courses/selfpaced/api/import/courses",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success) {
        showToast(
          `Successfully imported ${result.importedCount} courses`,
          "success"
        );
        loadCourses();
        loadStatistics();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      showToast(error.message || "Error importing courses", "error");
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search functionality
  document
    .getElementById("courseSearch")
    .addEventListener("input", filterCourses);
  document
    .getElementById("statusFilter")
    .addEventListener("change", filterCourses);
  document
    .getElementById("categoryFilter")
    .addEventListener("change", filterCourses);
  document
    .getElementById("videoSearch")
    .addEventListener("input", filterVideos);

  // Certification toggle
  if (document.getElementById("certificateEnabled")) {
    document
      .getElementById("certificateEnabled")
      .addEventListener("change", toggleCertificationOptions);
  }

  // Certificate preview updates
  const primarySelect = document.getElementById("issuingAuthorityId");
  const additionalSelect = document.getElementById(
    "additionalCertificationBodies"
  );

  if (primarySelect) {
    primarySelect.addEventListener("change", updateCertificatePreview);
  }

  if (additionalSelect) {
    additionalSelect.addEventListener("change", function () {
      updateAdditionalCertificationBodies();
      updateCertificatePreview();
    });
  }

  // Close modals on click outside
  window.onclick = function (event) {
    if (event.target.classList.contains("modal")) {
      event.target.style.display = "none";
    }
  };

  // Close modals on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeCourseModal();
      closeVideoModal();
    }
  });
}

// Filter courses
function filterCourses() {
  const searchTerm = document
    .getElementById("courseSearch")
    .value.toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;
  const categoryFilter = document.getElementById("categoryFilter").value;

  const filteredCourses = courses.filter((course) => {
    const title = (course.basic?.title || course.title || "").toLowerCase();
    const courseCode = (
      course.basic?.courseCode ||
      course.courseCode ||
      ""
    ).toLowerCase();
    const status = course.basic?.status || course.status || "";
    const category = course.basic?.category || course.category || "";

    const matchesSearch =
      title.includes(searchTerm) || courseCode.includes(searchTerm);
    const matchesStatus = !statusFilter || status === statusFilter;
    const matchesCategory = !categoryFilter || category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  renderCoursesTable(filteredCourses);
}

// Filter videos
function filterVideos() {
  const searchTerm = document.getElementById("videoSearch").value.toLowerCase();
  const videoCards = document.querySelectorAll(".video-card");

  videoCards.forEach((card) => {
    const title = card.querySelector(".video-title").textContent.toLowerCase();
    const description = card
      .querySelector(".video-description")
      .textContent.toLowerCase();

    if (title.includes(searchTerm) || description.includes(searchTerm)) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}

// Global variable for storing uploaded image data
let pendingThumbnailUpload = null;

/**
 * Handle thumbnail file selection and preview
 */
function handleThumbnailUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select a valid image file", "error");
    input.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast("Image file must be less than 5MB", "error");
    input.value = "";
    return;
  }

  pendingThumbnailUpload = file;

  const reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById("thumbnailPreviewContainer").style.display =
      "block";
    document.getElementById("thumbnailPreview").src = e.target.result;
    document.getElementById("thumbnailFileName").textContent = file.name;
    document.getElementById("thumbnailFileSize").textContent = `Size: ${(
      file.size /
      1024 /
      1024
    ).toFixed(2)} MB`;

    const img = new Image();
    img.onload = function () {
      document.getElementById(
        "thumbnailDimensions"
      ).textContent = `Dimensions: ${this.width}x${this.height}`;
    };
    img.src = e.target.result;

    document.getElementById("saveThumbnailBtn").style.display = "inline-flex";
  };

  reader.readAsDataURL(file);
}

/**
 * Upload thumbnail to server
 */
async function saveThumbnail() {
  if (!pendingThumbnailUpload) {
    showToast("No image selected to upload", "error");
    return;
  }

  if (!editingCourseId) {
    showToast(
      "Please save the course first, then upload the thumbnail",
      "error"
    );
    return;
  }

  const formData = new FormData();
  formData.append("thumbnail", pendingThumbnailUpload);

  document.getElementById("uploadProgress").style.display = "block";
  document.getElementById("saveThumbnailBtn").disabled = true;

  try {
    updateUploadProgress(0);

    const response = await fetch(
      `/admin-courses/selfpaced/api/courses/${editingCourseId}/thumbnail`,
      {
        method: "POST",
        body: formData,
      }
    );

    updateUploadProgress(100);

    const result = await response.json();

    if (result.success) {
      showToast("Thumbnail uploaded successfully", "success");

      const course = courses.find((c) => c._id === editingCourseId);
      if (course) {
        if (!course.media) course.media = {};
        course.media.thumbnailUrl = result.thumbnailUrl;
      }

      hideThumbnailUpload();
      showCurrentThumbnail(result.thumbnailUrl, pendingThumbnailUpload.name);

      pendingThumbnailUpload = null;
      document.getElementById("thumbnailFile").value = "";
    } else {
      throw new Error(result.message || "Upload failed");
    }
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    showToast(error.message || "Error uploading thumbnail", "error");
  } finally {
    document.getElementById("uploadProgress").style.display = "none";
    document.getElementById("saveThumbnailBtn").disabled = false;
  }
}

/**
 * Remove thumbnail preview (before upload)
 */
function removeThumbnail() {
  document.getElementById("thumbnailPreviewContainer").style.display = "none";
  document.getElementById("thumbnailFile").value = "";
  pendingThumbnailUpload = null;
}

/**
 * Delete current saved thumbnail
 */
async function deleteCurrentThumbnail() {
  if (!editingCourseId) return;

  const result = await Swal.fire({
    title: "Delete Thumbnail",
    text: "Are you sure you want to delete the current thumbnail?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Yes, delete it!",
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(
        `/admin-courses/selfpaced/api/courses/${editingCourseId}/thumbnail`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        showToast("Thumbnail deleted successfully", "success");

        const course = courses.find((c) => c._id === editingCourseId);
        if (course && course.media) {
          course.media.thumbnailUrl = "";
        }

        document.getElementById("currentThumbnail").style.display = "none";
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast(error.message || "Error deleting thumbnail", "error");
    }
  }
}

/**
 * Show current saved thumbnail
 */
function showCurrentThumbnail(thumbnailUrl, fileName) {
  if (thumbnailUrl) {
    document.getElementById("currentThumbnail").style.display = "block";
    document.getElementById("currentThumbnailPreview").src = thumbnailUrl;
    document.getElementById("currentThumbnailName").textContent =
      fileName || thumbnailUrl.split("/").pop();
  } else {
    document.getElementById("currentThumbnail").style.display = "none";
  }
}

/**
 * Hide thumbnail upload UI
 */
function hideThumbnailUpload() {
  document.getElementById("thumbnailPreviewContainer").style.display = "none";
  document.getElementById("saveThumbnailBtn").style.display = "none";
}

/**
 * Update upload progress bar
 */
function updateUploadProgress(percent) {
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("uploadStatus").textContent =
    percent < 100 ? `Uploading... ${percent}%` : "Upload complete!";
}

// Show toast notification
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
        <i class="fas fa-${
          type === "success" ? "check-circle" : "exclamation-circle"
        }"></i>
        <span>${message}</span>
    `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideDown 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
