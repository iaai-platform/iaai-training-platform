// admin-courses.js for in person course. works correctly
class AdminCoursesManager {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentView = "table";
    this.courses = [];
    this.instructors = [];
    this.filteredCourses = [];
    this.currentStep = 1;
    this.editingCourse = null;
    this.certificationBodies = []; // Initialized for fetching from backend

    // Dynamic items with local save functionality
    this.savedDynamicItems = {
      objectives: [],
      modules: [],
      targetAudience: [],
      procedures: [],
      equipment: [],
      questions: [],
      partnerHotels: [],
      videoLinks: [],
      links: [],
      instructors: [],
      certificationBodies: [], // Added for local storage of dynamically added cert bodies
    };

    // File upload endpoints aligned with model
    this.uploadEndpoints = {
      documents: "/admin-courses/inperson/api/upload/documents", // -> iaai-platform/inperson/coursedocuments/
      images: "/admin-courses/inperson/api/upload/images", // -> iaai-platform/inperson/gallery-images/
      videos: "/admin-courses/inperson/api/upload/videos", // -> iaai-platform/inperson/course-videos/
      mainImage: "/admin-courses/inperson/api/upload/main-image", // -> iaai-platform/inperson/main-images/
    };

    // ENHANCEMENT: File upload configuration with validation
    this.fileUploadConfig = {
      maxFileSize: {
        documents: 50 * 1024 * 1024, // 50MB
        images: 10 * 1024 * 1024, // 10MB
        mainImage: 10 * 1024 * 1024, // 10MB
      },
      allowedTypes: {
        documents: [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        images: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
        mainImage: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      },
      maxFiles: {
        documents: 10,
        images: 20,
        videos: 5,
        mainImage: 1,
      },
    };

    // Track saved uploaded files separately
    this.savedUploadedFiles = {
      mainImage: null,
      documents: [],
      images: [],
      videos: [],
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupDatePickers();
    this.setupFileUploadHandlers();

    // Load certification bodies FIRST, then load other data
    this.loadCertificationBodies()
      .then(() => {
        console.log(
          "🏢 Certification bodies loaded, now loading other data..."
        );
        this.loadInitialData();
      })
      .catch((error) => {
        console.error("❌ Failed to load certification bodies:", error);
        // Still load other data even if certification bodies fail
        this.loadInitialData();
      });
  }

  setupEventListeners() {
    console.log("🔧 Setting up event listeners...");

    // Helper function to safely add event listeners
    const safeAddEventListener = (elementId, event, handler) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ Added ${event} listener to ${elementId}`);
      } else {
        console.warn(`⚠️ Element with ID '${elementId}' not found`);
      }
    };

    // ADD THESE EARLY BIRD EVENT LISTENERS
    safeAddEventListener("price", "input", () => this.updateEarlyBirdPreview());
    safeAddEventListener("earlyBirdPrice", "input", () =>
      this.updateEarlyBirdPreview()
    );
    safeAddEventListener("earlyBirdDays", "input", () =>
      this.updateEarlyBirdPreview()
    );
    safeAddEventListener("startDate", "change", () =>
      this.updateEarlyBirdPreview()
    );

    // Validation for early bird price
    safeAddEventListener("earlyBirdPrice", "blur", () =>
      this.validateEarlyBirdPrice()
    );
    safeAddEventListener("earlyBirdDays", "blur", () =>
      this.validateEarlyBirdDays()
    );

    // Modal controls
    safeAddEventListener("addCourseBtn", "click", () => this.openCourseModal());
    safeAddEventListener("closeModal", "click", () => this.closeCourseModal());
    safeAddEventListener("closeConfirmModal", "click", () =>
      this.closeConfirmModal()
    );

    // Form navigation
    safeAddEventListener("prevStep", "click", () => this.previousStep());
    safeAddEventListener("nextStep", "click", () => this.nextStep());
    safeAddEventListener("submitForm", "click", (e) => this.submitForm(e));

    // Search and filters
    safeAddEventListener("searchInput", "input", () => this.applyFilters());
    safeAddEventListener("statusFilter", "change", () => this.applyFilters());
    safeAddEventListener("categoryFilter", "change", () => this.applyFilters());
    safeAddEventListener("cityFilter", "change", () => this.applyFilters());

    // View toggle
    const viewButtons = document.querySelectorAll(".view-btn");
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.switchView(e.target.dataset.view)
      );
    });

    // Assessment type change handler
    safeAddEventListener("assessmentType", "change", (e) => {
      this.toggleAssessmentSections(e.target.value);
    });

    // Pagination
    safeAddEventListener("prevPage", "click", () => this.previousPage());
    safeAddEventListener("nextPage", "click", () => this.nextPage());

    // Export
    safeAddEventListener("exportBtn", "click", () => this.exportData());

    // Select all checkbox
    safeAddEventListener("selectAll", "change", (e) =>
      this.selectAllCourses(e.target.checked)
    );

    // Modal overlay click to close
    const courseModal = document.getElementById("courseModal");
    if (courseModal) {
      courseModal.addEventListener("click", (e) => {
        if (e.target.id === "courseModal") this.closeCourseModal();
      });
    }

    const confirmModal = document.getElementById("confirmModal");
    if (confirmModal) {
      confirmModal.addEventListener("click", (e) => {
        if (e.target.id === "confirmModal") this.closeConfirmModal();
      });
    }

    // Form validation
    const courseForm = document.getElementById("courseForm");
    if (courseForm) {
      courseForm.addEventListener("input", () => this.validateCurrentStep());
    }

    // AUTO-GENERATE COURSE CODE
    const titleInput = document.getElementById("title");
    if (titleInput) {
      titleInput.addEventListener("blur", async () => {
        const courseCodeInput = document.getElementById("courseCode");
        const title = titleInput.value.trim();

        // Only generate if course code is empty and title is provided
        if (
          !courseCodeInput.value &&
          title &&
          !document.getElementById("courseId").value
        ) {
          try {
            const response = await fetch(
              "/admin-courses/inperson/api/generate-course-code",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ title }),
              }
            );

            const data = await response.json();
            if (data.success) {
              courseCodeInput.value = data.courseCode;
              courseCodeInput.classList.add("auto-generated");
              this.showToast(
                "info",
                "Course Code Generated",
                "Course code generated automatically"
              );
            }
          } catch (error) {
            console.error("Error generating course code:", error);
          }
        }
      });
    }

    // Handle primary certification body selection change
    const issuingAuthoritySelect =
      document.getElementById("issuingAuthorityId");
    if (issuingAuthoritySelect) {
      issuingAuthoritySelect.addEventListener("change", (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const issuingAuthorityInput =
          document.getElementById("issuingAuthority");

        if (e.target.value && this.certificationBodies) {
          // Find the selected body
          const selectedBody = this.certificationBodies.find(
            (body) => body._id === e.target.value
          );
          if (selectedBody && issuingAuthorityInput) {
            issuingAuthorityInput.value = selectedBody.companyName;
            issuingAuthorityInput.readOnly = true;

            // Show specializations if available
            const specializations = selectedBody.specializations || [];
            if (specializations.length > 0) {
              this.showToast(
                "info",
                "Specializations",
                `Specializations: ${specializations.join(", ")}`
              );
            }
          }
        } else {
          // Default to IAAI
          if (issuingAuthorityInput) {
            issuingAuthorityInput.value = "IAAI Training Institute";
            issuingAuthorityInput.readOnly = false;
          }
        }
      });
    }

    // Dynamic section event listeners
    this.setupDynamicEventListeners();

    safeAddEventListener("browsePoolBtn", "click", () =>
      this.openPoolBrowseModal()
    );
  }

  setupDynamicEventListeners() {
    console.log("🔧 Setting up dynamic event listeners...");

    // Helper function to safely add event listeners to dynamic elements
    const safeAddDynamicListener = (elementId, event, handler) => {
      const element = document.getElementById(elementId);
      if (element && !element.hasAttribute("data-listener-added")) {
        element.setAttribute("data-listener-added", "true");
        element.addEventListener(event, handler);
        console.log(`✅ Added ${event} listener to ${elementId}`);
        return true;
      }
      return false;
    };

    safeAddDynamicListener("addCertificationBody", "click", (e) => {
      e.preventDefault();
      this.addCertificationBody();
    });

    // Use a more reliable approach - check for elements periodically
    this.dynamicListenerInterval = setInterval(() => {
      this.addDynamicEventListeners();
    }, 500);

    // Also call immediately
    this.addDynamicEventListeners();

    // Stop checking after 10 seconds
    setTimeout(() => {
      if (this.dynamicListenerInterval) {
        clearInterval(this.dynamicListenerInterval);
        this.dynamicListenerInterval = null;
        console.log("🔄 Dynamic event listener setup completed");
      }
    }, 10000);
  }

  addDynamicEventListeners() {
    // Helper function to safely add event listeners to dynamic elements
    const safeAddDynamicListener = (elementId, event, handler) => {
      const element = document.getElementById(elementId);
      if (element && !element.hasAttribute("data-listener-added")) {
        element.setAttribute("data-listener-added", "true");
        element.addEventListener(event, handler);
        // console.log(`✅ Added ${event} listener to ${elementId}`); // Too verbose
        return true;
      }
      return false;
    };

    // Model-aligned dynamic sections
    safeAddDynamicListener("addObjective", "click", (e) => {
      e.preventDefault();
      this.addObjective();
    });

    safeAddDynamicListener("addModule", "click", (e) => {
      e.preventDefault();
      this.addModule();
    });

    safeAddDynamicListener("addInstructor", "click", (e) => {
      e.preventDefault();
      this.addInstructor();
    });

    safeAddDynamicListener("addTargetAudience", "click", (e) => {
      e.preventDefault();
      this.addTargetAudience();
    });

    safeAddDynamicListener("addProcedure", "click", (e) => {
      e.preventDefault();
      this.addProcedure();
    });

    safeAddDynamicListener("addEquipment", "click", (e) => {
      e.preventDefault();
      this.addEquipment();
    });

    safeAddDynamicListener("addQuestion", "click", (e) => {
      e.preventDefault();
      this.addQuestion();
    });

    safeAddDynamicListener("addPartnerHotel", "click", (e) => {
      e.preventDefault();
      this.addPartnerHotel();
    });

    safeAddDynamicListener("addVideoLink", "click", (e) => {
      e.preventDefault();
      this.addVideoLink();
    });

    safeAddDynamicListener("addLink", "click", (e) => {
      e.preventDefault();
      this.addLink();
    });
  }

  // File Upload Handlers Setup
  setupFileUploadHandlers() {
    console.log("📁 Setting up file upload handlers...");

    // Set up drag and drop for all file upload areas
    this.setupDragAndDrop();

    // Set up file input change handlers
    this.setupFileInputHandlers();

    console.log("✅ File upload handlers setup completed");
  }

  setupDragAndDrop() {
    const fileUploadAreas = document.querySelectorAll(".file-upload-area");

    fileUploadAreas.forEach((area) => {
      area.addEventListener("dragover", (e) => {
        e.preventDefault();
        area.classList.add("drag-over");
      });

      area.addEventListener("dragleave", (e) => {
        e.preventDefault();
        area.classList.remove("drag-over");
      });

      area.addEventListener("drop", (e) => {
        e.preventDefault();
        area.classList.remove("drag-over");

        const files = e.dataTransfer.files;
        const uploadType = area.dataset.uploadType;

        if (files.length > 0) {
          this.handleFileUpload(files, uploadType);
        }
      });
    });
  }
  //......................file upload...................
  // 1. Update the setupFileInputHandlers method:
  setupFileInputHandlers() {
    const fileInputs = document.querySelectorAll('input[type="file"]');

    fileInputs.forEach((input) => {
      // Skip if it's the main image (single file only)
      const isMainImage = input.id === "mainImageInput";

      // Create preview container if it doesn't exist
      let previewContainer = input.parentElement.querySelector(
        ".file-preview-container"
      );
      if (!previewContainer) {
        previewContainer = document.createElement("div");
        previewContainer.className = "file-preview-container";
        input.parentElement.appendChild(previewContainer);
      }

      // Add "Add More Files" button for multi-file inputs
      if (!isMainImage && input.hasAttribute("multiple")) {
        const addMoreBtn = document.createElement("button");
        addMoreBtn.type = "button";
        addMoreBtn.className = "btn btn-secondary btn-sm add-more-files-btn";
        addMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Add More Files';
        addMoreBtn.style.marginTop = "10px";
        addMoreBtn.style.display = "none"; // Hidden initially

        // Insert button after the input
        input.parentElement.insertBefore(addMoreBtn, previewContainer);

        // Add click handler for "Add More" button
        addMoreBtn.addEventListener("click", () => {
          input.click();
        });

        // Store the button reference
        input.addMoreBtn = addMoreBtn;
      }

      // Initialize arrays to store all files
      if (!this.allSelectedFiles) {
        this.allSelectedFiles = {};
      }
      if (!this.allSelectedFiles[input.name]) {
        this.allSelectedFiles[input.name] = [];
      }

      input.addEventListener("change", (e) => {
        const files = e.target.files;
        const uploadType = input.name;

        if (files.length > 0) {
          // For main image, replace the existing one
          if (isMainImage) {
            this.allSelectedFiles[uploadType] = Array.from(files);
            this.displaySelectedFiles(
              this.allSelectedFiles[uploadType],
              previewContainer,
              uploadType,
              isMainImage
            );
          } else {
            // For other files, add to existing ones
            this.allSelectedFiles[uploadType].push(...Array.from(files));
            this.displaySelectedFiles(
              this.allSelectedFiles[uploadType],
              previewContainer,
              uploadType,
              isMainImage
            );

            // Show "Add More" button
            if (input.addMoreBtn) {
              input.addMoreBtn.style.display = "inline-block";
            }
          }

          // Upload the new files
          this.handleFileUpload(files, uploadType);

          // Clear the input so same file can be selected again
          input.value = "";
        }
      });
    });
  }

  // 2. Update the displaySelectedFiles method:
  displaySelectedFiles(files, container, uploadType, isSingleFile = false) {
    // Clear container only for single file inputs
    if (isSingleFile) {
      container.innerHTML = "";
    }

    // Define folder info for display
    const folderInfo = {
      documents: "📄 Course Documents",
      images: "🖼️ Gallery Images",
      videos: "🎥 Course Videos",
      mainImage: "🖼️ Main Image",
    };

    // For multiple files, only add new ones
    const existingFileNames = Array.from(
      container.querySelectorAll(".file-name")
    ).map((el) => el.textContent);

    files.forEach((file, index) => {
      // Skip if file already displayed
      if (existingFileNames.includes(file.name)) {
        return;
      }

      const fileItem = document.createElement("div");
      fileItem.className = "file-item pending-upload";
      fileItem.dataset.fileName = file.name;
      fileItem.innerHTML = `
        <div class="file-info">
          <i class="fas fa-${this.getFileIcon(file.type)}"></i>
          <span class="file-name">${file.name}</span>
          <span class="file-size">(${this.formatFileSize(file.size)})</span>
          <span class="file-destination">${
            folderInfo[uploadType] || uploadType
          }</span>
          <span class="file-status pending"> - Pending</span>
        </div>
        <div class="file-actions">
          <button type="button" class="btn btn-sm btn-success save-file-btn" onclick="adminCourses.saveIndividualFile('${uploadType}', '${
        file.name
      }')" title="Save file">
            <i class="fas fa-save"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger remove-file-btn" onclick="adminCourses.removeLocalFile('${uploadType}', '${
        file.name
      }')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      container.appendChild(fileItem);
    });
  }

  debugUploadedFiles() {
    console.log("🔍 DEBUG: Current uploaded files structure");

    const expectedFolders = {
      documents: "iaai-platform/inperson/coursedocuments/",
      images: "iaai-platform/inperson/gallery-images/",
      videos: "iaai-platform/inperson/course-videos/",
      mainImage: "iaai-platform/inperson/main-images/",
    };

    Object.keys(this.uploadedFiles || {}).forEach((uploadType) => {
      const files = this.uploadedFiles[uploadType];
      const expectedFolder = expectedFolders[uploadType];

      console.log(`\n📁 ${uploadType.toUpperCase()}:`);
      console.log(`   Expected folder: ${expectedFolder}`);
      console.log(
        `   File count: ${Array.isArray(files) ? files.length : files ? 1 : 0}`
      );

      const filesList = Array.isArray(files) ? files : files ? [files] : [];
      filesList.forEach((file, index) => {
        const isCorrectFolder = file.includes(expectedFolder);
        console.log(
          `   ${index + 1}. ${file} ${isCorrectFolder ? "✅" : "❌"}`
        );
        if (!isCorrectFolder) {
          console.warn(`      ⚠️  Expected to be in: ${expectedFolder}`);
        }
      });
    });
  }

  // Add method to get appropriate icon
  getFileIcon(fileType) {
    if (fileType.startsWith("image/")) return "image";
    if (fileType.includes("pdf")) return "file-pdf";
    if (fileType.includes("word") || fileType.includes("document"))
      return "file-word";
    if (fileType.includes("presentation") || fileType.includes("powerpoint"))
      return "file-powerpoint";
    if (fileType.startsWith("video/")) return "video";
    return "file";
  }

  // Add method to format file size
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  // 3. Add new method to remove files from local selection:
  removeLocalFile(uploadType, fileName) {
    // Remove from allSelectedFiles array
    if (this.allSelectedFiles[uploadType]) {
      this.allSelectedFiles[uploadType] = this.allSelectedFiles[
        uploadType
      ].filter((file) => file.name !== fileName);
    }

    // Remove from display
    const containers = document.querySelectorAll(".file-preview-container");
    containers.forEach((container) => {
      const fileItems = container.querySelectorAll(".file-item");
      fileItems.forEach((item) => {
        if (item.dataset.fileName === fileName) {
          item.remove();
        }
      });
    });

    // Hide "Add More" button if no files left
    const input = document.querySelector(`input[name="${uploadType}"]`);
    if (
      input &&
      input.addMoreBtn &&
      this.allSelectedFiles[uploadType].length === 0
    ) {
      input.addMoreBtn.style.display = "none";
    }
  }

  // 4. Update refreshFileDisplay to mark files as uploaded:
  refreshFileDisplay(uploadType) {
    const containers = document.querySelectorAll(".file-preview-container");

    containers.forEach((container) => {
      const fileItems = container.querySelectorAll(".file-item.pending-upload");
      fileItems.forEach((item) => {
        // Update status
        const statusSpan = item.querySelector(".file-status.pending");
        if (statusSpan) {
          statusSpan.textContent = " - Uploaded (not saved)";
          statusSpan.className = "file-status uploaded";
          statusSpan.style.color = "#f59e0b";
          item.classList.remove("pending-upload");
          item.classList.add("uploaded");
        }

        // Make sure save button is visible
        const saveBtn = item.querySelector(".save-file-btn");
        if (saveBtn && !saveBtn.classList.contains("saved")) {
          saveBtn.style.display = "inline-block";
        }
      });
    });
  }

  // 5. Clear files when modal closes:
  resetForm() {
    document.getElementById("courseForm").reset();
    this.currentStep = 1;
    this.updateStepVisibility();
    this.clearDynamicSections();

    // FIXED: Clear deletion markers
    const deletionMarkers = document.querySelectorAll(
      'input[name="deletedInstructors[]"]'
    );
    deletionMarkers.forEach((marker) => marker.remove());

    // Clear all selected files
    this.allSelectedFiles = {};

    // Clear all preview containers
    const containers = document.querySelectorAll(".file-preview-container");
    containers.forEach((container) => {
      container.innerHTML = "";
    });

    // Hide all "Add More" buttons
    const addMoreBtns = document.querySelectorAll(".add-more-files-btn");
    addMoreBtns.forEach((btn) => {
      btn.style.display = "none";
    });

    // Reset toggleable sections
    this.toggleAssessmentSections("none");
  }

  // Add helper method to create preview container
  createPreviewContainer(inputSelector) {
    const input = document.querySelector(inputSelector);
    if (!input) return null;

    const container = document.createElement("div");
    container.className = "file-preview-container";
    input.parentElement.appendChild(container);
    return container;
  }

  // Add method to delete existing files
  async deleteExistingFile(fileType, fileUrl, courseId) {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(
        `/admin-courses/inperson/api/${courseId}/delete-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileType: fileType,
            fileUrl: fileUrl,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Remove the file item from display
        const fileItems = document.querySelectorAll(".file-item");
        fileItems.forEach((item) => {
          if (item.innerHTML.includes(fileUrl)) {
            item.remove();
          }
        });

        this.showToast("success", "Success", "File deleted successfully");
      } else {
        this.showToast(
          "error",
          "Error",
          result.message || "Failed to delete file"
        );
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      this.showToast("error", "Error", "Failed to delete file");
    }
  }

  // Add this method to load certification bodies
  async loadCertificationBodies() {
    try {
      console.log("Fetching certification bodies...");
      const response = await fetch(
        "/admin-courses/inperson/api/certification-bodies"
      );
      const data = await response.json();

      if (data.success) {
        this.certificationBodies = data.certificationBodies;
        console.log(
          `Successfully loaded ${this.certificationBodies.length} certification bodies.`
        );

        // Always populate dropdown after loading
        this.populateCertificationBodiesDropdown();

        // Also refresh any existing additional certification bodies
        this.refreshAdditionalCertificationBodies();
      } else {
        console.error(
          "Error response from certification bodies API:",
          data.message
        );
        this.showToast(
          "error",
          "Error",
          data.message || "Failed to load certification bodies."
        );
      }
    } catch (error) {
      console.error("Error loading certification bodies:", error);
      this.showToast("error", "Error", "Failed to load certification bodies.");
    }
  }

  // Add this method to populate the dropdown
  populateCertificationBodiesDropdown() {
    const select = document.getElementById("issuingAuthorityId");
    if (!select) {
      console.warn(
        '⚠️ Dropdown element with ID "issuingAuthorityId" not found.'
      );
      return;
    }
    // Check if certification bodies are loaded
    if (!this.certificationBodies || this.certificationBodies.length === 0) {
      console.warn("⚠️ No certification bodies available to populate");
      select.innerHTML = '<option value="">Select Certification Body</option>';
      select.innerHTML +=
        '<option value="">IAAI Training Institute (Default)</option>';
      return;
    }

    console.log("Populating certification bodies dropdown...");
    console.log("Available certification bodies:", this.certificationBodies);

    // Clear existing options
    select.innerHTML = '<option value="">Select Certification Body</option>';

    // Add default IAAI option
    const defaultOption = document.createElement("option");
    defaultOption.value = ""; // Use empty value for default, so it can be selected as "none"
    defaultOption.textContent = "IAAI Training Institute (Default)";
    select.appendChild(defaultOption);

    // Group by membership level
    const grouped = {
      Gold: [],
      Silver: [],
      Bronze: [],
      Standard: [],
    };

    this.certificationBodies.forEach((body) => {
      const level = body.membershipLevel || "Standard";
      if (grouped[level]) {
        grouped[level].push(body);
      }
    });

    // Add grouped options
    Object.keys(grouped).forEach((level) => {
      if (grouped[level].length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `${level} Members`;

        grouped[level].forEach((body) => {
          const option = document.createElement("option");
          option.value = body._id;
          option.textContent = body.displayName || body.companyName;
          option.setAttribute(
            "data-specializations",
            (body.specializations || []).join(", ")
          );
          optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
      }
    });
    console.log("Certification bodies dropdown populated.");
  }

  //3. NEW: Method to refresh additional certification bodies when data loads
  refreshAdditionalCertificationBodies() {
    const container = document.getElementById("certificationBodiesContainer");
    if (!container) return;

    const existingItems = container.querySelectorAll(
      ".certification-body-item"
    );
    existingItems.forEach((item, index) => {
      const select = item.querySelector('select[name*="[bodyId]"]');
      if (select && this.certificationBodies) {
        const currentValue = select.value;

        // Rebuild options
        let optionsHtml = '<option value="">Select Certification Body</option>';
        optionsHtml +=
          '<option value="">IAAI Training Institute (Default)</option>';

        const grouped = {
          Gold: [],
          Silver: [],
          Bronze: [],
          Standard: [],
        };

        this.certificationBodies.forEach((body) => {
          const level = body.membershipLevel || "Standard";
          if (grouped[level]) {
            grouped[level].push(body);
          }
        });

        Object.keys(grouped).forEach((level) => {
          if (grouped[level].length > 0) {
            optionsHtml += `<optgroup label="${level} Members">`;
            grouped[level].forEach((body) => {
              const isSelected = currentValue === body._id ? "selected" : "";
              optionsHtml += `<option value="${body._id}" ${isSelected}>${
                body.displayName || body.companyName
              }</option>`;
            });
            optionsHtml += "</optgroup>";
          }
        });

        select.innerHTML = optionsHtml;
        console.log(
          `✅ Refreshed options for additional certification body ${index + 1}`
        );
      }
    });
  }

  //..................end of new for upload...................

  // ENHANCEMENT: Enhanced file validation
  validateFiles(files, uploadType) {
    const config = this.fileUploadConfig;
    const errors = [];
    const validFiles = [];

    // Check if upload type is supported
    if (!config.allowedTypes[uploadType]) {
      errors.push(`Upload type "${uploadType}" is not supported`);
      return { isValid: false, errors, validFiles };
    }

    // Check number of files
    if (files.length > config.maxFiles[uploadType]) {
      errors.push(
        `Maximum ${config.maxFiles[uploadType]} files allowed for ${uploadType}`
      );
      return { isValid: false, errors, validFiles };
    }

    Array.from(files).forEach((file, index) => {
      const fileErrors = [];

      // Check file size
      if (file.size > config.maxFileSize[uploadType]) {
        const maxSizeMB = (
          config.maxFileSize[uploadType] /
          (1024 * 1024)
        ).toFixed(1);
        fileErrors.push(
          `File "${file.name}" exceeds maximum size of ${maxSizeMB}MB`
        );
      }

      // Check file type
      if (!config.allowedTypes[uploadType].includes(file.type)) {
        const allowedExtensions = this.getFileExtensions(
          config.allowedTypes[uploadType]
        );
        fileErrors.push(
          `File "${
            file.name
          }" type not supported. Allowed: ${allowedExtensions.join(", ")}`
        );
      }

      // Check for empty files
      if (file.size === 0) {
        fileErrors.push(`File "${file.name}" is empty`);
      }

      if (fileErrors.length === 0) {
        validFiles.push(file);
      } else {
        errors.push(...fileErrors);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      validFiles,
    };
  }

  // Add this new method to store uploaded files
  storeUploadedFiles(uploadType, files) {
    if (!this.uploadedFiles) {
      this.uploadedFiles = {};
    }

    if (!this.uploadedFiles[uploadType]) {
      this.uploadedFiles[uploadType] = [];
    }

    this.uploadedFiles[uploadType].push(...files);
    console.log("📁 Stored uploaded files:", uploadType, files);
  }

  // ENHANCEMENT: Get file extensions from MIME types
  getFileExtensions(mimeTypes) {
    const mimeToExt = {
      "application/pdf": "PDF",
      "application/vnd.ms-powerpoint": "PPT",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "PPTX",
      "application/msword": "DOC",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "DOCX",
      "image/jpeg": "JPG",
      "image/jpg": "JPG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "video/mp4": "MP4",
      "video/webm": "WebM",
      "video/ogg": "OGG",
    };

    return mimeTypes.map((mime) => mimeToExt[mime] || mime).filter(Boolean);
  }

  // ENHANCEMENT: Enhanced file upload with comprehensive error handling
  // FIXED: Enhanced file upload with comprehensive error handling
  async handleFileUpload(files, uploadType) {
    console.log(`📤 Handling Cloudinary upload for type: ${uploadType}`);
    console.log(`📤 Number of files: ${files.length}`);

    // Define expected folder mappings
    const expectedFolders = {
      documents: "iaai-platform/inperson/coursedocuments/",
      images: "iaai-platform/inperson/gallery-images/",
      videos: "iaai-platform/inperson/course-videos/",
      mainImage: "iaai-platform/inperson/main-images/",
    };

    const validation = this.validateFiles(files, uploadType);
    if (!validation.isValid) {
      validation.errors.forEach((error) => {
        this.showToast("error", "Validation Error", error);
      });
      return;
    }

    // Initialize uploadedFiles if not exists
    if (!this.uploadedFiles) {
      this.uploadedFiles = {};
    }
    if (!this.uploadedFiles[uploadType]) {
      this.uploadedFiles[uploadType] = [];
    }

    // Process files one by one for better error handling
    for (const file of validation.validFiles) {
      try {
        const formData = new FormData();

        // FIXED: Use correct field names based on backend expectations
        if (uploadType === "mainImage") {
          // Single file upload - backend expects "file" field name
          formData.append("file", file);
        } else {
          // Multiple file uploads - backend expects "files" field name
          formData.append("files", file);
        }

        this.showFileUploadProgress(
          uploadType,
          true,
          `Uploading ${file.name}...`
        );

        console.log(`📤 Uploading to: ${this.uploadEndpoints[uploadType]}`);
        console.log(
          `📤 Field name: ${uploadType === "mainImage" ? "file" : "files"}`
        );

        const response = await fetch(this.uploadEndpoints[uploadType], {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Upload error response:`, errorText);
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Upload response:`, result);

        if (result.success && result.files) {
          // Validate folder structure before adding
          const validatedFiles = result.files.filter((fileUrl) => {
            const expectedFolder = expectedFolders[uploadType];
            if (fileUrl.includes(expectedFolder)) {
              console.log(
                `✅ File uploaded to correct folder: ${expectedFolder}`
              );
              return true;
            } else {
              console.error(
                `❌ File uploaded to wrong folder. Expected: ${expectedFolder}, Got: ${fileUrl}`
              );
              this.showToast(
                "warning",
                "Folder Warning",
                `File uploaded to unexpected location: ${fileUrl}`
              );
              return false;
            }
          });

          // Add validated Cloudinary URLs
          this.uploadedFiles[uploadType].push(...validatedFiles);

          this.showToast(
            "success",
            "Upload Successful",
            `${file.name} uploaded successfully to ${expectedFolders[uploadType]}`
          );

          console.log(
            `✅ Current uploadedFiles for ${uploadType}:`,
            this.uploadedFiles[uploadType]
          );
        } else {
          throw new Error(
            result.message || "Upload failed - no files returned"
          );
        }
      } catch (error) {
        console.error(`❌ Error uploading ${file.name}:`, error);
        this.showToast(
          "error",
          "Upload Failed",
          `Failed to upload ${file.name}: ${error.message}`
        );
      }
    }

    this.showFileUploadProgress(uploadType, false);
    this.refreshFileDisplay(uploadType);

    // Debug current state
    console.log("📊 Current uploadedFiles state:", this.uploadedFiles);
  }
  // Add method to delete files from Cloudinary
  async deleteCloudinaryFile(fileUrl) {
    try {
      // Extract public_id from Cloudinary URL
      const urlParts = fileUrl.split("/");
      const versionIndex = urlParts.findIndex((part) => part.startsWith("v"));
      const publicIdWithExt = urlParts.slice(versionIndex + 1).join("/");
      const publicId = publicIdWithExt.split(".")[0];

      const response = await fetch(
        "/admin-courses/inperson/api/delete-cloudinary-file",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicId }),
        }
      );

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Error deleting Cloudinary file:", error);
      return false;
    }
  }

  // ENHANCEMENT: Comprehensive upload error handling
  async handleUploadError(errorOrResponse, uploadType, fileCount) {
    let title = "Upload Failed";
    let message = "An unexpected error occurred during upload";

    if (errorOrResponse instanceof Response) {
      // HTTP Response errors
      const status = errorOrResponse.status;

      switch (status) {
        case 400:
          title = "Invalid Request";
          message = "The uploaded files are invalid or corrupted";
          break;
        case 401:
          title = "Authentication Required";
          message = "Please log in and try again";
          break;
        case 403:
          title = "Permission Denied";
          message = "You do not have permission to upload files";
          break;
        case 413:
          title = "Files Too Large";
          const maxSize = (
            this.fileUploadConfig.maxFileSize[uploadType] /
            (1024 * 1024)
          ).toFixed(1);
          message = `One or more files exceed the maximum size limit of ${maxSize}MB`;
          break;
        case 415:
          title = "Unsupported File Type";
          const allowedTypes = this.getFileExtensions(
            this.fileUploadConfig.allowedTypes[uploadType]
          );
          message = `Unsupported file type. Allowed types: ${allowedTypes.join(
            ", "
          )}`;
          break;
        case 422:
          title = "Validation Error";
          try {
            const errorData = await errorOrResponse.json();
            message = errorData.message || "File validation failed";
          } catch {
            message = "File validation failed";
          }
          break;
        case 429:
          title = "Rate Limited";
          message = "Too many upload requests. Please wait and try again";
          break;
        case 500:
          title = "Server Error";
          message = "Internal server error. Please try again later";
          break;
        case 502:
        case 503:
        case 504:
          title = "Service Unavailable";
          message =
            "Upload service is temporarily unavailable. Please try again later";
          break;
        default:
          title = `HTTP ${status} Error`;
          message = `Upload failed with status ${status}`;
      }
    } else if (errorOrResponse instanceof Error) {
      // JavaScript errors
      const error = errorOrResponse;

      if (error.name === "AbortError") {
        title = "Upload Timeout";
        message =
          "Upload took too long and was cancelled. Please try with smaller files";
      } else if (
        error.name === "NetworkError" ||
        error.message.includes("network")
      ) {
        title = "Network Error";
        message = "Please check your internet connection and try again";
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        title = "Connection Error";
        message = "Unable to connect to the upload service";
      } else if (error.message.includes("quota")) {
        title = "Storage Full";
        message = "Server storage is full. Please contact administrator";
      } else {
        title = "Upload Error";
        message = error.message || "An unknown error occurred during upload";
      }
    }

    // Show error with retry option for certain errors
    const retryableErrors = [
      "NetworkError",
      "AbortError",
      "HTTP 500 Error",
      "Service Unavailable",
    ];
    const isRetryable = retryableErrors.some(
      (err) => title.includes(err) || message.includes(err)
    );

    this.showToast("error", title, message);

    // ENHANCEMENT: Log detailed error for debugging
    console.error("Detailed upload error:", {
      uploadType,
      fileCount,
      error: errorOrResponse,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      retryable: isRetryable,
    });

    // ENHANCEMENT: Offer retry for network errors
    if (isRetryable) {
      setTimeout(() => {
        this.showToast(
          "info",
          "Retry Available",
          "You can try uploading the files again"
        );
      }, 3000);
    }
  }

  // ENHANCEMENT: Enhanced progress display with detailed status
  showFileUploadProgress(uploadType, show, message = "Uploading...") {
    const container = document.getElementById(`${uploadType}Container`);
    if (!container) return;

    let progressBar = container.querySelector(".upload-progress");

    if (show) {
      if (!progressBar) {
        progressBar = document.createElement("div");
        progressBar.className = "upload-progress";
        progressBar.innerHTML = `
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-content">
                        <span class="progress-text">${message}</span>
                        <button class="progress-cancel" title="Cancel upload">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
        container.appendChild(progressBar);

        // ENHANCEMENT: Add cancel functionality (if supported)
        const cancelBtn = progressBar.querySelector(".progress-cancel");
        if (cancelBtn && this.currentUploadController) {
          cancelBtn.addEventListener("click", () => {
            if (this.currentUploadController) {
              this.currentUploadController.abort();
              this.showToast(
                "info",
                "Upload Cancelled",
                "File upload was cancelled"
              );
            }
          });
        }
      } else {
        progressBar.querySelector(".progress-text").textContent = message;
      }
      progressBar.style.display = "block";
    } else {
      if (progressBar) {
        progressBar.style.display = "none";
      }
    }
  }

  // ENHANCEMENT: Clear file input after successful upload
  clearFileInput(uploadType) {
    const fileInput = document.querySelector(`input[name="${uploadType}"]`);
    if (fileInput) {
      fileInput.value = "";
    }
  }

  refreshFileDisplay(uploadType) {
    const containers = document.querySelectorAll(".file-preview-container");

    containers.forEach((container) => {
      const fileItems = container.querySelectorAll(".file-item.pending-upload");
      fileItems.forEach((item) => {
        // Update status from pending to uploaded
        const statusSpan = item.querySelector(".file-status.pending");
        if (statusSpan) {
          statusSpan.textContent = " - Uploaded (not saved)";
          statusSpan.className = "file-status uploaded";
          statusSpan.style.color = "#f59e0b"; // Orange color
          item.classList.remove("pending-upload");
          item.classList.add("uploaded");
        }
      });
    });

    // Add save button if it doesn't exist
  }

  // 3. Add this new method to save files
  async saveUploadedFiles(uploadType) {
    console.log(`💾 Saving ${uploadType} files...`);

    if (
      !this.uploadedFiles[uploadType] ||
      this.uploadedFiles[uploadType].length === 0
    ) {
      this.showToast("warning", "No Files", "No files to save");
      return;
    }

    // Move files from uploadedFiles to savedUploadedFiles
    if (uploadType === "mainImage") {
      this.savedUploadedFiles.mainImage = this.uploadedFiles.mainImage[0];
    } else {
      this.savedUploadedFiles[uploadType] = [...this.uploadedFiles[uploadType]];
    }

    // Clear uploadedFiles for this type
    this.uploadedFiles[uploadType] = [];

    // Update UI
    const container = document.getElementById(`${uploadType}Preview`);
    if (container) {
      // Update file status
      const fileItems = container.querySelectorAll(".file-item");
      fileItems.forEach((item) => {
        const statusSpan = item.querySelector(".file-status");
        if (statusSpan) {
          statusSpan.textContent = " - Saved";
          statusSpan.style.color = "#10b981"; // Green color
        }
        item.style.backgroundColor = "#f0fdf4"; // Light green background
      });

      // Remove save button
      const saveBtn = container.querySelector(".save-files-btn");
      if (saveBtn) {
        saveBtn.parentElement.remove();
      }
    }

    console.log("✅ Files saved locally:", this.savedUploadedFiles);
    this.showToast("success", "Success", "Files saved successfully");
  }

  //new
  // 3. Add method to save individual file
  async saveIndividualFile(uploadType, fileName) {
    console.log(`💾 Saving ${uploadType} file: ${fileName}`);

    // Find the file URL from uploadedFiles
    const fileIndex = this.allSelectedFiles[uploadType]?.findIndex(
      (f) => f.name === fileName
    );
    if (fileIndex === -1 || !this.uploadedFiles[uploadType]) {
      this.showToast("error", "Error", "File not found in uploaded files");
      return;
    }

    const fileUrl = this.uploadedFiles[uploadType][fileIndex];
    if (!fileUrl) {
      this.showToast("error", "Error", "File URL not found");
      return;
    }

    // Save to savedUploadedFiles
    if (uploadType === "mainImage") {
      this.savedUploadedFiles.mainImage = fileUrl;
    } else {
      if (!this.savedUploadedFiles[uploadType].includes(fileUrl)) {
        this.savedUploadedFiles[uploadType].push(fileUrl);
      }
    }

    // Update UI for this specific file
    const containers = document.querySelectorAll(".file-preview-container");
    containers.forEach((container) => {
      const fileItem = Array.from(
        container.querySelectorAll(".file-item")
      ).find((item) => item.dataset.fileName === fileName);

      if (fileItem) {
        // Update status
        const statusSpan = fileItem.querySelector(".file-status");
        if (statusSpan) {
          statusSpan.textContent = " - Saved";
          statusSpan.className = "file-status saved";
          statusSpan.style.color = "#10b981";
        }

        // Update save button to show checkmark
        const saveBtn = fileItem.querySelector(".save-file-btn");
        if (saveBtn) {
          saveBtn.innerHTML = '<i class="fas fa-check"></i>';
          saveBtn.classList.add("saved");
          saveBtn.disabled = true;
          saveBtn.title = "File saved";
        }

        // Update item appearance
        fileItem.classList.add("saved-file");
      }
    });

    console.log("✅ File saved:", fileName);
    this.showToast("success", "Success", "File saved successfully");
  }

  setupDatePickers() {
    flatpickr("#startDate", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
      onChange: (selectedDates) => {
        if (selectedDates.length > 0) {
          const minEndDate = new Date(selectedDates[0]);
          minEndDate.setDate(minEndDate.getDate() + 1);
          flatpickr("#endDate", {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            minDate: minEndDate,
          });
        }
      },
    });

    flatpickr("#registrationDeadline", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
    });
  }

  async loadInitialData() {
    console.log("📊 Loading initial data...");
    this.showLoading(true);

    try {
      const [coursesResponse, instructorsResponse] = await Promise.all([
        fetch("/admin-courses/inperson/api").catch((err) => {
          console.warn("⚠️ Courses API not available:", err);
          return { ok: false, status: 404 };
        }),
        fetch("/admin-courses/inperson/api/instructors").catch((err) => {
          console.warn("⚠️ Instructors API not available:", err);
          return { ok: false, status: 404 };
        }),
      ]);

      if (!coursesResponse.ok) {
        console.warn(`⚠️ Courses API failed: ${coursesResponse.status}`);
        this.courses = [];
        this.instructors = [];
        this.populateCityFilter();
        this.applyFilters();
        this.updateStats();
        return;
      }

      if (!instructorsResponse.ok) {
        console.warn(
          `⚠️ Instructors API failed: ${instructorsResponse.status}`
        );
        const coursesData = await coursesResponse.json();
        this.courses = coursesData.courses || [];
        this.instructors = [];
      } else {
        const coursesData = await coursesResponse.json();
        const instructorsData = await instructorsResponse.json();

        this.courses = coursesData.courses || [];
        this.instructors = instructorsData.instructors || [];
      }

      console.log("✅ Loaded courses:", this.courses.length);
      console.log("✅ Loaded instructors:", this.instructors.length);

      // ADD THIS LINE new
      this.populatePrimaryInstructor();

      this.populateCityFilter();
      this.applyFilters();
      this.updateStats();
    } catch (error) {
      console.error("❌ Error loading data:", error);
      this.courses = [];
      this.instructors = [];
      this.showToast(
        "error",
        "Error",
        "Failed to load data. Please check your connection and refresh the page."
      );
    } finally {
      this.showLoading(false);
    }
  }

  populateCityFilter() {
    if (!Array.isArray(this.courses)) {
      console.warn("Courses is not an array:", this.courses);
      this.courses = [];
      return;
    }

    const cities = [
      ...new Set(
        this.courses.map((course) => course.venue?.city).filter(Boolean)
      ),
    ];
    const cityFilter = document.getElementById("cityFilter");

    if (!cityFilter) {
      console.warn("City filter element not found");
      return;
    }

    // Clear existing options except first
    while (cityFilter.children.length > 1) {
      cityFilter.removeChild(cityFilter.lastChild);
    }

    cities.forEach((city) => {
      const option = document.createElement("option");
      option.value = city;
      option.textContent = city;
      cityFilter.appendChild(option);
    });
  }

  //new t manage primary instroctor
  populatePrimaryInstructor() {
    const primarySelect = document.getElementById("primaryInstructorId");
    if (!primarySelect || !this.instructors.length) return;

    // Keep the first empty option
    primarySelect.innerHTML =
      '<option value="">Select Primary Instructor</option>';

    // Add all instructors
    this.instructors.forEach((instructor) => {
      const option = document.createElement("option");
      option.value = instructor._id;
      option.textContent = `${instructor.firstName} ${instructor.lastName}`;
      primarySelect.appendChild(option);
    });
  }

  applyFilters() {
    const searchTerm = document
      .getElementById("searchInput")
      .value.toLowerCase();
    const statusFilter = document.getElementById("statusFilter").value;
    const categoryFilter = document.getElementById("categoryFilter").value;
    const cityFilter = document.getElementById("cityFilter").value;

    this.filteredCourses = this.courses.filter((course) => {
      const matchesSearch =
        !searchTerm ||
        course.basic?.title?.toLowerCase().includes(searchTerm) ||
        course.basic?.courseCode?.toLowerCase().includes(searchTerm) ||
        course.instructors?.primary?.name?.toLowerCase().includes(searchTerm) ||
        course.venue?.city?.toLowerCase().includes(searchTerm);

      const matchesStatus =
        !statusFilter || course.basic?.status === statusFilter;
      const matchesCategory =
        !categoryFilter || course.basic?.category === categoryFilter;
      const matchesCity = !cityFilter || course.venue?.city === cityFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesCity;
    });

    this.currentPage = 1;
    this.renderCurrentView();
    this.updatePagination();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case "table":
        this.renderTableView();
        break;
      case "grid":
        this.renderGridView();
        break;
      case "calendar":
        this.renderCalendarView();
        break;
    }
  }

  renderTableView() {
    const tbody = document.getElementById("coursesTableBody");
    if (!tbody) {
      console.warn("⚠️ coursesTableBody element not found");
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const coursesToShow = this.filteredCourses.slice(startIndex, endIndex);

    tbody.innerHTML = "";

    if (coursesToShow.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-center">No courses found</td></tr>';
      return;
    }

    coursesToShow.forEach((course) => {
      const row = this.createTableRow(course);
      tbody.appendChild(row);
    });
  }

  createTableRow(course) {
    const row = document.createElement("tr");

    // Safe data extraction aligned with model
    const title = course.basic?.title || "Untitled Course";
    const courseCode = course.basic?.courseCode || "No Code";
    const status = course.basic?.status || "draft";
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const startDate = course.schedule?.startDate
      ? this.formatDate(course.schedule.startDate)
      : "TBD";
    const duration = course.schedule?.duration || "";
    const venueName = course.venue?.name || "TBD";
    const venueCity = course.venue?.city || "";
    const venueCountry = course.venue?.country || "";
    const instructorName = course.instructors?.primary?.name || "TBD";
    const price = course.enrollment?.price || 0;
    const seatsAvailable = course.enrollment?.seatsAvailable || 0;
    const currentEnrollment = course.enrollment?.currentEnrollment || 0;

    row.innerHTML = `
            <td>
                <input type="checkbox" value="${
                  course._id
                }" class="course-checkbox">
            </td>
            <td>
                <div class="course-title">${title}</div>
                <div class="course-code">${courseCode}</div>
            </td>
            <td>
                <div class="course-schedule">
                    <div class="schedule-date">${startDate}</div>
                    <div class="schedule-duration">${duration}</div>
                </div>
            </td>
            <td>
                <div class="venue-info">
                    <div class="venue-name">${venueName}</div>
                    <div class="venue-location">${venueCity}${
      venueCity && venueCountry ? ", " : ""
    }${venueCountry}</div>
                </div>
            </td>
            <td>
                <div class="instructor-list">
                    ${instructorName}
                </div>
            </td>
            <td>
                <div class="enrollment-info">
                    <div class="enrollment-count">${currentEnrollment} / ${seatsAvailable}</div>
                    <div class="enrollment-progress">
                        <div class="enrollment-bar" style="width: ${
                          seatsAvailable > 0
                            ? (currentEnrollment / seatsAvailable) * 100
                            : 0
                        }%"></div>
                    </div>
                </div>
            </td>
            <td>
                <div class="price-info">
                    <div class="price-main">$${price}</div>
                </div>
            </td>
            <td>
                <span class="status-badge status-${statusClass}">${status}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn edit-btn" onclick="adminCourses.editCourse('${
                      course._id
                    }')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn clone-btn" onclick="adminCourses.cloneCourse('${
                      course._id
                    }')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="adminCourses.deleteCourse('${
                      course._id
                    }')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    return row;
  }

  renderGridView() {
    const container = document.getElementById("gridView");
    if (!container) {
      console.warn("⚠️ gridView element not found");
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const coursesToShow = this.filteredCourses.slice(startIndex, endIndex);

    container.innerHTML = "";

    if (coursesToShow.length === 0) {
      container.innerHTML = '<div class="text-center">No courses found</div>';
      return;
    }

    coursesToShow.forEach((course) => {
      const card = this.createCourseCard(course);
      container.appendChild(card);
    });
  }

  createCourseCard(course) {
    const card = document.createElement("div");
    card.className = "course-card";

    // Safe data extraction aligned with model
    const title = course.basic?.title || "Untitled Course";
    const courseCode = course.basic?.courseCode || "No Code";
    const status = course.basic?.status || "draft";
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const startDate = course.schedule?.startDate
      ? this.formatDate(course.schedule.startDate)
      : "TBD";
    const venueCity = course.venue?.city || "TBD";
    const venueCountry = course.venue?.country || "";
    const instructorName = course.instructors?.primary?.name || "TBD";
    const price = course.enrollment?.price || 0;
    const seatsAvailable = course.enrollment?.seatsAvailable || 0;
    const currentEnrollment = course.enrollment?.currentEnrollment || 0;

    card.innerHTML = `
            <div class="course-card-header">
                <h3>${title}</h3>
            </div>
            <div class="course-card-body">
                <div class="course-card-meta">
                    <span class="status-badge status-${statusClass}">${status}</span>
                    <span class="course-code">${courseCode}</span>
                </div>
                <div class="course-card-info">
                    <div><i class="fas fa-calendar"></i> ${startDate}</div>
                    <div><i class="fas fa-map-marker-alt"></i> ${venueCity}${
      venueCity !== "TBD" && venueCountry ? ", " : ""
    }${venueCountry}</div>
                    <div><i class="fas fa-user"></i> ${instructorName}</div>
                    <div><i class="fas fa-users"></i> ${currentEnrollment} / ${seatsAvailable} enrolled</div>
                    <div><i class="fas fa-dollar-sign"></i> $${price}</div>
                </div>
                <div class="course-card-actions">
                    <button class="action-btn edit-btn" onclick="adminCourses.editCourse('${
                      course._id
                    }')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn clone-btn" onclick="adminCourses.cloneCourse('${
                      course._id
                    }')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="adminCourses.deleteCourse('${
                      course._id
                    }')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    return card;
  }

  renderCalendarView() {
    const container = document.getElementById("calendarView");
    container.innerHTML =
      '<p class="text-center">Calendar view coming soon...</p>';
  }

  switchView(view) {
    this.currentView = view;

    // Update active button
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    // Show/hide views
    document
      .getElementById("tableView")
      .classList.toggle("hidden", view !== "table");
    document
      .getElementById("gridView")
      .classList.toggle("hidden", view !== "grid");
    document
      .getElementById("calendarView")
      .classList.toggle("hidden", view !== "calendar");

    this.renderCurrentView();
  }

  updatePagination() {
    const totalItems = this.filteredCourses.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(startItem + this.itemsPerPage - 1, totalItems);

    // Update info
    document.getElementById("currentRange").textContent =
      totalItems > 0 ? `${startItem}-${endItem}` : "0-0";
    document.getElementById("totalItems").textContent = totalItems;

    // Update buttons
    document.getElementById("prevPage").disabled = this.currentPage <= 1;
    document.getElementById("nextPage").disabled =
      this.currentPage >= totalPages;

    // Update page numbers
    this.renderPageNumbers(totalPages);
  }

  renderPageNumbers(totalPages) {
    const container = document.getElementById("pageNumbers");
    container.innerHTML = "";

    const maxVisible = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const button = document.createElement("button");
      button.className = `page-number ${
        i === this.currentPage ? "active" : ""
      }`;
      button.textContent = i;
      button.addEventListener("click", () => this.goToPage(i));
      container.appendChild(button);
    }
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderCurrentView();
    this.updatePagination();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage() {
    const totalPages = Math.ceil(
      this.filteredCourses.length / this.itemsPerPage
    );
    if (this.currentPage < totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  // Your existing updateStats() - KEEP THIS AS IS
  updateStats() {
    const total = this.courses.length;
    const upcoming = this.courses.filter(
      (c) =>
        new Date(c.schedule?.startDate) > new Date() &&
        c.basic?.status === "open"
    ).length;
    const totalEnrollments = this.courses.reduce(
      (sum, course) => sum + (course.enrollment?.currentEnrollment || 0),
      0
    );
    const totalRevenue = this.courses.reduce(
      (sum, course) =>
        sum +
        (course.enrollment?.price || 0) *
          (course.enrollment?.currentEnrollment || 0),
      0
    );

    // Safely update stats elements
    const totalCoursesEl = document.getElementById("totalCourses");
    const upcomingCoursesEl = document.getElementById("upcomingCourses");
    const totalEnrollmentsEl = document.getElementById("totalEnrollments");
    const totalRevenueEl = document.getElementById("totalRevenue");

    if (totalCoursesEl) totalCoursesEl.textContent = total;
    if (upcomingCoursesEl) upcomingCoursesEl.textContent = upcoming;
    if (totalEnrollmentsEl) totalEnrollmentsEl.textContent = totalEnrollments;
    if (totalRevenueEl)
      totalRevenueEl.textContent = `$${totalRevenue.toLocaleString()}`;
  }

  // Add method to update certification body info
  updateCertificationBodyInfo(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const nameInput = selectElement
      .closest(".form-grid")
      .querySelector('input[name*="[name]"]');

    if (nameInput && selectedOption.value) {
      nameInput.value = selectedOption.text.trim();

      // Find the certification body and show specializations
      const selectedBody = this.certificationBodies.find(
        (body) => body._id === selectedOption.value
      );
      if (
        selectedBody &&
        selectedBody.specializations &&
        selectedBody.specializations.length > 0
      ) {
        this.showToast(
          "info",
          "Specializations",
          `${selectedOption.text}: ${selectedBody.specializations.join(", ")}`
        );
      }
    } else if (nameInput) {
      nameInput.value = "";
    }
  }

  // ADD THIS NEW METHOD - Different purpose
  updateStatusField() {
    const courseId = document.getElementById("courseId").value;
    const statusSelect = document.getElementById("status");

    if (!statusSelect) return;

    if (!courseId) {
      // New course - only draft or will be open when saved
      statusSelect.innerHTML = `
            <option value="open" selected>Save & Open to Register</option>
            <option value="draft">Save as Draft</option>
        `;
      statusSelect.disabled = false;
    } else {
      // Editing - show all statuses but some are system-managed
      statusSelect.innerHTML = `
            <option value="draft">Draft</option>
            <option value="open">Open to Register</option>
            <option value="full" disabled>Full (Auto-managed)</option>
            <option value="in-progress" disabled>In Progress (Auto-managed)</option>
            <option value="completed" disabled>Completed (Auto-managed)</option>
            <option value="cancelled">Cancelled</option>
        `;
    }
  }
  // Modal Management
  async openCourseModal(courseId = null) {
    // Only use courseId for setting editingCourse if not already set
    if (courseId !== null && courseId !== undefined) {
      this.editingCourse = courseId;
    }

    this.currentStep = 1;

    // Clear saved dynamic items when opening modal
    this.clearSavedDynamicItems();

    try {
      // Load certification bodies if not already loaded
      if (!this.certificationBodies || this.certificationBodies.length === 0) {
        await this.loadCertificationBodies();
      }

      if (this.editingCourse) {
        document.getElementById("modalTitle").textContent = "Edit Course";
        // Add hidden input for course ID if it doesn't exist
        if (!document.getElementById("courseId")) {
          const courseIdInput = document.createElement("input");
          courseIdInput.type = "hidden";
          courseIdInput.id = "courseId";
          courseIdInput.name = "courseId";
          courseIdInput.value = this.editingCourse;
          document.getElementById("courseForm").appendChild(courseIdInput);
        } else {
          document.getElementById("courseId").value = this.editingCourse;
        }
      } else {
        document.getElementById("modalTitle").textContent = "Add New Course";
        this.resetForm();
        this.populatePrimaryInstructor();
        this.updateStatusField();
        // Clear course ID if it exists
        const courseIdInput = document.getElementById("courseId");
        if (courseIdInput) {
          courseIdInput.value = "";
        }
      }

      this.updateStepVisibility();

      // Ensure buttons are visible
      const nextBtn = document.getElementById("nextStep");
      const submitBtn = document.getElementById("submitForm");
      if (nextBtn) nextBtn.classList.remove("hidden");
      if (submitBtn) submitBtn.classList.add("hidden");

      document.getElementById("courseModal").classList.add("active");

      // Re-add event listeners after modal opens
      setTimeout(() => {
        this.addDynamicEventListeners();
      }, 100);
    } catch (error) {
      console.error("Error opening modal:", error);
      this.showToast("error", "Error", "Failed to load necessary data");
    }
  }

  closeCourseModal() {
    document.getElementById("courseModal").classList.remove("active");
    this.resetForm();
    this.editingCourse = null;
    this.clearSavedDynamicItems();

    // Clear uploaded files when closing modal
    this.uploadedFiles = {};
    console.log("🧹 Cleared uploaded files");
  }

  clearSavedDynamicItems() {
    this.savedDynamicItems = {
      objectives: [],
      modules: [],
      targetAudience: [],
      procedures: [],
      equipment: [],
      questions: [],
      partnerHotels: [],
      videoLinks: [],
      links: [],
      instructors: [],
      certificationBodies: [], // ADD THIS
    };
  }

  resetForm() {
    document.getElementById("courseForm").reset();
    this.currentStep = 1;
    this.updateStepVisibility();
    this.clearDynamicSections();

    // Reset toggleable sections
    this.toggleAssessmentSections("none");
  }

  clearDynamicSections() {
    const containerIds = [
      "objectivesContainer",
      "modulesContainer",
      "additionalInstructorsContainer",
      "targetAudienceContainer",
      "proceduresContainer",
      "equipmentContainer",
      "questionsContainer", // Make sure this is included
      "partnerHotelsContainer",
      "videoLinksContainer",
      "linksContainer",
      "certificationBodiesContainer", // ADD THIS
    ];

    containerIds.forEach((containerId) => {
      const container = document.getElementById(containerId);
      if (container) {
        // Clear ALL children, not just specific classes
        container.innerHTML = "";
      }
    });
  }

  // Step Navigation
  nextStep() {
    if (this.validateCurrentStep()) {
      if (this.currentStep < 12) {
        this.currentStep++;
        this.updateStepVisibility();
      }
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepVisibility();
    }
  }

  updateStepVisibility() {
    // Update step indicators
    document.querySelectorAll(".step").forEach((step, index) => {
      step.classList.toggle("active", index + 1 <= this.currentStep);
    });

    // Show/hide form steps
    document.querySelectorAll(".form-step").forEach((step, index) => {
      step.classList.toggle("hidden", index + 1 !== this.currentStep);
    });

    // Update navigation buttons
    const prevBtn = document.getElementById("prevStep");
    const nextBtn = document.getElementById("nextStep");
    const submitBtn = document.getElementById("submitForm");

    // Previous button - hidden on first step
    if (prevBtn) {
      prevBtn.classList.toggle("hidden", this.currentStep === 1);
    }

    // Next button - hidden on last step
    if (nextBtn) {
      nextBtn.classList.toggle("hidden", this.currentStep === 12);
    }

    // Submit button - visible only on last step
    if (submitBtn) {
      submitBtn.classList.toggle("hidden", this.currentStep !== 12);
    }

    // Update step indicator
    const currentStepNumber = document.getElementById("currentStepNumber");
    if (currentStepNumber) {
      currentStepNumber.textContent = this.currentStep;
    }
  }

  // Add these methods to your AdminCoursesManager class

  /**
   * Update early bird pricing preview
   */
  updateEarlyBirdPreview() {
    const priceInput = document.getElementById("price");
    const earlyBirdPriceInput = document.getElementById("earlyBirdPrice");
    const earlyBirdDaysInput = document.getElementById("earlyBirdDays");
    const startDateInput = document.getElementById("startDate");
    const previewSection = document.getElementById("earlyBirdPreview");

    if (!priceInput || !earlyBirdPriceInput || !previewSection) return;

    const regularPrice = parseFloat(priceInput.value) || 0;
    const earlyBirdPrice = parseFloat(earlyBirdPriceInput.value) || 0;
    const earlyBirdDays = parseInt(earlyBirdDaysInput?.value) || 30;
    const startDate = startDateInput?.value;

    // Show/hide preview based on whether early bird price is set
    if (earlyBirdPrice > 0) {
      previewSection.style.display = "block";

      // Update preview values
      const regularPricePreview = document.getElementById(
        "regularPricePreview"
      );
      const earlyBirdPricePreview = document.getElementById(
        "earlyBirdPricePreview"
      );
      const savingsPreview = document.getElementById("savingsPreview");
      const earlyBirdDeadlinePreview = document.getElementById(
        "earlyBirdDeadlinePreview"
      );

      if (regularPricePreview)
        regularPricePreview.textContent = `$${regularPrice.toFixed(2)}`;
      if (earlyBirdPricePreview)
        earlyBirdPricePreview.textContent = `$${earlyBirdPrice.toFixed(2)}`;

      const savings = regularPrice - earlyBirdPrice;
      if (savingsPreview) {
        savingsPreview.textContent = `$${savings.toFixed(2)}`;
        savingsPreview.style.color = savings > 0 ? "#10b981" : "#ef4444";
      }

      // Calculate and display deadline
      if (startDate && earlyBirdDeadlinePreview) {
        const courseStart = new Date(startDate);
        const deadline = new Date(courseStart);
        deadline.setDate(deadline.getDate() - earlyBirdDays);

        const deadlineStr = deadline.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        earlyBirdDeadlinePreview.textContent = deadlineStr;

        // Check if deadline is in the past
        const now = new Date();
        if (deadline < now) {
          earlyBirdDeadlinePreview.style.color = "#ef4444";
          earlyBirdDeadlinePreview.textContent += " (EXPIRED)";
        } else {
          earlyBirdDeadlinePreview.style.color = "#10b981";
        }
      } else if (earlyBirdDeadlinePreview) {
        earlyBirdDeadlinePreview.textContent = "Set course start date";
      }
    } else {
      previewSection.style.display = "none";
    }
  }

  /**
   * Validate early bird price
   */
  validateEarlyBirdPrice() {
    const priceInput = document.getElementById("price");
    const earlyBirdPriceInput = document.getElementById("earlyBirdPrice");

    if (!priceInput || !earlyBirdPriceInput) return true;

    const regularPrice = parseFloat(priceInput.value) || 0;
    const earlyBirdPrice = parseFloat(earlyBirdPriceInput.value) || 0;

    // Clear previous validation
    earlyBirdPriceInput.style.borderColor = "";

    // Only validate if early bird price is set
    if (earlyBirdPrice > 0) {
      if (earlyBirdPrice >= regularPrice) {
        earlyBirdPriceInput.style.borderColor = "#ef4444";
        this.showToast(
          "warning",
          "Validation Error",
          "Early bird price must be less than regular price"
        );
        return false;
      }

      // Ensure early bird days is set when early bird price is set
      const earlyBirdDaysInput = document.getElementById("earlyBirdDays");
      if (earlyBirdDaysInput && !earlyBirdDaysInput.value) {
        earlyBirdDaysInput.value = "30"; // Set default
        this.showToast(
          "info",
          "Auto-filled",
          "Early bird days set to 30 days (default)"
        );
      }
    }

    return true;
  }

  /**
   * Validate early bird days
   */
  validateEarlyBirdDays() {
    const earlyBirdDaysInput = document.getElementById("earlyBirdDays");
    const startDateInput = document.getElementById("startDate");

    if (!earlyBirdDaysInput || !startDateInput) return true;

    const earlyBirdDays = parseInt(earlyBirdDaysInput.value) || 0;
    const startDate = startDateInput.value;

    // Clear previous validation
    earlyBirdDaysInput.style.borderColor = "";

    if (earlyBirdDays > 0 && startDate) {
      const courseStart = new Date(startDate);
      const deadline = new Date(courseStart);
      deadline.setDate(deadline.getDate() - earlyBirdDays);

      const now = new Date();
      if (deadline < now) {
        earlyBirdDaysInput.style.borderColor = "#f59e0b"; // Warning color
        this.showToast(
          "warning",
          "Early Bird Expired",
          `Early bird deadline (${deadline.toLocaleDateString()}) is in the past. Consider adjusting the days or start date.`
        );
      }
    }

    return true;
  }

  /**
   * Enhanced course form validation to include early bird validation
   */
  validateCurrentStep() {
    const currentStepElement = document.querySelector(
      `[data-step="${this.currentStep}"]`
    );

    if (!currentStepElement) {
      const visibleStep = document.querySelector(".form-step:not(.hidden)");
      if (!visibleStep) {
        console.warn(`⚠️ No form step found for step ${this.currentStep}`);
        return true;
      }
    }

    // Check for unsaved files in current step
    const unsavedFiles = this.checkForUnsavedFiles();
    if (unsavedFiles.length > 0) {
      this.showToast(
        "warning",
        "Unsaved Files",
        `Please save uploaded files before proceeding: ${unsavedFiles.join(
          ", "
        )}`
      );
      return false;
    }

    // Check for unsaved dynamic items in current step
    const unsavedItems = this.checkForUnsavedDynamicItems();
    if (unsavedItems.length > 0) {
      this.showToast(
        "warning",
        "Unsaved Items",
        `Please save items before proceeding: ${unsavedItems.join(", ")}`
      );
      return false;
    }

    // Basic validation for required fields in current step
    const stepElement =
      currentStepElement || document.querySelector(".form-step:not(.hidden)");
    // Make sure the step element exists and is visible
    if (!stepElement || stepElement.offsetHeight === 0) {
      console.log("Step element not visible, skipping validation");
      return true;
    }

    const requiredFields = stepElement.querySelectorAll("[required]");
    const isBasicValid = this.validateFields(requiredFields);

    // ADD THIS: Additional validation for pricing step (step 3)
    if (this.currentStep === 3) {
      const earlyBirdValid = this.validateEarlyBirdPrice();
      this.validateEarlyBirdDays();
      return isBasicValid && earlyBirdValid;
    }

    return isBasicValid;
  }

  // 5. Check for unsaved files
  checkForUnsavedFiles() {
    const unsaved = [];

    // Check each upload type
    Object.keys(this.uploadedFiles).forEach((type) => {
      if (this.uploadedFiles[type] && this.uploadedFiles[type].length > 0) {
        // Check if these files are saved
        const savedFiles =
          type === "mainImage"
            ? [this.savedUploadedFiles.mainImage].filter(Boolean)
            : this.savedUploadedFiles[type] || [];

        const unsavedCount = this.uploadedFiles[type].filter(
          (file) => !savedFiles.includes(file)
        ).length;

        if (unsavedCount > 0) {
          unsaved.push(`${unsavedCount} ${type} file(s)`);
        }
      }
    });

    return unsaved;
  }

  // 6. Check for unsaved dynamic items
  checkForUnsavedDynamicItems() {
    const unsaved = [];

    // Get current step element
    const currentStepEl = document.querySelector(
      `.form-step[data-step="${this.currentStep}"]:not(.hidden)`
    );
    if (!currentStepEl) return unsaved;

    // Check each type of dynamic item in current step
    const dynamicContainers = [
      { container: "objectivesContainer", name: "objectives" },
      { container: "modulesContainer", name: "modules" },
      { container: "targetAudienceContainer", name: "target audience items" },
      { container: "proceduresContainer", name: "procedures" },
      { container: "equipmentContainer", name: "equipment" },
      { container: "questionsContainer", name: "questions" },
      { container: "partnerHotelsContainer", name: "partner hotels" },
      { container: "videoLinksContainer", name: "video links" },
      { container: "linksContainer", name: "links" },
      {
        container: "certificationBodiesContainer",
        name: "certification bodies",
      }, // ADD THIS
    ];

    dynamicContainers.forEach(({ container, name }) => {
      const containerEl = currentStepEl.querySelector(`#${container}`);
      if (containerEl) {
        const unsavedItems = containerEl.querySelectorAll(
          '.dynamic-item:not([data-saved="true"])'
        );
        if (unsavedItems.length > 0) {
          unsaved.push(`${unsavedItems.length} ${name}`);
        }
      }
    });

    return unsaved;
  }

  validateFields(requiredFields) {
    if (!requiredFields || requiredFields.length === 0) {
      return true; // No required fields to validate
    }

    let isValid = true;

    requiredFields.forEach((field) => {
      if (!field.value || !field.value.trim()) {
        field.style.borderColor = "#ef4444";
        field.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
        isValid = false;
      } else {
        field.style.borderColor = "#e5e7eb";
        field.style.boxShadow = "";
      }
    });

    if (!isValid) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please fill in all required fields"
      );
    }

    return isValid;
  }

  // Toggle Functions for Conditional Sections
  toggleAssessmentSections(assessmentType) {
    const quizSection = document.getElementById("quizSection");

    if (!quizSection) return;

    // Hide section initially
    quizSection.style.display = "none";

    // Show relevant sections based on assessment type
    switch (assessmentType) {
      case "quiz":
      case "both":
        quizSection.style.display = "block";
        break;
      case "practical":
      case "none":
      default:
        // Section remains hidden
        break;
    }
  }

  // Dynamic Form Sections with Local Save - Aligned with Model
  addObjective(text = "") {
    const container = document.getElementById("objectivesContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "objective-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Learning Objective ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveObjective(this.closest('.dynamic-item'))" title="Save objective">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'objectives')" title="Remove objective">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Learning Objective ${index + 1}</label>
                <input type="text" name="content[objectives][${index}]" placeholder="What will students learn?" required maxlength="200" value="${text}">
            </div>
        `;

    container.appendChild(div);
  }

  addModule(data = null) {
    const container = document.getElementById("modulesContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "module-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Module ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveModule(this.closest('.dynamic-item'))" title="Save module">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'modules')" title="Remove module">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Module Title</label>
                    <input type="text" name="content[modules][${index}][title]" required value="${
      data?.title || ""
    }">
                </div>
                <div class="form-group">
                    <label>Duration</label>
                    <input type="text" name="content[modules][${index}][duration]" placeholder="e.g., 2 hours" value="${
      data?.duration || ""
    }">
                </div>
                <div class="form-group">
                    <label>Order</label>
                    <input type="number" name="content[modules][${index}][order]" min="1" value="${
      data?.order || index + 1
    }">
                </div>
                <div class="form-group full-width">
                    <label>Description</label>
                    <textarea name="content[modules][${index}][description]" placeholder="Module description...">${
      data?.description || ""
    }</textarea>
                </div>
            </div>
        `;

    container.appendChild(div);
  }

  addInstructor(data = null) {
    const container = document.getElementById("additionalInstructorsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "additional-instructor-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Additional Instructor ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveInstructor(this.closest('.dynamic-item'))" title="Save instructor">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'instructors')" title="Remove instructor">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Additional Instructor</label>
                    <select name="instructors[additional][${index}][instructorId]" required onchange="adminCourses.updateInstructorName(this)">
                        <option value="">Select Instructor</option>
                        ${this.instructors
                          .map(
                            (inst) =>
                              `<option value="${inst._id}" ${
                                data?.instructorId === inst._id
                                  ? "selected"
                                  : ""
                              }>
                                ${inst.firstName} ${inst.lastName}
                            </option>`
                          )
                          .join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="instructors[additional][${index}][name]" readonly value="${
      data?.name || ""
    }">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select name="instructors[additional][${index}][role]">
                        <option value="Lead Instructor" ${
                          data?.role === "Lead Instructor" ? "selected" : ""
                        }>Lead Instructor</option>
                        <option value="Co-Instructor" ${
                          data?.role === "Co-Instructor" ? "selected" : ""
                        }>Co-Instructor</option>
                        <option value="Guest Instructor" ${
                          data?.role === "Guest Instructor" ? "selected" : ""
                        }>Guest Instructor</option>
                        <option value="Assistant" ${
                          data?.role === "Assistant" ? "selected" : ""
                        }>Assistant</option>
                    </select>
                </div>
            </div>
        `;

    container.appendChild(div);

    // If data is provided, update the name field
    if (data?.instructorId) {
      const selectElement = div.querySelector('select[name*="[instructorId]"]');
      if (selectElement) {
        this.updateInstructorName(selectElement);
      }
    }
  }

  // Add method to update instructor name when selection changes
  updateInstructorName(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const nameInput = selectElement
      .closest(".form-grid")
      .querySelector('input[name*="[name]"]');

    if (nameInput && selectedOption.value) {
      nameInput.value = selectedOption.text.trim();
    } else if (nameInput) {
      nameInput.value = "";
    }
  }

  // Save instructor method
  // Save instructor method
  async saveInstructor(instructorElement) {
    const selects = instructorElement.querySelectorAll("select");
    const instructorData = {
      id: this.generateId(),
      instructorId: "",
      name: "",
      role: "Co-Instructor",
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;
    selects.forEach((select) => {
      const name = select.name;
      if (name.includes("[instructorId]")) {
        instructorData.instructorId = select.value;
        const selectedOption = select.options[select.selectedIndex];
        instructorData.name = selectedOption.text.trim();
        if (instructorData.instructorId) hasRequiredFields = true;
      } else if (name.includes("[role]")) {
        instructorData.role = select.value;
      }
    });

    if (!hasRequiredFields) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please select an instructor before saving"
      );
      return;
    }

    // Add to saved items (create instructors array if it doesn't exist)
    if (!this.savedDynamicItems.instructors) {
      this.savedDynamicItems.instructors = [];
    }

    this.savedDynamicItems.instructors.push(instructorData);
    this.markItemAsSaved(instructorElement, "Instructor saved locally");

    console.log("💾 Instructor saved locally:", instructorData);
  }

  // Save certification body method
  async saveCertificationBody(element) {
    const selects = element.querySelectorAll("select");
    const bodyData = {
      id: this.generateId(),
      bodyId: "",
      name: "",
      role: "co-issuer", // Default to co-issuer, not primary
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;
    selects.forEach((select) => {
      const name = select.name;
      if (name.includes("[bodyId]")) {
        bodyData.bodyId = select.value;
        const selectedOption = select.options[select.selectedIndex];
        bodyData.name = selectedOption.text.trim();
        if (bodyData.bodyId) hasRequiredFields = true;
      } else if (name.includes("[role]")) {
        bodyData.role = select.value;
      }
    });

    if (!hasRequiredFields) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please select a certification body before saving"
      );
      return;
    }

    // Add to saved items
    if (!this.savedDynamicItems.certificationBodies) {
      this.savedDynamicItems.certificationBodies = [];
    }

    this.savedDynamicItems.certificationBodies.push(bodyData);
    this.markItemAsSaved(element, "Certification body saved locally");

    console.log("💾 Certification body saved locally:", bodyData);
  }

  // Update clearSavedDynamicItems to include certificationBodies:
  clearSavedDynamicItems() {
    this.savedDynamicItems = {
      objectives: [],
      modules: [],
      targetAudience: [],
      procedures: [],
      equipment: [],
      questions: [],
      partnerHotels: [],
      videoLinks: [],
      links: [],
      instructors: [],
      certificationBodies: [], // ADD THIS
    };
  }

  addTargetAudience(text = "") {
    const container = document.getElementById("targetAudienceContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "target-audience-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Target Audience ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveTargetAudience(this.closest('.dynamic-item'))" title="Save target audience">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'targetAudience')" title="Remove target audience">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <input type="text" name="content[targetAudience][${index}]" placeholder="Target audience (e.g., Medical doctors)" required value="${text}">
            </div>
        `;

    container.appendChild(div);
  }

  addProcedure(text = "") {
    const container = document.getElementById("proceduresContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "procedure-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Procedure ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveProcedure(this.closest('.dynamic-item'))" title="Save procedure">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'procedures')" title="Remove procedure">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <input type="text" name="practical[procedures][${index}]" placeholder="Procedure name" required value="${text}">
            </div>
        `;

    container.appendChild(div);
  }

  addEquipment(text = "") {
    const container = document.getElementById("equipmentContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "equipment-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Equipment ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveEquipment(this.closest('.dynamic-item'))" title="Save equipment">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'equipment')" title="Remove equipment">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <input type="text" name="practical[equipment][${index}]" placeholder="Equipment/tool name" required value="${text}">
            </div>
        `;

    container.appendChild(div);
  }

  addQuestion(data = null) {
    const container = document.getElementById("questionsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const questionDiv = document.createElement("div");
    questionDiv.className = "question-item dynamic-item";
    questionDiv.dataset.itemId = itemId;
    questionDiv.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Question ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveQuestion(this.closest('.dynamic-item'))" title="Save question">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'questions')" title="Remove question">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label>Question</label>
                    <textarea name="assessment[questions][${index}][question]" placeholder="Question text" required>${
      data?.question || ""
    }</textarea>
                </div>
                <div class="form-group">
                    <label>Answer 1</label>
                    <input type="text" name="assessment[questions][${index}][answers][0]" placeholder="Answer option 1" required value="${
      data?.answers?.[0] || ""
    }">
                </div>
                <div class="form-group">
                    <label>Answer 2</label>
                    <input type="text" name="assessment[questions][${index}][answers][1]" placeholder="Answer option 2" required value="${
      data?.answers?.[1] || ""
    }">
                </div>
                <div class="form-group">
                    <label>Answer 3</label>
                    <input type="text" name="assessment[questions][${index}][answers][2]" placeholder="Answer option 3" value="${
      data?.answers?.[2] || ""
    }">
                </div>
                <div class="form-group">
                    <label>Answer 4</label>
                    <input type="text" name="assessment[questions][${index}][answers][3]" placeholder="Answer option 4" value="${
      data?.answers?.[3] || ""
    }">
                </div>
                <div class="form-group">
                    <label>Correct Answer (1-4)</label>
                    <input type="number" name="assessment[questions][${index}][correctAnswer]" min="1" max="4" required value="${
      data?.correctAnswer || ""
    }">
                </div>
                <div class="form-group">
                    <label>Points</label>
                    <input type="number" name="assessment[questions][${index}][points]" min="1" value="${
      data?.points || 1
    }">
                </div>
            </div>
        `;

    container.appendChild(questionDiv);
  }

  addPartnerHotel(text = "") {
    const container = document.getElementById("partnerHotelsContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "partner-hotel-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Partner Hotel ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.savePartnerHotel(this.closest('.dynamic-item'))" title="Save partner hotel">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'partnerHotels')" title="Remove partner hotel">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <input type="text" name="inclusions[accommodation][partnerHotels][${index}]" placeholder="Hotel name or booking link" required value="${text}">
            </div>
        `;

    container.appendChild(div);
  }

  addVideoLink(text = "") {
    const container = document.getElementById("videoLinksContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "video-link-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>Video Link ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveVideoLink(this.closest('.dynamic-item'))" title="Save video link">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'videoLinks')" title="Remove video link">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <input type="url" name="media[videos][${index}]" placeholder="YouTube, Vimeo, etc." required value="${text}">
            </div>
        `;

    container.appendChild(div);
  }

  addLink(data = null) {
    const container = document.getElementById("linksContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "link-item dynamic-item";
    div.dataset.itemId = itemId;
    div.innerHTML = `
            <div class="dynamic-item-header">
                <h6>External Link ${index + 1}</h6>
                <div class="dynamic-item-actions">
                    <button type="button" class="save-item-btn" onclick="adminCourses.saveLink(this.closest('.dynamic-item'))" title="Save link">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'links')" title="Remove link">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="media[links][${index}][title]" placeholder="Link title" required value="${
      data?.title || ""
    }">
                </div>
                <div class="form-group">
                    <label>URL</label>
                    <input type="url" name="media[links][${index}][url]" placeholder="https://..." required value="${
      data?.url || ""
    }">
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select name="media[links][${index}][type]">
                        <option value="article" ${
                          data?.type === "article" ? "selected" : ""
                        }>Article</option>
                        <option value="video" ${
                          data?.type === "video" ? "selected" : ""
                        }>Video</option>
                        <option value="tool" ${
                          data?.type === "tool" ? "selected" : ""
                        }>Tool</option>
                        <option value="website" ${
                          data?.type === "website" ? "selected" : ""
                        }>Website</option>
                    </select>
                </div>
            </div>
        `;

    container.appendChild(div);
  }

  //new for certification
  // Add this method after other dynamic methods:
  addCertificationBody(data = null) {
    const container = document.getElementById("certificationBodiesContainer");
    if (!container) return;

    const index = container.children.length;
    const itemId = this.generateId();

    const div = document.createElement("div");
    div.className = "certification-body-item dynamic-item";
    div.dataset.itemId = itemId;

    // Build options HTML from available certification bodies
    let optionsHtml = '<option value="">Select Certification Body</option>';

    // Add default IAAI option
    optionsHtml +=
      '<option value="">IAAI Training Institute (Default)</option>';

    // Group by membership level
    const grouped = {
      Gold: [],
      Silver: [],
      Bronze: [],
      Standard: [],
    };

    if (this.certificationBodies && this.certificationBodies.length > 0) {
      this.certificationBodies.forEach((body) => {
        const level = body.membershipLevel || "Standard";
        if (grouped[level]) {
          grouped[level].push(body);
        }
      });

      // Add grouped options
      Object.keys(grouped).forEach((level) => {
        if (grouped[level].length > 0) {
          optionsHtml += `<optgroup label="${level} Members">`;
          grouped[level].forEach((body) => {
            const isSelected = data?.bodyId === body._id ? "selected" : "";
            optionsHtml += `<option value="${body._id}" ${isSelected}>${
              body.displayName || body.companyName
            }</option>`;
          });
          optionsHtml += "</optgroup>";
        }
      });
    }

    div.innerHTML = `
    <div class="dynamic-item-header">
        <h6>Additional Certification Body ${index + 1}</h6>
        <div class="dynamic-item-actions">
            <button type="button" class="save-item-btn" onclick="adminCourses.saveCertificationBody(this.closest('.dynamic-item'))" title="Save certification body">
                <i class="fas fa-save"></i>
            </button>
            <button type="button" class="remove-btn" onclick="adminCourses.removeDynamicItem(this.closest('.dynamic-item'), 'certificationBodies')" title="Remove certification body">
                <i class="fas fa-times"></i>
            </button>
        </div>
    </div>
    <div class="form-grid">
        <div class="form-group">
            <label>Certification Body</label>
            <select name="certification[additionalBodies][${index}][bodyId]" required onchange="adminCourses.updateCertificationBodyInfo(this)">
                ${optionsHtml}
            </select>
        </div>
        <div class="form-group">
            <label>Body Name</label>
            <input type="text" name="certification[additionalBodies][${index}][name]" readonly value="${
      data?.name || ""
    }">
        </div>
        <div class="form-group">
            <label>Role</label>
            <select name="certification[additionalBodies][${index}][role]">
                <option value="co-issuer" ${
                  data?.role === "co-issuer" ? "selected" : ""
                }>Co-Issuer</option>
                <option value="endorser" ${
                  data?.role === "endorser" ? "selected" : ""
                }>Endorser</option>
                <option value="partner" ${
                  data?.role === "partner" ? "selected" : ""
                }>Partner</option>
            </select>
        </div>
    </div>
`;

    container.appendChild(div);

    // If data is provided, update the name field
    if (data?.bodyId) {
      const selectElement = div.querySelector('select[name*="[bodyId]"]');
      if (selectElement) {
        this.updateCertificationBodyInfo(selectElement);
      }
    }

    console.log("✅ Added certification body with populated options");
  }

  // ENHANCEMENT: Local Save Functions for Dynamic Items with improved validation
  async saveObjective(objectiveElement) {
    const input = objectiveElement.querySelector("input");
    const objectiveText = input.value.trim();

    if (!objectiveText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter an objective before saving"
      );
      return;
    }

    if (objectiveText.length > 200) {
      this.showToast(
        "warning",
        "Validation Error",
        "Objective must be 200 characters or less"
      );
      return;
    }

    const objectiveData = {
      id: this.generateId(),
      text: objectiveText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    this.savedDynamicItems.objectives.push(objectiveData);
    this.markItemAsSaved(objectiveElement, "Objective saved locally");

    console.log("💾 Objective saved locally:", objectiveData);
  }

  async saveModule(moduleElement) {
    const inputs = moduleElement.querySelectorAll("input, textarea");
    const moduleData = {
      id: this.generateId(),
      title: "",
      duration: "",
      order: 1,
      description: "",
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[title]")) {
        moduleData.title = input.value.trim();
        if (moduleData.title) hasRequiredFields = true;
      } else if (name.includes("[duration]")) {
        moduleData.duration = input.value.trim();
      } else if (name.includes("[order]")) {
        moduleData.order = parseInt(input.value) || 1;
      } else if (name.includes("[description]")) {
        moduleData.description = input.value.trim();
      }
    });

    if (!hasRequiredFields) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter a module title before saving"
      );
      return;
    }

    this.savedDynamicItems.modules.push(moduleData);
    this.markItemAsSaved(moduleElement, "Module saved locally");

    console.log("💾 Module saved locally:", moduleData);
  }

  async saveTargetAudience(element) {
    const input = element.querySelector("input");
    const audienceText = input.value.trim();

    if (!audienceText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter target audience before saving"
      );
      return;
    }

    const audienceData = {
      id: this.generateId(),
      text: audienceText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    this.savedDynamicItems.targetAudience.push(audienceData);
    this.markItemAsSaved(element, "Target audience saved locally");

    console.log("💾 Target audience saved locally:", audienceData);
  }

  async saveProcedure(element) {
    const input = element.querySelector("input");
    const procedureText = input.value.trim();

    if (!procedureText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter procedure name before saving"
      );
      return;
    }

    const procedureData = {
      id: this.generateId(),
      name: procedureText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    this.savedDynamicItems.procedures.push(procedureData);
    this.markItemAsSaved(element, "Procedure saved locally");

    console.log("💾 Procedure saved locally:", procedureData);
  }

  async saveEquipment(element) {
    const input = element.querySelector("input");
    const equipmentText = input.value.trim();

    if (!equipmentText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter equipment name before saving"
      );
      return;
    }

    const equipmentData = {
      id: this.generateId(),
      name: equipmentText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    this.savedDynamicItems.equipment.push(equipmentData);
    this.markItemAsSaved(element, "Equipment saved locally");

    console.log("💾 Equipment saved locally:", equipmentData);
  }

  async saveQuestion(element) {
    const inputs = element.querySelectorAll("input, textarea");
    const questionData = {
      id: this.generateId(),
      question: "",
      answers: [],
      correctAnswer: null,
      points: 1,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[question]")) {
        questionData.question = input.value.trim();
        if (questionData.question) hasRequiredFields = true;
      } else if (name.includes("[answers]")) {
        questionData.answers.push(input.value.trim());
      } else if (name.includes("[correctAnswer]")) {
        questionData.correctAnswer = parseInt(input.value);
      } else if (name.includes("[points]")) {
        questionData.points = parseInt(input.value) || 1;
      }
    });

    if (!hasRequiredFields) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter a question before saving"
      );
      return;
    }

    if (
      questionData.correctAnswer === null ||
      questionData.correctAnswer < 1 ||
      questionData.correctAnswer > 4
    ) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please select a valid correct answer (1-4)"
      );
      return;
    }

    this.savedDynamicItems.questions.push(questionData);
    this.markItemAsSaved(element, "Question saved locally");

    console.log("💾 Question saved locally:", questionData);
  }

  async savePartnerHotel(element) {
    const input = element.querySelector("input");
    const hotelText = input.value.trim();

    if (!hotelText) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter hotel name before saving"
      );
      return;
    }

    const hotelData = {
      id: this.generateId(),
      name: hotelText,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    this.savedDynamicItems.partnerHotels.push(hotelData);
    this.markItemAsSaved(element, "Partner hotel saved locally");

    console.log("💾 Partner hotel saved locally:", hotelData);
  }

  async saveVideoLink(element) {
    const input = element.querySelector("input");
    const videoUrl = input.value.trim();

    if (!videoUrl) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter video URL before saving"
      );
      return;
    }

    // Basic URL validation
    try {
      new URL(videoUrl);
    } catch {
      this.showToast("warning", "Validation Error", "Please enter a valid URL");
      return;
    }

    const videoData = {
      id: this.generateId(),
      url: videoUrl,
      saved: true,
      timestamp: new Date().toISOString(),
    };

    this.savedDynamicItems.videoLinks.push(videoData);
    this.markItemAsSaved(element, "Video link saved locally");

    console.log("💾 Video link saved locally:", videoData);
  }

  async saveLink(element) {
    const inputs = element.querySelectorAll("input, select");
    const linkData = {
      id: this.generateId(),
      title: "",
      url: "",
      type: "website",
      saved: true,
      timestamp: new Date().toISOString(),
    };

    let hasRequiredFields = false;
    inputs.forEach((input) => {
      const name = input.name;
      if (name.includes("[title]")) {
        linkData.title = input.value.trim();
        if (linkData.title) hasRequiredFields = true;
      } else if (name.includes("[url]")) {
        linkData.url = input.value.trim();
        if (linkData.url) hasRequiredFields = true;
      } else if (name.includes("[type]")) {
        linkData.type = input.value;
      }
    });

    if (!hasRequiredFields) {
      this.showToast(
        "warning",
        "Validation Error",
        "Please enter link title and URL before saving"
      );
      return;
    }

    // Basic URL validation
    try {
      new URL(linkData.url);
    } catch {
      this.showToast("warning", "Validation Error", "Please enter a valid URL");
      return;
    }

    this.savedDynamicItems.links.push(linkData);
    this.markItemAsSaved(element, "Link saved locally");

    console.log("💾 Link saved locally:", linkData);
  }

  // Helper function to mark an item as saved
  markItemAsSaved(element, message) {
    // Add saved class to the element
    element.classList.add("saved-item");
    element.setAttribute("data-saved", "true");

    // Find the save button and update its appearance
    const saveBtn = element.querySelector(".save-item-btn");
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-check"></i>';
      saveBtn.classList.add("saved");
      saveBtn.title = "Saved";
      saveBtn.disabled = true; // Disable the button
    }

    // Show success toast
    this.showToast("success", "Success", message);

    // Add visual feedback (keep permanently)
    element.style.backgroundColor = "#f0fdf4";
    element.style.borderColor = "#10b981";
  }

  // Helper function to generate unique IDs
  generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper function to remove item from saved items
  removeSavedItem(element, itemType) {
    const itemId = element.dataset.itemId;
    if (itemId && this.savedDynamicItems[itemType]) {
      this.savedDynamicItems[itemType] = this.savedDynamicItems[
        itemType
      ].filter((item) => item.id !== itemId);
      console.log(`🗑️ Removed saved ${itemType} item:`, itemId);
    }
  }

  // Enhanced delete method that handles all roles properly
  removeDynamicItem(element, itemType) {
    // Get item details for confirmation
    const itemTitle = this.getItemTitle(element, itemType);

    this.showConfirmModal(
      "Remove Item",
      `Are you sure you want to remove "${itemTitle}"? This action cannot be undone.`,
      () => {
        // Remove from saved items if it exists
        this.removeSavedItem(element, itemType);

        // ENHANCED: For instructors, handle deletion properly regardless of role
        if (itemType === "instructors") {
          const instructorIdInput = element.querySelector(
            'select[name*="[instructorId]"]'
          );
          const roleSelect = element.querySelector('select[name*="[role]"]');

          // Log for debugging (remove in production)
          console.log("🗑️ Deleting instructor:");
          console.log(`   - ID: ${instructorIdInput?.value || "None"}`);
          console.log(`   - Role: ${roleSelect?.value || "None"}`);

          if (instructorIdInput && instructorIdInput.value) {
            // Create a hidden input to mark this instructor for deletion
            const deletionMarker = document.createElement("input");
            deletionMarker.type = "hidden";
            deletionMarker.name = "deletedInstructors[]";
            deletionMarker.value = instructorIdInput.value;

            // Add a data attribute to track the original role (optional)
            deletionMarker.setAttribute(
              "data-original-role",
              roleSelect?.value || "unknown"
            );

            document.getElementById("courseForm").appendChild(deletionMarker);

            console.log(
              `🗑️ Marked instructor ${instructorIdInput.value} (${roleSelect?.value}) for deletion`
            );
          } else {
            console.warn(
              "⚠️ No instructor ID found - this might be a new instructor not yet saved"
            );
          }
        }

        // Remove the DOM element
        element.remove();

        this.showToast("info", "Item Removed", `${itemTitle} has been removed`);
      }
    );
  }

  // Enhanced getItemTitle method to handle instructor roles better
  getItemTitle(element, itemType) {
    let title = "this item";

    try {
      switch (itemType) {
        // ... other cases ...

        case "instructors":
          const instructorSelect = element.querySelector(
            'select[name*="[instructorId]"]'
          );
          const roleSelect = element.querySelector('select[name*="[role]"]');

          if (instructorSelect && instructorSelect.selectedIndex > 0) {
            const instructorName =
              instructorSelect.options[
                instructorSelect.selectedIndex
              ].textContent.trim();
            const role = roleSelect?.value || "Instructor";
            title = `${instructorName} (${role})`;
          } else {
            const role = roleSelect?.value || "Instructor";
            title = `Unassigned ${role}`;
          }
          break;

        // ... other cases remain the same ...
      }
    } catch (error) {
      console.warn("Error getting item title:", error);
    }

    return title;
  }

  // Method to validate all deletion markers before submission
  validateDeletionMarkers() {
    const deletionMarkers = document.querySelectorAll(
      'input[name="deletedInstructors[]"]'
    );

    console.log(
      `📋 Found ${deletionMarkers.length} instructor deletion markers:`
    );

    deletionMarkers.forEach((marker, index) => {
      const instructorId = marker.value;
      const originalRole =
        marker.getAttribute("data-original-role") || "unknown";

      console.log(
        `   ${index + 1}. Instructor ID: ${instructorId}, Role: ${originalRole}`
      );
    });

    return deletionMarkers.length;
  }

  // Call this before form submission to verify deletions
  debugFormSubmission() {
    console.log("🔍 DEBUG: Form submission - checking instructor deletions");

    const deletionCount = this.validateDeletionMarkers();

    if (deletionCount > 0) {
      console.log(`✅ ${deletionCount} instructors marked for deletion`);
    } else {
      console.log("ℹ️ No instructors marked for deletion");
    }
  }

  async submitForm(e) {
    console.log("🚀 submitForm called");
    console.log(
      "🔍 this.savedUploadedFiles at submission:",
      this.savedUploadedFiles
    );

    e.preventDefault();

    if (!this.validateCurrentStep()) return;

    this.showLoading(true);

    try {
      console.log("🚀 Starting form submission...");

      // Use FormData for multipart submission
      const formData = new FormData(document.getElementById("courseForm"));

      // IMPORTANT: Ensure primary instructor is included
      const primaryInstructorId = document.querySelector(
        '[name="instructors[primary][instructorId]"]'
      )?.value;
      const primaryInstructorName = document.querySelector(
        '[name="instructors[primary][name]"]'
      )?.value;
      const primaryInstructorRole = document.querySelector(
        '[name="instructors[primary][role]"]'
      )?.value;

      // If editing and primary instructor exists, ensure it's in the form data
      if (this.editingCourse && primaryInstructorId) {
        formData.set("instructors[primary][instructorId]", primaryInstructorId);
        formData.set("instructors[primary][name]", primaryInstructorName || "");
        formData.set(
          "instructors[primary][role]",
          primaryInstructorRole || "Lead Instructor"
        );
      }

      // FIXED: Send uploaded files in the correct format expected by backend
      if (this.savedUploadedFiles) {
        console.log(
          "📁 Processing savedUploadedFiles:",
          this.savedUploadedFiles
        );

        // Create a structured uploadedFiles object
        const uploadedFilesForBackend = {};

        Object.keys(this.savedUploadedFiles).forEach((fileType) => {
          const files = this.savedUploadedFiles[fileType];

          if (fileType === "mainImage" && files) {
            // Main image is a single file
            uploadedFilesForBackend[fileType] = [files];
            console.log(`📁 Added mainImage: ${files}`);
          } else if (Array.isArray(files) && files.length > 0) {
            // Multiple files
            uploadedFilesForBackend[fileType] = files;
            console.log(`📁 Added ${fileType}: ${files.length} files`);
          }
        });

        // Send as JSON string that backend can parse
        formData.append(
          "uploadedFiles",
          JSON.stringify(uploadedFilesForBackend)
        );
        console.log(
          "📁 Added uploadedFiles to formData:",
          uploadedFilesForBackend
        );
      } else {
        console.log("📁 No savedUploadedFiles to process");
      }

      // Add savedDynamicItems as JSON string
      const savedItemsJson = JSON.stringify(this.savedDynamicItems);
      formData.append("savedDynamicItems", savedItemsJson);

      console.log("💾 SavedDynamicItems:", this.savedDynamicItems);
      console.log("📤 SavedDynamicItems JSON:", savedItemsJson);

      // Debug: Log form data (optional - you can remove this in production)
      console.log("📋 Form Data Contents:");
      for (let [key, value] of formData.entries()) {
        if (key.length < 50 && typeof value === "string") {
          console.log(`"${key}": "${value}"`);
        } else if (key === "uploadedFiles") {
          console.log(`"${key}": ${value}`);
        }
      }

      // Ensure required fields exist
      const requiredFields = {
        "basic[courseCode]": document.querySelector(
          '[name="basic[courseCode]"]'
        )?.value,
        "basic[title]": document.querySelector('[name="basic[title]"]')?.value,
        "basic[description]": document.querySelector(
          '[name="basic[description]"]'
        )?.value,
        "schedule[startDate]": document.querySelector(
          '[name="schedule[startDate]"]'
        )?.value,
        "enrollment[price]": document.querySelector(
          '[name="enrollment[price]"]'
        )?.value,
        "venue[name]": document.querySelector('[name="venue[name]"]')?.value,
      };

      console.log("🔍 Required fields check:", requiredFields);

      // Validate required fields
      const missingFields = [];
      Object.entries(requiredFields).forEach(([field, value]) => {
        if (!value || !value.trim()) {
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
      }

      const url = this.editingCourse
        ? `/admin-courses/inperson/api/${this.editingCourse}`
        : "/admin-courses/inperson/api";

      const method = this.editingCourse ? "PUT" : "POST";

      console.log(`📡 Submitting ${method} to ${url}`);

      const response = await fetch(url, {
        method: method,
        body: formData, // Send as FormData (multipart)
      });

      console.log("📊 Response status:", response.status);
      console.log("📊 Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response error text:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Response result:", result);

      if (result.success) {
        this.closeCourseModal();
        this.showToast(
          "success",
          "Success",
          result.message ||
            (this.editingCourse
              ? "Course updated successfully"
              : "Course created successfully")
        );

        // Clear saved files after successful save
        this.savedUploadedFiles = {
          mainImage: null,
          documents: [],
          images: [],
          videos: [],
        };
        console.log("🧹 Cleared saved uploaded files after successful save");

        await this.loadInitialData();
      } else {
        throw new Error(result.message || "Unknown error occurred");
      }
    } catch (error) {
      console.error("❌ Submission error:", error);
      this.showToast(
        "error",
        "Error",
        `Failed to save course: ${error.message}`
      );
    } finally {
      this.showLoading(false);
    }
  }

  // FIXED: Enhanced form validation
  validateCurrentStep() {
    const currentStepElement = document.querySelector(
      `[data-step="${this.currentStep}"]`
    );

    if (!currentStepElement) {
      const visibleStep = document.querySelector(".form-step:not(.hidden)");
      if (!visibleStep) {
        console.warn(`⚠️ No form step found for step ${this.currentStep}`);
        return true;
      }
    }

    const stepElement =
      currentStepElement || document.querySelector(".form-step:not(.hidden)");
    const requiredFields = stepElement.querySelectorAll("[required]");

    console.log(
      `🔍 Validating step ${this.currentStep}, found ${requiredFields.length} required fields`
    );

    return this.validateFields(requiredFields);
  }

  // FIXED: Enhanced field validation with detailed logging
  validateFields(requiredFields) {
    if (!requiredFields || requiredFields.length === 0) {
      return true;
    }

    let isValid = true;
    const invalidFields = [];

    requiredFields.forEach((field) => {
      const value = field.value ? field.value.trim() : "";
      const fieldName = field.name || field.id || "unknown field";

      if (!value) {
        field.style.borderColor = "#ef4444";
        field.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
        invalidFields.push(fieldName);
        isValid = false;
      } else {
        field.style.borderColor = "#e5e7eb";
        field.style.boxShadow = "";
      }
    });

    if (!isValid) {
      console.warn("❌ Validation failed for fields:", invalidFields);
      this.showToast(
        "warning",
        "Validation Error",
        `Please fill in all required fields: ${invalidFields.join(", ")}`
      );
    }

    return isValid;
  }

  // FIXED: Enhanced debugging function
  debugFormData() {
    console.log("🔍 DEBUG: Current form state");

    const form = document.getElementById("courseForm");
    if (!form) {
      console.error("❌ Form not found");
      return;
    }

    const formData = new FormData(form);

    console.log("📋 All form fields:");
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    console.log("💾 Saved dynamic items:");
    Object.entries(this.savedDynamicItems).forEach(([key, items]) => {
      console.log(`  ${key}: ${items.length} items`);
      items.forEach((item, index) => {
        console.log(`    ${index}: ${JSON.stringify(item)}`);
      });
    });

    console.log("🎯 Required field check:");
    const requiredSelectors = [
      '[name="basic[courseCode]"]',
      '[name="basic[title]"]',
      '[name="basic[description]"]',
      '[name="schedule[startDate]"]',
      '[name="enrollment[price]"]',
      '[name="venue[name]"]',
    ];

    requiredSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      console.log(`  ${selector}: ${element ? element.value : "NOT FOUND"}`);
    });
  }

  // Course Actions
  async editCourse(courseId) {
    try {
      console.log("✏️ Editing course:", courseId);

      // Show loading
      this.showLoading(true);

      const response = await fetch(`/admin-courses/inperson/api/${courseId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        console.log(
          "📝 Course data loaded for editing:",
          result.course.basic?.title || "Untitled"
        );

        // Set editing course ID
        this.editingCourse = courseId;

        // Open modal WITHOUT courseId to prevent recursion
        await this.openCourseModal(); // Don't pass courseId

        // Populate form after modal is open
        this.populateFormWithCourse(result.course);
      } else {
        this.showToast(
          "error",
          "Error",
          result.message || "Failed to load course data"
        );
      }
    } catch (error) {
      console.error("Error loading course for edit:", error);
      this.showToast("error", "Error", "Failed to load course data");
    } finally {
      this.showLoading(false);
    }
  }
  //.............................clonde................
  // Replace the existing cloneCourse method in your AdminCoursesManager class

  /**
   * Clone course with enhanced options
   */
  async cloneCourse(courseId) {
    try {
      const course = this.courses.find((c) => c._id === courseId);
      const courseName = course
        ? course.basic?.title || "this course"
        : "this course";

      // Show clone options modal
      this.showCloneOptionsModal(courseId, courseName);
    } catch (error) {
      console.error("Error preparing course clone:", error);
      this.showToast("error", "Error", "Failed to prepare course clone");
    }
  }

  /**
   * Show clone options modal
   */
  showCloneOptionsModal(courseId, courseName) {
    // Create clone options modal dynamically
    const modalHTML = `
        <div class="modal-overlay" id="cloneOptionsModal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Clone Course: ${courseName}</h3>
                    <button class="close-btn" onclick="adminCourses.closeCloneOptionsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="cloneOptionsForm">
                        <div class="form-group">
                            <label for="cloneTitle">New Course Title *</label>
                            <input type="text" id="cloneTitle" name="title" required
                                           placeholder="Enter new course title" maxlength="200">
                            <small class="help-text">The title for the cloned course</small>
                        </div>

                        <div class="form-group">
                            <label for="cloneCourseCode">New Course Code *</label>
                            <input type="text" id="cloneCourseCode" name="courseCode" required
                                           placeholder="Enter unique course code" maxlength="50"
                                           style="text-transform: uppercase;">
                            <small class="help-text">Must be unique across all courses</small>
                        </div>

                        <div class="form-group">
                            <label for="cloneStartDate">New Start Date *</label>
                            <input type="datetime-local" id="cloneStartDate" name="startDate" required>
                            <small class="help-text">Course will be scheduled for this date</small>
                        </div>

                        <div class="form-group">
                            <label for="cloneStatus">Initial Status</label>
                            <select id="cloneStatus" name="status">
                                <option value="draft">Draft</option>
                                <option value="open" selected>Open to Register</option>
                                <option value="full">Full</option>
                            </select>
                            <small class="help-text">Status for the cloned course</small>
                        </div>

                        <div class="clone-options-section">
                            <h4>Clone Options</h4>
                            <div class="checkbox-grid">
                                <label class="checkbox-item">
                                    <input type="checkbox" name="cloneInstructors" checked>
                                    <span>Clone Instructors</span>
                                    <small>Copy instructor assignments</small>
                                </label>

                                <label class="checkbox-item">
                                    <input type="checkbox" name="cloneContent" checked>
                                    <span>Clone Content</span>
                                    <small>Copy objectives, modules, and materials</small>
                                </label>

                                <label class="checkbox-item">
                                    <input type="checkbox" name="cloneAssessment" checked>
                                    <span>Clone Assessment</span>
                                    <small>Copy quiz questions and certification settings</small>
                                </label>

                                <label class="checkbox-item">
                                    <input type="checkbox" name="cloneInclusions" checked>
                                    <span>Clone Inclusions</span>
                                    <small>Copy meals, accommodation, and service inclusions</small>
                                </label>

                                <label class="checkbox-item">
                                    <input type="checkbox" name="cloneMedia">
                                    <span>Clone Media Files</span>
                                    <small>Copy uploaded images and documents (references only)</small>
                                </label>

                                <label class="checkbox-item">
                                    <input type="checkbox" name="resetEnrollment" checked>
                                    <span>Reset Enrollment</span>
                                    <small>Start with 0 enrolled students</small>
                                </label>

                                <label class="checkbox-item">
                                    <input type="checkbox" id="saveToPool" name="saveToPool">
                                    <span>Save to Course Pool</span>
                                    <small>Store a template of this course (without dates, instructors, venue, price)</small>
                                </label>
                                <div class="form-group" id="poolKeywordsGroup" style="display: none;">
                                    <label for="poolKeywords">Pool Keywords (comma-separated)</label>
                                    <input type="text" id="poolKeywords" name="poolKeywords" placeholder="e.g., advanced, filler, anatomy">
                                    <small class="help-text">Keywords to help find this template in the pool.</small>
                                </div>
                                </div>
                        </div>

                        <div class="form-group">
                            <label for="cloneNotes">Clone Notes (Optional)</label>
                            <textarea id="cloneNotes" name="notes"
                                           placeholder="Add any notes about this clone..."></textarea>
                        </div>
                    </form>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="adminCourses.closeCloneOptionsModal()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary" onclick="adminCourses.executeClone('${courseId}')">
                            <i class="fas fa-copy"></i> Clone Course
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("cloneOptionsModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Show modal
    const modal = document.getElementById("cloneOptionsModal");
    modal.classList.add("active");

    // Set default values
    this.setCloneDefaults(courseId);

    // Add event listeners
    this.setupCloneModalEventListeners();

    // NEW: Add event listener for saveToPool checkbox
    const saveToPoolCheckbox = document.getElementById("saveToPool");
    const poolKeywordsGroup = document.getElementById("poolKeywordsGroup");
    if (saveToPoolCheckbox && poolKeywordsGroup) {
      saveToPoolCheckbox.addEventListener("change", () => {
        poolKeywordsGroup.style.display = saveToPoolCheckbox.checked
          ? "block"
          : "none";
        // Make poolKeywords input required if checkbox is checked
        const poolKeywordsInput = document.getElementById("poolKeywords");
        if (poolKeywordsInput) {
          poolKeywordsInput.required = saveToPoolCheckbox.checked;
        }
      });
    }
  }

  /**
   * Set default values for clone form
   */
  setCloneDefaults(courseId) {
    const originalCourse = this.courses.find((c) => c._id === courseId);
    if (!originalCourse) return;

    // Set default title
    const originalTitle = originalCourse.basic?.title || "Course";
    document.getElementById("cloneTitle").value = `${originalTitle} (Copy)`;

    // Set default course code
    const originalCode = originalCourse.basic?.courseCode || "COURSE";
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    document.getElementById(
      "cloneCourseCode"
    ).value = `${originalCode}-COPY-${timestamp}`;

    // Set default start date (30 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    document.getElementById("cloneStartDate").value = futureDate
      .toISOString()
      .slice(0, 16);
  }

  /**
   * Setup event listeners for clone modal
   */
  setupCloneModalEventListeners() {
    // Auto-generate course code when title changes
    const titleInput = document.getElementById("cloneTitle");
    const codeInput = document.getElementById("cloneCourseCode");

    titleInput.addEventListener("input", (e) => {
      const title = e.target.value.trim();
      if (title) {
        // Generate code from title
        const code = title
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 20);
        const timestamp = new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
        codeInput.value = `${code}-${timestamp}`;
      }
    });

    // Validate course code uniqueness on blur
    codeInput.addEventListener("blur", async (e) => {
      await this.validateCourseCode(e.target.value);
    });

    // Modal overlay click to close
    const modal = document.getElementById("cloneOptionsModal");
    modal.addEventListener("click", (e) => {
      if (e.target.id === "cloneOptionsModal") {
        this.closeCloneOptionsModal();
      }
    });
  }

  /**
   * Validate course code uniqueness
   */
  async validateCourseCode(courseCode) {
    if (!courseCode.trim()) return;

    try {
      const response = await fetch(
        `/admin-courses/inperson/api/check-course-code?code=${encodeURIComponent(
          courseCode
        )}`
      );
      const result = await response.json();

      const codeInput = document.getElementById("cloneCourseCode");
      const helpText = codeInput.parentElement.querySelector(".help-text");

      if (result.success && !result.available) {
        codeInput.style.borderColor = "#ef4444";
        helpText.textContent =
          "This course code already exists. Please choose a different one.";
        helpText.style.color = "#ef4444";
        return false;
      } else {
        codeInput.style.borderColor = "#10b981";
        helpText.textContent = "Course code is available";
        helpText.style.color = "#10b981";
        return true;
      }
    } catch (error) {
      console.error("Error validating course code:", error);
      return true; // Allow proceeding if validation fails
    }
  }

  /**
   * Close clone options modal
   */
  closeCloneOptionsModal() {
    const modal = document.getElementById("cloneOptionsModal");
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  }

  /**
   * Execute the course clone
   */
  /**
   * Execute the course clone
   */
  async executeClone(originalCourseId) {
    try {
      // Validate form
      const form = document.getElementById("cloneOptionsForm");
      const formData = new FormData(form);

      // Check required fields
      const requiredFields = ["title", "courseCode", "startDate"];
      // Conditionally add poolKeywords to required fields if saveToPool is checked
      if (formData.has("saveToPool") && formData.get("saveToPool") === "on") {
        requiredFields.push("poolKeywords");
      }

      const missingFields = [];

      requiredFields.forEach((field) => {
        if (!formData.get(field)?.trim()) {
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        this.showToast(
          "warning",
          "Validation Error",
          `Please fill in all required fields: ${missingFields.join(", ")}`
        );
        return;
      }

      // Validate course code uniqueness
      const codeIsValid = await this.validateCourseCode(
        formData.get("courseCode")
      );
      if (!codeIsValid) {
        this.showToast(
          "error",
          "Validation Error",
          "Please choose a unique course code for the main courses."
        );
        return;
      }

      // Prepare clone options
      const cloneOptions = {
        title: formData.get("title").trim(),
        courseCode: formData.get("courseCode").trim().toUpperCase(),
        startDate: formData.get("startDate"),
        status: formData.get("status"),
        notes: formData.get("notes")?.trim() || "",
        options: {
          cloneInstructors: formData.has("cloneInstructors"),
          cloneContent: formData.has("cloneContent"),
          cloneAssessment: formData.has("cloneAssessment"),
          cloneInclusions: formData.has("cloneInclusions"),
          cloneMedia: formData.has("cloneMedia"),
          resetEnrollment: formData.has("resetEnrollment"),
        },
        // NEW: Include saveToPool and poolKeywords
        saveToPool: formData.has("saveToPool"),
        poolKeywords:
          formData
            .get("poolKeywords")
            ?.split(",")
            .map((k) => k.trim())
            .filter(Boolean) || [],
      };

      console.log("🔄 Cloning course with options:", cloneOptions);

      this.showLoading(true);

      // Send clone request
      const response = await fetch(
        `/admin-courses/inperson/api/${originalCourseId}/clone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cloneOptions),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // Close modal
        this.closeCloneOptionsModal();

        // Show success message
        let successMessage = `Course "${cloneOptions.title}" cloned successfully!`;
        if (result.poolSaveResult?.success) {
          successMessage += ` Also saved to Course Pool.`;
        } else if (result.poolSaveResult?.message) {
          successMessage += ` (Pool save status: ${result.poolSaveResult.message})`;
        }
        this.showToast("success", "Success", successMessage);

        // Reload course data
        await this.loadInitialData();

        // Optional: Open the cloned course for editing
        const shouldEdit = await this.showConfirmDialog(
          "Edit Cloned Course",
          "Would you like to edit the newly cloned course now?"
        );

        if (shouldEdit) {
          this.editCourse(result.course._id);
        }
      } else {
        throw new Error(result.message || "Failed to clone course");
      }
    } catch (error) {
      console.error("❌ Error cloning course:", error);
      this.showToast(
        "error",
        "Clone Failed",
        `Failed to clone course: ${error.message}`
      );
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Enhanced confirm dialog with promise return
   */
  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      this.showConfirmModal(title, message, () => resolve(true), {
        confirmText: "Yes",
        cancelText: "No",
        confirmClass: "btn-primary",
      });

      // Override cancel to resolve false
      const cancelBtn = document.getElementById("cancelAction");
      if (cancelBtn) {
        const originalHandler = cancelBtn.onclick;
        cancelBtn.onclick = () => {
          resolve(false);
          if (originalHandler) originalHandler();
        };
      }
    });
  }

  //................end of clone...................

  //.........new for pool

  // Inside AdminCoursesManager class

  // ... (existing code) ...

  // Add a new method to open the pool Browse modal
  async openPoolBrowseModal() {
    console.log("📚 Opening Course Pool browser...");
    this.showLoading(true);
    try {
      const response = await fetch("/admin-courses/inperson/api/pool");
      const result = await response.json();

      if (response.ok && result.success) {
        const poolModalContent = `
                <div class="modal-overlay" id="poolBrowseModal">
                    <div class="modal-container large">
                        <div class="modal-header">
                            <h3>Browse Course Templates from Pool</h3>
                            <button class="close-btn" onclick="adminCourses.closePoolBrowseModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <input type="text" id="poolSearchInput" placeholder="Search templates by title, code, keywords..." class="form-control mb-3">
                            <div id="poolItemsList" class="grid-view">
                                </div>
                            <div class="text-center mt-3" id="poolPagination"></div>
                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML("beforeend", poolModalContent);
        document.getElementById("poolBrowseModal").classList.add("active");

        this.poolItems = result.poolItems; // Store fetched pool items
        this.filterAndRenderPoolItems();

        // Add search and close listeners
        document
          .getElementById("poolSearchInput")
          .addEventListener("input", () => this.filterAndRenderPoolItems());
        document
          .getElementById("poolBrowseModal")
          .addEventListener("click", (e) => {
            if (e.target.id === "poolBrowseModal") this.closePoolBrowseModal();
          });
      } else {
        this.showToast(
          "error",
          "Error",
          result.message || "Failed to load course pool."
        );
      }
    } catch (error) {
      console.error("Error opening pool modal:", error);
      this.showToast("error", "Error", "Failed to load course pool.");
    } finally {
      this.showLoading(false);
    }
  }

  filterAndRenderPoolItems() {
    const searchTerm = document
      .getElementById("poolSearchInput")
      .value.toLowerCase();
    const filteredPoolItems = this.poolItems.filter((item) => {
      const matchesTitle = item.basic?.title
        ?.toLowerCase()
        .includes(searchTerm);
      const matchesCode = item.basic?.courseCode
        ?.toLowerCase()
        .includes(searchTerm);
      const matchesCategory = item.basic?.category
        ?.toLowerCase()
        .includes(searchTerm);
      const matchesKeywords = (item.metadata?.poolKeywords || []).some(
        (keyword) => keyword.includes(searchTerm)
      );
      const matchesDescription = item.basic?.description
        ?.toLowerCase()
        .includes(searchTerm);
      return (
        matchesTitle ||
        matchesCode ||
        matchesCategory ||
        matchesKeywords ||
        matchesDescription
      );
    });

    const poolItemsList = document.getElementById("poolItemsList");
    poolItemsList.innerHTML = "";

    if (filteredPoolItems.length === 0) {
      poolItemsList.innerHTML =
        '<div class="text-center">No matching templates found in the pool.</div>';
      return;
    }

    filteredPoolItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = "course-card"; // Reuse existing card styles
      card.innerHTML = `
            <div class="course-card-header">
                <h3>${item.basic?.title || "Untitled Template"}</h3>
            </div>
            <div class="course-card-body">
                <div class="course-card-meta">
                    <span class="status-badge status-template">TEMPLATE</span>
                    <span class="course-code">${
                      item.basic?.courseCode || "No Code"
                    }</span>
                </div>
                <div class="course-card-info">
                    <div><i class="fas fa-clock"></i> Duration: ${
                      item.schedule?.duration || "N/A"
                    }</div>
                    <div><i class="fas fa-tags"></i> Keywords: ${
                      (item.metadata?.poolKeywords || []).join(", ") || "N/A"
                    }</div>
                    <div class="course-description">${(
                      item.basic?.description || ""
                    ).substring(0, 100)}...</div>
                </div>
                <div class="course-card-actions">
                    <button class="action-btn btn-primary" onclick="adminCourses.usePoolItemAsTemplate('${
                      item._id
                    }')">
                        <i class="fas fa-plus"></i> Use as Template
                    </button>
                    <button class="action-btn delete-btn" onclick="adminCourses.deletePoolItem('${
                      item._id
                    }')">
                        <i class="fas fa-trash"></i> Delete from Pool
                    </button>
                </div>
            </div>
        `;
      poolItemsList.appendChild(card);
    });
  }

  closePoolBrowseModal() {
    const modal = document.getElementById("poolBrowseModal");
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => modal.remove(), 300);
    }
  }

  async usePoolItemAsTemplate(poolItemId) {
    this.showLoading(true);
    try {
      const response = await fetch(
        `/admin-courses/inperson/api/pool/${poolItemId}`
      );
      const result = await response.json();

      if (response.ok && result.success) {
        const poolItem = result.poolItem;
        console.log("Using pool item as template:", poolItem.basic.title);

        // Close the pool browser modal
        this.closePoolBrowseModal();

        // Open the main course modal for adding a NEW course
        this.editingCourse = null; // Ensure it's a new course
        await this.openCourseModal();

        // Populate form with pool item data (omitting certain fields)
        // Call setFormValue for each field from the poolItem
        // Ensure you reset any fields that should NOT be carried over from the template
        this.resetForm(); // Start with a clean form

        // Basic Information
        this.setFormValue("basic[courseCode]", ""); // Clear code for new unique generation
        this.setFormValue(
          "basic[title]",
          `${poolItem.basic?.title || ""} - New Instance`
        );
        this.setFormValue("basic[description]", poolItem.basic?.description);
        this.setFormValue("basic[category]", poolItem.basic?.category);
        this.setFormValue("basic[status]", "draft"); // Start as draft

        // Schedule & Duration (Clear dates, keep duration and time slots)
        this.setFormValue("schedule[startDate]", "");
        this.setFormValue("schedule[endDate]", "");
        this.setFormValue("schedule[registrationDeadline]", "");
        this.setFormValue("schedule[duration]", poolItem.schedule?.duration);
        this.setFormValue(
          "schedule[timeSlots][startTime]",
          poolItem.schedule?.timeSlots?.startTime
        );
        this.setFormValue(
          "schedule[timeSlots][endTime]",
          poolItem.schedule?.timeSlots?.endTime
        );
        this.setFormValue(
          "schedule[timeSlots][lunchBreak]",
          poolItem.schedule?.timeSlots?.lunchBreak
        );

        // Pricing & Enrollment (Clear price, keep structural defaults)
        this.setFormValue("enrollment[price]", ""); // Admin will set this
        this.setFormValue("enrollment[earlyBirdPrice]", "");
        this.setFormValue(
          "enrollment[currency]",
          poolItem.enrollment?.currency
        );
        this.setFormValue(
          "enrollment[seatsAvailable]",
          poolItem.enrollment?.seatsAvailable
        );
        this.setFormValue(
          "enrollment[minEnrollment]",
          poolItem.enrollment?.minEnrollment
        );
        this.setFormValue("enrollment[currentEnrollment]", 0); // Always start new instances with 0 enrollment

        // Instructors (Clear them, admin will assign)
        this.setFormValue("instructors[primary][instructorId]", ""); // Clear primary
        this.setFormValue("instructors[primary][name]", "");
        this.setFormValue("instructors[primary][role]", "Lead Instructor");
        // Clear additional instructors dynamically added
        this.clearDynamicSections(); // This function already clears additionalInstructorsContainer

        // Venue Information (Clear them, admin will assign)
        this.setFormValue("venue[name]", "");
        this.setFormValue("venue[address]", "");
        this.setFormValue("venue[city]", "");
        this.setFormValue("venue[country]", "");
        this.setFormValue("venue[type]", "training-center");
        this.setFormValue("venue[mapUrl]", "");
        this.setFormValue("venue[parkingAvailable]", true); // Default checkbox
        document
          .querySelectorAll('input[name="venue[facilities]"]')
          .forEach((cb) => (cb.checked = false)); // Clear facilities

        // Course Content
        if (poolItem.content?.objectives) {
          poolItem.content.objectives.forEach((obj) => this.addObjective(obj));
        }
        if (poolItem.content?.modules) {
          poolItem.content.modules.forEach((mod) => this.addModule(mod));
        }
        if (poolItem.content?.targetAudience) {
          poolItem.content.targetAudience.forEach((target) =>
            this.addTargetAudience(target)
          );
        }
        this.setFormValue(
          "content[experienceLevel]",
          poolItem.content?.experienceLevel
        );
        this.setFormValue(
          "content[prerequisites]",
          poolItem.content?.prerequisites
        );
        this.setFormValue(
          "content[technicalRequirements]",
          poolItem.content?.technicalRequirements
        );

        // Practical Training
        if (poolItem.practical) {
          this.setFormValue(
            "practical[hasHandsOn]",
            poolItem.practical.hasHandsOn
          );
          this.setFormValue(
            "practical[studentRatio]",
            poolItem.practical.studentRatio
          );
          if (poolItem.practical.procedures)
            poolItem.practical.procedures.forEach((proc) =>
              this.addProcedure(proc)
            );
          if (poolItem.practical.equipment)
            poolItem.practical.equipment.forEach((eq) => this.addEquipment(eq));
          if (poolItem.practical.trainingType) {
            poolItem.practical.trainingType.forEach((type) => {
              const checkbox = document.querySelector(
                `input[name="practical[trainingType]"][value="${type}"]`
              );
              if (checkbox) checkbox.checked = true;
            });
          }
          if (poolItem.practical.safetyRequirements) {
            this.setFormValue(
              "practical[safetyRequirements][ppeRequired]",
              poolItem.practical.safetyRequirements.ppeRequired
            );
            this.setFormValue(
              "practical[safetyRequirements][healthClearance]",
              poolItem.practical.safetyRequirements.healthClearance
            );
            this.setFormValue(
              "practical[safetyRequirements][insuranceRequired]",
              poolItem.practical.safetyRequirements.insuranceRequired
            );
          }
        }

        // Assessment & Certification
        if (poolItem.assessment) {
          this.setFormValue(
            "assessment[required]",
            poolItem.assessment.required
          );
          this.setFormValue("assessment[type]", poolItem.assessment.type);
          this.setFormValue(
            "assessment[passingScore]",
            poolItem.assessment.passingScore
          );
          this.setFormValue(
            "assessment[retakesAllowed]",
            poolItem.assessment.retakesAllowed
          );
          this.toggleAssessmentSections(poolItem.assessment.type || "none");
          if (poolItem.assessment.questions)
            poolItem.assessment.questions.forEach((q) => this.addQuestion(q));
        }

        if (poolItem.certification) {
          this.setFormValue(
            "certification[enabled]",
            poolItem.certification.enabled
          );
          this.setFormValue("certification[type]", poolItem.certification.type);
          this.setFormValue(
            "certification[issuingAuthority]",
            poolItem.certification.issuingAuthority
          );
          // Clear issuingAuthorityId as it's a new instance
          document.getElementById("issuingAuthorityId").value = "";

          // Handle additional certification bodies (by name)
          if (poolItem.certification.certificationBodies) {
            poolItem.certification.certificationBodies.forEach((body) => {
              // We can't select by ID here, so we'll re-add by name and let the admin re-select if needed.
              // Or, we'd need to map the name back to an ID if it exists in current cert bodies.
              // For simplicity, let's just add them as new dynamic items with their names.
              this.addCertificationBody({ name: body.name, role: body.role });
            });
          }

          if (poolItem.certification.requirements) {
            this.setFormValue(
              "certification[requirements][minimumAttendance]",
              poolItem.certification.requirements.minimumAttendance
            );
            this.setFormValue(
              "certification[requirements][minimumScore]",
              poolItem.certification.requirements.minimumScore
            );
            this.setFormValue(
              "certification[requirements][practicalRequired]",
              poolItem.certification.requirements.practicalRequired
            );
          }
          if (poolItem.certification.validity) {
            this.setFormValue(
              "certification[validity][isLifetime]",
              poolItem.certification.validity.isLifetime
            );
            this.setFormValue(
              "certification[validity][years]",
              poolItem.certification.validity.years
            );
          }
          if (poolItem.certification.features) {
            this.setFormValue(
              "certification[features][digitalBadge]",
              poolItem.certification.features.digitalBadge
            );
            this.setFormValue(
              "certification[features][qrVerification]",
              poolItem.certification.features.qrVerification
            );
            this.setFormValue(
              "certification[features][autoGenerate]",
              poolItem.certification.features.autoGenerate
            );
          }
        }

        // Inclusions & Services
        if (poolItem.inclusions) {
          if (poolItem.inclusions.meals) {
            this.setFormValue(
              "inclusions[meals][breakfast]",
              poolItem.inclusions.meals.breakfast
            );
            this.setFormValue(
              "inclusions[meals][lunch]",
              poolItem.inclusions.meals.lunch
            );
            this.setFormValue(
              "inclusions[meals][coffee]",
              poolItem.inclusions.meals.coffee
            );
            this.setFormValue(
              "inclusions[meals][dietaryOptions]",
              poolItem.inclusions.meals.dietaryOptions
            );
          }
          if (poolItem.inclusions.accommodation) {
            this.setFormValue(
              "inclusions[accommodation][included]",
              poolItem.inclusions.accommodation.included
            );
            this.setFormValue(
              "inclusions[accommodation][assistanceProvided]",
              poolItem.inclusions.accommodation.assistanceProvided
            );
            // No partner hotels in pool, so clear them if any old ones exist
            const partnerHotelsContainer = document.getElementById(
              "partnerHotelsContainer"
            );
            if (partnerHotelsContainer) partnerHotelsContainer.innerHTML = "";
          }
          if (poolItem.inclusions.materials) {
            this.setFormValue(
              "inclusions[materials][courseMaterials]",
              poolItem.inclusions.materials.courseMaterials
            );
            this.setFormValue(
              "inclusions[materials][certificatePrinting]",
              poolItem.inclusions.materials.certificatePrinting
            );
            this.setFormValue(
              "inclusions[materials][practiceSupplies]",
              poolItem.inclusions.materials.practiceSupplies
            );
            this.setFormValue(
              "inclusions[materials][takeHome]",
              poolItem.inclusions.materials.takeHome
            );
          }
          if (poolItem.inclusions.services) {
            this.setFormValue(
              "inclusions[services][airportTransfer]",
              poolItem.inclusions.services.airportTransfer
            );
            this.setFormValue(
              "inclusions[services][localTransport]",
              poolItem.inclusions.services.localTransport
            );
            this.setFormValue(
              "inclusions[services][translation]",
              poolItem.inclusions.services.translation
            );
          }
        }

        // Media & Files (only copy URLs, no physical files)
        // IMPORTANT: If media URLs are specific to the original course's upload folder,
        // they might not make sense for a new instance. Decide if you want to copy these.
        // For now, let's copy the URLs, assuming they are general course media.
        this.savedUploadedFiles = {
          // Reset and populate savedUploadedFiles with pool media URLs
          mainImage: poolItem.media?.mainImage?.url || null,
          documents: [...(poolItem.media?.documents || [])],
          images: [...(poolItem.media?.images || [])],
          videos: [...(poolItem.media?.videos || [])],
        };
        // Now, populate the file preview containers
        this.populateFilePreviewsFromSaved(); // A new helper function needed for this

        if (poolItem.media?.promotional) {
          this.setFormValue(
            "media[promotional][brochureUrl]",
            poolItem.media.promotional.brochureUrl
          );
          this.setFormValue(
            "media[promotional][videoUrl]",
            poolItem.media.promotional.videoUrl
          );
          this.setFormValue(
            "media[promotional][catalogUrl]",
            poolItem.media.promotional.catalogUrl
          );
        }
        if (poolItem.media?.links) {
          poolItem.media.links.forEach((link) => this.addLink(link));
        }

        // Contact & Metadata
        if (poolItem.contact) {
          this.setFormValue("contact[email]", poolItem.contact.email);
          this.setFormValue("contact[phone]", poolItem.contact.phone);
          this.setFormValue("contact[whatsapp]", poolItem.contact.whatsapp);
          this.setFormValue(
            "contact[registrationUrl]",
            poolItem.contact.registrationUrl
          );
          this.setFormValue(
            "contact[supportHours]",
            poolItem.contact.supportHours
          );
        }
        // Metadata: Notes will be cleared or adapted by default by resetForm
        // isTemplate, templateName are not set when creating from pool.

        // Ensure dynamic item saves are performed for newly added items
        // This ensures they are marked as 'saved' for validation on next/submit
        [
          "objectives",
          "modules",
          "targetAudience",
          "procedures",
          "equipment",
          "questions",
          "links",
          "certificationBodies",
        ].forEach((type) => {
          const container = document.getElementById(`${type}Container`);
          if (container) {
            Array.from(container.children).forEach((item) => {
              item.setAttribute("data-saved", "true");
              item.style.backgroundColor = "#f0fdf4"; // Light green
              item.style.borderColor = "#10b981";
              const saveBtn = item.querySelector(".save-item-btn");
              if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-check"></i>';
                saveBtn.classList.add("saved");
                saveBtn.title = "Saved";
                saveBtn.disabled = true;
              }
            });
          }
        });

        this.showToast(
          "success",
          "Template Loaded",
          `Form populated with data from "${poolItem.basic.title}" template.`
        );
      } else {
        this.showToast(
          "error",
          "Error",
          result.message || "Failed to load pool item as template."
        );
      }
    } catch (error) {
      console.error("Error using pool item as template:", error);
      this.showToast("error", "Error", "Failed to load template.");
    } finally {
      this.showLoading(false);
    }
  }

  // NEW: Helper to populate file previews from savedUploadedFiles when loading a template
  populateFilePreviewsFromSaved() {
    const fileInputMap = {
      mainImage: "#mainImageInput",
      documents: "#documentsInput",
      images: "#galleryImagesInput",
      videos: "#videosInput",
    };

    Object.keys(fileInputMap).forEach((fileType) => {
      const container = document
        .querySelector(fileInputMap[fileType])
        ?.parentElement?.querySelector(".file-preview-container");
      if (!container) return;

      container.innerHTML = ""; // Clear existing previews

      const files = this.savedUploadedFiles[fileType];

      if (fileType === "mainImage" && files) {
        container.innerHTML = `
                <div class="file-item existing-file saved-file">
                    <div class="file-info">
                        <i class="fas fa-image"></i>
                        <span class="file-name">${files.split("/").pop()}</span>
                        <span class="file-status saved">(Template File)</span>
                    </div>
                </div>
            `;
      } else if (Array.isArray(files) && files.length > 0) {
        files.forEach((url) => {
          const fileItem = document.createElement("div");
          fileItem.className = "file-item existing-file saved-file";
          fileItem.innerHTML = `
                    <div class="file-info">
                        <i class="fas fa-${this.getFileIcon(url)}"></i>
                        <span class="file-name">${url.split("/").pop()}</span>
                        <span class="file-status saved">(Template File)</span>
                    </div>
                `;
          container.appendChild(fileItem);
        });
      }
    });
  }
  // Helper to determine file icon from URL (basic inference)
  getFileIcon(url) {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return "image";
    if (/\.pdf$/i.test(url)) return "file-pdf";
    if (/\.(doc|docx)$/i.test(url)) return "file-word";
    if (/\.(ppt|pptx)$/i.test(url)) return "file-powerpoint";
    if (/\.(mp4|webm|ogg)$/i.test(url)) return "video";
    return "file";
  }

  //............end of pool

  async deleteCourse(courseId) {
    try {
      const course = this.courses.find((c) => c._id === courseId);
      const courseName = course
        ? course.basic?.title || "this course"
        : "this course";

      // ENHANCEMENT: Use enhanced confirmation modal
      this.showConfirmModal(
        "Delete Course",
        `Are you sure you want to delete "${courseName}"? This action cannot be undone and will permanently remove all course data including enrollments and certificates.`,
        async () => {
          try {
            console.log("🗑️ Deleting course:", courseId);

            const response = await fetch(
              `/admin-courses/inperson/api/${courseId}`,
              {
                method: "DELETE",
              }
            );

            const result = await response.json();

            if (response.ok && result.success) {
              this.courses = this.courses.filter((c) => c._id !== courseId);
              this.applyFilters();
              this.updateStats();
              this.showToast(
                "success",
                "Success",
                "Course deleted successfully"
              );
            } else {
              this.showToast(
                "error",
                "Error",
                result.message || "Failed to delete course"
              );
            }
          } catch (error) {
            console.error("Error deleting course:", error);
            this.showToast("error", "Error", "Failed to delete course");
          }
        }
      );
    } catch (error) {
      console.error("Error preparing course deletion:", error);
      this.showToast("error", "Error", "Failed to delete course");
    }
  }

  // ==========================================
  // FORM POPULATION METHODS
  // ==========================================

  // Populate form with course data - Aligned with Model
  populateFormWithCourse(course) {
    console.log("📋 Populating form with course data");

    this.clearDynamicSections();
    this.clearSavedDynamicItems();

    // Reset saved dynamic items to empty
    this.savedDynamicItems = {
      objectives: [],
      modules: [],
      targetAudience: [],
      procedures: [],
      equipment: [],
      questions: [], // This ensures questions aren't duplicated
      partnerHotels: [],
      videoLinks: [],
      links: [],
      instructors: [], // Add instructors array
      certificationBodies: [], // ADD THIS
    };

    // ADD THIS LINE
    this.populatePrimaryInstructor();
    this.setFormValue(
      "instructors[primary][instructorId]",
      course.instructors?.primary?.instructorId
    );

    // Step 1: Basic Information
    this.setFormValue("basic[courseCode]", course.basic?.courseCode);
    this.setFormValue("basic[title]", course.basic?.title);
    this.setFormValue("basic[description]", course.basic?.description);
    this.setFormValue("basic[category]", course.basic?.category);
    this.setFormValue("basic[status]", course.basic?.status);

    // Step 2: Schedule & Duration
    if (course.schedule?.startDate) {
      this.setFormValue(
        "schedule[startDate]",
        this.formatDateForInput(course.schedule.startDate)
      );
    }
    if (course.schedule?.endDate) {
      this.setFormValue(
        "schedule[endDate]",
        this.formatDateForInput(course.schedule.endDate)
      );
    }
    if (course.schedule?.registrationDeadline) {
      this.setFormValue(
        "schedule[registrationDeadline]",
        this.formatDateForInput(course.schedule.registrationDeadline)
      );
    }
    this.setFormValue("schedule[duration]", course.schedule?.duration);
    this.setFormValue(
      "schedule[timeSlots][startTime]",
      course.schedule?.timeSlots?.startTime
    );
    this.setFormValue(
      "schedule[timeSlots][endTime]",
      course.schedule?.timeSlots?.endTime
    );
    this.setFormValue(
      "schedule[timeSlots][lunchBreak]",
      course.schedule?.timeSlots?.lunchBreak
    );

    // Step 3: Pricing & Enrollment
    this.setFormValue("enrollment[price]", course.enrollment?.price);
    this.setFormValue(
      "enrollment[earlyBirdPrice]",
      course.enrollment?.earlyBirdPrice
    );
    this.setFormValue(
      "enrollment[earlyBirdDays]",
      course.enrollment?.earlyBirdDays
    );
    this.setFormValue("enrollment[currency]", course.enrollment?.currency);
    this.setFormValue("enrollment[currency]", course.enrollment?.currency);
    this.setFormValue(
      "enrollment[seatsAvailable]",
      course.enrollment?.seatsAvailable
    );
    this.setFormValue(
      "enrollment[minEnrollment]",
      course.enrollment?.minEnrollment
    );
    this.setFormValue(
      "enrollment[currentEnrollment]",
      course.enrollment?.currentEnrollment
    );

    // Step 4: Instructors
    if (course.instructors?.primary) {
      this.setFormValue(
        "instructors[primary][instructorId]",
        course.instructors.primary.instructorId
      );
      this.setFormValue(
        "instructors[primary][name]",
        course.instructors.primary.name
      );
      this.setFormValue(
        "instructors[primary][role]",
        course.instructors.primary.role
      );
    }

    // Additional Instructors - ENHANCED VERSION
    console.log("🔍 Checking for additional instructors in course object...");
    console.log("Full instructors object from fetch:", course.instructors); // Log the full structure

    let additionalInstructorsToPopulate = [];

    if (
      course.instructors?.additional &&
      Array.isArray(course.instructors.additional)
    ) {
      console.log("✅ Found in course.instructors.additional");
      additionalInstructorsToPopulate = course.instructors.additional
        .map((inst) => {
          // Ensure instructorId is the string ID and name is derived/present
          const instructorId =
            typeof inst.instructorId === "object" && inst.instructorId !== null
              ? inst.instructorId._id
              : inst.instructorId;
          const name =
            inst.name ||
            (inst.instructorId && typeof inst.instructorId === "object"
              ? `${inst.instructorId.firstName || ""} ${
                  inst.instructorId.lastName || ""
                }`.trim()
              : "");
          return {
            instructorId: instructorId,
            name: name,
            role: inst.role,
          };
        })
        .filter((inst) => inst.instructorId); // Filter out any invalid ones
    } else if (
      course.instructors &&
      Array.isArray(course.instructors) &&
      !course.instructors.primary
    ) {
      // This case might happen if instructors array isn't properly nested with 'primary'/'additional'
      // but contains multiple instructor entries directly.
      console.log("✅ Found in course.instructors array (flat structure)");
      additionalInstructorsToPopulate = course.instructors
        .filter(
          (inst) =>
            inst.role !== "Lead Instructor" &&
            inst.role !== "Primary Instructor"
        )
        .map((inst) => {
          const instructorId =
            typeof inst.instructorId === "object" && inst.instructorId !== null
              ? inst.instructorId._id
              : inst.instructorId;
          const name =
            inst.name ||
            (inst.instructorId && typeof inst.instructorId === "object"
              ? `${inst.instructorId.firstName || ""} ${
                  inst.instructorId.lastName || ""
                }`.trim()
              : "");
          return {
            instructorId: instructorId,
            name: name,
            role: inst.role,
          };
        })
        .filter((inst) => inst.instructorId);
    } else {
      console.log("❌ No additional instructors found in expected locations");
    }

    console.log(
      "📋 Processed additional instructors for form:",
      additionalInstructorsToPopulate
    );

    // Clear existing dynamic instructor elements before adding new ones
    const additionalInstructorsContainer = document.getElementById(
      "additionalInstructorsContainer"
    );
    if (additionalInstructorsContainer) {
      additionalInstructorsContainer.innerHTML = "";
    }

    // Add existing additional instructors to the form
    if (additionalInstructorsToPopulate.length > 0) {
      additionalInstructorsToPopulate.forEach((instructor) => {
        this.addInstructor(instructor);
        // Mark as saved locally for validation purposes when editing
        this.savedDynamicItems.instructors.push({
          ...instructor,
          id: this.generateId(),
          saved: true,
          timestamp: new Date().toISOString(),
        });
      });
    }
    console.log(
      "📋 Saved dynamic items after populating instructors:",
      this.savedDynamicItems.instructors
    );

    // Step 5: Venue Information
    if (course.venue) {
      this.setFormValue("venue[name]", course.venue.name);
      this.setFormValue("venue[address]", course.venue.address);
      this.setFormValue("venue[city]", course.venue.city);
      this.setFormValue("venue[country]", course.venue.country);
      this.setFormValue("venue[type]", course.venue.type);
      this.setFormValue("venue[mapUrl]", course.venue.mapUrl);
      this.setFormValue(
        "venue[parkingAvailable]",
        course.venue.parkingAvailable
      );

      if (course.venue.facilities && Array.isArray(course.venue.facilities)) {
        course.venue.facilities.forEach((facility) => {
          const checkbox = document.querySelector(
            `input[name="venue[facilities]"][value="${facility}"]`
          );
          if (checkbox) checkbox.checked = true;
        });
      }
    }

    // Step 6: Course Content
    if (
      course.content?.objectives &&
      Array.isArray(course.content.objectives)
    ) {
      course.content.objectives.forEach((objective) => {
        this.addObjective(objective);
      });
    }

    if (course.content?.modules && Array.isArray(course.content.modules)) {
      course.content.modules.forEach((module) => {
        this.addModule(module);
      });
    }

    if (
      course.content?.targetAudience &&
      Array.isArray(course.content.targetAudience)
    ) {
      course.content.targetAudience.forEach((audience) => {
        this.addTargetAudience(audience);
      });
    }

    this.setFormValue(
      "content[experienceLevel]",
      course.content?.experienceLevel
    );
    this.setFormValue("content[prerequisites]", course.content?.prerequisites);
    this.setFormValue(
      "content[technicalRequirements]",
      course.content?.technicalRequirements
    );

    // Step 7: Practical Training
    if (course.practical) {
      this.setFormValue("practical[hasHandsOn]", course.practical.hasHandsOn);
      this.setFormValue(
        "practical[studentRatio]",
        course.practical.studentRatio
      );

      if (
        course.practical.procedures &&
        Array.isArray(course.practical.procedures)
      ) {
        course.practical.procedures.forEach((procedure) => {
          this.addProcedure(procedure);
        });
      }

      if (
        course.practical.equipment &&
        Array.isArray(course.practical.equipment)
      ) {
        course.practical.equipment.forEach((equipment) => {
          this.addEquipment(equipment);
        });
      }

      if (
        course.practical.trainingType &&
        Array.isArray(course.practical.trainingType)
      ) {
        course.practical.trainingType.forEach((type) => {
          const checkbox = document.querySelector(
            `input[name="practical[trainingType]"][value="${type}"]`
          );
          if (checkbox) checkbox.checked = true;
        });
      }

      if (course.practical.safetyRequirements) {
        this.setFormValue(
          "practical[safetyRequirements][ppeRequired]",
          course.practical.safetyRequirements.ppeRequired
        );
        this.setFormValue(
          "practical[safetyRequirements][healthClearance]",
          course.practical.safetyRequirements.healthClearance
        );
        this.setFormValue(
          "practical[safetyRequirements][insuranceRequired]",
          course.practical.safetyRequirements.insuranceRequired
        );
      }
    }

    // Step 8: Assessment & Certification
    if (course.assessment) {
      this.setFormValue("assessment[required]", course.assessment.required);
      this.setFormValue("assessment[type]", course.assessment.type);
      this.setFormValue(
        "assessment[passingScore]",
        course.assessment.passingScore
      );
      this.setFormValue(
        "assessment[retakesAllowed]",
        course.assessment.retakesAllowed
      );

      this.toggleAssessmentSections(course.assessment.type || "none");

      if (
        course.assessment.questions &&
        Array.isArray(course.assessment.questions)
      ) {
        course.assessment.questions.forEach((question) => {
          this.addQuestion(question);
        });
      }
    }

    // Updated certification handling in populateFormWithCourse method
    if (course.certification) {
      console.log("📋 Processing certification data:", course.certification);

      // Set basic certification fields first
      this.setFormValue("certification[enabled]", course.certification.enabled);
      this.setFormValue("certification[type]", course.certification.type);
      this.setFormValue(
        "certification[issuingAuthority]",
        course.certification.issuingAuthority
      );

      // Handle primary certification body selection
      if (course.certification.issuingAuthorityId) {
        console.log(
          "🏢 Setting primary certification body:",
          course.certification.issuingAuthorityId
        );

        const select = document.getElementById("issuingAuthorityId");
        if (select) {
          // Check if the option exists in the dropdown
          const optionExists = Array.from(select.options).some(
            (option) => option.value === course.certification.issuingAuthorityId
          );

          if (optionExists) {
            select.value = course.certification.issuingAuthorityId;
            // Trigger change event to update the text field
            select.dispatchEvent(new Event("change"));
            console.log("✅ Primary certification body set successfully");
          } else {
            console.warn(
              "⚠️ Primary certification body ID not found in dropdown options"
            );
            // Set the text field manually if the ID doesn't exist in dropdown
            this.setFormValue(
              "certification[issuingAuthority]",
              course.certification.issuingAuthority
            );
          }
        } else {
          console.warn("⚠️ Primary certification body dropdown not found");
        }
      } else {
        console.log("📋 No primary certification body ID, using default IAAI");
        // Ensure default IAAI is set
        const issuingAuthorityInput =
          document.getElementById("issuingAuthority");
        if (issuingAuthorityInput && !issuingAuthorityInput.value) {
          issuingAuthorityInput.value = "IAAI Training Institute";
        }
      }

      // Handle additional certification bodies with improved timing
      if (
        course.certification?.certificationBodies &&
        Array.isArray(course.certification.certificationBodies)
      ) {
        console.log(
          "🏢 Processing additional certification bodies:",
          course.certification.certificationBodies.length
        );

        // Function to add certification bodies
        const addCertificationBodies = () => {
          if (
            !this.certificationBodies ||
            this.certificationBodies.length === 0
          ) {
            console.warn("⚠️ Certification bodies not loaded yet, retrying...");
            return false;
          }

          // Clear existing additional certification bodies first
          const container = document.getElementById(
            "certificationBodiesContainer"
          );
          if (container) {
            container.innerHTML = "";
          }

          // Add each certification body
          course.certification.certificationBodies.forEach((body, index) => {
            console.log(`📋 Adding certification body ${index + 1}:`, body);
            this.addCertificationBody(body);
          });

          console.log(
            "✅ All additional certification bodies added successfully"
          );
          return true;
        };

        // Try to add certification bodies immediately
        if (!addCertificationBodies()) {
          // If certification bodies aren't loaded yet, wait and retry
          let retryCount = 0;
          const maxRetries = 10;
          const retryInterval = 200; // 200ms intervals

          const retryTimer = setInterval(() => {
            retryCount++;
            console.log(
              `🔄 Retry ${retryCount}/${maxRetries} for certification bodies...`
            );

            if (addCertificationBodies() || retryCount >= maxRetries) {
              clearInterval(retryTimer);
              if (retryCount >= maxRetries) {
                console.error(
                  "❌ Failed to load certification bodies after max retries"
                );
                this.showToast(
                  "warning",
                  "Warning",
                  "Some certification bodies could not be loaded"
                );
              }
            }
          }, retryInterval);
        }
      } else {
        console.log("📋 No additional certification bodies to process");
      }

      // Handle certification requirements
      if (course.certification.requirements) {
        console.log("📋 Setting certification requirements");
        this.setFormValue(
          "certification[requirements][minimumAttendance]",
          course.certification.requirements.minimumAttendance
        );
        this.setFormValue(
          "certification[requirements][minimumScore]",
          course.certification.requirements.minimumScore
        );
        this.setFormValue(
          "certification[requirements][practicalRequired]",
          course.certification.requirements.practicalRequired
        );
      } else {
        console.log("📋 No certification requirements, using defaults");
        // Set defaults if not specified
        this.setFormValue("certification[requirements][minimumAttendance]", 80);
        this.setFormValue("certification[requirements][minimumScore]", 70);
        this.setFormValue(
          "certification[requirements][practicalRequired]",
          false
        );
      }

      // Handle certification validity
      if (course.certification.validity) {
        console.log("📋 Setting certification validity");
        this.setFormValue(
          "certification[validity][isLifetime]",
          course.certification.validity.isLifetime
        );
        this.setFormValue(
          "certification[validity][years]",
          course.certification.validity.years
        );
      } else {
        console.log("📋 No certification validity specified, using defaults");
        // Set defaults if not specified
        this.setFormValue("certification[validity][isLifetime]", true);
        this.setFormValue("certification[validity][years]", null);
      }

      // Handle certification features
      if (course.certification.features) {
        console.log("📋 Setting certification features");
        this.setFormValue(
          "certification[features][digitalBadge]",
          course.certification.features.digitalBadge
        );
        this.setFormValue(
          "certification[features][qrVerification]",
          course.certification.features.qrVerification
        );
        this.setFormValue(
          "certification[features][autoGenerate]",
          course.certification.features.autoGenerate
        );
      } else {
        console.log("📋 No certification features specified, using defaults");
        // Set defaults if not specified
        this.setFormValue("certification[features][digitalBadge]", true);
        this.setFormValue("certification[features][qrVerification]", true);
        this.setFormValue("certification[features][autoGenerate]", true);
      }

      console.log("✅ Certification data processing completed");
    } else {
      console.log("📋 No certification data found, using defaults");

      // Set default values when no certification data exists
      this.setFormValue("certification[enabled]", true);
      this.setFormValue("certification[type]", "completion");
      this.setFormValue(
        "certification[issuingAuthority]",
        "IAAI Training Institute"
      );

      // Set default requirements
      this.setFormValue("certification[requirements][minimumAttendance]", 80);
      this.setFormValue("certification[requirements][minimumScore]", 70);
      this.setFormValue(
        "certification[requirements][practicalRequired]",
        false
      );

      // Set default validity
      this.setFormValue("certification[validity][isLifetime]", true);

      // Set default features
      this.setFormValue("certification[features][digitalBadge]", true);
      this.setFormValue("certification[features][qrVerification]", true);
      this.setFormValue("certification[features][autoGenerate]", true);
    }

    // Step 9: Inclusions & Services
    if (course.inclusions) {
      if (course.inclusions.meals) {
        this.setFormValue(
          "inclusions[meals][breakfast]",
          course.inclusions.meals.breakfast
        );
        this.setFormValue(
          "inclusions[meals][lunch]",
          course.inclusions.meals.lunch
        );
        this.setFormValue(
          "inclusions[meals][coffee]",
          course.inclusions.meals.coffee
        );
        this.setFormValue(
          "inclusions[meals][dietaryOptions]",
          course.inclusions.meals.dietaryOptions
        );
      }

      if (course.inclusions.accommodation) {
        this.setFormValue(
          "inclusions[accommodation][included]",
          course.inclusions.accommodation.included
        );
        this.setFormValue(
          "inclusions[accommodation][assistanceProvided]",
          course.inclusions.accommodation.assistanceProvided
        );

        if (
          course.inclusions.accommodation.partnerHotels &&
          Array.isArray(course.inclusions.accommodation.partnerHotels)
        ) {
          course.inclusions.accommodation.partnerHotels.forEach((hotel) => {
            this.addPartnerHotel(hotel);
          });
        }
      }

      if (course.inclusions.materials) {
        this.setFormValue(
          "inclusions[materials][courseMaterials]",
          course.inclusions.materials.courseMaterials
        );
        this.setFormValue(
          "inclusions[materials][certificatePrinting]",
          course.inclusions.materials.certificatePrinting
        );
        this.setFormValue(
          "inclusions[materials][practiceSupplies]",
          course.inclusions.materials.practiceSupplies
        );
        this.setFormValue(
          "inclusions[materials][takeHome]",
          course.inclusions.materials.takeHome
        );
      }

      if (course.inclusions.services) {
        this.setFormValue(
          "inclusions[services][airportTransfer]",
          course.inclusions.services.airportTransfer
        );
        this.setFormValue(
          "inclusions[services][localTransport]",
          course.inclusions.services.localTransport
        );
        this.setFormValue(
          "inclusions[services][translation]",
          course.inclusions.services.translation
        );
      }
    }

    // Step 10: Media & Files
    if (course.media) {
      // Display main image
      if (course.media.mainImage?.url) {
        const mainImageContainer =
          document
            .querySelector("#mainImageInput")
            .parentElement.querySelector(".file-preview-container") ||
          this.createPreviewContainer("#mainImageInput");
        mainImageContainer.innerHTML = `
                    <div class="file-item existing-file">
                        <div class="file-info">
                            <i class="fas fa-image"></i>
                            <span class="file-name">${course.media.mainImage.url
                              .split("/")
                              .pop()}</span>
                            <span class="file-status">(Existing)</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-danger" onclick="adminCourses.deleteExistingFile('mainImage', '${
                          course.media.mainImage.url
                        }', '${course._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
      }

      if (course.media.videos && Array.isArray(course.media.videos)) {
        course.media.videos.forEach((video) => {
          this.addVideoLink(video);
        });
      }

      if (course.media.promotional) {
        this.setFormValue(
          "media[promotional][brochureUrl]",
          course.media.promotional.brochureUrl
        );
        this.setFormValue(
          "media[promotional][videoUrl]",
          course.media.promotional.videoUrl
        );
        this.setFormValue(
          "media[promotional][catalogUrl]",
          course.media.promotional.catalogUrl
        );
      }

      // Display documents
      if (course.media.documents?.length > 0) {
        const docsContainer =
          document
            .querySelector("#documentsInput")
            .parentElement.querySelector(".file-preview-container") ||
          this.createPreviewContainer("#documentsInput");
        docsContainer.innerHTML = course.media.documents
          .map(
            (docUrl) => `
                    <div class="file-item existing-file">
                        <div class="file-info">
                            <i class="fas fa-file"></i>
                            <span class="file-name">${docUrl
                              .split("/")
                              .pop()}</span>
                            <span class="file-status">(Existing)</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-danger" onclick="adminCourses.deleteExistingFile('documents', '${docUrl}', '${
              course._id
            }')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `
          )
          .join("");
      }

      // Display gallery images
      if (course.media.images?.length > 0) {
        const imagesContainer =
          document
            .querySelector("#galleryImagesInput")
            .parentElement.querySelector(".file-preview-container") ||
          this.createPreviewContainer("#galleryImagesInput");
        imagesContainer.innerHTML = course.media.images
          .map(
            (imgUrl) => `
                    <div class="file-item existing-file">
                        <div class="file-info">
                            <i class="fas fa-image"></i>
                            <span class="file-name">${imgUrl
                              .split("/")
                              .pop()}</span>
                            <span class="file-status">(Existing)</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-danger" onclick="adminCourses.deleteExistingFile('images', '${imgUrl}', '${
              course._id
            }')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `
          )
          .join("");
      }

      if (course.media.links && Array.isArray(course.media.links)) {
        course.media.links.forEach((link) => {
          this.addLink(link);
        });
      }
    }

    // Step 11: Attendance Tracking
    if (course.attendance) {
      this.setFormValue(
        "attendance[trackingEnabled]",
        course.attendance.trackingEnabled
      );
      this.setFormValue(
        "attendance[minimumRequired]",
        course.attendance.minimumRequired
      );
      this.setFormValue(
        "attendance[checkInMethod]",
        course.attendance.checkInMethod
      );
    }

    // Step 12: Contact & Metadata
    if (course.contact) {
      this.setFormValue("contact[email]", course.contact.email);
      this.setFormValue("contact[phone]", course.contact.phone);
      this.setFormValue("contact[whatsapp]", course.contact.whatsapp);
      this.setFormValue(
        "contact[registrationUrl]",
        course.contact.registrationUrl
      );
      this.setFormValue("contact[supportHours]", course.contact.supportHours);
    }

    if (course.metadata) {
      this.setFormValue("metadata[version]", course.metadata.version);
      this.setFormValue("metadata[isTemplate]", course.metadata.isTemplate);
      this.setFormValue("metadata[templateName]", course.metadata.templateName);
      this.setFormValue(
        "metadata[tags]",
        course.metadata.tags ? course.metadata.tags.join(", ") : ""
      );
      this.setFormValue("metadata[notes]", course.metadata.notes);
    }

    console.log("✅ Form populated successfully with course data");
  }

  /**
   * Enhanced setFormValue to handle early bird fields
   */
  setFormValue(name, value) {
    const element = document.querySelector(`[name="${name}"]`);
    if (element) {
      if (element.type === "checkbox") {
        element.checked = value === true || value === "true";
      } else {
        element.value = value || "";
      }

      // ADD THIS: Trigger early bird preview update for pricing fields
      if (
        name.includes("enrollment[") &&
        (name.includes("price") || name.includes("earlyBird"))
      ) {
        setTimeout(() => {
          if (this.updateEarlyBirdPreview) {
            this.updateEarlyBirdPreview();
          }
        }, 100);
      }
    }
  }

  formatDateForInput(dateString) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16);
    } catch (error) {
      console.error("Error formatting date for input:", error);
      return "";
    }
  }

  selectAllCourses(checked) {
    document.querySelectorAll(".course-checkbox").forEach((checkbox) => {
      checkbox.checked = checked;
    });
  }

  async exportData() {
    this.showLoading(true);

    try {
      const response = await fetch("/admin-courses/inperson/api/export");
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `in-person-courses-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      a.click();

      window.URL.revokeObjectURL(url);
      this.showToast("success", "Success", "Data exported successfully");
    } catch (error) {
      console.error("Error exporting data:", error);
      this.showToast("error", "Error", "Failed to export data");
    } finally {
      this.showLoading(false);
    }
  }

  // Utility Methods
  formatDate(dateString) {
    if (!dateString) return "TBD";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  }

  showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) {
      overlay.classList.toggle("active", show);
    }
  }

  // ENHANCEMENT: Enhanced confirmation modal with better UX
  showConfirmModal(title, message, onConfirm, options = {}) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const confirmBtn = document.getElementById("confirmAction");
    const cancelBtn = document.getElementById("cancelAction");

    if (!modal || !titleEl || !messageEl || !confirmBtn) {
      console.error("Confirmation modal elements not found");
      return;
    }

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Configure buttons
    const confirmText = options.confirmText || "Confirm";
    const confirmClass = options.confirmClass || "btn-danger";
    const cancelText = options.cancelText || "Cancel";

    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${confirmClass}`;

    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
    }

    // Show modal
    modal.classList.add("active");

    // Store the confirmation action
    this.pendingConfirmAction = onConfirm;

    // Set up button handlers
    const handleConfirm = () => {
      if (this.pendingConfirmAction) {
        this.pendingConfirmAction();
        this.pendingConfirmAction = null;
      }
      this.closeConfirmModal();
    };

    const handleCancel = () => {
      this.closeConfirmModal();
    };

    // Remove existing listeners and add new ones
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById("confirmAction");
    newConfirmBtn.addEventListener("click", handleConfirm);

    if (cancelBtn) {
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      const newCancelBtn = document.getElementById("cancelAction");
      newCancelBtn.addEventListener("click", handleCancel);
    }

    // Handle Escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        handleCancel();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  closeConfirmModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) {
      modal.classList.remove("active");
    }
    this.pendingConfirmAction = null;
  }

  showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon =
      type === "success"
        ? "fa-check-circle"
        : type === "error"
        ? "fa-exclamation-circle"
        : type === "warning"
        ? "fa-exclamation-triangle"
        : "fa-info-circle";

    toast.innerHTML = `
            <i class="fas ${icon} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

    const container = document.getElementById("toastContainer");
    if (container) {
      container.appendChild(toast);

      // Show toast
      setTimeout(() => toast.classList.add("show"), 100);

      // Auto remove after 5 seconds
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }, 5000);
    }
  }

  // Debug Functions
  debugSavedItems() {
    console.log("🔍 Current saved dynamic items:");
    Object.keys(this.savedDynamicItems).forEach((key) => {
      console.log(`${key}:`, this.savedDynamicItems[key].length, "items");
    });

    const totalItems = Object.values(this.savedDynamicItems).reduce(
      (sum, items) => sum + items.length,
      0
    );
    console.log("Total saved items:", totalItems);
  }

  // ENHANCEMENT: Enhanced CSS styles with new features
  getRequiredStyles() {
    return `
            /* CSS Variables */
            :root {
                --primary-color: #3b82f6;
                --secondary-color: #6b7280;
                --success-color: #10b981;
                --danger-color: #ef4444;
                --warning-color: #f59e0b;
                --info-color: #3b82f6;
                --text-primary: #1f2937;
                --text-secondary: #6b7280;
                --text-light: #9ca3af;
                --bg-primary: #ffffff;
                --bg-secondary: #f8fafc;
                --bg-light: #f1f5f9;
                --border-color: #e5e7eb;
                --border-light: #f3f4f6;
                --border-dark: #d1d5db;
            }

            /* Base Styling */
            body {
                color: var(--text-primary);
                background: var(--bg-primary);
            }

            /* Form Elements */
            input, select, textarea {
                color: var(--text-primary) !important;
                background: var(--bg-primary) !important;
                border: 1px solid var(--border-color) !important;
                padding: 8px 12px;
                border-radius: 6px;
            }

            input:focus, select:focus, textarea:focus {
                outline: none;
                border-color: var(--primary-color) !important;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
            }

            input::placeholder, textarea::placeholder {
                color: var(--text-secondary) !important;
            }

            /* Labels */
            label {
                color: var(--text-primary) !important;
                font-weight: 500;
                margin-bottom: 4px;
                display: block;
            }

            /* Headings */
            h1, h2, h3, h4, h5, h6 {
                color: var(--text-primary) !important;
            }

            /* Dynamic Items */
            .dynamic-item {
                color: var(--text-primary) !important;
                background: var(--bg-primary) !important;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 16px;
                padding: 16px;
                transition: all 0.3s ease;
            }

            .dynamic-item.saved-item {
                background: #f0fdf4 !important;
                border-color: #10b981 !important;
            }

            .dynamic-item input,
            .dynamic-item select,
            .dynamic-item textarea {
                color: var(--text-primary) !important;
                background: var(--bg-primary) !important;
            }

            /* Dynamic Item Header */
            .dynamic-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: var(--bg-secondary);
                border-bottom: 1px solid var(--border-color);
                border-radius: 4px 4px 0 0;
                margin-bottom: 12px;
            }

            .dynamic-item-header h6 {
                margin: 0;
                color: var(--text-primary);
                font-weight: 600;
            }

            .dynamic-item-actions {
                display: flex;
                gap: 4px;
            }

            .save-item-btn, .remove-btn {
                padding: 4px 8px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }

            .save-item-btn {
                background: var(--success-color);
                color: white;
            }

            .save-item-btn:hover {
                background: #059669;
            }

            .save-item-btn.saved {
                background: #059669;
                animation: savedPulse 0.5s ease-out;
            }

            .remove-btn {
                background: var(--danger-color);
                color: white;
            }

            .remove-btn:hover {
                background: #dc2626;
            }

            @keyframes savedPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }

            /* Form Grid */
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 16px;
                margin-bottom: 16px;
            }

            .form-group {
                margin-bottom: 16px;
            }

            .form-group.full-width {
                grid-column: 1 / -1;
            }

            /* Status Badges */
            .status-badge {
                color: white !important;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                text-transform: uppercase;
            }

            .status-draft { background: #6b7280 !important; }
            .status-open { background: #10b981 !important; }
            .status-full { background: #f59e0b !important; }
            .status-in-progress { background: #3b82f6 !important; }
            .status-completed { background: #059669 !important; }
            .status-cancelled { background: #ef4444 !important; }

            /* Table Styling */
            table {
                color: var(--text-primary) !important;
                width: 100%;
                border-collapse: collapse;
            }

            th, td {
                color: var(--text-primary) !important;
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid var(--border-color);
            }

            th {
                background: var(--bg-secondary) !important;
                font-weight: 600;
            }

            /* Course Cards */
            .course-card {
                color: var(--text-primary) !important;
                background: var(--bg-primary) !important;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
            }



.file-actions {
            display: flex;
            gap: 4px;
        }

        .save-file-btn {
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: #10b981;
            color: white;
            transition: all 0.2s;
        }

        .save-file-btn:hover:not(:disabled) {
            background: #059669;
        }

        .save-file-btn.saved {
            background: #059669;
            cursor: default;
        }

        .save-file-btn:disabled {
            opacity: 0.8;
        }

        .file-item.saved-file {
            background: #f0fdf4;
            border: 1px solid #10b981;
            border-radius: 4px;
            padding: 8px;
            margin: 4px 0;
        }

        .save-item-btn.saved {
            background: #059669;
            cursor: default;
        }

        .save-item-btn:disabled {
            opacity: 0.8;
        }

        .dynamic-item.saved-item {
            background: #f0fdf4;
            border-color: #10b981;
        }

        /* Keep saved state visible */
        .dynamic-item[data-saved="true"] {
            background: #f0fdf4;
            border-color: #10b981;
        }


            .course-card h3 {
                color: var(--text-primary) !important;
                margin-bottom: 12px;
            }

            /* Buttons */
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
            }

            .btn-primary {
                background: var(--primary-color);
                color: white;
            }

            .btn-primary:hover {
                background: #2563eb;
            }

            .btn-secondary {
                background: var(--secondary-color);
                color: white;
            }

            .btn-secondary:hover {
                background: #4b5563;
            }

            .btn-success {
                background: var(--success-color);
                color: white;
            }

            .btn-success:hover {
                background: #059669;
            }

            .btn-danger {
                background: var(--danger-color);
                color: white;
            }

            .btn-danger:hover {
                background: #dc2626;
            }

            /* Toast Notifications */
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                border-left: 4px solid var(--info-color);
                animation: slideInRight 0.3s ease-out;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                display: flex;
                align-items: flex-start;
                padding: 16px;
                gap: 12px;
            }

            .toast.show {
                opacity: 1;
                transform: translateX(0);
            }

            .toast.success {
                border-left-color: var(--success-color);
            }

            .toast.error {
                border-left-color: var(--danger-color);
            }

            .toast.warning {
                border-left-color: var(--warning-color);
            }

            .toast-icon {
                font-size: 18px;
                margin-top: 2px;
            }

            .toast.success .toast-icon {
                color: var(--success-color);
            }

            .toast.error .toast-icon {
                color: var(--danger-color);
            }

            .toast.warning .toast-icon {
                color: var(--warning-color);
            }

            .toast-content {
                flex: 1;
            }

            .toast-title {
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 4px;
            }

            .toast-message {
                color: var(--text-secondary);
                font-size: 14px;
                line-height: 1.4;
            }

            .toast-close {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-secondary);
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .toast-close:hover {
                background: var(--bg-light);
                color: var(--text-primary);
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            /* ENHANCEMENT: File Upload Styles */
            .upload-progress {
                margin-top: 16px;
                padding: 12px;
                background: var(--bg-light);
                border-radius: 6px;
                border: 1px solid var(--border-color);
            }

            .progress-bar {
                height: 6px;
                background: var(--border-color);
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 8px;
            }

            .progress-fill {
                height: 100%;
                background: var(--primary-color);
                border-radius: 3px;
                animation: progressAnimation 2s ease-in-out infinite;
            }

            @keyframes progressAnimation {
                0% { width: 0%; }
                50% { width: 100%; }
                100% { width: 0%; }
            }

            .progress-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .progress-text {
                font-size: 14px;
                color: var(--text-secondary);
            }

            .progress-cancel {
                background: var(--danger-color);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }

            .progress-cancel:hover {
                background: #dc2626;
            }

            /* ENHANCEMENT: Confirmation Modal Styles */
            .modal-container.small {
                max-width: 500px;
            }

            .modal-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin-top: 20px;
            }

            /* Additional Text Color Fixes */
            .course-title {
                color: var(--text-primary) !important;
                font-weight: 600;
            }

            .course-code {
                color: var(--text-secondary) !important;
                font-size: 14px;
            }

            .venue-name {
                color: var(--text-primary) !important;
                font-weight: 500;
            }

            .venue-location {
                color: var(--text-secondary) !important;
                font-size: 14px;
            }

            .instructor-list {
                color: var(--text-primary) !important;
            }

            .price-main {
                color: var(--text-primary) !important;
                font-weight: 600;
            }

            .enrollment-count {
                color: var(--text-primary) !important;
                font-size: 14px;
            }

            .schedule-date {
                color: var(--text-primary) !important;
                font-weight: 500;
            }

            .schedule-duration {
                color: var(--text-secondary) !important;
                font-size: 12px;
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .toast {
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }

                .dynamic-item-header {
                    flex-direction: column;
                    gap: 8px;
                    align-items: flex-start;
                }

                .modal-actions {
                    flex-direction: column;
                }
            }
        `;
  }
}

// Initialize the admin courses manager
let adminCourses;
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM loaded, initializing AdminCoursesManager...");
  adminCourses = new AdminCoursesManager();

  // Add global debug functions
  window.debugSavedItems = () => adminCourses.debugSavedItems();

  // Add required styles to the page
  const styleSheet = document.createElement("style");
  styleSheet.textContent = adminCourses.getRequiredStyles();
  document.head.appendChild(styleSheet);

  console.log("✅ AdminCoursesManager initialized successfully");
  console.log("💡 Debug command: debugSavedItems()");
});
